// Legacy types and interfaces for compatibility
// This file provides type definitions without the actual Supabase client

// Database types (moved from old supabase.ts for compatibility)
export interface Department {
  id: string
  name: string
  description: string
  location: string
  user_count: number
  asset_count: number
  asset_value: string
  manager: string
  manager_id: string | null
  parent_id: string | null
  created_at: string
  updated_at: string
}

export interface Asset {
  id: string
  name: string
  type: string
  category: string
  manufacturer: string
  model: string
  serial_number: string
  purchase_date: string
  purchase_price: number
  current_value: number
  status: string
  condition: string
  location: string
  assigned_to: string | null
  department_id: string | null
  warranty_expiry: string | null
  last_maintenance: string | null
  notes: string | null
  custom_attributes?: Record<string, any>
  created_at: string
  updated_at: string
}

export interface AssetAssignmentHistoryEntry {
  id: string
  asset_id: string
  user_id: string | null
  asset_name?: string | null
  asset_serial?: string | null
  user_name?: string | null
  user_email?: string | null
  assigned_by: string | null
  assigned_by_name?: string | null
  department_id: string | null
  department_name?: string | null
  location: string | null
  assignment_type: string
  assigned_at: string | null
  returned_at: string | null
  condition_on_assign: string | null
  condition_on_return: string | null
  notes: string | null
  created_at?: string
  updated_at?: string
}

export interface AssetIssueEventEntry {
  id: string
  asset_id: string
  issue_id: string
  issue_title?: string
  issue_priority?: string
  current_issue_status?: string
  event_type: string
  status: string | null
  summary: string
  details: string | null
  changed_by: string | null
  occurred_at: string | null
  created_at?: string
}

export interface AssetHistoryPayload {
  asset: Asset
  assignments: AssetAssignmentHistoryEntry[]
  issueEvents: AssetIssueEventEntry[]
}

export interface AssetHistoryEntry {
  history_id: string
  asset_id: string
  asset_name: string | null
  asset_serial: string | null
  entry_category: 'assignment' | 'issue'
  event_type: string
  issue_id: string | null
  issue_title: string | null
  issue_priority: string | null
  owner_id: string | null
  owner_name: string | null
  department_name: string | null
  actor_id: string | null
  actor_name: string | null
  notes: string | null
  occurred_at: string | null
  condition_on_assign: string | null
  condition_on_return: string | null
  status: string | null
}

export interface AssetHistorySummary {
  id: string
  name: string
  serial_number: string | null
  type: string | null
  location: string | null
  status: string | null
  assignment_count: number
  active_assignment_count: number
  issue_count: number
  open_issue_count: number
  issue_event_count: number
  last_activity: string | null
}

export interface UserHistorySummary {
  id: string
  name: string
  email: string
  role: string
  position: string | null
  department_id: string | null
  department_name: string | null
  assignment_count: number
  active_assignment_count: number
  issues_reported_count: number
  issues_assigned_count: number
  asset_request_count: number
  last_activity: string | null
}

export interface UserHistoryDetail {
  user: User & { department_name?: string | null }
  assignments: AssetAssignmentHistoryEntry[]
  reportedIssues: Issue[]
  assignedIssues: Issue[]
  assetRequests: AssetRequest[]
  issueEvents: AssetIssueEventEntry[]
}

export interface User {
  id: string
  email: string
  name: string
  role: string
  department_id: string | null
  phone: string | null
  position: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Issue {
  id: string
  title: string
  description: string
  status: string
  priority: string
  category: string | null
  reported_by: string
  assigned_to: string | null
  asset_id: string | null
  department_id: string | null
  estimated_resolution_date: string | null
  actual_resolution_date: string | null
  comment_count: number
  estimated_cost: number | null
  created_at: string
  updated_at: string
}

export interface IssueComment {
  id: string
  issue_id: string
  user_id: string
  user_name: string
  content: string
  created_at: string
  updated_at: string
}

export interface AssetMaintenance {
  id: string
  asset_id: string
  maintenance_type: string
  description: string | null
  performed_by: string | null
  performed_date: string
  cost: number | null
  next_maintenance_date: string | null
  created_at: string
}

export interface NotificationRecord {
  id: string
  user_id: string
  title: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info'
  read: boolean
  created_at: string
}

export interface AuditLog {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  details: any
  created_at: string
}

export interface AssetRequest {
  id: string
  user_id: string
  asset_name: string
  asset_type: string
  category: string
  reason: string
  priority: string
  status: string
  requested_date: string
  approved_date: string | null
  approved_by: string | null
  notes: string | null
  estimated_cost: number | null
  created_at: string
  updated_at: string
}

export interface Position {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssetType {
  id: string
  name: string
  description: string | null
  parameters_schema: any[] | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssetRequestType {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface IssueCategory {
  id: string
  name: string
  description: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface DropdownOption {
  id: number
  type: string
  value: string
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface UserNotificationPreference {
  id: string
  user_id: string
  email_notifications: boolean
  notification_types: string[]
  email_frequency: 'immediate' | 'daily' | 'weekly'
  created_at: string
  updated_at: string
}

// Legacy supabase client mock (for compatibility)
export const supabase = {
  auth: {
    signOut: () => Promise.resolve({ error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
  },
  from: () => ({
    select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }),
    insert: () => Promise.resolve({ data: null, error: null }),
    update: () => ({ eq: () => Promise.resolve({ data: null, error: null }) }),
    delete: () => ({ eq: () => Promise.resolve({ data: null, error: null }) })
  })
};

// Legacy functions for compatibility
export const checkSupabaseConfig = () => false;
export const checkConnection = () => Promise.resolve(false);
export const reconnectSupabase = () => Promise.resolve(false);
