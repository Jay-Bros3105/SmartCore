/**
 * Neo SmartCore — relay server (Express, kwa Glitch / server yoyote ya Node).
 *
 * Endpoints:
 *   POST /notify   — kutuma push notifications
 *   GET  /health   — kuangalia relay iko
 */
require('dotenv').config();

const express = require('express');
const { notify } = require('./notifier');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json({ limit: '128kb' }));

function handleNotify(req, res) {
  const payload = req.body && typeof req.body === 'object' ? req.body : {};
  notify(payload)
    .then((result) => res.status(result.ok ? 200 : 400).json(result))
    .catch((err) => {
      console.error('[relay] notify error:', err);
      res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Relay error.' });
    });
}

app.post('/notify', handleNotify);
app.post('/api/notify', handleNotify);

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'neosmartcore-relay', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[relay] Neo SmartCore relay listening on :${PORT}`);
});