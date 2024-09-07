import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { Payload } from '../models/maindb';

async function payloadToJSON(data: Payload[], filename: string, requesteeEmail: string, emails: string): Promise<string> {
    try {
        const csvLines = await readCSV(filename);
        const jsonData = getJSONData(csvLines, data, emails);

        const newFilename = `data/response_${requesteeEmail.replace('@', '_')}_${Date.now()}.json`;
        await writeJSON(newFilename, jsonData);

        console.log(`Payload appended successfully to ${newFilename}!`);
        return newFilename;
    } catch (err) {
        console.error("Error:", err);
        throw err;
    }
}

function readCSV(filename: string): Promise<string[][]> {
    return new Promise((resolve, reject) => {
        const results: string[][] = [];
        fs.createReadStream(filename)
            .pipe(csv())
            .on('data', (row: any) => {
                results.push(Object.values(row));
            })
            .on('end', () => {
                resolve(results);
            })
            .on('error', (err) => {
                reject(err);
            });
    });
}

function getJSONData(csvLines: string[][], payloads: Payload[], emails: string): any[] {
    switch (emails) {
        case 'personal':
            return convertCSVToJSONForPersonalOnly(csvLines, payloads);
        case 'scan':
            return convertCSVToJSON(csvLines, payloads);
        case 'professional':
            return convertCSVToJSONForProfessionalOnly(csvLines, payloads);
        default:
            return [];
    }
}

function convertCSVToJSON(csvLines: string[][], payloads: Payload[]): any[] {
    const jsonData: any[] = [];
    for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i];
        const jsonObj: any = {};
        for (let j = 0; j < csvLines[0].length; j++) {
            jsonObj[csvLines[0][j]] = line[j];
        }
        if (i - 1 < payloads.length) {
            const payload = payloads[i - 1];
            jsonObj["Email"] = payload.emails[0] || "";
            jsonObj["Telephone"] = payload.phoneNumbers[0] || "";
        } else {
            jsonObj["Email"] = "";
            jsonObj["Telephone"] = "";
        }
        jsonData.push(jsonObj);
    }
    return jsonData;
}

function convertCSVToJSONForPersonalOnly(csvLines: string[][], payloads: Payload[]): any[] {
    const jsonData: any[] = [];
    const personalSuffixes = ["@gmail.com", "@yahoo.in", "@hotmail.me", "@outlook.com", "@protonmail.com", "hotmail.com", "yahoo.com"];

    for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i];
        const jsonObj: any = {};
        for (let j = 0; j < csvLines[0].length; j++) {
            jsonObj[csvLines[0][j]] = line[j];
        }
        if (i - 1 < payloads.length) {
            const payload = payloads[i - 1];
            const personalEmails = payload.emails.filter(email => personalSuffixes.some(suffix => email.endsWith(suffix)));
            jsonObj["PersonalEmails"] = personalEmails;
            jsonObj["Telephone"] = payload.phoneNumbers[0] || "";
        } else {
            jsonObj["PersonalEmails"] = [];
            jsonObj["Telephone"] = "";
        }
        jsonData.push(jsonObj);
    }
    return jsonData;
}

function convertCSVToJSONForProfessionalOnly(csvLines: string[][], payloads: Payload[]): any[] {
    const jsonData: any[] = [];
    const personalSuffixes = ["@gmail.com", "@yahoo.in", "@hotmail.me", "@outlook.com", "@protonmail.com", "hotmail.com", "yahoo.com"];

    for (let i = 1; i < csvLines.length; i++) {
        const line = csvLines[i];
        const jsonObj: any = {};
        for (let j = 0; j < csvLines[0].length; j++) {
            jsonObj[csvLines[0][j]] = line[j];
        }
        if (i - 1 < payloads.length) {
            const payload = payloads[i - 1];
            const personalEmails = payload.emails.filter(email => personalSuffixes.some(suffix => email.endsWith(suffix)));
            const professionalEmails = payload.emails.filter(email => !personalSuffixes.some(suffix => email.endsWith(suffix)));
            jsonObj["ProfessionalEmails"] = professionalEmails;
            jsonObj["Telephone"] = payload.phoneNumbers[0] || "";
        } else {
            jsonObj["ProfessionalEmails"] = [];
            jsonObj["Telephone"] = "";
        }
        jsonData.push(jsonObj);
    }
    return jsonData;
}

async function writeJSON(filename: string, data: any): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.writeFile(filename, JSON.stringify(data, null, 2), (err) => {
            if (err) reject(err);
            else resolve();
        });
    });
}

export { payloadToJSON };

