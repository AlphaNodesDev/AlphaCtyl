async function getUserResources(userId, db) {
    return new Promise((resolve, reject) => {
        db.get('SELECT servers FROM users WHERE pterodactyl_id = ?', [userId], (err, row) => {
            if (err) {
                console.error('Error fetching user resources:', err.message);
                reject(err);
            } else {
                const userResources = {
                    row: row,  
                };

                db.all('SELECT server_id FROM j4r_joins WHERE user_id = ?', [userId], (err, rows) => {
                    if (err) {
                        console.error('Error fetching joined servers:', err.message);
                        reject(err);
                    } else {
                        const joinedServers = rows.map(row => row.server_id);
                        resolve({ userResources, joinedServers });
                    }
                });
            }
        });
    });
}

module.exports = { getUserResources };
