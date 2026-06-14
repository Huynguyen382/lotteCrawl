const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const { fetchLatestDrawInfo, fetchDrawDetail, findDrawIdForDate, fetchWithRetry } = require('./scraper');
const db = require('./db');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5500;

app.use(cors());
app.use(express.json());

// Health check route
app.get('/', (req, res) => {
    res.json({ 
        status: 'OK', 
        message: 'Vietlott Backend API đang chạy!',
        endpoints: [
            'GET /api/latest?game=645',
            'GET /api/latest?game=655',
            'GET /api/scrape-stream?game=645&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD',
            'GET /api/export?game=645&startId=1&endId=100',
            'GET /api/debug-html?game=655&id=01356  ← xem HTML thô'
        ]
    });
});

// Debug route: xem HTML thô từ Vietlott để kiểm tra selector
app.get('/api/debug-html', async (req, res) => {
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
});

// Endpoint proxy dùng cho giải pháp Local Bridge
// Nhận request từ Render và cào dữ liệu bằng IP Việt Nam ở local của bạn
app.get('/api/proxy', async (req, res) => {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Cần truyền tham số url' });
    try {
        console.log(`[local-bridge] Nhận yêu cầu cào hộ cho URL: ${url}`);
        
        // Cào trực tiếp không dùng proxy (vì đang chạy ở local IP Việt Nam)
        const axios = require('axios');
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
                'Referer': 'https://vietlott.vn/'
            },
            timeout: 30000
        });
        
        res.send(response.data);
    } catch (error) {
        console.error(`[local-bridge] Lỗi cào dữ liệu:`, error.message);
        res.status(500).json({ error: error.message });
    }
});

