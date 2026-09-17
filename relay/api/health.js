/**
 * Vercel serverless health endpoint —
 * https://<project>.vercel.app/api/health → { ok: true, service: 'neosmartcore-relay' }
 */
module.exports = async function handler(_req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json({ ok: true, service: 'neosmartcore-relay' });
};