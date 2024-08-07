const axios = require('axios');
const settings = require('../../settings.json');
// Function to send a Discord webhook using axios
function sendDiscordWebhook(webhookUrl, title, message, color, appName) {
    axios.post(webhookUrl, {
        embeds: [{
            title: title, // Title of the embed
            description: message, // Main message
            color: color, // Embed color
            footer: {
                text: `Powered by ${appName}`, // Footer text
            }
        }]
    })
    .then(response => {
        console.log('Webhook sent successfully:', response.data);
    })
    .catch(error => {
        console.error('Error sending webhook:', error.message);
    });
}
// Function to join a Discord guild using axios
async function joinDiscordGuild(discordUserId, accessToken) {
    const guildId = settings.discord.bot.joinguild.guildid[0]; 
    const botToken = settings.discord.bot.token;

    try {
        const response = await axios({
            method: 'put',
            url: `https://discord.com/api/v10/guilds/${guildId}/members/${discordUserId}`,
            data: {
                "access_token": accessToken,
            },
            headers: {
                Authorization: `Bot ${botToken}`,
                'Content-Type': 'application/json',
            },
        });
    

    } catch (error) {
       
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
    
}
    // Function to add a notification to the database
    async function addNotification(userId, message, db) {
        return new Promise((resolve, reject) => {
            db.run('INSERT INTO notifications (id, notification) VALUES (?, ?)', [userId, message], (err) => {
                if (err) {
                    console.error(err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

// Function to assign a role to a user in a Discord guild
async function assignDiscordRole(discordUserId) {
    const guildId = settings.discord.bot.giverole.guildid;
    const botToken = settings.discord.bot.token;
    const roleId = settings.discord.bot.giverole.roleid;
    try {
        await axios.put(`https://discord.com/api/guilds/${guildId}/members/${discordUserId}/roles/${roleId}`, {}, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
    } catch (error) {
        console.error('Error assigning role to user:', error);
    }
}

module.exports = {addNotification, joinDiscordGuild, sendDiscordWebhook, assignDiscordRole };