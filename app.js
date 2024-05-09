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
const authorNameAscii = figlet.textSync('By: AbhiRam', figletOptions);
const packageserver = settings.packages.list.default.servers;
const packagecpu = settings.packages.list.default.cpu;
const packageram = settings.packages.list.default.ram;
const packagedisk = settings.packages.list.default.disk;
const packageport = settings.packages.list.default.ports;
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
});


const pages = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`)).pages;



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

            const pteroUser = await registerPteroUser(username, email, password, firstName, lastName);
            const userId = pteroUser.attributes.uuid;

            await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [username, email, password, firstName, lastName, userId]);
            
            req.session.user = { pterodactyl_id: userId, username }; 

            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.send('Error registering user.');
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
        res.render(pages[page]);
    });
});

// Protect routes that require authentication
function requireLogin(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.redirect('/');
    }
}


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.error('Error destroying session:', err);
        } else {
            res.redirect('/');
        }
    });
});


const { getUserIdByUUID, getUserServersCount } = require('./api/getPteroServers.js'); // Import the functions to fetch user identifier and servers count

router.get('/dashboard', async (req, res) => {
    try {


        // Get the user's Pterodactyl ID from the session
        const userId = req.session.user.pterodactyl_id;
        

        // Fetch user identifier based on UUID
        const userIdentifier = await getUserIdByUUID(userId);



        // Fetch user servers count using the user's identifier
        const userServersCount = await getUserServersCount(userIdentifier);

        // Render the dashboard template with user details and server count
        res.render('dashboard', { user: req.session.user, userServersCount, AppName: AppName, AppLogo: AppImg, packageserver, packagecpu, packageram, packagedisk, packageport });
    } catch (error) {

        res.render('index', { error: 'Please Login Again' }); 

    }
});



// Import a library for generating random passwords
const randomstring = require('randomstring');

// DiscordLogin 
passport.use(new DiscordStrategy({
    clientID: '1238183875050475540',
    clientSecret: 'FjcrqMvSu4dHwtBH-UaS0EvUrC-DVEKi',
    callbackURL: `${DOMAIN}:${PORT}/discord/callback`,
    scope: ['identify', 'email'],
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if the user already exists in the database
        db.get('SELECT * FROM users WHERE email = ?', [profile.email], async (err, row) => {
            if (err) {
                return done(err);
            }
            // If the user doesn't exist, generate first name, last name, and password, and add them to the database
            if (!row) {
                const firstName = profile.username.split('#')[0]; // Extract first name from Discord username
                const lastName = profile.username.split('#')[0]; // Extract last name from Discord username
                // Generate a random password
                const password = randomstring.generate({
                    length: 10,
                    charset: 'alphanumeric'
                });
                // Register the user in Pterodactyl and get the user ID
                const pteroUser = await registerPteroUser(profile.username, profile.email, password, firstName, lastName);
                const userId = pteroUser.attributes.uuid;
                // Insert user details into the database
                await db.run('INSERT INTO users (username, email, password, first_name, last_name, pterodactyl_id) VALUES (?, ?, ?, ?, ?, ?)', [profile.username, profile.email, password, firstName, lastName, userId]);
                // Pass the user profile to the passport done function
                return done(null, profile);
            }
            // If the user already exists, return their profile
            return done(null, row);
        });
    } catch (error) {
        return done(error);
    }
}));


// Serialize and deserialize user
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Define routes for authentication
app.get('/discord', passport.authenticate('discord'));
app.get('/discord/callback', passport.authenticate('discord', { failureRedirect: '/' }), (req, res) => {
    // Retrieve user details from the database using their email obtained from the Discord profile
    db.get('SELECT * FROM users WHERE email = ?', [req.user.email], (err, row) => {
        if (err) {
            console.error('Error retrieving user details:', err);
            return res.redirect('/');
        }
        // Set req.session.user to the user row
        req.session.user = row;
        // Redirect to the dashboard
        res.redirect('/dashboard');
    });
});
