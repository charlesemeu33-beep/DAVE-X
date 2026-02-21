const axios = require('axios');
const { createFakeContact, getBotName } = require('../../lib/fakeContact');

async function speechwriterCommand(sock, chatId, message) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    
    try {
        // Send initial reaction
        await sock.sendMessage(chatId, {
            react: { text: '⏳', key: message.key }
        });

        const text = message.message?.conversation || 
                     message.message?.extendedTextMessage?.text || 
                     message.message?.imageMessage?.caption || 
                     '';
        
        if (!text.includes(' ')) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}* Speech Writer\n\nUse: .speechwriter <topic>\nExample: .speechwriter how to pass exams`
            }, { quoted: fake });
        }

        const parts = text.split(' ');
        const topic = parts.slice(1).join(' ').trim();

        if (!topic) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nProvide a topic`
            }, { quoted: fake });
        }

        if (topic.length > 200) {
            return await sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nTopic too long (max 200 chars)`
            }, { quoted: fake });
        }

        // Update presence to "typing"
        await sock.sendPresenceUpdate('composing', chatId);

        // Default parameters
        const length = "short";
        const type = "dedication";
        const tone = "serious";

        // Build API URL with parameters
        const apiUrl = `https://apiskeith.top/ai/speechwriter?topic=${encodeURIComponent(topic)}&length=${length}&type=${type}&tone=${tone}`;
        const response = await axios.get(apiUrl, { timeout: 30000 });
        const apiData = response.data;

        // Validate response structure
        if (!apiData?.status || !apiData?.result?.data?.data?.speech) {
            throw new Error("Speechwriter API returned an invalid response!");
        }

        // Send success reaction
        await sock.sendMessage(chatId, {
            react: { text: '✅', key: message.key }
        });

        // Format and send the speech
        const speech = apiData.result.data.data.speech.trim();
        
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}* - am know invisible 🔥

✦ Topic: ${topic}

✦ ${speech}

✦ Details:
  Length: ${length}
  Type: ${type}
  Tone: ${tone}`
        }, { quoted: fake });

        // Send final reaction
        await sock.sendMessage(chatId, {
            react: { text: '📤', key: message.key }
        });

    } catch (error) {
        console.error("Speechwriter command error:", error);
        
        // Send error reaction
        await sock.sendMessage(chatId, {
            react: { text: '❌', key: message.key }
        });

        let errorMessage = "✦ Failed to generate speech";
        
        if (error.response?.status === 404) {
            errorMessage = '✦ Service unavailable';
        } else if (error.message.includes('timeout') || error.code === 'ECONNABORTED') {
            errorMessage = '✦ Request timeout';
        } else if (error.code === 'ENOTFOUND') {
            errorMessage = '✦ Network error';
        } else if (error.response?.status === 429) {
            errorMessage = '✦ Too many requests';
        } else if (error.response?.status >= 500) {
            errorMessage = '✦ Server error';
        } else if (error.message.includes('invalid response')) {
            errorMessage = '✦ Invalid response format';
        }
            
        await sock.sendMessage(chatId, {
            text: errorMessage
        }, { quoted: fake });
    }
}

module.exports = speechwriterCommand;