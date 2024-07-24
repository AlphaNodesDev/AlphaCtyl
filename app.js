const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
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
const afktimer = settings.afk.timer;
const packageserver = settings.packages.list.default.servers;
const packagecpu = settings.packages.list.default.cpu;
const packageram = settings.packages.list.default.ram;
const packagedisk = settings.packages.list.default.disk;
const packageport = settings.packages.list.default.ports;
const packagedatabase = settings.packages.list.default.database;
const packagebackup = settings.packages.list.default.backups;
const pterodactyldomain = settings.pterodactyl.domain;
const LOG_FILE_PATH = path.join(__dirname, 'error.log');
const NORMAL_LOG_FILE_PATH = path.join(__dirname, 'normal.log');
const webhookUrl = settings.discord.logging.webhook;
const {ActivityType , Client, GatewayIntentBits, MessageActionRow, MessageButton} = require('discord.js');

const db = new sqlite3.Database(DB_FILE_PATH);

// Websocket Config
const WebSocket = require('ws');
const http = require('http');

const server = http.createServer(app);

const activeConnections = new Map();

// WebSocket Setup with express-ws
const expressWs = require('express-ws')(app);
const wss = expressWs.getWss();  

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

if(settings.discord.bot.enabled){
    client.login(settings.discord.bot.token).catch(console.error);
}


client.on('ready', async () => {
    console.log(chalk.red('  ', "-----------------------------"));
    console.log(chalk.red('|', `Logged in as ${client.user.tag}`, '|'));
    console.log(chalk.red('  ', "-----------------------------"));

    if (settings.discord.bot.name && client.user.username !== settings.discord.bot.name) {
        try {
            const user = await client.user.setUsername(settings.discord.bot.name);
            console.log(`Bot username set to ${user.username}`);
        } catch (error) {
            console.error('Error setting bot username:', error);
        }
    } 

    if (settings.discord.bot.description) {
        try {
   

            await client.user.setPresence({
                activities: [{ name: settings.discord.bot.description,    
                         type: ActivityType[settings.discord.bot.activityType], 
                    url: 'https://www.youtube.com/shorts/pDCTUzN7Jzo'  }],
                status: settings.discord.bot.status
            });

        } catch (error) {
            console.error('Error setting bot presence:', error);
        }
    } else {
        console.log('Bot description not set.');
    }
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
app.use(flash());
// Database table creation
db.serialize(() => {
    db.run("CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY,avatar TEXT,discord_id TEXT, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT, pterodactyl_id TEXT, status INTEGER DEFAULT 1, servers INTEGER DEFAULT 0, ports INTEGER DEFAULT 0, ram INTEGER DEFAULT 0, disk INTEGER DEFAULT 0, cpu INTEGER DEFAULT 0, database INTEGER DEFAULT 0, backup INTEGER DEFAULT 0, coins INTEGER DEFAULT 0)");
    db.run("CREATE TABLE IF NOT EXISTS youtube (id INTEGER, yt_link TEXT)");
    db.run(`CREATE TABLE IF NOT EXISTS renewals (id INTEGER PRIMARY KEY AUTOINCREMENT, serverId TEXT NOT NULL, next_renewal DATETIME NOT NULL, status TEXT DEFAULT 'active')`);
});

// Load Theme 
const pagesConfig = JSON.parse(fs.readFileSync(`./themes/${theme}/pages.json`));
// Load normal pages
const pages = pagesConfig.pages;
// Load OAuth pages
const oauthPages = pagesConfig.oauth;
// Load admin pages
const adminPages = pagesConfig.admin;

// Import API functions
const { registerPteroUser } = require('./modules/api/getPteroUser.js');
const { getUserIdByUUID, getUserServersCount, getUserServers } = require('./modules/api/getPteroServers.js'); 
const { getUserCoins } = require('./modules/api/getuserCoins.js');
const { getUserResources } = require('./modules/api/getuseresources.js');
const { updatePasswordInPanel } = require('./modules/api/updatePasswordInPanel.js'); 
const { logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs } = require('./modules/functions/saveLogs.js'); 
const { joinDiscordGuild, sendDiscordWebhook, assignDiscordRole } = require('./modules/functions/discordFunctions.js'); 
const { updateUserCoins } = require('./modules/functions/updateUserCoins.js'); 
const { fetchAllocations } = require('./modules/functions/fetchAllocations.js'); 

app.use('/', router);

// Logout process
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            logErrorToFile('Error destroying session:', err);
        } else {
            res.redirect('/'); 
        }
    });
});

// Load Route Modules
const routesDirectory = path.join(__dirname, 'modules/routes');
const routesFiles = fs.readdirSync(routesDirectory).filter(file => file.endsWith('.js'));

const loadRouteModules = routesFiles.map(file => {
    return new Promise((resolve, reject) => {
        try {
            const routesModule = require(path.join(routesDirectory, file));
            if (typeof routesModule.load === 'function') {
                console.log(`Loading API module: ${file}`);
                routesModule.load(express, session, passport, version, DiscordStrategy, bodyParser, figlet,
                    sqlite3, fs, chalk, path, app, router, settings, DB_FILE_PATH, PORT,  theme, randomstring,
                    figletOptions, appNameAscii, authorNameAscii, AppName, AppImg, ads, afktimer, packageserver, packagecpu,
                    packageram, packagedisk, packageport, packagedatabase, packagebackup, pterodactyldomain, LOG_FILE_PATH, NORMAL_LOG_FILE_PATH,
                    webhookUrl, db, WebSocket, wss, activeConnections, pagesConfig, pages, oauthPages, adminPages, logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs,
                    joinDiscordGuild, sendDiscordWebhook, assignDiscordRole, registerPteroUser, getUserIdByUUID, getUserServersCount, getUserServers, getUserCoins, getUserResources, updatePasswordInPanel,
                    updateUserCoins, fetchAllocations).then(() => {
                        console.log(chalk.blue.bgGreen(`Loaded module: ${file}`));
                        resolve();
                    }).catch(error => {
                        console.error(`Error loading module ${file}:`, error);
                        reject(error);
                    });
            } else {
                console.warn(`The module ${file} does not export a 'load' function.`);
                resolve();
            }
        } catch (error) {
            console.error(`Error loading module ${file}:`, error);
            reject(error);
        }
    });
});

// Load and initialize plugins
const pluginsDirectory = path.join(__dirname, 'plugins');
const pluginFiles = fs.readdirSync(pluginsDirectory).filter(file => file.endsWith('.js'));

pluginFiles.forEach(file => {
    const pluginPath = path.join(pluginsDirectory, file);
    const plugin = require(pluginPath);

    if (typeof plugin === 'function') {
        try {
            plugin(client, db); // Initialize plugin with the client and db
            console.log(`Loaded plugin: ${file}`);
        } catch (error) {
            console.error(`Error initializing plugin ${file}:`, error);
        }
    } else {
        console.warn(`The plugin ${file} does not export a function.`);
    }
});


Promise.all([loadRouteModules]).then(() => {
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
}).catch(error => {
    console.error('Failed to load all modules:', error);
});
