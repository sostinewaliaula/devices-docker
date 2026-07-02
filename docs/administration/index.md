# Administration & System Management

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
This document provides comprehensive coverage of the Administration and System Management features within the Assets Management System. It focuses on the admin dashboard overview, system health monitoring, administrative controls, audit logging and compliance reporting, MFA management and policy configuration, system settings and branding, weekly notifications and automated reporting, user management and bulk operations, and system maintenance and troubleshooting workflows.

## Project Structure
The administration and system management functionality spans both the frontend React application and the backend Node.js/Express APIs:

- Frontend Admin Pages:
  - AdminDashboard.tsx: Administrative overview and analytics
  - AuditLogs.tsx: Audit trail viewing and export
  - UserManagement.tsx: User lifecycle and bulk operations
  - BackupManagement.tsx: Backup scheduling, creation, restoration, and recipients
  - MfaManagement.tsx: MFA status and factor management
  - MfaPolicyManagement.tsx: MFA policy configuration and compliance stats

- Backend Routes and Services:
  - Admin MFA routes: `/api/admin/mfa-*` for MFA status and management
  - MFA Policy routes: `/api/mfa-policies` for policy CRUD and compliance
  - Audit routes: `/api/audit` for audit logs and statistics
  - Settings routes: `/api/settings` for system configuration and branding
  - Weekly notifications: `/api/weekly-notifications` for schedule and triggers
  - Users routes: `/api/users` for user management and history
  - Backups routes: `/api/backups` for backup creation, restoration, and file management
  - Exports routes: `/api/exports` for CSV exports of teams, issues, assets, and requests
  - Audit logger utility: centralized logging for compliance

```mermaid
graph TB
subgraph "Frontend Admin Pages"
A["AdminDashboard.tsx"]
B["AuditLogs.tsx"]
C["UserManagement.tsx"]
D["BackupManagement.tsx"]
E["MfaManagement.tsx"]
F["MfaPolicyManagement.tsx"]
end
subgraph "Backend Routes"
R1["admin-mfa.js"]
R2["mfa-policies.js"]
R3["audit.js"]
R4["settings.js"]
R5["weekly-notifications.js"]
R6["users.js"]
R7["backups.js"]
R8["exports.js"]
end
subgraph "Utilities"
U1["auditLogger.js"]
end
A --> R1
B --> R3
C --> R6
D --> R7
E --> R1
F --> R2
R1 --> U1
R2 --> U1
R3 --> U1
```

## Core Components
- Admin Dashboard: Provides overview cards, charts, quick actions, and recent activity feeds for assets, issues, users, and departments.
- Audit Logging: Centralized audit logging with filtering, statistics, and export capabilities.
- MFA Management: Admin view of user MFA status, factors, and controls to disable MFA or factors.
- MFA Policy Management: CRUD for MFA policies, enforcement levels, grace periods, and compliance statistics.
- System Settings and Branding: Admin-only configuration of system settings, SMTP, and branding assets.
- Weekly Notifications: Configurable schedule, manual triggers, and reload mechanisms.
- User Management: Full lifecycle management, history summaries, bulk operations, and exports.
- Backup Management: Automated SQL backups, manual triggers, file storage, restoration, and email recipients.
- Export Tools: CSV exports for team members, department issues, department assets, and asset requests.

