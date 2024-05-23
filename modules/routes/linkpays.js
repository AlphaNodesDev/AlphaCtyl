
module.exports.load = async function (
    express, session, passport, version, DiscordStrategy, bodyParser, figlet,
    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT, WEBSOCKET_PORT, DOMAIN, theme, randomstring,
    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
    updateUserCoins, fetchAllocations
) {
    // Create tables if they do not exist
    await db.run(`CREATE TABLE IF NOT EXISTS dailylinkpays (user_id TEXT PRIMARY KEY, total INTEGER)`);
    await db.run(`CREATE TABLE IF NOT EXISTS lvlimitdate (user_id TEXT PRIMARY KEY, timestamp INTEGER)`);

    const lpcodes = {};
    const cooldowns = {};

    function generateUserCode() {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < 8; i++) {
            code += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return code;
    }

    app.get('/extra/linkpays/generate', async (req, res) => {
        if (!req.session.user || !req.session.user.pterodactyl_id) {
            return res.redirect('/index');
        }

        if (cooldowns[req.session.user.id] && cooldowns[req.session.user.id] > Date.now()) {
            return res.redirect('/linkvertise');
        } else if (cooldowns[req.session.user.id]) {
            delete cooldowns[req.session.user.id];
        }

        const userCode = generateUserCode();
        lpcodes[req.session.user.id] = {
            code: userCode,
            generated: Date.now(),
            redeemed: false
        };

        const link = `${settings.website.domain}/extra/linkpays/redeem/${userCode}`;
        const alias = generateUserCode();

        try {
            const response = await fetch(`https://linkpays.in/api?api=${settings.linkpays.apiKey}&url=${encodeURIComponent(link)}&alias=AlphaCtyl${alias}`);
            const data = await response.json();
            if (response.ok) {
                res.json({ link: data.shortenedUrl });
                console.log(`${req.session.user.username} generated a linkpays link: `, link);
            } else {
                console.error('Error generating linkpays.io link:', data);
                res.status(500).json({ error: 'linkpaysERROR' });
            }
        } catch (error) {
            console.error('Error generating linkpays.io link:', error);
            res.status(500).json({ error: 'LINKPAYSERROR' });
        }
    });

    app.get('/extra/linkpays/redeem/:code', async (req, res) => {
        if (!req.session.user || !req.session.user.pterodactyl_id) {
            return res.redirect('/');
        }

        if (cooldowns[req.session.user.id] && cooldowns[req.session.user.id] > Date.now()) {
            return res.redirect('/extra');
        } else if (cooldowns[req.session.user.id]) {
            delete cooldowns[req.session.user.id];
        }

        const userId = req.session.user.pterodactyl_id;
        const code = req.params.code;
        if (!code) {
            return res.send('<body style="background-color: #1b1c1d;"><center><h1 style="color: white">Error Code: HCLP001</h1><br><h2 style="color: white">You can get more information about this code on our <a style="color: white" href="https://discord.gg/CvqRH9TrYK">support</a> server!</h2></center>');
        }
        const usercode = lpcodes[req.session.user.id];
        if (!usercode) return res.redirect('/extra');
        if (usercode.code !== code) return res.redirect('/extra');
        if (usercode.redeemed) return res.redirect('/extra');

        usercode.redeemed = true;

        if (((Date.now() - usercode.generated) / 1000) < settings.linkpays.minTimeToComplete) {
            return res.send('<body style="background-color: #1b1c1d;"><center><h1 style="color: white">Error Code: HCLP002</h1><br><h2 style="color: white">You can get more information about this code on our <a style="color: white" href="https://discord.gg/CvqRH9TrYK">support</a> server!</h2></center>');
        }

        cooldowns[req.session.user.id] = Date.now() + settings.linkpays.cooldown * 60 * 1000;

        const getDailyLinkPaysStmt = db.prepare(`SELECT total FROM dailylinkpays WHERE user_id = ?`);
        getDailyLinkPaysStmt.get(req.session.user.id, async (err, row) => {
            if (err) {
                console.error('Error querying dailylinkpays:', err);
                return res.redirect('/extra');
            }
            if (!row) {
                const insertStmt = db.prepare(`INSERT INTO dailylinkpays (user_id, total) VALUES (?, ?)`);
                insertStmt.run(req.session.user.id, 1, (err) => {
                    if (err) console.error('Error inserting into dailylinkpays:', err);
                });
                insertStmt.finalize();
            } else {
                const updateStmt = db.prepare(`UPDATE dailylinkpays SET total = total + 1 WHERE user_id = ?`);
                updateStmt.run(req.session.user.id, (err) => {
                    if (err) console.error('Error updating dailylinkpays:', err);
                });
                updateStmt.finalize();
            }
            getDailyLinkPaysStmt.finalize();
        });

        const coins = await getUserCoins(userId, db);
        const newCoins = coins + settings.linkpays.coins;
        await updateUserCoins(userId, newCoins, db);

        res.redirect('/extra?success=SUCCESSLINKPAYS');
    });
};
