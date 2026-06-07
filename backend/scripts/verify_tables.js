require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg }     = require('@prisma/adapter-pg');

const url     = (process.env.DATABASE_URL || '').replace(/^["']|["']$/g, '');
const adapter = new PrismaPg({ connectionString: url, ssl: { rejectUnauthorized: false } });
const prisma  = new PrismaClient({ adapter });

const run = async () => {
  try {
    // 1. List all tables
    const tables = await prisma.$queryRawUnsafe(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('\n📋 Tables in RDS (public schema):');
    tables.forEach(r => console.log('  ✅', r.tablename));

    // 2. Row counts
    const counts = await prisma.$queryRawUnsafe(`
      SELECT
        (SELECT COUNT(*) FROM candidates)          AS candidates,
        (SELECT COUNT(*) FROM interviews)          AS interviews,
        (SELECT COUNT(*) FROM skills)              AS skills,
        (SELECT COUNT(*) FROM candidate_skills)    AS candidate_skills,
        (SELECT COUNT(*) FROM interview_assets)    AS interview_assets,
        (SELECT COUNT(*) FROM webhook_events)      AS webhook_events,
        (SELECT COUNT(*) FROM outbox_events)       AS outbox_events,
        (SELECT COUNT(*) FROM audit_logs)          AS audit_logs,
        (SELECT COUNT(*) FROM graph_subscriptions) AS graph_subscriptions,
        (SELECT COUNT(*) FROM tenants)             AS tenants
    `);
    console.log('\n📊 Row Counts:');
    const c = counts[0];
    Object.entries(c).forEach(([table, count]) =>
      console.log(`  ${table}: ${count}`)
    );

    console.log('\n✅ RDS table verification complete.\n');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
};

run();
