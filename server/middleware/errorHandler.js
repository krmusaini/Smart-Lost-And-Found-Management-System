function errorHandler(err, req, res, next) {
  console.error('[Error Handler]', err);

  // Check for Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File size too large. Maximum allowed size is 5MB.'
    });
  }

  // Check for MySQL custom signals or constraints
  if (err.sqlState === '45000') {
    return res.status(400).json({
      success: false,
      message: err.sqlMessage || err.message
    });
  }

  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({
      success: false,
      message: 'A duplicate record already exists in the system.'
    });
  }

  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error occurred.'
  });
}

module.exports = errorHandler;
