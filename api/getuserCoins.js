const axios = require('axios');
const settings = require('../settings.json');

async function getUserCoins(userId, db) {
    return new Promise((resolve, reject) => {
        // Execute SQL query to get user's coins
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

// Export the function to make it accessible from other modules
module.exports = { getUserCoins };
