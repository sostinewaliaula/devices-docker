# Architecture Overview

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
This document presents the end-to-end architecture of the Assets Management System, detailing the integration between a React frontend and a Node.js/Express backend. It explains the authentication and authorization mechanisms, role-based access control, state management, data flow, and operational concerns such as security, scalability, and deployment topology. The system currently includes a legacy Supabase client mock and related services, indicating a migration path toward a cloud-native backend while maintaining compatibility.

## Project Structure
The repository follows a dual-package structure:
- Frontend (React + TypeScript/Vite) under the repository root, organized by pages, components, services, and contexts.
- Backend (Node.js/Express) under the backend directory, containing routes, middleware, services, database configuration, and migrations.

Key characteristics:
- Frontend uses Vite for development and build, React Router for navigation, and a centralized API service for backend communication.
- Backend uses Express with middleware for security and rate limiting, a configurable database client supporting MySQL/MariaDB and PostgreSQL, and modular route handlers.
- Environment configuration is split between frontend and backend, with explicit examples for database and JWT settings.

```mermaid
graph TB
subgraph "Frontend (React)"
FE_App["App.tsx"]
FE_Routes["Pages & Routes"]
FE_Contexts["Contexts (Auth, Theme, Notifications)"]
FE_Services["API Service (Axios)"]
FE_Components["UI Components"]
end
subgraph "Backend (Node.js/Express)"
BE_Server["server.js"]
BE_Routes["Routes (auth, users, assets, etc.)"]
BE_Middleware["Middleware (auth, error handling)"]
BE_DB["Database Config (MySQL/MariaDB/PostgreSQL)"]
BE_Services["Services (email, notifications, MFA)"]
end
subgraph "External Services"
Ext_DB["MariaDB/PostgreSQL"]
Ext_Email["SMTP"]
Ext_Supabase["Legacy Supabase Client Mock"]
end
FE_App --> FE_Services
FE_Services --> BE_Server
BE_Server --> BE_Routes
BE_Server --> BE_Middleware
BE_Routes --> BE_DB
BE_Services --> Ext_Email
BE_DB --> Ext_DB
FE_Services -. "Legacy Supabase Mock" .-> Ext_Supabase
```

## Core Components
- Frontend Application
  - App shell with routing, protected routes, and role-based navigation.
  - Centralized authentication context managing login, MFA, profile updates, and logout.
  - API service abstraction for backend communication with interceptors for auth tokens and error handling.
  - UI components and pages organized by role (admin, manager, user).
- Backend Server
  - Express server with security middleware (Helmet, CORS, rate limiting), health checks, and cron-based automation.
  - Modular routes for authentication, assets, issues, notifications, backups, and administrative functions.
  - Database abstraction supporting MySQL/MariaDB and PostgreSQL with connection pooling and transactions.
  - Middleware for JWT-based authentication, role enforcement, and department-scoped access control.
- Legacy Supabase Integration
  - Legacy client mock and typed interfaces for compatibility.
  - Supabase service wrapper with retry logic for database-like operations.

## Architecture Overview
High-level architecture combines:
- React SPA frontend communicating via REST APIs to a Node.js/Express backend.
- Database layer supporting MySQL/MariaDB and PostgreSQL with automatic triggers for department metrics.
- Email notifications integrated through SMTP configuration.
- Optional legacy Supabase client mock present for compatibility.

```mermaid
graph TB
Client["Browser (React SPA)"]
Router["React Router"]
AuthCtx["Auth Context"]
ApiService["API Service (Axios)"]
Server["Express Server"]
AuthMW["Auth Middleware (JWT)"]
Routes["Route Handlers"]
DB["Database Client (MySQL/MariaDB/PostgreSQL)"]
Email["Email Service (SMTP)"]
Cron["Cron Jobs (Weekly Summary, Backups)"]
Client --> Router
Router --> AuthCtx
AuthCtx --> ApiService
ApiService --> Server
Server --> AuthMW
AuthMW --> Routes
Routes --> DB
Server --> Email
Server --> Cron
```

## Detailed Component Analysis

