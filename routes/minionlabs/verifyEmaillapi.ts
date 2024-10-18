import dotenv from 'dotenv';
import express, { Request, Response } from "express";
import multer from "multer";
import { Readable } from 'stream';
import { removeCredits } from "../../db/enrichminion/user";
import { addJSONStringToLog, changeProgressStatus, createLog, getOneLog, updateLog } from "../../db/verifyEmail/log";
import s3 from "../../db/verifyEmail/s3";
import verifyAuthToken from "../../middleware/enrichminion/apiAuth";
import { BreakPoint, Email, SECONDAPIResponse, SMTPResponse, SMTPStatus } from '../../types/interfaces';
import { extractEmails } from '../../utils/extractEmails';
dotenv.config();


const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// app.post("/executeFile", verifyAuthToken, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
//     try {
//         const userID = (req as any).user.UserID;
//         const email = (req as any).user.email;
//         // file came

//         const file = req.file;
//         if (!file) {
//             res.status(400).json({ message: "File not found" });
//             return;
//         }

//         const currentTime = new Date().getTime();

//         // file upload to s3
//         const fileName = `${userID}-${email}-${currentTime}.csv`;
//         const inputParams = {
//             Bucket: "verify",
//             Key: fileName,
//             Body: file.buffer,
//             ACL: "public-read",
//         }
//         const uploadResult = await s3.upload(inputParams).promise();

//         // extract emails
//         const emailsList: string[] = await extractEmails(file);
//         if (emailsList.length === 0) {
//             res.status(400).json({ message: "No emails found in the file please check your file" });
//             return;
//         }
//         console.log(emailsList);


//         const emailsCount = emailsList.length;
//         const creditsUsed = emailsCount * parseInt(process.env.VerifyCost as string);

//         // deduct credits 
//         const credits = await removeCredits(creditsUsed, userID);
//         if (!credits) {
//             res.status(400).json({ message: "Insufficient credits" });
//             return;
//         }

//         // send request to SMTP ENDPOINT
//         const response = await fetch(process.env.SMTPENDPOINT as string, {
//             method: "POST",
//             headers: {
//                 "Content-Type": "application/json",
//             },
//             body: JSON.stringify({
//                 emails: emailsList,
//             }),
//             redirect: "follow",
//         })

//         if (!response.ok) {
//             res.status(400).json({ message: "Failed to send emails to SMTP server" });
//             const log = await createLog("0", userID, fileName, creditsUsed, emailsCount);
//             if (!log) {
//                 res.status(400).json({ message: "Failed to create log" });
//                 return;
//             }

//             const updatedLog = await updateLog(log.LogID, "failed at 1", ({
//                 apicode: 1,
//                 emails: emailsList
//             } as BreakPoint));
//             if (!updatedLog) {
//                 res.status(400).json({ message: "Failed to update log at First server failure" });
//                 return;
//             }
//             return;
//         }

//         const data = await response.json() as SMTPResponse;

//         // create log
//         const log = await createLog(data.id, userID, fileName, creditsUsed, emailsCount);

//         if (!log) {
//             res.status(400).json({ message: "Failed to create log" });
//             return;
//         }

//         res.status(200).json({ message: "File uploaded successfully", log });

//     } catch (error: any) {
//         res.status(500).json({ message: error.message });
//     }
// });

app.post("/executeFileJsonInput", verifyAuthToken, upload.single("json"), async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.UserID;
        const email = (req as any).user.email;
        // file came
        if (!req.file) {
            res.status(400).json({ message: "File not found" });
            return;
        }
        const file = req.file;
        const fileData = JSON.parse(file.buffer.toString('utf-8'));
        const emails = fileData.emails;

        const emailsCount = emails.length;
        const creditsUsed = emailsCount * parseInt(process.env.VerifyCost as string);
        // deduct credits 
        const credits = await removeCredits(creditsUsed, userID);
        if (!credits) {
            res.status(400).json({ message: "Insufficient credits" });
            return;
        }
        const currentTime = new Date().getTime();

        const JSONData = JSON.stringify(fileData, null, 2);
        // file upload to s3
        const fileName = `${userID}-${email}-${currentTime}.json`;
        const inputParams = {
            Bucket: "verify",
            Key: fileName,
            Body: JSONData,
            ACL: "public-read",
        }
        const uploadResult = await s3.upload(inputParams).promise();

        // send request to SMTP ENDPOINT
        const response = await fetch(process.env.SMTPENDPOINT as string, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                emails: emails,
            }),
            redirect: "follow",
        })

        if (!response.ok) {
            res.status(400).json({ message: "Failed to send emails to SMTP server" });
            const log = await createLog("0", userID, fileName, creditsUsed, emailsCount, false, uploadResult.Location);
            if (!log) {
                res.status(400).json({ message: "Failed to create log" });
                return;
            }

            const updatedLog = await updateLog(log.LogID, "1", ({
                apicode: 1,
                emails: emails
            } as BreakPoint));
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at First server failure" });
                return;
            }
            return;
        }

        const data = await response.json() as SMTPResponse;

        // create log
        const log = await createLog(data.id, userID, fileName, creditsUsed, emailsCount, false, uploadResult.Location);

        if (!log) {
            res.status(400).json({ message: "Failed to create log" });
            return;
        }

        res.status(200).json({ message: "File uploaded successfully", log });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});


