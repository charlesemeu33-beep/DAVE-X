const fetch = require('node-fetch');
const { createFakeContact, getBotName } = require('../../lib/fakeContact');

async function handleTranslateCommand(sock, chatId, message, match) {
    const fake = createFakeContact(message);
    const botName = getBotName();
    
    try {
        await sock.sendPresenceUpdate('composing', chatId);

        let textToTranslate = '';
        let lang = '';

        const quotedMessage = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMessage) {
            textToTranslate = quotedMessage.conversation || 
                            quotedMessage.extendedTextMessage?.text || 
                            quotedMessage.imageMessage?.caption || 
                            quotedMessage.videoMessage?.caption || 
                            '';

            lang = match.trim();
        } else {
            const args = match.trim().split(' ');
            if (args.length < 2) {
                return sock.sendMessage(chatId, {
                    text: `✦ *${botName}* Translate\n\nUse: .translate <text> <lang>\nExample: .translate hello fr\n\nLanguages:\n› fr (French)\n› es (Spanish)\n› de (German)\n› it (Italian)\n› pt (Portuguese)\n› ru (Russian)\n› ja (Japanese)\n› ko (Korean)\n› zh (Chinese)`,
                }, { quoted: fake });
            }

            lang = args.pop();
            textToTranslate = args.join(' ');
        }

        if (!textToTranslate) {
            return sock.sendMessage(chatId, {
                text: `✦ *${botName}*\nNo text to translate`,
            }, { quoted: fake });
        }

        let translatedText = null;

        // Try Google Translate API
        try {
            const response = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${lang}&dt=t&q=${encodeURIComponent(textToTranslate)}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data[0] && data[0][0] && data[0][0][0]) {
                    translatedText = data[0][0][0];
                }
            }
        } catch (e) {}

        // Try MyMemory API
        if (!translatedText) {
            try {
                const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(textToTranslate)}&langpair=auto|${lang}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.responseData && data.responseData.translatedText) {
                        translatedText = data.responseData.translatedText;
                    }
                }
            } catch (e) {}
        }

        // Try third API
        if (!translatedText) {
            try {
                const response = await fetch(`https://api.dreaded.site/api/translate?text=${encodeURIComponent(textToTranslate)}&lang=${lang}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.translated) {
                        translatedText = data.translated;
                    }
                }
            } catch (e) {}
        }

        if (!translatedText) {
            throw new Error('All APIs failed');
        }

        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\n\n${translatedText}`,
        }, { quoted: fake });

    } catch (error) {
        console.error('Translate error:', error);
        await sock.sendMessage(chatId, {
            text: `✦ *${botName}*\nFailed to translate`,
        }, { quoted: fake });
    }
}

module.exports = {
    handleTranslateCommand
};