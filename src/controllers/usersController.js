const bcrypt   = require('bcryptjs')
const jwt      = require('jsonwebtoken')
const pool     = require('../db')

// ── REGISTER ──────────────────────────────────────────────
// Creates a new user account
const register = async (req, res) => {
  try {
    // Extract data from request body
    // This is what your React frontend will send
    const { email, password, fullname } = req.body

    // Validate input exists
    if (!email || !password || !fullname) {
      return res.status(400).json({
        error: 'Email, password, and fullname are required'
      })
    }

    // Validate email format using regex
    // This is a basic check — more thorough validation
    // can be added later
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        error: 'Invalid email format'
      })
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        error: 'Password must be at least 6 characters'
      })
    }

    // Check if email already exists in database
    // We never want two accounts with the same email
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()] // always store emails lowercase
    )

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists'
      })
    }

    // Hash the password before storing
    // 10 is the "salt rounds" — how much computation to use
    // Higher = more secure but slower
    // 10 is the industry standard balance
    const saltRounds  = 10
    const passwordHash = await bcrypt.hash(password, saltRounds)

    // Insert the new user into the database
    // We store email lowercase and the hash, never the plain password
    const result = await pool.query(
      `INSERT INTO users (email, password_hash, fullname)
       VALUES ($1, $2, $3)
       RETURNING id, email, password_hash, fullname, role, created_at`,
      [email.toLowerCase(), passwordHash, fullname]
    )

    const newUser = result.rows[0]

    // Create a JWT token for the new user
    // They're automatically logged in after registering
    // jwt.sign(payload, secret, options)
    const token = jwt.sign(
      // Payload — data we embed in the token
      // Keep it minimal — only what you need on every request
      {
        userId: newUser.id,
        email:  newUser.email,
        role: newUser.role
      },
      // Secret — must match what authMiddleware uses to verify
      process.env.JWT_SECRET,
      // Options
      {
        expiresIn: '7d' // token expires in 7 days, user must login again
      }
    )

    // Return 201 Created with user data and token
    // Frontend will store this token and send it with future requests
    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      user: {
        id:         newUser.id,
        email:      newUser.email,
        fullname:   newUser.fullname,
        role:       newUser.role,
        created_at: newUser.created_at
      }
    })

  } catch (error) {
    console.error('Register error:', error)
    res.status(500).json({ error: 'Registration failed' })
  }
}

// ── LOGIN ─────────────────────────────────────────────────
// Authenticates an existing user
const login = async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({
        error: 'Email and password are required'
      })
    }

    // Find user by email
    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    )

    // User not found
    // Important: we give the same error for wrong email AND wrong password
    // This prevents attackers from knowing which one is wrong
    // This is called "user enumeration protection"
    if (result.rows.length === 0) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    const user = result.rows[0]

    // Compare the submitted password against the stored hash
    // bcrypt.compare hashes the plain password and compares
    // Returns true if they match, false if not
    const passwordMatch = await bcrypt.compare(password, user.password_hash)

    if (!passwordMatch) {
      return res.status(401).json({
        error: 'Invalid email or password'
      })
    }

    // Password matches — issue a new token
    const token = jwt.sign(
      {
        userId: user.id,
        email:  user.email,
        role: user.role
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    // Return token and user data
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id:         user.id,
        email:      user.email,
        fullname:   user.fullname,
        role:       user.role,
        created_at: user.created_at
      }
    })

  } catch (error) {
    console.error('Login error:', error)
    res.status(500).json({ error: 'Login failed' })
  }
}

// ── GET ME ────────────────────────────────────────────────
// Returns the current logged in user's profile
// This route will be protected by authMiddleware
const getMe = async (req, res) => {
  try {
    // req.user was attached by authMiddleware
    // It contains the decoded JWT payload: { userId, email }
    const result = await pool.query(
      'SELECT id, email, fullname, created_at FROM users WHERE id = $1',
      [req.user.userId]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      success: true,
      user: result.rows[0]
    })

  } catch (error) {
    console.error('User error:', error)
    res.status(500).json({ error: 'Failed to get user' })
  }
}

module.exports = { register, login, getMe }