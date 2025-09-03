function requireRoles(...allowedRoles) {
return (req, res, next) => {
if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
const roles = req.user.roles || [];
const ok = roles.some((r) => allowedRoles.includes(r) || allowedRoles.includes(r?.name));
if (!ok) return res.status(403).json({ message: 'Forbidden' });
next();
};
}
function requirePermissions(...perms) {
return (req, res, next) => {
if (!req.user) return res.status(401).json({ message: 'Unauthorized' });
const userPerms = req.user.permissions || [];
const ok = perms.every((p) => userPerms.includes(p));
if (!ok) return res.status(403).json({ message: 'Forbidden' });
next();
};
}
module.exports = { requireRoles, requirePermissions };
