const express = require('express');
const session = require('express-session');
const passport = require('passport');
const version = "1.0.0";
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
const figlet = require('figlet');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const chalk = require('chalk');
const path = require('path');
const app = express();
const router = express.Router(); 
const settings = JSON.parse(fs.readFileSync('settings.json'));
const DB_FILE_PATH = settings.database;
const PORT = process.env.PORT || settings.website.port;
const WEBSOCKET_PORT = settings.afk.websocket.port
const DOMAIN = settings.website.domain;
const theme = settings.defaulttheme;
const randomstring = require('randomstring');
const figletOptions = {
    font: 'Standard', 
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true
};
const appNameAscii = figlet.textSync('AlphaCtyl', figletOptions);
const authorNameAscii = figlet.textSync('By: AbhiRam', figletOptions);
const AppName = settings.website.name;
const AppImg = settings.website.logo;
const ads = settings.ads;
const afktimer = settings.afk.timer
const packageserver = settings.packages.list.default.servers;
const packagecpu = settings.packages.list.default.cpu;
const packageram = settings.packages.list.default.ram;
const packagedisk = settings.packages.list.default.disk;
const packageport = settings.packages.list.default.ports;
const packagedatabase = settings.packages.list.default.database;
const packagebackup = settings.packages.list.default.backups;
const pterodactyldomain = settings.pterodactyl.domain
const LOG_FILE_PATH = path.join(__dirname, 'error.log');
const NORMAL_LOG_FILE_PATH = path.join(__dirname, 'normal.log');
const webhookUrl= settings.discord.logging.webhook;
const { Client, GatewayIntentBits } = require('discord.js');
const db = new sqlite3.Database(DB_FILE_PATH);
//Websocket Config
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
const activeConnections = new Map();
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
    ]
});
client.login(settings.discord.bot.token)
    .catch(console.error);
