#!/usr/bin/env node
/**
 * Database Setup Script
 * 
 * Sets up PostgreSQL database for development
 */

const { Pool } = require('pg');
const fs = require('fs').promises;
const path = require('path');

async function setupDatabase() {
  console.log('🔧 Setting up PostgreSQL database...');
  
  try {
    // Connect to PostgreSQL (without specific database)
    const pool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'dev_user',
      password: 'dev_password',
      database: 'postgres' // Connect to default postgres database first
    });

    // Create database if it doesn't exist
    try {
      await pool.query('CREATE DATABASE ai_security');
      console.log('✅ Database "ai_security" created');
    } catch (error) {
      if (error.code === '42P04') {
        console.log('ℹ️ Database "ai_security" already exists');
      } else {
        throw error;
      }
    }

    await pool.end();

    // Connect to the ai_security database
    const aiSecurityPool = new Pool({
      host: 'localhost',
      port: 5432,
      user: 'dev_user',
      password: 'dev_password',
      database: 'ai_security'
    });

    // Read and execute schema
    const schemaPath = path.join(__dirname, '../database/init/01-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    await aiSecurityPool.query(schema);
    console.log('✅ Database schema created successfully');

    // Test the setup
    const result = await aiSecurityPool.query('SELECT COUNT(*) FROM agents');
    console.log(`✅ Database setup complete. Found ${result.rows[0].count} agents.`);

    await aiSecurityPool.end();
    
  } catch (error) {
    console.error('💥 Database setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;