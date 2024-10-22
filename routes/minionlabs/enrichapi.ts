import express ,{Request,Response}from 'express';
import { existsSync, readFileSync } from 'fs';
import apiAuth from "../../middleware/enrichminion/apiAuth";
import multer from "multer";
import { uploadToS3 } from '../../utils/uploadtoS3';
import axios from 'axios';
import FormData from 'form-data';
import {ScanDbResponse} from '../../types/interfaces';
import { v4 } from 'uuid';
import { createLog as EnrichLog } from '../../db/enrichminion/log';
import { addCredits, removeCredits } from "../../db/enrichminion/user";
import { createCSV } from "../../utils/createcsvfromstringarr";
import {extractEmails} from '../../utils/extractEmails';

const app = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

app.post('/GetEmailResponse', apiAuth, upload.single('csv'), async (req: Request, res: Response) => {
    const userID = (req as any).user.UserID;
    const startingTime = new Date().getTime();
    try {
        // Check if the file is uploaded
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        const creditCost = process.env.EnrichCost as unknown as number;

        const emails = await extractEmails(req.file);
        if (emails.length === 0) {
            return res.status(400).json({ error: "No emails found in the file" });
        }

        const creditsDeducted = emails.length * creditCost;
        const reduceCreds = await removeCredits(creditsDeducted,userID);
        if (!reduceCreds) {
            res.status(500).json({ error: "Failed to reduce credits" });
            return;
        }

        const file = req.file;
        const csvFileString = file.buffer.toString('utf-8');

        // Upload the file to S3 (Assuming uploadToS3 function is correct)
        const uploadS3 = await uploadToS3('verify', file.originalname, csvFileString, "public-read", "text/csv");

        // Extract required fields from the request body
        const { discordUsername, email, mappedOptions, type } = req.body;


        const formData = new FormData()
        formData.append('csv', file.buffer, file.originalname);  // Use file.buffer directly
        formData.append('discordUsername', discordUsername);
        formData.append('email', email);
        formData.append('mappedOptions', mappedOptions);

        // Send the fetch request
        const response = await axios.post('https://enrichbackend.dealsinfo.store/api/GetPhoneNumberResponse', formData, {
            headers: {
                ...formData.getHeaders(),
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity,
        });
        // Check if the request was successful
        if (response.status !== 200) {
            console.error('Failed to send request to Enrich backend');
            return res.status(500).json({ error: "Failed to send request to Enrich backend" });
        }

        // Parse the response from the external API
        const data = await response.data as ScanDbResponse;
        
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
        const logID = v4()
        const log = await EnrichLog(logID, userID, creditsUsed, fileName, type, outputEnriched?.Location as string, uploadS3?.Location as string);
        if (!log) {
            res.status(500).json({ error: "Failed to create log" });
            return;
        }
        res.status(200).json({ data });
    } catch (err: any) {
        const totalTime = (new Date().getTime() - startingTime) / 1000;
        res.status(500).json({ error: err.message, "total time": `${totalTime} seconds` });
    }
});

export default app;



