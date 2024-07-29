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
            createdAt: userData.attributes.created_at,};
            
    } catch (error) {
        console.error('Error fetching user ID:', error.message);
        console.error('Error communicating with panel')  ;
      }
}


async function getUserServersCount(userIdentifier) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}/api/application/servers`, {
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
        const pterouserid = userIdentifier.id;
        const userServers = response.data.data.filter(server => server.attributes.user === pterouserid);
        
        // Calculate total RAM, disk space, ports, and CPU usage
        let totalRAM = 0;
        let totalDisk = 0;
        let totalPorts = 0;
        let totalCPU = 0;
        let totalDatabase = 0;
        let totalBackup = 0;

        userServers.forEach(server => {
            totalRAM += server.attributes.limits.memory;
            totalDisk += server.attributes.limits.disk;
            totalPorts += server.attributes.feature_limits.allocations;
            totalCPU += server.attributes.limits.cpu;
            totalDatabase += server.attributes.feature_limits.databases;
            totalBackup += server.attributes.feature_limits.backups;
        });

        return {
            count: userServers.length,
            totalRAM,
            totalDisk,
            totalPorts,
            totalCPU,
            totalDatabase,
            totalBackup
        };
    } catch (error) {
        console.error('Error fetching user servers:', error.message);
        throw error;
    }
}

async function getUserServers(userIdentifier) {
    try {
        const response = await axios.get(`${settings.pterodactyl.domain}/api/application/servers`, {
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
        const pterouserid = userIdentifier.id;

        const userServers = response.data.data.filter(server => server.attributes.user === pterouserid);
        
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


module.exports = { getUserIdByUUID, getUserServersCount, getUserServers };
