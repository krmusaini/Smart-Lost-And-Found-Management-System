const { initializeDatabase } = require('./initDb');

console.log('Running Database Reset & Seeding with Demo Records...');
initializeDatabase(true);
