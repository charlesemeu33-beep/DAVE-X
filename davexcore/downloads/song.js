const axios = require('axios');
const yts = require('yt-search');
const { createFakeContact, getBotName } = require('../../lib/fakeContact');

const AXIOS_DEFAULTS = {
    timeout: 60000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

async function tryRequest(getter, attempts = 3) {
    let lastError;
    for (let i = 1; i <= attempts; i++) {
        try {
            return await getter();
        } catch (err) {
            lastError = err;
            if (i < attempts) {
                await new Promise(r => setTimeout(r, i * 1000));
            }
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

            const downloadUrl = (typeof result === 'string' && result.startsWith('http')) ? result :
                result?.download || result?.url || result?.downloadUrl || result?.link || null;

            if (downloadUrl) {
                return {
                    download: downloadUrl,
                    title: result?.title || data?.title || 'YouTube Audio',
                    thumbnail: result?.thumbnail || result?.thumb || data?.thumbnail || '',
                    duration: result?.duration || data?.duration || '0:00'
                };
            }
        } catch (err) {
            lastError = err;
            continue;
        }
    }

    throw lastError || new Error('All audio APIs failed');
}

async function songCommand(sock, chatId, message) {
    const senderId = message.key.participant || message.key.remoteJid;
    const fake = createFakeContact(senderId);
    const botName = getBotName();

    try {
        const text = message.message?.conversation ||
            message.message?.extendedTextMessage?.text || '';
        const parts = text.split(' ');
        const query = parts.slice(1).join(' ').trim();

        if (!query) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}* Song\n\nUse: .song <name or link>\nExample: .song Never Gonna Give You Up`
            }, { quoted: fake });
        }

        let video;

        if (query.includes('youtube.com') || query.includes('youtu.be')) {
            const search = await yts(query);
            video = search?.videos?.[0] || {
                url: query,
                title: 'YouTube Audio',
                thumbnail: 'https://img.youtube.com/vi/default/hqdefault.jpg',
                timestamp: '0:00'
            };
        } else {
            const search = await yts(query);
            if (!search?.videos?.length) {
                return sock.sendMessage(chatId, {
                    text: `✦ *${botName}*\nNo results found for that query.`
                }, { quoted: fake });
            }
            video = search.videos[0];
        }

        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\n\nTitle: ${video.title}\nDuration: ${video.timestamp || '0:00'}\n\nDownloading...`
        }, { quoted: fake });

        const audio = await getAudioDownload(video.url);

        await sock.sendMessage(chatId, {
            audio: { url: audio.download },
            mimetype: 'audio/mpeg',
            ptt: false,
            contextInfo: {
                externalAdReply: {
                    title: audio.title || video.title,
                    body: botName,
                    thumbnailUrl: audio.thumbnail || video.thumbnail,
                    sourceUrl: video.url,
                    mediaType: 1,
                    renderLargerThumbnail: false
                }
            }
        }, { quoted: fake });

        await sock.sendMessage(chatId, { react: { text: '✅', key: message.key } });

    } catch (err) {
        console.error('Song command error:', err.message);
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\nFailed: ${err.message}`
        }, { quoted: fake });
        
        await sock.sendMessage(chatId, { react: { text: '❌', key: message.key } });
    }
}

module.exports = songCommand;