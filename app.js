const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const bodyParser = require('body-parser');
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
const figlet = require('figlet');
const axios = require('axios');


const figletOptions = {
    font: 'Standard', 
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true
};
const appNameAscii = figlet.textSync('AlphaCtyl', figletOptions);
const AppName = settings.website.name;
const AppImg = settings.website.logo;
const ads = settings.ads;
const afktimer = settings.afk.timer
const authorNameAscii = figlet.textSync('By: AbhiRam', figletOptions);
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

//Pass Values To Pages 

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

            // Get user's servers count
            const userServersCount = await getUserServersCount(userIdentifier);

            // Execute SQL query to get user's coins
            db.get('SELECT coins FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
                if (err) {
                    console.error(err.message);
                    return res.render("index", { error: "Database Error. Please Try Again" });
                }

                const coins = row ? row.coins : 0; 

                res.render(pages[page], {
                    user: req.session.user,
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
                    pterodactyldomain
                });
            });
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
router.get('/resetptero', async (req, res) => {
    try {
        const uuid = req.session.user.pterodactyl_id;
        console.log('UUID:', uuid);
        
        const userIdentifier = await getUserIdByUUID(uuid);
        console.log('User Identifier:', userIdentifier);
        
        const newPassword = randomstring.generate({
            length: 10,
            charset: 'alphanumeric'
        });

        await updatePasswordInPanel(userIdentifier, newPassword, req.session.user.email, req.session.user.username, req.session.user.first_name, req.session.user.last_name);
        
        // Render the settings view with success message and new password
        res.render("settings", { 
            successMessage: 'Pterodactyl Password Reset', 
            value: 'Your New Password is <bold>' + newPassword + '</bold>', 
            user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            ads,
            pterodactyldomain 
        });
        console.log('updating password in panel:');
    } catch (error) {
        res.status(500).send('Error resetting password');
    }
});

async function updatePasswordInPanel(userIdentifier, newPassword, email, username, first_name, last_name) {
    const apiUrl = `${settings.pterodactyl.domain}api/application/users/${userIdentifier}`;
    const requestBody = {
        email: email,
        username: username,
        first_name: first_name,
        last_name: last_name,
        language: "en", 
        password: newPassword 
    };
    
    try {
        await axios.patch(apiUrl, requestBody, {
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });
    } catch (error) {
        console.error('Error updating password in panel:', error);
        if (error.response && error.response.data) {
            console.error('Response data:', error.response.data);
        }
        res.status(500).send('Error updating password');
    }
}




//Afk page 

const WebSocket = require('ws');

// Create WebSocket server
const wss = new WebSocket.Server({ port: 8080 });

// Map to store active connections for each user and page
const activeConnections = new Map();



// Function to update user's coins in the database
function updateUserCoins(userId) {
    db.run('UPDATE users SET coins = coins + 1 WHERE id = ?', [userId], (err) => {
        if (err) {
            console.error('Error updating user coins:', err);
        } else {
            console.log('User coins updated successfully');
        }
    });
}

// WebSocket server event handlers

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
        // Update user's coins when a message is received
        updateUserCoins(userId);
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
// Define route for '/watchvideo'
router.get('/watchvideo', async (req, res) => {
    try {
        // Retrieve YouTube links from settings
        const youtubeLinks = settings?.youtube?.links;
        
        // Check if there are any YouTube links defined in settings
        if (!youtubeLinks || youtubeLinks.length === 0) {
            return res.status(400).send('No YouTube links found in settings.');
        }

        let randomLink;
        const userId = req.session.user.pterodactyl_id;
        let coins = 0;

        // Execute SQL query to check if the link already exists in the database
        const existingLink = await new Promise((resolve, reject) => {
            db.get('SELECT yt_link FROM youtube WHERE id = ?', [userId], (err, row) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(row ? row.yt_link : null);
            });
        });
        db.get('SELECT coins FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
        // If the existing link is found, select another random link until it's unique
        const availableLinks = youtubeLinks.filter(link => link !== existingLink);
        if (availableLinks.length === 0) {
            // No available links
            return res.render("youtube", { error: "No links available" ,user: req.session.user,
            AppName: AppName,
            AppLogo: AppImg,
            coins,
            ads,
            pterodactyldomain});
        }

        do {
            const randomIndex = Math.floor(Math.random() * availableLinks.length);
            randomLink = availableLinks[randomIndex];
        } while (existingLink === randomLink);

        // Execute SQL query to get user's coins

            if (err) {
                console.error(err.message);
                return res.render("index", { error: "Database Error. Please Try Again",user: req.session.user,
                AppName: AppName,
                AppLogo: AppImg,
                coins,
                ads,
                pterodactyldomain});
            }
            coins = row ? row.coins : 0;

            // Render the youtube.ejs view with the selected link and user's coins
            res.render('youtube', { 
                link: randomLink,
                user: req.session.user,
                AppName: AppName,
                AppLogo: AppImg,
                coins,
                ads,
                pterodactyldomain
            });
        });
    } catch (error) {
        console.error('Error while processing /watchvideo:', error);
        res.status(500).send('Internal server error.');
    }
});




// Route for inserting YouTube link into the database
const youtubeLinks = settings?.youtube?.links;
// Set the Permissions-Policy header in your Express app
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
                return res.status(500).send('Failed to insert link into the database.');
            }
            res.status(200).send('Link inserted successfully.');
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Internal server error.');
    }
});


