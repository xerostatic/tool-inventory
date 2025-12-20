require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { neon } = require('@neondatabase/serverless');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const vision = require('@google-cloud/vision');
const { put } = require('@vercel/blob');

const app = express();
const sql = neon(process.env.DATABASE_URL);

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration for file uploads (use memory storage for Vercel Blob)
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize Google Cloud Vision client (optional)
let visionClient = null;
try {
  // For Vercel: Use inline credentials from environment variable
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
    visionClient = new vision.ImageAnnotatorClient({ credentials });
    console.log('✅ Google Cloud Vision API initialized (from env)');
  }
  // For local development: Use credentials file
  else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    visionClient = new vision.ImageAnnotatorClient();
    console.log('✅ Google Cloud Vision API initialized (from file)');
  } else {
    console.log('⚠️  Google Cloud Vision API not configured (optional feature)');
  }
} catch (error) {
  console.log('⚠️  Google Cloud Vision API not available:', error.message);
}

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// AUTH ROUTES
// ============================================

// Register new user
app.post('/api/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Check if user already exists
    const existingUser = await sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (existingUser.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await sql`
      INSERT INTO users (email, password_hash)
      VALUES (${email}, ${passwordHash})
      RETURNING id, email, created_at
    `;

    const user = result[0];

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login
app.post('/api/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').exists()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { email, password } = req.body;

  try {
    // Find user
    const users = await sql`
      SELECT id, email, password_hash FROM users WHERE email = ${email}
    `;

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const users = await sql`
      SELECT id, email, created_at FROM users WHERE id = ${req.userId}
    `;

    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: users[0] });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// TOOLS ROUTES
// ============================================

// Get all tools for current user
app.get('/api/tools', authenticateToken, async (req, res) => {
  try {
    const tools = await sql`
      SELECT * FROM tools 
      WHERE user_id = ${req.userId}
      ORDER BY created_at DESC
    `;

    res.json(tools);
  } catch (error) {
    console.error('Get tools error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single tool
app.get('/api/tools/:id', authenticateToken, async (req, res) => {
  try {
    const tools = await sql`
      SELECT * FROM tools 
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
    `;

    if (tools.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json(tools[0]);
  } catch (error) {
    console.error('Get tool error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create new tool
app.post('/api/tools', authenticateToken, [
  body('category').notEmpty(),
  body('brand').notEmpty(),
  body('description').notEmpty(),
  body('quantity').isInt({ min: 1 }),
  body('condition').notEmpty(),
  body('estimated_value').isFloat({ min: 0 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;

  try {
    const result = await sql`
      INSERT INTO tools (
        user_id, category, brand, description, quantity, 
        condition, estimated_value, notes, image_url
      )
      VALUES (
        ${req.userId}, ${category}, ${brand}, ${description}, ${quantity},
        ${condition}, ${estimated_value}, ${notes || null}, ${image_url || null}
      )
      RETURNING *
    `;

    res.status(201).json(result[0]);
  } catch (error) {
    console.error('Create tool error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update tool
app.put('/api/tools/:id', authenticateToken, async (req, res) => {
  const { category, brand, description, quantity, condition, estimated_value, notes, image_url } = req.body;

  try {
    // Check if tool exists and belongs to user
    const existing = await sql`
      SELECT id FROM tools WHERE id = ${req.params.id} AND user_id = ${req.userId}
    `;

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    const result = await sql`
      UPDATE tools
      SET 
        category = ${category},
        brand = ${brand},
        description = ${description},
        quantity = ${quantity},
        condition = ${condition},
        estimated_value = ${estimated_value},
        notes = ${notes || null},
        image_url = ${image_url || null},
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING *
    `;

    res.json(result[0]);
  } catch (error) {
    console.error('Update tool error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete tool
app.delete('/api/tools/:id', authenticateToken, async (req, res) => {
  try {
    const result = await sql`
      DELETE FROM tools 
      WHERE id = ${req.params.id} AND user_id = ${req.userId}
      RETURNING id
    `;

    if (result.length === 0) {
      return res.status(404).json({ error: 'Tool not found' });
    }

    res.json({ message: 'Tool deleted successfully' });
  } catch (error) {
    console.error('Delete tool error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// IMAGE RECOGNITION ROUTE
// ============================================

// Analyze image and extract tool information
app.post('/api/recognize-tool', authenticateToken, upload.single('image'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file provided' });
  }

  try {
    // Upload image to Vercel Blob Storage
    let imageUrl = '';
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const blob = await put(req.file.originalname, req.file.buffer, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      imageUrl = blob.url;
    }

    let recognizedData = {
      description: '',
      category: 'Other',
      brand: 'Other',
      estimated_value: 0,
      confidence: 0
    };

    // If Google Cloud Vision is available, use it
    if (visionClient) {
      try {
        // Perform label detection, text detection, and object localization
        const [labels] = await visionClient.labelDetection(req.file.buffer);
        const [texts] = await visionClient.textDetection(req.file.buffer);
        const [objects] = await visionClient.objectLocalization(req.file.buffer);

        // Extract labels
        const labelDescriptions = labels.labelAnnotations?.map(label => label.description) || [];
        
        // Extract text
        const detectedText = texts.textAnnotations?.[0]?.description || '';
        
        // Extract objects
        const objectNames = objects.localizedObjectAnnotations?.map(obj => obj.name) || [];

        // Analyze and categorize
        const allInfo = [...labelDescriptions, ...objectNames, detectedText.toLowerCase()].join(' ').toLowerCase();

        // Detect category
        if (allInfo.includes('wrench') || allInfo.includes('spanner')) {
          recognizedData.category = 'Wrenches';
          recognizedData.description = 'Wrench';
        } else if (allInfo.includes('drill') || allInfo.includes('power tool')) {
          recognizedData.category = 'Power Tools';
          recognizedData.description = 'Power Drill';
        } else if (allInfo.includes('socket') || allInfo.includes('ratchet')) {
          recognizedData.category = 'Sockets & Drives';
          recognizedData.description = 'Socket Set';
        } else if (allInfo.includes('hammer')) {
          recognizedData.category = 'Hand Tools';
          recognizedData.description = 'Hammer';
        } else if (allInfo.includes('screwdriver')) {
          recognizedData.category = 'Hand Tools';
          recognizedData.description = 'Screwdriver';
        } else if (allInfo.includes('toolbox') || allInfo.includes('storage') || allInfo.includes('chest')) {
          recognizedData.category = 'Toolboxes/Storage';
          recognizedData.description = 'Toolbox';
        } else if (allInfo.includes('diagnostic') || allInfo.includes('scanner') || allInfo.includes('meter')) {
          recognizedData.category = 'Diagnostic Equipment';
          recognizedData.description = 'Diagnostic Tool';
        } else {
          recognizedData.description = labelDescriptions[0] || 'Tool';
        }

        // Detect brand from text
        const brands = ['snap-on', 'snapon', 'mac', 'matco', 'craftsman', 'milwaukee', 'dewalt', 
                       'autel', 'masterforce', 'harbor freight', 'tekton', 'kobalt', 'gearwrench'];
        
        for (const brand of brands) {
          if (allInfo.includes(brand)) {
            recognizedData.brand = brand.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            if (recognizedData.brand.toLowerCase() === 'snapon') recognizedData.brand = 'Snap-On';
            break;
          }
        }

        // Estimate value based on category and brand
        const valueMap = {
          'Snap-On': { min: 100, max: 500 },
          'Mac': { min: 80, max: 400 },
          'Matco': { min: 80, max: 400 },
          'Milwaukee': { min: 50, max: 300 },
          'DeWalt': { min: 50, max: 300 },
          'Craftsman': { min: 30, max: 200 },
        };

        const brandValue = valueMap[recognizedData.brand];
        if (brandValue) {
          recognizedData.estimated_value = Math.round((brandValue.min + brandValue.max) / 2);
        } else {
          recognizedData.estimated_value = 50;
        }

        recognizedData.confidence = labels.labelAnnotations?.[0]?.score || 0;

      } catch (visionError) {
        console.error('Vision API error:', visionError);
        // Continue with default values
      }
    }

    // Return recognized data along with image URL
    res.json({
      ...recognizedData,
      image_url: imageUrl,
      message: visionClient ? 'Image analyzed successfully' : 'Image uploaded (Vision API not configured)'
    });

  } catch (error) {
    console.error('Image recognition error:', error);
    res.status(500).json({ error: 'Server error during image recognition: ' + error.message });
  }
});

// ============================================
// STATS ROUTE
// ============================================

app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const stats = await sql`
      SELECT 
        COUNT(*) as total_items,
        SUM(quantity) as total_quantity,
        SUM(estimated_value * quantity) as total_value,
        COUNT(DISTINCT category) as categories_count
      FROM tools
      WHERE user_id = ${req.userId}
    `;

    const categoryStats = await sql`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(estimated_value * quantity) as total_value
      FROM tools
      WHERE user_id = ${req.userId}
      GROUP BY category
      ORDER BY total_value DESC
    `;

    res.json({
      overview: stats[0],
      categories: categoryStats
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Tool Inventory API is running',
    visionApiEnabled: !!visionClient
  });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  console.log(`🗄️  Database: Connected to Neon PostgreSQL`);
  console.log(`🔐 JWT Authentication: Enabled`);
  console.log(`📸 Vision API: ${visionClient ? 'Enabled' : 'Disabled (optional)'}`);
});

