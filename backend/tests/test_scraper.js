const { fetchLatestDrawInfo, fetchDrawDetail, findDrawIdForDate } = require('../src/services/scraperService');
const db = require('../src/config/db');

async function test() {
    try {
        await db.initDb();
        console.log('--- TEST 1: Fetch Latest Draw Info (Mega 6/45) ---');
        const latestMega = await fetchLatestDrawInfo('645');
        console.log('Latest Mega:', latestMega);

        console.log('\n--- TEST 2: Fetch Draw Detail (Mega #1524) ---');
        const detailMega = await fetchDrawDetail('645', 1524, false);
        console.log('Mega Draw 1524 details:', {
            drawId: detailMega.drawId,
            dateStr: detailMega.dateStr,
            numbers: detailMega.numbers,
            jackpotWinners: detailMega.prizes[0]
        });

        console.log('\n--- TEST 3: Fetch Draw Detail (Power #1360) ---');
        const detailPower = await fetchDrawDetail('655', 1360, false);
        console.log('Power Draw 1360 details:', {
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

        console.log('\n--- TEST 5: Fetch Draw Detail from XSKT directly (Mega #1530) ---');
        console.log('Cào từ XSKT trực tiếp (sẽ tải trang XSKT và lưu cache)...');
        const detail1530 = await fetchDrawDetail('645', 1530, false, true); // forceXskt = true
        console.log('Mega Draw 1530 details:', {
            drawId: detail1530.drawId,
            dateStr: detail1530.dateStr,
            numbers: detail1530.numbers
        });

        console.log('\n--- TEST 6: Fetch Draw Detail from XSKT Cache (Mega #1531) ---');
        console.log('Cào từ XSKT trực tiếp (kỳ này phải được trả về từ cache, không gọi HTTP tới XSKT)...');
        const detail1531 = await fetchDrawDetail('645', 1531, false, true); // forceXskt = true
        console.log('Mega Draw 1531 details:', {
            drawId: detail1531.drawId,
            dateStr: detail1531.dateStr,
            numbers: detail1531.numbers
        });

        console.log('\n--- TEST 7: Fallback to Vietlott when XSKT fails (Mega #1000) ---');
        console.log('Cào kỳ cũ (#1000) với forceXskt = true (sẽ lỗi ở XSKT, tự fallback sang Vietlott)...');
        const detail1000 = await fetchDrawDetail('645', 1000, false, true); // forceXskt = true
        console.log('Mega Draw 1000 details:', {
            drawId: detail1000.drawId,
            dateStr: detail1000.dateStr,
            numbers: detail1000.numbers
        });

    } catch (e) {
        console.error('Test failed:', e);
    }
}

test();
