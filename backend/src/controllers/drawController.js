const db = require('../config/db');
const { fetchLatestDrawInfo, fetchDrawDetail, findDrawIdForDate, fetchWithRetry } = require('../services/scraperService');

// Helper to convert date string "DD/MM/YYYY" to "YYYY-MM-DD"
function dateToYmd(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// 1. Get latest draw info
async function getLatest(req, res) {
    const { game } = req.query;
    if (!game || (game !== '645' && game !== '655' && game !== '535')) {
        return res.status(400).json({ error: 'Game type must be 645, 655 or 535' });
    }
    try {
        const latestDbDraw = await db.getLatestDraw(game);
        if (latestDbDraw) {
            return res.json({
                drawId: latestDbDraw.drawId,
                dateStr: latestDbDraw.dateStr,
                dateYmd: latestDbDraw.dateYmd
            });
        }
        const info = await fetchLatestDrawInfo(game);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 2. SSE Scrape Stream
async function scrapeStream(req, res) {
    const { game, startDate, endDate, mode } = req.query;
    const crawlMode = mode || 'db';

    if (!game || !startDate || !endDate) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(400).end('Missing game, startDate, or endDate');
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const sendEvent = (type, data) => {
        try {
            if (!res.writableEnded) {
                res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
            }
        } catch (e) {
            console.error('Failed to send event:', e.message);
        }
    };

    const keepAliveInterval = setInterval(() => {
        try {
            if (!res.writableEnded) {
                res.write(': keep-alive\n\n');
            }
        } catch (e) {
            clearInterval(keepAliveInterval);
        }
    }, 15000);

    req.on('close', () => {
        console.log('Client disconnected, cleaning up...');
        clearInterval(keepAliveInterval);
    });

    try {
        if (crawlMode === 'db') {
            sendEvent('log', { message: 'Đang truy vấn dữ liệu từ cơ sở dữ liệu...' });
            
            let draws = [];
            const gameCache = db.getLocalCache()[game] || {};
            draws = Object.values(gameCache)
                .filter(d => d.dateYmd >= startDate && d.dateYmd <= endDate)
                .sort((a, b) => a.drawId - b.drawId);

            sendEvent('log', { message: `Tìm thấy ${draws.length} kỳ quay trong cơ sở dữ liệu.` });

            if (draws.length === 0) {
                sendEvent('complete', { startId: 0, endId: 0, totalCrawled: 0, totalErrors: 0, results: [] });
                clearInterval(keepAliveInterval);
                return res.end();
            }

            const startId = draws[0].drawId;
            const endId = draws[draws.length - 1].drawId;

            // Calculate absences
            sendEvent('log', { message: 'Đang tính toán chỉ số vắng mặt (Tổng Vắng)...' });
            try {
                const allHistory = await db.getDrawsInRange(game, 1, endId);
                allHistory.sort((a, b) => a.drawId - b.drawId);

                const lastSeenIndex = {};
                const absencesByDrawId = {};

                allHistory.forEach((draw, idx) => {
                    const currentNums = draw.numbers.map(n => parseInt(n, 10));
                    const individualAbsences = currentNums.map((num) => {
                        if (lastSeenIndex[num] !== undefined) {
                            const prevIdx = lastSeenIndex[num];
                            return idx - prevIdx - 1;
                        } else {
                            return 'N/A';
                        }
                    });

                    const mainLength = game === '535' ? 5 : 6;
                    const mainAbs = individualAbsences.slice(0, mainLength);
                    const hasNA = mainAbs.some(val => val === 'N/A');
                    const totalAbsence = hasNA ? 'N/A' : mainAbs.reduce((sum, val) => sum + val, 0);

                    absencesByDrawId[draw.drawId] = {
                        individualAbsences,
                        totalAbsence
                    };

                    currentNums.forEach((num) => {
                        lastSeenIndex[num] = idx;
                    });
                });

                draws.forEach((draw) => {
                    const abs = absencesByDrawId[draw.drawId];
                    if (abs) {
                        draw.individualAbsences = abs.individualAbsences;
                        draw.totalAbsence = abs.totalAbsence;
                    }
                });
            } catch (e) {
                console.error('Lỗi tính toán khoảng vắng mặt trong scrape-stream (DB mode):', e.message);
                sendEvent('log', { message: `Cảnh báo: Không thể tính toán khoảng vắng mặt: ${e.message}` });
            }

            sendEvent('complete', { 
                startId, 
                endId, 
                totalCrawled: draws.length,
                totalErrors: 0,
                results: draws 
            });
            clearInterval(keepAliveInterval);
            return res.end();
        }

        // Nếu crawlMode === 'xskt' (Bật chế độ cào trực tuyến)
        // Xác định nguồn ưu tiên: Local (IP VN) → Vietlott trước; Production → XSKT trước
        const isProduction = process.env.NODE_ENV === 'production';
        const forceXskt = isProduction; // Production dùng XSKT trước vì Vietlott chặn IP nước ngoài
        const sourceName = forceXskt ? 'XSKT.com.vn' : 'Vietlott.vn';
        sendEvent('log', { message: `Đang kết nối đến nguồn dữ liệu: ${sourceName}...` });
        
        let latestId = null;
        let latestInfo = null;
        sendEvent('log', { message: `Đang lấy thông tin kỳ quay mới nhất từ ${sourceName}...` });
        try {
            latestInfo = await fetchLatestDrawInfo(game, forceXskt);
            latestId = latestInfo.drawId;
            sendEvent('log', { message: `Kỳ quay mới nhất: #${latestId} (${latestInfo.dateStr})` });
        } catch (e) {
            sendEvent('log', { message: `Không thể lấy kỳ quay mới nhất trực tuyến (${e.message}). Sử dụng dữ liệu mới nhất từ DB làm thay thế.` });
            latestInfo = await db.getLatestDraw(game);
            if (latestInfo) {
                latestId = latestInfo.drawId;
                sendEvent('log', { message: `Kỳ quay mới nhất từ DB: #${latestId} (${latestInfo.dateStr})` });
            }
        }

        if (!latestId) {
            sendEvent('error', { message: 'Không thể xác định kỳ quay mới nhất để tìm kiếm khoảng ngày.' });
            clearInterval(keepAliveInterval);
            return res.end();
        }

        sendEvent('log', { message: `Đang tìm kỳ quay bắt đầu cho ngày ${startDate}...` });
        const startId = await findDrawIdForDate(game, startDate, 'start', latestId, (msg) => {
            sendEvent('log', { message: msg });
        }, forceXskt);

        sendEvent('log', { message: `Đang tìm kỳ quay kết thúc cho ngày ${endDate}...` });
        const endId = await findDrawIdForDate(game, endDate, 'end', latestId, (msg) => {
            sendEvent('log', { message: msg });
        }, forceXskt);

        sendEvent('log', { message: `Phạm vi kỳ quay xác định: #${startId} đến #${endId}` });

        if (startId > endId) {
            sendEvent('error', { message: 'Không tìm thấy kỳ quay nào trong khoảng ngày này.' });
            clearInterval(keepAliveInterval);
            return res.end();
        }

        const totalDraws = endId - startId + 1;
        sendEvent('start', { startId, endId, totalDraws });

        const results = [];
        const hasProxy = !!(process.env.SCRAPER_API_KEY || process.env.SCRAPEDO_API_KEY || process.env.GAS_PROXY_URL);
        const CONCURRENCY = hasProxy ? 4 : 1;
        const queue = [];
        
        const hasPrev = startId > 1;
        const fetchStartId = hasPrev ? startId - 1 : startId;
        
        for (let id = fetchStartId; id <= endId; id++) {
            queue.push(id);
        }
        
        let completed = 0;
        const errors = [];
        
        const fetchOne = async (id, isRetry = false) => {
            try {
                const drawDetail = await fetchDrawDetail(game, id, true, forceXskt);
                results.push(drawDetail);
                console.log(`✓ Scraped draw #${id} successfully${isRetry ? ' (retry)' : ''}`);
                return { success: true, id };
            } catch (err) {
                console.error(`✗ Failed to scrape draw #${id}:`, err.message);
                if (!isRetry) {
                    errors.push({ id, error: err.message });
                    sendEvent('log', { message: `Cảnh báo: Không thể tải kỳ quay #${id}: ${err.message}` });
                }
                return { success: false, id };
            } finally {
                if (id >= startId && !isRetry) {
                    completed++;
                    const progressPercent = Math.min(100, Math.round((completed / totalDraws) * 100));
                    sendEvent('progress', { 
                        currentId: id, 
                        progress: completed, 
                        total: totalDraws, 
                        percent: progressPercent,
                        message: `Đang tải chi tiết kỳ quay #${id}... (${completed}/${totalDraws})`
                    });
                }
            }
        };
        
        let index = 0;
        const worker = async () => {
            while (index < queue.length) {
                const id = queue[index++];
                await fetchOne(id);
            }
        };
        const workers = Array(Math.min(CONCURRENCY, queue.length)).fill(null).map(worker);
        await Promise.all(workers);

        // Retry lại các kỳ quay bị lỗi (tối đa 2 vòng retry)
        for (let retryRound = 1; retryRound <= 2 && errors.length > 0; retryRound++) {
            const failedIds = errors.map(e => e.id);
            const retryIds = failedIds.filter(id => !results.some(r => r.drawId === id));
            if (retryIds.length === 0) break;
            
            sendEvent('log', { message: `🔄 Đang thử lại ${retryIds.length} kỳ quay bị lỗi (lần ${retryRound}/2)...` });
            errors.length = 0; // Reset error list cho vòng retry này
            
            for (const id of retryIds) {
                await fetchOne(id, true);
                if (!results.some(r => r.drawId === id)) {
                    errors.push({ id, error: 'Retry failed' });
                }
            }
            
            if (errors.length > 0) {
                sendEvent('log', { message: `⚠️ Vẫn còn ${errors.length} kỳ quay lỗi sau retry lần ${retryRound}` });
            } else {
                sendEvent('log', { message: `✅ Đã khôi phục tất cả kỳ quay bị lỗi!` });
            }
        }

        results.sort((a, b) => a.drawId - b.drawId);

        try {
            sendEvent('log', { message: 'Đang tính toán chỉ số vắng mặt (Tổng Vắng)...' });
            const allHistory = await db.getDrawsInRange(game, 1, endId);
            allHistory.sort((a, b) => a.drawId - b.drawId);

            const lastSeenIndex = {};
            const absencesByDrawId = {};

            allHistory.forEach((draw, idx) => {
                const currentNums = draw.numbers.map(n => parseInt(n, 10));
                const individualAbsences = currentNums.map((num) => {
                    if (lastSeenIndex[num] !== undefined) {
                        const prevIdx = lastSeenIndex[num];
                        return idx - prevIdx - 1;
                    } else {
                        return 'N/A';
                    }
                });

                const mainLength = game === '535' ? 5 : 6;
                const mainAbs = individualAbsences.slice(0, mainLength);
                const hasNA = mainAbs.some(val => val === 'N/A');
                const totalAbsence = hasNA ? 'N/A' : mainAbs.reduce((sum, val) => sum + val, 0);

                absencesByDrawId[draw.drawId] = {
                    individualAbsences,
                    totalAbsence
                };

                currentNums.forEach((num) => {
                    lastSeenIndex[num] = idx;
                });
            });

            results.forEach((draw) => {
                const abs = absencesByDrawId[draw.drawId];
                if (abs) {
                    draw.individualAbsences = abs.individualAbsences;
                    draw.totalAbsence = abs.totalAbsence;
                }
            });
        } catch (e) {
            console.error('Lỗi tính toán khoảng vắng mặt trong scrape-stream:', e.message);
            sendEvent('log', { message: `Cảnh báo: Không thể tính toán khoảng vắng mặt: ${e.message}` });
        }
        
        sendEvent('complete', { 
            startId, 
            endId, 
            totalCrawled: results.length,
            totalErrors: errors.length,
            results 
        });
        clearInterval(keepAliveInterval);
        res.end();
    } catch (error) {
        console.error('SSE Error:', error);
        sendEvent('error', { message: `Lỗi hệ thống: ${error.message}` });
        clearInterval(keepAliveInterval);
        res.end();
    }
}

// 3. Create manual draw
async function createDraw(req, res) {
    const { game, drawId, dateStr, numbers, prizes } = req.body;
    if (!game || !drawId || !dateStr || !numbers || !prizes) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (game, drawId, dateStr, numbers, prizes)' });
    }
    const id = parseInt(drawId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Mã kỳ quay phải là số hợp lệ' });
    }

    try {
        const drawObj = {
            drawId: id,
            drawIdStr: String(id).padStart(5, '0'),
            dateStr,
            dateYmd: dateToYmd(dateStr),
            numbers: Array.isArray(numbers) ? numbers.map(String) : [],
            prizes,
            scrapedAt: new Date().toISOString()
        };

        const success = await db.saveDraw(game, drawObj);
        if (success) {
            return res.json({ success: true, message: `Lưu kỳ quay #${id} của game ${game} thành công!` });
        } else {
            return res.status(500).json({ error: 'Không thể lưu dữ liệu vào cơ sở dữ liệu' });
        }
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// 4. Quick fetch draw
async function quickFetchDraw(req, res) {
    const { game, drawId } = req.body;
    if (!game || !drawId) {
        return res.status(400).json({ error: 'Thiếu game hoặc drawId' });
    }
    const id = parseInt(drawId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Mã kỳ quay không hợp lệ' });
    }

    try {
        const detail = await fetchDrawDetail(game, id, false); // force scrape to update DB
        res.json({ success: true, message: `Đã cào và lưu thành công kỳ quay #${id} của game ${game}!`, data: detail });
    } catch (e) {
        res.status(500).json({ error: `Không thể cào dữ liệu kỳ quay #${id} từ Vietlott: ${e.message}` });
    }
}

// 5. Debug HTML
async function debugHtml(req, res) {
    const { game, id } = req.query;
    if (!game || !id) return res.status(400).json({ error: 'Cần game và id' });
    try {
        const url = `https://vietlott.vn/vi/trung-thuong/ket-qua-trung-thuong/${game}?id=${id}&nocatche=1`;
        const response = await fetchWithRetry(url);
        const cheerio = require('cheerio');
        const $ = cheerio.load(response.data);
        res.json({
            bong_tron_count: $('.bong_tron').length,
            bong_tron_small_count: $('.bong_tron.small').length,
            bong_tron_texts: $('.bong_tron').map((i, el) => $(el).text().trim()).get(),
            bong_tron_small_texts: $('.bong_tron.small').map((i, el) => $(el).text().trim()).get(),
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}

// 6. Get AI V2 Stats
async function getStatsV2(req, res) {
    const { game } = req.params;
    if (!['645', '655', '535'].includes(game)) {
        return res.status(400).json({ error: 'Invalid game type' });
    }
    try {
        const statsService = require('../services/statsService');
        const stats = await statsService.getGameStats(game);
        res.json({ success: true, game, data: stats });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
}
// 7. Get list of draws
async function getDraws(req, res) {
    const { game } = req.params;
    const limit = parseInt(req.query.limit, 10) || 100;
    const offset = parseInt(req.query.offset, 10) || 0;
    
    if (!game || !['645', '655', '535'].includes(game)) {
        return res.status(400).json({ error: 'Game type must be 645, 655 or 535' });
    }
    
    try {
        const gameCache = db.getLocalCache()[game] || {};
        const draws = Object.values(gameCache)
            .sort((a, b) => b.drawId - a.drawId)
            .slice(offset, offset + limit);
        return res.json(draws);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 8. Get single draw
async function getDrawOne(req, res) {
    const { game, drawId } = req.params;
    const id = parseInt(drawId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Draw ID must be a valid number' });
    }
    try {
        const draw = await db.getDraw(game, id);
        if (draw) {
            return res.json(draw);
        }
        res.status(404).json({ error: `Not found draw #${id} for game ${game}` });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 9. Update existing draw
async function updateDraw(req, res) {
    const { game, drawId } = req.params;
    const { dateStr, numbers, prizes } = req.body;
    const id = parseInt(drawId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Draw ID must be a valid number' });
    }
    if (!dateStr || !numbers || !prizes) {
        return res.status(400).json({ error: 'Thiếu thông tin bắt buộc (dateStr, numbers, prizes)' });
    }
    
    try {
        const existing = await db.getDraw(game, id);
        if (!existing) {
            return res.status(404).json({ error: `Not found draw #${id} for game ${game} to update` });
        }

        const drawObj = {
            drawId: id,
            drawIdStr: String(id).padStart(5, '0'),
            dateStr,
            dateYmd: dateToYmd(dateStr),
            numbers: Array.isArray(numbers) ? numbers.map(String) : [],
            prizes,
            scrapedAt: existing.scrapedAt || new Date().toISOString()
        };

        const success = await db.saveDraw(game, drawObj);
        if (success) {
            return res.json({ success: true, message: `Cập nhật kỳ quay #${id} thành công!`, data: drawObj });
        } else {
            return res.status(500).json({ error: 'Không thể cập nhật cơ sở dữ liệu' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// 10. Delete draw
async function deleteDraw(req, res) {
    const { game, drawId } = req.params;
    const id = parseInt(drawId, 10);
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Draw ID must be a valid number' });
    }
    try {
        const existing = await db.getDraw(game, id);
        if (!existing) {
            return res.status(404).json({ error: `Not found draw #${id} for game ${game} to delete` });
        }
        
        const success = await db.deleteDraw(game, id);
        if (success) {
            res.json({ success: true, message: `Xóa kỳ quay #${id} thành công!` });
        } else {
            res.status(500).json({ error: 'Không thể xóa dữ liệu' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getLatest,
    scrapeStream,
    getDraws,
    getDrawOne,
    createDraw,
    updateDraw,
    deleteDraw,
    quickFetchDraw,
    debugHtml,
    getStatsV2
};
