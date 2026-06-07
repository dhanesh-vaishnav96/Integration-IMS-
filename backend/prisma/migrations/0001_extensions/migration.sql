-- =============================================================================
-- Migration: 0001_extensions
-- Purpose:   Enable required PostgreSQL extensions before schema creation.
--            Must run BEFORE the main schema migration.
--            Requires superuser or rds_superuser role on AWS RDS.
-- =============================================================================

-- UUID generation (used by ALL tables as default PK strategy)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Trigram similarity index for candidate name/email search
-- Enables queries like: WHERE name % 'John' and GIN indexes for ILIKE
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
