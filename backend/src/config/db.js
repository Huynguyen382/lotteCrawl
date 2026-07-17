const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Nạp cấu hình biến môi trường từ file .env ở thư mục backend
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const CACHE_FILE = path.join(__dirname, '..', '..', 'cache.json');
const connectionString = process.env.DATABASE_URL;
const onlineConnectionString = process.env.ONLINE_DATABASE_URL;

let pool = null;
let usePostgres = false;
let onlinePool = null;
let localCache = { "645": {}, "655": {}, "535": {} };


function loadLocalCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            localCache = JSON.parse(data);
            if (!localCache["645"]) localCache["645"] = {};
            if (!localCache["655"]) localCache["655"] = {};
            if (!localCache["535"]) localCache["535"] = {};
            console.log(`[db-local] Loaded local JSON cache: Mega 6/45 (${Object.keys(localCache["645"] || {}).length} draws), Power 6/55 (${Object.keys(localCache["655"] || {}).length} draws), Lotto 5/35 (${Object.keys(localCache["535"] || {}).length} draws)`);
        } else {
            saveLocalCache();
        }
    } catch (error) {
        console.error('[db-local] Error loading local cache:', error.message);
    }
}

function saveLocalCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(localCache, null, 2), 'utf8');
    } catch (error) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[db-local] Error saving local cache:', error.message);
        }
    }
}

async function initDb() {
    if (connectionString) {
        console.log('[db] DATABASE_URL is configured. Attempting to connect to PostgreSQL...');
        try {
            const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
            const poolConfig = {
                connectionString: connectionString
            };
            if (!isLocalhost) {
                poolConfig.ssl = {
                    rejectUnauthorized: false
                };
            }
            pool = new Pool(poolConfig);
            
            // Check connection
            await pool.query('SELECT NOW()');
            usePostgres = true;
            console.log('[db] Successfully connected to PostgreSQL.');

            // Create table
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
            await pool.query(createTableQuery);
            console.log('[db] Database schema verified (draw_results table ready).');

            // Populate in-memory cache from PostgreSQL
            console.log('[db] Loading all draw results from PostgreSQL into in-memory cache...');
            const allRes = await pool.query(
                `SELECT game, draw_id as "drawId", draw_id_str as "drawIdStr", date_str as "dateStr", date_ymd as "dateYmd", numbers, prizes, scraped_at as "scrapedAt"
                 FROM draw_results`
            );
            
            localCache = { "645": {}, "655": {}, "535": {} };
            allRes.rows.forEach(row => {
                const gameType = row.game;
                const id = parseInt(row.drawId, 10);
                if (!localCache[gameType]) localCache[gameType] = {};
                localCache[gameType][id] = {
                    drawId: id,
                    drawIdStr: row.drawIdStr,
                    dateStr: row.dateStr,
                    dateYmd: row.dateYmd,
                    numbers: typeof row.numbers === 'string' ? JSON.parse(row.numbers) : row.numbers,
                    prizes: typeof row.prizes === 'string' ? JSON.parse(row.prizes) : row.prizes,
                    scrapedAt: row.scrapedAt
                };
            });
            console.log(`[db] Successfully cached ${allRes.rows.length} rows in memory.`);
        } catch (error) {
            console.error('[db] Error connecting to PostgreSQL, falling back to local cache:', error.message);
            pool = null;
            usePostgres = false;
            loadLocalCache();
        }
    } else {
        console.log('[db] DATABASE_URL not set. Running in local fallback mode (cache.json).');
        usePostgres = false;
        loadLocalCache();
    }

    // Khởi tạo cơ sở dữ liệu online và đồng bộ delta bất đồng bộ
    await initOnlineDb();
}

