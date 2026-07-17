const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const { HttpsProxyAgent } = require('https-proxy-agent');
const db = require('../config/db');

// In-memory cache for parsed XSKT draws to avoid redundant HTTP requests
const xsktParsedCache = {
    '645': null,
    '655': null,
    '535': null
};

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

// Wrap URL qua Proxy để tránh bị Vietlott chặn IP
function buildUrl(targetUrl) {
    const scrapeDoApiKey = process.env.SCRAPEDO_API_KEY;
    const gasProxyUrl = process.env.GAS_PROXY_URL;
    const scraperApiKey = process.env.SCRAPER_API_KEY;
    const isProduction = process.env.NODE_ENV === 'production';
    
    // 1. Ưu tiên hàng đầu cho Online 100% bypass Cloudflare: Scrape.do (Free 1,000 requests/tháng)
    if (scrapeDoApiKey) {
        console.log(`[proxy] Sử dụng Scrape.do Proxy cho: ${targetUrl}`);
        return `https://api.scrape.do?token=${scrapeDoApiKey}&url=${encodeURIComponent(targetUrl)}`;
    }
    
    // 2. Google Apps Script Proxy hoặc Local Bridge Proxy
    if (gasProxyUrl) {
        console.log(`[proxy] Sử dụng Web/Local Bridge Proxy cho: ${targetUrl}`);
        const baseProxy = gasProxyUrl.replace(/\/+$/, '');
        return `${baseProxy}?url=${encodeURIComponent(targetUrl)}`;
    }
    
    // 3. ScraperAPI (chỉ dùng khi production và có key)
    if (isProduction && scraperApiKey) {
        console.log(`[proxy] Production + API key → Dùng ScraperAPI cho: ${targetUrl}`);
        return `http://api.scraperapi.com?api_key=${scraperApiKey}&url=${encodeURIComponent(targetUrl)}&country_code=vn`;
    }
    
    // 4. Dev hoặc production không cấu hình proxy → gọi thẳng
    if (!isProduction) {
        console.log(`[direct] Dev mode → Gọi thẳng: ${targetUrl} (IP VN không bị block)`);
    } else {
        console.log(`[direct] Production không có proxy → Gọi thẳng: ${targetUrl}`);
    }
    return targetUrl;
}

// Axios instance
const axiosInstance = axios.create({
    timeout: 60000,  // 60s - ScraperAPI/GAS/Scrape.do có thể chậm
    maxRedirects: 5,
    validateStatus: (status) => status < 500,
});

