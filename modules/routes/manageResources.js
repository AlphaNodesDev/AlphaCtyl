module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations,addNotification
){// Buy Resources  
router.post('/byresources', (req, res) => {
    const { servers, cpu, ram, disk, ports, database, backup } = req.body;

    db.get('SELECT * FROM users WHERE pterodactyl_id = ?', [req.session.user.pterodactyl_id], (err, row) => {
        if (err) {
            console.error(err);
            res.send('Error authenticating user.');
            return;
        }
        if (!row) {
            return res.redirect('store?error=Invalid User.');
        }

        const costs = {
            servers: servers * settings.store.servers.cost,
            cpu: cpu * settings.store.cpu.cost,
            ram: ram * settings.store.ram.cost,
            disk: disk * settings.store.disk.cost,
            ports: ports * settings.store.ports.cost,
            database: database * settings.store.database.cost,
            backup: backup * settings.store.backup.cost
        };

        const selectedResource = Object.keys(req.body).find(key => req.body[key] && req.body[key] !== '0');
        if (!selectedResource || !settings.store[selectedResource]) {
            return res.redirect('store?error=Invalid selection.');
        }

        const totalCost = costs[selectedResource];
        if (row.coins < totalCost) {
            return res.redirect('store?error=Not enough coins.');
        }

        const updates = {
            coins: row.coins - totalCost,
            [`${selectedResource}`]: (row[`${selectedResource}`] || 0) + parseInt(req.body[selectedResource]) * settings.store[selectedResource].per
        };

        db.run(
            'UPDATE users SET coins = ?, ' + `${selectedResource}` + ' = ? WHERE pterodactyl_id = ?', 
            [updates.coins, updates[`${selectedResource}`], req.session.user.pterodactyl_id], 
            (updateErr) => {
                if (updateErr) {
                    console.error(updateErr);
                    res.send('Error updating resources.');
                } else {
                    const purchasedResources = {
                        servers: servers > 0 ? `Servers: ${servers}` : '',
                        cpu: cpu > 0 ? `CPU: ${cpu}` : '',
                        ram: ram > 0 ? `RAM: ${ram}` : '',
                        disk: disk > 0 ? `Disk: ${disk}` : '',
                        ports: ports > 0 ? `Ports: ${ports}` : '',
                        database: database > 0 ? `Database: ${database}` : '',
                        backup: backup > 0 ? `Backup: ${backup}` : ''
                    };

                    const resourceDetails = Object.values(purchasedResources).filter(Boolean).join(', ');

                    const message = `**User Discord Id:** ${req.session.user.discord_id}\n**Purchased Resources:** ${resourceDetails}`;
                    const webhookUrl = settings.discord.logging.webhook;
                    const color = 0x00FF00; 

                    if (settings.discord.logging.status === true && settings.discord.logging.actions.user.buy_resources === true) {
                        sendDiscordWebhook(webhookUrl, 'Resource Purchase Notification', message, color, 'AlphaCtyl');
                    }

                    req.session.user = { ...row, ...updates };
                    res.redirect('/store?success=Successfully purchased.');
                }
            }
        );
    });
});




router.post('/addresources', (req, res) => {
    const { username, amount, resourceType } = req.body;
    const allowedResources = ['coins', 'cpu', 'ram', 'disk', 'servers', 'ports', 'database', 'backup'];

    if (!allowedResources.includes(resourceType)) {
        return res.status(400).send('Invalid resource type.');
    }
    const query = `UPDATE users SET ${resourceType} = ? WHERE username = ?`;
    db.run(query, [amount, username], (updateErr) => {
        if (updateErr) {
            console.error(updateErr);
            return res.status(500).send('Error updating resources.');
        }
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching updated user data.');
            }
            req.session.user = { ...row };
            res.redirect('/resources?success=Successfully purchased.');
        });
    });
});

router.post('/redeem', (req, res) => {
    const { couponcode } = req.body;

    if (!couponcode) {
        return res.status(400).send('Coupon code is required.');
    }

    db.get(`SELECT * FROM coupons WHERE code = ?`, [couponcode], (err, coupon) => {
        if (err) {
            console.error('Database error:', err);
            return res.status(500).send('Error retrieving coupon.');
        }

        if (!coupon) {
            return res.redirect('/redeem?success=Coupon not found.');

        }


        const userId = req.session.user.pterodactyl_id;

        if (!userId) {
            return res.status(401).send('User not authenticated.');
        }

        db.get(`SELECT * FROM users WHERE pterodactyl_id = ?`, [userId], (err, user) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).send('Error retrieving user.');
            }

            if (!user) {
                return res.status(404).send('User not found.');
            }

            const updatedValues = {
                coins: (user.coins || 0) + (coupon.coins || 0),
                servers: (user.servers || 0) + (coupon.servers || 0),
                cpu: (user.cpu || 0) + (coupon.cpu || 0),
                ram: (user.ram || 0) + (coupon.ram || 0),
                disk: (user.disk || 0) + (coupon.disk || 0),
                backup: (user.backup || 0) + (coupon.backup || 0),
                ports: (user.ports || 0) + (coupon.ports || 0),
                database: (user.database || 0) + (coupon.database || 0)
            };


            db.run(`UPDATE users SET coins = ?, servers = ?, cpu = ?, ram = ?, disk = ?, backup = ?, ports = ?, database = ? WHERE pterodactyl_id = ?`,
                [updatedValues.coins, updatedValues.servers, updatedValues.cpu, updatedValues.ram, updatedValues.disk, updatedValues.backup, updatedValues.ports, updatedValues.database, userId],
                (err) => {
                    if (err) {
                        console.error('Database error:', err);
                        return res.status(500).send('Error updating user data.');
                    }

                    db.run(`DELETE FROM coupons WHERE code = ?`, [couponcode], (err) => {
                        if (err) {
                            console.error('Database error:', err);
                            return res.status(500).send('Error deleting coupon.');
                        }
                        res.redirect('/redeem?success=coupon-redeemed');
                    });
                }
            );
        });
    });
});

const cache = new Map();

router.get('/api/plugins', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 100;
    const cacheKey = `${page}-${size}`;

    if (cache.has(cacheKey)) {
        return res.json(cache.get(cacheKey));
    }

    try {
        const response = await axios.get('https://api.spiget.org/v2/resources', {
            params: { size, page }
        });

        cache.set(cacheKey, response.data);
        setTimeout(() => cache.delete(cacheKey), 60 * 60 * 1000); // Clear cache after 1 hour

        res.json(response.data);
    } catch (error) {
        console.error('Error fetching plugins:', error);
        res.status(500).send('Internal Server Error');
    }
});

}