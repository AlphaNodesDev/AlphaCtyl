const axios = require('axios');
const settings = require('../settings.json');

function sendDiscordWebhook(webhookUrl, message, color) {
    axios.post(webhookUrl, {
        embeds: [{
            description: message,
            color: color
        }]
    }).catch(error => {
        console.error('Error sending webhook:', error);
    });
}

// Function to join a Discord guild
async function joinDiscordGuild(userId, accessToken) {
    const guildId = settings.discord.bot.joinguild.guildid[0]; // Assuming a single guild ID
    const botToken = settings.discord.bot.token;
    try {
        await axios.put(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
            access_token: accessToken
        }, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`User ${userId} added to guild ${guildId}`);
    } catch (error) {
        console.error('Error adding user to guild:', error);
    }
}

// Function to assign a role to a user in a Discord guild
async function assignDiscordRole(userId, guildId, roleId) {
    const botToken = settings.discord.bot.token;
    try {
        await axios.put(`https://discord.com/api/guilds/${guildId}/members/${userId}/roles/${roleId}`, {}, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Role ${roleId} assigned to user ${userId} in guild ${guildId}`);
    } catch (error) {
        console.error('Error assigning role to user:', error);
    }
}

module.exports = { joinDiscordGuild, sendDiscordWebhook, assignDiscordRole };