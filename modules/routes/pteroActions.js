const express = require('express');
const axios = require('axios');
const { pipeline } = require('stream/promises');
const { createReadStream } = require('fs');
const { PassThrough } = require('stream');

module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations,addNotification
){
    function formatDate(date) {
        const day = pad(date.getDate(), 2);
        const month = pad(date.getMonth() + 1, 2);
        const year = date.getFullYear();
        const hour = pad(date.getHours(), 2);
        const minute = pad(date.getMinutes(), 2);
        const second = pad(date.getSeconds(), 2);
        return `${day}:${month}:${year}:${hour}:${minute}:${second}`;}

// Pteropassword reset
router.get('/resetptero', async (req, res) => {
    try {
        const userId = req.session.user.pterodactyl_id;
        const userIdentifier = await getUserIdByUUID(userId);
        const newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });
        await updatePasswordInPanel(userIdentifier, newPassword, req.session.user.email, req.session.user.username, req.session.user.first_name, req.session.user.last_name);
        const uuid = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);
        return res.redirect('settings?success=your New Password is:'+` ${newPassword}`);
    } catch (error) {  
         return res.redirect('settings?error=Error resetting password.');}
        });




// Function to Suspend servers 
const checkAndSuspendExpiredServers = async () => {
    if (!settings.store.renewals.status) {
        return;
    }

    try {
        const currentDate = getCurrentDateFormatted();

        const expiredServers = await new Promise((resolve, reject) => {
            db.all(`SELECT serverId FROM renewals WHERE next_renewal < ? AND status = 'active'`, [currentDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        if (!Array.isArray(expiredServers)) {
            throw new TypeError('Expected an array of expired servers');
        }
        for (const server of expiredServers) {
            try {
                const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${server.serverId}/suspend`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.pterodactyl.key}`
                    }
                });
                if (response.ok) {
                    
                    await new Promise((resolve, reject) => {
                        db.run(`UPDATE renewals SET status = 'suspended', next_renewal = '00:00:00:00:00:00' WHERE serverId = ?`, [server.serverId], (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    const errorMessage = await response.text();
                    console.error(`Error suspending server ${server.serverId}:`, errorMessage);
                }
            } catch (error) {
                console.error(`Error suspending server ${server.serverId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking for expired servers:', error);
    }
};
const getCurrentDateFormatted = () => {
    const now = new Date();
    const month = pad(now.getMonth() + 1, 2);
    const day = pad(now.getDate(), 2);
    const year = now.getFullYear();
    const hour = pad(now.getHours(), 2);
    const minute = pad(now.getMinutes(), 2);
    const second = pad(now.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;};

const pad = (num, size) => {
    return ('0' + num).slice(-size);
};

setInterval(checkAndSuspendExpiredServers, 60000);


const moment = require('moment-timezone'); 

router.get('/renew', async (req, res) => {
    if (!settings.store.renewals.status) {
        return res.redirect('/manage?error=Server renewal feature is currently disabled.');
    }

    try {
        const serverId = req.query.id;
        if (!serverId) {
            return res.redirect('/manage?error=No server ID provided for renewal.');
        }

        const userId = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);

        // Check if user has sufficient coins
        const cost = settings.store.renewals.cost;
        if (coins < cost) {
            return res.redirect('/manage?error=Insufficient coins for renewal.');
        }

        // Fetch the existing next_renewal date
        const renewalInfo = await new Promise((resolve, reject) => {
            db.get(`SELECT next_renewal FROM renewals WHERE serverId = ?`, [serverId], (err, row) => {
                if (err) {
                    return reject(err);
                }
                resolve(row);
            });
        });

        let nextRenewalDate;
        const timezone = settings.timezone || 'UTC'; 

        if (renewalInfo && renewalInfo.next_renewal) {
            // Parse the existing next_renewal date
            nextRenewalDate = moment.tz(renewalInfo.next_renewal, 'DD:MM:YYYY:HH:mm:ss', timezone);

            // Check if the parsed date is valid
            if (!nextRenewalDate.isValid() || nextRenewalDate.format('DD:MM:YYYY:HH:mm:ss') === '00:00:00:00:00:00') {
                nextRenewalDate = moment().tz(timezone); // Use current date if invalid
            }
        } else {
            nextRenewalDate = moment().tz(timezone); // Use current date and time if not found
        }

        // Check if the next renewal date is in the past, if so, use the current date
        if (nextRenewalDate.isBefore(moment().tz(timezone))) {
            nextRenewalDate = moment().tz(timezone);
        }

        // Add renewal time
        nextRenewalDate.add(settings.store.renewals.days, 'days');
        nextRenewalDate.add(settings.store.renewals.hour, 'hours');
        nextRenewalDate.add(settings.store.renewals.minute, 'minutes');

        // Format the new next_renewal date
        const formattedRenewalDate = nextRenewalDate.format('DD:MM:YYYY:HH:mm:ss');

        // Update the database with the new next_renewal date
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE renewals SET next_renewal = ?, status = 'active' WHERE serverId = ?`,
                [formattedRenewalDate, serverId],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });

        // Unsuspend the server
        const unsuspendResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/unsuspend`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (unsuspendResponse.ok) {
            console.log(`Server ${serverId} unsuspended successfully.`);
        } else {
            const errorMessage = await unsuspendResponse.text();
            console.error(`Error unsuspending server ${serverId}:`, errorMessage);
        }

        // Deduct coins
        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET coins = coins - ? WHERE pterodactyl_id = ?`,
                [cost, userId],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });

        return res.redirect('/manage?success=Server renewed successfully.');
    } catch (error) {
        console.error('Error renewing server:', error);
        return res.redirect('/manage?error=Internal server error.');
    }
});



// Function to format date in the custom format
function formatDate(date) {
    const day = pad(date.getDate(), 2);
    const month = pad(date.getMonth() + 1, 2);
    const year = date.getFullYear();
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;
}



// Helper function to parse the custom date format
function parseCustomDateFormat(dateString) {
    const [day, month, year, hours, minutes, seconds] = dateString.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, seconds);
}




// Function to create server
router.post('/createserver', async (req, res) => {
    const settings = JSON.parse(fs.readFileSync('settings.json', 'utf8'));

    if (settings.webserver.server_creation === false) {
        return res.redirect('/manage?alert=Sorry, Server Creation Not Enabled');
    } else {
        try {
            const userId = req.session.user.pterodactyl_id;
            const userIdentifier = await getUserIdByUUID(userId);
            const userResources = await getUserResources(userId, db);
            const userServersCount = await getUserServersCount(userIdentifier);

            const availableServers = (userResources.row.servers + packageserver) - userServersCount.count;
            const availableCpu = (userResources.row.cpu + packagecpu) - userServersCount.totalCPU;
            const availableRam = (userResources.row.ram + packageram) - userServersCount.totalRAM;
            const availableDisk = (userResources.row.disk + packagedisk) - userServersCount.totalDisk;
            const availableDatabase = (userResources.row.database + packagedatabase) - userServersCount.totalDatabase;
            const availableBackup = (userResources.row.backup + packagebackup) - userServersCount.totalBackup;
            const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts;

            const { name, cpu, ram, disk, port, database, backup, egg: eggKey, locations: locationKey } = req.body;

            const eggConfig = settings.eggs[eggKey];
            const locationsConfig = settings.locations[locationKey];
            const locationId = locationsConfig.id;

            if (!eggConfig) {
                return res.redirect('/manage?info=Invalid egg configuration.');
            }

            // Minimum resource values from egg configuration
            const minCpu = eggConfig.minimum.cpu;
            const minRam = eggConfig.minimum.ram;
            const minDisk = eggConfig.minimum.disk;

            if (cpu < minCpu) {
                return res.redirect(`/manage?info=CPU should be at least ${minCpu} cores.`);
            }
            if (ram < minRam) {
                return res.redirect(`/manage?info=RAM should be at least ${minRam} MB.`);
            }
            if (disk < minDisk) {
                return res.redirect(`/manage?info=Disk space should be at least ${minDisk} MB.`);
            }

            if (availableServers <= 0) {
                return res.redirect('/manage?info=You don\'t have enough available servers to create the server.');
            }
            if (cpu > availableCpu) {
                return res.redirect('/manage?info=You don\'t have enough available CPU to create the server.');
            }
            if (ram > availableRam) {
                return res.redirect('/manage?info=You don\'t have enough available RAM to create the server.');
            }
            if (disk > availableDisk) {
                return res.redirect('/manage?info=You don\'t have enough available disk space to create the server.');
            }
            if (database > availableDatabase) {
                return res.redirect('/manage?info=You don\'t have enough available database to create the server.');
            }
            if (backup > availableBackup) {
                return res.redirect('/manage?info=You don\'t have enough available backup to create the server.');
            }
            if (port > availablePorts) {
                return res.redirect('/manage?info=You don\'t have enough available ports to create the server.');
            }

            let allocationId;
            try {
                allocationId = await fetchAllocations(locationId);
            } catch (error) {
                if (error.message.includes('Node not found')) {
                    return res.redirect('/manage?error=No nodes found for the given location.');
                }
                if (error.message.includes('No unassigned allocation found')) {
                    return res.redirect('/manage?error=All nodes are full for the given location.');
                }
                return res.redirect('/manage?error=Error fetching allocations.');
            }
            console.log(userIdentifier.id);

            const serverConfig = {
                name: name,
                user: userIdentifier.id,
                egg: eggConfig.info.egg,
                docker_image: eggConfig.info.docker_image,
                startup: eggConfig.info.startup,
                environment: eggConfig.info.environment,
                limits: {
                    memory: ram,
                    swap: 0,
                    disk: disk,
                    io: 10,
                    cpu: cpu
                },
                feature_limits: {
                    databases: database,
                    backups: backup,
                    allocations: port
                },
                allocation: {
                    default: allocationId
                }
            };

            const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.pterodactyl.key}`
                },
                body: JSON.stringify(serverConfig)
            });

            if (response.ok) {
                const serverData = await response.json();
                const serverId = serverData.attributes.id;

                // Calculate next renewal date based on settings
                const nextRenewalDate = new Date();
                nextRenewalDate.setDate(nextRenewalDate.getDate() + settings.store.renewals.days);
                nextRenewalDate.setHours(nextRenewalDate.getHours() + settings.store.renewals.hour);
                nextRenewalDate.setMinutes(nextRenewalDate.getMinutes() + settings.store.renewals.minute);
                const formattedRenewalDate = formatDate(nextRenewalDate);
                if (settings.store.renewals.status === true) {
                await db.run(
                    `INSERT INTO renewals (serverId, next_renewal) VALUES (?, ?)`,
                    [serverId, formattedRenewalDate]
                );
            }
                if (settings.discord.logging.status === true && settings.discord.logging.actions.user.create_server === true) {
                    const message = `User Created Server:\nUser: ${userIdentifier.username}\nName: ${name}\nCPU: ${cpu} cores\nRAM: ${ram} MB\nDisk: ${disk} MB\nDatabases: ${database}\nBackups: ${backup}\nPorts: ${port}`;
                    const color = 0x00FF00; // Green color in hexadecimal
                    sendDiscordWebhook(webhookUrl, message, 'Server Creation', color, 'AlphaCtyl');
                }
                 logNormalToFile(`User Created server :${serverData.attributes.id} username: ${req.user.username} `);
                return res.redirect('/manage?success=Server created successfully.');
            } else {
                const errorMessage = await response.text();
                console.error('Error creating server:', errorMessage);
                return res.redirect('/manage?error=Error creating server.');
            }
        } catch (error) {
            console.error('Internal server error:', error);
            return res.redirect('/manage?error=Internal server error.');
        }
    }
});

// Delete ptero server
/*
router.get('/delete', async (req, res) => {
    const serverId = req.query.id; 

    if (!serverId) {
        logErrorToFile('Error: No server ID provided.');
        return res.redirect('/manage?error=No server ID provided.');
    }

    logNormalToFile(`Attempting to delete server with ID: ${serverId}`);

    try {
        const url = `${settings.pterodactyl.domain}/api/application/servers/${serverId}`;
        logNormalToFile(`Fetching URL: ${url}`);

        const response = await fetch(url, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        logNormalToFile(`Response status: ${response.status}`);
        const responseBody = await response.text();
        logNormalToFile(`Response body: ${responseBody}`);

        if (response.status === 204) {
            try {
                await db.run(`DELETE FROM renewals WHERE serverId = ?`, [serverId]);
                logNormalToFile('Success: Server deleted successfully.');
                return res.redirect('/manage?success=Server deleted successfully.');
            } catch (dbError) {
                logErrorToFile(`Error deleting renewal record: ${dbError.message}`);
                return res.redirect('/manage?error=Server deleted but failed to delete renewal record.');
            }
        } else {
            logErrorToFile('Error: Failed to delete server.');
            return res.redirect('/manage?error=Error deleting server.');
        }

    } catch (error) {
        logErrorToFile(`Error: Internal server error. ${error.message}`);
        return res.redirect('/manage?error=Internal server error.');
    }
});
*/
// Update server build
router.post('/updateserver', async (req, res) => {
    const { name, cpu, disk, ram, databases, backup, port } = req.body;
    const serverId = req.query.id;

    if (!serverId) {
        logErrorToFile('Error: Server ID is required.');
        return res.status(400).send('Server ID is required');
    }

    if (cpu === '0' || ram === '0' || disk === '0') {
        logErrorToFile('Error: Resource values cannot be zero.');
        return res.redirect('/manage?error=Resource values cannot be zero');
    }

    try {
        // Fetch server details
        const serverResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            },
            credentials: 'include' // Ensure cookies (like session cookies) are sent
        });

        if (!serverResponse.ok) {
            const errorMessage = await serverResponse.text();
            logErrorToFile(`Error fetching server details: ${errorMessage}`);
            return res.redirect('/manage?error=Failed to fetch server details.');
        }

        const serverData = await serverResponse.json();
        const eggId = serverData.attributes.egg; // Get the egg ID from server details

        // Log the retrieved egg ID for debugging
        logNormalToFile(`Retrieved egg ID: ${eggId}`);

        // Fetch egg configuration
        const eggConfig = Object.values(settings.eggs).find(config => config.info.egg === eggId);
        if (!eggConfig) {
            // Log available egg IDs for debugging
            logNormalToFile(`Available egg configurations: ${Object.keys(settings.eggs).join(', ')}`);
            return res.redirect('/manage?info=Invalid egg configuration.');
        }

        // Log the retrieved egg configuration for debugging
        logNormalToFile(`Egg configuration: ${JSON.stringify(eggConfig)}`);

        // Minimum resource values from egg configuration
        const minCpu = eggConfig.minimum.cpu;
        const minRam = eggConfig.minimum.ram;
        const minDisk = eggConfig.minimum.disk;

        if (cpu < minCpu) {
            return res.redirect(`/manage?info=CPU should be at least ${minCpu} cores.`);
        }
        if (ram < minRam) {
            return res.redirect(`/manage?info=RAM should be at least ${minRam} MB.`);
        }
        if (disk < minDisk) {
            return res.redirect(`/manage?info=Disk space should be at least ${minDisk} MB.`);
        }

        // Fetch user resources and server count
        const userId = req.session.user.pterodactyl_id;
        const uuid = await getUserIdByUUID(userId);
        const userIdentifier = uuid.id;
        const userResources = await getUserResources(userId, db);
        const userServersCount = await getUserServersCount(userIdentifier);

        const availableCpu = (userResources.row.cpu + packagecpu) - userServersCount.totalCPU;
        const availableRam = (userResources.row.ram + packageram) - userServersCount.totalRAM;
        const availableDisk = (userResources.row.disk + packagedisk) - userServersCount.totalDisk;
        const availableDatabase = (userResources.row.database + packagedatabase) - userServersCount.totalDatabase;
        const availableBackup = (userResources.row.backup + packagebackup) - userServersCount.totalBackup;
        const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts;

        // Validate resources
        if (cpu > availableCpu) {
            logErrorToFile('Info: Insufficient CPU to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available CPU to update the server.');
        }
        if (ram > availableRam) {
            logErrorToFile('Info: Insufficient RAM to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available RAM to update the server.');
        }
        if (disk > availableDisk) {
            logErrorToFile('Info: Insufficient disk space to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available disk space to update the server.');
        }
        if (databases > availableDatabase) {
            logErrorToFile('Info: Insufficient databases to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available databases to update the server.');
        }
        if (backup > availableBackup) {
            logErrorToFile('Info: Insufficient backups to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available backups to update the server.');
        }
        if (port > availablePorts) {
            logErrorToFile('Info: Insufficient ports to update the server.');
            return res.redirect('/manage?info=You don\'t have enough available ports to update the server.');
        }

        const updateData = {
            name: name || serverData.attributes.name,
            limits: {
                memory: ram ? Number(ram) : serverData.attributes.limits.memory,
                swap: 0,
                disk: disk ? Number(disk) : serverData.attributes.limits.disk,
                io: 500,
                cpu: cpu ? Number(cpu) : serverData.attributes.limits.cpu
            },
            feature_limits: {
                databases: databases ? Number(databases) : serverData.attributes.feature_limits.databases,
                allocations: port ? Number(port) : serverData.attributes.feature_limits.allocations,
                backups: backup ? Number(backup) : serverData.attributes.feature_limits.backups
            },
            allocation: serverData.attributes.allocation 
        };

        // Update server build
        const updateResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/build`, {
            method: 'PATCH',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            },
            body: JSON.stringify(updateData),
            credentials: 'include' 
        });

        if (updateResponse.ok) {
            logNormalToFile('Success: Server build updated successfully.');
            return res.redirect('/manage?success=Server build updated successfully');
        } else {
            const errorMessage = await updateResponse.text();
            logErrorToFile(`Error updating server build: ${errorMessage}`);
            return res.redirect('/manage?error=Failed to update server build');
        }
    } catch (error) {
        logErrorToFile(`Error updating server build: ${error.message}`);
        return res.redirect('/manage?error=Failed to update server build');
    }
});

