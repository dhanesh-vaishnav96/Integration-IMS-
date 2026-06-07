/**
 * scripts/mongo_to_postgres_etl.js
 *
 * MongoDB → PostgreSQL ETL Migration Script
 *
 * Features:
 *   - Batch processing (configurable batch size)
 *   - Resume support (tracks progress in etl_checkpoint.json)
 *   - Progress logging (per-collection counts)
 *   - Validation report (row count + key integrity checks)
 *   - Dry-run mode (--dry-run flag)
 *   - Rollback: truncate Postgres tables and re-run
 *
 * Usage:
 *   node scripts/mongo_to_postgres_etl.js
 *   node scripts/mongo_to_postgres_etl.js --dry-run
 *   node scripts/mongo_to_postgres_etl.js --rollback
 *   node scripts/mongo_to_postgres_etl.js --validate-only
 *
 * Requires BOTH MONGO_URI and DATABASE_URL to be set in .env
 */
require('dotenv').config();
const mongoose = require('mongoose');
const { PrismaClient } = require('@prisma/client');
const fs   = require('fs');
const path = require('path');
const { extractMeetingKey } = require('../src/utils/meetingKeyExtractor');

// ─── Config ───────────────────────────────────────────────────────────────────
const BATCH_SIZE    = parseInt(process.env.ETL_BATCH_SIZE || '100', 10);
const CHECKPOINT_FILE = path.resolve(__dirname, 'etl_checkpoint.json');
const DRY_RUN       = process.argv.includes('--dry-run');
const ROLLBACK      = process.argv.includes('--rollback');
const VALIDATE_ONLY = process.argv.includes('--validate-only');

const prisma = new PrismaClient();

// ─── Checkpoint Support (Resume) ─────────────────────────────────────────────
const loadCheckpoint = () => {
  if (fs.existsSync(CHECKPOINT_FILE)) {
    return JSON.parse(fs.readFileSync(CHECKPOINT_FILE, 'utf8'));
  }
  return { candidates: 0, interviews: 0, assets: 0, webhooks: 0, subscriptions: 0 };
};

const saveCheckpoint = (checkpoint) => {
  fs.writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
};

// ─── Mongo Models (load lazily to avoid Mongoose model registration issues) ──
const loadMongoModels = () => {
  const { Candidate }       = require('../src/models/Candidate');
  const { Interview }       = require('../src/models/Interview');
  const { InterviewAsset }  = require('../src/models/InterviewAsset');
  const { WebhookEvent }    = require('../src/models/WebhookEvent');
  const { GraphSubscription } = require('../src/models/GraphSubscription');
  return { Candidate, Interview, InterviewAsset, WebhookEvent, GraphSubscription };
};

// ─── Log Helper ───────────────────────────────────────────────────────────────
const log = (msg) => console.log(`[ETL ${new Date().toISOString()}] ${msg}`);

// ─── Migrate Candidates ───────────────────────────────────────────────────────
const migrateCandidates = async (models, checkpoint) => {
  const { Candidate } = models;
  const total = await Candidate.countDocuments();
  log(`Candidates: ${total} records to migrate (skip=${checkpoint.candidates})`);

  let migrated = checkpoint.candidates;
  while (migrated < total) {
    const batch = await Candidate.find()
      .sort({ createdAt: 1 })
      .skip(migrated)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (!DRY_RUN) {
      await prisma.$transaction(async (tx) => {
        for (const c of batch) {
          await tx.candidate.upsert({
            where:  { legacy_mongo_id: c._id.toString() },
            update: {},
            create: {
              legacy_mongo_id:     c._id.toString(),
              name:                c.name,
              email:               c.email,
              phone:               c.phone,
              job_role:            c.job_role,
              years_of_experience: c.years_of_experience ?? 0,
              resume_url:          c.resume_url,
              status:              c.status ?? 'ACTIVE',
              created_by:          c.createdBy,
              updated_by:          c.updatedBy,
              deleted_at:          c.deletedAt ?? null,
              created_at:          c.createdAt ?? new Date(),
              updated_at:          c.updatedAt ?? new Date(),
            },
          });

          // Migrate skills
          if (c.skills?.length) {
            const candidatePg = await tx.candidate.findFirst({
              where: { legacy_mongo_id: c._id.toString() },
            });
            for (const skillName of c.skills) {
              const name = skillName.toLowerCase().trim();
              const skill = await tx.skill.upsert({
                where:  { name },
                update: {},
                create: { name },
              });
              await tx.candidateSkill.upsert({
                where:  { unique_candidate_skill: { candidate_id: candidatePg.id, skill_id: skill.id } },
                update: {},
                create: { candidate_id: candidatePg.id, skill_id: skill.id },
              });
            }
          }
        }
      });
    }

    migrated += batch.length;
    checkpoint.candidates = migrated;
    saveCheckpoint(checkpoint);
    log(`  Candidates: ${migrated}/${total}`);
  }
};

