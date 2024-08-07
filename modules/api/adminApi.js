const axios = require('axios');
const settings = require('../../settings.json');




async function getUserDetailsByUUID(userId) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}/api/application/users?filter%5Buuid%5D=${userId}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (response.status !== 200) {
            console.error('Failed to fetch user ID:', response.status);
            return null;
        }

        const userData = response.data.data[0];
        if (!userData) {
            console.error('User not found with userId:', userId);
            return null;
        }

        return {
            id: userData.attributes.id,
            uuid: userData.attributes.uuid,
            email: userData.attributes.email,
            username: userData.attributes.username,
            admin: userData.attributes.root_admin,
            createdAt: userData.attributes.created_at,
        };

    } catch (error) {
        console.error('Error fetching user ID:', error.message);
        console.error('Error communicating with panel');
        return null;
    }
}






module.exports = { getUserDetailsByUUID };
