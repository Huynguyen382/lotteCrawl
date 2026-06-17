const express = require('express');
const router = express.Router();
const drawController = require('../controllers/drawController');

router.get('/latest', drawController.getLatest);
router.get('/scrape-stream', drawController.scrapeStream);
router.get('/draws/:game', drawController.getDraws);
router.get('/draws/:game/:drawId', drawController.getDrawOne);
router.post('/draws', drawController.createDraw);
router.put('/draws/:game/:drawId', drawController.updateDraw);
router.delete('/draws/:game/:drawId', drawController.deleteDraw);
router.post('/draws/quick-fetch', drawController.quickFetchDraw);
router.get('/debug-html', drawController.debugHtml);
router.get('/stats/v2/:game', drawController.getStatsV2);

module.exports = router;
