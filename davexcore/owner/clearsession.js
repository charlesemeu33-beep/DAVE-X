const fs = require('fs');
const path = require('path');
const os = require('os');
const { createFakeContact, getBotName } = require('../../lib/fakeContact');

async function clearSessionCommand(sock, chatId, msg) {
    try {
        const senderId = msg.key.participant || msg.key.remoteJid;
        const fake = createFakeContact(senderId);
        const botName = getBotName();

        // Check if sender is owner
        if (!msg.key.fromMe) {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nOwner only command!`
            }, { quoted: fake });
            return;
        }

        // Fix: Go up 2 levels to reach /botcode, then into session
        const sessionDir = path.join(__dirname, '../../session'); // /botcode/session

        if (!fs.existsSync(sessionDir)) {
            await sock.sendMessage(chatId, { 
                text: `✦ *${botName}*\nSession directory not found`
            }, { quoted: fake });
            return;
        }

        let filesCleared = 0;
        let errors = 0;
        let errorDetails = [];

        // Send initial status
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nClearing session files...`
        }, { quoted: fake });

        const files = fs.readdirSync(sessionDir);
        
        // Count files by type for optimization
        let appStateSyncCount = 0;
        let preKeyCount = 0;

        for (const file of files) {
            if (file.startsWith('app-state-sync-')) appStateSyncCount++;
            if (file.startsWith('pre-key-')) preKeyCount++;
        }

        // Delete files
        for (const file of files) {
            if (file === 'creds.json') {
                // Skip creds.json file
                continue;
            }
            try {
                const filePath = path.join(sessionDir, file);
                fs.unlinkSync(filePath);
                filesCleared++;
            } catch (error) {
                errors++;
                errorDetails.push(`Failed to delete ${file}: ${error.message}`);
            }
        }

        // Send completion message
        const message = `✦ *${botName}* - am know invisible 🔥

✦ Session cleared:
  • Files: ${filesCleared}
  • App sync: ${appStateSyncCount}
  • Pre-keys: ${preKeyCount}
  ${errors > 0 ? `\n• Errors: ${errors}` : ''}`;

        await sock.sendMessage(chatId, { 
            text: message
        }, { quoted: fake });

    } catch (error) {
        console.error('Error in clearsession command:', error);
        await sock.sendMessage(chatId, { 
            text: `✦ *${botName}*\nFailed to clear session`
        }, { quoted: fake });
    }
}

module.exports = clearSessionCommand;