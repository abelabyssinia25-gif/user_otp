const jwt = require('jsonwebtoken');
require('dotenv').config();

function auth(required = true) {
return (req, res, next) => {
const header = req.headers.authorization || '';
const token = header.startsWith('Bearer ') ? header.slice(7) : null;
if (!token) { if (required) return res.status(401).json({ message: 'Unauthorized' }); return next(); }
try {
const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
req.user = payload; return next();
} catch (err) { return res.status(401).json({ message: 'Invalid token' }); }
};
}

module.exports = auth;
