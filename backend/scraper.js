const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, 'cache.json');
let cache = { "645": {}, "655": {} };

// Load cache from file
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            const data = fs.readFileSync(CACHE_FILE, 'utf8');
            cache = JSON.parse(data);
            console.log(`Loaded cache: Mega 6/45 (${Object.keys(cache["645"]).length} draws), Power 6/55 (${Object.keys(cache["655"]).length} draws)`);
        } else {
            saveCache();
        }
    } catch (error) {
        console.error('Error loading cache:', error.message);
    }
}

// Save cache to file (chỉ lưu khi không phải production trên cloud)
function saveCache() {
    try {
        fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf8');
    } catch (error) {
        // Bỏ qua lỗi khi filesystem read-only (Render, Heroku, ...)
        if (process.env.NODE_ENV !== 'production') {
            console.error('Error saving cache:', error.message);
        }
    }
}

loadCache();

// Utility helper to add padding
function padDrawId(drawId) {
    return String(drawId).padStart(5, '0');
}

// Utility to convert date string "DD/MM/YYYY" to "YYYY-MM-DD"
function dateToYmd(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// Fetch headers - giả lập browser thật để tránh bị block
const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
    'Accept-Encoding': 'gzip, deflate, br',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Referer': 'https://vietlott.vn/',
    'sec-ch-ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'same-origin',
    'Upgrade-Insecure-Requests': '1',
};

// Sleep helper
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Wrap URL qua ScraperAPI nếu có API key (tránh bị Vietlott chặn IP)
function buildUrl(targetUrl) {
    const apiKey = process.env.SCRAPER_API_KEY;
    if (apiKey) {
        return `http://api.scraperapi.com?api_key=${apiKey}&url=${encodeURIComponent(targetUrl)}&country_code=vn`;
    }
    return targetUrl;
}

// Axios instance
const axiosInstance = axios.create({
    timeout: 30000,
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
});

// Retry wrapper - thử lại tối đa 3 lần nếu thất bại
async function fetchWithRetry(url, retries = 3) {
    const finalUrl = buildUrl(url);
    const useProxy = !!process.env.SCRAPER_API_KEY;

    for (let i = 0; i < retries; i++) {
        try {
            const response = await axiosInstance.get(finalUrl, {
                headers: useProxy ? {} : HEADERS, // ScraperAPI tự set headers
            });
            if (response.status === 200) return response;
            throw new Error(`HTTP ${response.status}`);
        } catch (err) {
            if (i < retries - 1) {
                const delay = (i + 1) * 1000;
                console.log(`Retry ${i + 1}/${retries} cho ${url} sau ${delay}ms...`);
                await sleep(delay);
            } else {
                throw err;
            }
        }
    }
}

/**
 * Fetch the latest draw ID from Vietlott site
 * @param {string} gameType - '645' or '655'
 */