client.on('ready', () => {
    console.log(chalk.red('  ',"-----------------------------"));
    console.log(chalk.red('|',`Logged in as ${client.user.tag}`, '|'));
    console.log(chalk.red('  ', "-----------------------------"));
});
app.listen(PORT, async () => {
    console.log(chalk.red("================================================================"));
    console.log(chalk.green(appNameAscii));
    console.log(chalk.yellow(authorNameAscii));
    console.log(chalk.red("================================================================"));
    console.log(chalk.bgCyanBright('-->', "Software Version:", version));    
    console.log(chalk.bgCyanBright('-->', "Config Version:", settings.version));

    const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
        if (err) {
            console.log(chalk.red('Error connecting to SQLite database:'));
        } else {
            console.log(chalk.blue.bgYellow('-->', 'Database Connection ok'));
        }
    });
    console.log(chalk.red(' ',"-------------------------------"));
    console.log(chalk.green('|', `Server is running on port ${PORT}`, '|'));
    console.log(chalk.red(' ',"-------------------------------"));
});
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, `./themes/${theme}`)));
app.use(session({
    secret: settings.website.secret,
    resave: false,
    saveUninitialized: true
}));
app.use(passport.initialize());
app.use(passport.session());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, `./themes/${theme}`));
// Database table Create
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT, pterodactyl_id TEXT, servers INTEGER DEFAULT 0, ports INTEGER DEFAULT 0, ram INTEGER DEFAULT 0, disk INTEGER DEFAULT 0, cpu INTEGER DEFAULT 0, database INTEGER DEFAULT 0, backup INTEGER DEFAULT 0, coins INTEGER DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS youtube (id INTEGER, yt_link TEXT)");
    db.run(`CREATE TABLE IF NOT EXISTS renewals (id INTEGER PRIMARY KEY AUTOINCREMENT, serverId TEXT NOT NULL,next_renewal DATETIME NOT NULL, status TEXT DEFAULT 'active')`);
  
});
//Load Theme 
const pagesConfig = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`));
//load normal pages
const pages = pagesConfig.pages;
//load oauth pages
const oauthPages = pagesConfig.oauth;
//load admin pages
const adminPages = pagesConfig.admin;
//includes from other api


const { registerPteroUser } = require('./api/getPteroUser.js');
const { getUserIdByUUID, getUserServersCount, getUserServers } = require('./api/getPteroServers.js'); 
const { getUserCoins } = require('./api/getuserCoins.js');
const { getUserResources } = require('./api/getuseresources.js');
const { updatePasswordInPanel } = require('./api/updatePasswordInPanel.js'); 

const { logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs } = require('./functions/saveLogs.js'); 
const { joinDiscordGuild, sendDiscordWebhook, assignDiscordRole } = require('./functions/discordFunctions.js'); 
const { updateUserCoins } = require('./functions/updateUserCoins.js'); 
const { fetchAllocations } = require('./functions/fetchAllocations.js'); 


app.use('/', router);
//logout process
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logErrorToFile('Error destroying session:', err);
        } else {
            res.redirect('/'); 
        }});});

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
            const [userIdentifier , userresources, userServersCount, userServers, coins] = await Promise.all([
                getUserIdByUUID(userId),
                getUserResources(userId, db),
                getUserServersCount(userId),
                getUserServers(userId),
                getUserCoins(userId, db)
  
            ]);

            db.close();

            res.render(pages[page], {
                user: req.session.user,
                WEBSOCKET_PORT,
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
                settings
            });
        } catch (error) {
            console.error('Error fetching data:', error);
            return res.redirect('/?error=Please Login Again.');
        }
    });
});



// Discord Login Strategy
passport.use(new DiscordStrategy({
    clientID: settings.discord.clientID,
    clientSecret: settings.discord.clientSecret,
    callbackURL: `${DOMAIN}/discord/callback`,
    scope: ['identify', 'email', 'guilds.join'], 
}, async (accessToken, refreshToken, profile, done) => {
    try {
        db.get('SELECT * FROM users WHERE email = ?', [profile.email], async (err, row) => {
            if (err) {
                return done(err);
            }
            if (row) {
        if (settings.discord.bot.joinguild.enabled === true) {
            try {
                const discordUserId = profile.id;
                await joinDiscordGuild(discordUserId, accessToken); 
                if (settings.discord.bot.giverole.enabled === true) {

                    assignDiscordRole(discordUserId)
                    }
            } catch (error) {
                logErrorToFile('Error adding user to guild:', error.response.data);
                return res.status(error.response.status || 500).json(error.response.data);
            }
        }
                return done(null, { ...row, accessToken });
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
                sendDiscordWebhook(webhookUrl, message, color);
            }
        if (settings.discord.bot.joinguild.enabled === true) {
            try {
                const discordUserId = profile.id;
                await joinDiscordGuild(discordUserId, accessToken);
                if (settings.discord.bot.giverole.enabled === false) {

                assignDiscordRole(discordUserId)
                }
            } catch (error) {
                logErrorToFile('Error adding user to guild:', error.response.data);
                return res.status(error.response.status || 500).json(error.response.data);
            }
        }
            await db.run('INSERT INTO users (id, username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                [profile.id, profile.username, profile.email, password, firstName, lastName, userId]);

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


        req.session.user = row;
        res.redirect('/dashboard');
    });
});
// Pteropassword reset
router.get('/resetptero', async (req, res) => {
    try {
        const userId = req.session.user.pterodactyl_id;
        const userIdentifier = await getUserIdByUUID(uuid);
        console.log('User Identifier:', userIdentifier.id);
        const newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });
        await updatePasswordInPanel(userIdentifier.id, newPassword, req.session.user.email, req.session.user.username, req.session.user.first_name, req.session.user.last_name);
        const uuid = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);
        res.render("settings", { 
            successMessage: 'Pterodactyl Password Reset', 
            value: 'Your New Password is ' + newPassword + '', 
            user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            ads,
            pterodactyldomain,
            coins 
        });
        console.log('updating password in panel:');
    } catch (error) {  
    logErrorToFile(`Error resetting password in Pterodactyl panel for user:${userId} `);
         return res.redirect('settings?error=Error resetting password.');}});
//Functions To check for websocket connections
wss.on('connection', function connection(ws, req) {
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
    ws.on('message', function incoming(message) {
        const reward = settings.afk.coins;
        updateUserCoins(userId, reward, db);
    });
    ws.on('close', function close() {
        const pageSet = activeConnections.get(userId);
        if (pageSet) {
            pageSet.delete(page);
            if (pageSet.size === 0) {
                activeConnections.delete(userId);
            }
        }
    });
});
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
// Function to Suspend servers 
const checkAndSuspendExpiredServers = async () => {
    if (!settings.store.renewals.status) {
        console.log('Renewals feature is disabled. Skipping check.');
        return;
    }

    try {
        const currentDate = getCurrentDateFormatted();

        const expiredServers = await new Promise((resolve, reject) => {
            db.all(`SELECT serverId FROM renewals WHERE next_renewal < ? AND status = 'active'`, [currentDate], (err, rows) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });

        if (!Array.isArray(expiredServers)) {
            throw new TypeError('Expected an array of expired servers');
        }
        for (const server of expiredServers) {
            try {
                const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${server.serverId}/suspend`, {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.pterodactyl.key}`
                    }
                });
                if (response.ok) {
                    
                    await new Promise((resolve, reject) => {
                        db.run(`UPDATE renewals SET status = 'suspended' WHERE serverId = ?`, [server.serverId], (err) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve();
                            }
                        });
                    });
                } else {
                    const errorMessage = await response.text();
                    console.error(`Error suspending server ${server.serverId}:`, errorMessage);
                }
            } catch (error) {
                console.error(`Error suspending server ${server.serverId}:`, error);
            }
        }
    } catch (error) {
        console.error('Error checking for expired servers:', error);
    }
};
const getCurrentDateFormatted = () => {
    const now = new Date();
    const month = pad(now.getMonth() + 1, 2);
    const day = pad(now.getDate(), 2);
    const year = now.getFullYear();
    const hour = pad(now.getHours(), 2);
    const minute = pad(now.getMinutes(), 2);
    const second = pad(now.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;};

const pad = (num, size) => {
    return ('0' + num).slice(-size);
};

setInterval(checkAndSuspendExpiredServers, 60000);
//functions to renew 
router.get('/renew', async (req, res) => {
    if (!settings.store.renewals.status) {
        return res.redirect('/manage?error=Server renewal feature is currently disabled.');
    }

    try {
        const serverId = req.query.id;
        if (!serverId) {
            return res.redirect('/manage?error=No server ID provided for renewal.');
        }

        const userId = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);

        // Check if user has sufficient coins
        const cost = settings.store.renewals.cost;
        if (coins < cost) {
            return res.redirect('/manage?error=Insufficient coins for renewal.');
        }

const nextRenewalDate = new Date();
nextRenewalDate.setDate(nextRenewalDate.getDate() + settings.store.renewals.days);
nextRenewalDate.setHours(nextRenewalDate.getHours() + settings.store.renewals.hour);
nextRenewalDate.setMinutes(nextRenewalDate.getMinutes() + settings.store.renewals.minute);
const formattedRenewalDate = formatDate(nextRenewalDate);

function formatDate(date) {
    const day = pad(date.getDate(), 2);
    const month = pad(date.getMonth() + 1, 2);
    const year = date.getFullYear();
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;}

await new Promise((resolve, reject) => {
    db.run(
        `UPDATE renewals SET next_renewal = ?, status = 'active' WHERE serverId = ?`,
        [formattedRenewalDate, serverId],
        (err) => {
            if (err) {
                return reject(err);
            }
            resolve();
        }
    );
});
        const unsuspendResponse = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}/unsuspend`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (unsuspendResponse.ok) {
            console.log(`Server ${serverId} unsuspended successfully.`);
        } else {
            const errorMessage = await unsuspendResponse.text();
            console.error(`Error unsuspending server ${serverId}:`, errorMessage);
        }

        await new Promise((resolve, reject) => {
            db.run(
                `UPDATE users SET coins = coins - ? WHERE pterodactyl_id = ?`,
                [cost, userId],
                (err) => {
                    if (err) {
                        return reject(err);
                    }
                    resolve();
                }
            );
        });

        return res.redirect('/manage?success=Server renewed successfully.');
    } catch (error) {
        console.error('Error renewing server:', error);
        return res.redirect('/manage?error=Internal server error.');
    }
});
// Function to create server 
router.post('/createserver', async (req, res) => {
    if (settings.webserver.server_creation === false) {
        return res.redirect('/manage?alert=Sorry, Server Creation Not Enabled');
    } else {
        try {
            const userId = req.session.user.pterodactyl_id;
            const uuid = await getUserIdByUUID(userId);
            const userIdentifier = uuid.id;
            const userResources = await getUserResources(userId, db);
            const userServersCount = await getUserServersCount(userIdentifier);
            const availableServers = (userResources.row.servers + packageserver) - userServersCount.count;
            const availableCpu = (userResources.row.cpu + packagecpu) - userServersCount.totalCPU;
            const availableRam = (userResources.row.ram + packageram) - userServersCount.totalRAM;
            const availableDisk = (userResources.row.disk + packagedisk) - userServersCount.totalDisk;
            const availableDatabase = (userResources.row.database + packagedatabase) - userServersCount.totalDatabase;
            const availablebackup = (userResources.row.backup + packagebackup) - userServersCount.totalBackup;
            const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts;
            const { name, cpu, ram, disk, port, database, backup } = req.body;

            if (availableServers <= 0) {
                return res.redirect('/manage?info=You don\'t have enough available servers to create the server.');
            }
            if (cpu > availableCpu) {
                return res.redirect('/manage?info=You don\'t have enough available CPU to create the server.');
            }
            if (ram > availableRam) {
                return res.redirect('/manage?info=You don\'t have enough available RAM to create the server.');
            }
            if (disk > availableDisk) {
                return res.redirect('/manage?info=You don\'t have enough available disk space to create the server.');
            }
            if (database > availableDatabase) {
                return res.redirect('/manage?info=You don\'t have enough available database to create the server.');
            }
            if (backup > availablebackup) {
                return res.redirect('/manage?info=You don\'t have enough available backup to create the server.');
            }
            if (port > availablePorts) {
                return res.redirect('/manage?info=You don\'t have enough available ports to create the server.');
            }
            const eggKey = req.body.egg;
            const locationKey = req.body.locations;
            const eggConfig = settings.eggs[eggKey];
            const locationsConfig = settings.locations[locationKey];
            const locationId = locationsConfig.id;
            let allocationId;
            try {
                allocationId = await fetchAllocations(locationId);
            } catch (error) {
                if (error.message.includes('Node not found')) {
                    return res.redirect('/manage?error=No nodes found for the given location.');
                }
                if (error.message.includes('No unassigned allocation found')) {
                    return res.redirect('/manage?error=All nodes are full for the given location.');
                }
                return res.redirect('/manage?error=Error fetching allocations.');
            }
            const serverConfig = {
                name: name,
                user: uuid.id,
                egg: eggConfig.info.egg,
                docker_image: eggConfig.info.docker_image,
                startup: eggConfig.info.startup,
                environment: eggConfig.info.environment,
                limits: {
                    memory: ram,
                    swap: 0,
                    disk: disk,
                    io: 10,
                    cpu: cpu
                },
                feature_limits: {
                    databases: database,
                    backups: backup,
                    allocations: port
                },
                allocation: {
                    default: allocationId
                }
            };
            const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers`, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.pterodactyl.key}`
                },
                body: JSON.stringify(serverConfig)
            });
            if (response.ok) {
                const serverData = await response.json();
                const serverId = serverData.attributes.id;
  // Calculate next renewal date based on settings
const nextRenewalDate = new Date();
nextRenewalDate.setDate(nextRenewalDate.getDate() + settings.store.renewals.days);
nextRenewalDate.setHours(nextRenewalDate.getHours() + settings.store.renewals.hour);
nextRenewalDate.setMinutes(nextRenewalDate.getMinutes() + settings.store.renewals.minute);
const formattedRenewalDate = formatDate(nextRenewalDate);
// Function to format date as dd:mm:yy:h:m:s
function formatDate(date) {
    const day = pad(date.getDate(), 2);
    const month = pad(date.getMonth() + 1, 2);
    const year = date.getFullYear();
    const hour = pad(date.getHours(), 2);
    const minute = pad(date.getMinutes(), 2);
    const second = pad(date.getSeconds(), 2);
    return `${day}:${month}:${year}:${hour}:${minute}:${second}`;
}
                await db.run(
                    `INSERT INTO renewals (serverId, next_renewal) VALUES (?, ?)`,
                    [serverId, formattedRenewalDate]
                );
                console.log(formattedRenewalDate);

                if (settings.discord.logging.status === true && settings.discord.logging.actions.user.create_server === true) {
                    const message = `User Created Server:\nName: ${name}\nCPU: ${cpu} cores\nRAM: ${ram} MB\nDisk: ${disk} MB\nDatabases: ${database}\nBackups: ${backup}\nPorts: ${port}`;
                    const color = 0x00FF00; // Green color in hexadecimal
                    sendDiscordWebhook(webhookUrl, message, color);
                }
                return res.redirect('/manage?success=Server created successfully.');
            } else {
                const errorMessage = await response.text();
                console.error('Error creating server:', errorMessage);
                return res.redirect('/manage?error=Error creating server.');
            }
        } catch (error) {
            console.error('Internal server error:', error);
            return res.redirect('/manage?error=Internal server error.');
        }
    }
});
// delete ptero server
router.get('/delete', async (req, res) => {
    const serverId = req.query.id; // Retrieve the server ID from the query string
    if (!serverId) {
        return res.redirect('/manage?error=No server ID provided.');
    }
    try {
        const response = await fetch(`${settings.pterodactyl.domain}/api/application/servers/${serverId}`, {
            method: 'DELETE',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });
        if (response.status === 204) {
            // Server deleted successfully from Pterodactyl
            try {
                await db.run(`DELETE FROM renewals WHERE serverId = ?`, [serverId]);
                return res.redirect('/manage?success=Server and renewal record deleted successfully.');
            } catch (dbError) {
                console.error('Error deleting renewal record:', dbError);
                return res.redirect('/manage?error=Server deleted but failed to delete renewal record.');
            }
        } else {
            // Error deleting server
            return res.redirect('/manage?error=Error deleting server.');
        }
    } catch (error) {
        console.error('Error deleting server:', error);
        return res.redirect('/manage?error=Internal server error.');
    }
});
//Update user servers
app.post('/updateserver', (req, res) => {
    const serverId = parseInt(req.body.id);
    const serverIndex = servers.findIndex(s => s.id === serverId);
    if (serverIndex !== -1) {
      servers[serverIndex] = { ...servers[serverIndex], ...req.body };
      res.redirect('/');
    } else {
      res.status(404).send('Server not found');
    }
  });
