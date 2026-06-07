/**
 * Database Migration: Create Indexes
 * 
 * Run this script directly against the production database to build indexes
 * in the background without locking the collection.
 * 
 * Usage: node scripts/migration_indexes.js
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { Interview } = require('../src/models/Interview');
const logger = require('../src/config/logger');

async function run() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    logger.info('Connected to MongoDB.');

    logger.info('Syncing indexes for Interview collection...');
    
    // syncIndexes creates missing indexes and drops unneeded ones based on the schema
    await Interview.syncIndexes({ background: true });
    
    logger.info('Indexes synced successfully.');
    process.exit(0);
  } catch (err) {
    logger.error(`Migration failed: ${err.message}`);
    process.exit(1);
  }
}

run();
