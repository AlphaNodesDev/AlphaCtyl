const express = require('express');
const session = require('express-session');
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
const theme = settings.defaulttheme;
const figlet = require('figlet');
const figletOptions = {
    font: 'Standard', // Choose the font you want
    horizontalLayout: 'default',
    verticalLayout: 'default',
    width: 80,
    whitespaceBreak: true
};
const appNameAscii = figlet.textSync('AlphaCtyl', figletOptions);
const AppName = settings.website.name;
const AppImg = settings.website.logo;
const authorNameAscii = figlet.textSync('By: AbhiRam', figletOptions);
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


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, `./themes/${theme}`));




db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT)");
});


const pages = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`)).pages;


function requireLogin(req, res, next) {
    if (req.session && req.session.user) {
        return next();
    } else {
        res.redirect('/');
    }
}

const { registerPteroUser } = require('./api/getPteroUser.js');
router.post('/register', async (req, res) => {
    const { username, email, password, firstName, lastName } = req.body;

    try {
        // Check if the username already exists in your database
        db.get('SELECT * FROM users WHERE email = ?', [email], async (err, row) => {
            if (err) {
                console.error(err);
                return res.send('Error checking user existence.');
            }

            if (row) {
                return res.render('register', { error: 'Email already exists' });
            }

            // Register the user in the Pterodactyl panel
            const pteroUser = await registerPteroUser(username, email, password, firstName, lastName);

            // If registration in Pterodactyl is successful, proceed to register the user in your database
            await db.run('INSERT INTO users (username, email, password, first_name, last_name) VALUES (?, ?, ?, ?, ?)', [username, email, password, firstName, lastName]);
            req.session.user = { username }; // Set the user information in the session
            res.redirect('/dashboard');
        });
    } catch (error) {
        console.error('Error registering user:', error);
        res.send('Error registering user.');
    }
});



router.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ? AND password = ?', [username, password], (err, row) => {
        if (err) {
            console.error(err);
            res.send('Error authenticating user.');
        } else if (row) {
            req.session.user = row;
            res.redirect('/dashboard');
        } else {
            res.render('index', { error: 'Invalid username or password' }); 
        }
    });
});


app.use('/', router);


app.get('/dashboard', requireLogin, (req, res) => {
    res.render('dashboard', { user: req.session.user, AppName: AppName, AppLogo: AppImg }); // Pass the user object and appNameAscii to the template
});


Object.keys(pages).forEach(page => {
    app.get(`/${page}`, (req, res) => {
        res.render(pages[page]);
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

