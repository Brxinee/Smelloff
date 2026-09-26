import { BASE_PRODUCT } from '../shared/products-config-workers.js';

const COD_FEE_PAISE = Math.round(Number(BASE_PRODUCT.codFee || 60) * 100);
const FREE_SHIPPING_PAISE = 0;

function json(res, body, status = 200) {
  res.status(status);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  return res.end(JSON.stringify(body));
}

function normalizeAddresses(body) {
  const source = body && typeof body === 'object' && Array.isArray(body.addresses)
    ? body.addresses
    : [];
  return source.map((address, index) => ({
    id: String(address?.id ?? index),
    zipcode: String(address?.zipcode || '').replace(/\D/g, '').slice(-6),
    state_code: String(address?.state_code || '').slice(0, 8),
    country: String(address?.country || 'IN').toUpperCase().slice(0, 2),
  }));
}

export default function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, { error: 'Method not allowed' }, 405);
  }

  // Razorpay requires this endpoint to be public and unauthenticated.
  // Never expose secrets here. The response contains only serviceability and
  // customer-visible shipping/COD fee data.
  let body = req.body && typeof req.body === 'object' ? req.body : {};
  if (req.method === 'GET') {
    try {
      if (req.query && typeof req.query === 'object') {
        body = {
          ...body,
          addresses: typeof req.query.addresses === 'string'
            ? JSON.parse(req.query.addresses)
            : body.addresses,
        };
      }
    } catch {
      return json(res, { error: 'Invalid addresses payload.' }, 400);
    }
  }

  const addresses = normalizeAddresses(body);
  if (!addresses.length) return json(res, { addresses: [], shipping_methods: [] });

  // Smelloff currently ships pan-India. Razorpay still applies any zip-code
  // serviceability rules configured in its own dashboard/account settings.
  const responseAddresses = addresses.map((address) => ({
    id: address.id,
    zipcode: address.zipcode,
    country: address.country || 'IN',
  }));

  const shipping_methods = [
    {
      id: 'standard',
      description: 'Free standard delivery',
      name: 'Standard Delivery',
      serviceable: responseAddresses.every((address) => address.zipcode.length === 6 && address.country === 'IN'),
      shipping_fee: FREE_SHIPPING_PAISE,
      cod: true,
      cod_fee: COD_FEE_PAISE,
    },
  ];

  return json(res, {
    addresses: responseAddresses,
    shipping_methods,
  });
}
