// pg is the PostgreSQL client library
// Pool manages multiple database connections efficiently
// Instead of opening and closing a connection for every request
// Pool keeps a set of connections open and reuses them
// This is critical for performance under load
const { Pool } = require('pg')

// dotenv loads our .env file variables into process.env
// This must be called before reading any env variables
require('dotenv').config()

// Create a connection pool using our environment variables
// Pool automatically manages connecting and reconnecting
const pool = new Pool({
  host:     process.env.DB_HOST,
  port:     process.env.DB_PORT,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
})

// Test the connection when server starts
// This fails loudly if credentials are wrong
// Better to know immediately than during a user request
pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.message)
    return
  }
  console.log('Connected to PostgreSQL database')
  // release() returns the connection back to the pool
  release()
})

// Export pool so any file can import and use it
// Every database query in your app goes through this pool
module.exports = pool