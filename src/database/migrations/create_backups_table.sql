-- Create backups table for storing system backups
CREATE TABLE IF NOT EXISTS backups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    metadata JSONB NOT NULL,
    backup_data JSONB NOT NULL,
    created_by VARCHAR(255) NOT NULL, -- Store email instead of UUID (no foreign key constraint)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on timestamp for efficient querying
CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON backups(timestamp DESC);

-- Create index on created_by for user-specific queries
CREATE INDEX IF NOT EXISTS idx_backups_created_by ON backups(created_by);

-- Add RLS (Row Level Security) policies
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see backups they created (for non-admins)
CREATE POLICY "Users can view their own backups" ON backups
    FOR SELECT USING (auth.jwt() ->> 'email' = created_by);

-- Policy: Admins can view all backups
CREATE POLICY "Admins can view all backups" ON backups
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.jwt() ->> 'email'
            AND users.role = 'admin'
        )
    );

-- Policy: Only admins can create backups
CREATE POLICY "Only admins can create backups" ON backups
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.jwt() ->> 'email'
            AND users.role = 'admin'
        )
    );

-- Policy: Only admins can update backups
CREATE POLICY "Only admins can update backups" ON backups
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.jwt() ->> 'email'
            AND users.role = 'admin'
        )
    );

-- Policy: Only admins can delete backups
CREATE POLICY "Only admins can delete backups" ON backups
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE users.email = auth.jwt() ->> 'email'
            AND users.role = 'admin'
        )
    );