app.post('/installplugin', async (req, res) => {
    const { pluginId, serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!pluginId || !serverId) {
        return res.status(400).json({ success: false, message: 'Missing pluginId or serverId' });
    }

    try {
        // Get API key from database
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            console.error('API key is missing or invalid.');
            return res.status(401).json({ success: false, message: 'API key is missing or invalid. Please update your API key.' });
        }

        // Fetch signed URL for file upload
        const signedUrlResponse = await axios.get(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/files/upload`, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`,
            }
        });

        if (signedUrlResponse.status !== 200) {
            console.error('Failed to get signed URL:', signedUrlResponse.status, signedUrlResponse.data);
            throw new Error(`Failed to get signed URL. Status: ${signedUrlResponse.status}, Response: ${JSON.stringify(signedUrlResponse.data)}`);
        }

        const uploadUrl = signedUrlResponse.data.attributes.url;

        // Download plugin .jar file from Spiget
        const downloadUrl = `https://api.spiget.org/v2/resources/${pluginId}/download`;
        const response = await axios.get(downloadUrl, { responseType: 'stream' });

        // Ensure the response data is a valid stream
        if (!response.data || !response.data.pipe) {
            throw new Error('Failed to download plugin. The response is not a valid stream.');
        }

        // Upload the .jar file to the signed URL
        const uploadResponse = await axios.put(uploadUrl, response.data, {
            headers: {
                'Content-Type': 'application/java-archive',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        if (uploadResponse.status === 200) {
            res.json({ success: true, message: 'Plugin installed successfully' });
        } else {
            console.error('Failed to upload file:', uploadResponse.status, uploadResponse.data);
            throw new Error(`Failed to upload file. Status: ${uploadResponse.status}, Response: ${JSON.stringify(uploadResponse.data)}`);
        }
    } catch (error) {
        console.error('Error installing plugin:', error.message);
        res.status(500).json({ success: false, message: 'Error installing plugin', error: error.message });
    }
});




