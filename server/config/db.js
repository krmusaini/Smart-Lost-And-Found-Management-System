const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'smart_lost_found_db',
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true,
  multipleStatements: true
});

// Helper for testing connection
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log(`[DB] Successfully connected to MySQL database: ${process.env.DATABASE_NAME || 'smart_lost_found_db'}`);
    conn.release();
    return true;
  } catch (error) {
    console.error('[DB] Connection Error:', error.message);
    return false;
  }
}

module.exports = {
  pool,
  testConnection
};
