require('dotenv').config({ path: require('path').join(__dirname, '.env') })
const db = require("mysql2/promise")
require('dotenv').config
const pool = db.createPool({
    host:process.env.DB_HOST,
    user:process.env.DB_USER,
    password:process.env.DB_PASSWORD,
    database:process.env.DB_NAME
})
module.exports = pool