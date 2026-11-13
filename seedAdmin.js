require('dotenv').config()
const bcrypt = require('bcryptjs')
const db = require('./db')

const email = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase()
const password = process.env.ADMIN_PASSWORD || 'Admin@1234'

;(async () => {
  try {
    const hash = await bcrypt.hash(password, 10)
    await db.query(
      `INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), role = 'admin'`,
      [email, hash]
    )
    console.log('Admin ready:', email)
  } catch (e) {
    console.error(e)
  } finally {
    process.exit()
  }
})()