require('dotenv').config();
const http = require('http');
const app = require('./server/app');
const { testConnection } = require('./server/config/db');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

async function startServer() {
  console.log('===========================================================');
  console.log('  Smart Student Lost & Found Management System (DBMS Capstone)');
  console.log('===========================================================');

  // Verify database connectivity
  const dbConnected = await testConnection();
  if (!dbConnected) {
    console.warn('[Warning] MySQL connection could not be established on startup.');
    console.warn('[Warning] Please check your .env database credentials and ensure MySQL is running.');
  }

  server.listen(PORT, () => {
    console.log(`[Server] Application is running on port ${PORT}`);
    console.log(`[Server] Local URL: http://localhost:${PORT}`);
    console.log(`[Server] Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('\nGracefully shutting down server...');
  server.close(() => {
    console.log('Server terminated.');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  console.log('\nReceived SIGTERM, shutting down...');
  server.close(() => {
    process.exit(0);
  });
});

startServer();
