const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');
const { validateRequired, validateEmail } = require('../middlewares/validator');

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/register
router.post('/register',
  validateRequired(['nombre', 'email', 'username', 'password']),
  validateEmail,
  register
);

module.exports = router;
