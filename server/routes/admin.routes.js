const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { isAuthenticated, isAdmin } = require('../middleware/auth');

// Protect all admin routes with authentication and role check
router.use(isAuthenticated, isAdmin);

// Dashboard Overview
router.get('/stats', adminController.getDashboardStats);

// Users Management
router.get('/users', adminController.getUsers);
router.patch('/users/:id/role', adminController.updateUserRole);

// Categories Management
router.get('/categories', adminController.getCategories);
router.post('/categories', adminController.createCategory);
router.put('/categories/:id', adminController.updateCategory);
router.delete('/categories/:id', adminController.deleteCategory);

// Locations Management
router.get('/locations', adminController.getLocations);
router.post('/locations', adminController.createLocation);
router.put('/locations/:id', adminController.updateLocation);
router.delete('/locations/:id', adminController.deleteLocation);

// Reports & Analytics
router.get('/reports', adminController.getReports);

module.exports = router;
