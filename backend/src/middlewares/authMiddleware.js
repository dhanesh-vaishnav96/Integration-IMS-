const jwt = require('jsonwebtoken');
const config = require('../config/env');
const logger = require('../config/logger');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      const decoded = jwt.verify(token, config.jwt.secret);

      // In a real application, you'd fetch the user from the database here
      // req.user = await User.findById(decoded.id).select('-password');
      req.user = decoded; // Mocking user assignment

      next();
    } catch (error) {
      logger.error('Not authorized, token failed');
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: `User role ${req.user?.role} is not authorized to access this route` });
    }
    next();
  };
};

module.exports = { protect, authorize };
