const axios = require('axios');
const settings = require('../settings.json');

async function getUserIdByUUID(uuid) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}api/application/users?filter%5Buuid%5D=${uuid}`, {
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
            console.error('User not found with UUID:', uuid);
            return null;
        }

        return userData.attributes.id;
    } catch (error) {
        console.error('Error fetching user ID:', error.message);
        throw error;
    }
}

async function getUserServersCount(userIdentifier) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}api/application/servers`, {
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

        const userServers = response.data.data.filter(server => server.attributes.user === userIdentifier);
        
        // Calculate total RAM, disk space, ports, and CPU usage
        let totalRAM = 0;
        let totalDisk = 0;
        let totalPorts = 0;
        let totalCPU = 0;

        userServers.forEach(server => {
            totalRAM += server.attributes.limits.memory;
            totalDisk += server.attributes.limits.disk;
            totalPorts += server.attributes.feature_limits.allocations + server.attributes.allocation;
            totalCPU += server.attributes.limits.cpu;
        });

        return {
            count: userServers.length,
            totalRAM,
            totalDisk,
            totalPorts,
            totalCPU
        };
    } catch (error) {
        console.error('Error fetching user servers:', error.message);
        throw error;
    }
}

module.exports = { getUserIdByUUID, getUserServersCount };
