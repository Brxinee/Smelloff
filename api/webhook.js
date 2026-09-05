export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'Legacy payment webhook is retired.' });
}
