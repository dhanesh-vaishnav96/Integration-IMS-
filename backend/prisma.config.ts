// prisma.config.ts
// Prisma 7 configuration.
// datasource.url is the correct Prisma 7 API for CLI commands (db push, migrate, studio).
// The PrismaPg adapter is used at runtime in src/config/prisma.js.

import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';

dotenv.config();

// Strip surrounding quotes that some .env editors add
const rawUrl = process.env.DATABASE_URL ?? '';
const connectionString = rawUrl.replace(/^["']|["']$/g, '');

if (!connectionString) {
  throw new Error(
    'DATABASE_URL is not set in .env\n' +
    'Format: postgresql://user:password@host:5432/dbname?schema=public\n' +
    'Note: Special chars like $ in passwords must be encoded as %24'
  );
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: connectionString,
  },
});
