const express = require('express');
const cors = require('cors');
const drawRoutes = require('./routes/drawRoutes');
const exportRoutes = require('./routes/exportRoutes');
const proxyRoutes = require('./routes/proxyRoutes');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Root path welcome / health check
app.get('/', (req, res) => {
  res.send('Lotto Scraper API is running');
});

// API Routes
app.use('/api', drawRoutes);
app.use('/api', exportRoutes);
app.use('/api', proxyRoutes);

module.exports = app;
