/**
 * scripts/verify_postgres_migration.js
 *
 * Post-migration validation script.
 * Run this after ETL to confirm all data migrated correctly.
 *
 * Usage: node scripts/verify_postgres_migration.js
 */
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const pass = (msg) => console.log(`  ✅ PASS: ${msg}`);
const fail = (msg) => { console.error(`  ❌ FAIL: ${msg}`); process.exitCode = 1; };

const check = (condition, successMsg, failMsg) =>
  condition ? pass(successMsg) : fail(failMsg);

const run = async () => {
  console.log('\n🔍 PostgreSQL Migration Verification\n');
  await prisma.$connect();

  // ── 1. Extension Check ─────────────────────────────────────────────────────
  console.log('1. PostgreSQL Extensions');
  const exts = await prisma.$queryRaw`SELECT extname FROM pg_extension WHERE extname IN ('uuid-ossp', 'pg_trgm')`;
  check(exts.length === 2, 'uuid-ossp and pg_trgm installed', 'Missing extensions');

  // ── 2. Table Existence ─────────────────────────────────────────────────────
  console.log('\n2. Table Existence');
  const tables = [
    'candidates', 'interviews', 'interview_assets',
    'candidate_skills', 'skills', 'graph_subscriptions',
    'webhook_events', 'outbox_events', 'audit_logs',
    'tenants', 'organizations',
  ];
  const existing = await prisma.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  `;
  const existingNames = existing.map((r) => r.tablename);
  for (const t of tables) {
    check(existingNames.includes(t), `Table "${t}" exists`, `Table "${t}" MISSING`);
  }

  // ── 3. Default Tenant ──────────────────────────────────────────────────────
  console.log('\n3. Default Tenant');
  const tenants = await prisma.tenant.count();
  check(tenants >= 1, 'At least 1 tenant exists', 'No tenants found — run seed migration');

  // ── 4. CRUD: Candidate ─────────────────────────────────────────────────────
  console.log('\n4. Candidate CRUD');
  const testEmail = `verify_test_${Date.now()}@test.com`;
  const candidate = await prisma.candidate.create({
    data: {
      name:     'Verification Test User',
      email:    testEmail,
      job_role: 'QA Engineer',
      status:   'ACTIVE',
    },
  });
  check(!!candidate.id, 'Candidate CREATE with UUID PK', 'Candidate create failed');
  check(candidate.email === testEmail, 'Email stored correctly', 'Email mismatch');

  const found = await prisma.candidate.findFirst({ where: { email: testEmail } });
  check(!!found, 'Candidate READ by email', 'Candidate not found');

  // Soft delete
  await prisma.candidate.update({
    where: { id: candidate.id },
    data:  { deleted_at: new Date() },
  });
  const softDeleted = await prisma.candidate.findFirst({
    where: { email: testEmail, deleted_at: null },
  });
  check(!softDeleted, 'Soft-delete filters correctly', 'Soft-delete not working');

  // Hard delete test record
  await prisma.candidate.delete({ where: { id: candidate.id } });

  // ── 5. Meeting Key Extractor ───────────────────────────────────────────────
  console.log('\n5. Meeting Key Extractor');
  const { extractMeetingKey, isValidMeetingKey } = require('../src/utils/meetingKeyExtractor');
  const testUrls = [
    'https://teams.microsoft.com/l/meetup-join/19%3Ameeting_abc123%40thread.v2/0?context=xxx',
    'https://teams.microsoft.com/l/meetup-join/19:meeting_abc123@thread.v2/0',
    'https://teams.live.com/meet/19:meeting_abc123@thread.v2?p=xxx',
  ];
  for (const url of testUrls) {
    const key = extractMeetingKey(url);
    check(isValidMeetingKey(key), `Key extracted from URL: ${key}`, `Failed to extract key from: ${url}`);
  }

  const noKey = extractMeetingKey('https://zoom.us/j/123456');
  check(noKey === null, 'Returns null for non-Teams URL', 'Should return null for Zoom URL');

  // ── 6. Index Verification ──────────────────────────────────────────────────
  console.log('\n6. Index Verification');
  const indexes = await prisma.$queryRaw`
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public'
    AND indexname IN (
      'interview_meeting_key_idx',
      'candidate_name_trgm_idx',
      'webhook_change_id_idx',
      'outbox_pending_idx'
    )
  `;
  const indexNames = indexes.map((r) => r.indexname);
  check(indexNames.includes('interview_meeting_key_idx'), 'normalized_meeting_key index exists', 'MISSING: interview_meeting_key_idx');
  check(indexNames.includes('candidate_name_trgm_idx'),  'pg_trgm name index exists',           'MISSING: candidate_name_trgm_idx');
  check(indexNames.includes('webhook_change_id_idx'),    'Webhook change_id index exists',       'MISSING: webhook_change_id_idx');
  check(indexNames.includes('outbox_pending_idx'),       'Outbox PENDING partial index exists',  'MISSING: outbox_pending_idx');

  await prisma.$disconnect();
  console.log('\n─────────────────────────────────────');
  if (process.exitCode === 1) {
    console.error('❌ Verification FAILED. Fix issues before switching DB_PROVIDER=postgres.\n');
  } else {
    console.log('✅ All checks passed. Safe to proceed with DB_PROVIDER=postgres.\n');
  }
};

run().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
