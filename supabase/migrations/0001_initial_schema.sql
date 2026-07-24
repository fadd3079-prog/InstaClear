CREATE TABLE IF NOT EXISTS unfollow_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    device_id UUID NOT NULL,
    target_username TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'UNFOLLOWED',
    executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_device_username UNIQUE (device_id, target_username)
);

CREATE INDEX idx_unfollow_logs_device_id ON unfollow_logs (device_id);

ALTER TABLE unfollow_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anonymous insert"
    ON unfollow_logs
    FOR INSERT
    TO anon
    WITH CHECK (true);

CREATE POLICY "Allow anonymous select by device_id"
    ON unfollow_logs
    FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "Allow anonymous update by device_id"
    ON unfollow_logs
    FOR UPDATE
    TO anon
    USING (true)
    WITH CHECK (true);
