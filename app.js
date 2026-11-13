const syncRouter = require('./sync')

const express = require('express')
const path = require('path')
const { z } = require('zod')
const db = require('./db')
const { router: authRouter, authenticate, requireRole } = require('./auth')
const bcrypt = require('bcryptjs')

const app = express()
app.use(express.json())
app.use(syncRouter)
app.use(express.static(path.join(__dirname, 'public')))

app.use('/auth', authRouter)
app.use('/employees', authenticate)

const base = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email().max(150),
  department: z.string().trim().min(1).max(100),
  designation: z.string().trim().max(100).optional(),
  salary: z.number().positive().max(99999999.99),
  joining_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD').optional(),
  status: z.string().trim().max(20).default('Active')
})
const updateSchema = base.partial().strict()

const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body)
  if (!r.success) {
    return res.status(400).json({
      error: 'Validation failed',
      details: r.error.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
    })
  }
  req.body = r.data
  next()
}

const parseId = (req, res, next) => {
  const id = Number(req.params.id)
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' })
  req.id = id
  next()
}

const isDup = e => e.code === 'ER_DUP_ENTRY'

app.post('/employees', requireRole('admin'), validate(base), async (req, res) => {
  try {
    const [r] = await db.query('INSERT INTO employees SET ?', [req.body])
    const [rows] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [r.insertId])
    res.status(201).json(rows[0])
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: 'Email already exists' })
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

const COLS = 'employee_id, name, email, department, designation, salary, joining_date, status'

app.get('/employees', async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)
    const filters = [], fp = []
    for (const f of ['department', 'designation', 'status']) {
      if (req.query[f]) { filters.push(`${f} = ?`); fp.push(String(req.query[f])) }
    }
    const fw = filters.length ? 'WHERE ' + filters.join(' AND ') : ''
    const after = parseInt(req.query.after_id)
    const cursor = after > 0
    const dw = cursor ? (fw ? fw + ' AND employee_id > ?' : 'WHERE employee_id > ?') : fw
    const dp = cursor ? [...fp, after] : fp
    const offset = cursor ? 0 : (page - 1) * limit

    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM employees ${fw}`, fp)
    const [data] = await db.query(
      `SELECT ${COLS} FROM employees ${dw} ORDER BY employee_id LIMIT ? OFFSET ?`,
      [...dp, limit, offset]
    )
    res.json({
      page, limit, total, pages: Math.ceil(total / limit),
      next_after_id: data.length ? data[data.length - 1].employee_id : null,
      data
    })
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/reports/top-customers', authenticate, async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.name, t.total_orders, t.total_purchase_amount
      FROM (
        SELECT customer_id, COUNT(*) AS total_orders, SUM(total_amount) AS total_purchase_amount
        FROM orders WHERE status = 'completed'
        GROUP BY customer_id
        ORDER BY total_purchase_amount DESC, customer_id
        LIMIT 3
      ) t
      JOIN customer c ON c.customer_id = t.customer_id
      ORDER BY t.total_purchase_amount DESC, t.customer_id`)
    res.json(rows)
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})


app.get('/employees/:id', parseId, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [req.id])
    if (!rows.length) return res.status(404).json({ error: 'Employee not found' })
    res.json(rows[0])
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.put('/employees/:id', requireRole('admin'), parseId, validate(updateSchema), async (req, res) => {
  if (!Object.keys(req.body).length) return res.status(400).json({ error: 'No fields to update' })
  try {
    const [r] = await db.query('UPDATE employees SET ? WHERE employee_id = ?', [req.body, req.id])
    if (!r.affectedRows) return res.status(404).json({ error: 'Employee not found' })
    const [rows] = await db.query('SELECT * FROM employees WHERE employee_id = ?', [req.id])
    res.json(rows[0])
  } catch (e) {
    if (isDup(e)) return res.status(409).json({ error: 'Email already exists' })
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.delete('/employees/:id', requireRole('admin'), parseId, async (req, res) => {
  try {
    const [r] = await db.query('DELETE FROM employees WHERE employee_id = ?', [req.id])
    if (!r.affectedRows) return res.status(404).json({ error: 'Employee not found' })
    res.status(204).end()
  } catch (e) {
    console.error(e)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.use((req, res) => res.status(404).json({ error: 'Route not found' }))

app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' })
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

app.listen(3000, () => console.log('Server running on http://localhost:3000'))