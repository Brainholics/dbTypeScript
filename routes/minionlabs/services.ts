import dotenv from 'dotenv';
import express, { Request, Response } from "express";
import { existsSync, mkdirSync, writeFile } from "fs";
import multer from "multer";
import { Readable } from 'stream';
import { removeCredits } from "../../db/enrichminion/user";
import { createLog, generateAPIkey, getApiKey, revokeAPIkey, updateLog } from "../../db/verifyEmail/log";
import s3 from "../../db/verifyEmail/s3";
import verifySessionToken from '../../middleware/enrichminion/supabaseAuth';
import { BreakPoint, Email, SECONDAPIResponse, SMTPResponse, SMTPStatus } from '../../types/interfaces';
import { extractEmails } from '../../utils/extractEmails';
import { uploadToS3 } from '../../utils/uploadtoS3';

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
        const emailsList: string[] = await extractEmails(file);
        if (emailsList.length === 0) {
            res.status(400).json({ message: "No emails found in the file please check your file" });
            return;
        }
        console.log(emailsList);


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

app.post("/executeFileJsonInput", verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const email = (req as any).user.email;
        // file came

        const { emails } = req.body;

        const currentTime = new Date().getTime();

        const JSONData = JSON.stringify(emails);
        // file upload to s3
        const fileName = `${userID}-${email}-${currentTime}.json`;
        const inputParams = {
            Bucket: "verify",
            Key: fileName,
            Body: JSONData,
            ACL: "private",
        }
        const uploadResult = await s3.upload(inputParams).promise();

        // extract emails
        // const emailsList: string[] = await extractEmails(file);
        // if (emailsList.length === 0) {
        //     res.status(400).json({ message: "No emails found in the file please check your file" });
        //     return;
        // }
        console.log(emails);


        const emailsCount = emails.length;
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
                emails: emails,
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
        if (statusData.status === 'pending') {
            res.status(200).json({ message: "In progress", progress: statusData.progress });
            return;
        }


        if (!statusData.emails) {
            res.status(500).json({ message: "No emails found in first SMTP server" });
            return;
        }

        for (const email of statusData.emails) {
            console.log(email);
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
                const pendingEmails = [...restEmails, ...googleWorkspaceEmails];
                const updatedLog = await updateLog(logID, "failed at outlook server", ({
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
                const updatedLog = await updateLog(logID, "failed at Gsuite", ({
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


        let storedLocation = "";


        if (responseFormat === "json") {
            // Create JSON object
            const data = {
                ValidEmails: validEmails.map((email) => email.email),
                CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
                // CatchAllEmails: catchAllEmails.map((email) => email.email),
                InvalidEmails: invalidEmails.map((email) => email.email),
                UnknownEmails: UnknownEmails.map((email) => email.email)
            };

            const outputDir = './output';
            if (!existsSync(outputDir)) {
                console.log("Creating output directory");
                mkdirSync(outputDir);
            }

            const JSONData = JSON.stringify(data, null, 2);
            const jsonFileName = `${outputDir}/${fileName}.json`;

            // Write JSON file
            writeFile(jsonFileName, JSONData, (error) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
            });

            const s3UploadStatus = await uploadToS3("verify-output", fileName + ".json", JSONData, "public-read");

            if (!s3UploadStatus) {
                res.status(500).json({ message: "Failed to upload CSV to S3" });
                return;
            }
            storedLocation = s3UploadStatus.Location;

            console.log("Stored Location: ", storedLocation);

            const updatedLog = await updateLog(logID, "done", ({
                apicode: 4,
                emails: []
            } as BreakPoint))
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at Done" });
                return;
            }

            res.status(200).json({
                message: "File uploaded successfully",
                fileName: fileName + ".json",
                dataURL: storedLocation,
                validEmails: validEmails.length,
                catchAllValidEmails: catchAllValidEmails.length,
                // catchAllEmails: catchAllEmails.length,
                invalidEmails: invalidEmails.length,
                UnknownEmails: UnknownEmails.length
            });


        } else if (responseFormat === "csv") {

            const csvHeaders = ["Valid Emails", "Catch All Valid Emails", "Catch All Emails", "Invalid Emails", "Unknown Emails"];
            const headersRow = csvHeaders.join(",");

            // Use the maximum length of the lists to define the number of rows
            const maxLength = Math.max(
                validEmails.length,
                catchAllValidEmails.length,
                // catchAllEmails.length,
                invalidEmails.length,
                UnknownEmails.length
            );

            // Create CSV rows in a single pass
            const csvRows = Array.from({ length: maxLength }, (_, i) => {
                return [
                    validEmails[i]?.email || "", // Optional chaining and fallback to empty string
                    catchAllValidEmails[i]?.email || "",
                    // catchAllEmails[i]?.email || "",
                    invalidEmails[i]?.email || "",
                    UnknownEmails[i]?.email || ""
                ].join(","); // Join each row with a comma
            });

            // Combine headers and rows
            const csvData = [headersRow, ...csvRows].join("\n"); // Join headers and rows with new line


            const outputDir = './output';
            if (!existsSync(outputDir)) {
                console.log("Creating output directory");
                mkdirSync(outputDir);
            }
            const CSVFileName = `${outputDir}/${fileName}.csv`;

            writeFile(CSVFileName, csvData, (error) => {
                if (error) {
                    res.status(500).json({ message: error.message });
                    return;
                }
            });

            const s3UploadStatus = await uploadToS3("verify-output", fileName + ".csv", csvData, "public-read");

            if (!s3UploadStatus) {
                res.status(500).json({ message: "Failed to upload CSV to S3" });
                return;
            }

            storedLocation = s3UploadStatus.Location;

            // Send the response only after the S3 upload completes
            const updatedLog = await updateLog(logID, "done", ({
                apicode: 4,
                emails: []
            } as BreakPoint))
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at Done" });
                return;
            }

            res.status(200).json({
                message: "File uploaded successfully",
                fileName: fileName + ".csv",
                dataURL: storedLocation,
                validEmails: validEmails.length,
                catchAllValidEmails: catchAllValidEmails.length,
                // catchAllEmails: catchAllEmails.length,
                invalidEmails: invalidEmails.length,
                UnknownEmails: UnknownEmails.length
            });

        } else {
            res.status(400).json({ message: "Invalid response format" });
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

app.post('/scanDB', verifySessionToken, upload.single('csv'), async (req: Request, res: Response) => {
    const startingTime = new Date().getTime();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const file = req.file;
        const { wantedFields, responseType, discordUsername, responseFormat, email, firstName, lastName, phoneNumber } = req.body;

        const blob = new Blob([file.buffer], { type: file.mimetype });
        const formData = new FormData()
        formData.append('csv', blob, 'data.csv');
        formData.append('wantedFields', wantedFields)
        formData.append('responseType', responseType)
        formData.append('discordUsername', discordUsername)
        formData.append('responseFormat', responseFormat)
        formData.append('email', email)
        formData.append('firstName', firstName)
        formData.append('lastName', lastName)
        formData.append('phoneNumber', phoneNumber)

        const response = await fetch('https://enrichbackend.dealsinfo.store/api/GetResponse', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.token}`
            },
            body: formData
        });

        const data = await response.json();
        if (data.error) {
            res.status(500).json({ error: data.error });
            return;
        }
        res.status(200).json(data);
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});



export default app;