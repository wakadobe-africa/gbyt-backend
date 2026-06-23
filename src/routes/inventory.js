// ============================================================
// INVENTORY PROXY ROUTE
// ============================================================
// This route's ONE job: receive a request from OUR frontend,
// forward it to Open Food Facts on the SERVER side (where CORS
// doesn't apply), and hand the result back to the frontend.
//
// This is called a "proxy" pattern — our backend acts as a
// trusted intermediary between our frontend and an external API.
// ============================================================

const express = require('express')
const router = express.Router()

// GET /api/inventory/:category
// :category is a URL parameter — e.g. /api/inventory/chocolate
// means req.params.category will equal "chocolate"
router.get('/:category', async (req, res) => {
  try {
    const { category } = req.params

    // Same staging URL, same tag format fix, same auth — but now
    // this fetch() call runs INSIDE Node.js on Render's server,
    // not inside a browser. Node's fetch() is not subject to CORS
    // at all — CORS is exclusively a browser security mechanism,
    // so this exact same request that the browser refused to let
    // through will work completely normally here.
    const taggedCategory = `en:${category}`

    const params = new URLSearchParams({
      categories_tags_en: taggedCategory,
      page_size: '20',
      fields: 'product_name,brands,categories'
    })

    const url = `https://world.openfoodfacts.net/api/v2/search?${params.toString()}`

    const basicAuth = Buffer.from('off:off').toString('base64')
    // Note: Node.js doesn't have browser's btoa() built in — we use
    // Buffer instead, Node's native tool for this kind of encoding.
    // Same end result, different API for the same underlying task.

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'GiftMap/1.0 (giftmap.dev@example.com)',
        'Authorization': `Basic ${basicAuth}`
      }
    })

    if (!response.ok) {
      throw new Error(`Open Food Facts returned ${response.status}`)
    }

    const data = await response.json()

    // We send the raw data straight back to our frontend.
    // Our frontend's inventoryService.js will handle the cleaning/
    // transforming step, same as before — we're only relocating
    // WHERE the network call happens, not changing what happens
    // to the data afterward.
    res.json(data)

  } catch (error) {
    console.error('Inventory proxy error:', error)
    res.status(500).json({ error: 'Failed to fetch inventory', products: [] })
  }
})

module.exports = router