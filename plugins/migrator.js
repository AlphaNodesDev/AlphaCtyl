const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const configPath = './plugins/configs/Discordbot.json';
const settingsPath = 'settings.json';

const updateSettings = () => {
    let settings = {};

    if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    }

    if (!settings.plugins || !settings.plugins.migrator) {
        settings.plugins = settings.plugins || {};
        settings.plugins.migrator = { enable: true };
        
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 4), 'utf8');
    }
};

updateSettings();
const isPluginEnabled = () => {
    if (!fs.existsSync(settingsPath)) {
        console.log('Settings file not found. Please ensure the settings file exists.');
        return false;
    }

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    return settings.plugins && settings.plugins.migrator && settings.plugins.migrator.enable;
};

if (isPluginEnabled()) {
    module.exports = (client, db) => {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const allowedRoles = config.allowedRoles;

        const oldDb = new sqlite3.Database('./olddb.sqlite', (err) => {
            if (err) {
                console.error('Error opening old database:', err.message);
            } else {
                console.log('Old database connected.');
            }
        });

        const helpMessage = {
            color: 0xFF0000,
            title: 'Available Commands',
            fields: [
                {
                    name: 'Migration Commands',
                    value: '`!migrate @user` - Migrates the data of the mentioned user from the old database to the new one.',
                    inline: false
                },
                {
                    name: 'Old Data Fetching Commands',
                    value: '`!know @user` - Fetches and displays the data of the mentioned user from the old database.',
                    inline: false
                }
            ],
            footer: { text: 'For more information, contact the server admin.' }
        };

        client.on('messageCreate', async message => {
            if (message.author.bot) return;

            const content = message.content.trim();
            const prefix = content.startsWith('!!') ? '!!' : '!'; // Determine the prefix
            const args = content.slice(prefix.length).trim().split(/ +/); // Slice to remove the prefix
            const command = args.shift().toLowerCase();
            const mention = message.mentions.users.first();

            if (content.startsWith(prefix)) {
                if (command === 'migrate') {
                    if (!mention) {
                        message.channel.send('Please mention a user to migrate their information.');
                        return;
                    }

                    const discordId = mention.id;
                    const migratingMessage = await message.channel.send('Migrating your data, please wait...');

                    oldDb.get('SELECT value FROM keyv WHERE key = ?', [`keyv:coins-${discordId}`], (err, row) => {
                        if (err) {
                            console.error('Error fetching coins:', err.message);
                            message.channel.send('An error occurred while fetching user coins.');
                            return;
                        }

                        const oldCoins = row ? JSON.parse(row.value).value || 0 : 0;

                        oldDb.get('SELECT value FROM keyv WHERE key = ?', [`keyv:extra-${discordId}`], (err, row) => {
                            if (err) {
                                console.error('Error fetching resources:', err.message);
                                message.channel.send('An error occurred while fetching user resources.');
                                return;
                            }

                            const resources = row ? JSON.parse(row.value).value : {};
                            const ram = resources.ram || 0;
                            const disk = resources.disk || 0;
                            const cpu = resources.cpu || 0;
                            const servers = resources.servers || 0;

                            db.get('SELECT * FROM users WHERE discord_id = ?', [discordId], (err, newRow) => {
                                if (err) {
                                    console.error('Error fetching user from new database:', err.message);
                                    message.channel.send('An error occurred while fetching user from new database.');
                                    return;
                                }

                                if (!newRow) {
                                    migratingMessage.edit('Your account is not found in the dashboard. Please register one time and try again.');
                                    return;
                                }

                                if (newRow.ram > 0 || newRow.disk > 0 || newRow.cpu > 0 || newRow.servers > 0) {
                                    migratingMessage.edit('Your account already has some resources. Please contact admin.');
                                    return;
                                }

                                const newCoins = newRow.coins + oldCoins;
                                const newResources = {
                                    ram: newRow.ram + ram,
                                    disk: newRow.disk + disk,
                                    cpu: newRow.cpu + cpu,
                                    servers: newRow.servers + servers
                                };

                                db.run('UPDATE users SET coins = ?, ram = ?, disk = ?, cpu = ?, servers = ? WHERE discord_id = ?', [
                                    newCoins, newResources.ram, newResources.disk, newResources.cpu, newResources.servers, discordId
                                ], (err) => {
                                    if (err) {
                                        console.error('Error updating new database:', err.message);
                                        message.channel.send('An error occurred while updating the new database.');
                                        return;
                                    }

                                    oldDb.run('DELETE FROM keyv WHERE key = ? OR key = ?', [
                                        `keyv:coins-${discordId}`, `keyv:extra-${discordId}`
                                    ], (err) => {
                                        if (err) {
                                            console.error('Error deleting from old database:', err.message);
                                            message.channel.send('An error occurred while cleaning up old database.');
                                            return;
                                        }

                                        migratingMessage.edit({
                                            content: 'Data migration completed successfully!',
                                            embeds: [{
                                                color: 0x00FF00,
                                                title: `Migrated User Data for ${mention.tag}`,
                                                fields: [
                                                    { name: 'Coins', value: `${newCoins}`, inline: true },
                                                    { name: 'RAM', value: `${newResources.ram} MB`, inline: true },
                                                    { name: 'Disk', value: `${newResources.disk} GB`, inline: true },
                                                    { name: 'CPU', value: `${newResources.cpu}%`, inline: true },
                                                    { name: 'Servers', value: `${newResources.servers}`, inline: true }
                                                ],
                                                footer: { text: `Requested by ${message.author.tag}` }
                                            }]
                                        });
                                    });
                                });
                            });
                        });
                    });
                } else if (command === 'know') {
                    if (!mention) {
                        message.channel.send('Please mention a user to get their information.');
                        return;
                    }

                    const discordId = mention.id;

                    oldDb.get('SELECT value FROM keyv WHERE key = ?', [`keyv:coins-${discordId}`], (err, row) => {
                        if (err) {
                            console.error('Error fetching coins:', err.message);
                            message.channel.send('An error occurred while fetching user coins.');
                            return;
                        }

                        const coins = row ? JSON.parse(row.value).value || 0 : 0;

                        oldDb.get('SELECT value FROM keyv WHERE key = ?', [`keyv:extra-${discordId}`], (err, row) => {
                            if (err) {
                                console.error('Error fetching resources:', err.message);
                                message.channel.send('An error occurred while fetching user resources.');
                                return;
                            }

                            const resources = row ? JSON.parse(row.value).value : {};
                            const ram = resources.ram || 0;
                            const disk = resources.disk || 0;
                            const cpu = resources.cpu || 0;
                            const servers = resources.servers || 0;

                            message.channel.send({
                                embeds: [{
                                    color: 0x00FF00,
                                    title: `User Data for ${mention.tag}`,
                                    fields: [
                                        { name: 'Coins', value: `${coins}`, inline: true },
                                        { name: 'RAM', value: `${ram} MB`, inline: true },
                                        { name: 'Disk', value: `${disk} MB`, inline: true },
                                        { name: 'CPU', value: `${cpu}%`, inline: true },
                                        { name: 'Servers', value: `${servers}`, inline: true }
                                    ],
                                    footer: { 
                                        text: `Requested by ${message.author.tag}. These are the resources earned or purchased by ${mention.tag}.` 
                                    }
                                }]
                            });
                            
                        });
                    });
                } else if (command === 'help') {
                    message.channel.send({ embeds: [helpMessage] });
                }
            } else if (message.mentions.has(client.user)) {
                message.channel.send({ embeds: [helpMessage] });
            }
        });

        client.on('disconnect', () => {
            oldDb.close((err) => {
                if (err) {
                    console.error('Error closing old database:', err.message);
                } else {
                    console.log('Old database connection closed.');
                }
            });
        });
    };
} else {
    console.log('Migrator plugin is not enabled.');
}
