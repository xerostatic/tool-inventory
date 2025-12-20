require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function initDatabase() {
  try {
    console.log('🔄 Creating database tables...');

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Users table created');

    // Create tools table
    await sql`
      CREATE TABLE IF NOT EXISTS tools (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category VARCHAR(100) NOT NULL,
        brand VARCHAR(100) NOT NULL,
        description TEXT NOT NULL,
        quantity INTEGER DEFAULT 1,
        condition VARCHAR(50) NOT NULL,
        estimated_value DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Tools table created');

    // Create index for faster queries
    await sql`CREATE INDEX IF NOT EXISTS idx_tools_user_id ON tools(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_tools_category ON tools(category)`;
    
    console.log('✅ Indexes created');
    console.log('🎉 Database initialized successfully!');
    
  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  }
}

initDatabase();

