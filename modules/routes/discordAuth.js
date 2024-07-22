module.exports.load = async function (
    express, session, passport, version, DiscordStrategy, bodyParser, figlet, 
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, 
    WEBSOCKET_PORT, DOMAIN, theme, randomstring, figletOptions, appNameAscii, 
    authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu, 
    packageram, packagedisk, packageport, packagedatabase, packagebackup, 
    pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH, webhookUrl, 
    db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, 
    adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs, 
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, 
    getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, 
    getUserResources, updatePasswordInPanel, updateUserCoins, fetchAllocations
) {
    // Discord Login Strategy
    passport.use(new DiscordStrategy({
        clientID: settings.discord.oauth2.clientID,
        clientSecret: settings.discord.oauth2.clientSecret,
        callbackURL: settings.discord.oauth2.callbackpath,
        scope: ['identify', 'email', 'guilds.join'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            db.get('SELECT * FROM users WHERE email = ?', [profile.email], async (err, row) => {
                if (err) {
                    return done(err);
                }
                if (row) {
                    // Check the user's status
                    if (row.status === 1) {
                        if (settings.discord.bot.joinguild.enabled === true) {
                            try {
                                const discordUserId = profile.id;
                                await joinDiscordGuild(discordUserId, accessToken);
                                if (settings.discord.bot.giverole.enabled === true) {
                                    assignDiscordRole(discordUserId);
                                }
                            } catch (error) {
                                logErrorToFile('Error adding user to guild:', error.response.data);
                                return done(new Error('Failed to add user to guild.'));
                            }
                        }
                        return done(null, { ...row, accessToken });
                    } else {
                        // User is restricted from logging in
                        return done(null, false, { message: 'Your account is restricted or timed out by admin.' });
                    } 
                }
                const firstName = profile.username.split('#')[0];
                const lastName = profile.username.split('#')[0];
                const password = randomstring.generate({
                    length: 10,
                    charset: 'alphanumeric'
                });
                const pteroUser = await registerPteroUser(profile.username, profile.email, password, firstName, lastName);
                if (!pteroUser) {
                    logErrorToFile(`Error: Failed to register user in panel. Connection Error`);
                    return done(new Error('Failed to register user in panel.'));
                }
                const userId = pteroUser.attributes ? pteroUser.attributes.uuid : pteroUser.uuid;
                if (settings.discord.logging.status === true && settings.discord.logging.actions.user.signup === true) {
                    const message = `User logged in: ${profile.username}`;
                    const webhookUrl = settings.discord.logging.webhook;
                    const color = 0x00FF00;
                    sendDiscordWebhook(webhookUrl, 'User Logined', message, color, 'AlphaCtyl');
                }
                if (settings.discord.bot.joinguild.enabled === true) {
                    try {
                        const discordUserId = profile.id;
                        await joinDiscordGuild(discordUserId, accessToken);
                        if (settings.discord.bot.giverole.enabled === false) {
                            assignDiscordRole(discordUserId);
                        }
                    } catch (error) {
                        logErrorToFile('Error adding user to guild:', error.response.data);
                        return done(new Error('Failed to add user to guild.'));
                    }
                }
                await db.run('INSERT INTO users (id, discord_id, username, email, password, first_name, last_name, pterodactyl_id, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [profile.id, profile.id, profile.username, profile.email, password, firstName, lastName, userId, profile.avatar, 1]); // Set default status to 1
                return done(null, { ...profile, accessToken });
            });
        } catch (error) {
            return done(error);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });

    // Discord login process
    app.get('/discord', passport.authenticate('discord'));
    app.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
        const { email, id: discordUserId, accessToken } = req.user;

        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                logErrorToFile('Error retrieving user details:', err);
                return res.redirect('/');
            }

            // Check the user's status
            if (row.status === 1 || row.status === 0) {
                req.session.user = row;
                res.redirect('/dashboard');
            } else {
                res.redirect('/?error=Your account is restricted or timed out by admin.');
            }
        });
    });


};
