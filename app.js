const express = require('express');
const session = require('express-session');
const passport = require('passport');
const axios = require('axios');
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



async function fetchImport() {
    return (await import('node-fetch')).default;
}


app.listen(PORT, async () => {
    const fetch = await fetchImport();
    console.log(chalk.red("================================================================"));
    console.log(chalk.green(appNameAscii));
    console.log(chalk.yellow(authorNameAscii));
    console.log(chalk.red("================================================================"));
    console.log(chalk.red("-------------------------------"));
    console.log(chalk.cyan("Software Version:", version));    
    console.log(chalk.cyan("Config Version:", settings.version,));
    console.log(chalk.red("-------------------------------"));

    console.log(chalk.red(' ',"-------------------------------"));
    console.log(chalk.green('|',`Server is running on port ${PORT}`,'|'));
    console.log(chalk.red(' ',"-------------------------------"));
});

const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    
    if (err) {
        console.log(chalk.red('Error connecting to SQLite database:', err.message));
    } else {
        console.log(chalk.cyan('-->','Database Connection ok'));
    }
});



app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
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




//Log Erro
function logErrorToFile(message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile(LOG_FILE_PATH, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err.message);
        }
    });
}

function logNormalToFile(message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile(NORMAL_LOG_FILE_PATH, logMessage, (err) => {
        if (err) {
            console.error('Error writing to normal log file:', err.message);
        }
    });
}


function parseLogs(data) {
    const logsByDate = {};
    const logLines = data.split('\n');
    logLines.forEach(line => {
        const match = line.match(/^(.*?) - (.*)$/);
        if (match) {
            const date = match[1].split('T')[0]; // Extract date part
            if (!logsByDate[date]) {
                logsByDate[date] = [];
            }
            logsByDate[date].push(match[2]);
        }
    });
    return logsByDate;
}
function parseNormalLogs(data) {
    const logsByDate = {};
    const logLines = data.split('\n');
    logLines.forEach(line => {
        const match = line.match(/^(.*?) - (.*)$/);
        if (match) {
            const date = match[1].split('T')[0]; // Extract date part
            if (!logsByDate[date]) {
                logsByDate[date] = [];
            }
            logsByDate[date].push(match[2]);
        }
    });
    return logsByDate;
}
function sendDiscordWebhook(webhookUrl, message, color) {
    axios.post(webhookUrl, {
        embeds: [{
            description: message,
            color: color
        }]
    }).catch(error => {
        console.error('Error sending webhook:', error);
    });
}

// Function to join a Discord guild
async function joinDiscordGuild(userId, accessToken) {
    const guildId = settings.discord.bot.joinguild.guildid[0]; // Assuming a single guild ID
    const botToken = settings.discord.bot.token;
    try {
        await axios.put(`https://discord.com/api/guilds/${guildId}/members/${userId}`, {
            access_token: accessToken
        }, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`User ${userId} added to guild ${guildId}`);
    } catch (error) {
        console.error('Error adding user to guild:', error);
    }
}

