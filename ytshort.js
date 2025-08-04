const puppeteer = require('puppeteer');
const fs = require('fs');

const FILE_PATH = 'shorts_links.txt';


function readSavedLinks() {
    if (!fs.existsSync(FILE_PATH)) return new Set();
    const data = fs.readFileSync(FILE_PATH, 'utf-8');
    return new Set(data.split('\n').filter(Boolean));
}


function appendLink(link) {
    fs.appendFileSync(FILE_PATH, link + '\n', 'utf-8');
    console.log(`Yeni link kaydedildi: ${link}`);
}

async function getNewShortLink(page, savedLinks) {
    await page.goto('https://www.youtube.com/shorts', { waitUntil: 'networkidle2' });

   
    await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 5000));


    const links = await page.$$eval('a', anchors =>
        anchors
            .map(a => a.href)
            .filter(href => href.includes('/shorts/'))
    );

    
    for (const link of links) {
        if (!savedLinks.has(link)) {
            return link;
        }
    }

  
    return null;
}

(async () => {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    const savedLinks = readSavedLinks();

    while (true) {
        const newLink = await getNewShortLink(page, savedLinks);
        if (newLink) {
            appendLink(newLink);
            savedLinks.add(newLink);
        } else {
            console.log('Yeni link bulunamadı, 10 saniye bekleniyor...');
            await new Promise(resolve => setTimeout(resolve, 10000));
        }
    }


})();
