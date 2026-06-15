const express = require('express');
const router = express.Router();
const proxyController = require('../controllers/proxyController');

router.get('/proxy', proxyController.handleProxy);

module.exports = router;
