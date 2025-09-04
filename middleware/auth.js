const { verifyToken } = require('../utils/jwt');
require('dotenv').config();

function auth(required = true) {
return (req, res, next) => {
const header = req.headers.authorization || '';
const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
const token = bearer || req.query.token || req.body?.token || null;
if (!token) { if (required) return res.status(401).json({ message: 'Unauthorized' }); return next(); }
try {
const payload = verifyToken(token);
req.user = payload; return next();
} catch (err) { return res.status(401).json({ message: 'Invalid token' }); }
};
}

module.exports = auth;
