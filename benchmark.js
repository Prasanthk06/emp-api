const db = require('./db')

const BASE = 'http://localhost:3000'
const RUNS = 20
const INDEXES = {
  idx_dept_desig_status: '(department, designation, status)',
  idx_desig_status: '(designation, status)'
}
const scenarios = [
  ['No filter, page 1', '/employees?page=1&limit=20'],
  ['Department', '/employees?department=Engineering&limit=20'],
  ['Designation', '/employees?designation=Tech%20Lead&limit=20'],
  ['Dept + designation + status', '/employees?department=Engineering&designation=Software%20Engineer&status=Active&limit=20'],
  ['Designation + status', '/employees?designation=Sales%20Manager&status=Inactive&limit=20'],
  ['Deep page (offset)', '/employees?page=4000&limit=20'],
  ['Deep page (cursor)', '/employees?after_id=79980&limit=20']
]

const login = async () => {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@example.com', password: '123456789' })
  })
  return (await r.json()).token
}

const timeApi = async (path, token) => {
  const times = []
  for (let i = 0; i <= RUNS; i++) {
    const s = performance.now()
    const r = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token } })
    await r.text()
    if (r.status !== 200) throw new Error(path + ' returned ' + r.status)
    if (i > 0) times.push(performance.now() - s)
  }
  return times.reduce((a, b) => a + b, 0) / times.length
}

const legacy = async () => {
  const times = []
  for (let i = 0; i < 5; i++) {
    const s = performance.now()
    const [rows] = await db.query("SELECT * FROM employees WHERE status = 'Active'")
    JSON.stringify(rows)
    times.push(performance.now() - s)
  }
  return times.reduce((a, b) => a + b, 0) / times.length
}

const run = async token => {
  const out = { 'Legacy: SELECT *, no pagination': await legacy() }
  for (const [name, path] of scenarios) out[name] = await timeApi(path, token)
  return out
}

const dropIdx = async () => {
  for (const n of Object.keys(INDEXES)) await db.query(`DROP INDEX ${n} ON employees`).catch(() => {})
}
const addIdx = async () => {
  for (const [n, c] of Object.entries(INDEXES)) await db.query(`CREATE INDEX ${n} ON employees ${c}`)
  await db.query('ANALYZE TABLE employees')
}

;(async () => {
  const token = await login()
  await dropIdx()
  const before = await run(token)
  await addIdx()
  const after = await run(token)
  const table = {}
  for (const k of Object.keys(before)) {
    table[k] = {
      'Before (ms)': +before[k].toFixed(1),
      'After (ms)': +after[k].toFixed(1),
      'Speedup': (before[k] / after[k]).toFixed(1) + 'x'
    }
  }
  console.table(table)
  process.exit()
})()