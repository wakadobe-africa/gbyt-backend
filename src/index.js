// Load environment variables first
// This must be the very first thing — before any other imports
// that might read process.env
require('dotenv').config()

const express = require('express')
const cors    = require('cors')

// Import our route files
// We haven't built these fully yet but we register them now
const giftsRouter = require('./routes/gifts')
const usersRouter = require('./routes/users')

// Create the Express application
// app is the core object — everything attaches to it
const app = express()

// ── MIDDLEWARE ──────────────────────────────────────────
// Middleware are functions that run on EVERY request
// before it reaches your routes
// Think of them as a pipeline — request passes through
// each middleware in order before hitting your route handler

// cors() allows requests from your React frontend
// Without this, the browser blocks all frontend requests
app.use(cors({
  origin: 'http://localhost:5173', // only allow your React app
  credentials: true                // allow cookies and auth headers
}))

// express.json() parses incoming request bodies as JSON
// Without this, req.body is undefined when frontend sends data
// This is one of the most common mistakes beginners make
app.use(express.json())

// ── ROUTES ──────────────────────────────────────────────
// Register route handlers with a base path
// Any request starting with /api/users goes to usersRouter
// Any request starting with /api/gifts goes to giftsRouter
app.use('/api/users', usersRouter)
app.use('/api/gifts', giftsRouter)

// ── HEALTH CHECK ────────────────────────────────────────
// A simple route to verify the server is running
// Useful for debugging and monitoring in production
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'GiftMap server is running',
    timestamp: new Date().toISOString()
  })
})

// ── 404 HANDLER ─────────────────────────────────────────
// If no route matched, send a 404 response
// The * wildcard catches everything that fell through
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  })
})

// ── ERROR HANDLER ───────────────────────────────────────
// Express has a special 4-argument middleware for errors
// When any route calls next(error), it lands here
// Centralizes all error handling in one place
app.use((err, req, res, next) => {
  console.error('Server error:', err.message)
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  })
})

// ── START SERVER ────────────────────────────────────────
// Read port from environment or default to 3001
const PORT = process.env.PORT

app.listen(PORT, () => {
  console.log(`GiftMap server running on http://localhost:${PORT}`)
})