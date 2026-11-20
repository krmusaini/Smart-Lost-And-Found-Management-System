const express = require('express');
const router = express.Router();
const claimsController = require('../controllers/claimsController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Student: Submit claim and view personal claims
router.post('/', isAuthenticated, claimsController.submitClaim);
router.get('/my-claims', isAuthenticated, claimsController.getMyClaims);

// Admin: View all claims and take action
router.get('/', isAuthenticated, isAdmin, claimsController.getAllClaims);
router.post('/:id/approve', isAuthenticated, isAdmin, claimsController.approveClaim);
router.post('/:id/reject', isAuthenticated, isAdmin, claimsController.rejectClaim);

module.exports = router;
