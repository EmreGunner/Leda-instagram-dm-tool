-- Grant usage on schema to Supabase roles
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant access to all tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant access to all sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Ensure RLS is disabled for main tables to prevent "silent" failures
ALTER TABLE "public"."users" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."workspaces" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."instagram_accounts" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."conversations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."automations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."leads" DISABLE ROW LEVEL SECURITY;
