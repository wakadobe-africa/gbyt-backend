// ============================================================
// ADMIN MIDDLEWARE
// ============================================================
// This middleware runs AFTER authMiddleware in the chain.
// authMiddleware verifies the JWT is valid and attaches req.user.
// requireAdmin then checks that the verified user has admin role.
//
// Why two separate middleware functions rather than one?
// Because authentication (who are you?) and authorization
// (are you ALLOWED to do this?) are genuinely separate concerns.
// Some routes need auth but not admin (e.g. GET /api/gifts).
// Admin routes need BOTH. Keeping them separate means you
// compose them where needed rather than duplicating logic.
//
// Usage in routes:
// router.get('/admin/users', authMiddleware, requireAdmin, handler)
//                            ↑ verifies JWT  ↑ checks role
// ============================================================

function requireAdmin(req, res, next) {

  // At this point, authMiddleware has already run and attached
  // req.user = { userId, email, role } from the JWT payload.
  // We trust this because authMiddleware verified the JWT signature.
  if (!req.user) {
    // Defensive check — requireAdmin should always run after
    // authMiddleware, but if it somehow doesn't, fail safely
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Authentication required'
    })
  }

  if (req.user.role !== 'admin') {
    // User is authenticated (valid JWT) but not authorized (wrong role).
    // 403 Forbidden is the correct status code here —
    // 401 means "I don't know who you are"
    // 403 means "I know who you are, but you can't do this"
    return res.status(403).json({
      error: 'Forbidden',
      message: 'Admin access required'
    })
  }

  // Role is 'admin' — pass control to the next handler
  next()
}

module.exports = requireAdmin