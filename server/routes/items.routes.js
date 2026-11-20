const express = require('express');
const router = express.Router();
const itemsController = require('../controllers/itemsController');
const { isAuthenticated } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public or student routes
router.get('/', itemsController.getItems);
router.get('/metadata', itemsController.getMetadata);
router.get('/my-reports', isAuthenticated, itemsController.getMyReports);
router.get('/:id', itemsController.getItemById);

// Protected routes
router.post('/', isAuthenticated, upload.single('image'), itemsController.createItem);
router.put('/:id', isAuthenticated, itemsController.updateItem);
router.patch('/:id/close', isAuthenticated, itemsController.closeItem);

module.exports = router;
