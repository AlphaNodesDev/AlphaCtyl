const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('database.sqlite');

function columnExists(tableName, columnName) {
    return new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tableName});`, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const columnFound = rows && rows.find(row => row.name === columnName);
                resolve(!!columnFound);
            }
        });
    });
}
async function addColumnIfNotExists(tableName, columnName, columnDefinition) {
    const exists = await columnExists(tableName, columnName);
    if (!exists) {
        db.run(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`, err => {
            if (err) {
                console.error(`Failed to add column ${columnName} to table ${tableName}:`, err.message);
            } else {
                console.log(`Successfully added column ${columnName} to table ${tableName}.`);
            }
        });
    } else {
        console.log(`Column ${columnName} already exists in table ${tableName}.`);
    }
}

function createTableIfNotExists(query, tableName) {
    db.run(query, err => {
        if (err) {
            console.error(`Failed to create table ${tableName}:`, err.message);
        } else {
            console.log(`Successfully ensured table ${tableName} exists.`);
        }
    });
}

db.serialize(async () => {
    createTableIfNotExists(
        "CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, avatar TEXT, discord_id TEXT, username TEXT, password TEXT, email TEXT, first_name TEXT, last_name TEXT, pterodactyl_id TEXT, api_key TEXT, status INTEGER DEFAULT 1, servers INTEGER DEFAULT 0, ports INTEGER DEFAULT 0, ram INTEGER DEFAULT 0, disk INTEGER DEFAULT 0, cpu INTEGER DEFAULT 0, database INTEGER DEFAULT 0, backup INTEGER DEFAULT 0, coins INTEGER DEFAULT 0)",
        "users"
    );
    await addColumnIfNotExists("users", "api_key", "TEXT");
    await addColumnIfNotExists("users", "last_login", "TEXT");


    createTableIfNotExists(
        "CREATE TABLE IF NOT EXISTS notifications (id INTEGER, notification TEXT)",
        "notifications"
    );

    createTableIfNotExists(
        `CREATE TABLE IF NOT EXISTS coupons (id INTEGER PRIMARY KEY AUTOINCREMENT,code TEXT UNIQUE NOT NULL,coins INTEGER NOT NULL,servers INTEGER DEFAULT 0,cpu INTEGER DEFAULT 0,ram INTEGER DEFAULT 0,disk INTEGER DEFAULT 0,backup INTEGER DEFAULT 0,ports INTEGER DEFAULT 0,database INTEGER DEFAULT 0,created_at DATETIME DEFAULT CURRENT_TIMESTAMP,updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
        "coupons"
    );

    createTableIfNotExists(
        "CREATE TABLE IF NOT EXISTS youtube (id INTEGER, yt_link TEXT)",
        "youtube"
    );

    createTableIfNotExists(
        `CREATE TABLE IF NOT EXISTS renewals (id INTEGER PRIMARY KEY AUTOINCREMENT, serverId TEXT NOT NULL, next_renewal DATETIME NOT NULL, status TEXT DEFAULT 'active')`,
        "renewals"
    );

    createTableIfNotExists(
        "CREATE TABLE IF NOT EXISTS user_ips (id INTEGER PRIMARY KEY AUTOINCREMENT,user_id TEXT NOT NULL,ip TEXT NOT NULL,UNIQUE(user_id, ip))",
        "user_ips"
    );

    console.log("Database migration completed.");
    db.close();
});
