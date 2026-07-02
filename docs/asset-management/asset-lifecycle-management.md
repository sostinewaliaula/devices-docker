# Asset Lifecycle Management

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
This document provides comprehensive documentation for asset lifecycle management, covering the complete journey from procurement to retirement. It explains asset creation workflows (validation, image uploads, custom attributes), assignment and transfer processes, department hierarchies, user assignments, maintenance tracking, warranty management, condition monitoring, retirement and disposal procedures, valuation calculations, and audit trails. It also includes practical examples of workflows, bulk operations, and integrations with procurement systems, along with status transitions, approval workflows, and compliance requirements.

## Project Structure
The system comprises:
- Backend API with Express routes for assets, asset requests, issues, and supporting utilities
- Database schema with departments, users, assets, issues, audit logs, and asset history tables
- Frontend pages for administrators, users, and managers with CRUD, filtering, exporting, and notifications
- Middleware for file uploads and authentication
- Services for notifications, comments, and audit logging

```mermaid
graph TB
subgraph "Frontend"
AdminUI["Admin UI<br/>AssetManagement.tsx"]
UserUI["User UI<br/>UserAssets.tsx"]
ManagerUI["Manager UI<br/>DepartmentAssets.tsx"]
end
subgraph "Backend API"
AssetsRoute["Assets Route<br/>assets.js"]
RequestsRoute["Asset Requests Route<br/>asset-requests.js"]
IssuesRoute["Issues Route<br/>issues.js"]
UploadMW["Upload Middleware<br/>upload.js"]
AuditUtil["Audit Logger<br/>auditLogger.js"]
end
subgraph "Database"
Schema["Schema<br/>schema.sql"]
HistMig["Asset History Migration<br/>add_asset_history_tables.sql"]
end
AdminUI --> AssetsRoute
UserUI --> AssetsRoute
ManagerUI --> AssetsRoute
AdminUI --> RequestsRoute
UserUI --> IssuesRoute
ManagerUI --> IssuesRoute
AssetsRoute --> UploadMW
AssetsRoute --> AuditUtil
RequestsRoute --> AuditUtil
IssuesRoute --> AuditUtil
AssetsRoute --> Schema
RequestsRoute --> Schema
IssuesRoute --> Schema
AuditUtil --> Schema
Schema --> HistMig
```

## Core Components
- Assets API: CRUD operations, filtering, pagination, history retrieval, and audit logging
- Asset Requests API: Procurement workflow with approvals, cost estimation, and notifications
- Issues API: Problem reporting, assignment, resolution tracking, and notifications
- Asset History: Assignment and issue linkage tracking for audit and reporting
- Audit Logging: Centralized logging for compliance and security monitoring
- Frontend Pages: Admin, user, and manager dashboards with search, filters, exports, and notifications

Key capabilities:
- Validation and sanitization for asset creation and updates
- Image upload handling with size/type restrictions
- Custom attributes support via JSON fields
- Department hierarchy and automatic statistics updates
- Comprehensive audit trail for all CRUD and workflow actions

## Architecture Overview
The system follows a layered architecture:
- Presentation Layer: React pages for admin, user, and manager views
- Application Layer: Express routes implementing business logic
- Persistence Layer: MariaDB with triggers for department statistics
- Utility Layer: Audit logging, notifications, and file upload middleware

```mermaid
sequenceDiagram
participant Admin as "Admin UI"
participant API as "Assets Route"
participant DB as "MariaDB"
participant Audit as "Audit Logger"
Admin->>API : POST /assets (with image and custom attributes)
API->>API : Validate inputs and check serial uniqueness
API->>DB : INSERT assets
DB-->>API : Asset created
API->>Audit : logCRUD(CREATE, asset)
Audit->>DB : INSERT audit_logs
API-->>Admin : 201 Created + asset details
```

## Detailed Component Analysis

### Asset Creation Workflow
Asset creation enforces validation, checks serial uniqueness, supports image uploads, and records audit logs.

```mermaid
flowchart TD
Start(["POST /assets"]) --> Validate["Validate fields<br/>name, type, serial_number,<br/>purchase_price, current_value,<br/>status, condition"]
Validate --> Valid{"Validation passed?"}
Valid --> |No| Error["Return 400 with validation errors"]
Valid --> |Yes| CheckSerial["Check unique serial_number"]
CheckSerial --> Exists{"Serial exists?"}
Exists --> |Yes| SerialError["Return 400: Serial exists"]
Exists --> |No| AssignDept["Auto-assign department from user if provided"]
AssignDept --> Upload["Process image upload (memory storage)"]
Upload --> Insert["INSERT asset with custom_attributes JSON"]
Insert --> Audit["logCRUD(CREATE, asset)"]
Audit --> Success["Return 201 + asset details"]
```

### Asset Assignment and Transfer
The system tracks assignments and transfers with conditions, timestamps, and department associations. History tables capture ownership changes and issue events linked to assets.

```mermaid
erDiagram
ASSETS {
char id PK
varchar name
varchar type
varchar serial_number
enum status
enum condition
char assigned_to FK
char department_id FK
}
USERS {
char id PK
varchar name
char department_id FK
}
DEPARTMENTS {
char id PK
varchar name
char manager_id
}
ASSET_ASSIGNMENT_HISTORY {
char id PK
char asset_id FK
char user_id FK
char assigned_by FK
char department_id FK
enum assignment_type
timestamp assigned_at
timestamp returned_at
enum condition_on_assign
enum condition_on_return
}
ASSETS ||--o{ ASSET_ASSIGNMENT_HISTORY : "has"
USERS ||--o{ ASSET_ASSIGNMENT_HISTORY : "assigns"
DEPARTMENTS ||--o{ ASSET_ASSIGNMENT_HISTORY : "owns"
```

