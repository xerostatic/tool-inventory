// Unified server for self-hosted deployment
// Serves React build + API routes
const express = require('express');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

// Serve static React build
app.use(express.static(path.join(__dirname, 'build')));

// ============================================
// DATABASE
// ============================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Auto-create tables on startup
async function initializeDatabase() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        category VARCHAR(255),
        brand VARCHAR(255),
        description TEXT,
        quantity INTEGER DEFAULT 1,
        condition VARCHAR(100),
        estimated_value DECIMAL(10,2),
        notes TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        make VARCHAR(255),
        model VARCHAR(255),
        year INTEGER,
        vin VARCHAR(17),
        mileage INTEGER,
        condition VARCHAR(100),
        estimated_value DECIMAL(10,2),
        notes TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('Database tables initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
}

initializeDatabase();

// ============================================
// AUTH MIDDLEWARE
// ============================================

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Access token required' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// API ROUTES
// ============================================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Tool Inventory API is running' });
});

// VIN decoder (public - before auth middleware)
app.get('/api/decode-vin/:vin', async (req, res) => {
  const { vin } = req.params;
  if (!vin || vin.length !== 17) {
    return res.status(400).json({ error: 'VIN must be exactly 17 characters' });
  }

  try {
    const response = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${vin}?format=json`
    );
    const data = await response.json();

    if (!data.Results || data.Results.length === 0) {
      return res.status(404).json({ error: 'VIN not found' });
    }

    const result = data.Results[0];
    if (result.ErrorCode !== '0') {
      return res.status(400).json({ error: 'Invalid VIN', details: result.ErrorText });
    }

    return res.json({
      success: true,
      data: {
        make: result.Make || '',
        model: result.Model || '',
        year: parseInt(result.ModelYear) || new Date().getFullYear(),
        vin,
        trim: result.Trim || '',
      },
      message: 'VIN decoded successfully'
    });
  } catch (error) {
    console.error('VIN decode error:', error);
    return res.status(500).json({ error: 'Failed to decode VIN', details: error.message });
  }
});

// Auth: Register
app.post('/api/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) {
    return res.status(400).json({ error: 'Valid email and password (min 6 chars) required' });
  }

  try {
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, created_at',
      [email, passwordHash]
    );

    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(201).json({
      message: 'User created successfully',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// Auth: Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const users = await pool.query('SELECT id, email, password_hash FROM users WHERE email = $1', [email]);
    if (users.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      message: 'Login successful',
      token,
      user: { id: user.id, email: user.email }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// Tools: GET all
app.get('/api/tools', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM tools WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
    return res.json(result.rows);
  } catch (error) {
    console.error('Get tools error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: POST create
app.post('/api/tools', authenticate, async (req, res) => {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tools (user_id, category, brand, description, quantity, condition, estimated_value, notes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, category, brand, description, quantity, condition, estimated_value, notes || null, image_url || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: PUT update
app.put('/api/tools/:id', authenticate, async (req, res) => {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE tools SET category = $1, brand = $2, description = $3,
        quantity = $4, condition = $5, estimated_value = $6,
        notes = $7, image_url = $8, updated_at = CURRENT_TIMESTAMP
       WHERE id = $9 AND user_id = $10 RETURNING *`,
      [category, brand, description, quantity, condition, estimated_value, notes || null, image_url || null, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: DELETE
app.delete('/api/tools/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM tools WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: GET all
app.get('/api/cars', authenticate, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM cars WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
    return res.json(result.rows);
  } catch (error) {
    if (error.message && error.message.includes('does not exist')) {
      return res.json([]);
    }
    console.error('Get cars error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: POST create
app.post('/api/cars', authenticate, async (req, res) => {
  const { make, model, year, vin, mileage, condition, estimated_value, notes, image_url } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO cars (user_id, make, model, year, vin, mileage, condition, estimated_value, notes, image_url)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.userId, make, model, year, vin || null, mileage || null, condition, estimated_value, notes || null, image_url || null]
    );
    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create car error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: PUT update
app.put('/api/cars/:id', authenticate, async (req, res) => {
  const { make, model, year, vin, mileage, condition, estimated_value, notes, image_url } = req.body;
  try {
    const result = await pool.query(
      `UPDATE cars SET make = $1, model = $2, year = $3, vin = $4, mileage = $5,
        condition = $6, estimated_value = $7, notes = $8, image_url = $9, updated_at = CURRENT_TIMESTAMP
       WHERE id = $10 AND user_id = $11 RETURNING *`,
      [make, model, year, vin || null, mileage || null, condition, estimated_value, notes || null, image_url || null, req.params.id, req.userId]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    return res.json(result.rows[0]);
  } catch (error) {
    console.error('Update car error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: DELETE
app.delete('/api/cars/:id', authenticate, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM cars WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Car not found' });
    return res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.error('Delete car error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Stats
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const stats = await pool.query(
      `SELECT COUNT(*) as total_items, SUM(quantity) as total_quantity,
        SUM(estimated_value * quantity) as total_value, COUNT(DISTINCT category) as categories_count
       FROM tools WHERE user_id = $1`,
      [req.userId]
    );
    const categoryStats = await pool.query(
      `SELECT category, COUNT(*) as count, SUM(estimated_value * quantity) as total_value
       FROM tools WHERE user_id = $1 GROUP BY category ORDER BY total_value DESC`,
      [req.userId]
    );
    return res.json({ overview: stats.rows[0], categories: categoryStats.rows });
  } catch (error) {
    console.error('Stats error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Catch-all: serve React app for client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

// Start
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
