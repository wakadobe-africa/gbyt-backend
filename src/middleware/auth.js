const jwt = require('jsonwebtoken')

// This middleware function runs BEFORE protected route handlers
// It intercepts the request, checks the token, then either:
// - Calls next() to pass the request to the route handler
// - Returns 401 Unauthorized if the token is missing or invalid

function authMiddleware(req, res, next) {

  // Tokens are sent in the Authorization header like this:
  // Authorization: Bearer eyJhbGciOiJIUzI1NiJ9...
  // We extract just the token part after "Bearer "
  const authHeader = req.headers.authorization

  // If no Authorization header exists, reject immediately
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Access Denied'
    })
  }

  // Split "Bearer tokenstring" and take index [1]
  const token = authHeader.split(' ')[1]

  try {
    // jwt.verify does two things:
    // 1. Checks the signature using JWT_SECRET
    // 2. Decodes the payload and returns it
    // If either fails it throws an error
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    
    // Attach the decoded user data to the request object
    // Now any route handler after this middleware can access
    // req.user.userId, req.user.email etc
    // This is how routes know WHO is making the request
    req.user = decoded

    // next() passes control to the next middleware or route handler
    // Without calling next() the request hangs forever
    next()

  } catch (error) {

    // jwt.verify throws different errors for different problems
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Token has expired, please login again'
      })
    }

    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid token'
    })
  }
}

module.exports = authMiddleware