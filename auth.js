const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const db = require('./db')
require('dotenv').config()

const SECRET = process.env.JWT_SECRET
const router = express.Router()

const creds = z.object({
  email: z.string().trim().toLowerCase().email().max(150),
  password: z.string().min(8).max(72)
})

router.post('/register', async (req, res) => {
  const r = creds.safeParse(req.body)
  if (!r.success) return res.status(400).json({ error: 'Validation failed', details: r.error.issues })
  try {
    const hash = await bcrypt.hash(r.data.password, 10)
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [r.data.email, hash, 'user']
    )
    res.status(201).json({ id: result.insertId, email: r.data.email, role: 'user' })
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Email already registered' })
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/login', async (req, res) => {
  const r = creds.safeParse(req.body)
  if (!r.success) return res.status(400).json({ error: 'Validation failed' })
  try {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [r.data.email])
    const user = rows[0]
    const ok = user && await bcrypt.compare(r.data.password, user.password_hash)
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' })
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, SECRET, { expiresIn: '1h' })
    res.json({ token, token_type: 'Bearer', expires_in: 3600 })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const authenticate = (req, res, next) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Token missing' })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch (e) {
    res.status(401).json({ error: e.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token' })
  }
}

const requireRole = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden: insufficient role' })

module.exports = { router, authenticate, requireRole }