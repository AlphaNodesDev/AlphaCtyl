const express = require('express');
const session = require('express-session');
const passport = require('passport');
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
const pterodactyldomain = settings.pterodactyl.domain



const db = new sqlite3.Database(DB_FILE_PATH, (err) => {
    if (err) {
        console.log(chalk.red('Error connecting to SQLite database:', err.message));
    } else {
        console.log(chalk.cyan('-->','Database Connection ok'));
    }
});

app.listen(PORT, () => {
    console.log(chalk.red("================================================================"));
    console.log(chalk.green(appNameAscii));
    console.log(chalk.yellow(authorNameAscii));
    console.log(chalk.red("================================================================"));
    console.log(chalk.red(' ',"-------------------------------"));
    console.log(chalk.green('|',`Server is running on port ${PORT}`,'|'));
    console.log(chalk.red(' ',"-------------------------------"));
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
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT, pterodactyl_id TEXT, servers INTEGER DEFAULT 0, ports INTEGER DEFAULT 0, ram INTEGER DEFAULT 0, disk INTEGER DEFAULT 0, cpu INTEGER DEFAULT 0, coins INTEGER DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS youtube (id INTEGER, yt_link TEXT)");

});
//Load Theme 
const pagesConfig = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`));
//load normal pages
const pages = pagesConfig.pages;
//load oauth pages
const oauthPages = pagesConfig.oauth;



//includes from other api
const { registerPteroUser } = require('./api/getPteroUser.js');
const { getUserIdByUUID, getUserServersCount } = require('./api/getPteroServers.js'); 
const { getUserCoins } = require('./api/getuserCoins.js');
const { getUserResources } = require('./api/getuseresources.js');
const { updatePasswordInPanel } = require('./api/updatePasswordInPanel.js'); 




//render appname and logo to oauth pages only
Object.keys(oauthPages).forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.render(oauthPages[page], { AppName: AppName, AppLogo: AppImg});
    });
});

//register process
router.post('/register', async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;
    try {
        db.get('SELECT * FROM users WHERE email = ? OR username = ?', [email, username], async (err, row) => {
            if (err) {
                console.error(err);
                return res.send('Error checking user existence.');
            }
            if (row) {
                if (row.email === email) {
                    return res.render('register', { error: 'Email already exists' });
                } else if (row.username === username) {
                    return res.render('register', { error: 'Username already exists' });
                }
            }
            try {
                const pteroUser = await registerPteroUser(username, email, password, firstName, lastName);
                const userId = pteroUser.attributes.uuid;
                await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [username, email, password, firstName, lastName, userId]);
                req.session.user = { pterodactyl_id: userId, username }; 
                res.redirect('/dashboard');
            } catch (registerError) {
                console.error('Error registering user in Pterodactyl:', registerError);
                res.render('register', { error: 'Error registering user.' });
            }
        });
    } catch (error) {
        console.error('Error in registration route:', error);
        res.render('register', { error: 'Error registering user.' });
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
            res.render('index', { error: 'Invalid email or password' }); 
        }
    });
});


app.use('/', router);

//logout process
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            res.redirect('/');
        }
    });
});






// render values to all pages
Object.keys(pages).forEach((page) => {
    router.get(`/${page}`, async (req, res) => {
        try {
            if (!req.session.user || !req.session.user.pterodactyl_id) {
                return res.render("index", { error: "Please Login Again" });
            }

            const userId = req.session.user.pterodactyl_id;

            // Connect to the SQLite database
            const db = new sqlite3.Database(DB_FILE_PATH);

            // Get user identifier using pterodactyl ID
            const userIdentifier = await getUserIdByUUID(userId);
            const userresources = await getUserResources(userId, db);
            // Get user's servers count
            const userServersCount = await getUserServersCount(userIdentifier);

            // Get user's coins
            const coins = await getUserCoins(userId, db);

            res.render(pages[page], {
                user: req.session.user,
                userresources,
                userServersCount,
                AppName: AppName,
                AppLogo: AppImg,
                packageserver,
                packagecpu,
                packageram,
                packagedisk,
                packageport,
                ads,
                coins,
                afktimer,
                pterodactyldomain,
                settings: settings

                
            });
            db.close();
        } catch (error) {
            console.error(error.message);
            res.render("index", { error: "Please Login Again" });
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




//Discord Login process
app.get('/discord', passport.authenticate('discord'));
app.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    db.get('SELECT * FROM users WHERE email = ?', [req.user.email], (err, row) => {
        if (err) {
            console.error('Error retrieving user details:', err);
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
        console.log('User Identifier:', userIdentifier);
        const newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });
        await updatePasswordInPanel(userIdentifier, newPassword, req.session.user.email, req.session.user.username, req.session.user.first_name, req.session.user.last_name);
        const uuid = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);
        res.render("settings", { 
            successMessage: 'Pterodactyl Password Reset', 
            value: 'Your New Password is <bold>' + newPassword + '</bold>', 
            user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            ads,
            pterodactyldomain,
            coins 
        });
        console.log('updating password in panel:');
    } catch (error) {
        res.status(500).send('Error resetting password');
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
            console.error('Error updating user coins:', err);
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
            return res.status(400).send('No YouTube links found in settings.');
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
            return res.render("youtube", { error: "You have watched all available videos.", user: req.session.user, AppName: AppName, AppLogo: AppImg, coins, ads, pterodactyldomain });
        }
        const randomIndex = Math.floor(Math.random() * availableLinks.length);
        const randomLink = availableLinks[randomIndex];
        res.render('youtube', { 
            link: randomLink,
            user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            coins,
            ads,
            pterodactyldomain
        });
    } catch (error) {
        console.error('Error while processing /watchvideo:', error);
        res.status(500).send('Internal server error.');
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
                return res.status(500).send('Task Failed');
            }
            const reward = settings.youtube.coins;
            updateUserCoins(userId, reward);
            res.status(200).send('Coins Rewarded');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error.');
    }
});











//function to create server
router.post('/createserver', async (req, res) => {
    try {
        const  userId = req.session.user.pterodactyl_id;
        const uuid = await getUserIdByUUID(userId);
        const userIdentifier = await getUserIdByUUID(userId);
        const userResources = await getUserResources(userId, db);
        const userServersCount = await getUserServersCount(userIdentifier);
        const availableServers = (userResources.row.servers + packageserver) - userServersCount.count;
        const availableCpu = (userResources.row.cpu + packagecpu) - (userServersCount.totalCPU ) ;
        const availableRam = (userResources.row.ram + packageram) - (userServersCount.totalRAM );
        const availableDisk = (userResources.row.disk + packagedisk) - (userServersCount.totalDisk ) ;
        const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts ;
        const { name, cpu, ram, disk, port } = req.body; 
         if (availableServers <= 0) {
            return res.status(400).send('You don\'t have enough available servers to create the server.');
        }
        if (cpu > availableCpu) {
            return res.status(400).send('You don\'t have enough available CPU to create the server.');
        }
        if (ram >  availableRam) {
            return res.status(400).send('You don\'t have enough available RAM to create the server.');
        }
        if (disk > availableDisk) {
            return res.status(400).send('You don\'t have enough available disk space to create the server.');
        }
        if (port >  availablePorts) {
            return res.status(400).send('You don\'t have enough available ports to create the server.');
        }
        const eggKey = req.body.egg; 
        const locationKey = req.body.locations
        const eggConfig = settings.eggs[eggKey];
        const locationsConfig = settings.locations[locationKey];
        const serverConfig = {
            name: name,
            user: uuid,
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
                databases: 4,
                backups: 4,
                allocations: port
            },
            allocation: {
                default: locationsConfig.id
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
            console.log('Server created:', serverData);
            res.status(201).send('Server created successfully.');
        } else {
            const errorData = await response.json();
            console.error('Error creating server:', errorData);
            res.status(500).send('Error creating server.');
        }
    } catch (error) {
        console.error('Error creating server:', error);
        res.status(500).send('Internal server error.');
    }
});











