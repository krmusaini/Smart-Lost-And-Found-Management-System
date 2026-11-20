const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  multipleStatements: true
};

const DB_NAME = process.env.DATABASE_NAME || 'smart_lost_found_db';

async function executeSqlFile(connection, filePath) {
  const fullPath = path.resolve(__dirname, filePath);
  if (!fs.existsSync(fullPath)) {
    console.warn(`File not found: ${fullPath}`);
    return;
  }
  const content = fs.readFileSync(fullPath, 'utf8');

  // Handle delimiter blocks for MySQL routines/triggers
  const delimiterPattern = /DELIMITER\s+(\$\$|;)([\s\S]*?)DELIMITER\s+;/gi;
  let match;
  let lastIndex = 0;
  const statements = [];

  while ((match = delimiterPattern.exec(content)) !== null) {
    const beforeBlock = content.substring(lastIndex, match.index);
    if (beforeBlock.trim()) {
      statements.push({ isRoutine: false, sql: beforeBlock });
    }
    const routineBlock = match[2];
    const subStatements = routineBlock.split('$$').map(s => s.trim()).filter(Boolean);
    for (const sub of subStatements) {
      statements.push({ isRoutine: true, sql: sub });
    }
    lastIndex = delimiterPattern.lastIndex;
  }

  const remainder = content.substring(lastIndex);
  if (remainder.trim()) {
    statements.push({ isRoutine: false, sql: remainder });
  }

  for (const item of statements) {
    if (!item.sql || !item.sql.trim()) continue;
    try {
      await connection.query(item.sql);
    } catch (err) {
      console.error(`Error executing block from ${path.basename(filePath)}:`, err.message);
      throw err;
    }
  }
}

async function initializeDatabase(shouldSeed = false) {
  console.log('--- Initializing Smart Student Lost & Found Database ---');
  let connection;
  try {
    // 1. Connect without database to ensure database exists
    connection = await mysql.createConnection(dbConfig);
    console.log(`Connected to MySQL server at ${dbConfig.host}:${dbConfig.port}`);

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(`Database '${DB_NAME}' ensured.`);
    await connection.changeUser({ database: DB_NAME });

    // 2. Execute Schema (7 Core Tables)
    console.log('Applying 7 core tables schema...');
    await executeSqlFile(connection, 'schema.sql');
    console.log('Schema created successfully.');

    // 3. Stored Functions
    console.log('Registering Stored Functions...');
    await executeSqlFile(connection, 'functions.sql');
    console.log('Stored functions registered.');

    // 4. Stored Procedures
    console.log('Registering Stored Procedures...');
    await executeSqlFile(connection, 'procedures.sql');
    console.log('Stored procedures registered.');

    // 5. Triggers
    console.log('Registering Triggers...');
    await executeSqlFile(connection, 'triggers.sql');
    console.log('Triggers registered.');

    // 6. Views
    console.log('Creating Views...');
    await executeSqlFile(connection, 'views.sql');
    console.log('Views created.');

    // 7. Indexes
    console.log('Creating Performance Indexes...');
    await executeSqlFile(connection, 'indexes.sql');
    console.log('Indexes created.');

    if (shouldSeed) {
      console.log('Seeding demo data...');
      await executeSqlFile(connection, 'seed.sql');
      console.log('Demo seed data populated.');
    }

    console.log('--- Database Initialization Completed Successfully! ---');
  } catch (error) {
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n[Database Authentication Error]');
      console.error('MySQL rejected login for user "' + dbConfig.user + '" on ' + dbConfig.host + ':' + dbConfig.port);
      console.error('Cause: Incorrect or missing password in your .env file.');
      console.error('Solution: Open your .env file and set DATABASE_PASSWORD to your MySQL root password:');
      console.error('   DATABASE_PASSWORD=your_actual_mysql_password\n');
    } else {
      console.error('Fatal Database Initialization Error:', error.message);
    }
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

if (require.main === module) {
  const seedFlag = process.argv.includes('--seed');
  initializeDatabase(seedFlag);
}

module.exports = { initializeDatabase };
