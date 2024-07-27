const axios = require('axios');
const settings = require('../../settings.json');

// Function to add notification to the database
function addNotification(userId, message, db) {
    const sql = `INSERT INTO notifications (id, notification) VALUES (?, ?)`;

    db.run(sql, [userId, message], (err) => {
        if (err) {
            console.log(`Error adding notification for user ${userId}: ${err.message}`);
        }
    });
}

// Function to update user's coins in the database
function updateUserCoins(userId, reward, db) {

    db.run(`UPDATE users SET coins = coins + ? WHERE pterodactyl_id = ?`, [reward, userId], (err) => {
        if (err) {
            console.log(`Error updating coins for user ${userId}: ${err.message}`);
        }
    });
}

module.exports = { updateUserCoins ,addNotification };
