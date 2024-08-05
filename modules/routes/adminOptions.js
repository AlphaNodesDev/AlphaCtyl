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
};