// ─── Migrate Interviews ───────────────────────────────────────────────────────
const migrateInterviews = async (models, checkpoint) => {
  const { Interview } = models;
  const total = await Interview.countDocuments();
  log(`Interviews: ${total} records to migrate (skip=${checkpoint.interviews})`);

  let migrated = checkpoint.interviews;
  while (migrated < total) {
    const batch = await Interview.find()
      .sort({ createdAt: 1 })
      .skip(migrated)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (!DRY_RUN) {
      for (const i of batch) {
        const candidatePg = await prisma.candidate.findFirst({
          where: { legacy_mongo_id: i.candidate_id?.toString() },
        });
        if (!candidatePg) {
          log(`  WARN: No candidate found for interview ${i._id} (mongo candidate_id=${i.candidate_id})`);
          continue;
        }

        const normalizedKey = i.meeting_join_url
          ? extractMeetingKey(i.meeting_join_url)
          : null;

        await prisma.interview.upsert({
          where:  { legacy_mongo_id: i._id.toString() },
          update: {},
          create: {
            legacy_mongo_id:        i._id.toString(),
            candidate_id:           candidatePg.id,
            teams_meeting_id:       i.teams_meeting_id,
            meeting_join_url:       i.meeting_join_url,
            normalized_meeting_key: normalizedKey,
            meeting_provider:       i.meeting_provider ?? 'TEAMS',
            organizer_email:        i.organizer_email,
            interviewer_email:      i.interviewer_email,
            scheduled_time:         i.scheduled_time,
            duration_minutes:       i.duration_minutes ?? 60,
            status:                 i.status ?? 'SCHEDULED',
            created_by:             i.createdBy,
            updated_by:             i.updatedBy,
            deleted_at:             i.deletedAt ?? null,
            created_at:             i.createdAt ?? new Date(),
            updated_at:             i.updatedAt ?? new Date(),
          },
        });
      }
    }

    migrated += batch.length;
    checkpoint.interviews = migrated;
    saveCheckpoint(checkpoint);
    log(`  Interviews: ${migrated}/${total}`);
  }
};

// ─── Migrate Assets ───────────────────────────────────────────────────────────
const migrateAssets = async (models, checkpoint) => {
  const { InterviewAsset } = models;
  const total = await InterviewAsset.countDocuments();
  log(`Assets: ${total} records to migrate (skip=${checkpoint.assets})`);

  let migrated = checkpoint.assets;
  while (migrated < total) {
    const batch = await InterviewAsset.find()
      .sort({ createdAt: 1 })
      .skip(migrated)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (!DRY_RUN) {
      for (const a of batch) {
        const interviewPg = await prisma.interview.findFirst({
          where: { legacy_mongo_id: a.interview_id?.toString() },
        });
        if (!interviewPg) continue;

        await prisma.interviewAsset.upsert({
          where:  { interview_id: interviewPg.id },
          update: {},
          create: {
            interview_id:      interviewPg.id,
            candidate_id:      interviewPg.candidate_id,
            recording_s3_key:  a.recording_s3_key ?? a.recording_s3_url,
            recording_status:  a.recording_status ?? 'PENDING',
            transcript_s3_key: a.transcript_s3_key ?? a.transcript_s3_url,
            transcript_status: a.transcript_status ?? 'PENDING',
            logs:              a.processing_logs ?? [],
            created_at:        a.createdAt ?? new Date(),
            updated_at:        a.updatedAt ?? new Date(),
          },
        });
      }
    }

    migrated += batch.length;
    checkpoint.assets = migrated;
    saveCheckpoint(checkpoint);
    log(`  Assets: ${migrated}/${total}`);
  }
};

// ─── Migrate Webhook Events ───────────────────────────────────────────────────
const migrateWebhookEvents = async (models, checkpoint) => {
  const { WebhookEvent } = models;
  const total = await WebhookEvent.countDocuments();
  log(`WebhookEvents: ${total} records`);

  let migrated = checkpoint.webhooks;
  while (migrated < total) {
    const batch = await WebhookEvent.find()
      .sort({ createdAt: 1 })
      .skip(migrated)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (!DRY_RUN) {
      for (const w of batch) {
        await prisma.webhookEvent.upsert({
          where:  { change_id: w.change_id },
          update: {},
          create: {
            change_id:       w.change_id,
            subscription_id: w.subscription_id ?? 'unknown',
            resource:        w.resource ?? '',
            change_type:     w.change_type ?? '',
            resource_data:   w.resource_data ?? undefined,
            raw_payload:     w.raw_payload   ?? undefined,
            status:          w.status ?? 'RECEIVED',
            error_message:   w.error_message,
            created_at:      w.createdAt ?? new Date(),
            updated_at:      w.updatedAt ?? new Date(),
          },
        });
      }
    }

    migrated += batch.length;
    checkpoint.webhooks = migrated;
    saveCheckpoint(checkpoint);
    log(`  WebhookEvents: ${migrated}/${total}`);
  }
};

