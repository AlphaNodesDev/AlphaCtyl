const axios = require('axios');
const settings = require('../../settings.json');

async function getUserIdByUUID(userId) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}/api/application/users?filter%5Buuid%5D=${userId}`, {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (response.status !== 200) {
            console.error('Failed to fetch user ID:', response.status);
            return null;
        }

        const userData = response.data.data[0];
        if (!userData) {
            console.error('User not found with userId:', userId);
            return null;
        }

        return {
            id: userData.attributes.id,
            uuid: userData.attributes.uuid,
            email: userData.attributes.email,
            username: userData.attributes.username,
            admin: userData.attributes.root_admin,
            createdAt: userData.attributes.created_at,
        };

    } catch (error) {
        console.error('Error fetching user ID:', error.message);
        console.error('Error communicating with panel');
        return null;
    }
}


function calculateTimeRemaining(nextRenewal) {
    if (!nextRenewal) {
        return 'No renewal date available';
    }
    const nextRenewalDate = new Date(nextRenewal);
    const currentDate = new Date();
    const timeDiff = nextRenewalDate - currentDate;

    if (timeDiff <= 0) {
        return 'Renewal overdue';
    }

    const days = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);

    return `${days}d ${hours}h ${minutes}m ${seconds}s remaining`;
}

async function getUserServersCount(userIdentifier, db) {
    try {
        const userServers = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            const response = await axios.get(`${settings.pterodactyl.domain}/api/application/servers?page=${page}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.pterodactyl.key}`
                }
            });

            if (response.status !== 200) {
                console.error('Failed to fetch servers:', response.status);
                return null;
            }

            // Process servers
            const pterouserid = userIdentifier.id;
            const servers = response.data.data.filter(server => server.attributes.user === pterouserid);
            userServers.push(...servers);

            // Handle pagination
            totalPages = response.data.meta.pagination.total_pages;
            page++;
        }

        // Calculate total RAM, disk space, ports, and CPU usage
        let totalRAM = 0;
        let totalDisk = 0;
        let totalPorts = 0;
        let totalCPU = 0;
        let totalDatabase = 0;
        let totalBackup = 0;

        // Add next renewal time to the server details
        const renewalQueries = userServers.map(server => {
            return new Promise((resolve, reject) => {
                db.get(`SELECT next_renewal, status FROM renewals WHERE serverId = ?`, [server.attributes.id], (err, row) => {
                    if (err) {
                        reject(err);
                    } else {
                        resolve(row);
                    }
                });
            });
        });

        const renewals = await Promise.all(renewalQueries);

        userServers.forEach((server, index) => {
            const renewalInfo = renewals[index];

            totalRAM += server.attributes.limits.memory;
            totalDisk += server.attributes.limits.disk;
            totalPorts += server.attributes.feature_limits.allocations;
            totalCPU += server.attributes.limits.cpu;
            totalDatabase += server.attributes.feature_limits.databases;
            totalBackup += server.attributes.feature_limits.backups;

            if (settings.store.renewals.status === false) {
                server.attributes.next_renewal = '00:00:00:00:00:00';
                server.attributes.status = 1;
            } else {
                server.attributes.next_renewal = renewalInfo ? renewalInfo.next_renewal : null;
                server.attributes.status = renewalInfo ? renewalInfo.status : null;
            }
        });

        return {
            count: userServers.length,
            totalRAM,
            totalDisk,
            totalPorts,
            totalCPU,
            totalDatabase,
            totalBackup,
            userServers
        };
    } catch (error) {
        console.error('Error fetching user servers:', error.message);
        throw error;
    }
}


async function getUserServers(userIdentifier) {
    try {
        const pterouserid = userIdentifier.id;
        const userServers = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages) {
            const response = await axios.get(`${settings.pterodactyl.domain}/api/application/servers?page=${page}`, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.pterodactyl.key}`
                }
            });

            if (response.status !== 200) {
                console.error('Failed to fetch servers:', response.status);
                return null;
            }

            const servers = response.data.data.filter(server => server.attributes.user === pterouserid);
            userServers.push(...servers);

            totalPages = response.data.meta.pagination.total_pages || 1; 
            page++;
        }

        const serverDetails = userServers.map(server => ({
            id: server.attributes.id,
            name: server.attributes.name,
            identifier: server.attributes.identifier,
            description: server.attributes.description,
            suspended: server.attributes.suspended,
            ram: server.attributes.limits.memory,
            disk: server.attributes.limits.disk,
            ports: server.attributes.feature_limits.allocations,
            cpu: server.attributes.limits.cpu,
            database: server.attributes.feature_limits.databases
        }));

        return serverDetails;
    } catch (error) {
        console.error('Error fetching user servers:', error.message);
        throw error;
    }
}




module.exports = { getUserIdByUUID, getUserServersCount, getUserServers, calculateTimeRemaining };
