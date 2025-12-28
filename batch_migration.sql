-- Batch API Migration
-- Adds batch_jobs and batch_items tables for Gemini Batch API support

-- Batch Jobs table
CREATE TABLE IF NOT EXISTS batch_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id),
    project_id TEXT REFERENCES jobs(id),
    gemini_batch_name TEXT,
    status TEXT DEFAULT 'pending',
    model TEXT,
    display_name TEXT,
    request_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    retry_count INTEGER DEFAULT 0,
    last_polled_at INTEGER,
    created_at INTEGER,
    submitted_at INTEGER,
    completed_at INTEGER
);

-- Batch Items table
CREATE TABLE IF NOT EXISTS batch_items (
    id TEXT PRIMARY KEY,
    batch_id TEXT REFERENCES batch_jobs(id),
    image_id TEXT REFERENCES images(id),
    request_key TEXT UNIQUE,
    status TEXT DEFAULT 'pending',
    result_data TEXT,
    error_msg TEXT,
    created_at INTEGER
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_batch_jobs_user ON batch_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_batch_jobs_status ON batch_jobs(status);
CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id);