## Architecture Overview
The system follows a layered architecture:
- Frontend Admin Pages (React) consume REST endpoints exposed by backend routes.
- Backend routes enforce authentication and authorization, delegate to services/utilities, and interact with the database.
- Audit logging is centralized via a utility that persists entries regardless of main flow outcomes.
- MFA and policy management integrate with database tables for compliance tracking and enforcement.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Backend Routes"
participant DB as "Database"
participant Audit as "Audit Logger"
Admin->>API : Request dashboard data
API->>DB : Query metrics and summaries
DB-->>API : Results
API-->>Admin : Aggregated data
Admin->>API : Create backup
API->>DB : Persist backup metadata
API->>Audit : Log backup operation
Audit-->>API : Acknowledge
API-->>Admin : Success response
```

## Detailed Component Analysis

### Admin Dashboard
The Admin Dashboard aggregates system-wide metrics and provides quick navigation to key administrative areas. It displays:
- Stats overview cards for total assets, open issues, total users, and departments.
- Charts for assets by status, assets by department, issues by status, and assets by type.
- Recent activity sections for issues and recently added assets.
- Quick action buttons to navigate to asset, issue, user, and department management screens.

```mermaid
flowchart TD
Start(["Load Dashboard"]) --> FetchData["Fetch assets, issues, users, departments"]
FetchData --> ProcessData["Process chart data<br/>by department/type/status"]
ProcessData --> RenderCards["Render stats cards"]
ProcessData --> RenderCharts["Render pie/bar charts"]
RenderCards --> QuickActions["Render quick actions"]
RenderCharts --> RecentActivity["Render recent activity"]
QuickActions --> End(["Dashboard Ready"])
RecentActivity --> End
```

### Audit Logging System
The audit logging system captures all significant system activities for compliance and security monitoring:
- Centralized logging utility supports multiple log categories (auth, CRUD, config, backup, security).
- Backend routes provide listing, filtering, statistics, and creation of audit logs.
- Frontend allows filtering by user, action, entity type, and date range, with export to CSV/JSON/TXT/PDF.
- Statistics include totals, unique users, and counts per action type.

```mermaid
sequenceDiagram
participant Service as "Service Layer"
participant Logger as "Audit Logger"
participant DB as "Database"
Service->>Logger : log({userId, action, entityType, details})
Logger->>DB : INSERT INTO audit_logs
DB-->>Logger : OK
Logger-->>Service : Done
participant Admin as "Admin UI"
participant API as "Audit Routes"
Admin->>API : GET /audit with filters
API->>DB : SELECT with WHERE clauses
DB-->>API : Results + pagination
API-->>Admin : Logs + stats
```

### MFA Management and Policy Configuration
MFA management enables administrators to:
- View MFA status across users, including enrollment dates, verification timestamps, and factor counts.
- Inspect user MFA factors and disable individual factors or complete MFA enrollment.
- Configure MFA policies with enforcement levels, target/exempt roles, grace periods, and enable/disable toggles.
- Review compliance statistics and resolve policy violations.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant APIMFA as "Admin MFA Routes"
participant APIPol as "MFA Policy Routes"
participant DB as "Database"
Admin->>APIMFA : GET /api/admin/mfa-status
APIMFA->>DB : SELECT user MFA status
DB-->>APIMFA : Rows
APIMFA-->>Admin : Users with MFA stats
Admin->>APIPol : GET /api/mfa-policies
APIPol->>DB : SELECT policies
DB-->>APIPol : Policies
APIPol-->>Admin : Policy list
Admin->>APIMFA : POST /api/admin/disable-user-mfa/ : userId
APIMFA->>DB : DELETE factors + UPDATE user
DB-->>APIMFA : OK
APIMFA-->>Admin : Success
```

### System Settings and Branding
System settings management includes:
- Admin-only retrieval and update of system settings with validation.
- Public exposure of branding settings for client-side rendering.
- SMTP configuration testing and dynamic reinitialization of transporters upon changes.
- Google OAuth client configuration exposure without leaking secrets.

```mermaid
flowchart TD
Start(["Admin Settings Update"]) --> Validate["Validate settings array"]
Validate --> Upsert["Upsert system_settings"]
Upsert --> CheckSMTP{"SMTP settings changed?"}
CheckSMTP --> |Yes| Reinit["Reinitialize email transporter"]
CheckSMTP --> |No| Skip["Skip reinit"]
Reinit --> Done(["Settings saved"])
Skip --> Done
```

### Weekly Notifications and Automated Reporting
Weekly notifications provide:
- Configurable schedule with enabled flag, days, time, and timezone.
- Manual trigger endpoint for testing and immediate delivery.
- Endpoint to reload cron schedule after updates.
- Integration with notification preferences and email service.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Weekly Notifications Routes"
participant Notif as "Notification Service"
Admin->>API : GET /api/weekly-notifications/schedule
API-->>Admin : Current schedule
Admin->>API : PUT /api/weekly-notifications/schedule
API-->>Admin : Schedule updated
Admin->>API : POST /api/weekly-notifications/trigger
API->>Notif : sendWeeklySummaryToAdmins()
Notif-->>API : Results
API-->>Admin : Success with stats
```

### User Management and Bulk Operations
User management encompasses:
- Listing users with filters (search, role, department, status) and pagination.
- History summaries and detailed user histories across assignments, issues, and requests.
- Creation, updates, deletion, and password changes with audit logging.
- Bulk operations including selection and deletion.
```bash
Export capabilities for team members and CSV generation.
```

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Users Routes"
participant DB as "Database"
participant Audit as "Audit Logger"
Admin->>API : GET /api/users?page&limit&filters
API->>DB : SELECT with WHERE + COUNT
DB-->>API : Users + pagination
API-->>Admin : Users list
Admin->>API : POST /api/users (create)
API->>DB : INSERT user
API->>Audit : logCRUD CREATE user
Audit-->>API : OK
API-->>Admin : Created
Admin->>API : DELETE /api/users/ : id
API->>DB : DELETE user
API->>Audit : logCRUD DELETE user
Audit-->>API : OK
API-->>Admin : Deleted
```