### Authentication and Authorization Flow
The system implements a multi-factor authentication strategy with JWT-based sessions and role-based access control:
- Frontend login invokes the authentication API, which validates credentials and enforces MFA policies.
- On successful login, a JWT is issued and stored in local storage; subsequent requests include an Authorization header.
- The backend middleware verifies tokens, handles temporary MFA setup tokens, and enforces role-based restrictions.
- Protected routes in the frontend enforce authentication and role checks before rendering.

```mermaid
sequenceDiagram
participant Browser as "Browser"
participant Login as "Login Page"
participant AuthCtx as "Auth Context"
participant API as "API Service"
participant Server as "Express Server"
participant AuthMW as "Auth Middleware"
participant DB as "Database"
Browser->>Login : User submits credentials
Login->>AuthCtx : login(email, password)
AuthCtx->>API : POST /auth/login
API->>Server : HTTP request
Server->>DB : Verify credentials
DB-->>Server : User record
Server->>Server : Enforce MFA policies
Server-->>API : JWT or MFA required
API-->>AuthCtx : Response with token or requiresMfa
AuthCtx->>AuthCtx : Store token in localStorage
AuthCtx-->>Browser : Redirect to dashboard
```

### Role-Based Access Control (RBAC)
RBAC is enforced at two levels:
- Frontend: Route guards determine visibility and access based on user roles (admin, manager, user).
- Backend: Middleware checks roles and department-level access for sensitive resources.

```mermaid
flowchart TD
Start(["Route Access"]) --> CheckAuth["Check Authentication"]
CheckAuth --> IsAuth{"Authenticated?"}
IsAuth --> |No| Deny["Redirect to Login"]
IsAuth --> |Yes| CheckRole["Check Role Permissions"]
CheckRole --> Role{"Role: admin/manager/user"}
Role --> |admin| AllowAdmin["Allow Admin Routes"]
Role --> |manager| AllowManager["Allow Manager Routes"]
Role --> |user| AllowUser["Allow User Routes"]
AllowAdmin --> End(["Access Granted"])
AllowManager --> End
AllowUser --> End
Deny --> End
```

### Data Flow Between Frontend and Backend
The frontend communicates with the backend through a centralized API service that:
- Adds Authorization headers with JWT tokens.
- Handles 401 responses by clearing session state and redirecting to login.
- Exposes typed endpoints for users, departments, assets, issues, notifications, budgets, and settings.

```mermaid
sequenceDiagram
participant UI as "UI Component"
participant Ctx as "Auth Context"
participant API as "API Service"
participant Srv as "Express Server"
participant MW as "Auth Middleware"
participant DB as "Database"
UI->>Ctx : Perform action (e.g., fetch assets)
Ctx->>API : GET /assets?page=1&limit=20
API->>Srv : HTTP request with Authorization header
Srv->>MW : Verify JWT and role
MW->>DB : Execute query
DB-->>MW : Results
MW-->>Srv : Response
Srv-->>API : JSON payload
API-->>Ctx : Parsed data
Ctx-->>UI : Update state
```

### Database Schema and Storage
The backend defines a comprehensive relational schema with:
- Departments, Users, Assets, Issues, Issue Comments, Asset Maintenance, Notifications, Audit Logs, Asset Requests, and Backups.
- Triggers to maintain department-level aggregates (user count, asset count, asset value).
- Support for both MySQL/MariaDB and PostgreSQL with a unified query abstraction.

```mermaid
erDiagram
DEPARTMENTS {
char id PK
varchar name UK
text description
varchar location
int user_count
int asset_count
varchar asset_value
varchar manager
char manager_id
char parent_id
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
}
ISSUE_COMMENTS {
char id PK
char issue_id FK
char user_id FK
varchar user_name
text content
timestamp created_at
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
}
NOTIFICATIONS {
char id PK
char user_id FK
varchar title
text message
enum type
boolean is_read
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
}
DEPARTMENTS ||--o{ USERS : "has"
DEPARTMENTS ||--o{ ASSETS : "has"
USERS ||--o{ ASSETS : "assigned_to"
USERS ||--o{ ISSUES : "reported_by"
USERS ||--o{ ISSUES : "assigned_to"
ASSETS ||--o{ ISSUE_COMMENTS : "has"
USERS ||--o{ ISSUE_COMMENTS : "has"
ASSETS ||--o{ ASSET_MAINTENANCE : "has"
USERS ||--o{ NOTIFICATIONS : "has"
USERS ||--o{ AUDIT_LOGS : "has"
USERS ||--o{ ASSET_REQUESTS : "has"
USERS ||--o{ BACKUPS : "created_by"
```

