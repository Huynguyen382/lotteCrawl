const db = require('../config/db');

async function getGameStats(game) {
    // Lấy toàn bộ lịch sử các kỳ quay (giả định max 999999 kỳ)
    const allDraws = await db.getDrawsInRange(game, 1, 999999);
    
    if (!allDraws || allDraws.length === 0) {
        return {
            totalDraws: 0,
            hot: [],
            cold: [],
            topPairs: [],
            sums: { mean: 0, min: 0, max: 0 }
        };
    }

    const mainLength = game === '535' ? 5 : 6;
    let totalDraws = 0;
    const frequency = {};
    const pairs = {};
    const sums = [];

    allDraws.forEach(draw => {
        if (!draw.numbers || draw.numbers.length < mainLength) return;
        
        // Trích xuất bóng chính, bỏ qua bóng đặc biệt nếu có
        const nums = draw.numbers.slice(0, mainLength).map(n => parseInt(n, 10));
        
        totalDraws++;
        
        // Tần suất
        nums.forEach(n => {
            frequency[n] = (frequency[n] || 0) + 1;
        });
        
        // Tổng
        const sum = nums.reduce((a, b) => a + b, 0);
        sums.push(sum);
        
        // Cặp số (tổ hợp chập 2)
        for (let i = 0; i < nums.length; i++) {
            for (let j = i + 1; j < nums.length; j++) {
                const n1 = nums[i];
                const n2 = nums[j];
                const pKey = n1 < n2 ? `${n1}-${n2}` : `${n2}-${n1}`;
                pairs[pKey] = (pairs[pKey] || 0) + 1;
            }
        }
    });

    // Sắp xếp Hot/Cold
    const freqArr = Object.entries(frequency).map(([num, count]) => ({ num: parseInt(num, 10), count }));
    freqArr.sort((a, b) => b.count - a.count);
    
    const hot = freqArr.slice(0, 10).map(x => x.num);
    const cold = freqArr.slice(-10).map(x => x.num);
    
    // Sắp xếp các cặp số hay xuất hiện nhất
    const pairsArr = Object.entries(pairs).map(([pair, count]) => ({ pair, count }));
    pairsArr.sort((a, b) => b.count - a.count);
    
    // Lấy Top 50 cặp số để dùng làm luật kết hợp chấm điểm
    const topPairs = pairsArr.slice(0, 50).map(x => x.pair);
    
    // Tính toán phân bố Tổng
    sums.sort((a, b) => a - b);
    const sumMean = Math.round(sums.reduce((a, b) => a + b, 0) / sums.length);
    const sumMin = sums[0];
    const sumMax = sums[sums.length - 1];

    return {
        totalDraws,
        hot,
        cold,
        topPairs,
        sums: { mean: sumMean, min: sumMin, max: sumMax }
    };
}

module.exports = {
    getGameStats
};
