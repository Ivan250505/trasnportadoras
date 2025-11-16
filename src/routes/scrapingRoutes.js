const express = require('express');
const router = express.Router();
const { rastrearGuia } = require('../controllers/scrapingController');

// POST /api/rastrear-guia
router.post('/', rastrearGuia);

// GET /api/rastrear-guia/:numero
router.get('/:numero', rastrearGuia);

module.exports = router;