### Asset Maintenance Tracking and Warranty Management
Maintenance records track performed dates, costs, and next maintenance schedules. Warranty expiry is stored per asset for lifecycle planning.

```mermaid
erDiagram
ASSETS {
char id PK
date warranty_expiry
}
ASSET_MAINTENANCE {
char id PK
char asset_id FK
varchar maintenance_type
date performed_date
decimal cost
date next_maintenance_date
}
ASSETS ||--o{ ASSET_MAINTENANCE : "maintained"
```

### Asset Retirement and Disposal
Retirement status transitions are supported via asset updates. Department statistics are automatically recalculated via triggers to reflect asset value changes.

```mermaid
flowchart TD
Start(["Update Asset Status"]) --> Transition{"Transition to 'retired'?"}
Transition --> |No| Save["Save asset update"]
Transition --> |Yes| Recalc["Triggers update department asset_value"]
Recalc --> Save
Save --> Audit["logCRUD(UPDATE, asset)"]
Audit --> End(["Return updated asset"])
```

### Procurement Integration and Approval Workflows
Asset requests integrate with procurement by capturing reasons, priorities, and optional estimated costs. Approvals trigger notifications to requesters, managers, and admins.

```mermaid
sequenceDiagram
participant User as "User"
participant Requests as "Asset Requests Route"
participant Notify as "Notification Service"
participant DB as "MariaDB"
User->>Requests : POST /asset-requests
Requests->>DB : INSERT asset_requests
DB-->>Requests : Created
Requests->>Notify : Notify requester, managers, admins
Notify-->>User : In-app and email notifications
Requests-->>User : 201 Created + request
```

### Issue Reporting and Resolution Tracking
Issues capture status, priority, and estimated costs. Notifications are sent to reporters, assignees, managers, and admins. Asset-issue events are recorded for auditability.

```mermaid
sequenceDiagram
participant Reporter as "Reporter"
participant Issues as "Issues Route"
participant Notify as "Notification Service"
participant DB as "MariaDB"
Reporter->>Issues : POST /issues (with attachments)
Issues->>DB : INSERT issues
Issues->>Notify : Notify reporter, managers, admins
Notify-->>Reporter : In-app and email notifications
Issues->>DB : INSERT asset_issue_history
Issues-->>Reporter : 201 Created + issue
```

### Frontend Dashboards and Workflows
- Admin dashboard: Full asset CRUD, history, export/import, and department management
- User dashboard: Personal assets, issue reporting, and self-service additions
- Manager dashboard: Department-wide assets, issue tracking, and bulk exports

```mermaid
graph TB
Admin["Admin UI<br/>AssetManagement.tsx"] --> AssetsAPI["Assets API"]
Admin --> RequestsAPI["Asset Requests API"]
User["User UI<br/>UserAssets.tsx"] --> IssuesAPI["Issues API"]
Manager["Manager UI<br/>DepartmentAssets.tsx"] --> AssetsAPI
Manager --> Reports["Export/Reports"]
```

## Dependency Analysis
- Assets depend on users and departments for ownership and hierarchy
- Asset history depends on assets, users, and issues for auditability
- Triggers maintain department statistics for asset count and value
- Audit logs centralize compliance data across CRUD and workflow actions

```mermaid
erDiagram
DEPARTMENTS {
char id PK
}
USERS {
char id PK
char department_id FK
}
ASSETS {
char id PK
char department_id FK
char assigned_to FK
}
ASSET_ASSIGNMENT_HISTORY {
char id PK
char asset_id FK
char user_id FK
}
ASSET_ISSUE_HISTORY {
char id PK
char asset_id FK
char issue_id FK
}
AUDIT_LOGS {
char id PK
char user_id FK
}
DEPARTMENTS ||--o{ USERS : "has"
USERS ||--o{ ASSETS : "owns"
DEPARTMENTS ||--o{ ASSETS : "owns"
ASSETS ||--o{ ASSET_ASSIGNMENT_HISTORY : "tracked"
ASSETS ||--o{ ASSET_ISSUE_HISTORY : "linked"
USERS ||--o{ AUDIT_LOGS : "logs"
```

## Performance Considerations
- Pagination and filtering: Use sanitized pagination and indexed columns for efficient queries
- Image uploads: Memory storage with size limits; consider streaming for large files
- Triggers: Automatic department statistics reduce application logic but add write overhead
- Audit logging: Non-blocking writes to avoid impacting transaction performance
- Frontend exports: Client-side PDF generation; consider server-side for very large datasets

## Troubleshooting Guide
Common issues and resolutions:
- Validation failures during asset creation: Review field constraints and ensure unique serial numbers
- Upload errors: Verify file types and sizes; check middleware configuration
- Audit logging failures: Confirm database connectivity and table existence
- Department statistics not updating: Verify trigger installation and permissions
- Asset history missing: Ensure migration tables exist and foreign keys are intact

## Conclusion
The asset lifecycle management system provides a robust foundation for end-to-end asset management, integrating procurement workflows, assignment tracking, maintenance scheduling, warranty monitoring, and comprehensive audit trails. Its modular architecture supports scalability, compliance, and operational efficiency across administrative, user, and manager roles.
