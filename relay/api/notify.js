/**
 * Vercel serverless function (bonasi) — ikiwa ukichagua Vercel kunapasha Glitch.
 *
 * `relay/api/notify.js` — deploy kwa `vercel` kutoka ndani ya relay/.
 * Inatumia notifier sawa na Express (Glitch).
 */
const { notify } = require('../notifier');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method not allowed.' });
    return;
  }
  let payload = {};
  try {
    const raw =
      Buffer.isBuffer(req.body) || (typeof req.body === 'string' && req.body.length > 0)
        ? Buffer.isBuffer(req.body)
          ? req.body.toString('utf8')
          : req.body
        : req.body && typeof req.body === 'object'
          ? JSON.stringify(req.body)
          : '{}';
    payload = JSON.parse(raw);
  } catch {
    res.status(400).json({ ok: false, message: 'Invalid JSON body.' });
    return;
  }
  try {
    const result = await notify(payload);
    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({ ok: false, message: err instanceof Error ? err.message : 'Relay error.' });
  }
};