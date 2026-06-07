#!/usr/bin/env node
/**
 * scripts/local_postgres_setup.js
 *
 * One-shot local PostgreSQL setup and migration runner for Phase 1 validation.
 * 
 * Prerequisites:
 *   - PostgreSQL installed locally (see instructions below if not installed)
 *   - DATABASE_URL set in .env
 *
 * Usage:
 *   node scripts/local_postgres_setup.js
 */
const { execSync } = require('child_process');
const path = require('path');

const steps = [
  {
    name: '1. Validate DATABASE_URL',
    fn: () => {
      require('dotenv').config();
      if (!process.env.DATABASE_URL) {
        throw new Error('DATABASE_URL is not set in your .env file');
      }
      console.log(`   ✓ DATABASE_URL found: ${process.env.DATABASE_URL.replace(/:\/\/.*@/, '://***@')}`);
    },
  },
  {
    name: '2. Validate Prisma schema',
    fn: () => {
      execSync('npx prisma validate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    },
  },
  {
    name: '3. Apply Extensions Migration (0001)',
    fn: () => {
      // Extensions must be applied before Prisma migrate
      const { Client } = require('pg');
      require('dotenv').config();
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      client.connect();
      client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; CREATE EXTENSION IF NOT EXISTS "pg_trgm";', (err) => {
        client.end();
        if (err) throw err;
        console.log('   ✓ Extensions enabled.');
      });
    },
  },
  {
    name: '4. Push Prisma Schema to Local DB',
    fn: () => {
      // Using db push for local dev (faster than migrate dev which requires shadow DB)
      execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    },
  },
  {
    name: '5. Apply Seed Migration (default tenant)',
    fn: () => {
      const fs = require('fs');
      const { Client } = require('pg');
      require('dotenv').config();
      const sql = fs.readFileSync(
        path.resolve(__dirname, '../prisma/migrations/0003_seed_default_tenant/migration.sql'),
        'utf8'
      );
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      client.connect();
      client.query(sql, (err) => {
        client.end();
        if (err && !err.message.includes('already exists')) throw err;
        console.log('   ✓ Default tenant seeded.');
      });
    },
  },
  {
    name: '6. Generate Prisma Client',
    fn: () => {
      execSync('npx prisma generate', { stdio: 'inherit', cwd: path.resolve(__dirname, '..') });
    },
  },
];

(async () => {
  console.log('\n🚀 Interview OS — Local PostgreSQL Setup\n');
  for (const step of steps) {
    console.log(`\n▶ ${step.name}`);
    try {
      await step.fn();
    } catch (err) {
      console.error(`\n❌ FAILED at step: ${step.name}`);
      console.error(`   ${err.message}`);
      process.exit(1);
    }
  }
  console.log('\n✅ Local PostgreSQL setup complete.\n');
  console.log('   Verify with: npx prisma studio\n');
})();
