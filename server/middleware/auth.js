function isAuthenticated(req, res, next) {
  if (req.session && req.session.user) {
    return next();
  }
  return res.status(401).json({
    success: false,
    message: 'Authentication required. Please log in to proceed.'
  });
}

function isAdmin(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'ADMIN') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Administrator privileges required.'
  });
}

function isStudent(req, res, next) {
  if (req.session && req.session.user && req.session.user.role === 'STUDENT') {
    return next();
  }
  return res.status(403).json({
    success: false,
    message: 'Access denied. Student account required.'
  });
}

module.exports = {
  isAuthenticated,
  isAdmin,
  isStudent
};
