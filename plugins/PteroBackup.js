const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const schedule = require('node-schedule');
const mysql = require('mysql2/promise');

const configPath = './plugins/configs/Discordbot.json';
const settingsPath = './settings.json';

module.exports = () => {
  if (!fs.existsSync(settingsPath)) {
    console.error('Settings file not found.');
    process.exit(1);
  }

  const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const token = settings.discord.bot.token;
  const channelId = config.PteroBackup.discord.channelId;
  const backupDir = path.resolve(config.PteroBackup.backup.backupDir);
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

  let progressMessage;

  const generateProgressBar = (percent) => {
    const barLength = 40;
    const filledLength = Math.round(percent * barLength);
    const emptyLength = barLength - filledLength;
    return `[${'='.repeat(filledLength)}${' '.repeat(emptyLength)}] ${Math.round(percent * 100)}%`;
  };

  const sendProgressUpdate = async (percent, message) => {
    try {
      const channel = await client.channels.fetch(channelId);
      const progressText = `${message}\n${generateProgressBar(percent)}`;
      if (progressMessage) {
        await progressMessage.edit({ content: progressText });
      } else {
        progressMessage = await channel.send({ content: progressText });
      }
    } catch (error) {
      console.error('Error sending progress update to Discord:', error);
    }
  };

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

    await sendProgressUpdate(0, 'Server backup started...');
    const backupCommand = `tar -czf ${serverBackupFile} .`;
    const backupProcess = spawn(backupCommand, [], {
      cwd: pterodactylServerDir,
      shell: true
    });

    let lastSize = 0;
    const interval = setInterval(async () => {
      try {
        const currentSize = fs.statSync(serverBackupFile).size;
        const percent = (currentSize - lastSize) / (1024 * 1024); // MB per interval
        lastSize = currentSize;
        const totalSize = await calculateSize(pterodactylServerDir);
        const progressPercent = Math.min(currentSize / totalSize, 1);
        await sendProgressUpdate(progressPercent, 'Server backup in progress...');
        if (currentSize >= totalSize) {
          clearInterval(interval);
          await sendProgressUpdate(0.5, 'Server backup completed. Starting database backup...');
          backupDatabase(dbBackupFile, serverBackupFile);
        }
      } catch (err) {
        clearInterval(interval);
        sendLogToDiscord(`Error tracking server backup progress: ${err.message}`);
      }
    }, 10000); 

    backupProcess.on('error', (err) => {
      sendLogToDiscord(`Server backup process error: ${err.message}`);
    });

    backupProcess.on('exit', (code) => {
      if (code !== 0) {
        sendLogToDiscord(`Server backup process exited with code ${code}`);
      }
    });
  };

  const backupDatabase = async (dbBackupFile, serverBackupFile) => {
    let connection;

    try {
      connection = await mysql.createConnection(mysqlConfig);
      await sendProgressUpdate(0.5, 'Database backup in progress...');

      const dumpCommand = `mysqldump -u ${mysqlConfig.user} -p${mysqlConfig.password} --host=${mysqlConfig.host} --port=${mysqlConfig.port} ${mysqlConfig.database} > ${dbBackupFile}`;
      const dumpProcess = spawn(dumpCommand, [], { shell: true });

      dumpProcess.on('error', (err) => {
        sendLogToDiscord(`Database backup process error: ${err.message}`);
      });

      dumpProcess.on('exit', (code) => {
        if (code === 0) {
          const serverSize = fs.statSync(serverBackupFile).size / (1024 * 1024); 
          const dbSize = fs.statSync(dbBackupFile).size / (1024 * 1024); 

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
        } else {
          sendLogToDiscord(`Database backup process exited with code ${code}`);
        }
      });

    } catch (err) {
      sendLogToDiscord(`Database connection error: ${err.message}`);
    } finally {
      if (connection) {
        await connection.end();
      }
    }
  };

  const calculateSize = async (dir) => {
    try {
      const { default: getFolderSize } = await import('get-folder-size');
      return new Promise((resolve, reject) => {
        getFolderSize(dir, (err, totalSize) => {
          if (err) {
            reject(err);
          } else {
            resolve(totalSize);
          }
        });
      });
    } catch (err) {
      throw new Error(`Failed to calculate folder size: ${err.message}`);
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
    if (message.content.toLowerCase() === '!backup') {
      if (message.member.roles.cache.has(allowedRoleId)) {
        await sendLogToDiscord('Backup process started manually.');
        await backupServer();
      } else {
        await sendLogToDiscord('You do not have the required role to use this command.');
      }
    }
  });

  const startClient = async () => {
    try {
      await client.login(token);
    } catch (error) {
      console.error('Failed to login to Discord:', error.message);
      process.exit(1);
    }
  };

  if (settings.plugins?.PteroBackup?.enabled) {
    startClient();
  } else {
    console.log('PteroBackup plugin is not enabled.');
  }
};
