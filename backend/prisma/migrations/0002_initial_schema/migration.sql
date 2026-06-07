-- =============================================================================
-- Migration: 0002_initial_schema
-- Purpose:   Creates the full production schema for the Interview OS system.
--            All tables, constraints, indexes, and enums are defined here.
--
-- MIGRATION FREEZE RULE:
--   After promotion to production, only ADDITIVE changes are permitted
--   without a scheduled maintenance window. Do NOT alter column types,
--   drop columns, or change constraint names in a live migration.
-- =============================================================================

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

CREATE TYPE "CandidateStatus" AS ENUM (
  'ACTIVE', 'INACTIVE', 'HIRED', 'REJECTED', 'ON_HOLD'
);

CREATE TYPE "InterviewStatus" AS ENUM (
  'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

CREATE TYPE "MeetingProvider" AS ENUM (
  'TEAMS', 'ZOOM', 'GOOGLE_MEET', 'IN_PERSON'
);

CREATE TYPE "AssetStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'UPLOADED', 'FAILED', 'UNAVAILABLE'
);

CREATE TYPE "WebhookStatus" AS ENUM (
  'RECEIVED', 'PROCESSING', 'QUEUED', 'PROCESSED', 'FAILED', 'IGNORED'
);

CREATE TYPE "OutboxStatus" AS ENUM (
  'PENDING', 'PROCESSING', 'DELIVERED', 'FAILED', 'DEAD'
);

-- ─── TENANTS ──────────────────────────────────────────────────────────────────

CREATE TABLE "tenants" (
  "id"         UUID        NOT NULL DEFAULT uuid_generate_v4(),
  "name"       VARCHAR(200) NOT NULL,
  "domain"     VARCHAR(255) NOT NULL,
  "is_active"  BOOLEAN     NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "tenants_pkey"          PRIMARY KEY ("id"),
  CONSTRAINT "tenants_name_key"      UNIQUE ("name"),
  CONSTRAINT "tenants_domain_key"    UNIQUE ("domain")
);

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────

CREATE TABLE "organizations" (
  "id"         UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"  UUID         NOT NULL,
  "name"       VARCHAR(200) NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "organizations_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "organizations_tenant_id_fkey"    FOREIGN KEY ("tenant_id")
      REFERENCES "tenants"("id") ON DELETE RESTRICT
);

CREATE INDEX "org_tenant_idx" ON "organizations"("tenant_id");

-- ─── CANDIDATES ───────────────────────────────────────────────────────────────

CREATE TABLE "candidates" (
  "id"                  UUID              NOT NULL DEFAULT uuid_generate_v4(),
  "legacy_mongo_id"     VARCHAR(24)       UNIQUE,
  "tenant_id"           UUID,
  "organization_id"     UUID,
  "name"                VARCHAR(150)      NOT NULL,
  "email"               VARCHAR(255)      NOT NULL,
  "phone"               VARCHAR(30),
  "job_role"            VARCHAR(100)      NOT NULL,
  "years_of_experience" INTEGER           NOT NULL DEFAULT 0,
  "resume_url"          TEXT,
  "status"              "CandidateStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_by"          VARCHAR(255),
  "updated_by"          VARCHAR(255),
  "deleted_at"          TIMESTAMPTZ,
  "created_at"          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "updated_at"          TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT "candidates_pkey"       PRIMARY KEY ("id"),
  CONSTRAINT "candidates_email_key"  UNIQUE ("email"),
  CONSTRAINT "candidates_yoe_check"  CHECK ("years_of_experience" >= 0 AND "years_of_experience" <= 50)
);

CREATE INDEX "candidate_email_idx"            ON "candidates"("email");
CREATE INDEX "candidate_status_deleted_idx"   ON "candidates"("status", "deleted_at");
CREATE INDEX "candidate_job_role_deleted_idx" ON "candidates"("job_role", "deleted_at");
-- Trigram GIN index for fuzzy name search (requires pg_trgm)
CREATE INDEX "candidate_name_trgm_idx"        ON "candidates" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "candidate_email_trgm_idx"       ON "candidates" USING GIN ("email" gin_trgm_ops);

-- ─── SKILLS ───────────────────────────────────────────────────────────────────

CREATE TABLE "skills" (
  "id"         UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "name"       VARCHAR(100) NOT NULL,
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "skills_pkey"      PRIMARY KEY ("id"),
  CONSTRAINT "skills_name_key"  UNIQUE ("name")
);

