const axios = require('axios');
const fs = require('fs');
const querystring = require('querystring');

const makeRequest = async () => {
  const data = {
  from: 'Lund',
  to: 'Nishant Mishra',
  logo: 'https://searchleads.co/wp-content/uploads/2024/06/SearchLeads1.png',
  number: 'INV-71863108842',
  date: '2024-10-14',
  'items[0][name]': 'Lund',
  'items[0][quantity]': '100',
  'items[0][unit_cost]': '1',
  notes: 'Thank you for being an awesome customer!',
  currency: 'USD',
  amount_paid: '100'
}

  const headers = {
    Authorization: 'Bearer sk_yeHAJSOv6hzVgpxNlWaZIHvrATTO6H6d',
    'Content-Type': 'application/x-www-form-urlencoded',
  };

  try {
    const response = await axios.post('https://invoice-generator.com/', data, {
      headers,
      responseType: 'arraybuffer', // Ensure the response is treated as binary data
    });

    if (response.status === 200) {
      // Write the response data (PDF) to a file
      const data = response.data.toString('base64')

      fs.writeFileSync('invoice.pdf', data, 'base64');
      console.log('PDF saved successfully!');
    } else {
      throw new Error('Failed to generate the invoice');
    }

  } catch (error) {
    console.error('Error:', error.response ? error.response.data : error.message);
  }
};

makeRequest();