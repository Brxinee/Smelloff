export default async function handler(req, res) {
  res.setHeader('X-Powered-By', 'Smelloff-Admin');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  return res.status(410).json({
    error: 'Manual payment approval is retired. UPI payments are verified automatically by the payment provider.'
  });
}
