const pool = require('../db')

// Import from our new service layer — the controller delegates
// recipient logic entirely to the service, keeping itself focused
// purely on HTTP request/response handling
const { findOrCreateRecipient } = require('../services/recipientsService')

const getAll = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        gs.id,
        gs.occasion,
        gs.budget,
        gs.suggestions,
        gs.created_at,
        r.name          AS recipient_name,
        r.relationship  AS recipient_relationship,
        r.zodiac_sign   AS recipient_zodiac
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
    const {
      occasion,
      budget,
      suggestions,
      recipient_name,
      relationship,
      date_of_birth,
      personality_notes,
      gender
    } = req.body

    if (!occasion || !budget || !suggestions) {
      return res.status(400).json({
        error: 'occasion, budget and suggestions are required'
      })
    }

    // The controller's ONLY job here is: receive the HTTP data,
    // hand it to the service, get back a result.
    // All the logic of "does this recipient exist, create or update,
    // derive zodiac sign" now lives entirely in the service.
    // This controller function went from ~30 lines of mixed concerns
    // to a clean, readable delegation.
    let recipientId = null
    if (recipient_name) {
      const recipient = await findOrCreateRecipient(req.user.userId, {
        name: recipient_name,
        relationship,
        date_of_birth,
        personality_notes,
        gender
      })
      recipientId = recipient.id
    }

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