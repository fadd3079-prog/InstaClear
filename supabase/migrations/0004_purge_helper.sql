-- Migration 0004: Ensure anonymous DELETE policies exist for all session tables

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'unfollow_logs') THEN
        EXECUTE 'ALTER TABLE unfollow_logs ENABLE ROW LEVEL SECURITY;';
        EXECUTE 'DROP POLICY IF EXISTS "Allow anonymous delete unfollow_logs" ON unfollow_logs;';
        EXECUTE 'CREATE POLICY "Allow anonymous delete unfollow_logs" ON unfollow_logs FOR DELETE TO anon USING (true);';
    END IF;
END $$;

DROP POLICY IF EXISTS "Allow anonymous delete audit_sessions" ON audit_sessions;
CREATE POLICY "Allow anonymous delete audit_sessions"
    ON audit_sessions FOR DELETE TO anon USING (true);

DROP POLICY IF EXISTS "Allow anonymous delete unfollow_targets" ON unfollow_targets;
CREATE POLICY "Allow anonymous delete unfollow_targets"
    ON unfollow_targets FOR DELETE TO anon USING (true);
