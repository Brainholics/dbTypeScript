import { Readable } from 'stream';
import csvParser from 'csv-parser';

// Async function to extract emails from a CSV file
export async function extractEmails(file: Express.Multer.File): Promise<string[]> {
    const emailsList: string[] = [];

    const fileStream = Readable.from(file.buffer);

    return new Promise((resolve, reject) => {
        fileStream
            .pipe(csvParser())  // Parse CSV
            .on("data", (row) => {
                if (row.emails) {  // Assuming 'emails' is the column header
                    emailsList.push(row.emails);
                }
            })
            .on("end", () => {
                resolve(emailsList);  // Resolve with the extracted emails
            })
            .on("error", (error) => {
                reject(error);  // Reject in case of error
            });
    });
}