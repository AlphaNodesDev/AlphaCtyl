const axios = require('axios');
const settings = require('../settings.json');
// Function to send a Discord webhook using axios
function sendDiscordWebhook(webhookUrl, message, color) {
    axios.post(webhookUrl, {
        embeds: [{
            description: message,
            color: color
        }]
    }).then(response => {
        console.log('Webhook sent successfully:', response.data);
    }).catch(error => {
        console.error('Error sending webhook:', error.message);
    });
}

// Function to join a Discord guild using axios
async function joinDiscordGuild(discordUserId, accessToken) {
    const guildIds = settings.discord.bot.joinguild.guildid; // Assuming guildid is an array of guild IDs
    const botToken = settings.discord.bot.token;

    try {
        for (const guildId of guildIds) {
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
            if (response.status !== 204) {
                console.error(`Error adding user to guild ${guildId}: ${response.status} - ${response.statusText}`);
                console.error(response.data); // Log response data for further insights
            } else {
               
            }
        }
    } catch (error) {
        console.error('Error adding user to guilds:', error.message);
        if (error.response) {
            console.error('Response status:', error.response.status);
            console.error('Response data:', error.response.data);
        }
    }
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

module.exports = { joinDiscordGuild, sendDiscordWebhook, assignDiscordRole };