app.post("/checkStatus", verifyAuthToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const { logID } = req.body;
        if (!logID) {
            res.status(400).json({ message: "Log ID not found" });
            return;
        }

        const log = await getOneLog(logID);
        if (!log) {
            res.status(400).json({ message: "Log not found" });
            return;
        }
        if (log.status === "completed") {
            res.status(200).json({ message: "Completed", "log": log });
            return;
        }

        if (log.InProgress) {
            res.status(200).json({ message: "In progress" });
            return;
        }

        const googleWorkspaceEmails: Email[] = [];
        const restEmails: Email[] = [];
        const validEmails: Email[] = [];
        const catchAllValidEmails: Email[] = [];
        const UnknownEmails: Email[] = [];
        const invalidEmails: Email[] = [];

        const SMTPResponseStatus = await fetch(process.env.SMTPRESPONSE as string, {
            method: "POST",
            headers: {
                "x-mails-api-key": process.env.SMTPAPIKEY as string,
                "ID": logID
            }
        });

        if (!SMTPResponseStatus.ok) {
            res.status(400).json({ message: "Failed to check status from SMTP server" });
            return;
        }

        const statusData = await SMTPResponseStatus.json() as SMTPStatus;
        if (statusData.status !== 'completed') {
            res.status(200).json({ message: "In progress", progress: statusData.progress });
            return;
        }

        const updateProgressLog = await changeProgressStatus(logID, true);
        if (!updateProgressLog) {
            res.status(400).json({ message: "Failed to update log" });
            return;
        }

        if (!statusData.emails) {
            res.status(500).json({ message: "No emails found in first SMTP server" });
            return;
        }

        for (const email of statusData.emails) {
            if (email.result === "unknown" || email.result === "catch_all" || email.result === "risky") {
                if (email.provider === "googleworkspace") {
                    googleWorkspaceEmails.push(email);
                } else {
                    restEmails.push(email);
                }
            } else if (email.result === "deliverable") {
                validEmails.push(email);
            } else {
                // console.log({"Invalid Email": email.result});
                invalidEmails.push(email);
            }
        }

        for (const email of restEmails) {

            const response = await fetch(process.env.OutlookEndpoint as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            })

            if (!response.ok) {
                //adding {email:"GoogleWorkSpaceStart"} to the emails array to send emails to google workspace server Because lazy do not want to change DB schema 
                const pendingEmails = [...restEmails, { email: "GoogleWorkSpaceStart" } as Email, ...googleWorkspaceEmails];
                const updatedLog = await updateLog(logID, "2", ({
                    apicode: 2,
                    emails: pendingEmails.map((email) => email.email)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of outlook server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to outlook server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                if (email.result === "catch_all" || email.result === "risky") {
                    catchAllValidEmails.push(email);
                }
                else {
                    validEmails.push(email);
                }
            }
            else {
                googleWorkspaceEmails.push(email);
            }
        }

        for (const email of googleWorkspaceEmails) {
            const response = await fetch(process.env.GsuiteEndpoint as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            });

            if (!response.ok) {
                const updatedLog = await updateLog(logID, "3", ({
                    apicode: 3,
                    emails: googleWorkspaceEmails.map((email) => email.email)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of Gsuite server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to Gsuite server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                if (email.result === "catch_all" || email.result === "risky") {
                    catchAllValidEmails.push(email);
                }
                else {
                    validEmails.push(email);
                }
            }
            else {
                UnknownEmails.push(email);
            }
        }

        const Location = updateProgressLog.url;

        const uploadedJson = await fetch(Location as string);
        if (!uploadedJson.ok) {
            res.status(400).json({ message: "Failed to fetch uploaded JSON" });
            return;
        }

        const uploadedJsonData = await uploadedJson.json();

        console.log({ uploadedJsonData: uploadedJsonData });

        // Create JSON object
        const data = {
            ...uploadedJsonData,
            ValidEmails: validEmails.map((email) => email.email),
            CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
            InvalidEmails: invalidEmails.map((email) => email.email),
            UnknownEmails: UnknownEmails.map((email) => email.email)
        };

        console.log({ data: data });


        const JSONData = JSON.stringify(data, null, 2);

        const updatedLog = await updateLog(logID, "completed", ({
            apicode: 4,
            emails: [],
            providers: [],
            statuses: []
        } as BreakPoint))
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at Done" });
            return;
        }

        const addJSONstring = await addJSONStringToLog(logID, JSONData, validEmails.length, invalidEmails.length, UnknownEmails.length, catchAllValidEmails.length);;
        if (!addJSONstring) {
            res.status(400).json({ message: "Failed to add JSON data to log" });
            return;
        }

        res.status(200).json({
            message: "File uploaded successfully",
            validEmails: validEmails.length,
            catchAllValidEmails: catchAllValidEmails.length,
            invalidEmails: invalidEmails.length,
            UnknownEmails: UnknownEmails.length
        });

        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

export default app;