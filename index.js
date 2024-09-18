const puppeteer = require('puppeteer'); // v 1.1.0
const { URL } = require('url');
const fse = require('fs-extra'); // v 5.0.0
const path = require('path');

let queueList = ['http://127.0.0.1:8080/'];
let crawledUrls = [];
let browser;
let closeTimer;

(async () => {
    browser = await puppeteer.launch({
        defaultViewport: null,
        executablePath:
            '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: false,
    });
    popQueue();
})();

function delay(time) {
    return new Promise(function (resolve) {
        setTimeout(resolve, time);
    });
}

async function start(urlToFetch) {
    clearTimeout(closeTimer);
    const page = await browser.newPage();

    page.on('domcontentloaded', async () => {
        await delay(200);
        const html = await page.evaluate(
            () => document.querySelector('*').outerHTML
        );
        const url = new URL(page.url());
        if (url.hostname === '127.0.0.1') {
            let filePath = path.resolve(`./output${url.pathname}`);
            if (path.extname(url.pathname).trim() === '') {
                filePath = `${filePath}/index.html`;
                await fse.outputFile(filePath, html);
            }
        }
        const hrefs = await page.$$eval('a', (as) => as.map((a) => a.href));
        const unCrawledUrls = [
            ...new Set(
                hrefs
                    .filter((item) => item.startsWith('http://127.0.0.1:8080'))
                    .map((href) =>
                        href.toString().endsWith('/') ? href : `${href}/`
                    )
                    .filter(
                        (item) =>
                            !crawledUrls.includes(item) &&
                            !queueList.includes(item)
                    )
            ),
        ];

        queueList = [
            ...new Set([
                ...queueList.filter((item) => !crawledUrls.includes(item)),
                ...unCrawledUrls.filter(
                    (item) =>
                        !queueList.includes(item) && !crawledUrls.includes(item)
                ),
            ]),
        ];
    });

    page.on('response', async (response) => {
        const url = new URL(response.url());
        if (url.hostname === '127.0.0.1') {
            let filePath = path.resolve(`./output${url.pathname}`);
            if (path.extname(url.pathname).trim() !== '') {
                // skip page
                // filePath = `${filePath}/index.html`;
                await fse.outputFile(filePath, await response.buffer());
            }
        }
    });

    await page.goto(urlToFetch, {
        waitUntil: 'networkidle2',
    });

    setTimeout(async () => {
        await page.close();
        await popQueue();
    }, 500);

    closeTimer = setTimeout(async () => {
        browser.close();
    }, 10 * 1000);
}

async function popQueue() {
    if (queueList.length === 0) {
        return;
    }
    const queue = queueList.pop();
    crawledUrls.push(queue);
    console.log(
        `execute queue: ${queue.toString().endsWith('/') ? queue : `${queue}/`}`
    );
    await start(queue.toString().endsWith('/') ? queue : `${queue}/`);
}
