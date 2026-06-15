const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Nạp cấu hình từ file .env ở thư mục hiện tại để lấy DATABASE_URL của local
require('dotenv').config({ path: path.join(__dirname, '.env') });

async function run() {
    const localUrl = process.env.DATABASE_URL;
    const renderUrl = process.env.RENDER_DATABASE_URL || process.argv[2];

    if (!localUrl) {
        console.error('❌ LỖI: Không tìm thấy DATABASE_URL local trong file .env.');
        process.exit(1);
    }

    if (!renderUrl) {
        console.error('❌ LỖI: Vui lòng truyền URL cơ sở dữ liệu Render.');
        console.log('Cách chạy: node sync_pg_to_pg.js <RENDER_DATABASE_URL>');
        process.exit(1);
    }

    console.log('🔌 Đang kết nối tới PostgreSQL Local...');
    const localPool = new Pool({ connectionString: localUrl });

    console.log('🔌 Đang kết nối tới PostgreSQL Render...');
    const renderPool = new Pool({
        connectionString: renderUrl,
        ssl: { rejectUnauthorized: false }
    });

    try {
        // Kiểm tra kết nối
        await localPool.query('SELECT NOW()');
        await renderPool.query('SELECT NOW()');
        console.log('✓ Kết nối tới cả hai database thành công!');

        // Đảm bảo bảng đích trên Render tồn tại
        const createTableQuery = `
            CREATE TABLE IF NOT EXISTS draw_results (
                 game VARCHAR(10) NOT NULL,
                 draw_id INT NOT NULL,
                 draw_id_str VARCHAR(10) NOT NULL,
                 date_str VARCHAR(20) NOT NULL,
                 date_ymd VARCHAR(20) NOT NULL,
                 numbers JSONB NOT NULL,
                 prizes JSONB NOT NULL,
                 scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                 PRIMARY KEY (game, draw_id)
            );
            CREATE INDEX IF NOT EXISTS idx_draw_results_date_ymd ON draw_results(game, date_ymd);
        `;
        await renderPool.query(createTableQuery);
        console.log('✓ Cấu trúc bảng trên Render đã sẵn sàng.');

        console.log('📦 Đang tải toàn bộ dữ liệu lịch sử từ Local...');
        const res = await localPool.query('SELECT * FROM draw_results');
        const rows = res.rows;
        console.log(`✓ Tìm thấy ${rows.length} bản ghi lịch sử ở Local.`);

        if (rows.length === 0) {
            console.log('Không có dữ liệu local để đồng bộ.');
            process.exit(0);
        }

        console.log(`⏳ Bắt đầu truyền dữ liệu lên Render (${rows.length} bản ghi)...`);
        let successCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            try {
                await renderPool.query(
                    `INSERT INTO draw_results (game, draw_id, draw_id_str, date_str, date_ymd, numbers, prizes, scraped_at)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                      ON CONFLICT (game, draw_id) 
                      DO UPDATE SET 
                         draw_id_str = EXCLUDED.draw_id_str,
                         date_str = EXCLUDED.date_str,
                         date_ymd = EXCLUDED.date_ymd,
                         numbers = EXCLUDED.numbers,
                         prizes = EXCLUDED.prizes,
                         scraped_at = EXCLUDED.scraped_at`,
                    [
                        row.game,
                        row.draw_id,
                        row.draw_id_str,
                        row.date_str,
                        row.date_ymd,
                        JSON.stringify(row.numbers),
                        JSON.stringify(row.prizes),
                        row.scraped_at
                    ]
                );
                successCount++;
                if (successCount % 200 === 0) {
                    console.log(`Đã tải lên thành công ${successCount}/${rows.length} bản ghi...`);
                }
            } catch (err) {
                console.error(`❌ Lỗi tại bản ghi ${row.game} #${row.draw_id}:`, err.message);
            }
        }

        console.log(`\n🎉 Hoàn tất! Đã đồng bộ thành công ${successCount}/${rows.length} bản ghi từ PostgreSQL Local lên Render.`);
    } catch (err) {
        console.error('❌ Lỗi kết nối hoặc thực thi:', err.message);
    } finally {
        await localPool.end();
        await renderPool.end();
    }
}

run();