// 1. Get latest draw info
app.get('/api/latest', async (req, res) => {
    const { game } = req.query; // '645' or '655'
    if (!game || (game !== '645' && game !== '655')) {
        return res.status(400).json({ error: 'Game type must be 645 or 655' });
    }
    try {
        // Lấy thông tin kỳ mới nhất trong DB trước để tránh gọi Vietlott bị 403
        const latestDbDraw = await db.getLatestDraw(game);
        if (latestDbDraw) {
            return res.json({
                drawId: latestDbDraw.drawId,
                dateStr: latestDbDraw.dateStr,
                dateYmd: latestDbDraw.dateYmd
            });
        }
        // Fallback nếu DB trống
        const info = await fetchLatestDrawInfo(game);
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. SSE Scrape Stream
app.get('/api/scrape-stream', async (req, res) => {
    const { game, startDate, endDate } = req.query;

    if (!game || !startDate || !endDate) {
        res.setHeader('Content-Type', 'text/plain');
        return res.status(400).end('Missing game, startDate, or endDate');
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Tắt nginx buffering nếu có
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

    // Keep-alive để tránh timeout
    const keepAliveInterval = setInterval(() => {
        try {
            if (!res.writableEnded) {
                res.write(': keep-alive\n\n');
            }
        } catch (e) {
            clearInterval(keepAliveInterval);
        }
    }, 15000); // Ping mỗi 15 giây

    // Cleanup khi client ngắt kết nối
    req.on('close', () => {
        console.log('Client disconnected, cleaning up...');
        clearInterval(keepAliveInterval);
    });

    try {
        sendEvent('log', { message: 'Đang kết nối đến cơ sở dữ liệu...' });
        
        // 1. Lấy thông tin kỳ quay mới nhất từ DB để tránh gọi Vietlott trực tiếp bị 403
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

        // 2. Perform binary search for start and end dates
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
            return res.end();
        }

        const totalDraws = endId - startId + 1;
        sendEvent('start', { startId, endId, totalDraws });

        const results = [];
        // 3. Fetch details for each draw với concurrency (bao gồm cả kỳ startId - 1 nếu có để tính delta)
        const CONCURRENCY = 5; // Số request đồng thời (tăng nếu cần)
        const queue = [];
        
        const hasPrev = startId > 1;
        const fetchStartId = hasPrev ? startId - 1 : startId;
        
        for (let id = fetchStartId; id <= endId; id++) {
            queue.push(id);
        }
        
        let completed = 0;
        const errors = [];
        
        // Hàm fetch 1 kỳ
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
        
        // Fetch song song với giới hạn concurrency
        while (queue.length > 0) {
            const batch = queue.splice(0, CONCURRENCY);
            await Promise.all(batch.map(id => fetchOne(id)));
        }

        // Sắp xếp kết quả theo drawId trước khi trả về
        results.sort((a, b) => a.drawId - b.drawId);
        
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
});

// Hỗ trợ lấy thông tin kỳ quay trước đó để tính toán delta cho file Excel
async function getPreviousDrawDetail(game, currentId) {
    if (currentId <= 1) return null;
    const prevId = currentId - 1;
    try {
        return await db.getDraw(game, prevId) || await fetchDrawDetail(game, prevId, true);
    } catch (e) {
        console.error(`Could not fetch previous draw #${prevId} for delta calculation:`, e.message);
        return null;
    }
}

// Helper to convert date string "DD/MM/YYYY" to "YYYY-MM-DD"
function dateToYmd(dateStr) {
    if (!dateStr) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
}

// 3. Export to Excel
app.get('/api/export', async (req, res) => {
    const { game, startId, endId } = req.query;

    if (!game || !startId || !endId) {
        return res.status(400).json({ error: 'Missing game, startId, or endId' });
    }

    const sId = parseInt(startId, 10);
    const eId = parseInt(endId, 10);

    if (isNaN(sId) || isNaN(eId) || sId > eId) {
        return res.status(400).json({ error: 'Invalid startId or endId range' });
    }

    try {
        const cachedDraws = await db.getDrawsInRange(game, sId, eId);
        const drawsMap = {};
        cachedDraws.forEach(d => { drawsMap[d.drawId] = d; });

        const draws = [];
        for (let id = sId; id <= eId; id++) {
            if (drawsMap[id]) {
                draws.push(drawsMap[id]);
            } else {
                try {
                    console.log(`[export] Missing draw #${id} in DB. Scraping...`);
                    const detail = await fetchDrawDetail(game, id, true);
                    draws.push(detail);
                } catch (e) {
                    console.error(`Skipping draw #${id} in export:`, e.message);
                }
            }
        }

        if (draws.length === 0) {
            return res.status(404).json({ error: 'No draw data found to export' });
        }

        // Lấy kỳ quay liền trước sId để tính delta cho kỳ đầu tiên
        const firstDrawPrev = await getPreviousDrawDetail(game, sId);

        const workbook = new ExcelJS.Workbook();
        const sheetName = game === '645' ? 'Mega 6-45' : 'Power 6-55';
        const worksheet = workbook.addWorksheet(sheetName);

        // Styling configuration
        const fontName = 'Segoe UI';
        const titleColor = '1D3557'; // Elegant Deep Blue
        const headerBgColor = '457B9D'; // Soft Steel Blue
        const headerTextColor = 'FFFFFF';
        const zebraBgColor = 'F8F9FA'; // Off-white
        const borderColor = 'D8E2DC';

        const borderStyle = {
            top: { style: 'thin', color: { argb: borderColor } },
            left: { style: 'thin', color: { argb: borderColor } },
            bottom: { style: 'thin', color: { argb: borderColor } },
            right: { style: 'thin', color: { argb: borderColor } }
        };

        // Title Block
        const titleText = game === '645' 
            ? `KẾT QUẢ CÀO DỮ LIỆU VIETLOTT MEGA 6/45 (KỲ #${startId} - #${endId})`
            : `KẾT QUẢ CÀO DỮ LIỆU VIETLOTT POWER 6/55 (KỲ #${startId} - #${endId})`;
        
        // Headers
        let headers = [];
        if (game === '645') {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6',
                'Lệch S1', 'Lệch S2', 'Lệch S3', 'Lệch S4', 'Lệch S5', 'Lệch S6',
                'Tổng', 'Lệch Tổng',
                'Giá Trị Jackpot (đ)', 'Trúng Jackpot', 
                'Trúng Giải Nhất (10M)', 'Trúng Giải Nhì (300k)', 'Trúng Giải Ba (30k)'
            ];
        } else {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6', 'Số Đặc Biệt',
                'Lệch S1', 'Lệch S2', 'Lệch S3', 'Lệch S4', 'Lệch S5', 'Lệch S6', 'Lệch SĐB',
                'Tổng', 'Lệch Tổng',
                'Giá Trị Jackpot 1 (đ)', 'Trúng Jackpot 1', 
                'Giá Trị Jackpot 2 (đ)', 'Trúng Jackpot 2', 
                'Trúng Giải Nhất (40M)', 'Trúng Giải Nhì (500k)', 'Trúng Giải Ba (50k)'
            ];
        }

        worksheet.mergeCells(1, 1, 1, headers.length);
        const titleRow = worksheet.getRow(1);
        titleRow.height = 35;
        const titleCell = titleRow.getCell(1);
        titleCell.value = titleText;
        titleCell.font = { name: fontName, size: 14, bold: true, color: { argb: 'FFFFFF' } };
        titleCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: titleColor }
        };
        titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

        const headerRow = worksheet.getRow(3);
        headerRow.height = 28;
        headers.forEach((header, index) => {
            const cell = headerRow.getCell(index + 1);
            cell.value = header;
            cell.font = { name: fontName, size: 10, bold: true, color: { argb: headerTextColor } };
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: headerBgColor }
            };
            cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            cell.border = borderStyle;
        });

        // Add Data Rows
        let rowIdx = 4;
        draws.forEach((draw, i) => {
            const dataRow = worksheet.getRow(rowIdx);
            dataRow.height = 22;

            let rowData = [];
            const isZebra = rowIdx % 2 === 0;
            const bgFill = isZebra ? {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: zebraBgColor }
            } : null;

            const prevDraw = i > 0 ? draws[i - 1] : firstDrawPrev;
            const currentNums = draw.numbers.map(n => parseInt(n, 10));
            const currentSum = currentNums.reduce((sum, n) => sum + n, 0);

            let sumDiff = null;
            let numDeltas = [];

            if (prevDraw) {
                const prevNums = prevDraw.numbers.map(n => parseInt(n, 10));
                const prevSum = prevNums.reduce((sum, n) => sum + n, 0);
                sumDiff = currentSum - prevSum;

                let curSorted = [];
                let prevSorted = [];

                if (game === '645') {
                    curSorted = [...currentNums].sort((a, b) => a - b);
                    prevSorted = [...prevNums].sort((a, b) => a - b);
                } else {
                    const curMain = currentNums.slice(0, 6).sort((a, b) => a - b);
                    const prevMain = prevNums.slice(0, 6).sort((a, b) => a - b);
                    curSorted = [...curMain, currentNums[6]];
                    prevSorted = [...prevMain, prevNums[6]];
                }

                numDeltas = curSorted.map((num, idx) => num - prevSorted[idx]);
            } else {
                if (game === '645') {
                    numDeltas = [null, null, null, null, null, null];
                } else {
                    numDeltas = [null, null, null, null, null, null, null];
                }
            }

            if (game === '645') {
                const jack = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { value: 0, count: 0 };
                const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || { count: 0 };
                const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || { count: 0 };
                const g3 = draw.prizes.find(p => p.name.includes('Ba')) || { count: 0 };

                rowData = [
                    `#${draw.drawIdStr}`,
                    draw.dateStr,
                    parseInt(draw.numbers[0], 10),
                    parseInt(draw.numbers[1], 10),
                    parseInt(draw.numbers[2], 10),
                    parseInt(draw.numbers[3], 10),
                    parseInt(draw.numbers[4], 10),
                    parseInt(draw.numbers[5], 10),
                    numDeltas[0],
                    numDeltas[1],
                    numDeltas[2],
                    numDeltas[3],
                    numDeltas[4],
                    numDeltas[5],
                    currentSum,
                    sumDiff,
                    jack.value,
                    jack.count,
                    g1.count,
                    g2.count,
                    g3.count
                ];
            } else {
                const jack1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || { value: 0, count: 0 };
                const jack2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || { value: 0, count: 0 };
                const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || { count: 0 };
                const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || { count: 0 };
                const g3 = draw.prizes.find(p => p.name.includes('Ba')) || { count: 0 };

                rowData = [
                    `#${draw.drawIdStr}`,
                    draw.dateStr,
                    parseInt(draw.numbers[0], 10),
                    parseInt(draw.numbers[1], 10),
                    parseInt(draw.numbers[2], 10),
                    parseInt(draw.numbers[3], 10),
                    parseInt(draw.numbers[4], 10),
                    parseInt(draw.numbers[5], 10),
                    parseInt(draw.numbers[6], 10), // Bonus ball
                    numDeltas[0],
                    numDeltas[1],
                    numDeltas[2],
                    numDeltas[3],
                    numDeltas[4],
                    numDeltas[5],
                    numDeltas[6], // Bonus ball delta
                    currentSum,
                    sumDiff,
                    jack1.value,
                    jack1.count,
                    jack2.value,
                    jack2.count,
                    g1.count,
                    g2.count,
                    g3.count
                ];
            }

            rowData.forEach((val, colIdx) => {
                const cell = dataRow.getCell(colIdx + 1);
                cell.value = val;
                cell.font = { name: fontName, size: 10 };
                cell.border = borderStyle;
                if (bgFill) {
                    cell.fill = bgFill;
                }

                // Alignments & Number formats
                if (game === '645') {
                    if (colIdx === 0 || colIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 2 && colIdx <= 7) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '00';
                    } else if (colIdx >= 8 && colIdx <= 13) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 14) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '#,##0';
                    } else if (colIdx === 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    }
                } else {
                    if (colIdx === 0 || colIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 2 && colIdx <= 8) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '00';
                    } else if (colIdx >= 9 && colIdx <= 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 16) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '#,##0';
                    } else if (colIdx === 17) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    }
                }
            });

            rowIdx++;
        });

        // Auto-fit Columns (with a minimum width of 12)
        worksheet.columns.forEach((column) => {
            let maxLen = 0;
            column.eachCell({ includeEmpty: false }, (cell) => {
                const valStr = cell.value ? String(cell.value) : '';
                if (valStr.length > maxLen) {
                    maxLen = valStr.length;
                }
            });
            column.width = Math.max(maxLen + 3, 12);
        });

        // Send Excel file response
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        const filename = game === '645'
            ? `Vietlott_Mega645_Ky_${startId}_den_${endId}.xlsx`
            : `Vietlott_Power655_Ky_${startId}_den_${endId}.xlsx`;
            
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="${filename}"`
        );

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Tự động kiểm tra và cào kỳ quay mới để cập nhật DB
async function autoUpdateCache() {
    try {
        console.log('[auto-crawl] Bắt đầu tự động kiểm tra kỳ quay mới trên Vietlott...');
        for (const game of ['645', '655']) {
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

// 4. API mới: Nhập thủ công dữ liệu kỳ quay
app.post('/api/draws', async (req, res) => {
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
});

// 5. API mới: Yêu cầu cào nhanh một kỳ quay bất kỳ bằng Draw ID
app.post('/api/draws/quick-fetch', async (req, res) => {
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
});

// Khởi động database trước khi lắng nghe kết nối
db.initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);

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

        // Self-ping mỗi 14 phút để tránh Render sleep (chỉ trên production)
        if (process.env.NODE_ENV === 'production' && process.env.RENDER_EXTERNAL_URL) {
            const pingUrl = `${process.env.RENDER_EXTERNAL_URL}/`;
            setInterval(async () => {
                try {
                    const https = require('https');
                    https.get(pingUrl, (res) => {
                        console.log(`Self-ping OK: ${res.statusCode}`);
                    }).on('error', (err) => {
                        console.log(`Self-ping failed: ${err.message}`);
                    });
                } catch (e) {
                    console.log('Self-ping error:', e.message);
                }
            }, 14 * 60 * 1000);
            console.log(`Self-ping enabled: ${pingUrl} mỗi 14 phút`);
        }
    });
});
