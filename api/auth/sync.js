import { kv } from '@vercel/kv';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

function verifyToken(token) {
  try {
    const [header, payload, signature] = token.split('.');
    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
    
    if (signature !== expectedSignature) {
      return null;
    }
    
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString());
    
    if (decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    
    return decoded;
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const username = await kv.get(`userid:${decoded.userId}`);
    if (!username) {
      return res.status(404).json({ error: 'User not found' });
    }

    // GET - Load user data
    if (req.method === 'GET') {
      const userData = await kv.get(`user:${username}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = JSON.parse(userData);
      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        success: true,
        user: userWithoutPassword
      });
    }

    // POST - Save user data
    if (req.method === 'POST') {
      const { pearls, inventory, equipped, achievements, stats } = req.body;

      const userData = await kv.get(`user:${username}`);
      if (!userData) {
        return res.status(404).json({ error: 'User not found' });
      }

      const user = JSON.parse(userData);

      // Update fields
      if (pearls !== undefined) user.pearls = pearls;
      if (inventory !== undefined) user.inventory = inventory;
      if (equipped !== undefined) user.equipped = equipped;
      if (achievements !== undefined) user.achievements = achievements;
      if (stats !== undefined) user.stats = { ...user.stats, ...stats };

      user.lastSync = Date.now();

      await kv.set(`user:${username}`, JSON.stringify(user));

      const { password: _, ...userWithoutPassword } = user;

      return res.status(200).json({
        success: true,
        message: 'Data synced successfully',
        user: userWithoutPassword
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Sync error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