async function fetchLatestDrawInfo(gameType) {
    const url = `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${gameType}`;
    try {
        const response = await fetchWithRetry(url);
        const $ = cheerio.load(response.data);
        
        let drawIdText = '';
        let drawDateText = '';

        // Look for headers containing draw details
        $('h5').each((i, el) => {
            const text = $(el).text().trim();
            // Match "Kỳ quay thưởng #01519 ngày 24/05/2026"
            const match = text.match(/Kỳ quay thưởng\s+#(\d+)\s+ngày\s+(\d{2}\/\d{2}\/\d{4})/i);
            if (match) {
                drawIdText = match[1];
                drawDateText = match[2];
            }
        });

        if (!drawIdText) {
            // Backup selector if standard h5 text doesn't match
            $('b').each((i, el) => {
                const text = $(el).text().trim();
                if (text.startsWith('#') && text.length === 6) {
                    drawIdText = text.substring(1);
                }
            });
        }

        const drawId = parseInt(drawIdText, 10);
        if (!drawId || isNaN(drawId)) {
            throw new Error(`Could not parse latest draw ID for game ${gameType}`);
        }

        return {
            drawId,
            dateStr: drawDateText,
            dateYmd: dateToYmd(drawDateText)
        };
    } catch (error) {
        console.error(`Error in fetchLatestDrawInfo for ${gameType}:`, error.message);
        throw error;
    }
}

/**
 * Fetch detail of a single drawing
 * @param {string} gameType - '645' or '655'
 * @param {number} drawId - Draw ID
 * @param {boolean} useCache - Whether to check local cache
 */
async function fetchDrawDetail(gameType, drawId, useCache = true) {
    if (useCache && cache[gameType] && cache[gameType][drawId]) {
        return cache[gameType][drawId];
    }

    const paddedId = padDrawId(drawId);
    const url = `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${gameType}?id=${paddedId}&nocatche=1`;
    
    // Add small delay to prevent blocking
    await sleep(300);

    try {
        const response = await fetchWithRetry(url);
        const $ = cheerio.load(response.data);

        // 1. Extract draw ID and date
        let drawIdParsed = null;
        let dateStr = '';
        $('h5').each((i, el) => {
            const text = $(el).text().trim();
            const match = text.match(/Kỳ quay thưởng\s+#(\d+)\s+ngày\s+(\d{2}\/\d{2}\/\d{4})/i);
            if (match) {
                drawIdParsed = parseInt(match[1], 10);
                dateStr = match[2];
            }
        });

        if (!drawIdParsed) {
            // Try fallback
            const h4Text = $('h4').text().trim();
            const bText = $('h5 b').first().text().trim();
            if (bText.startsWith('#')) {
                drawIdParsed = parseInt(bText.substring(1), 10);
            }
        }

        // 2. Extract winning numbers
        const numbers = [];
        if (gameType === '645') {
            $('.bong_tron').each((i, el) => {
                const num = $(el).text().trim();
                if (num) numbers.push(num);
            });
        } else if (gameType === '655') {
            $('.bong_tron.small').each((i, el) => {
                const num = $(el).text().trim();
                if (num) numbers.push(num);
            });
        }

        if (numbers.length === 0) {
            // Try generic class
            $('.bong_tron').each((i, el) => {
                const num = $(el).text().trim();
                if (num) numbers.push(num);
            });
        }

        // 3. Extract prize table
        const prizes = [];
        $('table tr').each((i, tr) => {
            if (i === 0) return; // Skip header row
            const cells = [];
            $(tr).find('td').each((j, td) => {
                cells.push($(td).text().replace(/\s+/g, ' ').trim());
            });
            if (cells.length >= 4) {
                prizes.push({
                    name: cells[0],
                    matching: cells[1],
                    count: parseInt(cells[2].replace(/\./g, ''), 10) || 0,
                    valueStr: cells[3],
                    value: parseInt(cells[3].replace(/\./g, ''), 10) || 0
                });
            }
        });

        // Validation check
        if (!drawIdParsed || numbers.length < 6) {
            throw new Error(`Parsed incomplete data for draw #${drawId} of game ${gameType}`);
        }

        const result = {
            drawId: drawIdParsed,
            drawIdStr: paddedId,
            dateStr,
            dateYmd: dateToYmd(dateStr),
            numbers,
            prizes,
            scrapedAt: new Date().toISOString()
        };

        // Save to cache
        cache[gameType][drawIdParsed] = result;
        saveCache();

        return result;
    } catch (error) {
        console.error(`Error fetching draw detail for ${gameType} #${drawId}:`, error.message);
        throw error;
    }
}

/**
 * Get date of a draw ID (using cache when possible)
 */
async function getDrawDateYmd(gameType, drawId) {
    if (cache[gameType] && cache[gameType][drawId]) {
        return cache[gameType][drawId].dateYmd;
    }
    try {
        const detail = await fetchDrawDetail(gameType, drawId, true);
        return detail.dateYmd;
    } catch (error) {
        // Return null if failed
        return null;
    }
}

/**
 * Find boundary draw ID for a date using binary search
 * @param {string} gameType - '645' or '655'
 * @param {string} targetDateYmd - Target date in YYYY-MM-DD format
 * @param {string} boundaryType - 'start' (first draw >= date) or 'end' (last draw <= date)
 * @param {number} latestId - The latest draw ID (upper bound)
 * @param {function} onProgress - Progress reporting callback
 */
async function findDrawIdForDate(gameType, targetDateYmd, boundaryType, latestId, onProgress) {
    let left = 1;
    let right = latestId;
    let ans = null;

    let step = 0;
    while (left <= right) {
        step++;
        const mid = Math.floor((left + right) / 2);
        
        if (onProgress) {
            onProgress(`Tìm kiếm kỳ quay (${boundaryType === 'start' ? 'Bắt đầu' : 'Kết thúc'}): Kiểm tra Kỳ #${mid}...`);
        }

        const midDateYmd = await getDrawDateYmd(gameType, mid);
        if (!midDateYmd) {
            // If we fail to fetch, adjust boundary slightly
            if (boundaryType === 'start') {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
            continue;
        }

        if (boundaryType === 'start') {
            if (midDateYmd >= targetDateYmd) {
                ans = mid;
                right = mid - 1; // Try to find an even smaller ID that is still >= targetDate
            } else {
                left = mid + 1;
            }
        } else { // boundaryType === 'end'
            if (midDateYmd <= targetDateYmd) {
                ans = mid;
                left = mid + 1; // Try to find a larger ID that is still <= targetDate
            } else {
                right = mid - 1;
            }
        }
    }

    // Default fallbacks if boundary not found
    if (ans === null) {
        if (boundaryType === 'start') {
            ans = 1;
        } else {
            ans = latestId;
        }
    }

    return ans;
}

module.exports = {
    fetchLatestDrawInfo,
    fetchDrawDetail,
    findDrawIdForDate,
    cache
};
