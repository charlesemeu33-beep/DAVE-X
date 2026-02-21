const fs = require('fs');
const axios = require('axios');
const yts = require('yt-search');
const path = require('path');
const { createFakeContact, getBotName } = require('../../lib/fakeContact');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 2) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) await new Promise(r => setTimeout(r, 1500));
        }
    }
    throw lastError;
}

async function getAudioDownload(youtubeUrl) {
    const apis = [
        `https://apiskeith.top/download/audio?url=${encodeURIComponent(youtubeUrl)}`,
        `https://apiskeith.top/download/ytmp3?url=${encodeURIComponent(youtubeUrl)}`,
    ];

    let lastError;
    for (const apiUrl of apis) {
        try {
            const res = await tryRequest(() => axios.get(apiUrl, AXIOS_DEFAULTS));
            if (!res?.data) continue;

            const data = res.data;
            const result = data.result || data;
            const url = (typeof result === 'string' && result.startsWith('http')) ? result :
                result?.download || result?.url || result?.downloadUrl || result?.link || null;

            if (url) {
                return {
                    download: url,
                    title: result?.title || data?.title || 'YouTube Audio'
                };
            }
        } catch (err) {
            lastError = err;
            continue;
        }
    }
    throw lastError || new Error('All audio APIs failed');
}

async function playCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    const botName = getBotName();

    try {
        await sock.sendMessage(chatId, { react: { text: '⏳', key: message.key } });

        const tempDir = path.join(process.cwd(), 'tmp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}* Play\n\nUse: .play <song name>\nExample: .play Never Gonna Give You Up`
            }, { quoted: fake });
        }

        if (query.length > 100) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nSong name too long! Max 100 chars.`
            }, { quoted: fake });
        }

        const search = await yts(`${query} official audio`);
        const video = search.videos[0];

        if (!video) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nCouldn't find that song. Try another one!`
            }, { quoted: fake });
        }

        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\n\nTitle: ${video.title}\nDuration: ${video.timestamp}\nChannel: ${video.author?.name || 'Unknown'}\n\nDownloading...`
        }, { quoted: fake });

        const audio = await getAudioDownload(video.url);
        const downloadUrl = audio.download;
        const songTitle = audio.title || video.title;

        const timestamp = Date.now();
        const fileName = `audio_${timestamp}.mp3`;
        const filePath = path.join(tempDir, fileName);

        // Download with progress tracking disabled
        const audioStream = await axios({
            method: 'get',
            url: downloadUrl,
            responseType: 'stream',
            timeout: 600000,
            onDownloadProgress: null // Disable progress tracking
        });

        const writer = fs.createWriteStream(filePath);
        audioStream.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            throw new Error('Download failed or empty file!');
        }

        // Clean filename: remove special characters and limit length
        const cleanTitle = songTitle
            .replace(/[^\w\s-]/g, '') // Remove special chars
            .replace(/\s+/g, ' ')      // Normalize spaces
            .trim()
            .substring(0, 80);          // Limit length

        // Send as document with proper filename
        await sock.sendMessage(chatId, {
            document: fs.readFileSync(filePath),
            mimetype: 'audio/mpeg',
            fileName: `${cleanTitle}.mp3`
        }, { quoted: fake });

        // Cleanup
        try { fs.unlinkSync(filePath); } catch (e) {}

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (error) {
        console.error('Play command error:', error.message);
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\nError: ${error.message}`
        }, { quoted: fake });
        
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = playCommand;