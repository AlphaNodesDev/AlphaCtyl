const axios = require('axios');
const settings = require('../settings.json');

async function registerPteroUser(username, email, password, firstName, lastName) {
    try {
        // Check if domain and API key are valid
        if (!settings.pterodactyl.domain || !settings.pterodactyl.key) {
            console.error('Pterodactyl domain or API key is missing.');
            return null; // Return null indicating registration failed
        }

        const response = await axios.post(`${settings.pterodactyl.domain}api/application/users`, {
            username,
            email,
            password,
            first_name: firstName, // Include the first name field
            last_name: lastName, // Include the last name field
        }, {
            headers: {
                'Authorization': `Bearer ${settings.pterodactyl.key}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data; // Assuming the API returns some data upon successful registration
    } catch (error) {
        if (error.response) {
            // The request was made and the server responded with a status code
            console.error('Error registering user in Pterodactyl:', error.response.status);
            console.error('Error message:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up the request:', error.message);
        }
        throw error; // Handle the error appropriately
    }
}

module.exports = { registerPteroUser };