async function initOnlineDb() {
    if (onlineConnectionString) {
        console.log('[db-sync] ONLINE_DATABASE_URL is configured. Attempting to connect to Online PostgreSQL...');
        try {
            const isLocalhost = onlineConnectionString.includes('localhost') || onlineConnectionString.includes('127.0.0.1');
            const poolConfig = {
                connectionString: onlineConnectionString
            };
            if (!isLocalhost) {
                poolConfig.ssl = {
                    rejectUnauthorized: false
                };
            }
            onlinePool = new Pool(poolConfig);
            
            // Kiểm tra kết nối
            await onlinePool.query('SELECT NOW()');
            console.log('[db-sync] Successfully connected to Online PostgreSQL.');

            // Đảm bảo bảng đích tồn tại trên online DB
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
            await onlinePool.query(createTableQuery);
            console.log('[db-sync] Online database schema verified (draw_results table ready).');
            
            // Kích hoạt đồng bộ hóa delta bất đồng bộ (non-blocking)
            syncLocalToOnline().catch(err => {
                console.error('[db-sync] Error in background delta sync:', err.message);
            });
        } catch (error) {
            console.error('[db-sync] Error connecting to Online PostgreSQL:', error.message);
            onlinePool = null;
        }
    } else {
        console.log('[db-sync] ONLINE_DATABASE_URL not set. Running without online DB sync.');
    }
}

async function saveToOnlineDbInternal(game, draw) {
    if (!onlinePool || !draw || !draw.drawId) return false;
    const id = parseInt(draw.drawId, 10);
    try {
        const numbersStr = typeof draw.numbers === 'string' ? draw.numbers : JSON.stringify(draw.numbers);
        const prizesStr = typeof draw.prizes === 'string' ? draw.prizes : JSON.stringify(draw.prizes);
        
        await onlinePool.query(
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
                game,
                id,
                draw.drawIdStr || String(id).padStart(5, '0'),
                draw.dateStr,
                draw.dateYmd,
                numbersStr,
                prizesStr,
                draw.scrapedAt || new Date().toISOString()
            ]
        );
        return true;
    } catch (error) {
        console.error(`[db-sync] Error saving draw ${game} #${id} to online DB:`, error.message);
        return false;
    }
}

async function syncLocalToOnline() {
    if (!onlinePool) return;
    console.log('[db-sync] Starting delta scan: comparing local vs online database...');
    try {
        // Lấy danh sách metadata của các kỳ quay hiện có trên online DB
        const onlineRes = await onlinePool.query('SELECT game, draw_id as "drawId" FROM draw_results');
        const onlineKeys = new Set(onlineRes.rows.map(r => `${r.game}_${r.drawId}`));
        console.log(`[db-sync] Online DB has ${onlineKeys.size} records.`);

        // Thu thập toàn bộ dữ liệu local
        let localDraws = [];
        if (usePostgres && pool) {
            const localRes = await pool.query(
                `SELECT game, draw_id as "drawId", draw_id_str as "drawIdStr", date_str as "dateStr", date_ymd as "dateYmd", numbers, prizes, scraped_at as "scrapedAt" FROM draw_results`
            );
            localDraws = localRes.rows;
        } else {
            // Đọc từ local cache file
            for (const game of ['645', '655', '535']) {
                const gameCache = localCache[game] || {};
                for (const drawId of Object.keys(gameCache)) {
                    const draw = gameCache[drawId];
                    localDraws.push({
                        game,
                        drawId: draw.drawId,
                        drawIdStr: draw.drawIdStr,
                        dateStr: draw.dateStr,
                        dateYmd: draw.dateYmd,
                        numbers: draw.numbers,
                        prizes: draw.prizes,
                        scrapedAt: draw.scrapedAt
                    });
                }
            }
        }
        console.log(`[db-sync] Local DB/Cache has ${localDraws.length} records.`);

        // Lọc ra danh sách các kỳ quay chưa có trên online
        const missingDraws = localDraws.filter(d => !onlineKeys.has(`${d.game}_${d.drawId}`));

        if (missingDraws.length > 0) {
            console.log(`[db-sync] Found ${missingDraws.length} missing draws on online database. Starting synchronization...`);
            let successCount = 0;
            for (const draw of missingDraws) {
                const success = await saveToOnlineDbInternal(draw.game, draw);
                if (success) {
                    successCount++;
                }
                if (successCount % 100 === 0) {
                    // Giải phóng event loop để tránh nghẽn thread nếu có quá nhiều bản ghi đồng bộ
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }
            console.log(`[db-sync] Delta synchronization completed: ${successCount}/${missingDraws.length} draws successfully synced.`);
        } else {
            console.log('[db-sync] Online database is fully synchronized. No missing records found.');
        }
    } catch (error) {
        console.error('[db-sync] Error running delta scan:', error.message);
    }
}

async function query(text, params) {
    if (usePostgres && pool) {
        return pool.query(text, params);
    }
    throw new Error('Database not initialized or not running in Postgres mode');
}

async function getDraw(game, drawId) {
    const id = parseInt(drawId, 10);
    return localCache[game]?.[id] || null;
}

async function saveDraw(game, draw) {
    if (!draw || !draw.drawId) return false;
    const id = parseInt(draw.drawId, 10);
    
    // Luôn ghi vào in-memory cache trước
    if (!localCache[game]) localCache[game] = {};
    localCache[game][id] = {
        drawId: id,
        drawIdStr: draw.drawIdStr || String(id).padStart(5, '0'),
        dateStr: draw.dateStr,
        dateYmd: draw.dateYmd,
        numbers: draw.numbers,
        prizes: draw.prizes,
        scrapedAt: draw.scrapedAt || new Date().toISOString()
    };

    if (usePostgres && pool) {
        try {
            await pool.query(
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
                    game,
                    id,
                    draw.drawIdStr || String(id).padStart(5, '0'),
                    draw.dateStr,
                    draw.dateYmd,
                    JSON.stringify(draw.numbers),
                    JSON.stringify(draw.prizes),
                    draw.scrapedAt || new Date().toISOString()
                ]
            );
            
            // Đồng bộ sang online DB bất đồng bộ (non-blocking)
            if (onlinePool) {
                saveToOnlineDbInternal(game, draw).catch(err => {
                    console.error(`[db-sync] Background sync error for draw ${game} #${id}:`, err.message);
                });
            }
            return true;
        } catch (error) {
            console.error(`[db] Error saving draw ${game} #${id}:`, error.message);
            return false;
        }
    } else {
        saveLocalCache();
        
        // Đồng bộ sang online DB bất đồng bộ (non-blocking)
        if (onlinePool) {
            saveToOnlineDbInternal(game, draw).catch(err => {
                console.error(`[db-sync] Background sync error for draw ${game} #${id}:`, err.message);
            });
        }
        return true;
    }
}

