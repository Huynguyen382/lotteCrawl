const axios = require('axios');

async function handleProxy(req, res) {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Cần truyền tham số url' });
    try {
        console.log(`[local-bridge] Nhận yêu cầu cào hộ cho URL: ${url}`);
        
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
}

module.exports = {
    handleProxy
};
