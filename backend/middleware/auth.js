import jwt from 'jsonwebtoken';
import { executeQuery } from '../config/database.js';

// Verify JWT token
export const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'No token provided' 
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if this is a temporary MFA setup token
    if (decoded.tempMfaSetup) {
      console.log('🔧 Processing temporary MFA setup token for user:', decoded.userId);
      // For temporary tokens, use the decoded data directly
      req.user = {
        id: decoded.userId,
        email: decoded.email,
        name: decoded.name || 'User',
        role: decoded.role,
        department_id: decoded.department_id,
        is_active: true
      };
      console.log('🔧 Set req.user to:', req.user);
      next();
      return;
    }
    
    // Get user details from database for regular tokens
    const userResult = await executeQuery(
      'SELECT id, email, name, role, department_id, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );

    if (!userResult.success || !userResult.data.length) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'Invalid token' 
      });
    }

    const user = userResult.data[0];
    
    if (!user.is_active) {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'Account is deactivated' 
      });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Access denied', 
        message: 'Token expired' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Access denied', 
      message: 'Invalid token' 
    });
  }
};

// Check if user is admin
export const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'Admin privileges required' 
    });
  }
  next();
};

// Check if user is manager or admin
export const requireManager = (req, res, next) => {
  if (!['admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ 
      error: 'Access denied', 
      message: 'Manager privileges required' 
    });
  }
  next();
};

// Check if user can access department resource
export const requireDepartmentAccess = (req, res, next) => {
  const { departmentId } = req.params;
  const user = req.user;

  // Admin can access all departments
  if (user.role === 'admin') {
    return next();
  }

  // Manager can access their own department
  if (user.role === 'manager' && user.department_id === departmentId) {
    return next();
  }

  // Regular user can only access their own department
  if (user.department_id === departmentId) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Access denied', 
    message: 'Insufficient permissions for this department' 
  });
};

// Check if user has one of the specified roles
export const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !req.user.role) {
      return res.status(401).json({
        error: 'Access denied',
        message: 'User not authenticated'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