async function deleteDraw(game, drawId) {
    const id = parseInt(drawId, 10);
    
    // Luôn xóa khỏi in-memory cache trước
    if (localCache[game] && localCache[game][id]) {
        delete localCache[game][id];
    }

    if (usePostgres && pool) {
        try {
            await pool.query(
                'DELETE FROM draw_results WHERE game = $1 AND draw_id = $2',
                [game, id]
            );
            if (onlinePool) {
                onlinePool.query(
                    'DELETE FROM draw_results WHERE game = $1 AND draw_id = $2',
                    [game, id]
                ).catch(err => {
                    console.error(`[db-sync] Background delete error for draw ${game} #${id}:`, err.message);
                });
            }
            return true;
        } catch (error) {
            console.error(`[db] Error deleting draw ${game} #${id}:`, error.message);
            return false;
        }
    } else {
        saveLocalCache();
        if (onlinePool) {
            onlinePool.query(
                'DELETE FROM draw_results WHERE game = $1 AND draw_id = $2',
                [game, id]
            ).catch(err => {
                console.error(`[db-sync] Background delete error for draw ${game} #${id}:`, err.message);
            });
        }
        return true;
    }
}

async function getLatestDraw(game) {
    const gameCache = localCache[game] || {};
    const ids = Object.keys(gameCache).map(id => parseInt(id, 10));
    if (ids.length === 0) return null;
    const maxId = Math.max(...ids);
    return gameCache[maxId];
}

async function getDrawsInRange(game, startId, endId) {
    const sId = parseInt(startId, 10);
    const eId = parseInt(endId, 10);
    const gameCache = localCache[game] || {};
    const results = [];
    for (let id = sId; id <= eId; id++) {
        if (gameCache[id]) {
            results.push(gameCache[id]);
        }
    }
    return results;
}

async function getAllDrawsMetadata(game) {
    const gameCache = localCache[game] || {};
    return Object.keys(gameCache).map(id => {
        const idInt = parseInt(id, 10);
        return {
            drawId: idInt,
            dateYmd: gameCache[id].dateYmd
        };
    }).sort((a, b) => a.drawId - b.drawId);
}

module.exports = {
    initDb,
    query,
    getDraw,
    saveDraw,
    deleteDraw,
    getLatestDraw,
    getDrawsInRange,
    getAllDrawsMetadata,
    isPostgres: () => usePostgres,
    getLocalCache: () => localCache
};
