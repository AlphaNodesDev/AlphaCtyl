
module.exports.load = async function (express, session, passport ,version, DiscordStrategy,bodyParser, figlet
    ,sqlite3,fs,chalk,path,app,router,settings,DB_FILE_PATH,PORT,WEBSOCKET_PORT,DOMAIN,theme,randomstring,
    figletOptions,appNameAscii,authorNameAscii,AppName,AppImg,ads,afktimer,packageserver,packagecpu,
    packageram,packagedisk,packageport,packagedatabase,packagebackup,pterodactyldomain,LOG_FILE_PATH,NORMAL_LOG_FILE_PATH,
    webhookUrl,db,WebSocket,wss,activeConnections,pagesConfig,pages,oauthPages,adminPages,logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole ,registerPteroUser,getUserIdByUUID, getUserServersCount, getUserServers ,getUserCoins,getUserResources,updatePasswordInPanel,
    updateUserCoins,fetchAllocations
) {

    app.ws('/afk/ws', (ws, req) => {
        const urlParams = new URLSearchParams(req.url.split('?')[1]);
        const userId = urlParams.get('userId');
        const page = urlParams.get('page');
    
        function handleNewConnection(userId, page) {
            if (activeConnections.has(userId)) {
                const pageSet = activeConnections.get(userId);
                if (pageSet.has(page)) {
                    ws.close();
                    return false; 
                } else {
                    pageSet.add(page);
                }
            } else {
                activeConnections.set(userId, new Set([page]));
            }
            return true;
        }
    
        const isNewConnection = handleNewConnection(userId, page);
        if (!isNewConnection) {
            return;
        }
    
        const rewardInterval = setInterval(() => {
            const reward = settings.afk.coins;
            updateUserCoins(userId, reward, db);
            ws.send(JSON.stringify({ type: 'coin', amount: reward }));
        }, settings.afk.timer * 1000); // Timer in seconds
    
        ws.on('close', function close() {
            clearInterval(rewardInterval);
            const pageSet = activeConnections.get(userId);
            if (pageSet) {
                pageSet.delete(page);
                if (pageSet.size === 0) {
                    activeConnections.delete(userId);
                }
            }
        });
    });
    

}