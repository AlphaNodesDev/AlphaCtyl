const axios = require('axios');
const settings = require('../../settings.json');

async function getUserCoins(userId, db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT coins FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
            if (err) {
                console.error(err.message);
                reject(err);
            } else {
                const coins = row ? row.coins : 0;
                resolve(coins);
            }
        });
    });
}
async function getNotification(userId, db) {
    return new Promise((resolve, reject) => {
        db.all('SELECT notification FROM notifications WHERE id = ?', [userId], (err, rows) => {
            if (err) {
                console.error(err.message);
                reject(err);
            } else {
                const notifications = rows.map(row => row.notification);
                resolve(notifications);
            }
        });
    });
}



module.exports = { getUserCoins, getNotification};
