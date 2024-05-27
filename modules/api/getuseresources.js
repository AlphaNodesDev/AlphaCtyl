async function getUserResources(userId, db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
            if (err) {
                console.error(err.message);
                reject(err);
            } else {
                const userResources = {
                    row: row,

                };
                resolve(userResources);
            }
        });
    });
}

module.exports = { getUserResources };
