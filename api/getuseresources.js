async function getUserResources(userId, db) {
    return new Promise((resolve, reject) => {
        // Execute SQL query to get user's resources
        db.get('SELECT * FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
            if (err) {
                console.error(err.message);
                reject(err);
            } else {
                // Extract user resources from the retrieved row
                const userResources = {
                    row: row,

                };
                resolve(userResources);
            }
        });
    });
}

// Export the function to make it accessible from other modules
module.exports = { getUserResources };
