
module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations,addNotification
){
//YouTube Reward 
router.get('/watchvideo', async (req, res) => {
    try {
        const youtubeLinks = settings?.youtube?.links;
        if (!youtubeLinks || youtubeLinks.length === 0) {
            return res.redirect('/youtube?error=No YouTube links found in settings.');
        }
        const userId = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);
        const watchedVideos = await new Promise((resolve, reject) => {
            db.all('SELECT yt_link FROM youtube WHERE id = ?', [userId], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => row.yt_link));
            });
        });
        const availableLinks = youtubeLinks.filter(link => !watchedVideos.includes(link));
        if (availableLinks.length === 0) {
            return res.redirect('/youtube?error=You have watched all available videos.');
        }
        const randomIndex = Math.floor(Math.random() * availableLinks.length);
        const randomLink = availableLinks[randomIndex];
        res.render('player', { 
            link: randomLink,
            user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            coins,
            ads,
            pterodactyldomain
        });
    } catch (error) {
        logErrorToFile('Error while processing /watchvideo:', error);
        return res.redirect('/youtube?error=Internal server error.');

    }
});
app.use((req, res, next) => {
    res.setHeader('Permissions-Policy', 'document-domain "self" https://www.youtube.com');
    next();
});
//function to insert link after the user watch the video
router.post('/insertlink', async (req, res) => {
    try {
        const userId = req.body.userId;
        const youtubeLink = req.body.link;
        db.run('INSERT INTO youtube (id, yt_link) VALUES (?, ?)', [userId, youtubeLink], (err) => {
            if (err) {
                return res.redirect('/youtube?error=Task Failed.');

            }
            const reward = settings.youtube.coins;
            updateUserCoins(userId, reward, db);
            res.status(200).send('Coins Rewarded');

        });
    } catch (error) {
        console.error(error);
        return res.redirect('/youtube?error=Internal server error.');

    }
});

}