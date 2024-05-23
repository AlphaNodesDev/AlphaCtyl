const axios = require('axios');
const settings = require('../../settings.json');

async function registerPteroUser(username, email, password, firstName, lastName) {
    try {
        // Check if domain and API key are valid
        if (!settings.pterodactyl.domain || !settings.pterodactyl.key) {
            console.error('Pterodactyl domain or API key is missing.');
            return null; // Return null indicating registration failed
        }

        const response = await axios.post(`${settings.pterodactyl.domain}/api/application/users`, {
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
            if (error.response.status === 422 && error.response.data.errors && error.response.data.errors.length > 0) {
                // Check if the error is due to duplicate email or username
                const errorMessage = error.response.data.errors[0].detail;
                if (errorMessage.includes('email') || errorMessage.includes('username')) {
                    // Return the existing user data
                    return await getPteroUserByEmail(email);
                }
            }
            console.error('Error registering user in Pterodactyl:', error.response.status);
            console.error('Error message:', error.response.data);
        } else if (error.request) {
            // The request was made but no response was received
            console.error('No response received:', error.request);
        } else {
            // Something happened in setting up the request that triggered an Error
            console.error('Error setting up the request:', error.message);
        }
        return null; // Return null indicating registration failed
    }
}

// Function to get existing user by email
async function getPteroUserByEmail(email) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}/api/application/users`, {
            params: {
                filter: {
                    email: email
                }
            },
            headers: {
                'Authorization': `Bearer ${settings.pterodactyl.key}`,
                'Content-Type': 'application/json',
            },
        });
        if (response.data.data.length > 0) {
            return response.data.data[0]; // Return the first matched user
        }
    } catch (error) {
        console.error('Error fetching user by email from Pterodactyl:', error.message);
    }
    return null;
}

module.exports = { registerPteroUser };