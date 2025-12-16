const axios = require('axios');
const settings = require('../../settings.json');

async function fetchAllocations(locationId) {
    try {
        const fetchAllNodes = async () => {
            let page = 1;
            let totalPages = 1;
            const nodes = [];

            while (page <= totalPages) {
                const response = await axios.get(`${settings.pterodactyl.domain}/api/application/nodes?page=${page}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.pterodactyl.key}`
                    }
                });

                if (response.status !== 200) {
                    throw new Error(`Failed to fetch nodes: ${response.status}`);
                }

                const nodesData = response.data;
                nodes.push(...nodesData.data);
                totalPages = nodesData.meta.pagination.total_pages || 1; 
                page++;
            }

            return nodes;
        };

        const fetchAllAllocations = async (nodeId) => {
            let page = 1;
            let totalPages = 1;
            const allocations = [];

            while (page <= totalPages) {
                const response = await axios.get(`${settings.pterodactyl.domain}/api/application/nodes/${nodeId}/allocations?page=${page}`, {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${settings.pterodactyl.key}`
                    }
                });

                if (response.status !== 200) {
                    throw new Error(`Failed to fetch allocations for the node: ${response.status}`);
                }

                const allocationsData = response.data;
                allocations.push(...allocationsData.data);
                totalPages = allocationsData.meta.pagination.total_pages || 1; 
                page++;
            }

            return allocations;
        };

        const nodes = await fetchAllNodes();
        const node = nodes.find(node => node.attributes.location_id === locationId);

        if (!node) {
            throw new Error('Node not found for the given location ID');
        }

        const allocations = await fetchAllAllocations(node.attributes.id);
        const notAssignedAllocation = allocations.find(allocation => !allocation.attributes.assigned);

        if (!notAssignedAllocation) {
            throw new Error('No unassigned allocation found for the node');
        }

        return notAssignedAllocation.attributes.id;
    } catch (error) {
        console.error('Error fetching allocations:', error);
        throw error;
    }
}

module.exports = { fetchAllocations };
