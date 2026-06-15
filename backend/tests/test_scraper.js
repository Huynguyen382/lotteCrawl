const { fetchLatestDrawInfo, fetchDrawDetail, findDrawIdForDate } = require('../src/services/scraperService');
const db = require('../src/config/db');

async function test() {
    try {
        await db.initDb();
        console.log('--- TEST 1: Fetch Latest Draw Info (Mega 6/45) ---');
        const latestMega = await fetchLatestDrawInfo('645');
        console.log('Latest Mega:', latestMega);

        console.log('\n--- TEST 2: Fetch Draw Detail (Mega #1200) ---');
        const detailMega = await fetchDrawDetail('645', 1200);
        console.log('Mega Draw 1200 details:', {
            drawId: detailMega.drawId,
            dateStr: detailMega.dateStr,
            numbers: detailMega.numbers,
            jackpotWinners: detailMega.prizes[0]
        });

        console.log('\n--- TEST 3: Fetch Draw Detail (Power #1000) ---');
        const detailPower = await fetchDrawDetail('655', 1000);
        console.log('Power Draw 1000 details:', {
            drawId: detailPower.drawId,
            dateStr: detailPower.dateStr,
            numbers: detailPower.numbers,
            jackpot1Winners: detailPower.prizes[0],
            jackpot2Winners: detailPower.prizes[1]
        });

        console.log('\n--- TEST 4: Binary Search Draw ID for Date 2024-05-19 (Mega 6/45) ---');
        console.log('Searching for Mega 6/45 draw on or after 2024-05-19...');
        const drawId = await findDrawIdForDate('645', '2024-05-19', 'start', latestMega.drawId, console.log);
        console.log('Result Draw ID:', drawId);
        const drawDetail = await fetchDrawDetail('645', drawId);
        console.log('Draw Detail at found ID:', {
            drawId: drawDetail.drawId,
            dateStr: drawDetail.dateStr,
            numbers: drawDetail.numbers
        });

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
