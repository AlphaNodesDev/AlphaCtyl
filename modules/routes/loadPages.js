module.exports.load = async function (express, session, passport, version, DiscordStrategy, bodyParser, figlet,
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, theme, randomstring,
    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
    updateUserCoins, fetchAllocations, getNotification) {

    // Render appname and logo to OAuth pages only
    Object.keys(oauthPages).forEach(page => {
        app.get(`/${page}`, (req, res) => {
            if (settings.webserver.Maintainance === true) {
                res.send('Sorry, the site is currently under maintenance. Please try again later.');
            } else {
                res.render(oauthPages[page], {
                    AppName: AppName,
                    AppLogo: AppImg,
                    settings: settings
                });
            }
        });
    });

    Object.keys(adminPages).forEach(page => {
        app.get(`/${page}`, async (req, res) => {
            try {
                if (!req.session.user || !req.session.user.pterodactyl_id) {
                    return res.redirect('/?error=Please Login Again.');
                }
                const userId = req.session.user.pterodactyl_id;
                const userIdentifier = await getUserIdByUUID(userId);
                if (userIdentifier.admin === true) {
                    const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
                        if (err) {
                            logErrorToFile(`Error opening database: ${err.message}`);
                            return res.status(500).send('Database connection error');
                        }
                        fs.readFile(LOG_FILE_PATH, 'utf8', (err, errorLogsData) => {
                            if (err) {
                                errorLogsData = 'Could not load error logs.';
                            }
                            const errorLogsByDate = parseLogs(errorLogsData);
                            fs.readFile(NORMAL_LOG_FILE_PATH, 'utf8', (err, normalLogsData) => {
                                if (err) {
                                    normalLogsData = 'Could not load normal logs.';
                                }
                                const normalLogsByDate = parseNormalLogs(normalLogsData);
                                db.all('SELECT * FROM Users', async (err, users) => {
                                    if (err) {
                                        logErrorToFile(`Error fetching users from database: ${err.message}`);
                                        users = [];
                                    } else {
                                        // Fetch additional details for each user
                                        for (let i = 0; i < users.length; i++) {
                                            users[i].pterodactylDetails = await getUserIdByUUID(users[i].pterodactyl_id);
                                        }
                                    }
                                    res.render(adminPages[page], {
                                        user: req.session.user,
                                        userIdentifier,
                                        AppName: AppName,
                                        AppLogo: AppImg,
                                        settings: settings,
                                        errorLogs: errorLogsByDate,
                                        normalLogs: normalLogsByDate,
                                        users: users,
                                        version
                                    });
                                    db.close((err) => {
                                        if (err) {
                                            logErrorToFile(`Error closing database: ${err.message}`);
                                        }
                                    });
                                });
                            });
                        });
                    });
                } else {
                    return res.redirect('dashboard?alert=Access denied!');
                }
            } catch (error) {
                logErrorToFile(`Error: ${error.message}`);
                res.status(500).send('Internal server error');
            }
        });
    });
    

    function parseCustomDateFormat(dateString) {
        // Date format: DD:MM:YYYY:HH:MM:SS
        const [day, month, year, hours, minutes, seconds] = dateString.split(':').map(Number);
        // Create a new Date object in ISO 8601 format
        return new Date(year, month - 1, day, hours, minutes, seconds);
    }
    
    function calculateTimeRemaining(nextRenewal) {

        if (!nextRenewal) {
            return 'No renewal date available';
        }
    if(nextRenewal === '00:00:00:00:00:00'){
        return 'Suspended';
    }
        const nextRenewalDate = parseCustomDateFormat(nextRenewal);
        const currentDate = new Date();
    
        // Check if nextRenewalDate is valid
        if (isNaN(nextRenewalDate.getTime())) {
            return 'Invalid renewal date';
        }
    
        const timeDiff = nextRenewalDate - currentDate;
    
        if (timeDiff <= 0) {
            return 'Renewal overdue';
        }
    
        const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
        return `${days}d ${hours}h ${minutes}m`;
    }
    // Render values to all pages
    Object.keys(pages).forEach((page) => {
        router.get(`/${page}`, async (req, res) => {
            if (!req.session.user || !req.session.user.id) {
                return res.redirect('/?error=Please Login Again.');
            }

            try {
                const userId = req.session.user.pterodactyl_id;
                const db = new sqlite3.Database(DB_FILE_PATH);

                const [userIdentifier, userresources, coins, notifications] = await Promise.all([
                    getUserIdByUUID(userId),
                    getUserResources(userId, db),
                    getUserCoins(userId, db),
                    getNotification(userId, db)
                ]);

const [userServersCount, userServers] = await Promise.all([
    getUserServersCount(userIdentifier, db),
    getUserServers(userIdentifier),
    
]);

userServersCount.userServers.forEach(server => {
    const nextRenewal = server.attributes.next_renewal;
    server.attributes.timeRemaining = calculateTimeRemaining(nextRenewal);
});



                db.close();

                res.render(pages[page], {
                    user: req.session.user,
                    userresources,
                    userServersCount,
                    userServers,
                    userIdentifier,
                    AppName,
                    AppLogo: AppImg,
                    packageserver,
                    packagecpu,
                    packageram,
                    packagedisk,
                    packageport,
                    packagedatabase,
                    packagebackup,
                    ads,
                    coins,
                    afktimer,
                    pterodactyldomain,
                    settings,
                    notifications
                      
                });
            } catch (error) {
                console.error('Error fetching data:', error);
                return res.redirect('/?error=Please Login Again.');
            }
        });
    });

    
};
