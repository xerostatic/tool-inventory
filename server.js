// Unified server for self-hosted deployment
// Serves React build + API routes
const express = require('express');
const path = require('path');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();

app.use(express.json());

// Serve static React build
app.use(express.static(path.join(__dirname, 'build')));

// ============================================
// API ROUTES
// ============================================

const getDb = () => neon(process.env.DATABASE_URL);

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
    const sql = getDb();
    const existingUser = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await sql`
      INSERT INTO users (email, password_hash) VALUES (${email}, ${passwordHash})
      RETURNING id, email, created_at
    `;

    const user = result[0];
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
    const sql = getDb();
    const users = await sql`SELECT id, email, password_hash FROM users WHERE email = ${email}`;
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];
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
    const sql = getDb();
    const tools = await sql`SELECT * FROM tools WHERE user_id = ${req.userId} ORDER BY created_at DESC`;
    return res.json(tools);
  } catch (error) {
    console.error('Get tools error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: POST create
app.post('/api/tools', authenticate, async (req, res) => {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;
  try {
    const sql = getDb();
    const result = await sql`
      INSERT INTO tools (user_id, category, brand, description, quantity, condition, estimated_value, notes, image_url)
      VALUES (${req.userId}, ${category}, ${brand}, ${description}, ${quantity}, ${condition}, ${estimated_value}, ${notes || null}, ${image_url || null})
      RETURNING *
    `;
    return res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: PUT update
app.put('/api/tools/:id', authenticate, async (req, res) => {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;
  try {
    const sql = getDb();
    const result = await sql`
      UPDATE tools SET category = ${category}, brand = ${brand}, description = ${description},
        quantity = ${quantity}, condition = ${condition}, estimated_value = ${estimated_value},
        notes = ${notes || null}, image_url = ${image_url || null}, updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;
    if (result.length === 0) return res.status(404).json({ error: 'Tool not found' });
    return res.json(result[0]);
  } catch (error) {
    console.error('Update tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Tools: DELETE
app.delete('/api/tools/:id', authenticate, async (req, res) => {
  try {
    const sql = getDb();
    const result = await sql`DELETE FROM tools WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: 'Tool not found' });
    return res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete tool error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: GET all
app.get('/api/cars', authenticate, async (req, res) => {
  try {
    const sql = getDb();
    const cars = await sql`SELECT * FROM cars WHERE user_id = ${req.userId} ORDER BY created_at DESC`;
    return res.json(cars);
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
    const sql = getDb();
    const result = await sql`
      INSERT INTO cars (user_id, make, model, year, vin, mileage, condition, estimated_value, notes, image_url)
      VALUES (${req.userId}, ${make}, ${model}, ${year}, ${vin || null}, ${mileage || null}, ${condition}, ${estimated_value}, ${notes || null}, ${image_url || null})
      RETURNING *
    `;
    return res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create car error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Cars: DELETE
app.delete('/api/cars/:id', authenticate, async (req, res) => {
  try {
    const sql = getDb();
    const result = await sql`DELETE FROM cars WHERE id = ${req.params.id} AND user_id = ${req.userId} RETURNING id`;
    if (result.length === 0) return res.status(404).json({ error: 'Car not found' });
    return res.json({ message: 'Car deleted successfully' });
  } catch (error) {
    console.error('Delete car error:', error);
    return res.status(500).json({ error: 'Server error' });
  }
});

// Stats
app.get('/api/stats', authenticate, async (req, res) => {
  try {
    const sql = getDb();
    const stats = await sql`
      SELECT COUNT(*) as total_items, SUM(quantity) as total_quantity,
        SUM(estimated_value * quantity) as total_value, COUNT(DISTINCT category) as categories_count
      FROM tools WHERE user_id = ${req.userId}
    `;
    const categoryStats = await sql`
      SELECT category, COUNT(*) as count, SUM(estimated_value * quantity) as total_value
      FROM tools WHERE user_id = ${req.userId} GROUP BY category ORDER BY total_value DESC
    `;
    return res.json({ overview: stats[0], categories: categoryStats });
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
