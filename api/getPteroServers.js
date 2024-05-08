const axios = require('axios');
const settings = require('../settings.json');

async function getUserServers(userId) {
    try {
        // Check if domain and API key are valid
        if (!settings.pterodactyl.domain || !settings.pterodactyl.key || typeof settings.pterodactyl.domain !== 'string' || typeof settings.pterodactyl.key !== 'string') {
            console.error('Pterodactyl domain or API key is missing or invalid.');
            return null; // Return null indicating failed to fetch user servers
        }

        // Make request to fetch user servers
        const response = await axios.get(`${settings.pterodactyl.domain}api/application/servers`, {
            headers: {
                'Authorization': `Bearer ${settings.pterodactyl.key}`,
                'Content-Type': 'application/json',
            },
            params: {
                user: userId  // Add query parameter for user ID
            }
        });

        // Check if the response is successful
        if (response.status !== 200) {
            console.error('Failed to fetch user servers. Status:', response.status);
            return null; // Return null indicating failed to fetch user servers
        }

        // Extract user servers from the response
        const userServers = response.data;

        // Return the fetched user servers
        return userServers;
    } catch (error) {
        console.error('Error fetching user servers:', error.message);
        throw error; // Handle the error appropriately
    }
}

module.exports = { getUserServers };