// Retry wrapper - thử lại tối đa 3 lần nếu thất bại
async function fetchWithRetry(url, retries = 3) {
    const finalUrl = buildUrl(url);
    const useScrapeDo = !!process.env.SCRAPEDO_API_KEY;
    const useGasProxy = !useScrapeDo && !!process.env.GAS_PROXY_URL;
    const useScraperApi = !useScrapeDo && !useGasProxy && !!process.env.SCRAPER_API_KEY;
    const httpProxy = process.env.HTTP_PROXY;

    let agent = undefined;
    if (!useScrapeDo && !useGasProxy && !useScraperApi && httpProxy) {
        try {
            agent = new HttpsProxyAgent(httpProxy);
            console.log(`[proxy] Sử dụng HTTP Proxy: ${httpProxy}`);
        } catch (e) {
            console.error('Lỗi khởi tạo HTTP Proxy Agent:', e.message);
        }
    }

    for (let i = 0; i < retries; i++) {
        try {
            let requestHeaders;
            if (useScrapeDo || useScraperApi || useGasProxy) {
                requestHeaders = {
                    'bypass-tunnel-reminder': 'true'
                };
            } else if (url.includes('xskt.com.vn')) {
                requestHeaders = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                    'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache',
                    'Referer': 'https://xskt.com.vn/',
                };
            } else {
                requestHeaders = HEADERS;
            }

            const config = {
                headers: requestHeaders,
            };
            if (agent) {
                config.httpsAgent = agent;
            }

            const response = await axiosInstance.get(finalUrl, config);
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
 * @param {string} gameType - '645', '655' or '535'
 */
async function fetchLatestDrawInfoFromVietlott(gameType) {
    const url = `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${gameType}`;
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
}

async function fetchLatestDrawInfo(gameType, forceXskt = false) {
    if (forceXskt) {
        console.log(`[xskt-direct] Bật chế độ cào trực tiếp từ XSKT cho game ${gameType}`);
        try {
            return await fetchLatestDrawInfoFromXskt(gameType);
        } catch (xsktError) {
            console.warn(`[xskt-direct] Thất bại khi lấy thông tin mới nhất từ XSKT: ${xsktError.message}. Thử chuyển sang Vietlott.vn làm fallback...`);
            try {
                return await fetchLatestDrawInfoFromVietlott(gameType);
            } catch (vietlottError) {
                console.error(`[scraper] Thất bại hoàn toàn khi lấy thông tin mới nhất:`, vietlottError.message);
                throw xsktError;
            }
        }
    } else {
        console.log(`[vietlott-direct] Lấy thông tin mới nhất trực tiếp từ Vietlott.vn...`);
        try {
            return await fetchLatestDrawInfoFromVietlott(gameType);
        } catch (vietlottError) {
            console.warn(`[vietlott-direct] Thất bại khi lấy thông tin mới nhất từ Vietlott.vn: ${vietlottError.message}. Thử chuyển sang XSKT làm fallback...`);
            try {
                return await fetchLatestDrawInfoFromXskt(gameType);
            } catch (xsktError) {
                console.error(`[scraper] Thất bại hoàn toàn khi lấy thông tin mới nhất:`, xsktError.message);
                throw vietlottError;
            }
        }
    }
}

/**
 * Fetch detail of a single drawing
 * @param {string} gameType - '645', '655' or '535'
 * @param {number} drawId - Draw ID
 * @param {boolean} useCache - Whether to check local cache
 */
async function fetchDrawDetailFromVietlott(gameType, drawId) {
    const paddedId = padDrawId(drawId);
    const url = `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${gameType}?id=${paddedId}&nocatche=1`;
    
    // Giãn cách động giữa các yêu cầu: nếu có cấu hình Proxy thì dùng 500ms, ngược lại dùng 1500ms
    const hasProxy = !!(process.env.SCRAPER_API_KEY || process.env.SCRAPEDO_API_KEY || process.env.GAS_PROXY_URL);
    const delayMs = hasProxy ? 500 : 1500;
    await sleep(delayMs);

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
    } else if (gameType === '655' || gameType === '535') {
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
                count: parseInt(cells[2].replace(/\D/g, ''), 10) || 0,
                valueStr: cells[3],
                value: parseInt(cells[3].replace(/\D/g, ''), 10) || 0
            });
        }
    });

    // Validation check - số lượng tối thiểu phụ thuộc vào loại game
    const minNumbers = gameType === '535' ? 5 : 6;
    if (!drawIdParsed || numbers.length < minNumbers) {
        throw new Error(`Parsed incomplete data for draw #${drawId} of game ${gameType} (got ${numbers.length} numbers, need ${minNumbers})`);
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
    await db.saveDraw(gameType, result);

    return result;
}

