import axios from 'axios';
import dotenv from 'dotenv';
import express, { Request, Response } from "express";
import FormData from 'form-data';
import { createReadStream, existsSync, mkdirSync, readFileSync, stat, writeFile } from "fs";
import multer from "multer";
import { Readable } from 'stream';
import { v4 } from 'uuid';
import { createLog as EnrichLog, updateLog as EnrichUpdateLog , deleteLog as EnrichDeleteLog} from '../../db/enrichminion/log';
import { addCredits, removeCredits } from "../../db/enrichminion/user";
import { addJSONStringToLog, changeProgressStatus, createLog, generateAPIkey, getApiKey, getOneLog, revokeAPIkey, updateLog } from "../../db/verifyEmail/log";
import s3 from "../../db/verifyEmail/s3";
import verifySessionToken from '../../middleware/enrichminion/supabaseAuth';
import { BreakPoint, Email, ScanDbResponse, SECONDAPIResponse, SMTPResponse, SMTPStatus } from '../../types/interfaces';
import { createCSV } from "../../utils/createcsvfromstringarr";
import { extractEmails } from '../../utils/extractEmails';
import { uploadToS3 } from '../../utils/uploadtoS3';
import apiAuth from '../../middleware/enrichminion/apiAuth';
dotenv.config();


const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post("/executeFileJsonInput", verifySessionToken, upload.single("json"), async (req: Request, res: Response): Promise<void> => {
    try {
        const userID = (req as any).user.id;
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
            const log = await createLog(v4(), userID, fileName, creditsUsed, emailsCount, false, uploadResult.Location);
            if (!log) {
                res.status(400).json({ message: "Failed to create log" });
                return;
            }

            const updatedLog = await updateLog(log.LogID, "1", ({
                apicode: 1,
                emails: emails,
                providers: [""],
                statuses: [""],
                mxRecords: [""],
                mxProviders: [""]
            } as BreakPoint));
            if (!updatedLog) {
                res.status(400).json({ message: "Failed to update log at First server failure" });
                return;
            }
            res.status(400).json({ message: "Failed to send emails to SMTP server" });
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
        if (log.status === "completed") {
            res.status(200).json({ message: "Completed", "log": log });
            return;
        }

        if (log.InProgress) {
            res.status(200).json({ message: "In progress", log: log });
            return;
        }

        const googleWorkspaceEmails: Email[] = [];
        const restEmails: Email[] = [];
        const validEmails: Email[] = [];
        const catchAllValidEmails: Email[] = [];
        const UnknownEmails: Email[] = [];
        const invalidEmails: Email[] = [];

        // Function to poll SMTP response status
        const checkSMTPStatus = async (): Promise<SMTPStatus | null> => {
            const maxRetries = 60; // Retry for up to 5 minutes (5 seconds * 60 retries)
            let retries = 0;
            let statusData: SMTPStatus | null = null;

            while (retries < maxRetries) {
                const SMTPResponseStatus = await fetch(process.env.SMTPRESPONSE as string, {
                    method: "POST",
                    headers: {
                        "x-mails-api-key": process.env.SMTPAPIKEY as string,
                        "ID": logID
                    }
                });

                if (SMTPResponseStatus.ok) {
                    statusData = await SMTPResponseStatus.json() as SMTPStatus;

                    if (statusData.status === 'completed') {
                        return statusData;
                    }

                    // If status is not complete, wait 5 seconds before retrying
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000)); // Wait 5 seconds
                } else {
                    res.status(400).json({ message: "Failed to check status from SMTP server" });
                    return null;
                }
            }

            res.status(408).json({ message: "Timeout: Status not completed within 5 hours" });
            return null;
        };

        // Call the polling function
        const statusData = await checkSMTPStatus();
        if (!statusData) return;

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
                const pendingEmails = [...restEmails, ...googleWorkspaceEmails];
                const updatedLog = await updateLog(logID, "2", ({
                    apicode: 2,
                    emails: pendingEmails.map((email) => email.email),
                    providers: pendingEmails.map((email) => email.provider),
                    statuses: pendingEmails.map((email) => email.result),
                    mxRecords: statusData.emails.map((email) => email.mx_record),
                    mxProviders: statusData.emails.map((email) => email.provider)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of outlook server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to outlook server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;
            if (data.emailStatus === "valid") {
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
                    emails: googleWorkspaceEmails.map((email) => email.email),
                    providers: googleWorkspaceEmails.map((email) => email.provider),
                    statuses: googleWorkspaceEmails.map((email) => email.result),
                    mxRecords: statusData.emails.map((email) => email.mx_record),
                    mxProviders: statusData.emails.map((email) => email.provider)
                } as BreakPoint))
                if (!updatedLog) {
                    res.status(400).json({ message: "Failed to update log in case of Gsuite server failure" });
                    return;
                }
                res.status(400).json({ message: "Failed to send emails to Gsuite server" });
                return;
            }

            const data = await response.json() as SECONDAPIResponse;
            if (data.emailStatus === "valid") {
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

        let Location = updateProgressLog.url;
        if (Location?.startsWith("http://")) {
            Location = Location.replace("http://", "https://");
        }

        const uploadedJson = await fetch(Location as string);
        if (!uploadedJson.ok) {
            res.status(400).json({ message: "Failed to fetch uploaded JSON" });
            return;
        }

        const uploadedJsonData = await uploadedJson.json();

        // Create JSON object
        const data = {
            ...uploadedJsonData,
            ValidEmails: validEmails.map((email) => email.email),
            CatchAllValidEmails: catchAllValidEmails.map((email) => email.email),
            InvalidEmails: invalidEmails.map((email) => email.email),
            UnknownEmails: UnknownEmails.map((email) => email.email),
            MXRecords: statusData.emails.map((email) => email.mx_record),
            MXProviders: statusData.emails.map((email) => email.provider),
        };

        const JSONData = JSON.stringify(data, null, 2);

        const updatedLog = await updateLog(logID, "completed", ({
            apicode: 4,
            emails: [],
            providers: [],
            statuses: [],
            mxRecords: [],
            mxProviders: []
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
            UnknownEmails: UnknownEmails.length,
            mxProvier: statusData.emails.length,
            mxRecords: statusData.emails.length,
        });

        return;
    } catch (error: any) {
        res.status(500).json({ message: error.message });
    }
});

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