### Backup Management and Automated Reporting
Backup management supports:
- Automatic SQL backups with configurable schedule and email recipients.
- Manual creation of JSON and SQL backups with email delivery.
- Server-side file listing, download, and deletion.
- Restoration from uploaded files or server-stored files.
- Backup email recipients management with activation toggles.

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Backups Routes"
participant DB as "Database"
participant FS as "Storage"
Admin->>API : POST /api/backups/trigger
API->>DB : INSERT backup metadata
API->>FS : Write compressed SQL file
API-->>Admin : Success
Admin->>API : GET /api/backups/files
API->>FS : readdirSync
FS-->>API : Files list
API-->>Admin : Files
Admin->>API : POST /api/backups/restore (uploaded)
API->>FS : Read file
API->>DB : Restore SQL/JSON
API-->>Admin : Success
```

### Export Tools and Compliance Reporting
Export tools provide standardized CSV exports for:
- Team members (managers/admins)
- Department issues (managers/admins)
- Department assets (managers/admins)
- Asset requests (managers/admins)

These exports support compliance reporting and external audits by providing structured datasets.

### Administrative Workflows and System Optimization
Common administrative workflows include:
- Onboarding new users with creation, notifications, and audit logging.
- Enforcing MFA policies during login and recording violations.
- Generating compliance reports via audit logs and MFA policy statistics.
- Scheduling and triggering weekly notifications for stakeholders.
- Performing backups and restoring from backups for disaster recovery.
- Managing branding and system settings with SMTP testing.

Optimization recommendations:
- Use pagination and filtering for large datasets (users, audit logs).
- Leverage database indexes on frequently queried columns (user_id, created_at, entity_type).
- Batch operations for bulk user deletions and exports.
- Monitor backup retention and automate cleanup of old files.
- Validate and sanitize inputs for settings and notifications.

## Dependency Analysis
The admin features exhibit clear separation of concerns:
- Frontend pages depend on backend routes for data and actions.
- Backend routes depend on database utilities and services.
- Audit logging is decoupled and invoked from various routes/services.
- MFA and policy management rely on dedicated database tables and services.

```mermaid
graph LR
UI_Admin["Admin UI Pages"] --> Routes["Backend Routes"]
Routes --> DB["Database"]
Routes --> Utils["Utilities (Audit Logger)"]
Routes --> Services["Services (MFA, Notifications)"]
Services --> DB
Utils --> DB
```

## Performance Considerations
- Pagination and limits: Use sanitized pagination for large datasets (users, audit logs, backups).
- Indexes: Ensure indexes on audit_logs (user_id, created_at), users (is_active, role), and backups (created_at).
- Background processing: Offload heavy operations like backup generation and exports to background jobs.
- Caching: Cache branding settings and static lists where appropriate.
- Validation: Validate inputs early to reduce database round trips.

## Troubleshooting Guide
- Audit logs not appearing:
  - Verify audit routes are reachable and database connectivity is healthy.
  - Check audit logger fallback behavior if database writes fail.
- MFA policy enforcement not applied:
  - Confirm policy is enabled and targets the user's role.
  - Review policy violations and compliance records.
- Backup failures:
  - Check filesystem permissions for storage directory.
  - Validate database credentials and connection for SQL dumps.
  - Confirm email configuration for backup notifications.
- User management errors:
  - Validate role-based access and permission checks.
  - Review audit logs for failed CRUD operations.
- Weekly notifications not sent:
  - Verify schedule configuration and timezone.
  - Test SMTP settings and notification preferences.

## Conclusion
The Administration and System Management features provide a robust foundation for oversight, compliance, and operational excellence. The admin dashboard offers actionable insights, while audit logging, MFA management, and policy configuration ensure strong security posture. System settings, branding, notifications, user management, and backup capabilities collectively support efficient operations and reliable disaster recovery.
