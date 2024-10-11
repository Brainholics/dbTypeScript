import dotenv from 'dotenv';
import express, { Request, Response } from "express";
import { existsSync, mkdirSync, readFileSync, writeFile } from "fs";
import multer from "multer";
import { Readable } from 'stream';
import { addCredits, removeCredits } from "../../db/enrichminion/user";
import { createLog, generateAPIkey, getApiKey, revokeAPIkey, updateLog ,getOneLog, changeProgressStatus, addJSONStringToLog} from "../../db/verifyEmail/log";
import s3 from "../../db/verifyEmail/s3";
import verifySessionToken from '../../middleware/enrichminion/supabaseAuth';
import { BreakPoint, Email, ScanDbResponse, SECONDAPIResponse, SMTPResponse, SMTPStatus } from '../../types/interfaces';
import { extractEmails } from '../../utils/extractEmails';
import { uploadToS3 } from '../../utils/uploadtoS3';
import {createCSV} from "../../utils/createcsvfromstringarr"
import { createLog as EnrichLog} from '../../db/enrichminion/log';
import { v4 } from 'uuid';

dotenv.config();


const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

// app.post("/executeFile", verifySessionToken, upload.single('file'), async (req: Request, res: Response): Promise<void> => {
//     try {
//         const userID = (req as any).user.id;
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
//             ACL: "private",
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
//             const log = await createLog("0", userID, fileName, creditsUsed, emailsCount,false);
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
//         const log = await createLog(data.id, userID, fileName, creditsUsed, emailsCount,false);

//         if (!log) {
//             res.status(400).json({ message: "Failed to create log" });
//             return;
//         }

//         res.status(200).json({ message: "File uploaded successfully", log });

//     } catch (error: any) {
//         res.status(500).json({ message: error.message });
//     }
// });

app.post("/executeFileJsonInput", verifySessionToken, async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
        const email = (req as any).user.email;
        // file came

        const { emails } = req.body;

        const emailsCount = emails.length;
        const creditsUsed = emailsCount * parseInt(process.env.VerifyCost as string);

        // deduct credits 
        const credits = await removeCredits(creditsUsed, userID);
        if (!credits) {
            res.status(400).json({ message: "Insufficient credits" });
            return;
        }
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
            const log = await createLog("0", userID, fileName, creditsUsed, emailsCount, false);
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
        const log = await createLog(data.id, userID, fileName, creditsUsed, emailsCount,false);

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

        if(log.InProgress){
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

        // Create JSON object
        const data = {
            ValidEmails: validEmails.map((email) => email.email),
            CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
            InvalidEmails: invalidEmails.map((email) => email.email),
            UnknownEmails: UnknownEmails.map((email) => email.email)
        };


        const JSONData = JSON.stringify(data, null, 2);
       
        const updatedLog = await updateLog(logID, "completed", ({
            apicode: 4,
            emails: []
        } as BreakPoint))
        if (!updatedLog) {
            res.status(400).json({ message: "Failed to update log at Done" });
            return;
        }

        const addJSONstring = await addJSONStringToLog(logID, JSONData);
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

app.post('/GetEmailResponse', verifySessionToken, upload.single('csv'), async (req: Request, res: Response) => {
    const userID = (req as any).user.id;
    const startingTime = new Date().getTime();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "private", "text/csv");
        const {responseType, discordUsername, email,mappedOptions,creditsDeducted ,type} = req.body;

        const blob = new Blob([file.buffer], { type: file.mimetype });
        const formData = new FormData()
        formData.append('csv', blob, 'data.csv');
        formData.append('responseType', responseType)
        formData.append('discordUsername', discordUsername)
        formData.append('email', email)
        formData.append('mappedOptions', mappedOptions)

        const response = await fetch('https://enrichbackend.dealsinfo.store/api/GetEmailResponse', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.token}`
            },
            body: formData
        });

        if (!response.ok) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }

        const data = await response.json() as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits,userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }
        const fileName = `${userID}-${email}-${startingTime}-Enriched-Emails.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString('utf-8') : "File not found";
        const uploadS3Enriched = await uploadToS3('enrich-output', fileName, fileContent, "public", "text/csv");
        const logID = v4();
        const log = await EnrichLog(logID,userID,creditsUsed,fileName,type,uploadS3Enriched?.Location as string); 
        if (!log) {
            res.status(500).json({ error: "Failed to create log" });
            return;
        }
        res.status(200).json({ log });
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});

app.post('/GetPhoneNumberResponse', verifySessionToken, upload.single('csv'), async (req: Request, res: Response) => {
    const userID = (req as any).user.id;
    const startingTime = new Date().getTime();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "private", "text/csv");
        const {responseType, discordUsername, email,mappedOptions,creditsDeducted ,type} = req.body;

        const blob = new Blob([file.buffer], { type: file.mimetype });
        const formData = new FormData()
        formData.append('csv', blob, 'data.csv');
        formData.append('responseType', responseType)
        formData.append('discordUsername', discordUsername)
        formData.append('email', email)
        formData.append('mappedOptions', mappedOptions)

        const response = await fetch('https://enrichbackend.dealsinfo.store/api/GetPhoneNumberResponse', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.token}`
            },
            body: formData
        });

        if (!response.ok) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }

        const data = await response.json() as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits,userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }
        const fileName = `${userID}-${email}-${startingTime}-Enriched-PhoneNumber.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString('utf-8') : "File not found";
        const uploadS3Enriched = await uploadToS3('enrich-output', fileName, fileContent, "public", "text/csv");
        const logID = v4();
        const log = await EnrichLog(logID,userID,creditsUsed,fileName,type,uploadS3Enriched?.Location as string); 
        if (!log) {
            res.status(500).json({ error: "Failed to create log" });
            return;
        }
        res.status(200).json({ log });
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});

app.post('/GetBothResponse', verifySessionToken, upload.single('csv'), async (req: Request, res: Response) => {
    const userID = (req as any).user.id;
    const startingTime = new Date().getTime();
    try {
        if (!req.file) {
            res.status(400).json({ error: "No file uploaded" });
            return;
        }
        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "private", "text/csv");
        const {responseType, discordUsername, email,mappedOptions,creditsDeducted ,type} = req.body;

        const blob = new Blob([file.buffer], { type: file.mimetype });
        const formData = new FormData()
        formData.append('csv', blob, 'data.csv');
        formData.append('responseType', responseType)
        formData.append('discordUsername', discordUsername)
        formData.append('email', email)
        formData.append('mappedOptions', mappedOptions)

        const response = await fetch('https://enrichbackend.dealsinfo.store/api/GetBothrResponse', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.token}`
            },
            body: formData
        });

        if (!response.ok) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }

        const data = await response.json() as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits,userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }
        const fileName = `${userID}-${email}-${startingTime}-Enriched-Both.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString('utf-8') : "File not found";
        const uploadS3Enriched = await uploadToS3('enrich-output', fileName, fileContent, "public", "text/csv");
        const logID = v4();
        const log = await EnrichLog(logID,userID,creditsUsed,fileName,type,uploadS3Enriched?.Location as string); 
        if (!log) {
            res.status(500).json({ error: "Failed to create log" });
            return;
        }
        res.status(200).json({ log });
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});

export default app;