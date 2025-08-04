const fs = require('fs');
const { execa } = require('execa');
const path = require('path');

const LINKS_FILE = 'shorts_links.txt';
const DOWNLOAD_DIR = 'shorts_videos'; 

async function downloadVideo(url) {
    console.log(`İndiriliyor: ${url}`);

 
    if (!fs.existsSync(DOWNLOAD_DIR)) {
        fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
    }

    try {
        await execa('yt-dlp.exe', [
            '-f', 'mp4',
            '-o', path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
            url
        ]);
        console.log(`İndirildi: ${url}`);
    } catch (e) {
        console.error(`İndirme hatası: ${url}\n`, e.stderr || e);
    }
}

async function main() {
    if (!fs.existsSync(LINKS_FILE)) {
        console.error(`${LINKS_FILE} bulunamadı! Önce linkleri topla.`);
        return;
    }

    const data = fs.readFileSync(LINKS_FILE, 'utf-8');
    const links = data.split('\n').filter(Boolean);

    for (const link of links) {
        await downloadVideo(link);
    }

    console.log('Tüm linkler indirildi.');
}

main();
