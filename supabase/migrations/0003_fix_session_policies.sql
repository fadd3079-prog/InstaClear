CREATE TABLE IF NOT EXISTS audit_sessions (
    session_id TEXT PRIMARY KEY,
    device_identifier TEXT,
    session_alias TEXT,
    security_key_hash TEXT NOT NULL,
    total_targets INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_active_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS unfollow_targets (
    target_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL REFERENCES audit_sessions(session_id) ON DELETE CASCADE,
    ig_username TEXT NOT NULL,
    source_category VARCHAR(50) DEFAULT 'NOT_FOLLOWING_BACK',
    action_status VARCHAR(50) DEFAULT 'WAITING',
    executed_at TIMESTAMPTZ,
    CONSTRAINT unique_session_target UNIQUE (session_id, ig_username)
);

CREATE INDEX IF NOT EXISTS idx_unfollow_targets_session_id ON unfollow_targets (session_id);

ALTER TABLE audit_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE unfollow_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous select audit_sessions" ON audit_sessions;
DROP POLICY IF EXISTS "Allow anonymous insert audit_sessions" ON audit_sessions;
DROP POLICY IF EXISTS "Allow anonymous update audit_sessions" ON audit_sessions;
DROP POLICY IF EXISTS "Allow anonymous delete audit_sessions" ON audit_sessions;

DROP POLICY IF EXISTS "Allow anonymous select unfollow_targets" ON unfollow_targets;
DROP POLICY IF EXISTS "Allow anonymous insert unfollow_targets" ON unfollow_targets;
DROP POLICY IF EXISTS "Allow anonymous update unfollow_targets" ON unfollow_targets;
DROP POLICY IF EXISTS "Allow anonymous delete unfollow_targets" ON unfollow_targets;

CREATE POLICY "Allow anonymous select audit_sessions" ON audit_sessions FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert audit_sessions" ON audit_sessions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update audit_sessions" ON audit_sessions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete audit_sessions" ON audit_sessions FOR DELETE TO anon USING (true);

CREATE POLICY "Allow anonymous select unfollow_targets" ON unfollow_targets FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anonymous insert unfollow_targets" ON unfollow_targets FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anonymous update unfollow_targets" ON unfollow_targets FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Allow anonymous delete unfollow_targets" ON unfollow_targets FOR DELETE TO anon USING (true);
