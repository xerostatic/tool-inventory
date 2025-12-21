require('dotenv').config();
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function addCarsTable() {
  try {
    console.log('🔄 Creating cars table...');

    // Create cars table
    await sql`
      CREATE TABLE IF NOT EXISTS cars (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        make VARCHAR(100) NOT NULL,
        model VARCHAR(100) NOT NULL,
        year INTEGER NOT NULL,
        vin VARCHAR(17),
        mileage INTEGER,
        condition VARCHAR(50) NOT NULL,
        estimated_value DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    console.log('✅ Cars table created');

    // Create index for faster queries
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_user_id ON cars(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_cars_make ON cars(make)`;
    
    console.log('✅ Indexes created');
    console.log('🎉 Cars table added successfully!');
    
  } catch (error) {
    console.error('❌ Error adding cars table:', error);
    process.exit(1);
  }
}

addCarsTable();

