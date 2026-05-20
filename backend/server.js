require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const stationsRoutes = require('./routes/stations');
const pricesRoutes = require('./routes/prices');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares
app.use(cors());
app.use(express.json());

// Rotas
app.use('/api/auth', authRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/prices', pricesRoutes);
app.use('/api/notifications', notificationsRoutes);

// Rota de saúde
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 GasFinder API rodando na porta ${PORT}`);
  console.log(`📍 http://localhost:${PORT}/api/health`);
});