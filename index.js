const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs');
const pino = require('pino');

const SESSIONS_DIR = './sessions/';
if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR);
}

const numbers = JSON.parse(fs.readFileSync('./numbers.json'));
const conversationPairs = JSON.parse(fs.readFileSync('./messages.json'));

const activeSessions = {};
let pendingReplies = [];

const connectToWhatsApp = (number) => {
    return new Promise(async (resolve, reject) => {
        const { state, saveCreds } = await useMultiFileAuthState(SESSIONS_DIR + number);

        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: Browsers.macOS('Desktop')
        });

        if (!sock.authState.creds.registered) {
            const phoneNumber = number.replace(/[^0-9]/g, '');
            setTimeout(async () => {
                try {
                    const code = await sock.requestPairingCode(phoneNumber);
                    console.log(`[PAIRING CODE] Kode untuk ${number}: ${code.match(/.{1,4}/g).join('-')}`);
                } catch (error) {
                    console.error(`[ERROR] Gagal meminta pairing code untuk ${number}:`, error);
                    reject(error);
                }
            }, 3000);
        }

        let connectionOpened = false;

        sock.ev.on('creds.update', saveCreds);

        sock.ev.on('connection.update', (update) => {
            const { connection, lastDisconnect } = update;

            if (connection === 'open') {
                if (!connectionOpened) {
                    console.log(`[SUCCESS] Koneksi berhasil untuk nomor: ${number}`);
                    activeSessions[number] = sock;
                    connectionOpened = true;
                    resolve(sock);
                }
            } 
            else if (connection === 'close') {
                const statusCode = lastDisconnect.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
                
                if (activeSessions[number]) {
                    console.log(`[WARNING] Koneksi ditutup untuk ${number}. Mencoba menyambung kembali...`);
                    delete activeSessions[number];
                }

                if (shouldReconnect) {
                    setTimeout(() => connectToWhatsApp(number).catch(() => {}), 5000);
                } else {
                    console.error(`[FATAL] Gagal terhubung untuk ${number}. Kemungkinan di-logout. Hapus folder sesi dan scan ulang.`);
                    fs.rmSync(SESSIONS_DIR + number, { recursive: true, force: true });
                    if (!connectionOpened) {
                        reject(new Error(`Logged out for ${number}`));
                    }
                }
            }
        });
    });
};

const startScheduler = () => {
    const minInterval = 1 * 1000;
    const maxInterval = 60 * 1000;

    const scheduleNextConversation = () => {
        const interval = Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;
        setTimeout(async () => {
            await initiateConversation();
            scheduleNextConversation();
        }, interval);
    };

    setInterval(processPendingReplies, 5000);
    scheduleNextConversation();
};

const processPendingReplies = async () => {
    const now = Date.now();
    const repliesToSend = pendingReplies.filter(reply => now >= reply.sendAt);

    if (repliesToSend.length === 0) return;

    for (const reply of repliesToSend) {
        const senderSocket = activeSessions[reply.senderKey];
        if (senderSocket) {
            try {
                await senderSocket.sendPresenceUpdate('composing', reply.receiverJid);
                await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
                await senderSocket.sendMessage(reply.receiverJid, { text: reply.message });
                await senderSocket.sendPresenceUpdate('paused', reply.receiverJid);
                console.log(`[REPLY] Pesan dari ${reply.senderKey} ke ${reply.receiverKey}: "${reply.message}"`);
            } catch (error) {
                console.error(`[ERROR] Gagal mengirim balasan dari ${reply.senderKey}:`, error);
            }
        }
    }
    pendingReplies = pendingReplies.filter(reply => now < reply.sendAt);
};

const initiateConversation = async () => {
    const sessionKeys = Object.keys(activeSessions);
    if (sessionKeys.length < 2) {
        console.log(`[SCHEDULER] Menunggu minimal 2 sesi aktif... Sesi aktif saat ini: ${sessionKeys.length}`);
        return;
    }

    const senderIndex = Math.floor(Math.random() * sessionKeys.length);
    let receiverIndex;
    do {
        receiverIndex = Math.floor(Math.random() * sessionKeys.length);
    } while (senderIndex === receiverIndex);

    const senderKey = sessionKeys[senderIndex];
    const receiverKey = sessionKeys[receiverIndex];
    const receiverJid = `${receiverKey}@s.whatsapp.net`;
    const senderSocket = activeSessions[senderKey];
    const conversation = conversationPairs[Math.floor(Math.random() * conversationPairs.length)];

    try {
        const messageToSend = conversation.type === 'qa' ? conversation.question : conversation.text;
        
        await senderSocket.sendPresenceUpdate('composing', receiverJid);
        await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
        await senderSocket.sendMessage(receiverJid, { text: messageToSend });
        await senderSocket.sendPresenceUpdate('paused', receiverJid);
        console.log(`[SEND] Pesan dari ${senderKey} ke ${receiverKey}: "${messageToSend}"`);

        if (conversation.type === 'qa') {
            const reply = {
                senderKey: receiverKey,
                receiverKey: senderKey,
                receiverJid: `${senderKey}@s.whatsapp.net`,
                message: conversation.answer,
                sendAt: Date.now() + conversation.delayInSeconds * 1000
            };
            pendingReplies.push(reply);
            console.log(`[SCHEDULED] Balasan dari ${receiverKey} dijadwalkan dalam ${conversation.delayInSeconds} detik.`);
        }
    } catch (error) {
        console.error(`[ERROR] Gagal memulai percakapan dari ${senderKey}:`, error);
    }
};

const run = async () => {
    console.log('[SYSTEM] Memulai penjadwal percakapan...');
    startScheduler();

    console.log('[SYSTEM] Memulai inisialisasi semua sesi secara paralel...');
    const connectionPromises = numbers.map(number => 
        connectToWhatsApp(number).catch(err => 
            console.error(`[INIT ERROR] Gagal inisialisasi untuk ${number}: ${err.message}`)
        )
    );

    await Promise.allSettled(connectionPromises);

    console.log('[SYSTEM] Semua upaya koneksi awal telah selesai. Bot sekarang berjalan dengan sesi yang aktif.');
};

run();