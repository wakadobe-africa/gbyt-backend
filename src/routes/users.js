const express        = require('express')
const router         = express.Router()
const usersController = require('../controllers/usersController')
const authMiddleware  = require('../middleware/auth')

// Public routes — no token needed
router.post('/register', usersController.register)
router.post('/login',    usersController.login)

// Protected route — authMiddleware runs first
// If token is valid, getMe runs
// If token is invalid, authMiddleware returns 401 and getMe never runs
router.get('/me', authMiddleware, usersController.getMe)

module.exports = router