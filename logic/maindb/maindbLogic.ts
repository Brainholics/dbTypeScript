import { CSVFileData, FinalResponse, Payload } from "../../models/maindb";
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Request, Response } from 'express';
import {getPersonalEmailservice, getProfessionalEmailservice, scanDBservice} from "../../db/maindb/index"
import { payloadToJSON } from "../../utils/createjsonfile";
import { payloadToCSV } from "../../utils/jsontocsv";
import {sendFileToWebhook, sendResponseToWebhook} from "../../utils/csvtowebhook";
import dotenv from 'dotenv';
dotenv.config();
import { newMongoRepository } from "../../db/maindb/client"
import { MongoClient } from "mongodb";

const dbUri = process.env.dburi as string;
const dbName = process.env.dbname as string;
const uploadPath = './data/';


let client: MongoClient;

(async () => {
    const { client: mongoClient } = await newMongoRepository(dbUri, dbName, 10);
    client = mongoClient;
})();

export async function scanDB(req: Request, res: Response): Promise<Payload[] | undefined> {
    const uploadPath = './data/';
    const filename = 'req.csv';
    const filepath = path.join(uploadPath, filename);

    const file = req.file;
    if (!file) {
        res.status(400).send('No file uploaded');
        return {} as Payload[];
    }

    fs.renameSync(file.path, filepath);

    const fields: string[][] = [];

    try {
        await new Promise<void>((resolve, reject) => {
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (data) => fields.push(Object.values(data)))
                .on('end', resolve)
                .on('error', reject);
        });

        const wantedFieldsArr: Record<string, boolean> = {};
        const resp: Payload[] = [];

        for (let idx = 1; idx < fields.length; idx++) {
            const parts = fields[idx][4].split('/');
            const id = parts[parts.length - 1];

            try {
                const data = await scanDBservice(client.db(dbName), id, 'liid', wantedFieldsArr);
                resp.push({
                    emails: data.emails || [],
                    phoneNumbers: [...data.phoneNumbers || []],
                    firstName: "",
                    lastName: "",
                    organizationName: "",
                    organizationDomain: "",
                    linkedInUrl: "",
                });
            } catch (err: any) {
                res.status(500).send((err).message);
                return;
            }
        }

        let resultFilename: string | undefined;

        const responseType = req.body.responseType;
        if (responseType === 'json') {
            resultFilename = await payloadToJSON(resp, 'data/req.csv', req.body.email, 'scan');
        } else if (responseType === 'csv') {
            resultFilename = await payloadToCSV(resp, 'data/req.csv', req.body.email, 'scan');
        }

        if (resultFilename) {
            sendFileToWebhook(
                process.env.WEBHOOK_URL as string,
                resultFilename,
                req.body.email,
                req.body.discordUsername,
                req.body.responseFormat
            );
        }

       return resp;
    } catch (err: any) {
        res.status(500).send(err.message);
    }
}

const filename = 'req.csv';

const saveUploadedFile = (file: Express.Multer.File): Promise<string> => {
    const filepath = path.join(uploadPath, filename);
    return new Promise((resolve, reject) => {
        fs.rename(file.path, filepath, (err) => {
            if (err) reject(err);
            else resolve(filepath);
        });
    });
};

const parseCSV = (filepath: string): Promise<string[][]> => {
    const fields: string[][] = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', (row) => fields.push(Object.values(row)))
            .on('end', () => resolve(fields))
            .on('error', (err) => reject(err));
    });
};

const processRecords = async (
    ctx: Request,
    fields: string[][],
    handler: (ctx: Request, id: string) => Promise<Payload>
): Promise<Payload[]> => {
    const resp: Payload[] = [];
    const apidata: string[][] = [];
    const wantedFieldsArr: Record<string, boolean> = {};

    for (let idx = 1; idx < fields.length; idx++) {
        const id = fields[idx][5].split('/').pop() || '';

        const data = await handler(ctx, id);
        if (!data.emails) {
            apidata.push([fields[idx][2], fields[idx][3], fields[idx][16]]);
        }

        resp.push({
            emails: data.emails,
            phoneNumbers: data.phoneNumbers,
            firstName: "",
            lastName: "",
            organizationName: "",
            organizationDomain: "",
            linkedInUrl: ""
        });
    }

    return resp;
};

