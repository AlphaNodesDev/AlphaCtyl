const axios = require('axios');
const settings = require('../settings.json');

async function registerPteroUser(username, email, password, firstName, lastName) {
    try {
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
        console.error('Error registering user in Pterodactyl:', error);
        throw error; // Handle the error appropriately
    }
}

module.exports = { registerPteroUser };
