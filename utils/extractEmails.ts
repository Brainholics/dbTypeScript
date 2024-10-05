import { Readable } from 'stream';
import csvParser from 'csv-parser';

// Async function to extract emails from a CSV file
export async function extractEmails(file: Express.Multer.File): Promise<string[]> {
    const emailsList: string[] = [];

    const fileStream = Readable.from(file.buffer);  // Create stream from the file buffer

    return new Promise((resolve, reject) => {
        fileStream
            .pipe(csvParser())  // Parse CSV with headers
            .on("data", (row) => {
                console.log('Parsed row:', row);  // Log each parsed row to check structure
                if (row.emails && row.emails.trim() || row.Emails && row.Emails.trim()) {
                    emailsList.push(row.emails.trim());  // Trim emails to remove extra spaces
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
