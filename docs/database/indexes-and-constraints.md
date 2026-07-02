# Indexes & Constraints

## Table of Contents
1. [Introduction](#introduction)
2. [Project Structure](#project-structure)
3. [Core Components](#core-components)
4. [Architecture Overview](#architecture-overview)
5. [Detailed Component Analysis](#detailed-component-analysis)
6. [Dependency Analysis](#dependency-analysis)
7. [Performance Considerations](#performance-considerations)
8. [Troubleshooting Guide](#troubleshooting-guide)
9. [Conclusion](#conclusion)

## Introduction
This document focuses on database indexes, constraints, and performance optimization strategies in the Assets Management System. It catalogs primary keys, foreign keys, unique constraints, and composite indexes across tables, explains indexing strategies for common queries (user lookups, asset searches, issue filtering, department aggregations), documents constraint enforcement and referential integrity rules, and details the trigger-based automatic updates for department statistics. It also covers performance considerations for each index, including query optimization, storage implications, and maintenance overhead.

## Project Structure
The database schema is primarily defined in two SQL files:
- A comprehensive schema with triggers and sample data
- A simplified schema for quick setup and testing

Additional migrations introduce specialized indexes and columns for performance and extensibility.

```mermaid
graph TB
subgraph "Schema Definitions"
S1["backend/database/schema.sql"]
S2["backend/database/schema-simple.sql"]
end
subgraph "Migrations"
M1["2024-09-08_departments_hierarchy.sql"]
M2["2024-09-09_departments_unique_name_per_parent.sql"]
M3["create_asset_request_comments_table.sql"]
M4["add_asset_request_estimated_cost.sql"]
M5["add_issue_estimated_cost.sql"]
M6["create_asset_types_table.sql"]
M7["create_mfa_policy_indexes.sql"]
M8["create_mfa_policy_indexes_1.sql"]
M9["create_mfa_policy_indexes_2.sql"]
M10["create_mfa_policy_indexes_3.sql"]
end
S1 --> M1
S1 --> M2
S2 --> M3
S2 --> M4
S2 --> M5
S2 --> M6
S2 --> M7
S2 --> M8
S2 --> M9
S2 --> M10
```

## Core Components
This section enumerates primary keys, unique constraints, foreign keys, and indexes for each table, and highlights composite indexes where applicable.

- Departments
  - Primary key: id
  - Unique constraints:
    - name (original schema)
    - (name, parent_id) after migration
  - Indexes:
    - idx_departments_name (name)
    - idx_departments_location (location)
    - idx_departments_manager (manager_id)
    - idx_departments_parent (parent_id)
  - Foreign keys:
    - None (self-referencing via parent_id)
  - Notes:
    - Unique constraint on (name, parent_id) prevents duplicate department names under the same parent while allowing duplicates under different parents.

- Users
  - Primary key: id
  - Unique constraints:
    - email
  - Indexes:
    - idx_users_email (email)
    - idx_users_department (department_id)
    - idx_users_role (role)
    - idx_users_active (is_active)
  - Foreign keys:
    - department_id → departments.id (ON DELETE SET NULL)

- Assets
  - Primary key: id
  - Unique constraints:
    - serial_number
  - Indexes:
    - idx_assets_serial (serial_number)
    - idx_assets_department (department_id)
    - idx_assets_assigned (assigned_to)
    - idx_assets_status (status)
    - idx_assets_type (type)
    - idx_assets_category (category)
  - Foreign keys:
    - assigned_to → users.id (ON DELETE SET NULL)
    - department_id → departments.id (ON DELETE SET NULL)

- Issues
  - Primary key: id
  - Indexes:
    - idx_issues_status (status)
    - idx_issues_priority (priority)
    - idx_issues_reported_by (reported_by)
    - idx_issues_assigned_to (assigned_to)
    - idx_issues_asset (asset_id)
    - idx_issues_department (department_id)
  - Foreign keys:
    - reported_by → users.id (ON DELETE CASCADE)
    - assigned_to → users.id (ON DELETE SET NULL)
    - asset_id → assets.id (ON DELETE SET NULL)
    - department_id → departments.id (ON DELETE SET NULL)

- Issue Comments
  - Primary key: id
  - Indexes:
    - idx_issue_comments_issue (issue_id)
    - idx_issue_comments_user (user_id)
    - idx_issue_comments_created (created_at)
  - Foreign keys:
    - issue_id → issues.id (ON DELETE CASCADE)
    - user_id → users.id (ON DELETE CASCADE)

- Asset Maintenance
  - Primary key: id
  - Indexes:
    - idx_maintenance_asset (asset_id)
    - idx_maintenance_date (performed_date)
    - idx_maintenance_type (maintenance_type)
  - Foreign keys:
    - asset_id → assets.id (ON DELETE CASCADE)
    - performed_by → users.id (ON DELETE SET NULL)

- Notifications
  - Primary key: id
  - Indexes:
    - idx_notifications_user (user_id)
    - idx_notifications_read (is_read)
    - idx_notifications_created (created_at)
  - Foreign keys:
    - user_id → users.id (ON DELETE CASCADE)

- Audit Logs
  - Primary key: id
  - Indexes:
    - idx_audit_user (user_id)
    - idx_audit_action (action)
    - idx_audit_entity (entity_type, entity_id)
    - idx_audit_created (created_at)
  - Foreign keys:
    - user_id → users.id (ON DELETE SET NULL)

- Asset Requests
  - Primary key: id
  - Indexes:
    - idx_asset_requests_user (user_id)
    - idx_asset_requests_status (status)
    - idx_asset_requests_priority (priority)
    - idx_asset_requests_date (requested_date)
  - Foreign keys:
    - user_id → users.id (ON DELETE CASCADE)
    - approved_by → users.id (ON DELETE SET NULL)

- Backups
  - Primary key: id
  - Indexes:
    - idx_backups_created_by (created_by)
    - idx_backups_timestamp (timestamp)
  - Foreign keys:
    - created_by → users.id (ON DELETE CASCADE)

- Asset Request Comments (additional table)
  - Primary key: id
  - Indexes:
    - asset_request_id
    - user_id
    - parent_comment_id
  - Foreign keys:
    - asset_request_id → asset_requests.id (ON DELETE CASCADE)
    - user_id → users.id (ON DELETE CASCADE)
    - parent_comment_id → asset_request_comments.id (ON DELETE CASCADE)

- Asset Types (additional table)
  - Primary key: id
  - Unique constraints:
    - name
  - Other columns:
    - parameters_schema JSON
    - is_active
    - created_at, updated_at

- MFA Policies and Compliance (indexes)
  - Indexes:
    - idx_mfa_policies_enabled (enabled)
    - idx_mfa_policies_enforcement (enforcement_level)
    - idx_user_compliance_user (user_id)

## Architecture Overview
The database enforces referential integrity via foreign keys and supports efficient querying through targeted single-column and composite indexes. Triggers maintain summary metrics in the departments table for user and asset statistics.

```mermaid
erDiagram
DEPARTMENTS {
char id PK
varchar name
varchar location
int user_count
int asset_count
varchar asset_value
char manager_id
char parent_id
timestamp created_at
timestamp updated_at
}
USERS {
char id PK
varchar email UK
varchar password_hash
varchar name
enum role
char department_id FK
varchar phone
varchar position
boolean is_active
timestamp last_login
timestamp created_at
timestamp updated_at
}
ASSETS {
char id PK
varchar name
varchar type
varchar category
varchar manufacturer
varchar model
varchar serial_number UK
date purchase_date
decimal purchase_price
decimal current_value
enum status
enum condition
varchar location
char assigned_to FK
char department_id FK
date warranty_expiry
date last_maintenance
text notes
timestamp created_at
timestamp updated_at
}
ISSUES {
char id PK
varchar title
text description
enum status
enum priority
varchar category
decimal estimated_cost
char reported_by FK
char assigned_to FK
char asset_id FK
char department_id FK
date estimated_resolution_date
date actual_resolution_date
timestamp created_at
timestamp updated_at
}
ISSUE_COMMENTS {
char id PK
char issue_id FK
char user_id FK
varchar user_name
text content
timestamp created_at
timestamp updated_at
}
ASSET_MAINTENANCE {
char id PK
char asset_id FK
varchar maintenance_type
text description
char performed_by FK
date performed_date
decimal cost
date next_maintenance_date
timestamp created_at
}
NOTIFICATIONS {
char id PK
char user_id FK
varchar title
text message
enum type
boolean is_read
timestamp created_at
}
AUDIT_LOGS {
char id PK
char user_id FK
varchar action
varchar entity_type
char entity_id
json details
varchar ip_address
text user_agent
timestamp created_at
}
ASSET_REQUESTS {
char id PK
char user_id FK
varchar asset_name
varchar asset_type
varchar category
text reason
enum priority
enum status
date requested_date
date approved_date
char approved_by FK
text notes
decimal estimated_cost
timestamp created_at
timestamp updated_at
}
BACKUPS {
char id PK
varchar name
text description
timestamp timestamp
varchar version
json metadata
json backup_data
char created_by FK
timestamp created_at
}
ASSET_REQUEST_COMMENTS {
char id PK
char asset_request_id FK
char user_id FK
varchar user_name
text comment
char parent_comment_id FK
timestamp created_at
timestamp updated_at
}
ASSET_TYPES {
char id PK
varchar name UK
text description
json parameters_schema
tinyint is_active
timestamp created_at
timestamp updated_at
}
DEPARTMENTS ||--o{ USERS : "has many"
DEPARTMENTS ||--o{ ASSETS : "has many"
USERS ||--o{ ISSUES : "reports many"
USERS ||--o{ ISSUE_COMMENTS : "writes many"
USERS ||--o{ ASSET_MAINTENANCE : "performs"
USERS ||--o{ NOTIFICATIONS : "receives"
USERS ||--o{ ASSET_REQUESTS : "submits"
USERS ||--o{ ASSET_REQUEST_COMMENTS : "writes"
ASSETS ||--o{ ISSUES : "may be related to"
ASSETS ||--o{ ASSET_MAINTENANCE : "under maintenance"
ISSUES ||--o{ ISSUE_COMMENTS : "has many"
ASSET_REQUESTS ||--o{ ASSET_REQUEST_COMMENTS : "has many"
```

## Detailed Component Analysis

### Indexing Strategy for Common Queries
- User lookups
  - By email: idx_users_email(email) optimizes login and identity checks.
  - By department: idx_users_department(department_id) supports team and department views.
  - By role: idx_users_role(role) enables role-based dashboards and access control filtering.
  - By activity: idx_users_active(is_active) filters active users efficiently.

- Asset searches
  - By serial number: idx_assets_serial(serial_number) ensures fast lookup by hardware identifier.
  - By department: idx_assets_department(department_id) supports inventory per department.
  - By assignment: idx_assets_assigned(assigned_to) finds assigned assets quickly.
  - By status/type/category: idx_assets_status(status), idx_assets_type(type), idx_assets_category(category) enable filtering and reporting.

- Issue filtering
  - By status/priority: idx_issues_status(status), idx_issues_priority(priority) optimize Kanban-like views and triage.
  - By reporter/assignee/asset/department: idx_issues_reported_by(reported_by), idx_issues_assigned_to(assigned_to), idx_issues_asset(asset_id), idx_issues_department(department_id) support dashboard queries.

- Department aggregations
  - Hierarchical navigation: idx_departments_parent(parent_id) supports tree traversal and nested set-style queries.
  - Unique names per parent: (name, parent_id) unique constraint ensures distinct department names under the same parent.
  - Summary stats: Triggers maintain user_count, asset_count, and asset_value for each department.

- Additional tables
  - Issue comments: idx_issue_comments_issue(issue_id), idx_issue_comments_user(user_id), idx_issue_comments_created(created_at) optimize comment threads and timelines.
  - Asset maintenance: idx_maintenance_asset(asset_id), idx_maintenance_date(performed_date), idx_maintenance_type(maintenance_type) support maintenance schedules and cost analytics.
  - Notifications: idx_notifications_user(user_id), idx_notifications_read(is_read), idx_notifications_created(created_at) power inbox and read-state queries.
  - Audit logs: idx_audit_entity(entity_type, entity_id) accelerates audit trails and entity-scoped reports.
  - Asset requests: idx_asset_requests_user(user_id), idx_asset_requests_status(status), idx_asset_requests_priority(priority), idx_asset_requests_date(requested_date) support request workflows.
  - Backups: idx_backups_created_by(created_by), idx_backups_timestamp(timestamp) enable backup history and ownership queries.
  - Asset request comments: indexes on asset_request_id, user_id, parent_comment_id support threaded comments.
  - Asset types: unique(name) and timestamps for governance.

### Constraint Enforcement and Referential Integrity
- Enforced constraints:
  - Primary keys: All tables except departments define a primary key on id.
  - Unique constraints:
    - departments.name (original)
    - (departments.name, departments.parent_id) (after migration)
    - users.email
    - assets.serial_number
    - asset_types.name
  - Foreign keys:
    - users.department_id → departments.id (ON DELETE SET NULL)
    - assets.assigned_to → users.id (ON DELETE SET NULL)
    - assets.department_id → departments.id (ON DELETE SET NULL)
    - issues.reported_by → users.id (ON DELETE CASCADE)
    - issues.assigned_to → users.id (ON DELETE SET NULL)
    - issues.asset_id → assets.id (ON DELETE SET NULL)
    - issues.department_id → departments.id (ON DELETE SET NULL)
    - issue_comments.issue_id → issues.id (ON DELETE CASCADE)
    - issue_comments.user_id → users.id (ON DELETE CASCADE)
    - asset_maintenance.asset_id → assets.id (ON DELETE CASCADE)
    - asset_maintenance.performed_by → users.id (ON DELETE SET NULL)
    - notifications.user_id → users.id (ON DELETE CASCADE)
    - audit_logs.user_id → users.id (ON DELETE SET NULL)
    - asset_requests.user_id → users.id (ON DELETE CASCADE)
    - asset_requests.approved_by → users.id (ON DELETE SET NULL)
    - backups.created_by → users.id (ON DELETE CASCADE)
    - asset_request_comments.asset_request_id → asset_requests.id (ON DELETE CASCADE)
    - asset_request_comments.user_id → users.id (ON DELETE CASCADE)
    - asset_request_comments.parent_comment_id → asset_request_comments.id (ON DELETE CASCADE)

- Impact:
  - Cascading deletes ensure referential integrity for child records (e.g., comments, notifications, maintenance).
  - SET NULL maintains referential integrity when parent rows are removed (e.g., users leaving departments).

### Triggers for Department Statistics
Triggers automatically update department-level summaries for user count and asset statistics upon inserts, updates, and deletes in users and assets.

```mermaid
sequenceDiagram
participant App as "Application"
participant DB as "Database"
participant Trg as "Triggers"
participant Dept as "Departments"
App->>DB : INSERT INTO users (department_id)
DB->>Trg : AFTER INSERT users
Trg->>Dept : UPDATE user_count (+1) where id = department_id
App->>DB : INSERT INTO assets (department_id, current_value)
DB->>Trg : AFTER INSERT assets
Trg->>Dept : UPDATE asset_count (+1)<br/>UPDATE asset_value (sum of current_value)
App->>DB : UPDATE users SET department_id = ? (old vs new)
DB->>Trg : AFTER UPDATE users
Trg->>Dept : UPDATE old_dept user_count (-1)<br/>UPDATE new_dept user_count (+1)
App->>DB : UPDATE assets SET department_id = ? (old vs new)
DB->>Trg : AFTER UPDATE assets
Trg->>Dept : Recalculate sums for old/new departments
App->>DB : DELETE FROM users
DB->>Trg : AFTER DELETE users
Trg->>Dept : UPDATE user_count (-1)
App->>DB : DELETE FROM assets
DB->>Trg : AFTER DELETE assets
Trg->>Dept : UPDATE asset_count (-1)<br/>UPDATE asset_value (sum)
```

### Additional Columns and Indexes Introduced by Migrations
- Estimated costs
  - issues.estimated_cost added to support cost estimation workflows.
  - asset_requests.estimated_cost added similarly.

- Asset request comments
  - New table with self-referencing parent_comment_id and indexes on asset_request_id, user_id, and parent_comment_id.

- Asset types
  - New table with unique(name), JSON parameters_schema, and lifecycle timestamps.

- MFA policy indexes
  - idx_mfa_policies_enabled(enabled)
  - idx_mfa_policies_enforcement(enforcement_level)
  - idx_user_compliance_user(user_id)

These additions improve query performance for specific workloads and enable richer domain modeling.

## Dependency Analysis
The following diagram shows foreign key dependencies among core tables.

```mermaid
graph LR
D["Departments"] --> U["Users"]
D --> A["Assets"]
U --> I["Issues"]
I --> IC["Issue Comments"]
A --> AM["Asset Maintenance"]
U --> N["Notifications"]
U --> AR["Asset Requests"]
AR --> ARC["Asset Request Comments"]
U --> AL["Audit Logs"]
U --> B["Backups"]
A --> I
```

## Performance Considerations
- Query optimization
  - Single-column indexes match frequent filter predicates (e.g., status, priority, role, active flag).
  - Composite indexes accelerate multi-column filters; for example, idx_audit_entity(entity_type, entity_id) supports targeted audit queries.

- Storage implications
  - Indexes increase write overhead due to maintenance during INSERT/UPDATE/DELETE.
  - Unique indexes (email, serial_number, department name per parent) prevent duplicates but require additional storage and validation.

- Maintenance overhead
  - Triggers on users/assets ensure department metrics remain consistent but incur CPU and lock contention during row modifications.
  - Consider batching updates or using asynchronous counters if high-frequency writes cause contention.

- Recommendations
  - Monitor slow query logs and periodically re-evaluate index selectivity.
  - Use EXPLAIN/ANALYZE to confirm index usage for critical queries.
  - For high-cardinality columns, consider covering indexes to avoid key lookups.

## Troubleshooting Guide
- Duplicate department names
  - Symptom: Failure to insert/update department with existing name under the same parent.
  - Cause: Unique constraint (name, parent_id).
  - Resolution: Ensure unique department names per parent or adjust parent_id.

- Cascade delete behavior
  - Symptom: Deleting a user removes dependent records (comments, notifications).
  - Cause: Foreign keys with ON DELETE CASCADE.
  - Resolution: Confirm cascade behavior aligns with business rules; consider disabling cascade if needed.

- Trigger inconsistencies
  - Symptom: Department metrics drift after bulk operations.
  - Cause: Triggers rely on per-row events; bulk updates bypass row-level triggers.
  - Resolution: Recalculate department metrics periodically or use stored procedures to update counts atomically.

- Missing indexes
  - Symptom: Slow queries on joins or filters.
  - Cause: Absence of supporting indexes.
  - Resolution: Add targeted indexes based on query patterns; validate with EXPLAIN.

## Conclusion
The Assets Management System employs a robust set of primary keys, unique constraints, and foreign keys to enforce data integrity. A comprehensive indexing strategy targets common queries across users, assets, issues, and administrative tables. Triggers maintain department-level summaries, improving reporting performance at the cost of incremental write overhead. Periodic review of index effectiveness and careful handling of cascading operations will sustain query performance and data consistency.
