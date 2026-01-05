const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const axios = require('axios');

puppeteer.use(StealthPlugin());

const CONFIG = {
    myApiSecret: process.env.CRON_SECRET || process.env.SKINVAULT_CRON_SECRET || "",
    siteUrl: process.env.SKINVAULT_SITE_URL || "https://www.skinvaults.online",
    steamConcurrency: Number(process.env.STEAM_CONCURRENCY || 1),
    batchSize: Math.max(1, Number(process.env.BATCH_SIZE || 20)),
    delayMs: Math.max(0, Number(process.env.DELAY_MS || 3000)), // Steam limit safety
    currency: String(process.env.CURRENCY || "3").trim(),
    itemsJson: process.env.ITEMS_JSON || ""
};

function getItemsToTrack() {
    if (CONFIG.itemsJson) {
        try {
            const parsed = JSON.parse(CONFIG.itemsJson);
            if (Array.isArray(parsed)) {
                return parsed.map(x => String(x || "").trim()).filter(Boolean);
            }
        } catch {
            // ignore
        }
    }
    return ["AK-47 | Redline (Field-Tested)", "AWP | Dragon Lore (Factory New)"];
}

process.on('message', async ({ chunk }) => {
    // Replace this URL with your preferred proxy list API if you have one
    const proxyRes = await axios.get('https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/http.txt');
    const proxyList = proxyRes.data.split('\n').filter(p => p.trim()).map(p => `http://${p.trim()}`);

    let results = [];
    const endpoint = `${CONFIG.siteUrl}/api/prizes/bulk-update`;

    for (const name of chunk) {
        const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
        let browser;

        try {
            browser = await puppeteer.launch({
                headless: "new",
                args: [`--proxy-server=${proxy}`, '--no-sandbox']
            });

            const page = await browser.newPage();
            const url = `https://steamcommunity.com/market/priceoverview/?appid=730&currency=${CONFIG.currency}&market_hash_name=${encodeURIComponent(name)}&v=${Math.random()}`;
            
            await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });
            const data = JSON.parse(await page.evaluate(() => document.body.innerText));

            if (data.success) {
                const price = parseFloat((data.lowest_price || data.median_price).replace(/[^0-9,.-]+/g, "").replace(",", "."));
                results.push({ name, price });
                process.send({ type: 'log', content: `Success: ${name} -> ${price}` });
            }
        } catch (e) {
            process.send({ type: 'log', content: `Failed: ${name} via ${proxy}` });
        } finally {
            if (browser) await browser.close();
        }

        // Push to server every 5 items
        if (results.length >= CONFIG.batchSize) {
            try {
                await axios.post(endpoint, { 
                    prices: results, 
                    currency: CONFIG.currency 
                }, {
                    headers: { Authorization: `Bearer ${CONFIG.myApiSecret}` }
                });
                console.log(">>> Batch synced to MongoDB");
                results = [];
            } catch (err) {
                console.error(">>> Database Sync Failed:", err.message);
            }
        }
    }

    if (results.length) {
        try {
            await axios.post(endpoint, { prices: results, currency: CONFIG.currency }, {
                headers: { Authorization: `Bearer ${CONFIG.myApiSecret}` }
            });
            console.log(">>> Final batch synced to MongoDB");
        } catch (err) {
            console.error(">>> Final database sync failed:", err.message);
        }
    }
    process.exit();
});