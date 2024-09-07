import  fs from 'fs';
import path from 'path';
import https from 'https';
import http from 'http';
import  csv from 'csv-parser';
import { FinalResponse } from '../models/maindb';

export function sendFileToWebhook(
    url: string,
    filePath: string,
    requesteeEmail: string,
    discordUsername: string,
    responseFormat: string
): Promise<void> {
    if (responseFormat === "file") {
        return sendFile(url, filePath, requesteeEmail, discordUsername);
    } else if (responseFormat === "data") {
        return sendData(url, filePath, requesteeEmail, discordUsername);
    } else {
        return Promise.reject(new Error("Invalid response format"));
    }
}

function sendFile(url: string, filePath: string, requesteeEmail: string, discordUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileStream = fs.createReadStream(filePath);
        const boundary = `--------------------------${Date.now().toString(16)}`;

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'X-REQUESTEE-EMAIL': requesteeEmail,
                'X-DISCORD-USERNAME': discordUsername
            }
        };

        const req = getHttpModule(url).request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                console.log("API Call Made, Response Status:", res.statusCode);
                console.log("Response Body:", body);
                resolve();
            });
        });

        req.on('error', reject);

        req.write(`--${boundary}\r\n`);
        req.write(`Content-Disposition: form-data; name="file"; filename="${path.basename(filePath)}"\r\n`);
        req.write('Content-Type: application/octet-stream\r\n\r\n');
        fileStream.pipe(req, { end: false });

        fileStream.on('end', () => {
            req.write(`\r\n--${boundary}--\r\n`);
            req.end();
        });
    });
}

function sendData(url: string, filePath: string, requesteeEmail: string, discordUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
        let jsonData: string | undefined;

        if (filePath.endsWith('.json')) {
            jsonData = fs.readFileSync(filePath, 'utf-8');
            sendJson(url, jsonData, requesteeEmail, discordUsername).then(resolve).catch(reject);
        } else if (filePath.endsWith('.csv')) {
            convertCSVtoJSON(filePath)
                .then((data) => sendJson(url, data, requesteeEmail, discordUsername))
                .then(resolve)
                .catch(reject);
        } else {
            reject(new Error("Unsupported file type"));
        }
    });
}

function sendJson(url: string, jsonData: string, requesteeEmail: string, discordUsername: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-REQUESTEE-EMAIL': requesteeEmail,
                'X-DISCORD-USERNAME': discordUsername
            }
        };

        const req = getHttpModule(url).request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                console.log("API Call Made, Response Status:", res.statusCode);
                console.log("Response Body:", body);
                resolve();
            });
        });

        req.on('error', reject);

        req.write(jsonData);
        req.end();
    });
}

export function sendResponseToWebhook(
    url: string,
    requesteeEmail: string,
    discordUsername: string,
    response: FinalResponse[],
    firstName: string,
    lastName: string,
    phoneNumber: string
): Promise<void> {
    console.log("Sending response to webhook");

    const jsonData = JSON.stringify(response);

    const options = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-REQUESTEE-EMAIL': requesteeEmail,
            'X-DISCORD-USERNAME': discordUsername,
            'X-FIRST-NAME': firstName,
            'X-LAST-NAME': lastName,
            'X-PHONE-NUMBER': phoneNumber
        }
    };

    return new Promise((resolve, reject) => {
        const req = getHttpModule(url).request(url, options, (res) => {
            let body = '';
            res.on('data', (chunk) => {
                body += chunk;
            });
            res.on('end', () => {
                console.log("API Call Made, Response Status:", res.statusCode);
                console.log("Response Body:", body);
                resolve();
            });
        });

        req.on('error', reject);

        req.write(jsonData);
        req.end();
    });
}

function convertCSVtoJSON(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const records: any[] = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => records.push(data))
            .on('end', () => {
                try {
                    resolve(JSON.stringify(records));
                } catch (error) {
                    reject(error);
                }
            })
            .on('error', reject);
    });
}

function getHttpModule(url: string): typeof http | typeof https {
    return url.startsWith('https') ? https : http;
}
