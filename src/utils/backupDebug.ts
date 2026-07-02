// DEBUG UTILITY FILE - FOR TROUBLESHOOTING ONLY
// This file contains debugging functions for the backup system.
// These functions can be removed in production after the system is working correctly.

import { supabase } from '../lib/supabase';

export async function debugBackupCreation() {
  // console.log('🔍 Starting backup debug process...');

  try {
    // 1. Check if backups table exists
    // console.log('1. Checking if backups table exists...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('backups')
      .select('id')
      .limit(1);

    if (tableError) {
      console.error('❌ Backups table error:', tableError);
      return { success: false, error: 'Table not found or access denied', details: tableError };
    }

    // console.log('✅ Backups table exists and is accessible');

    // 2. Check current user authentication
    // console.log('2. Checking user authentication...');
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('❌ Authentication error:', authError);
      return { success: false, error: 'Authentication failed', details: authError };
    }

    if (!user) {
      console.error('❌ No authenticated user');
      return { success: false, error: 'No authenticated user found' };
    }

    // console.log('✅ User authenticated:', user.email);

    // 3. Check user role
    // console.log('3. Checking user role...');
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('role')
      .eq('email', user.email) // Use email instead of ID to match users
      .maybeSingle(); // Use maybeSingle instead of single to handle no results

    if (userError) {
      console.error('❌ User role check error:', userError);
      return { success: false, error: 'Failed to check user role', details: userError };
    }

    if (!userData) {
      console.error('❌ User not found in users table');
      return {
        success: false,
        error: 'User not found in users table. Please ensure the user is properly registered in the system.',
        details: {
          authUserId: user.id,
          authUserEmail: user.email,
          suggestion: 'The user exists in authentication but not in the users table. This needs to be fixed.'
        }
      };
    }

    // console.log('✅ User role:', userData?.role);

    if (userData?.role !== 'admin') {
      console.error('❌ User is not admin');
      return { success: false, error: 'User must be admin to create backups' };
    }

    // 4. Test data fetching
    // console.log('4. Testing data fetching...');
    const testQueries = [
      supabase.from('assets').select('*', { count: 'exact', head: true }),
      supabase.from('users').select('*', { count: 'exact', head: true }),
      supabase.from('departments').select('*', { count: 'exact', head: true }),
      supabase.from('issues').select('*', { count: 'exact', head: true }),
      supabase.from('asset_requests').select('*', { count: 'exact', head: true }),
      supabase.from('notifications').select('*', { count: 'exact', head: true }),
      supabase.from('user_notification_preferences').select('*', { count: 'exact', head: true })
    ];

    const results = await Promise.all(testQueries);
    const errors = results.filter(r => r.error);

    if (errors.length > 0) {
      console.error('❌ Data fetching errors:', errors);
      return { success: false, error: 'Failed to fetch some data', details: errors };
    }

    // console.log('✅ All data tables accessible');

    // 5. Test backup insertion
    // console.log('5. Testing backup insertion...');
    const testBackup = {
      name: 'Debug Test Backup',
      description: 'Test backup for debugging',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      metadata: {
        totalAssets: 0,
        totalUsers: 0,
        totalIssues: 0,
        backupSize: 100
      },
      backup_data: {
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        name: 'Debug Test Backup',
        description: 'Test backup for debugging',
        tables: {
          assets: [],
          users: [],
          departments: [],
          issues: [],
          asset_requests: [],
          notifications: [],
          user_notification_preferences: []
        },
        metadata: {
          totalAssets: 0,
          totalUsers: 0,
          totalIssues: 0,
          backupSize: 100
        }
      },
      created_by: user.email
    };

    const { data: insertedBackup, error: insertError } = await supabase
      .from('backups')
      .insert(testBackup)
      .select()
      .single();

    if (insertError) {
      console.error('❌ Backup insertion error:', insertError);
      return { success: false, error: 'Failed to insert backup', details: insertError };
    }

    // console.log('✅ Test backup inserted successfully:', insertedBackup.id);

    // 6. Clean up test backup
    // console.log('6. Cleaning up test backup...');
    await supabase
      .from('backups')
      .delete()
      .eq('id', insertedBackup.id);

    // console.log('✅ Test backup cleaned up');

    return {
      success: true,
      message: 'All backup system components are working correctly',
      user: { id: user.id, email: user.email, role: userData?.role }
    };

  } catch (error) {
    console.error('❌ Unexpected error during debug:', error);
    return { success: false, error: 'Unexpected error', details: error };
  }
}