app.post('/GetEmailResponse', apiAuth, upload.single('csv'), async (req: Request, res: Response) => {
    const userID = (req as any).user.UserID;
    const startingTime = new Date().getTime();

    try {
        // Check if the file is uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        // Upload the file to S3 (Assuming uploadToS3 function is correct)
        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "public-read", "text/csv");

        // Extract required fields from the request body
        const { discordUsername, email, mappedOptions, creditsDeducted, type } = req.body;


        const logID = v4();
        let uploadS3Location = uploadS3?.Location as string;
        if (uploadS3Location?.startsWith("http://")) {
            uploadS3Location = uploadS3Location.replace("http://", "https://");
        }

        const newLog = await EnrichLog(logID,userID,parseInt(creditsDeducted,10),file.originalname,type,uploadS3Location) 
        if (!newLog) {
            return res.status(500).json({ error: "Failed to create log" });
        }

        const formData = new FormData()
        formData.append('csv', file.buffer, file.originalname);  // Use file.buffer directly
        formData.append('discordUsername', discordUsername);
        formData.append('email', email);
        formData.append('mappedOptions', mappedOptions);

        // Send the fetch request
        let response;
        try {
            response = await axios.post('https://enrichbackend.dealsinfo.store/api/GetEmailResponse', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
            // Check if the request was successful
            if (response.status !== 200) {
                console.log('Failed to send request to Enrich backend');
                console.error('Failed to send request to Enrich backend');
                return res.status(500).json({ error: "Failed to send request to Enrich backend" });
            }
        } catch (error) {
            const log = await EnrichDeleteLog(logID);
            if (!log) {
                res.status(500).json({ error: "Failed to delete log" });
                return;
            }
            return res.status(500).json({ error: "Failed to get Data from enrich server log deleted " });            
        }

        if (!response) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }
        const data = await response.data as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits, userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }

        const fileName = `${email}-${startingTime}-Enriched-Emails.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString() : "File not found";

        // console.log(fileContent)
        const outputEnriched = await uploadToS3('enrich-output', fileName, fileContent, "public-read", "text/csv");

        let enrichOutputLocation = outputEnriched?.Location as string;
        if (enrichOutputLocation?.startsWith("http://")) {
            enrichOutputLocation = enrichOutputLocation.replace("http://", "https://");
        }
        const log = await EnrichUpdateLog(logID,"completed",enrichOutputLocation,creditsUsed); 
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
        // Check if the file is uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        // Upload the file to S3 (Assuming uploadToS3 function is correct)
        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "public-read", "text/csv");

        // Extract required fields from the request body
        const { discordUsername, email, mappedOptions, creditsDeducted, type } = req.body;


        const logID = v4();
        let uploadS3Location = uploadS3?.Location as string;
        if (uploadS3Location?.startsWith("http://")) {
            uploadS3Location = uploadS3Location.replace("http://", "https://");
        }

        const newLog = await EnrichLog(logID,userID,parseInt(creditsDeducted,10),file.originalname,type,uploadS3Location) 
        if (!newLog) {
            return res.status(500).json({ error: "Failed to create log" });
        }

        const formData = new FormData()
        formData.append('csv', file.buffer, file.originalname);  // Use file.buffer directly
        formData.append('discordUsername', discordUsername);
        formData.append('email', email);
        formData.append('mappedOptions', mappedOptions);

        // Send the fetch request
        let response;
        try {
            response = await axios.post('https://enrichbackend.dealsinfo.store/api/GetPhoneNumberResponse', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
            // Check if the request was successful
            if (response.status !== 200) {
                console.log('Failed to send request to Enrich backend');
                console.error('Failed to send request to Enrich backend');
                return res.status(500).json({ error: "Failed to send request to Enrich backend" });
            }
        } catch (error) {
            const log = await EnrichDeleteLog(logID);
            if (!log) {
                res.status(500).json({ error: "Failed to delete log" });
                return;
            }
            return res.status(500).json({ error: "Failed to get Data from enrich server log deleted " });            
        }

        if (!response) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }
        const data = await response.data as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits, userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }

        const fileName = `${email}-${startingTime}-Enriched-Emails.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString() : "File not found";

        // console.log(fileContent)
        const outputEnriched = await uploadToS3('enrich-output', fileName, fileContent, "public-read", "text/csv");

        let enrichOutputLocation = outputEnriched?.Location as string;
        if (enrichOutputLocation?.startsWith("http://")) {
            enrichOutputLocation = enrichOutputLocation.replace("http://", "https://");
        }
        const log = await EnrichUpdateLog(logID,"completed",enrichOutputLocation,creditsUsed); 
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
        // Check if the file is uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }

        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        // Upload the file to S3 (Assuming uploadToS3 function is correct)
        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "public-read", "text/csv");

        // Extract required fields from the request body
        const { discordUsername, email, mappedOptions, creditsDeducted, type } = req.body;


        const logID = v4();
        let uploadS3Location = uploadS3?.Location as string;
        if (uploadS3Location?.startsWith("http://")) {
            uploadS3Location = uploadS3Location.replace("http://", "https://");
        }

        const newLog = await EnrichLog(logID,userID,parseInt(creditsDeducted,10),file.originalname,type,uploadS3Location) 
        if (!newLog) {
            return res.status(500).json({ error: "Failed to create log" });
        }

        const formData = new FormData()
        formData.append('csv', file.buffer, file.originalname);  // Use file.buffer directly
        formData.append('discordUsername', discordUsername);
        formData.append('email', email);
        formData.append('mappedOptions', mappedOptions);

        // Send the fetch request
        let response;
        try {
            response = await axios.post('https://enrichbackend.dealsinfo.store/api/GetBothResponse', formData, {
                headers: {
                    ...formData.getHeaders(),
                },
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
            });
            // Check if the request was successful
            if (response.status !== 200) {
                console.log('Failed to send request to Enrich backend');
                console.error('Failed to send request to Enrich backend');
                return res.status(500).json({ error: "Failed to send request to Enrich backend" });
            }
        } catch (error) {
            const log = await EnrichDeleteLog(logID);
            if (!log) {
                res.status(500).json({ error: "Failed to delete log" });
                return;
            }
            return res.status(500).json({ error: "Failed to get Data from enrich server log deleted " });            
        }

        if (!response) {
            res.status(500).json({ error: "Failed to send request to Enrich backend" });
            return;
        }
        const data = await response.data as ScanDbResponse;
        const creditCost = process.env.EnrichCost as unknown as number;
        let creditsUsed = data.totalEnriched * creditCost
        if (creditsDeducted > creditsUsed) {
            const refundCredits = creditsDeducted - creditsUsed;
            const refund = await addCredits(refundCredits, userID);
            if (!refund) {
                res.status(500).json({ error: "Failed to refund credits" });
                return;
            }
        }

        const fileName = `${email}-${startingTime}-Enriched-Emails.csv`;
        const filepath = createCSV(data.data as string[][], fileName);
        const fileContent = existsSync(filepath) ? await readFileSync(filepath).toString() : "File not found";

        // console.log(fileContent)
        const outputEnriched = await uploadToS3('enrich-output', fileName, fileContent, "public-read", "text/csv");

        let enrichOutputLocation = outputEnriched?.Location as string;
        if (enrichOutputLocation?.startsWith("http://")) {
            enrichOutputLocation = enrichOutputLocation.replace("http://", "https://");
        }
        const log = await EnrichUpdateLog(logID,"completed",enrichOutputLocation,creditsUsed); 
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