//actions

app.use(express.json());
const getApiKeyFromDb = (userId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT api_key FROM users WHERE pterodactyl_id = ?", [userId], (err, row) => {
            if (err) {
                return reject(err);
            }
            resolve(row ? row.api_key : null);
        });
    });
};
app.post('/update-api-key', async (req, res) => {
    const { apiKey } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!apiKey || typeof apiKey !== 'string') {
        return res.status(400).json({ error: 'Invalid API key' });
    }

    try {
        const changes = await updateApiKeyInDb(userId, apiKey);

        if (changes === 0) {
            return res.status(400).json({ error: 'Failed to update API key' });
        }

        res.json({ success: 'API key updated successfully' });
    } catch (error) {
        console.error('Error updating API key:', error.message);
        res.status(500).json({ error: error.message });
    }
});

// Function to update the API key in the database
const updateApiKeyInDb = (userId, apiKey) => {
    return new Promise((resolve, reject) => {
        db.run("UPDATE users SET api_key = ? WHERE pterodactyl_id = ?", [apiKey, userId], function(err) {
            if (err) {
                return reject(err);
            }
            resolve(this.changes);
        });
    });
};

// Endpoint to fetch server details
app.post('/server', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        let clientApiKey = await getApiKeyFromDb(userId);

        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        let resourceUsageResponse;
        try {
            resourceUsageResponse = await axios.get(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/resources`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${clientApiKey}`
                }
            });
        } catch (err) {
            if (err.response && err.response.status === 401) {
                clientApiKey = null;
            } else {
                throw err;
            }
        }

        if (!clientApiKey) {
            return res.status(401).json({ error: 'API key is invalid or expired. Please update your API key.' });
        }

        const resources = resourceUsageResponse.data.attributes.resources;
        const attributes = resourceUsageResponse.data.attributes;
        const websocketResponse = await axios.get(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/websocket`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        const websocketData = websocketResponse.data;
        const socketUrl = websocketData.data.socket;
        const token = websocketData.data.token;

        res.json({
            resources: {
                state: attributes.current_state,
                memoryBytes: resources.memory_bytes,
                cpuAbsolute: resources.cpu_absolute,
                diskBytes: resources.disk_bytes,
                networkRxBytes: resources.network_rx_bytes,
                networkTxBytes: resources.network_tx_bytes
            },
            websocket: {
                socketUrl,
                token
            }
        });
    } catch (error) {
        console.error('Error fetching server details:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});

app.post('/server/command', async (req, res) => {
    const { serverId, command } = req.body;
    
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || !command) {
        return res.status(400).json({ error: 'Server ID and command are required' });
    }

    try {
        let clientApiKey = await getApiKeyFromDb(userId);

        const response = await axios.post(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/command`, { command }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        if (response.status === 204) {
            return res.status(200).json({ message: 'Command sent successfully' });
        } else {
            return res.status(response.status).json(response.data);
        }
    } catch (error) {
        console.error('Error sending command to Pterodactyl API:', error.response ? error.response.data : error.message);
        return res.status(error.response ? error.response.status : 500).json({
            error: 'An error occurred while sending the command'
        });
    }
});