// Buy Resources  
router.post('/byresources', (req, res) => {
    const { servers, cpu, ram, disk, ports, database, backup } = req.body;

    db.get('SELECT * FROM users WHERE pterodactyl_id = ?', [req.session.user.pterodactyl_id], (err, row) => {
        if (err) {
            console.error(err);
            res.send('Error authenticating user.');
            return;
        }
        if (!row) {
            return res.redirect('store?error=Invalid User.');
        }
        const costs = {
            servers: servers * settings.store.servers.cost,
            cpu: cpu * settings.store.cpu.cost,
            ram: ram * settings.store.ram.cost,
            disk: disk * settings.store.disk.cost,
            ports: ports * settings.store.ports.cost,
            database: database * settings.store.database.cost,
            backup: backup * settings.store.backup.cost
        };
        const selectedResource = Object.keys(req.body).find(key => req.body[key] && req.body[key] !== '0');
        if (!selectedResource || !settings.store[selectedResource]) {
            return res.redirect('store?error=Invalid selection.');
        }
        const totalCost = costs[selectedResource];
        if (row.coins < totalCost) {
            return res.redirect('store?error=Not enough coins.');
        }
        const updates = {
            coins: row.coins - totalCost,
            [`${selectedResource}`]: (row[`${selectedResource}`] || 0) + parseInt(req.body[selectedResource]) * settings.store[selectedResource].per
        };
        db.run(
            'UPDATE users SET coins = ?, ' + `${selectedResource}` + ' = ? WHERE pterodactyl_id = ?', 
            [updates.coins, updates[`${selectedResource}`], req.session.user.pterodactyl_id], 
            (updateErr) => {
                if (updateErr) {
                    console.error(updateErr);
                    res.send('Error updating resources.');
                } else {
                    req.session.user = { ...row, ...updates };
                    res.redirect('/store?success=Successfully purchased.');
                }
            }
        );
    });
});
router.post('/addresources', (req, res) => {
    const { username, amount, resourceType } = req.body;
    const allowedResources = ['coins', 'cpu', 'ram', 'disk', 'servers', 'ports', 'database', 'backup'];

    if (!allowedResources.includes(resourceType)) {
        return res.status(400).send('Invalid resource type.');
    }
    const query = `UPDATE users SET ${resourceType} = ? WHERE username = ?`;
    db.run(query, [amount, username], (updateErr) => {
        if (updateErr) {
            console.error(updateErr);
            return res.status(500).send('Error updating resources.');
        }
        db.get('SELECT * FROM users WHERE username = ?', [username], (err, row) => {
            if (err) {
                console.error(err);
                return res.status(500).send('Error fetching updated user data.');
            }
            req.session.user = { ...row };
            res.redirect('/resources?success=Successfully purchased.');
        });
    });
});






