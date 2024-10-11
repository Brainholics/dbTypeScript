import * as fs from 'fs';
import * as path from 'path';

export function createCSV(data: string[][], fileName: string): string {
    // Ensure the output directory exists
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir);
    }

    const filePath = path.join(outputDir, fileName);

    // Convert 2D array to CSV format
    const csvContent = data.map(row => row.join(',')).join('\n');

    // Write the CSV content to the file
    fs.writeFileSync(filePath, csvContent, 'utf8');
    console.log(`CSV file created at ${filePath}`);

    return filePath; // Return the file path for further use (e.g., uploading)
}
