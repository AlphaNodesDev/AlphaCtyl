
module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations,getNotification
) {


 //render appname and logo to oauth pages only
 Object.keys(oauthPages).forEach(page => {
    app.get(`/${page}`, (req, res) => {
        if (settings.webserver.Maintainance === true) {
            res.send('Sorry, the site is currently under maintenance. Please try again later.');
        }else{
        res.render(oauthPages[page], { 
            AppName: AppName, 
            AppLogo: AppImg, 
            settings: settings
        });
 } });
});
// Load admin pages and values
Object.keys(adminPages).forEach(page => {
    app.get(`/${page}`, async (req, res) => {
        try {
            if (!req.session.user || !req.session.user.pterodactyl_id) {
                return res.redirect('/?error=Please Login Again.');
            }
            const userId = req.session.user.pterodactyl_id;
            const userIdentifier = await getUserIdByUUID(userId);
            if(userIdentifier.admin === true){
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
                                db.all('SELECT * FROM Users', (err, users) => {
                                if (err) {
                                    logErrorToFile(`Error fetching users from database: ${err.message}`);
                                    users = [];
                                }
                                res.render(adminPages[page], { 
                                    user: req.session.user,
                                    AppName: AppName, 
                                    AppLogo: AppImg,
                                    settings: settings,
                                    errorLogs: errorLogsByDate,
                                    normalLogs: normalLogsByDate,
                                    users: users 
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
                return res.redirect('dashboard?alert=Accesss denied!');
            }
        } catch (error) {
            logErrorToFile(`Error: ${error.message}`);
            res.status(500).send('Internal server error');
        }
    });
});


// render values to all pages
Object.keys(pages).forEach((page) => {
    router.get(`/${page}`, async (req, res) => {
        if (!req.session.user || !req.session.user.id) {
            return res.redirect('/?error=Please Login Again.');
        }

        try {
            const userId = req.session.user.pterodactyl_id;
            const db = new sqlite3.Database(DB_FILE_PATH);

            // Use Promise.all to handle multiple asynchronous operations
            const [userIdentifier, userresources, coins, notifications] = await Promise.all([
                getUserIdByUUID(userId),
                getUserResources(userId, db),
                getUserCoins(userId, db),
                getNotification(userId, db)
            ]);

            // Use Promise.all to handle multiple asynchronous operations
            const [userServersCount, userServers] = await Promise.all([
                getUserServersCount(userIdentifier),
                getUserServers(userIdentifier)
            ]);

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
                notifications  // Pass the notifications array
            });
        } catch (error) {
            console.error('Error fetching data:', error);
            return res.redirect('/?error=Please Login Again.');
        }
    });
});


}