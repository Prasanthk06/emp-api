const db = require('./db')

const depts = {
  Engineering: ['Software Engineer', 'Senior Engineer', 'Tech Lead'],
  HR: ['HR Executive', 'HR Manager'],
  Sales: ['Sales Executive', 'Sales Manager'],
  Finance: ['Accountant', 'Finance Manager'],
  Marketing: ['Marketing Executive', 'Marketing Manager'],
  Support: ['Support Agent', 'Support Lead']
}
const first = ['Asha', 'Ravi', 'Priya', 'Karan', 'Meena', 'Arjun', 'Divya', 'Sanjay', 'Lakshmi', 'Vikram', 'Nisha', 'Rahul', 'Anita', 'Suresh', 'Kavya', 'Manoj']
const last = ['Kumar', 'Sharma', 'Iyer', 'Reddy', 'Nair', 'Patel', 'Singh', 'Das', 'Menon', 'Gupta', 'Rao', 'Pillai', 'Joshi', 'Verma']
const statuses = ['Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Active', 'Inactive', 'On Leave']
const pick = a => a[Math.floor(Math.random() * a.length)]

const randomDate = () => {
  const d = new Date(Date.now() - Math.floor(Math.random() * 3650) * 86400000)
  return d.toISOString().slice(0, 10)
}

;(async () => {
  await db.query('TRUNCATE TABLE employees')
  const total = 100000, batch = 5000
  for (let s = 1; s <= total; s += batch) {
    const rows = []
    for (let i = s; i < s + batch; i++) {
      const f = pick(first), l = pick(last), d = pick(Object.keys(depts))
      rows.push([`${f} ${l}`, `${f}.${l}.${i}@example.com`.toLowerCase(), d, pick(depts[d]),
        (20000 + Math.random() * 180000).toFixed(2), randomDate(), pick(statuses)])
    }
    await db.query('INSERT INTO employees (name,email,department,designation,salary,joining_date,status) VALUES ?', [rows])
  }
  const [[{ c }]] = await db.query('SELECT COUNT(*) AS c FROM employees')
  console.log('Employees in DB:', c)
  process.exit()
})()