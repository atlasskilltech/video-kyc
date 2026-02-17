const jwt = require('jsonwebtoken');

// Session-based auth for web views
const requireLogin = (req, res, next) => {
    if (req.session && req.session.admin) {
        return next();
    }
    return res.redirect('/auth/login');
};

// JWT-based auth for API
const requireAuth = (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.admin = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ success: false, message: 'Invalid token.' });
    }
};

// Role check
const requireRole = (...roles) => {
    return (req, res, next) => {
        const user = req.session?.admin || req.admin;
        if (user && roles.includes(user.role)) {
            return next();
        }
        return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    };
};

module.exports = { requireLogin, requireAuth, requireRole };
