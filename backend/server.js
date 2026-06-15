const db = require('./src/config/db');
const app = require('./src/app');
const { startScheduler } = require('./src/services/scheduler');

const PORT = process.env.PORT || 5500;

// Khởi động database trước khi lắng nghe kết nối
db.initDb().then(() => {
    app.listen(PORT, () => {
        console.log(`Backend server is running on http://localhost:${PORT}`);
        startScheduler();

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
