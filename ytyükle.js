const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const readline = require('readline');
const chalk = require('chalk');

const CREDENTIALS_PATH = 'credentials.json';
const VIDEOS_DIR = 'shorts_videos';

const TOKENS = ['token1.json', 'token2.json','token3.json'];
const DAILY_UPLOAD_LIMIT = 5;
const UPLOAD_START_HOUR = 18;
const UPLOAD_END_HOUR = 23;

const SCOPES = ['https://www.googleapis.com/auth/youtube.upload'];

class Log {
    static getCurrentTime() {
        const date = new Date();
        return date.toLocaleTimeString();
    }
    static writeToFile(logMessage) {
        fs.appendFileSync('./log.txt', logMessage + '\n', 'utf8');
    }
    static success(message) {
        const currentTime = this.getCurrentTime();
        const logMessage = `[${currentTime}] [SUCCESS] ${message}`;
        console.log(chalk.magenta(`[${currentTime}]`) + chalk.green(' [SUCCESS] ') + chalk.white(message));
        this.writeToFile(logMessage);
    }
    static error(message) {
        const currentTime = this.getCurrentTime();
        const logMessage = `[${currentTime}] [ERROR] ${message}`;
        console.log(chalk.magenta(`[${currentTime}]`) + chalk.red(' [ERROR] ') + chalk.white(message));
        this.writeToFile(logMessage);
    }
    static info(message) {
        const currentTime = this.getCurrentTime();
        const logMessage = `[${currentTime}] [INFO] ${message}`;
        console.log(chalk.magenta(`[${currentTime}]`) + chalk.blue(' [INFO] ') + chalk.white(message));
        this.writeToFile(logMessage);
    }
    static warning(message) {
        const currentTime = this.getCurrentTime();
        const logMessage = `[${currentTime}] [WARNING] ${message}`;
        console.log(chalk.magenta(`[${currentTime}]`) + chalk.yellow(' [WARNING] ') + chalk.white(message));
        this.writeToFile(logMessage);
    }
}

const uploadTrackers = TOKENS.reduce((acc, token) => {
    acc[token] = {
        uploadedToday: 0,
        lastResetDate: new Date().toDateString(),
    };
    return acc;
}, {});

function resetDailyCounterIfNeeded(token) {
    const today = new Date().toDateString();
    if (today !== uploadTrackers[token].lastResetDate) {
        uploadTrackers[token].uploadedToday = 0;
        uploadTrackers[token].lastResetDate = today;
        Log.info(`Yeni gün başladı. Günlük sayaç sıfırlandı. Token: ${token}`);
    }
}

async function authorize(tokenPath) {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(tokenPath)) {
        oAuth2Client.setCredentials(JSON.parse(fs.readFileSync(tokenPath, 'utf-8')));
        return oAuth2Client;
    }

    const authUrl = oAuth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });

    Log.info(`Tarayıcıdan bu linke gir ve doğrulama kodunu yapıştır: ${authUrl}`);

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const code = await new Promise(resolve => rl.question('Kod: ', answer => {
        rl.close();
        resolve(answer);
    }));

    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);
    fs.writeFileSync(tokenPath, JSON.stringify(tokens));
    Log.info(`Token başarıyla kaydedildi: ${tokenPath}`);
    return oAuth2Client;
}

async function uploadOneVideo(auth, token) {
    const files = fs.readdirSync(VIDEOS_DIR).filter(f => f.endsWith('.mp4'));
    if (files.length === 0) {
        Log.info('Yüklenecek video kalmadı.');
        return false;
    }

    if (uploadTrackers[token].uploadedToday >= DAILY_UPLOAD_LIMIT) {
        Log.warning(`Günlük yükleme limiti doldu. Token: ${token}`);
        return false;
    }

    const file = files[Math.floor(Math.random() * files.length)];
    const filePath = path.join(VIDEOS_DIR, file);

    try {
        const youtube = google.youtube({ version: 'v3', auth });

        const res = await youtube.videos.insert({
            part: ['snippet', 'status'],
            requestBody: {
                snippet: {
                    title: file.replace('.mp4', ''),
                    description: '',
                    tags: ["shorts", "short", "kesfet", "fyp", "aile", "mutluluk", "komedi", "comedy"]
                },
                status: {
                    privacyStatus: 'public'
                }
            },
            media: {
                body: fs.createReadStream(filePath)
            }
        });

        Log.success(`Video yüklendi: ${res.data.id} Token: ${token}`);
        fs.unlinkSync(filePath);
        Log.info(`Dosya silindi: ${filePath} Token: ${token}`);

        uploadTrackers[token].uploadedToday++;
        return true;

    } catch (error) {
        Log.error(`Video yüklenirken hata: ${error.message} Token: ${token}`);
        return false;
    }
}

function isWithinUploadHours() {
    const hour = new Date().getHours();
    return hour >= UPLOAD_START_HOUR && hour < UPLOAD_END_HOUR;
}

async function uploadLoop(token) {
    while (true) {
        resetDailyCounterIfNeeded(token);

        if (!isWithinUploadHours()) {
            Log.info(`Yükleme saati dışında. Saatler: ${UPLOAD_START_HOUR}:00 - ${UPLOAD_END_HOUR}:00 Token: ${token}`);
        } else {
            const auth = await authorize(token);
            const uploaded = await uploadOneVideo(auth, token);

            if (!uploaded) {
                Log.warning(`Yükleme yapılmadı. 1 saat sonra tekrar denenecek. Token: ${token}`);
            }
        }

        Log.info(`Token ${token} için 1 saat bekleniyor...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * 60 * 60));
    }
}

function startAllLoops() {
    TOKENS.forEach(token => {
        uploadLoop(token);
    });
}

startAllLoops();
