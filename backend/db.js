const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Nạp cấu hình biến môi trường từ file .env ở thư mục backend
require('dotenv').config({ path: path.join(__dirname, '.env') });

const CACHE_FILE = path.join(__dirname, 'cache.json');
const connectionString = process.env.DATABASE_URL;

let pool = null;
let usePostgres = false;
let localCache = { "645": {}, "655": {} };

function loadLocalCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            localCache = JSON.parse(data);
            console.log(`[db-local] Loaded local JSON cache: Mega 6/45 (${Object.keys(localCache["645"] || {}).length} draws), Power 6/55 (${Object.keys(localCache["655"] || {}).length} draws)`);
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
}

async function query(text, params) {
    if (usePostgres && pool) {
        return pool.query(text, params);
    }
    throw new Error('Database not initialized or not running in Postgres mode');
}

async function getDraw(game, drawId) {
    const id = parseInt(drawId, 10);
    if (usePostgres && pool) {
        try {
            const res = await pool.query(
                'SELECT draw_id as "drawId", draw_id_str as "drawIdStr", date_str as "dateStr", date_ymd as "dateYmd", numbers, prizes, scraped_at as "scrapedAt" FROM draw_results WHERE game = $1 AND draw_id = $2',
                [game, id]
            );
            if (res.rows.length > 0) {
                return res.rows[0];
            }
            return null;
        } catch (error) {
            console.error(`[db] Error getting draw ${game} #${id}:`, error.message);
            return null;
        }
    } else {
        return localCache[game]?.[id] || null;
    }
}

async function saveDraw(game, draw) {
    if (!draw || !draw.drawId) return false;
    const id = parseInt(draw.drawId, 10);
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
            return true;
        } catch (error) {
            console.error(`[db] Error saving draw ${game} #${id}:`, error.message);
            return false;
        }
    } else {
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
        saveLocalCache();
        return true;
    }
}

async function getLatestDraw(game) {
    if (usePostgres && pool) {
        try {
            const res = await pool.query(
                'SELECT draw_id as "drawId", draw_id_str as "drawIdStr", date_str as "dateStr", date_ymd as "dateYmd", numbers, prizes, scraped_at as "scrapedAt" FROM draw_results WHERE game = $1 ORDER BY draw_id DESC LIMIT 1',
                [game]
            );
            if (res.rows.length > 0) {
                return res.rows[0];
            }
            return null;
        } catch (error) {
            console.error(`[db] Error getting latest draw for game ${game}:`, error.message);
            return null;
        }
    } else {
        const gameCache = localCache[game] || {};
        const ids = Object.keys(gameCache).map(id => parseInt(id, 10));
        if (ids.length === 0) return null;
        const maxId = Math.max(...ids);
        return gameCache[maxId];
    }
}

async function getDrawsInRange(game, startId, endId) {
    const sId = parseInt(startId, 10);
    const eId = parseInt(endId, 10);
    if (usePostgres && pool) {
        try {
            const res = await pool.query(
                `SELECT draw_id as "drawId", draw_id_str as "drawIdStr", date_str as "dateStr", date_ymd as "dateYmd", numbers, prizes, scraped_at as "scrapedAt" 
                 FROM draw_results 
                 WHERE game = $1 AND draw_id >= $2 AND draw_id <= $3 
                 ORDER BY draw_id ASC`,
                [game, sId, eId]
            );
            return res.rows;
        } catch (error) {
            console.error(`[db] Error getting draws in range for game ${game} [${sId}, ${eId}]:`, error.message);
            return [];
        }
    } else {
        const gameCache = localCache[game] || {};
        const results = [];
        for (let id = sId; id <= eId; id++) {
            if (gameCache[id]) {
                results.push(gameCache[id]);
            }
        }
        return results;
    }
}

async function getAllDrawsMetadata(game) {
    if (usePostgres && pool) {
        try {
            const res = await pool.query(
                'SELECT draw_id as "drawId", date_ymd as "dateYmd" FROM draw_results WHERE game = $1 ORDER BY draw_id ASC',
                [game]
            );
            return res.rows;
        } catch (error) {
            console.error(`[db] Error getting all draws metadata for game ${game}:`, error.message);
            return [];
        }
    } else {
        const gameCache = localCache[game] || {};
        return Object.keys(gameCache).map(id => {
            const idInt = parseInt(id, 10);
            return {
                drawId: idInt,
                dateYmd: gameCache[id].dateYmd
            };
        }).sort((a, b) => a.drawId - b.drawId);
    }
}

module.exports = {
    initDb,
    query,
    getDraw,
    saveDraw,
    getLatestDraw,
    getDrawsInRange,
    getAllDrawsMetadata,
    isPostgres: () => usePostgres,
    getLocalCache: () => localCache
};
