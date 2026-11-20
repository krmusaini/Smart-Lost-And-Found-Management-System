const express = require('express');
const router = express.Router();
const matchesController = require('../controllers/matchesController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

router.get('/my-matches', isAuthenticated, matchesController.getMyMatches);
router.get('/', isAuthenticated, isAdmin, matchesController.getAllMatches);
router.post('/trigger', isAuthenticated, isAdmin, matchesController.triggerMatching);
router.patch('/:id/status', isAuthenticated, isAdmin, matchesController.updateMatchStatus);

module.exports = router;
