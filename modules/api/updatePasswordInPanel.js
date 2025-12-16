
const axios = require('axios');
const settings = require('../../settings.json');
async function updatePasswordInPanel(userIdentifier, newPassword, email, username, first_name, last_name) {
    const apiUrl = `${settings.pterodactyl.domain}/api/application/users/${userIdentifier.id}`;
    const requestBody = {
        email: email,
        username: username,
        first_name: first_name,
        last_name: last_name,
        language: "en", 
        password: newPassword 
    };
    
    try {
        await axios.patch(apiUrl, requestBody, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });
    } catch (error) {
        console.error('Error updating password in panel:', error);
        if (error.response && error.response.data) {
            console.error('Response data:', error.response.data);
        }
        res.status(500).send('Error updating password');
    }
}


module.exports = { updatePasswordInPanel };