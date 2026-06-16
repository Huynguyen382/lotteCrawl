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
    const { game, startDate, endDate } = req.query;

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
        sendEvent('log', { message: 'Đang kết nối đến cơ sở dữ liệu...' });
        
        let latestId = null;
        let latestInfo = await db.getLatestDraw(game);
        if (latestInfo) {
            latestId = latestInfo.drawId;
            sendEvent('log', { message: `Kỳ quay mới nhất hiện tại (từ DB): #${latestId} (${latestInfo.dateStr})` });
        } else {
            sendEvent('log', { message: 'Không tìm thấy dữ liệu trong DB. Đang cào thông tin mới nhất từ Vietlott...' });
            latestInfo = await fetchLatestDrawInfo(game);
            latestId = latestInfo.drawId;
            sendEvent('log', { message: `Kỳ quay mới nhất hiện tại (cào mới): #${latestId} (${latestInfo.dateStr})` });
        }

        sendEvent('log', { message: `Đang tìm kỳ quay bắt đầu cho ngày ${startDate}...` });
        const startId = await findDrawIdForDate(game, startDate, 'start', latestId, (msg) => {
            sendEvent('log', { message: msg });
        });

        sendEvent('log', { message: `Đang tìm kỳ quay kết thúc cho ngày ${endDate}...` });
        const endId = await findDrawIdForDate(game, endDate, 'end', latestId, (msg) => {
            sendEvent('log', { message: msg });
        });

        sendEvent('log', { message: `Phạm vi kỳ quay xác định: #${startId} đến #${endId}` });

        if (startId > endId) {
            sendEvent('error', { message: 'Không tìm thấy kỳ quay nào trong khoảng ngày này.' });
            clearInterval(keepAliveInterval);
            return res.end();
        }

        const totalDraws = endId - startId + 1;
        sendEvent('start', { startId, endId, totalDraws });

        const results = [];
        const CONCURRENCY = 5;
        const queue = [];
        
        const hasPrev = startId > 1;
        const fetchStartId = hasPrev ? startId - 1 : startId;
        
        for (let id = fetchStartId; id <= endId; id++) {
            queue.push(id);
        }
        
        let completed = 0;
        const errors = [];
        
        const fetchOne = async (id) => {
            try {
                const drawDetail = await fetchDrawDetail(game, id, true);
                results.push(drawDetail);
                console.log(`✓ Scraped draw #${id} successfully`);
                return { success: true, id };
            } catch (err) {
                console.error(`✗ Failed to scrape draw #${id}:`, err.message);
                errors.push({ id, error: err.message });
                sendEvent('log', { message: `Cảnh báo: Không thể tải kỳ quay #${id}: ${err.message}` });
                return { success: false, id };
            } finally {
                if (id >= startId) {
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
        
        while (queue.length > 0) {
            const batch = queue.splice(0, CONCURRENCY);
            await Promise.all(batch.map(id => fetchOne(id)));
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

module.exports = {
    getLatest,
    scrapeStream,
    createDraw,
    quickFetchDraw,
    debugHtml,
    getStatsV2
};
