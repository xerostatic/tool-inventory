// This is a single Vercel Serverless Function that handles ALL API routes
// Much simpler than separate backend deployment!

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

// For Vercel serverless functions, we export a single handler
module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Initialize database connection
  const sql = neon(process.env.DATABASE_URL);

  // Route the request based on path
  const path = req.url.replace('/api', '');
  
  try {
    // Health check
    if (path === '/health') {
      return res.json({ status: 'ok', message: 'Tool Inventory API is running' });
    }

    // Auth routes
    if (path === '/auth/register' && req.method === 'POST') {
      return await handleRegister(req, res, sql);
    }
    
    if (path === '/auth/login' && req.method === 'POST') {
      return await handleLogin(req, res, sql);
    }

    // All other routes require authentication
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Tools routes
    if (path === '/tools' && req.method === 'GET') {
      return await handleGetTools(req, res, sql, userId);
    }
    
    if (path === '/tools' && req.method === 'POST') {
      return await handleCreateTool(req, res, sql, userId);
    }

    if (path.startsWith('/tools/') && req.method === 'DELETE') {
      const id = path.split('/')[2];
      return await handleDeleteTool(req, res, sql, userId, id);
    }

    // Stats route
    if (path === '/stats' && req.method === 'GET') {
      return await handleStats(req, res, sql, userId);
    }

    // Route not found
    return res.status(404).json({ error: 'Route not found' });
    
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
};

// Handler functions
async function handleRegister(req, res, sql) {
  const { email, password } = req.body;

  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and password (min 6 chars) required' });
  }

  const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
  if (existingUser.length > 0) {
    return res.status(400).json({ error: 'User already exists' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const result = await sql`
    INSERT INTO users (email, password_hash)
    VALUES (${email}, ${passwordHash})
    RETURNING id, email, created_at
  `;

  const user = result[0];
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  return res.status(201).json({
    message: 'User created successfully',
    token,
    user: { id: user.id, email: user.email }
  });
}

async function handleLogin(req, res, sql) {
  const { email, password } = req.body;

  const users = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
  if (users.length === 0) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const user = users[0];
  const isValidPassword = await bcrypt.compare(password, user.password_hash);
  if (!isValidPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

  return res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, email: user.email }
  });
}

async function handleGetTools(req, res, sql, userId) {
  const tools = await sql`
    SELECT * FROM tools 
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
  `;
  return res.json(tools);
}

async function handleCreateTool(req, res, sql, userId) {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;

  const result = await sql`
    INSERT INTO tools (
      user_id, category, brand, description, quantity, 
      condition, estimated_value, notes, image_url
    )
    VALUES (
      ${userId}, ${category}, ${brand}, ${description}, ${quantity},
      ${condition}, ${estimated_value}, ${notes || null}, ${image_url || null}
    )
    RETURNING *
  `;

  return res.status(201).json(result[0]);
}

async function handleDeleteTool(req, res, sql, userId, id) {
  const result = await sql`
    DELETE FROM tools 
    WHERE id = ${id} AND user_id = ${userId}
    RETURNING id
  `;

  if (result.length === 0) {
    return res.status(404).json({ error: 'Tool not found' });
  }

  return res.json({ message: 'Tool deleted successfully' });
}

async function handleStats(req, res, sql, userId) {
  const stats = await sql`
    SELECT 
      COUNT(*) as total_items,
      SUM(quantity) as total_quantity,
      SUM(estimated_value * quantity) as total_value,
      COUNT(DISTINCT category) as categories_count
    FROM tools
    WHERE user_id = ${userId}
  `;

  const categoryStats = await sql`
    SELECT 
      category,
      COUNT(*) as count,
      SUM(estimated_value * quantity) as total_value
    FROM tools
    WHERE user_id = ${userId}
    GROUP BY category
    ORDER BY total_value DESC
  `;

  return res.json({
    overview: stats[0],
    categories: categoryStats
  });
}

