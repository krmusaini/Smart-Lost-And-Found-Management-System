const express = require('express');
const router = express.Router();
const handoversController = require('../controllers/handoversController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.post('/', isAuthenticated, isAdmin, handoversController.recordHandover);
router.get('/', isAuthenticated, isAdmin, handoversController.getAllHandovers);
router.get('/pending', isAuthenticated, isAdmin, handoversController.getPendingHandovers);
router.get('/my-handovers', isAuthenticated, handoversController.getMyHandovers);

module.exports = router;