// Endpoint to start the server
app.post('/server/start', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        await axios.post(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/power`, {
            signal: 'start'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        res.json({ success: 'Server started successfully' });
    } catch (error) {
        console.error('Error starting server:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});
// Endpoint to stop the server
app.post('/server/stop', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        await axios.post(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/power`, {
            signal: 'stop'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        res.json({ success: 'Server stopped successfully' });
    } catch (error) {
        console.error('Error stopping server:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});

// Endpoint to restart the server
app.post('/server/restart', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        await axios.post(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/power`, {
            signal: 'restart'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        res.json({ success: 'Server restarted successfully' });
    } catch (error) {
        console.error('Error restarting server:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});


// Endpoint to kill the server
app.post('/server/kill', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        await axios.post(`${settings.pterodactyl.domain}/api/client/servers/${serverId}/power`, {
            signal: 'kill'
        }, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        res.json({ success: 'Server killed successfully' });
    } catch (error) {
        console.error('Error killing server:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});


// Endpoint to fetch server status
app.post('/server/status', async (req, res) => {
    const { serverId } = req.body;
    const userId = req.session.user.pterodactyl_id;

    if (!serverId || typeof serverId !== 'string') {
        return res.status(400).json({ error: 'Invalid server ID' });
    }

    try {
        const clientApiKey = await getApiKeyFromDb(userId);
        if (!clientApiKey) {
            return res.status(401).json({ error: 'No API key found for user. Please provide a valid API key.' });
        }

        const response = await axios.get(`${settings.pterodactyl.domain}/api/client/servers/${serverId}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${clientApiKey}`
            }
        });

        const serverData = response.data.attributes;
        res.json({
            name: serverData.name,
        });
    } catch (error) {
        console.error('Error fetching server status:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: error.message });
    }
});








}