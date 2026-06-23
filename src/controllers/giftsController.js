const pool = require('../db')

const getAll = async (req, res) => {
  try {
    // We JOIN gift_searches with recipients so each row comes back
    // with the recipient's name attached. LEFT JOIN means: even if
    // a gift_search somehow has no matching recipient (which shouldn't
    // happen in practice given our insert logic, but defensive coding
    // means we plan for it), we still get the gift_search row back
    // rather than it silently disappearing from results.
    const result = await pool.query(
      `SELECT 
        gs.id,
        gs.occasion,
        gs.budget,
        gs.suggestions,
        gs.created_at,
        r.name AS recipient_name
       FROM gift_searches gs
       LEFT JOIN recipients r ON gs.recipient_id = r.id
       WHERE gs.user_id = $1
       ORDER BY gs.created_at DESC`,
      [req.user.userId]
    )

    res.json({ success: true, data: result.rows })

  } catch (error) {
    console.error('getAll gifts error:', error)
    res.status(500).json({ error: 'Failed to fetch gifts' })
  }
}


const create = async (req, res) => {
  try {
    const { occasion, budget, suggestions, recipient_name } = req.body

    if (!occasion || !budget || !suggestions) {
      return res.status(400).json({
        error: 'occasion, budget and suggestions are required'
      })
    }

    // First create or find the recipient
    // Check if this recipient already exists for this user
    let recipientId = null

    if (recipient_name) {
      // Look for existing recipient with same name for this user
      const existingRecipient = await pool.query(
        `SELECT id FROM recipients 
         WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
        [req.user.userId, recipient_name]
      )

      if (existingRecipient.rows.length > 0) {
        // Recipient exists — reuse their ID
        recipientId = existingRecipient.rows[0].id
      } else {
        // Create new recipient
        const newRecipient = await pool.query(
          `INSERT INTO recipients (user_id, name)
           VALUES ($1, $2)
           RETURNING id`,
          [req.user.userId, recipient_name]
        )
        recipientId = newRecipient.rows[0].id
      }
    }

    // Save the gift search with real user ID from JWT
    const result = await pool.query(
      `INSERT INTO gift_searches 
        (user_id, recipient_id, occasion, budget, suggestions)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.user.userId, recipientId, occasion, budget, suggestions]
    )

    res.status(201).json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('create gift error:', error)
    res.status(500).json({ error: 'Failed to save gift search' })
  }
}

const remove = async (req, res) => {
  try {
    const { id } = req.params

    // Only delete if it belongs to the requesting user
    // Without this check, any logged in user could delete anyone's gifts
    // This is called an authorization check — not just "are you logged in"
    // but "are you allowed to do THIS specific thing"
    await pool.query(
      'DELETE FROM gift_searches WHERE id = $1 AND user_id = $2',
      [id, req.user.userId]
    )

    res.json({ success: true, message: 'Gift search deleted' })

  } catch (error) {
    console.error('delete gift error:', error)
    res.status(500).json({ error: 'Failed to delete gift search' })
  }
}

module.exports = { getAll, create, remove }