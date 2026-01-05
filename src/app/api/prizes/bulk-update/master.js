const { fork } = require('child_process');
const axios = require('axios');

const CONFIG = {
    secret: "2a6d54a2cd2e12e5835412b9685fee46d751d4533c04ca5a6d002fdd3ab7bf51",
    base: "https://www.skinvaults.online",
    currency: 3,
    workerCount: 5,
    itemsPerWorker: 50
};

async function getChunk() {
    try {
        // Added force=true to the URL to make sure it doesn't return 0 if cache is broken
        const url = `${CONFIG.base}/api/cron/market-prices?limit=${CONFIG.itemsPerWorker}&currency=${CONFIG.currency}&force=false`;
        const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${CONFIG.secret}` } });
        return res.data.names || [];
    } catch (e) {
        console.log("API not responding, retrying...");
        return [];
    }
}

async function spawnWorker() {
    const chunk = await getChunk();
    if (chunk.length === 0) {
        console.log("No items to process. Retrying in 30s...");
        setTimeout(spawnWorker, 30000);
        return;
    }

    const worker = fork('./worker.js');
    worker.send({ chunk, config: CONFIG });

    worker.on('message', (msg) => {
        if (msg.type === 'log') console.log(`[Worker] ${msg.content}`);
    });

    worker.on('exit', () => {
        console.log("Worker batch finished. Spawning next...");
        spawnWorker(); // Keeps the cycle going infinitely
    });
}

console.log("=== Starting Master Engine ===");
for (let i = 0; i < CONFIG.workerCount; i++) {
    spawnWorker();
}