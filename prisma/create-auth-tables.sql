-- Manual SQL to create authentication tables in Supabase
-- This creates only the auth_* tables without touching existing backend tables
-- Execute this in Supabase SQL Editor

-- 1. Create auth_users table
CREATE TABLE IF NOT EXISTS auth_users (
    id TEXT PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    email_verified TIMESTAMP,
    image TEXT,
    tier TEXT NOT NULL DEFAULT 'free',
    approved BOOLEAN NOT NULL DEFAULT false,
    approved_at TIMESTAMP,
    approved_by TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 2. Create auth_accounts table
CREATE TABLE IF NOT EXISTS auth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    refresh_token TEXT,
    access_token TEXT,
    expires_at INTEGER,
    token_type TEXT,
    scope TEXT,
    id_token TEXT,
    session_state TEXT,
    CONSTRAINT auth_accounts_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth_users(id)
        ON DELETE CASCADE,
    UNIQUE(provider, provider_account_id)
);

-- 3. Create auth_sessions table
CREATE TABLE IF NOT EXISTS auth_sessions (
    id TEXT PRIMARY KEY,
    session_token TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    expires TIMESTAMP NOT NULL,
    CONSTRAINT auth_sessions_user_id_fkey
        FOREIGN KEY (user_id)
        REFERENCES auth_users(id)
        ON DELETE CASCADE
);

-- 4. Create auth_verification_tokens table
CREATE TABLE IF NOT EXISTS auth_verification_tokens (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TIMESTAMP NOT NULL,
    UNIQUE(identifier, token)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS auth_accounts_user_id_idx ON auth_accounts(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_user_id_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_users_email_idx ON auth_users(email);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger to auto-update updated_at on auth_users
CREATE TRIGGER update_auth_users_updated_at
    BEFORE UPDATE ON auth_users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verify tables were created
SELECT
    schemaname,
    tablename
FROM pg_tables
WHERE tablename LIKE 'auth_%'
ORDER BY tablename;
