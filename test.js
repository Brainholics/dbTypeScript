const axios = require('axios');
const querystring = require('querystring');
const PDFDocument = require('pdfkit');
const fs = require('fs');

const makeRequest = async () => {
  const data = {
    from: 'Searchleads',
    to: 'John Doe',
    logo: 'https://searchleads.co/wp-content/uploads/2024/06/SearchLeads1.png',
    number: '12345',
    date: '2024-10-10',
    due_date: '2024-10-15',
    'items[0][name]': 'Leads',
    'items[0][quantity]': '1',
    'items[0][unit_cost]': '50',  // Example amount in currency
    notes: 'Thanks for being an awesome customer!',
    terms: 'Please pay by the due date.',
    currency: 'USD',
    amount_paid: '50'
  };

  const headers = {
    Authorization: 'Bearer sk_yeHAJSOv6hzVgpxNlWaZIHvrATTO6H6d',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  try {
    const response = await axios.post('https://invoice-generator.com/', querystring.stringify(data), { headers });
    
    // Create a new PDF document
    const doc = new PDFDocument();
    const pdfFilePath = 'invoice.pdf';  // Output file path
    const writeStream = fs.createWriteStream(pdfFilePath);

    // Pipe the PDF into the write stream
    doc.pipe(writeStream);

    // Add content to the PDF
    doc.fontSize(20).text('Invoice', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`From: ${data.from}`);
    doc.text(`To: ${data.to}`);
    doc.text(`Invoice Number: ${data.number}`);
    doc.text(`Date: ${data.date}`);
    doc.text(`Due Date: ${data.due_date}`);
    doc.moveDown();
    doc.text('Item Details:');
    doc.text(`${data['items[0][name]']} (Quantity: ${data['items[0][quantity]']}, Unit Cost: ${data['items[0][unit_cost]']} ${data.currency})`);
    doc.moveDown();
    doc.text(`Notes: ${data.notes}`);
    doc.text(`Terms: ${data.terms}`);
    doc.text(`Amount Paid: ${data.amount_paid} ${data.currency}`);

    // End and save the PDF
    doc.end();

    // Log when the PDF is saved
    writeStream.on('finish', () => {
      console.log(`PDF saved successfully as ${pdfFilePath}`);
    });

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
};

makeRequest();
