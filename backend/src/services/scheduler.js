const cron = require('node-cron');
const db = require('../config/db');
const { fetchLatestDrawInfo, fetchDrawDetail } = require('./scraperService');

// Tự động kiểm tra và cào kỳ quay mới để cập nhật DB
async function autoUpdateCache() {
    try {
        console.log('[auto-crawl] Bắt đầu tự động kiểm tra kỳ quay mới trên Vietlott...');
        for (const game of ['645', '655', '535']) {
            const latestInfo = await fetchLatestDrawInfo(game);
            const latestId = latestInfo.drawId;
            
            const existing = await db.getDraw(game, latestId);
            if (!existing) {
                console.log(`[auto-crawl] Phát hiện kỳ mới #${latestId} của game ${game} chưa có trong DB. Tiến hành cào...`);
                await fetchDrawDetail(game, latestId, false); // Cào và lưu vào DB
                console.log(`[auto-crawl] Tự động cập nhật DB thành công kỳ #${latestId} cho game ${game}`);
            }
        }
        console.log('[auto-crawl] Hoàn tất kiểm tra kỳ quay mới.');
    } catch (e) {
        console.error('[auto-crawl] Lỗi tự động cập nhật DB:', e.message);
    }
}

function startScheduler() {
    // Lập lịch tự động cào lúc 19:00 hàng ngày từ Thứ 3 đến Chủ Nhật (Múi giờ Việt Nam)
    cron.schedule('0 19 * * 0,2,3,4,5,6', () => {
        console.log('[cron] Bắt đầu tự động cào kết quả Vietlott lúc 19h (Thứ 3 -> Chủ nhật)...');
        autoUpdateCache();
    }, {
        scheduled: true,
        timezone: 'Asia/Ho_Chi_Minh'
    });

    // Chạy kiểm tra kỳ quay mới lần đầu tiên sau 10 giây khi server khởi động
    setTimeout(autoUpdateCache, 10000);

    // Chạy tự động kiểm tra định kỳ mỗi 1 tiếng
    setInterval(autoUpdateCache, 60 * 60 * 1000);
}

module.exports = {
    startScheduler,
    autoUpdateCache
};
