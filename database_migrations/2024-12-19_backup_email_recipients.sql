-- Create backup_email_recipients table for managing backup email recipients
CREATE TABLE backup_email_recipients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255),
  role VARCHAR(100) DEFAULT 'recipient',
  is_active BOOLEAN DEFAULT true,
  added_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_backup_email_recipients_email ON backup_email_recipients(email);
CREATE INDEX idx_backup_email_recipients_active ON backup_email_recipients(is_active);
CREATE INDEX idx_backup_email_recipients_added_by ON backup_email_recipients(added_by);

-- Enable Row Level Security (RLS)
ALTER TABLE backup_email_recipients ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Only admins can view, add, update, and delete backup email recipients
CREATE POLICY "Admins can view backup email recipients" ON backup_email_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert backup email recipients" ON backup_email_recipients
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can update backup email recipients" ON backup_email_recipients
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete backup email recipients" ON backup_email_recipients
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid() AND u.role = 'admin'
    )
  );

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_backup_email_recipients_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_backup_email_recipients_updated_at
  BEFORE UPDATE ON backup_email_recipients
  FOR EACH ROW
  EXECUTE FUNCTION update_backup_email_recipients_updated_at();

-- Insert some sample backup email recipients (optional)
-- INSERT INTO backup_email_recipients (email, name, role) VALUES
-- ('admin@turnkeyafrica.com', 'System Administrator', 'admin'),
-- ('it@turnkeyafrica.com', 'IT Department', 'department_officer');
