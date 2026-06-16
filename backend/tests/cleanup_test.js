const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function verifyAndCleanup() {
    const localPool = new Pool({ connectionString: process.env.DATABASE_URL });
    const onlinePool = new Pool({
        connectionString: process.env.ONLINE_DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        console.log('--- Kiểm tra bản ghi test #99999 ---');
        
        const localRes = await localPool.query("SELECT * FROM draw_results WHERE draw_id = 99999");
        console.log(`Tìm thấy ở Local: ${localRes.rows.length} bản ghi.`);
        if (localRes.rows.length > 0) {
            console.log('Dữ liệu local:', JSON.stringify(localRes.rows[0]));
        }

        const onlineRes = await onlinePool.query("SELECT * FROM draw_results WHERE draw_id = 99999");
        console.log(`Tìm thấy ở Online: ${onlineRes.rows.length} bản ghi.`);
        if (onlineRes.rows.length > 0) {
            console.log('Dữ liệu online:', JSON.stringify(onlineRes.rows[0]));
        }

        console.log('--- Bắt đầu xóa bản ghi test #99999 ---');
        await localPool.query("DELETE FROM draw_results WHERE draw_id = 99999");
        await onlinePool.query("DELETE FROM draw_results WHERE draw_id = 99999");
        console.log('✓ Đã xóa bản ghi test thành công ở cả 2 database!');
        
    } catch (err) {
        console.error('Lỗi khi chạy cleanup:', err.message);
    } finally {
        await localPool.end();
        await onlinePool.end();
        process.exit(0);
    }
}

verifyAndCleanup();
