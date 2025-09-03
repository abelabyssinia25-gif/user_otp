const { models } = require('../models');
const { hashPassword } = require('../utils/password');

exports.create = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const row = await models.Staff.create(data);
return res.status(201).json(row);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.list = async (req, res) => { try { const rows = await models.Staff.findAll({ include: ['roles'] }); return res.json(rows); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.get = async (req, res) => { try { const row = await models.Staff.findByPk(req.params.id, { include: ['roles'] }); if (!row) return res.status(404).json({ message: 'Not found' }); return res.json(row); } catch (e) { return res.status(500).json({ message: e.message }); } };
exports.update = async (req, res) => {
try {
const data = req.body;
if (data.password) data.password = await hashPassword(data.password);
const [count] = await models.Staff.update(data, { where: { id: req.params.id } });
if (!count) return res.status(404).json({ message: 'Not found' });
const updated = await models.Staff.findByPk(req.params.id);
return res.json(updated);
} catch (e) { return res.status(500).json({ message: e.message }); }
};
exports.remove = async (req, res) => { try { const count = await models.Staff.destroy({ where: { id: req.params.id } }); if (!count) return res.status(404).json({ message: 'Not found' }); return res.status(204).send(); } catch (e) { return res.status(500).json({ message: e.message }); } };
