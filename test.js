const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Create a new instance of FormData
const form = new FormData();

// Append the file and other fields to the form data
form.append('csv', fs.createReadStream('C:/Users/seew/Downloads/abcd.csv'));
form.append('discordUsername', 'vitalik');
form.append('email', 'miglanidevansh83@gmail.com');
form.append('mappedOptions', '1');

// Set the form headers, including the form's boundary
const headers = {
    ...form.getHeaders(),
};

// Make the POST request using axios
axios.post('http://localhost:5000/api/GetEmailResponse', form, { headers })
    .then((response) => {
        console.log('Response:', response.data);
    })
    .catch((error) => {
        console.error('Error:', error);
    });
