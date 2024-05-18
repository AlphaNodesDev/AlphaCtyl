const axios = require('axios');
const settings = require('../settings.json');





// Function to update user's coins in the database
function updateUserCoins(userId, reward, db) {
    db.run(`UPDATE users SET coins = coins + ${reward} WHERE pterodactyl_id = ?`, [userId], (err) => {
        if (err) {
            logErrorToFile(`Error updating coins for user ${userId}: ${err.message}`);
        } 
    });
}
module.exports = { updateUserCoins};