const db = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function sync() {
    // Khởi tạo DB (sẽ kết nối tới Postgres nếu có DATABASE_URL)
    await db.initDb();
    
    if (!db.isPostgres()) {
        console.error('❌ LỖI: Hệ thống đang chạy ở chế độ fallback cache.json. Vui lòng thiết lập biến môi trường DATABASE_URL trước khi chạy đồng bộ.');
        process.exit(1);
    }

    // Đọc cache.json hiện tại
    const CACHE_FILE = path.join(__dirname, 'cache.json');
    if (!fs.existsSync(CACHE_FILE)) {
        console.error('❌ LỖI: Không tìm thấy file cache.json để đồng bộ.');
        process.exit(1);
    }

    const cacheData = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
    console.log('📦 Bắt đầu đồng bộ dữ liệu lịch sử từ cache.json vào PostgreSQL...');

    for (const game of ['645', '655', '535']) {
        const draws = cacheData[game] || {};
        const drawIds = Object.keys(draws).map(id => parseInt(id, 10)).sort((a, b) => a - b);
        console.log(`\n🔄 Đang đồng bộ game ${game} (${drawIds.length} kỳ quay)...`);
        
        let successCount = 0;
        // Sử dụng giao dịch hoặc insert tuần tự (vì chạy một lần)
        for (const drawId of drawIds) {
            const draw = draws[drawId];
            const success = await db.saveDraw(game, draw);
            if (success) {
                successCount++;
            }
        }
        console.log(`✓ Đã đồng bộ thành công ${successCount}/${drawIds.length} kỳ quay cho game ${game}.`);
    }

    console.log('\n🎉 Hoàn tất đồng bộ dữ liệu lịch sử vào PostgreSQL thành công!');
    process.exit(0);
}

sync().catch(err => {
    console.error('❌ Lỗi hệ thống trong quá trình đồng bộ:', err.message);
    process.exit(1);
});
