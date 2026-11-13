const express = require('express')
const db = require('./db')
const { authenticate, requireRole } = require('./auth')

const router = express.Router()
const SOURCE = 'https://jsonplaceholder.typicode.com/posts'
const sleep = ms => new Promise(r => setTimeout(r, ms))

class SyncError extends Error {
  constructor(message, status) { super(message); this.status = status }
}

async function fetchWithRetry(url, retries = 3, timeout = 5000) {
  let last
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const wait = 500 * 2 ** (attempt - 1)
      console.warn(`Retry ${attempt}/${retries} in ${wait}ms: ${last.message}`)
      await sleep(wait)
    }
    let res
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(timeout) })
    } catch (e) {
      last = new SyncError(e.name === 'TimeoutError' ? 'External API timed out' : 'External API unreachable', e.name === 'TimeoutError' ? 504 : 502)
      continue
    }
    if (res.status >= 500 || res.status === 429) {
      last = new SyncError(`External API error ${res.status}`, 502)
      continue
    }
    if (!res.ok) throw new SyncError(`External API rejected request (${res.status})`, 502)
    try {
      return await res.json()
    } catch {
      throw new SyncError('External API returned invalid JSON', 502)
    }
  }
  throw last
}

const valid = p =>
  p && Number.isInteger(p.id) && Number.isInteger(p.userId) &&
  typeof p.title === 'string' && typeof p.body === 'string'

router.post('/sync/posts', authenticate, requireRole('admin'), async (req, res) => {
  try {
    const data = await fetchWithRetry(SOURCE)
    if (!Array.isArray(data)) throw new SyncError('Unexpected response format', 502)

    const good = data.filter(valid)
    const skipped = data.length - good.length
    if (!good.length) return res.json({ fetched: data.length, skipped, inserted: 0, total_in_db: 0 })

    const [[{ c: before }]] = await db.query('SELECT COUNT(*) AS c FROM posts')
    await db.query(
      `INSERT INTO posts (external_id, user_id, title, body) VALUES ?
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), title = VALUES(title), body = VALUES(body)`,
      [good.map(p => [p.id, p.userId, p.title.slice(0, 255), p.body])]
    )
    const [[{ c: after }]] = await db.query('SELECT COUNT(*) AS c FROM posts')

    res.json({ fetched: data.length, skipped, inserted: after - before, total_in_db: after })
  } catch (e) {
    if (e instanceof SyncError) return res.status(e.status).json({ error: e.message })
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/posts', authenticate, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100)
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM posts')
    const [data] = await db.query('SELECT * FROM posts ORDER BY external_id LIMIT ? OFFSET ?', [limit, (page - 1) * limit])
    res.json({ page, limit, total, data })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

module.exports = router