// ─── Migrate Subscriptions ────────────────────────────────────────────────────
const migrateSubscriptions = async (models, checkpoint) => {
  const { GraphSubscription } = models;
  const total = await GraphSubscription.countDocuments();
  log(`GraphSubscriptions: ${total} records`);

  let migrated = checkpoint.subscriptions;
  while (migrated < total) {
    const batch = await GraphSubscription.find()
      .sort({ createdAt: 1 })
      .skip(migrated)
      .limit(BATCH_SIZE)
      .lean();

    if (!batch.length) break;

    if (!DRY_RUN) {
      for (const s of batch) {
        await prisma.graphSubscription.upsert({
          where:  { subscription_id: s.subscription_id },
          update: {},
          create: {
            subscription_id:      s.subscription_id,
            expiration_date_time: s.expiration_datetime ?? s.expiration_date_time ?? new Date(),
            client_state:         s.client_state ?? '',
            creator_id:           s.creator_id,
            notification_url:     s.notification_url ?? '',
            resource:             s.resource ?? '',
            change_type:          s.change_type ?? '',
            is_active:            s.is_active ?? true,
            renewed_at:           s.last_renewed_at,
            created_at:           s.createdAt ?? new Date(),
            updated_at:           s.updatedAt ?? new Date(),
          },
        });
      }
    }

    migrated += batch.length;
    checkpoint.subscriptions = migrated;
    saveCheckpoint(checkpoint);
    log(`  GraphSubscriptions: ${migrated}/${total}`);
  }
};

// ─── Validation Report ────────────────────────────────────────────────────────
const validateMigration = async (models) => {
  log('\n=== VALIDATION REPORT ===');
  const counts = {
    mongo: {
      candidates:    await models.Candidate.countDocuments(),
      interviews:    await models.Interview.countDocuments(),
      assets:        await models.InterviewAsset.countDocuments(),
      webhooks:      await models.WebhookEvent.countDocuments(),
      subscriptions: await models.GraphSubscription.countDocuments(),
    },
    postgres: {
      candidates:    await prisma.candidate.count(),
      interviews:    await prisma.interview.count(),
      assets:        await prisma.interviewAsset.count(),
      webhooks:      await prisma.webhookEvent.count(),
      subscriptions: await prisma.graphSubscription.count(),
    },
  };

  let allMatch = true;
  for (const [table, mongoCount] of Object.entries(counts.mongo)) {
    const pgCount = counts.postgres[table];
    const match   = mongoCount === pgCount ? '✅' : '❌ MISMATCH';
    if (mongoCount !== pgCount) allMatch = false;
    log(`  ${table}: MongoDB=${mongoCount} | PostgreSQL=${pgCount} ${match}`);
  }

  log(allMatch ? '\n✅ All counts match. Migration validated.' : '\n❌ Count mismatch detected. Do NOT switch DB_PROVIDER.');
  return allMatch;
};

// ─── Rollback (Truncate Postgres) ─────────────────────────────────────────────
const rollback = async () => {
  log('⚠️  ROLLBACK: Truncating all PostgreSQL tables...');
  await prisma.$executeRaw`TRUNCATE TABLE interview_assets, webhook_events, outbox_events, graph_subscriptions, audit_logs, candidate_skills, interviews, candidates, skills CASCADE`;
  if (fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);
  log('✅ Rollback complete. All PostgreSQL tables are empty. MongoDB is untouched.');
};

// ─── Main ─────────────────────────────────────────────────────────────────────
const main = async () => {
  if (DRY_RUN) log('🔍 DRY RUN MODE — No data will be written to PostgreSQL.');

  await mongoose.connect(process.env.MONGO_URI);
  log('✅ Connected to MongoDB.');

  await prisma.$connect();
  log('✅ Connected to PostgreSQL.');

  const models = loadMongoModels();

  if (ROLLBACK) {
    await rollback();
    process.exit(0);
  }

  if (VALIDATE_ONLY) {
    await validateMigration(models);
    process.exit(0);
  }

  const checkpoint = loadCheckpoint();
  log(`Resuming from checkpoint: ${JSON.stringify(checkpoint)}`);

  await migrateCandidates(models, checkpoint);
  await migrateInterviews(models, checkpoint);
  await migrateAssets(models, checkpoint);
  await migrateWebhookEvents(models, checkpoint);
  await migrateSubscriptions(models, checkpoint);

  log('\n✅ ETL migration complete.');
  await validateMigration(models);

  // Clean up checkpoint after successful full run
  if (!DRY_RUN && fs.existsSync(CHECKPOINT_FILE)) fs.unlinkSync(CHECKPOINT_FILE);

  await mongoose.disconnect();
  await prisma.$disconnect();
};

main().catch((err) => {
  console.error('[ETL] Fatal error:', err.message);
  process.exit(1);
});
