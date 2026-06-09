const express = require('express');
const cors = require('cors');
const ExcelJS = require('exceljs');
const { fetchLatestDrawInfo, fetchDrawDetail, findDrawIdForDate, cache } = require('./scraper');

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
            'GET /api/export?game=645&startId=1&endId=100'
        ]
    });
});

// 1. Get latest draw info
app.get('/api/latest', async (req, res) => {
    const { game } = req.query; // '645' or '655'
    if (!game || (game !== '645' && game !== '655')) {
        return res.status(400).json({ error: 'Game type must be 645 or 655' });
    }
    try {
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
    res.flushHeaders();

    const sendEvent = (type, data) => {
        res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    };

    try {
        sendEvent('log', { message: 'Đang kết nối đến hệ thống Vietlott...' });
        
        // 1. Fetch latest draw info to set upper bound
        const latestInfo = await fetchLatestDrawInfo(game);
        const latestId = latestInfo.drawId;
        sendEvent('log', { message: `Kỳ quay mới nhất hiện tại: #${latestId} (${latestInfo.dateStr})` });

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
        // 3. Fetch details for each draw
        for (let id = startId; id <= endId; id++) {
            const progressPercent = Math.round(((id - startId) / totalDraws) * 100);
            sendEvent('progress', { 
                currentId: id, 
                progress: id - startId, 
                total: totalDraws, 
                percent: progressPercent,
                message: `Đang tải chi tiết kỳ quay #${id}...`
            });

            try {
                const drawDetail = await fetchDrawDetail(game, id, true);
                results.push(drawDetail);
            } catch (err) {
                sendEvent('log', { message: `Cảnh báo: Không thể tải kỳ quay #${id}: ${err.message}` });
            }
        }

        sendEvent('complete', { 
            startId, 
            endId, 
            totalCrawled: results.length,
            results 
        });
        res.end();
    } catch (error) {
        console.error('SSE Error:', error);
        sendEvent('error', { message: `Lỗi hệ thống: ${error.message}` });
        res.end();
    }
});

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
        const draws = [];
        for (let id = sId; id <= eId; id++) {
            if (cache[game] && cache[game][id]) {
                draws.push(cache[game][id]);
            } else {
                // Fetch and cache it if somehow missing
                try {
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
        
        worksheet.mergeCells('A1:L1');
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

        // Headers
        let headers = [];
        if (game === '645') {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6',
                'Giá Trị Jackpot (đ)', 'Trúng Jackpot', 
                'Trúng Giải Nhất (10M)', 'Trúng Giải Nhì (300k)', 'Trúng Giải Ba (30k)'
            ];
        } else {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6', 'Số Đặc Biệt',
                'Giá Trị Jackpot 1 (đ)', 'Trúng Jackpot 1', 
                'Giá Trị Jackpot 2 (đ)', 'Trúng Jackpot 2', 
                'Trúng Giải Nhất (40M)', 'Trúng Giải Nhì (500k)', 'Trúng Giải Ba (50k)'
            ];
        }

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
        draws.forEach((draw) => {
            const dataRow = worksheet.getRow(rowIdx);
            dataRow.height = 22;

            let rowData = [];
            const isZebra = rowIdx % 2 === 0;
            const bgFill = isZebra ? {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: zebraBgColor }
            } : null;

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
                if (colIdx === 0 || colIdx === 1) {
                    // ID & Date
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                } else if (colIdx >= 2 && colIdx <= (game === '645' ? 7 : 8)) {
                    // Winning balls
                    cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    cell.numFmt = '00'; // Keep padding
                } else {
                    // Prize counts & values
                    cell.alignment = { vertical: 'middle', horizontal: 'right' };
                    if (typeof val === 'number') {
                        cell.numFmt = '#,##0';
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

app.listen(PORT, () => {
    console.log(`Backend server is running on http://localhost:${PORT}`);

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
        }, 14 * 60 * 1000); // 14 phút
        console.log(`Self-ping enabled: ${pingUrl} mỗi 14 phút`);
    }
});
