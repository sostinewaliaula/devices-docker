# Database Migrations

This directory contains SQL migration files for the Assets Management System database.

## Migration Files

### `migrations/create_backups_table.sql`
Creates the backups table for storing system backups with proper security policies.

**What it creates:**
- `backups` table with JSONB storage for backup data
- Indexes for efficient querying
- Row Level Security (RLS) policies
- Admin-only access controls

**To apply:**
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Copy and paste the contents of `create_backups_table.sql`
4. Execute the SQL

## Table Structure

### Backups Table
```sql
backups (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timestamp TIMESTAMP WITH TIME ZONE,
    version VARCHAR(50),
    metadata JSONB,
    backup_data JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMP WITH TIME ZONE
)
```

## Security Policies

The backups table includes Row Level Security (RLS) with the following policies:

- **Users can view their own backups**: Non-admins can only see backups they created
- **Admins can view all backups**: Admins can see all backups in the system
- **Only admins can create/update/delete backups**: Ensures only administrators can manage backups

## Usage

After running the migration:

1. **Verify table creation:**
   ```sql
   SELECT * FROM backups LIMIT 1;
   ```

2. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'backups';
   ```

3. **Test admin access:**
   ```sql
   -- This should work for admin users
   INSERT INTO backups (name, metadata, backup_data) 
   VALUES ('Test Backup', '{}', '{}');
   ```

## Backup System Features

Once the table is created, the backup system provides:

- ✅ Create backups with custom names and descriptions
- ✅ Store backups securely in the database
- ✅ Download backups as JSON files
- ✅ Restore from stored backups
- ✅ Schedule automatic backups
- ✅ Manage backup retention

## Troubleshooting

### Common Issues

1. **"Permission denied" errors:**
   - Ensure you're logged in as an admin user
   - Check that RLS policies are properly applied

2. **"Table doesn't exist" errors:**
   - Verify the migration was executed successfully
   - Check the table name spelling

3. **"JSONB type not supported":**
   - Ensure you're using PostgreSQL 9.4+ or Supabase
   - JSONB is required for the backup data storage

### Verification Commands

```sql
-- Check if table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'backups'
);

-- Check table structure
\d backups

-- Check RLS status
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'backups';

-- Check policies
SELECT * FROM pg_policies WHERE tablename = 'backups';
```

## Next Steps

After applying the migration:

1. Restart your application
2. Navigate to Admin → Backup Management
3. Test creating a backup
4. Verify the backup appears in the stored backups list

For more information, see the [Backup System Guide](../../BACKUP_SYSTEM_GUIDE.md).
