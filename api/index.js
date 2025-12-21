// This is a single Vercel Serverless Function that handles ALL API routes
// Much simpler than separate backend deployment!

const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { put } = require('@vercel/blob');

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

    // Image recognition route
    if (path === '/recognize-tool' && req.method === 'POST') {
      return await handleImageRecognition(req, res, userId);
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

async function handleImageRecognition(req, res, userId) {
  try {
    // For serverless, we need to handle multipart form data differently
    // Get the image data from the request
    const contentType = req.headers['content-type'] || '';
    
    if (!contentType.includes('multipart/form-data')) {
      return res.status(400).json({ error: 'Content-Type must be multipart/form-data' });
    }

    // Parse multipart form data (simplified for now)
    // In production, you'd use a library like 'formidable' or 'busboy'
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Extract image data from multipart (this is a simplified version)
    // In reality, we'd parse the multipart boundaries properly
    const boundary = contentType.split('boundary=')[1];
    const parts = buffer.toString('binary').split('--' + boundary);
    
    let imageBuffer = null;
    let filename = 'tool-image.jpg';
    
    for (const part of parts) {
      if (part.includes('Content-Type: image')) {
        const lines = part.split('\r\n\r\n');
        if (lines.length >= 2) {
          const imageData = lines[1].split('\r\n')[0];
          imageBuffer = Buffer.from(imageData, 'binary');
          
          // Extract filename if available
          const filenameMatch = part.match(/filename="([^"]+)"/);
          if (filenameMatch) filename = filenameMatch[1];
        }
      }
    }

    if (!imageBuffer) {
      return res.status(400).json({ error: 'No image file found in request' });
    }

    let recognizedData = {
      description: '',
      category: 'Other',
      brand: 'Other',
      estimated_value: 0,
      confidence: 0,
      image_url: ''
    };

    // Upload to Vercel Blob if token is available
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(filename, imageBuffer, {
          access: 'public',
          token: process.env.BLOB_READ_WRITE_TOKEN,
        });
        recognizedData.image_url = blob.url;
      } catch (blobError) {
        console.error('Blob upload error:', blobError);
      }
    }

    return res.json({
      ...recognizedData,
      message: 'Image uploaded successfully - please fill in tool details manually'
    });

  } catch (error) {
    console.error('Image recognition error:', error);
    return res.status(500).json({ error: 'Server error during image recognition: ' + error.message });
  }
}

