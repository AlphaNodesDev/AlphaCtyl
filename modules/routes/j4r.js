module.exports.load = async function (
    express, session, passport, version, DiscordStrategy, bodyParser, figlet,
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, theme, randomstring,
    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
    updateUserCoins, fetchAllocations
) {
    await db.run(`CREATE TABLE IF NOT EXISTS j4r_joins (user_id TEXT, server_id TEXT, PRIMARY KEY (user_id, server_id))`);

    async function fetchData(url, options) {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(url, options);
        
        if (!response.ok) {
            if (response.status === 404) {
                const errorData = await response.json();
                if (errorData.message === "Unknown Member") {
                    throw new Error("Unknown Member");
                } else if (errorData.message === "Unknown Guild") {
                    throw new Error("Unknown Guild");
                }
            }
            const errorText = await response.text();
            throw new Error(`Error: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        return response.json();
    }
    
    app.get('/j4r/:server_id', async (req, res) => {
        if (!req.session.user || !req.session.user.pterodactyl_id) {
            return res.redirect('/');
        }

        const userId = req.session.user.pterodactyl_id;
        const serverId = req.params.server_id;
        const discordId = req.session.user.discord_id;

        const checkJoinStmt = db.prepare(`SELECT 1 FROM j4r_joins WHERE user_id = ? AND server_id = ?`);
        checkJoinStmt.get(userId, serverId, async (err, row) => {
            if (err) {
                console.error('Error querying j4r_joins:', err);
                return res.redirect('/j4r?error=Internal Server Error');
            }

            if (row) {
                return res.redirect('/j4r?alert=Already joined this server and claimed rewards.');
            }

            try {
                const response = await fetchData(`https://discord.com/api/v10/guilds/${serverId}/members/${discordId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bot ${settings.discord.bot.token}`
                    }
                });

                const insertJoinStmt = db.prepare(`INSERT INTO j4r_joins (user_id, server_id) VALUES (?, ?)`);
                insertJoinStmt.run(userId, serverId, async (err) => {
                    if (err) {
                        console.error('Error inserting into j4r_joins:', err);
                        return res.redirect('/j4r');
                    }

                    const serverConfig = settings.j4r.ads.find(ad => ad.id === serverId);
                    if (!serverConfig) {
                        return res.redirect('/j4r?alert=Invalid server ID.');
                    }

                    const newCoins = serverConfig.coins;
                    try {
                        db.run(`UPDATE users SET coins = coins + ? WHERE pterodactyl_id = ?`, [newCoins, userId], (err) => {
                            if (err) {
                                console.log(`Error updating coins for user ${userId}: ${err.message}`);
                            }
                        });
                        res.redirect(`/j4r?success=You have successfully joined the server and earned ${newCoins} coins!`);
                    } catch (err) {
                        console.error('Error updating user coins:', err);
                        res.redirect('/j4r?alert=Failed to update coins.');
                    }
                });
                insertJoinStmt.finalize();

            } catch (error) {
                if (error.message === "Unknown Member") {
                    return res.redirect('/j4r?alert=Bruhh, you haven’t joined the server yet! Join the server first, I’m watching you... 👀');
                } else if (error.message === "Unknown Guild") {
                    return res.redirect('/j4r?alert=It seems like there’s nobody in the server to verify that you joined. Please contact the admin to send someone (or maybe a bot) to the server for verification. Maybe they went out for a coffee break? ☕');
                } else {
                    console.error('Error fetching Discord membership:', error);
                    return res.redirect('/j4r?alert=Failed to verify Discord membership.');
                }
            }
        });
        checkJoinStmt.finalize();
    });
};
