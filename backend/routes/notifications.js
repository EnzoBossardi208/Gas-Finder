const express = require('express');
const db = require('../database');
const { authenticateToken } = require('./auth');

const router = express.Router();

// Listar notificações do usuário
router.get('/', authenticateToken, (req, res) => {
  try {
    const notifications = db.prepare(`
      SELECT n.*, s.name as station_name, s.city
      FROM notifications n
      JOIN stations s ON n.station_id = s.id
      WHERE n.user_id = ?
      ORDER BY n.created_at DESC
      LIMIT 50
    `).all(req.user.id);

    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar notificações' });
  }
});

// Marcar como lida
router.put('/:id/read', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?')
      .run(req.params.id, req.user.id);
    res.json({ message: 'Notificação marcada como lida' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar notificação' });
  }
});

// Marcar todas como lidas
router.put('/read-all', authenticateToken, (req, res) => {
  try {
    db.prepare('UPDATE notifications SET read = 1 WHERE user_id = ?').run(req.user.id);
    res.json({ message: 'Todas notificações marcadas como lidas' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar notificações' });
  }
});

// Contagem de não lidas
router.get('/unread-count', authenticateToken, (req, res) => {
  try {
    const result = db.prepare(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0'
    ).get(req.user.id);
    res.json({ count: result.count });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao contar notificações' });
  }
});

// Favoritar/desfavoritar posto
router.post('/favorites/:stationId', authenticateToken, (req, res) => {
  try {
    const existing = db.prepare(
      'SELECT * FROM favorites WHERE user_id = ? AND station_id = ?'
    ).get(req.user.id, req.params.stationId);

    if (existing) {
      db.prepare('DELETE FROM favorites WHERE user_id = ? AND station_id = ?')
        .run(req.user.id, req.params.stationId);
      res.json({ favorited: false, message: 'Posto removido dos favoritos' });
    } else {
      db.prepare('INSERT INTO favorites (user_id, station_id) VALUES (?, ?)')
        .run(req.user.id, req.params.stationId);
      res.json({ favorited: true, message: 'Posto adicionado aos favoritos' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar favoritos' });
  }
});

// Listar favoritos
router.get('/favorites', authenticateToken, (req, res) => {
  try {
    const favorites = db.prepare(`
      SELECT s.* FROM stations s
      JOIN favorites f ON s.id = f.station_id
      WHERE f.user_id = ?
    `).all(req.user.id);
    res.json(favorites);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar favoritos' });
  }
});

module.exports = router;