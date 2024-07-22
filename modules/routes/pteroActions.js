

module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,WEBSOCKET_PORT,DOMAIN,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations
) {

// Pteropassword reset
router.get('/resetptero', async (req, res) => {
    try {
        const userId = req.session.user.pterodactyl_id;
        const userIdentifier = await getUserIdByUUID(userId);
        console.log('User Identifier:', userIdentifier.id);
        const newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });
        await updatePasswordInPanel(userIdentifier, newPassword, req.session.user.email, req.session.user.username, req.session.user.first_name, req.session.user.last_name);
        const uuid = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);
        return res.redirect('settings?success=your New Password is:'+` ${newPassword}`);

      
    } catch (error) {  
    logErrorToFile(`Error resetting password in Pterodactyl panel for user:${userId} `);
         return res.redirect('settings?error=Error resetting password.');}});




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
                        db.run(`UPDATE renewals SET status = 'suspended' WHERE serverId = ?`, [server.serverId], (err) => {
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
//functions to renew 
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

const nextRenewalDate = new Date();
nextRenewalDate.setDate(nextRenewalDate.getDate() + settings.store.renewals.days);
nextRenewalDate.setHours(nextRenewalDate.getHours() + settings.store.renewals.hour);
nextRenewalDate.setMinutes(nextRenewalDate.getMinutes() + settings.store.renewals.minute);
const formattedRenewalDate = formatDate(nextRenewalDate);

function formatDate(date) {
    const day = pad(date.getDate(), 2);
    const month = pad(date.getMonth() + 1, 2);
    const year = date.getFullYear();
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;}

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

// Function to create server 
router.post('/createserver', async (req, res) => {
    if (settings.webserver.server_creation === false) {
        return res.redirect('/manage?alert=Sorry, Server Creation Not Enabled');
    } else {
        try {
            const userId = req.session.user.pterodactyl_id;
            const uuid = await getUserIdByUUID(userId);
            const userIdentifier = uuid.id;
            const userResources = await getUserResources(userId, db);
            const userServersCount = await getUserServersCount(userIdentifier);
            const availableServers = (userResources.row.servers + packageserver) - userServersCount.count;
            const availableCpu = (userResources.row.cpu + packagecpu) - userServersCount.totalCPU;
            const availableRam = (userResources.row.ram + packageram) - userServersCount.totalRAM;
            const availableDisk = (userResources.row.disk + packagedisk) - userServersCount.totalDisk;
            const availableDatabase = (userResources.row.database + packagedatabase) - userServersCount.totalDatabase;
            const availablebackup = (userResources.row.backup + packagebackup) - userServersCount.totalBackup;
            const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts;
            const { name, cpu, ram, disk, port, database, backup } = req.body;

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
            if (backup > availablebackup) {
                return res.redirect('/manage?info=You don\'t have enough available backup to create the server.');
            }
            if (port > availablePorts) {
                return res.redirect('/manage?info=You don\'t have enough available ports to create the server.');
            }
            const eggKey = req.body.egg;
            const locationKey = req.body.locations;
            const eggConfig = settings.eggs[eggKey];
            const locationsConfig = settings.locations[locationKey];
            const locationId = locationsConfig.id;
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
            const serverConfig = {
                name: name,
                user: uuid.id,
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
// Function to format date as dd:mm:yy:h:m:s
function formatDate(date) {
    const day = pad(date.getDate(), 2);
    const month = pad(date.getMonth() + 1, 2);
    const year = date.getFullYear();
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;
}
                await db.run(
                    `INSERT INTO renewals (serverId, next_renewal) VALUES (?, ?)`,
                    [serverId, formattedRenewalDate]
                );
                console.log(formattedRenewalDate);

                if (settings.discord.logging.status === true && settings.discord.logging.actions.user.create_server === true) {
                    const message = `User Created Server:\nName: ${name}\nCPU: ${cpu} cores\nRAM: ${ram} MB\nDisk: ${disk} MB\nDatabases: ${database}\nBackups: ${backup}\nPorts: ${port}`;
                    const color = 0x00FF00; // Green color in hexadecimal
                    sendDiscordWebhook(webhookUrl, message, 'Resource Purchase Notification', color, 'AlphaCtyl');

                }
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
// delete ptero server
router.get('/delete', async (req, res) => {
    const serverId = req.query.id; 

    if (!serverId) {
        return res.redirect('/manage?error=No server ID provided.');
    }
    try {
        const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });
        if (response.status === 204) {
            // Server deleted successfully from Pterodactyl
            try {
                await db.run(`DELETE FROM renewals WHERE serverId = ?`, [serverId]);
                return res.redirect('/manage?success=Server  deleted successfully.');
            } catch (dbError) {
                console.error('Error deleting renewal record:', dbError);
                return res.redirect('/manage?error=Server deleted but failed to delete renewal record.');
            }
        } else {
            // Error deleting server
            return res.redirect('/manage?error=Error deleting server.');
        }
    } catch (error) {
        console.error('Error deleting server:', error);
        return res.redirect('/manage?error=Internal server error.');
    }
});

//Update user servers

//pending 
app.post('/updateserver', (req, res) => {
    const serverId = parseInt(req.body.id);
    const serverIndex = servers.findIndex(s => s.id === serverId);
    if (serverIndex !== -1) {
      servers[serverIndex] = { ...servers[serverIndex], ...req.body };
      res.redirect('/');
    } else {
      res.status(404).send('Server not found');
    }
  });

}