// Function to assign a role to a user in a Discord guild
async function assignDiscordRole(userId, guildId, roleId) {
    const botToken = settings.discord.bot.token;
    try {
        await axios.put(`https://discord.com/api/guilds/${guildId}/members/${userId}/roles/${roleId}`, {}, {
            headers: {
                'Authorization': `Bot ${botToken}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`Role ${roleId} assigned to user ${userId} in guild ${guildId}`);
    } catch (error) {
        console.error('Error assigning role to user:', error);
    }
}

//register process
router.post('/register', async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    try {
        db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, row) => {
            if (err) {
                console.error(err);
                logErrorToFile(`Error Registering  User: ${err.message}`);
                return res.send('Error checking user existence.');
            }
            if (row) {
                if (row.email === email) {
                    return res.redirect('/register?error=Email already exists.');

                } else if (row.username === username) {
                    return res.redirect('/register?error=Username already exists.');
                }
            }
            try {
                const pteroUser = await registerPteroUser(username, email, password, firstName, lastName);
                const userId = pteroUser.attributes.uuid;
                await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [username, email, password, firstName, lastName, userId]);
                req.session.user = { pterodactyl_id: userId, username }; 
  
              res.redirect('/dashboard');
            } catch (registerError) {
                logErrorToFile(`Error opening database: ${registerError}`);
                return res.redirect('/register?error=Error registering user.');

            }
        });
    } catch (error) {
        logErrorToFile(`Error in registration route: ${error}`);
        return res.redirect('/register?error=Error registering user.');

    }
});




//login process
router.post('/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM users WHERE email = ? AND password = ?', [email, password], (err, row) => {
        if (err) {
            console.error(err);
            res.send('Error authenticating user.');
        } else if (row) {
            req.session.user = row;
            res.redirect('/dashboard');
        } else {
            return res.redirect('/?error=Invalid email or passwordr.');

        }
    });
});
//  

app.use('/', router);

//logout process
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logErrorToFile('Error destroying session:', err);
        } else {
            res.redirect('/');
        }
    });
});






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
    
                            // Query the database to fetch the list of users
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
        try {
            if (!req.session.user || !req.session.user.pterodactyl_id) {
     
                return res.redirect('/?error=Please Login Again.');

            }

            const userId = req.session.user.pterodactyl_id;

            // Connect to the SQLite database
            const db = new sqlite3.Database(DB_FILE_PATH);

            // Get user identifier using pterodactyl ID
            const userIdentifier = await getUserIdByUUID(userId);
            const userresources = await getUserResources(userId, db);
            // Get user's servers count
            const userServersCount = await getUserServersCount(userIdentifier.id);
            const userServers = await getUserServers(userIdentifier.id);

            // Get user's coins
            const coins = await getUserCoins(userId, db);

            res.render(pages[page], {
                user: req.session.user,
                userresources,
                userServersCount,
                userServers,
                AppName: AppName,
                AppLogo: AppImg,
                packageserver,
                packagecpu,
                packageram,
                packagedisk,
                packageport,
                packagedatabase,
                userIdentifier,
                packagebackup,
                ads,
                coins,
                afktimer,
                pterodactyldomain,
                settings: settings

                
            });
            db.close();
        } catch (error) {
            return res.redirect('/?error=Please Login Again.');
        }
    });
});


//Discord Login
passport.use(new DiscordStrategy({
    clientID: settings.discord.clientID,
    clientSecret: settings.discord.clientSecret,
    callbackURL: `${DOMAIN}/discord/callback`,
    scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        db.get('SELECT * FROM users WHERE email = ?', [profile.email], async (err, row) => {
            if (err) {
                return done(err);
            }
            if (row) {
                return done(null, row);
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
            const userId = pteroUser.attributes.uuid;
            await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [profile.username, profile.email, password, firstName, lastName, userId]);
            return done(null, profile);
        });
    } catch (error) {
        return done(error); 
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});




// Discord login process
app.get('/discord', passport.authenticate('discord'));
app.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), async (req, res) => {
    const { email, id: discordUserId, username: discordUsername, accessToken } = req.user;

    db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
        if (err) {
            logErrorToFile('Error retrieving user details:', err);
            return res.redirect('/');
        }

        if (settings.discord.logging.status === true && settings.discord.logging.actions.user.signup === true) {
            const message = `User logged in: ${discordUsername}`;
            const webhookUrl = settings.discord.logging.webhook; // Make sure this is set in your settings
            const color = 0x00FF00; // Green color in hexadecimal
            sendDiscordWebhook(webhookUrl, message, color);
        }

        if (settings.discord.bot.joinguild.enabled === true) {
            await joinDiscordGuild(discordUserId, accessToken);


        if (settings.discord.bot.giverole.enabled === true) {
            const guildId = settings.discord.bot.giverole.guildid;
            const roleId = settings.discord.bot.giverole.roleid;
            await assignDiscordRole(discordUserId, guildId, roleId);
        }
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
         return res.redirect('settings?error=Error resetting password.');

    }
});







//Websocket Config
const WebSocket = require('ws');
const wss = new WebSocket.Server({ port: 8080 });
const activeConnections = new Map();



// Function to update user's coins in the database
function updateUserCoins(userId, reward) {
    db.run(`UPDATE users SET coins = coins + ${reward} WHERE pterodactyl_id = ?`, [userId], (err) => {
        if (err) {
            logErrorToFile(`Error updating coins for user ${userId}: ${err.message}`);
        } 
    });
}




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
        updateUserCoins(userId, reward);
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
            updateUserCoins(userId, reward);
            res.status(200).send('Coins Rewarded');
            return res.redirect('/youtube?success=Coins Rewarded');

        });
    } catch (error) {
        console.error(error);
        return res.redirect('/youtube?error=Internal server error.');

    }
});















async function fetchAllocations(locationId) {
    try {
        // Fetch nodes
        const response = await fetch(`${settings.pterodactyl.domain}/api/application/nodes`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch nodes: ${errorText}`);
        }

        const nodesData = await response.json();
        const nodes = nodesData.data;

        // Find the node matching the location ID
        const node = nodes.find(node => node.attributes.location_id === locationId);

        if (!node) {
            throw new Error('Node not found for the given location ID');
        }

        // Fetch allocations for the node
        const allocationsResponse = await fetch(`${settings.pterodactyl.domain}/api/application/nodes/${node.attributes.id}/allocations`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (!allocationsResponse.ok) {
            const errorText = await allocationsResponse.text();
            throw new Error(`Failed to fetch allocations for the node: ${errorText}`);
        }

        const allocationsData = await allocationsResponse.json();
        const allocations = allocationsData.data;

        // Find the first allocation that is not assigned
        const notAssignedAllocation = allocations.find(allocation => !allocation.attributes.assigned);

        if (!notAssignedAllocation) {
            throw new Error('No unassigned allocation found for the node');
        }

        return notAssignedAllocation.attributes.id;
    } catch (error) {
        console.error('Error fetching allocations:', error);
        throw error;
    }
}



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






//delete ptero server
// Route to handle server deletion
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
            // Server deleted successfully
            return res.redirect('/manage?success=Server deleted successfully.');
        } else {
            // Error deleting server
            return res.redirect('/manage?error=Error deleting server.');
        }
    } catch (error) {
        console.error('Error deleting server:', error);
        return res.redirect('/manage?error=Internal server error.');
    }
});






//pending

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

        // Calculate the costs based on the request
        const costs = {
            servers: servers * settings.store.servers.cost,
            cpu: cpu * settings.store.cpu.cost,
            ram: ram * settings.store.ram.cost,
            disk: disk * settings.store.disk.cost,
            ports: ports * settings.store.ports.cost,
            database: database * settings.store.database.cost,
            backup: backup * settings.store.backup.cost
        };

        // Determine which resource is being purchased
        const selectedResource = Object.keys(req.body).find(key => req.body[key] && req.body[key] !== '0');

        // Check if the selected resource is valid
        if (!selectedResource || !settings.store[selectedResource]) {
            return res.redirect('store?error=Invalid selection.');
        }

        const totalCost = costs[selectedResource];

        if (row.coins < totalCost) {
            return res.redirect('store?error=Not enough coins.');
        }

        // Update the user's coins and resources
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













