const { Pool } = require('pg')
require('dotenv').config()

// Render provides ONE single connection string (DATABASE_URL) rather
// than five separate variables. Locally, you're still using your
// separate DB_HOST/DB_PORT/etc variables. This code supports BOTH
// patterns, so the exact same file works whether you're running
// locally or deployed on Render — you don't need two different
// versions of this file.
const pool = process.env.DATABASE_URL
  ? new Pool({
      // When DATABASE_URL exists (which it will, automatically,
      // once deployed on Render), use it directly
      connectionString: process.env.DATABASE_URL,
      // Render's internal network requires SSL, but with a
      // self-signed certificate setup that Node's default strict
      // SSL checking would reject. This setting tells the Postgres
      // client "use SSL, but don't reject Render's certificate
      // chain" — this is Render's own documented requirement,
      // not a security shortcut we're improvising
      ssl: {
        rejectUnauthorized: false
      }
    })
  : new Pool({
      // Local development fallback — your original setup, untouched
      host:     process.env.DB_HOST,
      port:     process.env.DB_PORT,
      database: process.env.DB_NAME,
      user:     process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    })

pool.connect((err, client, release) => {
  if (err) {
    console.error('Database connection failed:', err.message)
    return
  }
  console.log('Connected to PostgreSQL database')
  release()
})

module.exports = pool