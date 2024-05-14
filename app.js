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




db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT, pterodactyl_id TEXT, servers INTEGER DEFAULT 0, ports INTEGER DEFAULT 0, ram INTEGER DEFAULT 0, disk INTEGER DEFAULT 0, cpu INTEGER DEFAULT 0, coins INTEGER DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS youtube (id INTEGER, yt_link TEXT)");

});

const pagesConfig = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`));
const pages = pagesConfig.pages;
const oauthPages = pagesConfig.oauth;




const { registerPteroUser } = require('./api/getPteroUser.js');

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




Object.keys(pages).forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.render(pages[page], { AppName: AppName, AppLogo: AppImg});
    });
});


//oauth pages only
Object.keys(oauthPages).forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.render(oauthPages[page], { AppName: AppName, AppLogo: AppImg});
    });
});


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            res.redirect('/');
        }
    });
});


const { getUserIdByUUID, getUserServersCount } = require('./api/getPteroServers.js'); 
const { getUserCoins } = require('./api/getuserCoins.js');
const { getUserResources } = require('./api/getuseresources.js');
// Then use this function inside your route handlers
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

            // Close the database connection
            db.close();
        } catch (error) {
            console.error(error.message);
            res.render("index", { error: "Please Login Again" });
        }
    });
});


//Discord Login


const randomstring = require('randomstring');


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
            
            if (!row) {
                const firstName = profile.username.split('#')[0]; 
                const lastName = profile.username.split('#')[0]; 
                
                const password = randomstring.generate({
                    length: 10,
                    charset: 'alphanumeric'
                });
                
                const pteroUser = await registerPteroUser(profile.username, profile.email, password, firstName, lastName);
                const userId = pteroUser.attributes.uuid;
                
                await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [profile.username, profile.email, password, firstName, lastName, userId]);
                
                return done(null, profile);
            }
            
            return done(null, row);
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

const { updatePasswordInPanel } = require('./api/updatePasswordInPanel.js'); 

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

        // Render the settings view with success message and new password
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





//Afk page 

const WebSocket = require('ws');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Map to store active connections for each user and page
const activeConnections = new Map();



// Function to update user's coins in the database
function updateUserCoins(userId, reward) {
    db.run(`UPDATE users SET coins = coins + ${reward} WHERE pterodactyl_id = ?`, [userId], (err) => {
        if (err) {
            console.error('Error updating user coins:', err);
        } 
    });
}



wss.on('connection', function connection(ws, req) {
    // Parse user ID and page from query parameters
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const userId = urlParams.get('userId');
    const page = urlParams.get('page');

    // Function to handle new WebSocket connection
    function handleNewConnection(userId, page) {
        // Check if the user already has active connections
        if (activeConnections.has(userId)) {
            const pageSet = activeConnections.get(userId);
            // Check if the user's active connections include the current page
            if (pageSet.has(page)) {
                // Close the WebSocket connection for duplicate page
                ws.close();
                return false; // Indicate duplicate connection
            } else {
                // Add the current page to the user's active connections
                pageSet.add(page);
            }
        } else {
            // Initialize a new set for the user's active connections
            activeConnections.set(userId, new Set([page]));
        }
        return true; // Indicate successful connection
    }

    // Handle new WebSocket connection
    const isNewConnection = handleNewConnection(userId, page);

    // If it's not a new connection (i.e., duplicate), close the WebSocket connection
    if (!isNewConnection) {
        return;
    }

    // Handle WebSocket messages
    ws.on('message', function incoming(message) {

        const reward = settings.afk.coins;
        updateUserCoins(userId, reward);
    });

    // Handle WebSocket connection close
    ws.on('close', function close() {
        // Remove the closed WebSocket connection from the user's active connections
        const pageSet = activeConnections.get(userId);
        if (pageSet) {
            pageSet.delete(page);
            if (pageSet.size === 0) {
                // If the user has no active connections left, remove the user entry from the map
                activeConnections.delete(userId);
            }
        }
    });
});







//YouTube Reward 
router.get('/watchvideo', async (req, res) => {
    try {
        // Retrieve YouTube links from settings
        const youtubeLinks = settings?.youtube?.links;
        
        // Check if there are any YouTube links defined in settings
        if (!youtubeLinks || youtubeLinks.length === 0) {
            return res.status(400).send('No YouTube links found in settings.');
        }

        const userId = req.session.user.pterodactyl_id;
        const coins = await getUserCoins(userId, db);

        // Execute SQL query to check if the user has watched any videos
        const watchedVideos = await new Promise((resolve, reject) => {
            db.all('SELECT yt_link FROM youtube WHERE id = ?', [userId], (err, rows) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(rows.map(row => row.yt_link));
            });
        });

        // Filter out watched videos from available links
        const availableLinks = youtubeLinks.filter(link => !watchedVideos.includes(link));

        if (availableLinks.length === 0) {
            // No available unwatched links
            return res.render("youtube", { error: "You have watched all available videos.", user: req.session.user, AppName: AppName, AppLogo: AppImg, coins, ads, pterodactyldomain });
        }

        // Select a random unwatched link
        const randomIndex = Math.floor(Math.random() * availableLinks.length);
        const randomLink = availableLinks[randomIndex];

        // Render the youtube.ejs view with the selected link
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
router.post('/insertlink', async (req, res) => {
    try {
        const userId = req.body.userId;
        const youtubeLink = req.body.link;

        // Insert the link into the database with the user's ID
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















router.post('/createserver', async (req, res) => {
    try {
        const  userId = req.session.user.pterodactyl_id;
        const uuid = await getUserIdByUUID(userId);
        const userIdentifier = await getUserIdByUUID(userId);
        const userResources = await getUserResources(userId, db);
        // Get user's servers count
        const userServersCount = await getUserServersCount(userIdentifier);

        // Calculate available resources after considering packages
        const availableServers = (userResources.row.servers + packageserver) - userServersCount.count;
        const availableCpu = (userResources.row.cpu + packagecpu) - (userServersCount.totalCPU ) ;
        const availableRam = (userResources.row.ram + packageram) - (userServersCount.totalRAM );
        const availableDisk = (userResources.row.disk + packagedisk) - (userServersCount.totalDisk ) ;
        const availablePorts = (userResources.row.ports + packageport) - userServersCount.totalPorts ;

        // Get the posted values from the form
        const { name, cpu, ram, disk, port } = req.body; // Assuming the input fields are named 'cpu', 'ram', 'disk', and 'port'

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
        
        // Get the egg key posted from the form
        const eggKey = req.body.egg; // Assuming the name attribute in the form is 'eggKey'
        const locationKey = req.body.locations
        // Retrieve the egg configuration based on the selected egg key
        const eggConfig = settings.eggs[eggKey];
        const locationsConfig = settings.locations[locationKey];
        // Define the server configuration using the retrieved egg configuration
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

        // Make the POST request to create the server
        const response = await fetch(`${settings.pterodactyl.domain}api/application/servers`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}` // Replace 'apikey' with your actual API key
            },
            body: JSON.stringify(serverConfig)
        });

        // Check if the request was successful
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






