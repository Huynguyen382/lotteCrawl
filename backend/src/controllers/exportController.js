const ExcelJS = require('exceljs');
const db = require('../config/db');
const { fetchDrawDetail } = require('../services/scraperService');

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

async function exportExcel(req, res) {
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

        // Tính toán khoảng vắng mặt cho từng số và Tổng Vắng của mỗi kỳ quay
        const allHistory = await db.getDrawsInRange(game, 1, eId);
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

            // Tổng Vắng là tổng vắng mặt của 6 số chính (5 số chính cho 535)
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

        // Lấy kỳ quay liền trước sId để tính delta cho kỳ đầu tiên
        const firstDrawPrev = await getPreviousDrawDetail(game, sId);

        const workbook = new ExcelJS.Workbook();
        const sheetName = game === '645' ? 'Mega 6-45' : (game === '655' ? 'Power 6-55' : 'Lotto 5-35');
        const worksheet = workbook.addWorksheet(sheetName);

        // Styling configuration
        const fontName = 'Segoe UI';
        const titleColor = '1D3557';
        const headerBgColor = '457B9D';
        const headerTextColor = 'FFFFFF';
        const zebraBgColor = 'F8F9FA';
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
            : (game === '655' ? `KẾT QUẢ CÀO DỮ LIỆU VIETLOTT POWER 6/55 (KỲ #${startId} - #${endId})` : `KẾT QUẢ CÀO DỮ LIỆU VIETLOTT LOTTO 5/35 (KỲ #${startId} - #${endId})`);
        
        // Headers
        let headers = [];
        if (game === '645') {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6',
                'Lệch S1', 'Lệch S2', 'Lệch S3', 'Lệch S4', 'Lệch S5', 'Lệch S6',
                'Tổng', 'Lệch Tổng', 'Tổng Vắng',
                'Giá Trị Jackpot (đ)', 'Trúng Jackpot', 
                'Trúng Giải Nhất (10M)', 'Trúng Giải Nhì (300k)', 'Trúng Giải Ba (30k)'
            ];
        } else if (game === '655') {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số 6', 'Số Đặc Biệt',
                'Lệch S1', 'Lệch S2', 'Lệch S3', 'Lệch S4', 'Lệch S5', 'Lệch S6', 'Lệch SĐB',
                'Tổng', 'Lệch Tổng', 'Tổng Vắng',
                'Giá Trị Jackpot 1 (đ)', 'Trúng Jackpot 1', 
                'Giá Trị Jackpot 2 (đ)', 'Trúng Jackpot 2', 
                'Trúng Giải Nhất (40M)', 'Trúng Giải Nhì (500k)', 'Trúng Giải Ba (50k)'
            ];
        } else if (game === '535') {
            headers = [
                'Kỳ Quay', 'Ngày Quay', 
                'Số 1', 'Số 2', 'Số 3', 'Số 4', 'Số 5', 'Số Đặc Biệt',
                'Lệch S1', 'Lệch S2', 'Lệch S3', 'Lệch S4', 'Lệch S5', 'Lệch SĐB',
                'Tổng', 'Lệch Tổng', 'Tổng Vắng',
                'Giá Trị Jackpot (đ)', 'Trúng Jackpot', 
                'Trúng Giải Nhất (10M)', 'Trúng Giải Nhì (5M)', 'Trúng Giải Ba (500k)',
                'Trúng Giải Tư (100k)', 'Trúng Giải Năm (30k)', 'Trúng Giải Khuyến Khích (10k)'
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
                } else if (game === '655') {
                    const curMain = currentNums.slice(0, 6).sort((a, b) => a - b);
                    const prevMain = prevNums.slice(0, 6).sort((a, b) => a - b);
                    curSorted = [...curMain, currentNums[6]];
                    prevSorted = [...prevMain, prevNums[6]];
                } else if (game === '535') {
                    const curMain = currentNums.slice(0, 5).sort((a, b) => a - b);
                    const prevMain = prevNums.slice(0, 5).sort((a, b) => a - b);
                    curSorted = [...curMain, currentNums[5]];
                    prevSorted = [...prevMain, prevNums[5]];
                }

                numDeltas = curSorted.map((num, idx) => num - prevSorted[idx]);
            } else {
                if (game === '645') {
                    numDeltas = [null, null, null, null, null, null];
                } else if (game === '655') {
                    numDeltas = [null, null, null, null, null, null, null];
                } else if (game === '535') {
                    numDeltas = [null, null, null, null, null, null];
                }
            }

            const drawAbs = absencesByDrawId[draw.drawId] || { individualAbsences: [], totalAbsence: 'N/A' };
            const absList = drawAbs.individualAbsences;
            const getValWithAbs = (idx) => {
                const abs = absList[idx];
                return abs !== undefined ? `${draw.numbers[idx]} (${abs})` : draw.numbers[idx];
            };

            if (game === '645') {
                const jack = draw.prizes.find(p => p.name.toLowerCase().includes('jackpot')) || { value: 0, count: 0 };
                const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || { count: 0 };
                const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || { count: 0 };
                const g3 = draw.prizes.find(p => p.name.includes('Ba')) || { count: 0 };

                rowData = [
                    `#${draw.drawIdStr}`,
                    draw.dateStr,
                    getValWithAbs(0),
                    getValWithAbs(1),
                    getValWithAbs(2),
                    getValWithAbs(3),
                    getValWithAbs(4),
                    getValWithAbs(5),
                    numDeltas[0],
                    numDeltas[1],
                    numDeltas[2],
                    numDeltas[3],
                    numDeltas[4],
                    numDeltas[5],
                    currentSum,
                    sumDiff,
                    drawAbs.totalAbsence,
                    jack.value,
                    jack.count,
                    g1.count,
                    g2.count,
                    g3.count
                ];
            } else if (game === '655') {
                const jack1 = draw.prizes.find(p => p.name.includes('Jackpot 1')) || { value: 0, count: 0 };
                const jack2 = draw.prizes.find(p => p.name.includes('Jackpot 2')) || { value: 0, count: 0 };
                const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || { count: 0 };
                const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || { count: 0 };
                const g3 = draw.prizes.find(p => p.name.includes('Ba')) || { count: 0 };

                rowData = [
                    `#${draw.drawIdStr}`,
                    draw.dateStr,
                    getValWithAbs(0),
                    getValWithAbs(1),
                    getValWithAbs(2),
                    getValWithAbs(3),
                    getValWithAbs(4),
                    getValWithAbs(5),
                    getValWithAbs(6), // Bonus ball
                    numDeltas[0],
                    numDeltas[1],
                    numDeltas[2],
                    numDeltas[3],
                    numDeltas[4],
                    numDeltas[5],
                    numDeltas[6], // Bonus ball delta
                    currentSum,
                    sumDiff,
                    drawAbs.totalAbsence,
                    jack1.value,
                    jack1.count,
                    jack2.value,
                    jack2.count,
                    g1.count,
                    g2.count,
                    g3.count
                ];
            } else if (game === '535') {
                const jackpot = draw.prizes.find(p => p.name.includes('Độc Đắc')) || { value: 0, count: 0 };
                const g1 = draw.prizes.find(p => p.name.includes('Nhất')) || { count: 0 };
                const g2 = draw.prizes.find(p => p.name.includes('Nhì')) || { count: 0 };
                const g3 = draw.prizes.find(p => p.name.includes('Ba')) || { count: 0 };
                const g4 = draw.prizes.find(p => p.name.includes('Tư')) || { count: 0 };
                const g5 = draw.prizes.find(p => p.name.includes('Năm')) || { count: 0 };
                const g6 = draw.prizes.find(p => p.name.includes('Khuyến Khích')) || { count: 0 };

                rowData = [
                    `#${draw.drawIdStr}`,
                    draw.dateStr,
                    getValWithAbs(0),
                    getValWithAbs(1),
                    getValWithAbs(2),
                    getValWithAbs(3),
                    getValWithAbs(4),
                    getValWithAbs(5), // Special ball
                    numDeltas[0],
                    numDeltas[1],
                    numDeltas[2],
                    numDeltas[3],
                    numDeltas[4],
                    numDeltas[5], // Special ball delta
                    currentSum,
                    sumDiff,
                    drawAbs.totalAbsence,
                    jackpot.value,
                    jackpot.count,
                    g1.count,
                    g2.count,
                    g3.count,
                    g4.count,
                    g5.count,
                    g6.count
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
                    } else if (colIdx >= 8 && colIdx <= 13) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 14) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '#,##0';
                    } else if (colIdx === 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 16) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    }
                } else if (game === '655') {
                    if (colIdx === 0 || colIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 2 && colIdx <= 8) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 9 && colIdx <= 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 16) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '#,##0';
                    } else if (colIdx === 17) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 18) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    } else {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
                    }
                } else if (game === '535') {
                    if (colIdx === 0 || colIdx === 1) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 2 && colIdx <= 7) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if (colIdx >= 8 && colIdx <= 13) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 14) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '#,##0';
                    } else if (colIdx === 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        cell.numFmt = '+0;-0;0';
                    } else if (colIdx === 16) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (typeof val === 'number') {
                            cell.numFmt = '#,##0';
                        }
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

        // Auto-fit Columns
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

        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        const filename = game === '645'
            ? `Vietlott_Mega645_Ky_${startId}_den_${endId}.xlsx`
            : (game === '655' ? `Vietlott_Power655_Ky_${startId}_den_${endId}.xlsx` : `Vietlott_Lotto535_Ky_${startId}_den_${endId}.xlsx`);
            
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
}

module.exports = {
    exportExcel
};
