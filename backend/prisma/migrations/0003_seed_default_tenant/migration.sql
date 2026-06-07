-- =============================================================================
-- Seed: 0003_seed_default_tenant
-- Purpose: Creates the default tenant and organization for single-tenant
--          deployments. Required before inserting candidates/interviews.
-- =============================================================================

INSERT INTO "tenants" ("id", "name", "domain", "is_active")
VALUES (
  uuid_generate_v4(),
  'Default Organization',
  'default.local',
  true
)
ON CONFLICT ("domain") DO NOTHING;

INSERT INTO "organizations" ("id", "tenant_id", "name")
SELECT
  uuid_generate_v4(),
  t."id",
  'Engineering'
FROM "tenants" t
WHERE t."domain" = 'default.local'
ON CONFLICT DO NOTHING;
