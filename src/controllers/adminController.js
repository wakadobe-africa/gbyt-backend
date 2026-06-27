const pool = require('../db')

// ── GET METRICS ───────────────────────────────────────────
// Platform overview — the first thing an admin sees on their
// dashboard. Aggregates key numbers across the entire platform.
const getMetrics = async (req, res) => {
  try {
    // Run all metric queries concurrently — no reason to wait
    // for total users before counting gift searches.
    // Promise.all here because if any ONE fails we want to know
    // immediately (unlike Promise.allSettled which continues on failure)
    const [
      usersResult,
      searchesResult,
      recipientsResult,
      occasionsResult,
      budgetResult
    ] = await Promise.all([

      // Total registered users
      pool.query('SELECT COUNT(*) FROM users WHERE role = $1', ['user']),

      // Total gift searches ever run
      pool.query('SELECT COUNT(*) FROM gift_searches'),

      // Total unique recipients saved
      pool.query('SELECT COUNT(*) FROM recipients'),

      // Most popular occasions — top 5
      pool.query(`
        SELECT occasion, COUNT(*) as count
        FROM gift_searches
        GROUP BY occasion
        ORDER BY count DESC
        LIMIT 5
      `),

      // Average and most common budget ranges
      pool.query(`
        SELECT
          ROUND(AVG(budget)) as avg_budget,
          MIN(budget) as min_budget,
          MAX(budget) as max_budget
        FROM gift_searches
      `)
    ])

    res.json({
      success: true,
      data: {
        totalUsers:      parseInt(usersResult.rows[0].count),
        totalSearches:   parseInt(searchesResult.rows[0].count),
        totalRecipients: parseInt(recipientsResult.rows[0].count),
        topOccasions:    occasionsResult.rows,
        budgetStats:     budgetResult.rows[0]
      }
    })

  } catch (error) {
    console.error('getMetrics error:', error)
    res.status(500).json({ error: 'Failed to fetch metrics' })
  }
}

// ── GET ALL USERS ─────────────────────────────────────────
// Full user list with basic stats per user —
// how many searches they've run, when they last used the platform
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        u.id,
        u.email,
        u.fullname,
        u.role,
        u.created_at,
        COUNT(gs.id) as total_searches,
        MAX(gs.created_at) as last_search_at
      FROM users u
      LEFT JOIN gift_searches gs ON gs.user_id = u.id
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `)

    res.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('getAllUsers error:', error)
    res.status(500).json({ error: 'Failed to fetch users' })
  }
}

// ── GET USER BY ID ────────────────────────────────────────
// Full profile of one user including all their gift searches
const getUserById = async (req, res) => {
  try {
    const { id } = req.params

    // Get user profile
    const userResult = await pool.query(
      'SELECT id, email, fullname, role, created_at FROM users WHERE id = $1',
      [id]
    )

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Get all their searches with recipient names
    const searchesResult = await pool.query(`
      SELECT
        gs.id,
        gs.occasion,
        gs.budget,
        gs.created_at,
        r.name AS recipient_name,
        r.relationship
      FROM gift_searches gs
      LEFT JOIN recipients r ON gs.recipient_id = r.id
      WHERE gs.user_id = $1
      ORDER BY gs.created_at DESC
    `, [id])

    res.json({
      success: true,
      data: {
        user:    userResult.rows[0],
        searches: searchesResult.rows
      }
    })

  } catch (error) {
    console.error('getUserById error:', error)
    res.status(500).json({ error: 'Failed to fetch user' })
  }
}

// ── GET ALL SEARCHES ──────────────────────────────────────
// Platform-wide gift search audit log —
// lets admin see what people are searching for across the platform
const getAllSearches = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        gs.id,
        gs.occasion,
        gs.budget,
        gs.created_at,
        u.email      AS user_email,
        r.name       AS recipient_name,
        r.relationship,
        r.zodiac_sign
      FROM gift_searches gs
      LEFT JOIN users u      ON gs.user_id      = u.id
      LEFT JOIN recipients r ON gs.recipient_id = r.id
      ORDER BY gs.created_at DESC
      LIMIT 100
    `)
    

    res.json({
      success: true,
      data: result.rows
    })

  } catch (error) {
    console.error('getAllSearches error:', error)
    res.status(500).json({ error: 'Failed to fetch searches' })
  }
}

module.exports = { getMetrics, getAllUsers, getUserById, getAllSearches }