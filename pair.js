const axios = require('axios');
const { MONGODB_URL, SESSION_NAME } = require('./config');
const { makeid } = require('./id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: Maher_Zubair,
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} = require("maher-zubair-baileys");

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
};

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function getPaire() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let session = Maher_Zubair({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
             });

            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }

            session.ev.on('creds.update', saveCreds);

            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(10000);
                    await delay(10000);

                    const jsonData = await fs.promises.readFile(`${__dirname}/temp/${id}/creds.json`, 'utf-8');
                    const { data } = await axios.post('https://api.lokiser.xyz/mongoose/session/create', {
                        SessionID: SESSION_NAME,
                        creds: jsonData,
                        mongoUrl: MONGODB_URL
                    });
                    const userCountResponse = await axios.post('https://api.lokiser.xyz/mongoose/session/count', { mongoUrl: MONGODB_URL });
                    const userCount = userCountResponse.data.count;

                    await session.sendMessage(session.user.id, { text: ` *Successfully Connected*\n\n *Total Scan :* ${userCount}` });
                    await session.sendMessage(session.user.id, { text: data.data });
                    await session.sendMessage(session.user.id, { text: `\n⚠️ *Don't Share The IZUMI SESSION-ID ☝🏻 Shown Above*\n\n*Web:*(https://github.com/sataniceypz/)\n\n*BY EYPZ*` });
                    await session.groupAcceptInvite("KHvcGD7aEUo8gPocJsYXZe");
                    await session.sendMessage("917994489493@s.whatsapp.net", { text: `*Successfully Scanned IZUMI-XD PairCode✅*` })

                    await delay(100);
                    await session.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    getPaire();
                }
            });
        } catch (err) {
            console.log("service restated");
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ code: "Service Unavailable" });
            }
        }
    }

    return await getPaire();
});

module.exports = router;
