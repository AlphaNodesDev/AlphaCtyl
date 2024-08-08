module.exports.load = async function (
    express, session, passport, version, DiscordStrategy, bodyParser, figlet,
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, theme, randomstring,
    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
    updateUserCoins, fetchAllocations
) {

    // Function to sanitize the username
    function sanitizeUsername(username) {
        // Remove any leading or trailing non-alphanumeric characters
        logNormalToFile(`Sanitizing username: ${username}`);
        return username.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    }

    // Discord Login Strategy
    passport.use(new DiscordStrategy({
        clientID: settings.discord.oauth2.clientID,
        clientSecret: settings.discord.oauth2.clientSecret,
        callbackURL: settings.discord.oauth2.callbackpath,
        scope: ['identify', 'email', 'guilds.join'],
    }, async (accessToken, refreshToken, profile, done) => {
        try {
            logNormalToFile(`Attempting to authenticate user: ${profile.username}`);
            db.get('SELECT * FROM users WHERE email = ?', [profile.email], async (err, row) => {
                if (err) {
                    logErrorToFile(`Database error: ${err.message}`);
                    return done(err);
                }
                if (row) {
                    // Check the user's status
                    if (row.status === 1) {
                        if (settings.discord.bot.joinguild.enabled === true) {
                            try {
                                const discordUserId = profile.id;
                                await joinDiscordGuild(discordUserId, accessToken);
                                logNormalToFile(`User added to Discord guild: ${profile.username}`);
                                if (settings.discord.bot.giverole.enabled === true) {
                                    assignDiscordRole(discordUserId);
                                    logNormalToFile(`Role assigned to user: ${profile.username}`);
                                }
                            } catch (error) {
                                logErrorToFile(`Error adding user to guild: ${error.response.data}`);
                                return done(new Error('Failed to add user to guild.'));
                            }
                        }
                        return done(null, { ...row, accessToken });
                    } else {
                        logNormalToFile(`User account is restricted: ${profile.email}`);
                        return done(null, false, { message: 'Your account is restricted or timed out by admin.' });
                    }
                }
                logNormalToFile(`User not found in database, registering new user: ${profile.email}`);
                const firstName = profile.username.split('#')[0];
                const lastName = profile.username.split('#')[0];
                const password = randomstring.generate({
                    length: 10,
                    charset: 'alphanumeric'
                });
                const sanitizedUsername = sanitizeUsername(profile.username);

                const pteroUser = await registerPteroUser(sanitizedUsername, profile.email, password, firstName, lastName);
                if (!pteroUser) {
                    logErrorToFile(`Error: Failed to register user in panel. Connection Error`);
                    return done(new Error('Failed to register user in panel.'));
                }
                const userId = pteroUser.attributes ? pteroUser.attributes.uuid : pteroUser.uuid;
                if (settings.discord.logging.status === true && settings.discord.logging.actions.user.signup === true) {
                    const message = `User logged in: ${profile.username}`;
                    const webhookUrl = settings.discord.logging.webhook;
                    const color = 0x00FF00;
                    sendDiscordWebhook(webhookUrl, 'User Logged In', message, color, 'AlphaCtyl');
                    logNormalToFile(`Discord webhook sent for user login: ${profile.username}`);
                }
                if (settings.discord.bot.joinguild.enabled === true) {
                    try {
                        const discordUserId = profile.id;
                        await joinDiscordGuild(discordUserId, accessToken);
                        if (settings.discord.bot.giverole.enabled === true) {
                            assignDiscordRole(discordUserId);
                            logNormalToFile(`Role assigned to user: ${profile.username}`);
                        }
                    } catch (error) {
                        logErrorToFile(`Error adding user to guild: ${error.response.data}`);
                        return done(new Error('Failed to add user to guild.'));
                    }
                }

                await db.run('INSERT INTO users (id, discord_id, username, email, password, first_name, last_name, pterodactyl_id, avatar, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                    [profile.id, profile.id, sanitizedUsername, profile.email, password, firstName, lastName, userId, profile.avatar, 1]); // Set default status to 1
                logNormalToFile(`New user registered: ${profile.email}`);

                return done(null, { ...profile, accessToken });
            });
        } catch (error) {
            logErrorToFile(`Authentication error: ${error.message}`);
            return done(error);
        }
    }));

    passport.serializeUser((user, done) => {
        done(null, user);
    });

    passport.deserializeUser((user, done) => {
        done(null, user);
    });


    const getClientIp = (req) => {
        return (req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0].trim();
    };
    const checkWhitelist = (req, res, next) => {
    const clientIp = getClientIp(req);
    const whitelist = settings.discord.whitelist;
    const isMaintenanceMode = settings.webserver.Maintainance;

    if (isMaintenanceMode) {
        if (whitelist.includes(clientIp)) {
            next(); // Allow access
        } else {
            console.log(`IP ${clientIp} is not whitelisted, access denied.`);
            res.status(403).send('Access denied: Your IP is not whitelisted.');
        }
    } else {
        next(); 
    }
};

// Discord login process with whitelist check
app.get('/discord', checkWhitelist, (req, res) => {
    passport.authenticate('discord')(req, res);
});


    app.get('/discord/callback', (req, res, next) => {
        passport.authenticate('discord', async (err, user, info) => {
            if (err) {
                logErrorToFile(`OAuth callback error: ${err.message}`);
                return res.redirect('/?error=auth_failed');
            }
            if (!user) {
                return res.redirect('/?error=auth_failed');
            }

            req.logIn(user, async (loginErr) => {
                if (loginErr) {
                    logErrorToFile(`Login error: ${loginErr.message}`);
                    return res.redirect('/?error=auth_failed');
                }

                const { email } = user;
                

                const db = new sqlite3.Database(DB_FILE_PATH);

                db.get('SELECT * FROM users WHERE email = ?', [email], async (dbErr, row) => {
                    if (dbErr) {
                        logErrorToFile(`Error retrieving user details: ${dbErr.message}`);
                        // Render the homepage with an error message
                        return res.render('index', { error: 'An error occurred while retrieving user details.' }); // Ensure the view name is 'index'
                    }

                    // Check the user's status
                    if (row && row.status === 1) {
                        req.session.user = row;
                        res.redirect('/dashboard');
                    } else {
                        logNormalToFile(`User account is restricted: ${email}`);
                        // Render the homepage with an error message
                        res.render('index', { error: 'Your account is restricted or timed out by admin.' }); // Ensure the view name is 'index'
                    }
                });

                db.close();
            });
        })(req, res, next);
    });

    // Error handling middleware
    app.use((err, req, res, next) => {
        if (err.name === 'TokenError') {
            logErrorToFile(`TokenError: ${err.message}`);
            res.redirect('/?error=auth_failed');
        } else {
            logErrorToFile(`General error: ${err.message}`);
            next(err);
        }
    });

};
