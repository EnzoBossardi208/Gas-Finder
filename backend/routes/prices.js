const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Atualizar preços (apenas dono do posto)
router.put('/:stationId', authenticateToken, (req, res) => {
  const { stationId } = req.params;
  const { prices } = req.body; // array de { fuel_type, price, is_promotional, promo_price, promo_validity }

  try {
    // Verificar se o usuário é dono do posto
    const station = db.prepare('SELECT * FROM stations WHERE id = ? AND owner_id = ?').get(stationId, req.user.id);
    if (!station && req.user.role === 'station_owner') {
      return res.status(403).json({ error: 'Você não é proprietário deste posto' });
    }

    // Se for motorista reportando, permitir mas marcar como report
    const updatedBy = req.user.id;

    const insertPrice = db.prepare(`
      INSERT INTO prices (station_id, fuel_type, price, is_promotional, promo_price, promo_validity, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const updateMany = db.transaction((pricesArray) => {
      for (const p of pricesArray) {
        insertPrice.run(
          stationId,
          p.fuel_type,
          p.price,
          p.is_promotional || 0,
          p.promo_price || null,
          p.promo_validity || null,
          updatedBy
        );
      }
    });

    updateMany(prices);

    // Criar notificações para motoristas que favoritaram este posto
    const favoritedUsers = db.prepare(`
      SELECT user_id FROM favorites WHERE station_id = ?
    `).all(stationId);

    const insertNotif = db.prepare(`
      INSERT INTO notifications (user_id, station_id, type, message)
      VALUES (?, ?, 'price_update', ?)
    `);

    for (const fav of favoritedUsers) {
      insertNotif.run(
        fav.user_id,
        stationId,
        `${station.name} atualizou os preços! Confira as novidades.`
      );
    }

    res.json({ message: 'Preços atualizados com sucesso' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Erro ao atualizar preços' });
  }
});

// Histórico de preços de um posto
router.get('/:stationId/history', (req, res) => {
  try {
    const prices = db.prepare(`
      SELECT * FROM prices 
      WHERE station_id = ? 
      ORDER BY updated_at DESC 
      LIMIT 50
    `).all(req.params.stationId);

    res.json(prices);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar histórico' });
  }
});

module.exports = router;