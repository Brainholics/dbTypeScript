import dotenv from 'dotenv';
import express, { Request, Response } from "express";
import { writeFile } from "fs";
import multer from "multer";
import { Readable } from 'stream';
import { removeCredits } from "../../db/enrichminion/user";
import { createLog, generateAPIkey, getApiKey, revokeAPIkey, updateLog } from "../../db/verifyEmail/log";
import s3 from "../../db/verifyEmail/s3";
import verifySessionToken from '../../middleware/enrichminion/supabaseAuth';
import { BreakPoint, Email, SECONDAPIResponse, SMTPResponse, SMTPStatus } from '../../types/interfaces';

dotenv.config();


const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/executeFile", verifySessionToken, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const email = (req as any).user.email;
        // file came

        const file = req.file;
        if (!file) {
            res.status(400).json({ message: "File not found" });
            return;
        }

        const currentTime = new Date().getTime();
        const emailsList: string[] = [];

        // file upload to s3
        const fileName = `${userID}-${email}-${currentTime}.csv`;
        const inputParams = {
            Bucket: "verify",
            Key: fileName,
            Body: file.buffer,
            ACL: "private",
        }
        const uploadResult = await s3.upload(inputParams).promise();

        // extract emails
        const fileStream = Readable.from(file.buffer);
        fileStream.on("data", (row) => {
            if (row.emails) {
                emailsList.push(row.emails);
            }
        }).on("end", () => {
            console.log(`${fileName} emails extracted`);
        }).on("error", (error) => {
            res.status(500).json({ message: error.message });
        });

        const emailsCount = emailsList.length;
        const creditsUsed = emailsCount * parseInt(process.env.VerifyCost as string);

        // deduct credits 
        const credits = await removeCredits(creditsUsed, userID);
        if (!credits) {
            res.status(400).json({ message: "Insufficient credits" });
            return;
        }

        // send request to SMTP ENDPOINT
        const response = await fetch(process.env.SMTPENDPOINT as string, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                emails: emailsList,
            }),
            redirect: "follow",
        })

        if (!response.ok) {
            res.status(400).json({ message: "Failed to send emails to SMTP server" });
            const log = await createLog("0", userID, fileName, creditsUsed, emailsCount);
            if (!log) {
                res.status(400).json({ message: "Failed to create log" });
                return;
            }

            const updatedLog = await updateLog(log.LogID, "failed at 1", ({
                apicode: 1,
                emails: emailsList
            } as BreakPoint));
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at First server failure" });
                return;
            }
            return;
        }

        const data = await response.json() as SMTPResponse;

        // create log
        const log = await createLog(data.id, userID, fileName, creditsUsed, emailsCount);

        if (!log) {
            res.status(400).json({ message: "Failed to create log" });
            return;
        }

        res.status(200).json({ message: "File uploaded successfully", log });

    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

app.post("/checkStatus", verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const email = (req as any).user.email;
        const currentTime = new Date().getTime();

        const fileName = `${userID}-${email}-${currentTime}-output`;

        const { logID, responseFormat } = req.body;
        if (!logID) {
            res.status(400).json({ message: "Log ID not found" });
            return;
        }

        const googleWorkspaceEmails: Email[] = [];
        const restEmails: Email[] = [];
        const validEmails: Email[] = [];
        const catchAllValidEmails: Email[] = [];
        const catchAllEmails: Email[] = [];
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
        if (!statusData.finished_at) {
            res.status(200).json({ message: "In progress" });
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
                invalidEmails.push(email);
            }
        }

        for (const email of googleWorkspaceEmails) {
            const response = await fetch(process.env.SECONDENDPOINT as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            });

            if (!response.ok) {
                const pendingEmails = [...googleWorkspaceEmails, ...restEmails];
                const updatedLog = await updateLog(logID, "failed at 2", ({
                    apicode: 2,
                    emails: pendingEmails.map((email) => email.email)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of second server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to SECOND server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                validEmails.push(email);
            }

            else if (data['EMAIL-status'] === "catchall_valid") {
                catchAllValidEmails.push(email);
            }

            else if (data['EMAIL-status'] === "catchall") {
                catchAllEmails.push(email);
            }

            else {
                restEmails.push(email);
            }
        }

        for (const email of restEmails) {

            const response = await fetch(process.env.THIRDENDPOINT as string, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    email: email.email
                })
            })

            if (!response.ok) {
                const updatedLog = await updateLog(logID, "failed at 3", ({
                    apicode: 3,
                    emails: restEmails.map((email) => email.email)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of third server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to THIRD server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;

            if (data['EMAIL-status'] === "valid") {
                validEmails.push(email);
            }

            else if (data['EMAIL-status'] === "catchall_valid") {
                catchAllValidEmails.push(email);
            }

            else if (data['EMAIL-status'] === "catchall") {
                catchAllEmails.push(email);
            }

            else {
                UnknownEmails.push(email);
            }
        }


        let storedLocation = "";

        if (responseFormat === "json") {
            // create json file
            const data = {
                ValidEmails: validEmails,
                CatchAllValidEmails: catchAllValidEmails,
                CatchAllEmails: catchAllEmails,
                InvalidEmails: invalidEmails,
                UnknownEmails: UnknownEmails
            }

            const JSONData = JSON.stringify(data, null, 2);

            const jsonFileName = fileName + ".json";

            writeFile("./output/" + fileName + ".json", JSONData, (error) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
            });

            s3.upload({
                Bucket: "verify-output",
                Key: jsonFileName,
                Body: JSONData,
                ACL: "public-read",
            }, (error: any, data: any) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
                storedLocation = data.Location;

            })

            res.status(200).json({ message: "File uploaded successfully", fileName: jsonFileName, dataURL: storedLocation });


        } else if (responseFormat === "csv") {

            const csvData = "Valid Emails\n" + validEmails.join("\n") + "\n\nCatch All Valid Emails\n" + catchAllValidEmails.join("\n") + "\n\nCatch All Emails\n" + catchAllEmails.join("\n") + "\n\nInvalid Emails\n" + invalidEmails.join("\n") + "\n\nUnknown Emails\n" + UnknownEmails.join("\n");

            writeFile("./output/" + fileName + ".csv", csvData, (error) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
            });

            s3.upload({
                Bucket: "verify-output",
                Key: fileName + ".csv",
                Body: csvData,
                ACL: "public-read",
            }, (error: any, data: any) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
                storedLocation = data.Location;
            })

            res.status(200).json({ message: "File uploaded successfully", fileName: fileName + ".csv", dataURL: storedLocation });

        } else {
            res.status(400).json({ message: "Invalid response format" });
            return;
        }

        const updatedLog = await updateLog(logID, "done", ({
            apicode: 4,
            emails: []
        } as BreakPoint))
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at Done" });
            return;
        }
        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
})

app.post("/generateAPIkey", verifySessionToken, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await generateAPIkey(userID);
        if (!resp) {
            throw new Error("failed to generate key");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.post("/getAPIkey", verifySessionToken, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await getApiKey(userID);
        if (!resp) {
            throw new Error("this account do not have APIKEY access");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});

app.post("/revokeAPIkey", verifySessionToken, async (req: Request, res: Response) => {  //TESTED
    try {
        const { userID } = req.body;
        const resp = await revokeAPIkey(userID);
        if (!resp) {
            throw new Error("failed to revoke key");
        }
        res.status(200).json({ resp });
    } catch (error: any) {
        res.status(404).json({ "message": error.message });
    }
});


export default app;