const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { exec } = require('child_process');
const schedule = require('node-schedule');
const mysql = require('mysql2/promise');

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync('./plugins/configs/Discordbot.json', 'utf8'));

// Extract configuration values
const token = config.PteroBackup.discord.token;
const channelId = config.PteroBackup.discord.channelId;
const backupDir = path.resolve(config.PteroBackup.backup.backupDir);
const backupRetentionDays = config.PteroBackup.backup.backupRetentionDays;
const allowedRoleId = config.PteroBackup.discord.allowedRoleId;

const pterodactylServerDir = config.PteroBackup.backup.pterodactylServerDir;

const mysqlConfig = {
  host: config.PteroBackup.database.host,
  user: config.PteroBackup.database.user,
  password: config.PteroBackup.database.password,
  database: config.PteroBackup.database.database,
  port: config.PteroBackup.database.port
};

fs.ensureDirSync(backupDir);

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const sendLogToDiscord = async (message, embed = null) => {
  try {
    const channel = await client.channels.fetch(channelId);
    await channel.send({ content: message, embeds: embed ? [embed] : [] });
  } catch (error) {
    console.error('Error sending log to Discord:', error);
  }
};

const backupServer = async () => {
  const timestamp = new Date().toISOString().replace(/:/g, '-');
  const serverBackupFile = path.join(backupDir, `server_backup_${timestamp}.tar.gz`);
  const dbBackupFile = path.join(backupDir, `database_backup_${timestamp}.sql`);

  const backupCommand = `cd ${pterodactylServerDir} && tar -czf ${serverBackupFile} .`;
  exec(backupCommand, (error, stdout, stderr) => {
    if (error) {
      sendLogToDiscord(`Server backup failed: ${error.message}`);
      return;
    }

    if (stderr) {
      sendLogToDiscord(`Server backup stderr: ${stderr}`);
      return;
    }

    // Backup database
    backupDatabase(dbBackupFile, serverBackupFile);
  });
};

const backupDatabase = async (dbBackupFile, serverBackupFile) => {
  let connection;

  try {
    connection = await mysql.createConnection(mysqlConfig);
    const dumpCommand = `mysqldump -u ${mysqlConfig.user} -p${mysqlConfig.password} --host=${mysqlConfig.host} --port=${mysqlConfig.port} ${mysqlConfig.database} > ${dbBackupFile}`;

    exec(dumpCommand, (error, stdout, stderr) => {
      if (error) {
        sendLogToDiscord(`Database backup failed: ${error.message}`);
        return;
      }

      if (stderr) {
        sendLogToDiscord(`Database backup stderr: ${stderr}`);
        return;
      }

      const serverSize = fs.statSync(serverBackupFile).size / (1024 * 1024); // Size in MB
      const dbSize = fs.statSync(dbBackupFile).size / (1024 * 1024); // Size in MB

      const embed = new EmbedBuilder()
        .setTitle('Backup Completed')
        .setColor('#00FF00')
        .addFields(
          { name: 'Server Backup', value: `File: \`${path.basename(serverBackupFile)}\`\nSize: ${serverSize.toFixed(2)} MB` },
          { name: 'Database Backup', value: `File: \`${path.basename(dbBackupFile)}\`\nSize: ${dbSize.toFixed(2)} MB` }
        )
        .setTimestamp();

      sendLogToDiscord('Backup process completed successfully.', embed);

      removeOldBackups();
    });

  } catch (err) {
    console.error('Database connection error:', err.message);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
};

const removeOldBackups = async () => {
  try {
    const serverFiles = await fs.readdir(backupDir);
    const serverBackups = serverFiles.filter(file => file.startsWith('server_backup_'));
    const dbBackups = serverFiles.filter(file => file.startsWith('database_backup_'));

    serverBackups.sort((a, b) => fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs);
    dbBackups.sort((a, b) => fs.statSync(path.join(backupDir, b)).mtimeMs - fs.statSync(path.join(backupDir, a)).mtimeMs);

    serverBackups.forEach((file, index) => {
      if (index >= 5) { 
        const filePath = path.join(backupDir, file);
        fs.remove(filePath, err => {
          if (err) {
            sendLogToDiscord(`Error deleting old server backup ${file}: ${err.message}`);
          } else {
            sendLogToDiscord(`Deleted old server backup: ${file}`);
          }
        });
      }
    });

    dbBackups.forEach((file, index) => {
      if (index >= 5) { 
        const filePath = path.join(backupDir, file);
        fs.remove(filePath, err => {
          if (err) {
            sendLogToDiscord(`Error deleting old database backup ${file}: ${err.message}`);
          } else {
            sendLogToDiscord(`Deleted old database backup: ${file}`);
          }
        });
      }
    });

  } catch (err) {
    sendLogToDiscord(`Error handling backup files: ${err.message}`);
  }
};

schedule.scheduleJob('0 */6 * * *', backupServer);

client.on('messageCreate', async message => {
  if (message.content.toLowerCase() === '?backup') {
    if (message.member.roles.cache.has(allowedRoleId)) {
      await sendLogToDiscord('Backup process started manually.');
      await backupServer();
    } else {
      await sendLogToDiscord('You do not have the required role to use this command.');
    }
  }
});


client.login(token);