async function fetchDrawDetail(gameType, drawId, useCache = true, forceXskt = false) {
    if (useCache) {
        const cached = await db.getDraw(gameType, drawId);
        if (cached) return cached;
    }

    if (forceXskt) {
        console.log(`[xskt-direct] Cào chi tiết kỳ quay #${drawId} trực tiếp từ XSKT...`);
        try {
            return await fetchDrawDetailFromXskt(gameType, drawId);
        } catch (xsktError) {
            console.warn(`[xskt-direct] Thất bại khi cào XSKT cho ${gameType} #${drawId}: ${xsktError.message}. Thử chuyển sang Vietlott.vn làm fallback...`);
            try {
                return await fetchDrawDetailFromVietlott(gameType, drawId);
            } catch (vietlottError) {
                console.error(`[scraper] Thất bại hoàn toàn khi cào chi tiết cho ${gameType} #${drawId}:`, vietlottError.message);
                throw xsktError;
            }
        }
    } else {
        console.log(`[vietlott-direct] Cào chi tiết kỳ quay #${drawId} trực tiếp từ Vietlott.vn...`);
        try {
            return await fetchDrawDetailFromVietlott(gameType, drawId);
        } catch (vietlottError) {
            console.warn(`[vietlott-direct] Thất bại khi cào Vietlott.vn cho ${gameType} #${drawId}: ${vietlottError.message}. Thử chuyển sang XSKT làm fallback...`);
            try {
                return await fetchDrawDetailFromXskt(gameType, drawId);
            } catch (xsktError) {
                console.error(`[scraper] Thất bại hoàn toàn khi cào chi tiết cho ${gameType} #${drawId}:`, xsktError.message);
                throw vietlottError;
            }
        }
    }
}

/**
 * Get date of a draw ID (using cache when possible)
 */
async function getDrawDateYmd(gameType, drawId, forceXskt = false) {
    const cached = await db.getDraw(gameType, drawId);
    if (cached) {
        return cached.dateYmd;
    }
    try {
        const detail = await fetchDrawDetail(gameType, drawId, true, forceXskt);
        return detail.dateYmd;
    } catch (error) {
        return null;
    }
}

/**
 * Find boundary draw ID for a date using binary search
 */
