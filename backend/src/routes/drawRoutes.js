const express = require('express');
const router = express.Router();
const drawController = require('../controllers/drawController');

router.get('/latest', drawController.getLatest);
router.get('/scrape-stream', drawController.scrapeStream);
router.post('/draws', drawController.createDraw);
router.post('/draws/quick-fetch', drawController.quickFetchDraw);
router.get('/debug-html', drawController.debugHtml);

module.exports = router;
