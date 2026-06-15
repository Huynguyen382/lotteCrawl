const { fetchLatestDrawInfo, fetchDrawDetail } = require('../src/services/scraperService');
const db = require('../src/config/db');

async function runTest() {
    console.log('--- KIỂM TRA SCRAPER VỚI CÁC CẤU HÌNH ---');
    console.log('GAS_PROXY_URL:', process.env.GAS_PROXY_URL || '(Không set)');
    console.log('HTTP_PROXY:', process.env.HTTP_PROXY || '(Không set)');
    console.log('SCRAPER_API_KEY:', process.env.SCRAPER_API_KEY ? '***' : '(Không set)');
    console.log('NODE_ENV:', process.env.NODE_ENV);

    try {
        await db.initDb();
        console.log('\n1. Thử cào thông tin kỳ mới nhất Mega 6/45...');
        const info = await fetchLatestDrawInfo('645');
        console.log('Thành công! Kết quả:', info);

        console.log('\n2. Thử cào chi tiết kỳ 1000...');
        const detail = await fetchDrawDetail('645', 1000, false); // false để force fetch không dùng cache
        console.log('Thành công! Chi tiết kỳ 1000:', {
            drawId: detail.drawId,
            dateStr: detail.dateStr,
            numbers: detail.numbers
        });
    } catch (e) {
        console.error('Lỗi khi cào:', e.message);
    }
}

runTest();