CREATE TABLE "candidate_skills" (
  "id"           UUID        NOT NULL DEFAULT uuid_generate_v4(),
  "candidate_id" UUID        NOT NULL,
  "skill_id"     UUID        NOT NULL,
  "created_at"   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "candidate_skills_pkey"                PRIMARY KEY ("id"),
  CONSTRAINT "candidate_skills_unique"              UNIQUE ("candidate_id", "skill_id"),
  CONSTRAINT "candidate_skills_candidate_id_fkey"   FOREIGN KEY ("candidate_id")
      REFERENCES "candidates"("id") ON DELETE CASCADE,
  CONSTRAINT "candidate_skills_skill_id_fkey"       FOREIGN KEY ("skill_id")
      REFERENCES "skills"("id") ON DELETE CASCADE
);

CREATE INDEX "candidate_skill_candidate_idx" ON "candidate_skills"("candidate_id");
CREATE INDEX "candidate_skill_skill_idx"     ON "candidate_skills"("skill_id");

-- ─── INTERVIEWS ───────────────────────────────────────────────────────────────

CREATE TABLE "interviews" (
  "id"                     UUID              NOT NULL DEFAULT uuid_generate_v4(),
  "legacy_mongo_id"        VARCHAR(24)       UNIQUE,
  "tenant_id"              UUID,
  "organization_id"        UUID,
  "candidate_id"           UUID              NOT NULL,
  "teams_meeting_id"       VARCHAR(500)      UNIQUE,
  "meeting_join_url"       TEXT,
  -- Canonical meeting key extracted from joinWebUrl: e.g. "19:meeting_{uuid}@thread.v2"
  -- Used for fast indexed lookups from Graph callRecord webhooks (no regex needed)
  "normalized_meeting_key" VARCHAR(300)      UNIQUE,
  "meeting_provider"       "MeetingProvider" NOT NULL DEFAULT 'TEAMS',
  "organizer_email"        VARCHAR(255)      NOT NULL,
  "interviewer_email"      VARCHAR(255),
  "scheduled_time"         TIMESTAMPTZ       NOT NULL,
  "duration_minutes"       INTEGER           NOT NULL DEFAULT 60,
  "status"                 "InterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
  "created_by"             VARCHAR(255),
  "updated_by"             VARCHAR(255),
  "deleted_at"             TIMESTAMPTZ,
  "created_at"             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  "updated_at"             TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  CONSTRAINT "interviews_pkey"              PRIMARY KEY ("id"),
  -- ON DELETE RESTRICT: Cannot delete a candidate who has interviews
  CONSTRAINT "interviews_candidate_id_fkey" FOREIGN KEY ("candidate_id")
      REFERENCES "candidates"("id") ON DELETE RESTRICT,
  CONSTRAINT "interviews_duration_check"    CHECK ("duration_minutes" >= 15 AND "duration_minutes" <= 480)
);

CREATE INDEX "interview_candidate_deleted_idx"  ON "interviews"("candidate_id", "deleted_at");
CREATE INDEX "interview_candidate_schedule_idx" ON "interviews"("candidate_id", "scheduled_time" DESC);
CREATE INDEX "interview_status_schedule_idx"    ON "interviews"("status", "scheduled_time" DESC, "deleted_at");
CREATE INDEX "interview_meeting_key_idx"        ON "interviews"("normalized_meeting_key");

-- ─── INTERVIEW ASSETS ─────────────────────────────────────────────────────────

CREATE TABLE "interview_assets" (
  "id"                UUID          NOT NULL DEFAULT uuid_generate_v4(),
  "interview_id"      UUID          NOT NULL,
  "candidate_id"      UUID          NOT NULL,
  "tenant_id"         UUID,
  -- S3 object keys only. Presigned URLs are generated dynamically in the controller layer.
  "recording_s3_key"  TEXT,
  "recording_status"  "AssetStatus" NOT NULL DEFAULT 'PENDING',
  "transcript_s3_key" TEXT,
  "transcript_status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
  "logs"              JSONB         NOT NULL DEFAULT '[]',
  "created_by"        VARCHAR(255),
  "updated_by"        VARCHAR(255),
  "deleted_at"        TIMESTAMPTZ,
  "created_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "updated_at"        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT "interview_assets_pkey"             PRIMARY KEY ("id"),
  CONSTRAINT "interview_assets_interview_id_key" UNIQUE ("interview_id"),
  -- ON DELETE CASCADE: Deleting an interview removes its asset record
  CONSTRAINT "interview_assets_interview_id_fkey" FOREIGN KEY ("interview_id")
      REFERENCES "interviews"("id") ON DELETE CASCADE,
  CONSTRAINT "interview_assets_candidate_id_fkey" FOREIGN KEY ("candidate_id")
      REFERENCES "candidates"("id") ON DELETE RESTRICT
);

