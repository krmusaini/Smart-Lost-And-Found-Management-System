const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isAuthenticated } = require('../middleware/auth');

router.get('/profile', isAuthenticated, authController.getCurrentUser);
router.put('/profile', isAuthenticated, authController.updateProfile);

module.exports = router;
