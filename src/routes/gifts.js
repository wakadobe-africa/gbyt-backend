const express          = require('express')
const router           = express.Router()
const giftsController  = require('../controllers/giftsController')
const authMiddleware   = require('../middleware/auth')

// All gift routes are protected
// authMiddleware runs before every gift route handler
// This means req.user is always available in giftsController
router.get('/',    authMiddleware, giftsController.getAll)
router.post('/',   authMiddleware, giftsController.create)
router.delete('/:id', authMiddleware, giftsController.remove)

module.exports = router