const getResponseFilename = async (
    ctx: Request,
    resp: Payload[],
    fileType: 'json' | 'csv',
    filePrefix: string
): Promise<string> => {
    const filepath = path.join(uploadPath, filename);
    return fileType === 'json'
        ? payloadToJSON(resp, filepath, ctx.body.email, filePrefix)
        : payloadToCSV(resp, filepath, ctx.body.email, filePrefix);
};

const handleResponse = async (
    ctx: Request,
    res: Response,
    resp: Payload[],
    filePrefix: string
) => {
    try {
        const fileType = ctx.body.responseType === 'csv' ? 'csv' : 'json';
        const filename = await getResponseFilename(ctx, resp, fileType, filePrefix);
        sendFileToWebhook(process.env.WEBHOOK_URL as string, filename, ctx.body.email, ctx.body.discordUsername, ctx.body.responseFormat);
        res.status(200).json(resp);
    } catch (err :any) {
        res.status(500).json({ error: err.message });
    }
};

export const getPersonalEmail = async (req: Request, res: Response) => {
    try {
        const filepath = await saveUploadedFile(req.file!);
        const fields = await parseCSV(filepath);
        const resp = await processRecords(req, fields, (ctx, id) => scanDBservice(client.db(dbName), id, 'liid', {}));
        await handleResponse(req, res, resp, 'personal');
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getProfessionalEmail = async (req: Request, res: Response) => {
    try {
        const filepath = await saveUploadedFile(req.file!);
        const fields = await parseCSV(filepath);
        const resp = await processRecords(req, fields, (ctx, id) => getProfessionalEmailservice(client.db(dbName), id));
        await handleResponse(req, res, resp, 'professional');
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getBothEmails = async (req: Request, res: Response) => {
    try {
        const filepath = await saveUploadedFile(req.file!);
        const fields = await parseCSV(filepath);
        const resp = await processRecords(req, fields, (ctx, id) => scanDBservice(client.db(dbName), id, 'liid', {}));
        await handleResponse(req, res, resp, 'both');
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};

export const getByLIID = async (req: Request, res: Response) => {
    try {
        const resp = await scanDBservice(client.db(dbName), req.body.liid, 'liid', {});
        res.status(200).json({
            Emails: resp.emails,
            Telephone: resp.phoneNumbers,
        });
    } catch (err : any) {
        res.status(500).json({ error: err.message });
    }
};

export const getMultipleByLIID = async (req: Request, res: Response) => {
    try {
        const resp = await Promise.all(req.body.liids.map((liid: string) => scanDBservice(client.db(dbName), liid, 'liid', {})));
        res.status(200).json(resp);
    } catch (err : any) {
        res.status(500).json({ error: err.message });
    }
};

export const getPersonalEmailByLIID = async (req: Request, res: Response) => {
    try {
        const resp = await getPersonalEmailservice(client.db(dbName), req.body.liid);
        res.status(200).json({
            Emails: resp.emails,
            Telephone: resp.phoneNumbers,
        });
    } catch (err : any) {
        res.status(500).json({ error: err.message });
    }
};

export const getProfessionalEmailsByLIID = async (req: Request, res: Response) => {
    try {
        const resp = await getProfessionalEmailservice(client.db(dbName), req.body.liid);
        res.status(200).json({
            Emails: resp.emails,
            Telephone: resp.phoneNumbers,
        });
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
};


export async function Test(req: Request, res: Response): Promise<{ success: boolean; timestamp: Date; error?: Error }> {
    const uploadPath = './data/';
    const filename = 'req.csv';
    const filepath = path.join(uploadPath, filename);
    const wantedFields = req.body.wantedFields as string;
    console.log(wantedFields);

    try {
        // Save the uploaded file
        const file = req.file;
        console.log(filepath);
        if (!file) {
            throw new Error('No file uploaded');
        }
        fs.writeFileSync(filepath, file.buffer);

        // Read and parse the CSV file
        const csvDataStruct: CSVFileData = {
            firstName: [],
            lastName: [],
            organizationDomain: [],
            phoneNumbers: [],
            liid: [],
            linkedInURL: [],
            emails: []
        };

        const records = await new Promise<string[][]>((resolve, reject) => {
            const rows: string[][] = [];
            fs.createReadStream(filepath)
                .pipe(csv())
                .on('data', (row) => rows.push(Object.values(row)))
                .on('end', () => resolve(rows))
                .on('error', (error) => reject(error));
        });

        const headers = records.shift(); // First row as headers
        if (!headers) {
            throw new Error('No headers found');
        }

        records.forEach((record) => {
            record.forEach((value, i) => {
                switch (headers[i]) {
                    case 'First Name':
                        csvDataStruct.firstName.push(value);
                        break;
                    case 'Last Name':
                        csvDataStruct.lastName.push(value);
                        break;
                    case 'Organization Domain':
                        csvDataStruct.organizationDomain.push(value);
                        break;
                    case 'Phone Number':
                        csvDataStruct.phoneNumbers.push(value);
                        break;
                    case 'LinkedIn':
                        const id = value.split('/').pop();
                        csvDataStruct.liid.push(id || '') ;
                        csvDataStruct.linkedInURL.push(value);
                        break;
                    case 'Email':
                        csvDataStruct.emails.push(value);
                        break;
                }
            });
        });

        
        const wantedFieldsArr: Record<string, boolean> = {
            "First Name": false,
            "Last Name": false,
            "Organization Domain": false,
            "PersonalEmail": false,
            "ProfessionalEmail": false,
            "t": false,
            "linkedin": false,
            "Organization Name": false,
            "e": false
        };

        wantedFields.split('').forEach((field) => {
            switch (field) {
                case '0':
                    wantedFieldsArr["First Name"] = true;
                    break;
                case '1':
                    wantedFieldsArr["Last Name"] = true;
                    break;
                case '2':
                    wantedFieldsArr["Organization Domain"] = true;
                    break;
                case '3':
                    wantedFieldsArr["PersonalEmail"] = true;
                    break;
                case '4':
                    wantedFieldsArr["ProfessionalEmail"] = true;
                    break;
                case '5':
                    wantedFieldsArr["t"] = true;
                    break;
                case '6':
                    wantedFieldsArr["linkedin"] = true;
                    break;
                case '7':
                    wantedFieldsArr["Organization Name"] = true;
                    break;
                case '8':
                    wantedFieldsArr["e"] = true;
                    break;
            }
        });

        let resp: Payload[] = [];
        const scanAndUpdateResponse = async (value: string, key: string) => {
            const data = await scanDBservice(client.db(dbName), value, key, wantedFieldsArr);
            resp.push({
                emails: data.emails,
                phoneNumbers: data.phoneNumbers,
                organizationName: data.organizationName,
                organizationDomain: data.organizationDomain,
                linkedInUrl: data.linkedInUrl,
                firstName: data.firstName,
                lastName: data.lastName
            });
        };

        if (csvDataStruct.liid.length > 0) {
            for (let idx = 0; idx < csvDataStruct.liid.length; idx++) {
                const liid = csvDataStruct.liid[idx];
                if (liid === '') {
                    const email = csvDataStruct.emails[idx];
                    const phone = csvDataStruct.phoneNumbers[idx];
                    if (email) await scanAndUpdateResponse(email, 'email');
                    if (phone) await scanAndUpdateResponse(phone, 'phone');
                } else {
                    await scanAndUpdateResponse(liid, 'liid');
                }
            }
        } else if (csvDataStruct.emails.length > 0) {
            for (let idx = 0; idx < csvDataStruct.emails.length; idx++) {
                const email = csvDataStruct.emails[idx];
                const phone = csvDataStruct.phoneNumbers[idx];
                if (email === '') {
                    if (phone) await scanAndUpdateResponse(phone, 'phone');
                } else {
                    await scanAndUpdateResponse(email, 'email');
                }
            }
        } else if (csvDataStruct.phoneNumbers.length > 0) {
            for (let idx = 0; idx < csvDataStruct.phoneNumbers.length; idx++) {
                const phone = csvDataStruct.phoneNumbers[idx];
                await scanAndUpdateResponse(phone, 'phone');
            }
        }

        const finalResponse: FinalResponse[] = resp.map((respvalue, idx) => {
            const singleResponse: FinalResponse = {
                firstName: "",
                lastName: "",
                organizationDomain: "",
                organizationName: "",
                personalEmail: "",
                professionalEmail: "",
                phoneNumber: "",
                linkedIn: "",
                email: ""
            };

            Object.entries(wantedFieldsArr).forEach(([k, v]) => {
                if (v) {
                    switch (k) {
                        case "PersonalEmail":
                            singleResponse.personalEmail = respvalue.emails.find(email =>
                                ["gmail", "yahoo", "outlook", "hotmail", "icloud", "aol", "protonmail", "zoho"].some(domain => email.includes(domain))
                            ) ?? "";
                            break;
                        case "ProfessionalEmail":
                            singleResponse.professionalEmail = respvalue.emails.find(email =>
                                !["gmail", "yahoo", "outlook", "hotmail", "icloud", "aol", "protonmail", "zoho"].some(domain => email.includes(domain))
                            ) ?? "";
                            break;
                        case "Organization Name":
                            singleResponse.organizationName = respvalue.organizationName;
                            break;
                        case "Organization Domain":
                            singleResponse.organizationDomain = respvalue.organizationDomain;
                            break;
                        case "t":
                            singleResponse.phoneNumber = respvalue.phoneNumbers[0];
                            break;
                        case "linkedin":
                            singleResponse.linkedIn = respvalue.linkedInUrl;
                            break;
                        case "First Name":
                            singleResponse.firstName = respvalue.firstName;
                            break;
                        case "Last Name":
                            singleResponse.lastName = respvalue.lastName;
                            break;
                        case "e":
                            singleResponse.email = respvalue.emails[0];
                            break;
                    }
                } else {
                    switch (k) {
                        case "Organization Name":
                            singleResponse.organizationName = csvDataStruct.organizationName?.[idx] ?? "";
                            break;
                        case "Organization Domain":
                            singleResponse.organizationDomain = csvDataStruct.organizationDomain[idx];
                            break;
                        case "t":
                            singleResponse.phoneNumber = csvDataStruct.phoneNumbers[idx];
                            break;
                        case "linkedin":
                            singleResponse.linkedIn = csvDataStruct.linkedInURL[idx];
                            break;
                        case "First Name":
                            singleResponse.firstName = csvDataStruct.firstName[idx];
                            break;
                        case "Last Name":
                            singleResponse.lastName = csvDataStruct.lastName[idx];
                            break;
                        case "e":
                            singleResponse.email = csvDataStruct.emails[idx];
                            break;
                    }
                }
            });

            return singleResponse;
        });

        await sendResponseToWebhook(
            process.env.WEBHOOK_URL!,
            req.body.email,
            req.body.discordUsername,
            finalResponse,
            req.body.firstName,
            req.body.lastName,
            req.body.phoneNumber
        );

        return { success: true, timestamp: new Date() };
    } catch (error: any) {
        return { success: false, timestamp: new Date(), error };
    }
}