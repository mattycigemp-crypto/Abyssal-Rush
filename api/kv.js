import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      // Example: Get a value from KV
      const { key } = req.query;
      if (!key) {
        return res.status(400).json({ error: 'Key is required' });
      }
      const value = await kv.get(key);
      return res.status(200).json({ key, value });
    }

    if (req.method === 'POST') {
      // Example: Set a value in KV
      const { key, value, ttl } = req.body;
      if (!key || value === undefined) {
        return res.status(400).json({ error: 'Key and value are required' });
      }
      
      if (ttl) {
        await kv.set(key, value, { ex: ttl });
      } else {
        await kv.set(key, value);
      }
      
      return res.status(200).json({ success: true, key, value });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('KV error:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}
