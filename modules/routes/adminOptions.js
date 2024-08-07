module.exports.load = async function (express, session, passport, version, DiscordStrategy, bodyParser, figlet,
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, theme, randomstring,
    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
    updateUserCoins, fetchAllocations, addNotification
) {

    app.post('/createcoupon', (req, res) => {
        const { couponcode, coins, servers, cpu, ram, disk, backup, ports, database } = req.body;
        const couponCode = couponcode || randomstring.generate({ length: 10, charset: 'alphanumeric' });
        db.run(`INSERT INTO coupons (code, coins, servers, cpu, ram, disk, backup, ports, database)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [couponCode, coins, servers || 0, cpu || 0, ram || 0, disk || 0, backup || 0, ports || 0, database || 0],
            function (err) {
                if (err) {
                    return res.status(500).send('Error creating coupon.');
                }
                res.redirect('coupons?success=created coupon With Code: '+ couponCode);
            }
        );
    });

    app.post('/revoke', (req, res) => {
        const { couponcode } = req.body;

        if (!couponcode) {
            return res.status(400).send('Coupon code is required.');
        }
        db.run(`DELETE FROM coupons WHERE code = ?`, [couponcode], function (err) {
            if (err) {
                res.redirect('coupons?error=Error revoking coupon.');

            }
            res.redirect('coupons?success=Coupon Deleted ');
        });
    });




    app.post('/suspenduser', (req, res) => {
        const userId = req.body.id;
        if (!userId) {
            return res.status(400).send('User ID is required.');
        }
    
        console.log(`Suspending user with ID: ${userId}`); // Add logging to track the user ID
    
        const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
            if (err) {
                logErrorToFile(`Error opening database: ${err.message}`);
                return res.status(500).send('Database connection error');
            }
        });
    
        db.run(`UPDATE users SET status = ? WHERE id = ?`, [0, userId], function(err) { // Ensure parameters are correctly passed
            if (err) {
                logErrorToFile(`Error suspending user with ID ${userId}: ${err.message}`);
                return res.status(500).send('Error suspending user.');
            }
            if (this.changes === 0) {
                logErrorToFile(`No user found with ID ${userId} to suspend.`);
                return res.status(404).send('No user found to suspend.');
            }
            console.log(`User ${userId} suspended successfully.`);
            res.redirect(`/manage-users?success=User ${userId} suspended.`);
        });
    
        db.close((err) => {
            if (err) {
                logErrorToFile(`Error closing database: ${err.message}`);
            }
        });
    });
    
    app.post('/suspenduser', (req, res) => {
        const userId = req.body.id;
        if (!userId) {
            return res.status(400).send('User ID is required.');
        }
    
        console.log(`Suspending user with ID: ${userId}`);
    
        const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
            if (err) {
                logErrorToFile(`Error opening database: ${err.message}`);
                return res.status(500).send('Database connection error');
            }
        });
    
        db.run(`UPDATE users SET status = ? WHERE id = ?`, [0, userId], function(err) {
            if (err) {
                logErrorToFile(`Error suspending user with ID ${userId}: ${err.message}`);
                return res.status(500).send('Error suspending user.');
            }
            if (this.changes === 0) {
                logErrorToFile(`No user found with ID ${userId} to suspend.`);
                return res.status(404).send('No user found to suspend.');
            }
            console.log(`User ${userId} suspended successfully.`);
            res.redirect(`/manage-users?success=User ${userId} suspended.`);
        });
    
        db.close((err) => {
            if (err) {
                logErrorToFile(`Error closing database: ${err.message}`);
            }
        });
    });
    
    app.post('/unsuspenduser', (req, res) => {
        const userId = req.body.id;
        if (!userId) {
            return res.status(400).send('User ID is required.');
        }
    
        console.log(`Unsuspending user with ID: ${userId}`);
    
        const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
            if (err) {
                logErrorToFile(`Error opening database: ${err.message}`);
                return res.status(500).send('Database connection error');
            }
        });
    
        db.run(`UPDATE users SET status = ? WHERE id = ?`, [1, userId], function(err) {
            if (err) {
                logErrorToFile(`Error unsuspending user with ID ${userId}: ${err.message}`);
                return res.status(500).send('Error unsuspending user.');
            }
            if (this.changes === 0) {
                logErrorToFile(`No user found with ID ${userId} to unsuspend.`);
                return res.status(404).send('No user found to unsuspend.');
            }
            console.log(`User ${userId} unsuspended successfully.`);
            res.redirect(`/manage-users?success=User ${userId} unsuspended.`);
        });
    
        db.close((err) => {
            if (err) {
                logErrorToFile(`Error closing database: ${err.message}`);
            }
        });
    });
    
    

};
