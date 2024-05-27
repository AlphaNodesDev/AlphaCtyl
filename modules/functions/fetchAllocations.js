
const axios = require('axios');
const settings = require('../../settings.json');
async function fetchAllocations(locationId) {
    try {
        const response = await fetch(`${settings.pterodactyl.domain}/api/application/nodes`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch nodes: ${errorText}`);
        }

        const nodesData = await response.json();
        const nodes = nodesData.data;

        // Find the node matching the location ID
        const node = nodes.find(node => node.attributes.location_id === locationId);

        if (!node) {
            throw new Error('Node not found for the given location ID');
        }

        // Fetch allocations for the node
        const allocationsResponse = await fetch(`${settings.pterodactyl.domain}/api/application/nodes/${node.attributes.id}/allocations`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.pterodactyl.key}`
            }
        });

        if (!allocationsResponse.ok) {
            const errorText = await allocationsResponse.text();
            throw new Error(`Failed to fetch allocations for the node: ${errorText}`);
        }

        const allocationsData = await allocationsResponse.json();
        const allocations = allocationsData.data;

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

module.exports = {fetchAllocations};