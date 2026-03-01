const pool = require('./pool');

const TABLES = `
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT,
    google_id TEXT,
    plan TEXT NOT NULL DEFAULT 'free',
    plan_expires_at TIMESTAMPTZ,
    google_access_token_encrypted TEXT,
    google_refresh_token_encrypted TEXT,
    google_token_expiry TIMESTAMPTZ,
    calendar_connected BOOLEAN DEFAULT FALSE,
    onboarding_completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    occupation TEXT,
    peak_energy TEXT,
    challenges TEXT,
    fixed_schedules TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS conversations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    message TEXT NOT NULL,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS tasks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    time_start TEXT,
    time_end TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    source TEXT NOT NULL DEFAULT 'user',
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS token_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    prompt_tokens INTEGER NOT NULL,
    completion_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,
    model TEXT NOT NULL,
    cost_usd NUMERIC(10, 6) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS daily_usage (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date DATE DEFAULT CURRENT_DATE,
    messages_count INTEGER DEFAULT 0,
    tasks_count INTEGER DEFAULT 0,
    plans_generated INTEGER DEFAULT 0,
    reorganizations INTEGER DEFAULT 0,
    UNIQUE(user_id, date)
  );

  CREATE INDEX IF NOT EXISTS idx_conversations_user_date ON conversations(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks(user_id, date);
  CREATE INDEX IF NOT EXISTS idx_token_usage_user ON token_usage(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_daily_usage_user_date ON daily_usage(user_id, date);
`;

async function runMigrations() {
  try {
    await pool.query(TABLES);
    console.log('Database migrations completed successfully');
  } catch (err) {
    console.error('Migration error:', err.message);
    throw err;
  }
}

module.exports = { runMigrations };
