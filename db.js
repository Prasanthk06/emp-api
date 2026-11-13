const db = require("mysql2/promise")
require('dotenv').config
const pool = db.createPool({
    host:"localhost",
    user:"root",
    password:"Prashanth5319",
    database:"employee"
})
module.exports = pool