const express        = require('express')
const router         = express.Router()
const authMiddleware  = require('../middleware/auth')
const requireAdmin    = require('../middleware/requireAdmin')
const adminController = require('../controllers/adminController')

// Every admin route runs BOTH middleware in sequence:
// 1. authMiddleware  → verify JWT, attach req.user
// 2. requireAdmin    → confirm req.user.role === 'admin'
// Only then does the controller function run.

// Platform overview metrics
router.get('/metrics',      authMiddleware, requireAdmin, adminController.getMetrics)

// User management
router.get('/users',        authMiddleware, requireAdmin, adminController.getAllUsers)
router.get('/users/:id',    authMiddleware, requireAdmin, adminController.getUserById)

// Gift search audit log
router.get('/searches',     authMiddleware, requireAdmin, adminController.getAllSearches)

module.exports = router