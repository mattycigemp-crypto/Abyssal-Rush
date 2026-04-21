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

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + JWT_SECRET).digest('hex');
}

function generateToken(userId) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ 
    userId, 
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7 days
  })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password required' });
    }

    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user exists
    const existingUser = await kv.get(`user:${username}`);
    if (existingUser) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    const existingEmail = await kv.get(`email:${email}`);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    // Create user
    const userId = crypto.randomUUID();
    const hashedPassword = hashPassword(password);
    
    const user = {
      id: userId,
      username,
      email,
      password: hashedPassword,
      createdAt: Date.now(),
      pearls: 0,
      inventory: [],
      equipped: { diver: 'NEO', trail: null },
      achievements: {},
      stats: {
        totalCrystals: 0,
        totalDeaths: 0,
        totalTime: 0,
        levelsCompleted: 0,
        gamesPlayed: 0
      }
    };

    // Store user
    await kv.set(`user:${username}`, JSON.stringify(user));
    await kv.set(`email:${email}`, username);
    await kv.set(`userid:${userId}`, username);

    // Generate token
    const token = generateToken(userId);

    // Return user data (without password)
    const { password: _, ...userWithoutPassword } = user;

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      token,
      user: userWithoutPassword
    });

  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Ensure Redis connection on cold start
if (!kv.isReady) {
  kv.connect().catch(console.error);
}
