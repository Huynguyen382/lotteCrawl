const ExcelJS = require('exceljs');
const fs = require('fs');

const files = [
    { name: 'Power 6/55', path: 'C:\\Users\\huytn\\Downloads\\Vietlott_Power655_Ky_1134_den_1359.xlsx', game: '655', numBalls: 6 },
    { name: 'Mega 6/45', path: 'C:\\Users\\huytn\\Downloads\\Vietlott_Mega645_Ky_1297_den_1523.xlsx', game: '645', numBalls: 6 },
    { name: 'Lotto 5/35', path: 'C:\\Users\\huytn\\Downloads\\Vietlott_Lotto535_Ky_1_den_705.xlsx', game: '535', numBalls: 5 }
];

// Helper to extract number from "XX (Y)" format
function parseNum(val) {
    if (!val) return null;
    const str = String(val).trim();
    const parts = str.split(' ');
    const num = parseInt(parts[0], 10);
    return isNaN(num) ? null : num;
}

async function analyze() {
    for (const file of files) {
        console.log(`\n======================================`);
        console.log(`Đang phân tích: ${file.name}`);
        console.log(`Đường dẫn: ${file.path}`);
        
        if (!fs.existsSync(file.path)) {
            console.log(`❌ Lỗi: File không tồn tại ở đường dẫn này.`);
            continue;
        }

        try {
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.readFile(file.path);
            const worksheet = workbook.worksheets[0];
            
            let totalDraws = 0;
            const frequency = {};
            const pairs = {};
            const sums = [];
            
            worksheet.eachRow((row, rowNumber) => {
                if (rowNumber <= 3) return; // Skip headers
                
                const nums = [];
                for (let i = 0; i < file.numBalls; i++) {
                    const colIdx = 3 + i;
                    const cellVal = row.getCell(colIdx).value;
                    const num = parseNum(cellVal);
                    if (num !== null) nums.push(num);
                }
                
                if (nums.length === file.numBalls) {
                    totalDraws++;
                    
                    // Count Frequency
                    nums.forEach(n => {
                        frequency[n] = (frequency[n] || 0) + 1;
                    });
                    
                    // Sum calculation
                    const sum = nums.reduce((a, b) => a + b, 0);
                    sums.push(sum);
                    
                    // Count pairs
                    for (let i = 0; i < nums.length; i++) {
                        for (let j = i + 1; j < nums.length; j++) {
                            const n1 = nums[i];
                            const n2 = nums[j];
                            const pKey = n1 < n2 ? `${n1}-${n2}` : `${n2}-${n1}`;
                            pairs[pKey] = (pairs[pKey] || 0) + 1;
                        }
                    }
                }
            });
            
            if (totalDraws === 0) {
                console.log('Không đọc được dòng dữ liệu nào hợp lệ.');
                continue;
            }
            
            console.log(`✅ Tổng số kỳ quay phân tích: ${totalDraws}`);
            
            // Phân tích tần suất
            const freqArr = Object.entries(frequency).map(([num, count]) => ({ num: parseInt(num), count }));
            freqArr.sort((a, b) => b.count - a.count);
            
            console.log(`\n-> TOP 5 số xuất hiện nhiều nhất (HOT): ${freqArr.slice(0, 5).map(x => `${x.num}(${x.count} lần)`).join(', ')}`);
            console.log(`-> TOP 5 số xuất hiện ít nhất (COLD): ${freqArr.slice(-5).map(x => `${x.num}(${x.count} lần)`).join(', ')}`);
            
            // Phân tích cặp số
            const pairsArr = Object.entries(pairs).map(([pair, count]) => ({ pair, count }));
            pairsArr.sort((a, b) => b.count - a.count);
            console.log(`\n-> TOP 5 cặp số hay đi cùng nhau: ${pairsArr.slice(0, 5).map(x => `[${x.pair}] (${x.count} lần)`).join(', ')}`);
            
            // Phân tích tổng
            sums.sort((a, b) => a - b);
            const sumMean = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
            const sumMin = sums[0];
            const sumMax = sums[sums.length - 1];
            
            // Count distribution near mean (within +/- 15)
            const sumNearMeanCount = sums.filter(s => s >= sumMean - 15 && s <= sumMean + 15).length;
            const percentNearMean = Math.round((sumNearMeanCount / totalDraws) * 100);
            
            console.log(`\n-> Phân bố Tổng: Trung bình = ${sumMean}, Min = ${sumMin}, Max = ${sumMax}`);
            console.log(`-> ${percentNearMean}% số kỳ quay có tổng rơi vào vùng trung tâm [${sumMean - 15} -> ${sumMean + 15}].`);
            
        } catch (e) {
            console.error(`Lỗi đọc file: ${e.message}`);
        }
    }
}

analyze();
