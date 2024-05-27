const axios = require('axios');
const settings = require('../../settings.json');

async function registerPteroUser(username, email, password, firstName, lastName) {
    try {
        if (!settings.pterodactyl.domain || !settings.pterodactyl.key) {
            console.error('Pterodactyl domain or API key is missing.');
            return null; 
        }

        const response = await axios.post(`${settings.pterodactyl.domain}/api/application/users`, {
            username,
            email,
            password,
            first_name: firstName,
            last_name: lastName, 
        }, {
            headers: {
                'Authorization': `Bearer ${settings.pterodactyl.key}`,
                'Content-Type': 'application/json',
            },
        });
        return response.data; 
    } catch (error) {
        if (error.response) {
            
            if (error.response.status === 422 && error.response.data.errors && error.response.data.errors.length > 0) {
                
                const errorMessage = error.response.data.errors[0].detail;
                if (errorMessage.includes('email') || errorMessage.includes('username')) {
                    
                    return await getPteroUserByEmail(email);
                }
            }
            console.error('Error registering user in Pterodactyl:', error.response.status);
            console.error('Error message:', error.response.data);
        } else if (error.request) {
            
            console.error('No response received:', error.request);
        } else {
            
            console.error('Error setting up the request:', error.message);
        }
        return null; 
    }
}


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
            return response.data.data[0]; 
        }
    } catch (error) {
        console.error('Error fetching user by email from Pterodactyl:', error.message);
    }
    return null;
}

module.exports = { registerPteroUser, getPteroUserByEmail };