const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const numbers = JSON.parse(fs.readFileSync('./numbers.json', 'utf-8'));

const connectToWhatsApp = async (phoneNumber) => {
    const sessionDir = path.join(__dirname, 'sessions', phoneNumber);
    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);

    const sock = makeWASocket({
        printQRInTerminal: false,
        browser: Browsers.ubuntu('Chrome'),
        auth: state,
        logger: pino({ level: 'silent' })
    });

    if (!sock.authState.creds.registered) {
        console.log(`Meminta pairing code untuk nomor: ${phoneNumber}`);
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                console.log(`Pairing code Anda untuk ${phoneNumber} adalah: ${code}`);
            } catch (error) {
                console.error(`Gagal meminta pairing code untuk ${phoneNumber}:`, error);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log(`Koneksi untuk ${phoneNumber} ditutup karena:`, lastDisconnect.error, `, mencoba menghubungkan kembali:`, shouldReconnect);
            if (shouldReconnect) {
                connectToWhatsApp(phoneNumber);
            } else {
                console.log(`Koneksi untuk ${phoneNumber} ditutup permanen, hapus folder session jika ingin scan ulang.`);
            }
        } else if (connection === 'open') {
            console.log(`Koneksi berhasil terhubung untuk nomor: ${phoneNumber}`);
        }
    });

    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.key.fromMe && m.type === 'notify') {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            if (text === 'ping') {
                await sock.sendMessage(msg.key.remoteJid, { text: 'pong' }, { quoted: msg });
            }
        }
    });
};

const startBots = async () => {
    if (!fs.existsSync('./sessions')) {
        fs.mkdirSync('./sessions');
    }
    for (const number of numbers) {
        await connectToWhatsApp(number);
    }
};

startBots();