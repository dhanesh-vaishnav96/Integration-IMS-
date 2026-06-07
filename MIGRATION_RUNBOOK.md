# MongoDB → PostgreSQL Migration Runbook

## Pre-Migration

- [ ] Verify PostgreSQL RDS instance is running and accessible from app server
- [ ] `DATABASE_URL` and `DATABASE_READ_URL` are configured in staging `.env`
- [ ] MongoDB is still running (DO NOT shut it down)
- [ ] `DB_PROVIDER=mongo` in staging (production stays on Mongo until validated)
- [ ] Take a MongoDB Atlas snapshot or `mongodump` backup right now

## Stage 1: Schema Deployment (Zero Downtime)

```bash
# Apply PG extensions
psql $DATABASE_URL -f prisma/migrations/0001_extensions/migration.sql

# Apply schema
npm run db:push

# Seed default tenant
psql $DATABASE_URL -f prisma/migrations/0003_seed_default_tenant/migration.sql

# Generate Prisma client
npm run db:generate

# Verify schema
node scripts/verify_postgres_migration.js
```

Expected: All checks PASS except row-count checks (0 rows until ETL).

## Stage 2: ETL Data Migration

```bash
# Dry run first — reads Mongo, prints counts, writes NOTHING to Postgres
node scripts/mongo_to_postgres_etl.js --dry-run

# Real ETL run (safe to re-run — uses upsert + checkpoint file)
node scripts/mongo_to_postgres_etl.js

# Validate row counts match
node scripts/mongo_to_postgres_etl.js --validate-only
```

Expected output: All table counts ✅ match between MongoDB and PostgreSQL.

## Stage 3: Staging Switch

```bash
# In staging .env, change:
DB_PROVIDER=postgres

# Restart backend
pm2 restart backend
# OR
docker-compose restart backend
```

Expected logs:
```
[DatabaseProvider] Active provider: POSTGRES
[DB] ✅ PostgreSQL connected (write client).
🖳️  Database Provider: POSTGRES
```

Run full staging E2E test suite:
```bash
npm test
```

## Stage 4: Production Cutover (Maintenance Window)

> [!CAUTION]
> Perform this during off-peak hours. Set up a brief maintenance page.

```bash
# 1. Put app into maintenance mode (stop accepting new interviews)
# 2. Take final MongoDB backup
mongodump --uri=$MONGO_URI --out=final_backup_$(date +%Y%m%d)

# 3. Run final ETL sync (catches any records created since Stage 2)
node scripts/mongo_to_postgres_etl.js

# 4. Validate
node scripts/mongo_to_postgres_etl.js --validate-only

# 5. Switch production
DB_PROVIDER=postgres

# 6. Deploy
pm2 restart backend

# 7. Smoke test
curl https://api.yourdomain.com/api/v1/health
```

## Rollback Procedure

```bash
# Option A: Instant (< 2 mins) — revert env var
DB_PROVIDER=mongo
pm2 restart backend
# MongoDB is untouched — data is still there

# Option B: Rollback ETL data from Postgres
node scripts/mongo_to_postgres_etl.js --rollback
# This truncates all Postgres tables. MongoDB is unaffected.
```

## Post-Migration (48h Monitoring Window)

- [ ] Monitor Grafana: `db_query_duration_ms` — should be similar or better than Mongo
- [ ] Monitor CloudWatch: RDS CPU, connections, IOPS
- [ ] Monitor SQS DLQ: size should remain 0
- [ ] Monitor app logs: no `prisma error` messages
- [ ] Confirm dashboard loads correctly for all candidates
- [ ] After 48h confidence: archive MongoDB collection, disable MONGO_URI

## Known Risks

| Risk | Mitigation |
|------|-----------|
| ETL runs while new MongoDB writes occur | ETL uses `upsert` — safe to re-run. Final sync before cutover catches any new records |
| Teams URL key extraction fails for some meetings | Legacy `findByJoinUrl` (startsWith) fallback remains active |
| Prisma connection pool exhaustion under load | RDS Proxy configured in production to handle pooling |
| Missing `uuid-ossp` extension on RDS | Confirmed in Stage 1 verification script |
