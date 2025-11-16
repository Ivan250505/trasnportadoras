const express = require('express');
const router = express.Router();
const { rastrearGuia } = require('../controllers/scrapingController');

// POST /api/rastrear-guia
router.post('/', rastrearGuia);

// GET /api/rastrear-guia/:transportadora/:numero
router.get('/:transportadora/:numero', rastrearGuia);

module.exports = router;