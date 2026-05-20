const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Listar todos os postos (com preços mais recentes)
router.get('/', (req, res) => {
  const { city } = req.query;
  
  try {
    let query = `
      SELECT s.*, 
        u.name as owner_name,
        (SELECT json_group_object(fuel_type, price) FROM (
          SELECT fuel_type, price FROM prices 
          WHERE station_id = s.id 
          AND updated_at = (
            SELECT MAX(updated_at) FROM prices p2 
            WHERE p2.station_id = s.id AND p2.fuel_type = prices.fuel_type
          )
        )) as current_prices
      FROM stations s
      LEFT JOIN users u ON s.owner_id = u.id
    `;

    if (city) {
      query += ' WHERE s.city = ?';
      const stations = db.prepare(query).all(city);
      return res.json(stations);
    }

    const stations = db.prepare(query).all();
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar postos' });
  }
});

// Buscar posto por ID
router.get('/:id', (req, res) => {
  try {
    const station = db.prepare(`
      SELECT s.*, u.name as owner_name
      FROM stations s
      LEFT JOIN users u ON s.owner_id = u.id
      WHERE s.id = ?
    `).get(req.params.id);

    if (!station) {
      return res.status(404).json({ error: 'Posto não encontrado' });
    }

    const prices = db.prepare(`
      SELECT fuel_type, price, is_promotional, promo_price, promo_validity, updated_at
      FROM prices 
      WHERE station_id = ? 
      ORDER BY updated_at DESC
    `).all(req.params.id);

    res.json({ ...station, prices });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar posto' });
  }
});

// Vincular posto ao parceiro (apenas station_owner)
router.post('/:id/claim', authenticateToken, (req, res) => {
  if (req.user.role !== 'station_owner') {
    return res.status(403).json({ error: 'Apenas postos parceiros podem reivindicar' });
  }

  try {
    const station = db.prepare('SELECT * FROM stations WHERE id = ?').get(req.params.id);
    if (!station) {
      return res.status(404).json({ error: 'Posto não encontrado' });
    }

    if (station.owner_id) {
      return res.status(409).json({ error: 'Este posto já possui um proprietário' });
    }

    db.prepare('UPDATE stations SET owner_id = ? WHERE id = ?').run(req.user.id, req.params.id);
    res.json({ message: 'Posto vinculado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao vincular posto' });
  }
});

// Listar postos do parceiro logado
router.get('/my/managed', authenticateToken, (req, res) => {
  if (req.user.role !== 'station_owner') {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  try {
    const stations = db.prepare('SELECT * FROM stations WHERE owner_id = ?').all(req.user.id);
    res.json(stations);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar postos' });
  }
});

module.exports = router;