import { createClient } from 'redis';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Create Redis client
const kv = createClient({
  url: process.env.KV_URL || process.env.REDIS_URL
});

// Connect to Redis
if (!kv.isReady) {
  kv.connect().catch(console.error);
}

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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
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

    // Get user
    const username = await kv.get(`userid:${decoded.userId}`);
    if (!username) {
      return res.status(404).json({ error: 'User not found' });
    }

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

  } catch (error) {
    console.error('Auth check error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Ensure Redis connection on cold start
if (!kv.isReady) {
  kv.connect().catch(console.error);
}
