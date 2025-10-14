-- Initial migration for OmegleRevive
-- This creates the basic tables for the chat application

-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    user1_id VARCHAR NOT NULL,
    user2_id VARCHAR,
    type TEXT NOT NULL,
    interests JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'waiting',
    created_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR NOT NULL,
    sender_id VARCHAR NOT NULL,
    content TEXT NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW()
);

-- Create online_users table
CREATE TABLE IF NOT EXISTS online_users (
    id VARCHAR PRIMARY KEY,
    socket_id VARCHAR NOT NULL,
    interests JSONB DEFAULT '[]'::jsonb,
    is_waiting BOOLEAN DEFAULT false,
    chat_type TEXT,
    last_seen TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_status ON chat_sessions(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_created_at ON chat_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_online_users_is_waiting ON online_users(is_waiting);
CREATE INDEX IF NOT EXISTS idx_online_users_chat_type ON online_users(chat_type);
CREATE INDEX IF NOT EXISTS idx_online_users_last_seen ON online_users(last_seen);

-- Add foreign key constraints
ALTER TABLE messages ADD CONSTRAINT fk_messages_session_id 
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE;
