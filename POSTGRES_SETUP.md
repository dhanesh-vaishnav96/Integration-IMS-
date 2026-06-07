# ==========================================
# Phase 1 — PostgreSQL Setup Guide
# ==========================================

## STEP 1: Install PostgreSQL Locally (Windows)

If PostgreSQL is NOT installed, choose one of these methods:

### Option A: PostgreSQL Installer (Recommended)
1. Download from: https://www.postgresql.org/download/windows/
2. Run installer, set password for `postgres` user (e.g., `password`)
3. Default port: 5432
4. After install, verify: open pgAdmin or run `psql --version` in a new terminal

### Option B: Docker Desktop (if installing Docker)
```powershell
docker run -d `
  --name interview_os_pg `
  -e POSTGRES_PASSWORD=password `
  -e POSTGRES_DB=interview_os `
  -p 5432:5432 `
  postgres:16-alpine
```

---

## STEP 2: Create the Database

Open pgAdmin or psql and run:

```sql
CREATE DATABASE interview_os;
```

Or via psql command line:
```powershell
psql -U postgres -c "CREATE DATABASE interview_os;"
```

---

## STEP 3: Configure .env

Open `backend/.env` and set:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/interview_os?schema=public
DATABASE_READ_URL=postgresql://postgres:password@localhost:5432/interview_os?schema=public
DB_PROVIDER=postgres
```

---

## STEP 4: Run Extensions + Schema Migration

```powershell
cd "d:\Z2 Graph API Project\backend"

# Step 4a: Apply PostgreSQL extensions (requires superuser)
psql -U postgres -d interview_os -f "prisma\migrations\0001_extensions\migration.sql"

# Step 4b: Push Prisma schema (creates all tables, indexes, constraints)
npx prisma db push

# Step 4c: Generate Prisma client
npx prisma generate

# Step 4d: Apply seed migration (default tenant)
psql -U postgres -d interview_os -f "prisma\migrations\0003_seed_default_tenant\migration.sql"
```

---

## STEP 5: Verify Schema

```powershell
# Open Prisma Studio (browser-based DB explorer)
npx prisma studio
```

Expected: Browser opens at http://localhost:5555 showing all 10 tables.

---

## STEP 6: AWS RDS Setup (Staging/Production)

### 6a. Create RDS Instance (AWS Console)
1. Go to: AWS Console → RDS → Create database
2. Engine: **PostgreSQL 16**
3. Template: **Production** (enables Multi-AZ)
4. Instance class: `db.t3.medium` (staging) / `db.r6g.large` (production)
5. Storage: 20GB SSD (autoscaling enabled to 100GB)
6. DB name: `interview_os`
7. Master username: `interviewos_admin`
8. **VPC**: Select your application VPC
9. **Subnet group**: Private subnets only (NO public access)
10. **Public access**: NO
11. **VPC security group**: Create new `rds-sg`
12. Backup retention: 7 days

### 6b. Configure Security Group
In `rds-sg` inbound rules, add:
| Type       | Port | Source           |
|------------|------|------------------|
| PostgreSQL | 5432 | app-sg (your backend EC2/ECS security group ID) |

NO other inbound rules. The database must not be reachable from the internet.

### 6c. Enable Extensions on RDS
RDS PostgreSQL allows extensions via parameter groups:

```sql
-- Connect via your bastion host or App server:
psql -h {rds-endpoint} -U interviewos_admin -d interview_os

-- Then run:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 6d. Connection Pooling (RDS Proxy)
For production, enable **RDS Proxy** in front of the database:
- RDS Proxy handles connection pooling for Prisma (Prisma creates many connections in containerized environments)
- Update `DATABASE_URL` in your ECS/EC2 environment to use the Proxy endpoint

### 6e. Read Replica
1. In RDS Console → select your DB → Actions → Create read replica
2. After creation, copy the replica endpoint
3. Set in production environment: `DATABASE_READ_URL={replica-endpoint}`

---

## VERIFICATION CHECKLIST

- [ ] `psql -U postgres -c "\\l"` shows `interview_os` database
- [ ] `npx prisma db push` completes without errors  
- [ ] `npx prisma studio` opens and shows 10 tables (candidates, interviews, interview_assets, candidate_skills, skills, graph_subscriptions, webhook_events, outbox_events, audit_logs, tenants, organizations)
- [ ] `SELECT * FROM tenants;` returns 1 row (Default Organization)
- [ ] `SELECT extname FROM pg_extension;` shows both `uuid-ossp` and `pg_trgm`

---

## COMMON FAILURES

| Error | Cause | Fix |
|-------|-------|-----|
| `psql: command not found` | PostgreSQL not in PATH | Add PostgreSQL bin dir to Windows PATH |
| `connection refused` | PostgreSQL not running | Start PostgreSQL service in Windows Services |
| `role "postgres" does not exist` | Custom install username | Update DATABASE_URL username |
| `extension "uuid-ossp" does not exist` | Extension not created | Run 0001_extensions migration first |
| `P1010: User postgres was denied access` | Wrong password | Check password in DATABASE_URL |
