// ============================================================
// RECIPIENTS SERVICE
// ============================================================
// This file contains ALL business logic related to recipients.
// It knows nothing about HTTP, Express, req, or res — it only
// knows about data and rules. The controller calls these
// functions and handles the HTTP layer separately.
//
// This separation means:
// 1. These functions are testable without mocking HTTP
// 2. They're reusable from any context, not just HTTP routes
// 3. The controller stays thin and readable — just req/res wiring
// ============================================================

const pool = require('../db')

// ── ZODIAC SIGN DERIVATION ─────────────────────────────────
// Pure function — takes a date, returns a zodiac sign string.
// No database calls, no HTTP, no side effects. This is exactly
// the kind of function that belongs in a service rather than
// a controller — it's reusable, independently testable, and
// has nothing to do with handling an HTTP request.
//
// Zodiac date ranges are fixed astronomical boundaries that
// never change, so hardcoding them here is correct — this
// isn't configuration data that would ever need updating.
function deriveZodiacSign(dateOfBirth) {
  if (!dateOfBirth) return null

  // Parse the date — handle both Date objects and date strings
  const date = new Date(dateOfBirth)
  const month = date.getMonth() + 1  // getMonth() is 0-indexed, so +1
  const day   = date.getDate()

  // Each zodiac sign has a precise start and end date.
  // We check month and day together to determine which sign applies.
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return 'Aries'
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return 'Taurus'
  if ((month === 5 && day >= 21) || (month === 6 && day <= 20)) return 'Gemini'
  if ((month === 6 && day >= 21) || (month === 7 && day <= 22)) return 'Cancer'
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return 'Leo'
  if ((month === 8 && day >= 23) || (month === 9 && day <= 22)) return 'Virgo'
  if ((month === 9 && day >= 23) || (month === 10 && day <= 22)) return 'Libra'
  if ((month === 10 && day >= 23) || (month === 11 && day <= 21)) return 'Scorpio'
  if ((month === 11 && day >= 22) || (month === 12 && day <= 21)) return 'Sagittarius'
  if ((month === 12 && day >= 22) || (month === 1 && day <= 19)) return 'Capricorn'
  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return 'Aquarius'
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return 'Pisces'

  return null // fallback — should never reach here with a valid date
}

// ── FIND OR CREATE RECIPIENT ───────────────────────────────
// Core business rule: if a recipient with this name already
// exists for this user, reuse them — don't create duplicates.
// If they don't exist, create them with all provided details.
//
// This function also handles zodiac derivation automatically —
// the caller never needs to think about zodiac calculation,
// it just passes a date_of_birth and gets it handled.
async function findOrCreateRecipient(userId, recipientData) {
  const {
    name,
    relationship,
    date_of_birth,
    personality_notes
  } = recipientData

  // Automatically derive zodiac sign from date of birth —
  // this happens here in the service, not in the controller,
  // because it's pure business logic, not HTTP handling
  const zodiac_sign = deriveZodiacSign(date_of_birth)

  // Check if this recipient already exists for this user
  // LOWER() on both sides makes the match case-insensitive —
  // "Sarah" and "sarah" and "SARAH" all refer to the same person
  const existing = await pool.query(
    `SELECT id FROM recipients
     WHERE user_id = $1 AND LOWER(name) = LOWER($2)`,
    [userId, name]
  )

  if (existing.rows.length > 0) {
    // Recipient exists — UPDATE their profile with any new details
    // provided in this search. This means the recipient's profile
    // gets richer over time as the user provides more information,
    // rather than staying frozen at whatever was entered first.
    // COALESCE(new_value, existing_column) means: use the new value
    // if provided, otherwise keep whatever was already there —
    // so partial updates don't accidentally erase existing data.
    const updated = await pool.query(
      `UPDATE recipients SET
        relationship      = COALESCE($1, relationship),
        date_of_birth     = COALESCE($2, date_of_birth),
        zodiac_sign       = COALESCE($3, zodiac_sign),
        personality_notes = COALESCE($4, personality_notes)
       WHERE id = $5
       RETURNING id, name, relationship, zodiac_sign`,
      [relationship, date_of_birth, zodiac_sign, personality_notes, existing.rows[0].id]
    )
    return updated.rows[0]
  }

  // Recipient doesn't exist — create them fresh with all details
  const created = await pool.query(
    `INSERT INTO recipients
      (user_id, name, relationship, date_of_birth, zodiac_sign, personality_notes)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, relationship, zodiac_sign`,
    [userId, name, relationship, date_of_birth, zodiac_sign, personality_notes]
  )
  return created.rows[0]
}

// ── GET ALL RECIPIENTS FOR A USER ─────────────────────────
// Returns all recipients belonging to a user, with their
// full profile — useful for a future "recipients" page where
// users can manage the people they buy for regularly.
async function getRecipientsByUser(userId) {
  const result = await pool.query(
    `SELECT id, name, relationship, date_of_birth, zodiac_sign,
            personality_notes, created_at
     FROM recipients
     WHERE user_id = $1
     ORDER BY name ASC`,
    [userId]
  )
  return result.rows
}

// Export all service functions — the controller imports
// only what it needs from this list
module.exports = {
  findOrCreateRecipient,
  getRecipientsByUser,
  deriveZodiacSign  // exported so it can be independently tested
}