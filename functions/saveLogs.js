const axios = require('axios');
const settings = require('../settings.json');



//Log Erro
function logErrorToFile(message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile(LOG_FILE_PATH, logMessage, (err) => {
        if (err) {
            console.error('Error writing to log file:', err.message);
        }
    });
}
function logNormalToFile(message) {
    const logMessage = `${new Date().toISOString()} - ${message}\n`;
    fs.appendFile(NORMAL_LOG_FILE_PATH, logMessage, (err) => {
        if (err) {
            console.error('Error writing to normal log file:', err.message);
        }
    });
}


function parseLogs(data) {
    const logsByDate = {};
    const logLines = data.split('\n');
    logLines.forEach(line => {
        const match = line.match(/^(.*?) - (.*)$/);
        if (match) {
            const date = match[1].split('T')[0]; // Extract date part
            if (!logsByDate[date]) {
                logsByDate[date] = [];
            }
            logsByDate[date].push(match[2]);
        }
    });
    return logsByDate;
}
function parseNormalLogs(data) {
    const logsByDate = {};
    const logLines = data.split('\n');
    logLines.forEach(line => {
        const match = line.match(/^(.*?) - (.*)$/);
        if (match) {
            const date = match[1].split('T')[0]; // Extract date part
            if (!logsByDate[date]) {
                logsByDate[date] = [];
            }
            logsByDate[date].push(match[2]);
        }
    });
    return logsByDate;
}


module.exports = { logErrorToFile, logNormalToFile, parseLogs, parseNormalLogs };