### Email and Notification Integration
Email notifications are configured via environment variables and used for:
- Welcome notifications upon user registration.
- Administrative alerts for new registrations.
- Scheduled backup notifications with JSON attachments.

```mermaid
sequenceDiagram
participant Server as "Express Server"
participant EmailSvc as "Email Service"
participant SMTP as "SMTP Provider"
Server->>EmailSvc : sendEmailNotification(to, subject, html, text, attachments)
EmailSvc->>SMTP : Authenticate and send
SMTP-->>EmailSvc : Delivery confirmation
EmailSvc-->>Server : Result
```

### Legacy Supabase Client Mock
The frontend includes a legacy Supabase client mock and typed interfaces for compatibility. The mock provides basic auth and database-like operations, enabling frontend components to function without a live Supabase backend.

```mermaid
classDiagram
class SupabaseMock {
+auth.signOut()
+auth.onAuthStateChange()
+from(table).select()
+from(table).insert()
+from(table).update()
+from(table).delete()
}
class SupabaseService {
+query(operation)
+insert(table, data)
+update(table, data, match)
+delete(table, match)
+select(table, columns, filters)
}
SupabaseService --> SupabaseMock : "wraps"
```

## Dependency Analysis
The system exhibits clear separation of concerns:
- Frontend depends on React, React Router, Axios, and internal contexts/services.
- Backend depends on Express, database drivers, JWT libraries, and external services (email).
- Both layers rely on environment configuration for runtime behavior.

```mermaid
graph TB
FE_Pkg["Frontend Package.json"]
BE_Pkg["Backend Package.json"]
FE_Axios["Axios"]
FE_Router["React Router"]
FE_Contexts["Auth/Theme/Notifications Contexts"]
BE_Express["Express"]
BE_DB["mysql2/pg"]
BE_JWT["jsonwebtoken"]
BE_Email["nodemailer"]
Env_FE["Frontend Env (.env)"]
Env_BE["Backend Env (.env.example)"]
FE_Pkg --> FE_Axios
FE_Pkg --> FE_Router
FE_Pkg --> FE_Contexts
BE_Pkg --> BE_Express
BE_Pkg --> BE_DB
BE_Pkg --> BE_JWT
BE_Pkg --> BE_Email
Env_FE --> FE_Axios
Env_BE --> BE_DB
Env_BE --> BE_JWT
Env_BE --> BE_Email
```

## Performance Considerations
- Database Abstraction: Unified query execution with optional RETURNING id emulation and transaction support ensures efficient operations across MySQL/MariaDB and PostgreSQL.
- Connection Pooling: Configurable pools improve throughput and reduce connection overhead.
- Pagination Utilities: Sanitized pagination parameters prevent excessive memory usage and optimize query performance.
- Retry Logic: Supabase service wrapper implements exponential backoff for transient failures.
- Rate Limiting: Express rate limiter protects endpoints from abuse.
- Cron Jobs: Scheduled tasks for weekly summaries and backups are timezone-aware and configurable.

## Troubleshooting Guide
Common issues and resolutions:
- Authentication Failures
  - Verify JWT secret and expiration settings in environment variables.
  - Ensure the Authorization header is present for protected routes.
- Database Connectivity
  - Confirm DB client selection and credentials; test connection using provided helpers.
  - Check SSL settings for PostgreSQL providers.
- Email Delivery
  - Validate SMTP configuration and sender details; confirm credentials and port/security settings.
- CORS Errors
  - Add frontend origins to the configured origins list in the backend.
- MFA Setup
  - Temporary MFA setup tokens allow enrollment; ensure proper handling and redirection.

## Conclusion
The Assets Management System employs a clean separation between a React frontend and a Node.js/Express backend, secured by JWT-based authentication and robust RBAC. The backend’s database abstraction supports multiple engines, while cron-based automation streamlines administrative tasks. The presence of a legacy Supabase client mock indicates a migration-ready frontend architecture. The documented patterns enable scalable deployments, strong security controls, and maintainable development practices.