async function findDrawIdForDate(gameType, targetDateYmd, boundaryType, latestId, onProgress, forceXskt = false) {
    const allDraws = (await db.getAllDrawsMetadata(gameType)).filter(d => d.drawId <= latestId);
    
    let left = 1;
    let right = latestId;

    // Thu hẹp khoảng tìm kiếm [left, right] dựa trên dữ liệu cache đã có
    for (const d of allDraws) {
        if (d.dateYmd === targetDateYmd) {
            if (boundaryType === 'start') {
                right = Math.min(right, d.drawId);
            } else {
                left = Math.max(left, d.drawId);
            }
        } else if (d.dateYmd < targetDateYmd) {
            if (boundaryType === 'start') {
                left = Math.max(left, d.drawId + 1);
            } else {
                left = Math.max(left, d.drawId);
            }
        } else if (d.dateYmd > targetDateYmd) {
            if (boundaryType === 'start') {
                right = Math.min(right, d.drawId);
            } else {
                right = Math.min(right, d.drawId - 1);
            }
        }
    }

    if (onProgress) {
        onProgress(`Tìm kiếm kỳ quay (${boundaryType === 'start' ? 'Bắt đầu' : 'Kết thúc'}): Giới hạn phạm vi tìm kiếm từ #${left} đến #${right}...`);
    }

    if (left > right) {
        const fallback = boundaryType === 'start' 
            ? Math.min(latestId, Math.max(1, left)) 
            : Math.min(latestId, Math.max(1, right));
        if (onProgress) {
            onProgress(`Phạm vi tìm kiếm trống (lịch sử nằm ngoài khoảng ngày). Trả về kỳ fallback: #${fallback}`);
        }
        return fallback;
    }

    let ans = null;

    while (left <= right) {
        const mid = Math.floor((left + right) / 2);
        
        if (onProgress) {
            onProgress(`Tìm kiếm kỳ quay: Kiểm tra Kỳ #${mid}...`);
        }

        const midDateYmd = await getDrawDateYmd(gameType, mid, forceXskt);
        if (!midDateYmd) {
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
                right = mid - 1;
            } else {
                left = mid + 1;
            }
        } else { // boundaryType === 'end'
            if (midDateYmd <= targetDateYmd) {
                ans = mid;
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
    }

    if (ans === null) {
        ans = boundaryType === 'start' ? 1 : latestId;
    }

    return ans;
}

// ==========================================
// FALLBACK SCRAIPING FOR XSKT.COM.VN
// ==========================================

function getXsktUrl(gameType) {
    if (gameType === '645') return 'https://xskt.com.vn/xsmega645';
    if (gameType === '655') return 'https://xskt.com.vn/xspower';
    if (gameType === '535') return 'https://xskt.com.vn/xslotto-5-35';
    return null;
}

function mapPrizeName(name, gameType) {
    name = name.toLowerCase().replace(/\./g, '').trim();
    if (gameType === '645') {
        if (name.includes('pot')) return 'Jackpot';
        if (name.includes('g1') || name.includes('nhất')) return 'Giải nhất';
        if (name.includes('g2') || name.includes('nhì')) return 'Giải nhì';
        if (name.includes('g3') || name.includes('ba')) return 'Giải ba';
    } else if (gameType === '655') {
        if (name.includes('jpot2') || name.includes('pot2')) return 'Jackpot 2';
        if (name.includes('pot')) return 'Jackpot 1';
        if (name.includes('g1') || name.includes('nhất')) return 'Giải nhất';
        if (name.includes('g2') || name.includes('nhì')) return 'Giải nhì';
        if (name.includes('g3') || name.includes('ba')) return 'Giải ba';
    } else if (gameType === '535') {
        if (name.includes('pot') || name.includes('độc đắc')) return 'Giải Độc Đắc';
        if (name.includes('g1') || name.includes('nhất')) return 'Giải Nhất';
        if (name.includes('g2') || name.includes('nhì')) return 'Giải Nhì';
        if (name.includes('g3') || name.includes('ba')) return 'Giải Ba';
        if (name.includes('g4') || name.includes('tư')) return 'Giải Tư';
        if (name.includes('g5') || name.includes('năm')) return 'Giải Năm';
        if (name.includes('kk') || name.includes('khuyến khích')) return 'Giải Khuyến Khích';
    }
    return name;
}

function parseXsktPage(html, gameType, targetDrawId) {
    const $ = cheerio.load(html);
    const results = [];

    $('.box-ketqua').each((idx, el) => {
        const kmtLink = $(el).find('.kmt a');
        if (kmtLink.length === 0) return;

        const drawIdText = kmtLink.find('b').text().trim();
        const drawIdMatch = drawIdText.match(/#(\d+)/);
        if (!drawIdMatch) return;
        const drawId = parseInt(drawIdMatch[1], 10);

        if (targetDrawId && drawId !== targetDrawId) return;

        const href = kmtLink.attr('href') || '';
        const dateMatch = href.match(/ngay-(\d+-\d+-\d+)/);
        let dateStr = '';
        if (dateMatch) {
            const parts = dateMatch[1].split('-');
            dateStr = `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
        }

        const numbers = [];
        if (gameType === '645') {
            const numText = $(el).find('.megaresult em').text().trim();
            if (numText) {
                numText.split(/\s+/).forEach(n => numbers.push(n));
            }
        } else if (gameType === '655') {
            const mainNumText = $(el).find('.megaresult em').first().text().trim();
            if (mainNumText) {
                mainNumText.split(/\s+/).forEach(n => numbers.push(n));
            }
            const specialNum = $(el).find('tr.jp2 .megaresult').text().trim();
            if (specialNum) {
                numbers.push(specialNum);
            }
        } else if (gameType === '535') {
            const numText = $(el).find('.megaresult em').text().trim();
            if (numText) {
                numText.split(/\s+/).forEach(n => numbers.push(n));
            }
        }

        const prizes = [];
        $(el).find('table.trunggiai tr').each((i, tr) => {
            if (i === 0) return;
            const ths = $(tr).find('th');
            if (ths.length > 0) return;

            const tds = $(tr).find('td');
            if (tds.length >= 4) {
                const rawName = $(tds[0]).text().trim();
                const name = mapPrizeName(rawName, gameType);
                const countText = $(tds[2]).text().replace(/\D/g, '').trim();
                const valueText = $(tds[3]).text().replace(/\D/g, '').trim();

                prizes.push({
                    name,
                    matching: $(tds[1]).text().trim() || '',
                    count: parseInt(countText, 10) || 0,
                    valueStr: $(tds[3]).text().trim(),
                    value: parseInt(valueText, 10) || 0
                });
            }
        });

        results.push({
            drawId,
            drawIdStr: String(drawId).padStart(5, '0'),
            dateStr,
            dateYmd: dateToYmd(dateStr),
            numbers,
            prizes,
            scrapedAt: new Date().toISOString()
        });
    });

    return results;
}

async function fetchLatestDrawInfoFromXskt(gameType) {
    const url = getXsktUrl(gameType);
    const response = await fetchWithRetry(url);
    const results = parseXsktPage(response.data, gameType);
    if (results.length === 0) {
        throw new Error(`Không thể tìm thấy thông tin kỳ quay mới nhất từ XSKT cho game ${gameType}`);
    }
    return {
        drawId: results[0].drawId,
        dateStr: results[0].dateStr,
        dateYmd: results[0].dateYmd
    };
}

async function fetchDrawDetailFromXskt(gameType, drawId) {
    let cacheForGame = xsktParsedCache[gameType];
    
    // Tìm ID kỳ quay lớn nhất hiện có trong cache (nếu đã có cache)
    let maxCachedId = 0;
    if (cacheForGame) {
        const cachedIds = Object.keys(cacheForGame).map(Number);
        if (cachedIds.length > 0) {
            maxCachedId = Math.max(...cachedIds);
        }
    }

    // Nếu chưa có cache cho game này, HOẶC kỳ quay cần cào mới hơn kỳ quay lớn nhất trong cache:
    // Tiến hành tải các trang của XSKT để cập nhật cache.
    if (!cacheForGame || drawId > maxCachedId) {
        console.log(`[xskt-cache] Nạp mới/cập nhật bộ nhớ tạm XSKT cho game ${gameType} (đang cần Kỳ #${drawId})...`);
        const urls = [
            getXsktUrl(gameType),
            `${getXsktUrl(gameType)}/30-ngay`,
            `${getXsktUrl(gameType)}/100-ngay`
        ];

        const newCache = {};
        for (const baseUrl of urls) {
            try {
                console.log(`[xskt] Đang cào dữ liệu từ trang: ${baseUrl}`);
                const response = await fetchWithRetry(baseUrl);
                // Lấy tất cả kết quả trên trang (không lọc theo targetDrawId để lưu đầy đủ vào cache)
                const results = parseXsktPage(response.data, gameType);
                results.forEach(res => {
                    newCache[res.drawId] = res;
                });
                await sleep(500); // Tránh cào dồn dập các trang XSKT
            } catch (e) {
                console.error(`[xskt] Lỗi khi cào từ ${baseUrl}:`, e.message);
            }
        }
        
        // Gộp kết quả mới vào cache cũ (nếu có) hoặc ghi đè
        xsktParsedCache[gameType] = {
            ...(xsktParsedCache[gameType] || {}),
            ...newCache
        };
        cacheForGame = xsktParsedCache[gameType];
    }

    // Tìm kiếm kỳ quay mong muốn trong bộ nhớ tạm
    const result = cacheForGame[drawId];
    if (result) {
        console.log(`[xskt] ✓ Đã tìm thấy dữ liệu Kỳ #${drawId} trên XSKT (từ bộ nhớ tạm)!`);
        await db.saveDraw(gameType, result);
        return result;
    }

    throw new Error(`Không thể cào dữ liệu cho Kỳ #${drawId} từ XSKT (Kỳ quay này không nằm trong 100 ngày gần nhất trên XSKT).`);
}

module.exports = {
    fetchLatestDrawInfo,
    fetchDrawDetail,
    findDrawIdForDate,
    fetchWithRetry,
    get cache() { return db.getLocalCache(); }
};
