import { parse, stringify } from 'csv';
import fs from 'fs';
import path from 'path';
import { Payload } from '../models/maindb';


export async function payloadToCSV(data: Payload[], filename: string, requesteeEmail: string, emails: string): Promise<string> {
    let csvData: string[][];

    if (emails === 'personal') {
        csvData = convertPayloadToCSVForPersonal(data);
    } else if (emails === 'professional') {
        csvData = convertPayloadToCSVForProfessional(data);
    } else if (emails === 'scan') {
        csvData = convertPayloadToCSV(data);
    } else {
        throw new Error('Invalid email type');
    }

    // Read the existing file
    const filePath = path.resolve('data', filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    // Parse the CSV content
    const lines: string[][] = [];
    parse(fileContent, { delimiter: ',', trim: true })
        .on('data', (row: string[]) => lines.push(row))
        .on('end', async () => {
            // Insert new data at specified position and shift other columns
            for (let i = 0; i < lines.length; i++) {
                if (i === 0) { // For header
                    lines[i] = [...lines[i].slice(0, 5), 'Email', ...lines[i].slice(5)];
                } else if (i - 1 < csvData.length) { // For rows
                    lines[i] = [...lines[i].slice(0, 5), ...csvData[i - 1], ...lines[i].slice(5)];
                } else { // For empty json
                    lines[i] = [...lines[i].slice(0, 5), '', '', ...lines[i].slice(5)];
                }
            }

            // Write the updated content to a new file
            const newFilename = `data/response_${requesteeEmail}_${Date.now()}.csv`;
            const newFilePath = path.resolve('data', newFilename);
            stringify(lines, { header: false }, (err, output) => {
                if (err) {
                    throw err;
                }
                fs.writeFileSync(newFilePath, output);
                console.log(`Payload appended successfully to ${newFilename}!`);
            });
        });

    return filename;
}

function convertPayloadToCSV(data: Payload[]): string[][] {
    const rows: string[][] = [];
    if (data.length === 0) {
        rows.push(['', '']);
        return rows;
    }

    for (const payload of data) {
        const email = payload.emails ? payload.emails[0] : '';
        rows.push([email]);
    }
    return rows;
}

function convertPayloadToCSVForPersonal(data: Payload[]): string[][] {
    const personalSuffixes = ['@gmail.com', '@yahoo.in', '@hotmail.me', '@outlook.com', '@protonmail.com', 'hotmail.com', 'yahoo.com'];
    const rows: string[][] = [];

    if (data.length === 0) {
        rows.push(['', '', '']);
        return rows;
    }

    for (const payload of data) {
        let personalEmails = '';
        let tel = '';

        for (const email of payload.emails || []) {
            if (personalSuffixes.some(suffix => email.endsWith(suffix))) {
                personalEmails = email;
                break;
            }
        }

        if (payload.phoneNumbers && payload.phoneNumbers.length > 0) {
            tel = payload.phoneNumbers[0];
        }

        rows.push([personalEmails, tel]);
    }

    return rows;
}

function convertPayloadToCSVForProfessional(data: Payload[]): string[][] {
    const personalSuffixes = ['@gmail.com', '@yahoo.in', '@hotmail.me', '@outlook.com', '@protonmail.com', 'hotmail.com', 'yahoo.com'];
    const rows: string[][] = [];

    if (data.length === 0) {
        rows.push(['', '', '']);
        return rows;
    }

    for (const payload of data) {
        let professionalEmails = '';
        let tel = '';

        for (const email of payload.emails || []) {
            if (!personalSuffixes.some(suffix => email.endsWith(suffix))) {
                professionalEmails = email;
                break;
            }
        }

        if (payload.phoneNumbers && payload.phoneNumbers.length > 0) {
            tel = payload.phoneNumbers[0];
        }

        rows.push([professionalEmails, tel]);
    }

    return rows;
}

async function payloadToCSVForFiltering(data: Payload[], filename: string, requesteeEmail: string): Promise<string> {
    const csvData = convertPayloadToCSVForFiltering(data);

    const filePath = path.resolve('data', filename);
    const fileContent = fs.readFileSync(filePath, 'utf8');

    const lines: string[][] = [];
    parse(fileContent, { delimiter: ',', trim: true })
        .on('data', (row: string[]) => lines.push(row))
        .on('end', async () => {
            for (let i = 0; i < lines.length; i++) {
                if (i === 0) {
                    lines[i] = [...lines[i].slice(0, 5), 'PersonalEmails', 'ProfessionalEmails', 'Telephone', ...lines[i].slice(5)];
                } else if (i - 1 < csvData.length) {
                    lines[i] = [...lines[i].slice(0, 5), ...csvData[i - 1], ...lines[i].slice(5)];
                } else {
                    lines[i] = [...lines[i].slice(0, 5), '', '', '', ...lines[i].slice(5)];
                }
            }

            const newFilename = `data/response_${requesteeEmail}_${Date.now()}.csv`;
            const newFilePath = path.resolve('data', newFilename);
            stringify(lines, { header: false }, (err, output) => {
                if (err) {
                    throw err;
                }
                fs.writeFileSync(newFilePath, output);
                console.log(`Payload appended successfully to ${newFilename}!`);
            });
        });

    return filename;
}

function convertPayloadToCSVForFiltering(data: Payload[]): string[][] {
    const personalSuffixes = ['@gmail.com', '@yahoo.in', '@hotmail.me', '@outlook.com', '@protonmail.com', 'hotmail.com', 'yahoo.com'];
    const rows: string[][] = [];

    if (data.length === 0) {
        rows.push(['', '', '']);
        return rows;
    }

    for (const payload of data) {
        let personalEmails = '';
        let professionalEmails = '';
        let tel = '';

        for (const email of payload.emails || []) {
            if (personalSuffixes.some(suffix => email.endsWith(suffix))) {
                personalEmails = email;
            } else if (professionalEmails === '') {
                professionalEmails = email;
            }
        }

        if (payload.phoneNumbers && payload.phoneNumbers.length > 0) {
            tel = payload.phoneNumbers[0];
        }

        rows.push([personalEmails, professionalEmails, tel]);
    }

    return rows;
}