export async function checkBackupTable() {
  try {
    const { data, error } = await supabase
      .from('backups')
      .select('*')
      .limit(5);

    if (error) {
      return { exists: false, error };
    }

    return { exists: true, count: data?.length || 0, data };
  } catch (error) {
    return { exists: false, error };
  }
}

export async function fixUserInTable() {
  try {
    // console.log('🔧 Attempting to fix user in users table...');

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'No authenticated user found' };
    }

    // Check if user already exists in users table
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('email', user.email) // Use email instead of ID
      .maybeSingle();

    if (existingUser) {
      return { success: true, message: 'User already exists in users table' };
    }

    // Insert user into users table
    const { data: newUser, error: insertError } = await supabase
      .from('users')
      .insert({
        email: user.email,
        role: 'admin', // Default to admin for now
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      // console.error('❌ Failed to insert user:', insertError);
      return { success: false, error: 'Failed to create user record', details: insertError };
    }

    // console.log('✅ User created in users table:', newUser);
    return {
      success: true,
      message: 'User successfully added to users table with admin role',
      user: newUser
    };

  } catch (error) {
    console.error('❌ Error fixing user:', error);
    return { success: false, error: 'Failed to fix user', details: error };
  }
}

export async function checkUserMismatch() {
  try {
    // console.log('🔍 Checking for user mismatch...');

    // Get current authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: 'No authenticated user found' };
    }

    // console.log('Current authenticated user:', {
    //   id: user.id,
    //   email: user.email
    // });

    // Check if this user exists in users table
    const { data: userInTable, error: tableError } = await supabase
      .from('users')
      .select('id, email, role, name')
      .eq('email', user.email) // Use email instead of ID
      .maybeSingle();

    if (tableError) {
      return { success: false, error: 'Failed to check users table', details: tableError };
    }

    if (!userInTable) {
      // Check if there's a user with the same email but different ID
      const { data: userWithSameEmail, error: emailError } = await supabase
        .from('users')
        .select('id, email, role, name')
        .eq('email', user.email)
        .maybeSingle();

      if (emailError) {
        return { success: false, error: 'Failed to check users by email', details: emailError };
      }

      if (userWithSameEmail) {
        return {
          success: false,
          error: 'User ID mismatch detected',
          details: {
            authenticatedUser: {
              id: user.id,
              email: user.email
            },
            userInTable: {
              id: userWithSameEmail.id,
              email: userWithSameEmail.email,
              role: userWithSameEmail.role,
              name: userWithSameEmail.name
            },
            suggestion: 'The authenticated user has a different ID than the user in the table. You may need to log in with the correct account or update the user record.'
          }
        };
      } else {
        return {
          success: false,
          error: 'User not found in users table',
          details: {
            authenticatedUser: {
              id: user.id,
              email: user.email
            },
            suggestion: 'The authenticated user does not exist in the users table. You may need to log in with a different account or add this user to the table.'
          }
        };
      }
    }

    return {
      success: true,
      message: 'User found in users table',
      details: {
        authenticatedUser: {
          id: user.id,
          email: user.email
        },
        userInTable: {
          id: userInTable.id,
          email: userInTable.email,
          role: userInTable.role,
          name: userInTable.name
        }
      }
    };

  } catch (error) {
    console.error('❌ Error checking user mismatch:', error);
    return { success: false, error: 'Failed to check user mismatch', details: error };
  }
}