CREATE INDEX "asset_interview_idx"  ON "interview_assets"("interview_id");
CREATE INDEX "asset_candidate_idx"  ON "interview_assets"("candidate_id");

-- ─── GRAPH SUBSCRIPTIONS ──────────────────────────────────────────────────────

CREATE TABLE "graph_subscriptions" (
  "id"                   UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"            UUID,
  "subscription_id"      VARCHAR(100) NOT NULL,
  "expiration_date_time" TIMESTAMPTZ  NOT NULL,
  "client_state"         VARCHAR(255) NOT NULL,
  "creator_id"           VARCHAR(255),
  "notification_url"     TEXT         NOT NULL,
  "resource"             VARCHAR(500) NOT NULL,
  "change_type"          VARCHAR(100) NOT NULL,
  "is_active"            BOOLEAN      NOT NULL DEFAULT true,
  "renewed_at"           TIMESTAMPTZ,
  "created_by"           VARCHAR(255),
  "created_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "updated_at"           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "graph_subscriptions_pkey"              PRIMARY KEY ("id"),
  CONSTRAINT "graph_subscriptions_sub_id_key"        UNIQUE ("subscription_id")
);

CREATE INDEX "subscription_active_expiry_idx" ON "graph_subscriptions"("is_active", "expiration_date_time");
CREATE INDEX "subscription_id_idx"            ON "graph_subscriptions"("subscription_id");

-- ─── WEBHOOK EVENTS ───────────────────────────────────────────────────────────

CREATE TABLE "webhook_events" (
  "id"              UUID           NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"       UUID,
  "change_id"       VARCHAR(300)   NOT NULL,
  "subscription_id" VARCHAR(100)   NOT NULL,
  "resource"        VARCHAR(500)   NOT NULL,
  "change_type"     VARCHAR(100)   NOT NULL,
  "resource_data"   JSONB,
  "raw_payload"     JSONB,
  "status"          "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "error_message"   TEXT,
  "created_by"      VARCHAR(255),
  "created_at"      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  "updated_at"      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  CONSTRAINT "webhook_events_pkey"         PRIMARY KEY ("id"),
  CONSTRAINT "webhook_events_change_id_key" UNIQUE ("change_id")
);

CREATE INDEX "webhook_change_id_idx"      ON "webhook_events"("change_id");
CREATE INDEX "webhook_subscription_id_idx" ON "webhook_events"("subscription_id");
CREATE INDEX "webhook_status_idx"         ON "webhook_events"("status");
CREATE INDEX "webhook_created_at_idx"     ON "webhook_events"("created_at" DESC);

-- ─── OUTBOX EVENTS ────────────────────────────────────────────────────────────
-- Transactional Outbox Pattern:
--   Write to this table in the SAME transaction as the business DB write.
--   A background poller reads PENDING rows and publishes to SQS.
--   Prevents lost events if the process crashes between DB write and SQS publish.

CREATE TABLE "outbox_events" (
  "id"           UUID          NOT NULL DEFAULT uuid_generate_v4(),
  "event_type"   VARCHAR(100)  NOT NULL,
  "payload"      JSONB         NOT NULL,
  "status"       "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "retry_count"  INTEGER       NOT NULL DEFAULT 0,
  "error"        TEXT,
  "created_at"   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  "processed_at" TIMESTAMPTZ,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "outbox_pending_idx" ON "outbox_events"("status", "created_at" ASC)
  WHERE "status" = 'PENDING';

-- ─── AUDIT LOGS ───────────────────────────────────────────────────────────────

CREATE TABLE "audit_logs" (
  "id"         UUID         NOT NULL DEFAULT uuid_generate_v4(),
  "tenant_id"  UUID,
  "entity"     VARCHAR(100) NOT NULL,
  "entity_id"  UUID         NOT NULL,
  "action"     VARCHAR(100) NOT NULL,
  "actor"      VARCHAR(255) NOT NULL,
  "payload"    JSONB,
  "ip_address" VARCHAR(45),
  "created_at" TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "audit_entity_idx"     ON "audit_logs"("entity", "entity_id");
CREATE INDEX "audit_actor_idx"      ON "audit_logs"("actor");
CREATE INDEX "audit_created_at_idx" ON "audit_logs"("created_at" DESC);

-- ─── UPDATED_AT TRIGGERS ──────────────────────────────────────────────────────
-- Automatically set updated_at on every UPDATE for relevant tables

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_candidates
  BEFORE UPDATE ON "candidates"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_interviews
  BEFORE UPDATE ON "interviews"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_interview_assets
  BEFORE UPDATE ON "interview_assets"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_graph_subscriptions
  BEFORE UPDATE ON "graph_subscriptions"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_webhook_events
  BEFORE UPDATE ON "webhook_events"
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