// Route to generate Linkvertise link
const lvcodes = {};
const cooldowns = {};
app.get('/lv/get', async (req, res) => {
    if (!req.session.user.pterodactyl_id) return res.redirect("/login");

    let referer = req.headers.referer;
    console.log(`Referer: ${referer}`); 

    if (!referer) {
        return res.send('An error occurred with your browser! Referer header is missing.');
    }

    referer = referer.toLowerCase();
    if (referer.includes('?')) referer = referer.split('?')[0];

    if (!referer.endsWith('/lv') && !referer.endsWith('/lv/')) {
        return res.send('An error occurred with your browser! Invalid referer.');
    }

    if (!referer.endsWith('/')) referer += '/';

    const code = makeid(12);
    const lvurl = linkvertise(settings.linkvertise.userid, referer + `redeem/${code}`);

    lvcodes[req.session.userinfo.id] = {
        code: code,
        user: req.session.userinfo.id,
        generated: Date.now()
    };

    res.redirect(lvurl);
});

// Utility functions
function linkvertise(userid, link) {
    var base_url = `https://link-to.net/${userid}/${Math.random() * 1000}/dynamic`;
    var href = base_url + "?r=" + btoa(encodeURI(link));
    return href;
}

function btoa(str) {
    var buffer;

    if (str instanceof Buffer) {
        buffer = str;
    } else {
        buffer = Buffer.from(str.toString(), "binary");
    }
    return buffer.toString("base64");
}

function makeid(length) {
    let result = '';
    let characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let charactersLength = characters.length;
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
}
