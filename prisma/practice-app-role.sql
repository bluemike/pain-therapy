-- Database role of the practice app (iteration 12, design D1). Run by prisma/practice-app-role.mjs in the migration
-- job after `prisma migrate deploy`. Idempotent: creates the role if missing and grants data access to all tables.
-- The role is not the table owner and has no BYPASSRLS, so row-level security (migration 20261119090100) limits it to
-- the practice in app.practice_id. Platform functions and jobs that span practices use the owner (DATABASE_ADMIN_URL).
-- The password comes from the session setting pain_therapy.practice_app_password (PRACTICE_APP_DB_PASSWORD).
DO $$
DECLARE
  pw text := current_setting('pain_therapy.practice_app_password', true);
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'practice_app') THEN
    CREATE ROLE practice_app NOLOGIN;
  END IF;
  IF pw IS NOT NULL AND pw <> '' THEN
    EXECUTE format('ALTER ROLE practice_app WITH LOGIN PASSWORD %L', pw);
  END IF;
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO practice_app', current_database());
  GRANT USAGE ON SCHEMA public TO practice_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO practice_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO practice_app;
  -- Migration history stays with the owner
  REVOKE ALL ON "_prisma_migrations" FROM practice_app;
END
$$;
