# Backend Architecture

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
This document describes the backend architecture of the Express.js server for the Assets Management System. It focuses on the MVC-like structure, middleware stack, routing organization, database abstraction, service layer patterns, error handling, authentication and authorization, request validation, security measures, and operational scalability patterns. The backend supports both MySQL/MariaDB and PostgreSQL via a unified database abstraction layer and integrates robust auditing, notifications, and MFA capabilities.

## Project Structure
The backend follows a modular, feature-based organization:
- Entry point initializes middleware, routes, and background tasks.
- Routes define API endpoints grouped by domain (authentication, users, assets, issues, notifications, etc.).
- Middleware enforces security, rate limiting, validation, and authentication.
- Services encapsulate business logic and integrate with external systems (email, notifications).
- Utilities provide reusable helpers (pagination, audit logging).
- Config defines database connection pools and environment-driven behavior.
- Database schema and migrations define the persistent model.

```mermaid
graph TB
subgraph "Entry Point"
S["server.js"]
end
subgraph "Middleware"
SEC["Security<br/>helmet, cors, rate-limit"]
LOG["Logging<br/>morgan"]
VAL["Validation<br/>express-validator"]
AUTH["Auth<br/>JWT, RBAC"]
ERR["Error Handler"]
UP["Upload<br/>Multer"]
end
subgraph "Routes"
R_AUTH["/api/auth"]
R_USERS["/api/users"]
R_DEPTS["/api/departments"]
R_ASSETS["/api/assets"]
R_ISSUES["/api/issues"]
R_NOTIF["/api/notifications"]
R_AUDIT["/api/audit"]
R_BACKUPS["/api/backups"]
R_MFA["/api/mfa, /api/admin, /api/mfa-policies"]
R_EXPORTS["/api/exports"]
end
subgraph "Services"
SVC_NOTIF["notificationService.js"]
SVC_MFA["mfaService.js"]
SVC_EMAIL["emailService.js (via notificationService)"]
end
subgraph "Utils"
U_PAG["pagination.js"]
U_AUDIT["auditLogger.js"]
end
subgraph "Config"
CFG_DB["database.js"]
end
S --> SEC --> LOG --> VAL --> AUTH --> ERR
S --> R_AUTH
S --> R_USERS
S --> R_DEPTS
S --> R_ASSETS
S --> R_ISSUES
S --> R_NOTIF
S --> R_AUDIT
S --> R_BACKUPS
S --> R_MFA
S --> R_EXPORTS
R_AUTH --> SVC_NOTIF
R_AUTH --> SVC_MFA
R_USERS --> SVC_NOTIF
R_USERS --> U_AUDIT
R_AUTH --> CFG_DB
R_USERS --> CFG_DB
R_AUTH --> U_PAG
R_USERS --> U_PAG
SVC_NOTIF --> CFG_DB
SVC_MFA --> CFG_DB
CFG_DB --> SEC
```

## Core Components
- Express server bootstrap and middleware pipeline
- Unified database abstraction supporting MySQL/MariaDB and PostgreSQL
- Authentication middleware with JWT and role-based access control
- Route modules organized by domain
- Service layer for notifications, MFA, and email
- Utility modules for pagination and audit logging
- Error handling middleware with environment-aware responses

Key implementation highlights:
- Security-first middleware stack: helmet, CORS, rate limiting, body parsing, logging.
- Centralized database client selection and connection pooling.
- JWT-based authentication with temporary MFA setup tokens.
- Express validators for request validation.
- Audit logging for auth, CRUD, config, and backup operations.
- Pagination sanitizer for safe cursor-based queries.

## Architecture Overview
The backend employs a layered architecture:
- Presentation Layer: Express routes define API endpoints.
- Application Layer: Middleware orchestrates security, validation, and auth.
- Domain Layer: Route handlers coordinate service calls.
- Service Layer: Encapsulates business logic and integrations.
- Persistence Layer: Unified database abstraction with connection pooling.
- Infrastructure: Email notifications, cron-based tasks, and audit logging.

```mermaid
graph TB
C["Client"] --> E["Express Server<br/>server.js"]
E --> MW_SEC["Security & CORS"]
E --> MW_RATE["Rate Limit"]
E --> MW_LOG["Logging"]
E --> MW_VAL["Validation"]
E --> MW_AUTH["JWT Auth & RBAC"]
E --> ROUTES["Routes"]
ROUTES --> SRV["Services"]
SRV --> DB["Database Abstraction"]
SRV --> EMAIL["Email Service"]
E --> ERR["Global Error Handler"]
E --> AUD["Audit Logger"]
```

## Detailed Component Analysis

### Database Abstraction Layer
The database layer provides a unified interface for MySQL/MariaDB and PostgreSQL:
- Client selection via environment variable.
- Connection pooling with configurable limits and timeouts.
- Parameter normalization for Postgres placeholder compatibility.
- Transaction support with rollback semantics.
- Consistent result shape across clients.

```mermaid
classDiagram
class DatabaseAbstraction {
+executeQuery(query, params) Promise
+executeTransaction(queries) Promise
+testConnection() Promise
+closeConnections() Promise
}
class MySQLPool {
+getConnection()
+execute()
}
class PostgresPool {
+connect()
+query(text, values)
}
DatabaseAbstraction --> MySQLPool : "uses when DB_CLIENT=mysql"
DatabaseAbstraction --> PostgresPool : "uses when DB_CLIENT=postgres"
```

### Authentication and Authorization Middleware
Authentication middleware validates JWT tokens and enriches requests with user context. Authorization helpers enforce roles and department-level access controls. Temporary MFA setup tokens enable policy-compliant onboarding.

```mermaid
sequenceDiagram
participant Client as "Client"
participant AuthMW as "authenticateToken"
participant DB as "executeQuery"
participant Next as "Route Handler"
Client->>AuthMW : "Bearer <token>"
AuthMW->>AuthMW : "jwt.verify()"
alt "tempMfaSetup"
AuthMW->>Next : "req.user from decoded payload"
else "regular token"
AuthMW->>DB : "SELECT user by id"
DB-->>AuthMW : "user row"
AuthMW->>Next : "req.user validated"
end
```

### Route Organization and Controllers
Routes are grouped by domain and mounted under protected or public prefixes. Controllers delegate to services and utilities, returning structured JSON responses. Public endpoints (e.g., departments listing) bypass auth middleware.

```mermaid
graph LR
A["/api/auth"] --> A1["auth.js"]
B["/api/users"] --> B1["users.js"]
C["/api/departments"] --> C1["departments (mounted in server.js)"]
D["/api/assets"] --> D1["assets.js"]
E["/api/issues"] --> E1["issues.js"]
F["/api/notifications"] --> F1["notifications.js"]
G["/api/audit"] --> G1["audit.js"]
H["/api/backups"] --> H1["backups.js"]
I["/api/mfa, /api/admin, /api/mfa-policies"] --> I1["mfa-related routes"]
J["/api/exports"] --> J1["exports.js"]
```

### Service Layer Patterns
- Notification service encapsulates in-app and email notifications, with HTML/text templates and parallel dispatch.
- MFA service manages TOTP secrets, QR generation, token verification, factor activation, and recovery codes.
- Both services rely on the database abstraction for persistence.

```mermaid
classDiagram
class NotificationService {
+createNotification(userId, assetRequestId, type, title, message) Promise
+getUserNotifications(userId, limit, offset) Promise
+markAsRead(notificationId, userId) Promise
+markAllAsRead(userId) Promise
+getUnreadCount(userId) Promise
+sendEmailNotification(userEmail, subject, html, text, attachments) Promise
+notifyStatusChange(assetRequestId, oldStatus, newStatus, adminName) Promise
}
class MFAServce {
+generateSecret(userId, userEmail, friendlyName) Promise
+verifyToken(userId, factorId, token) Promise
+activateFactor(userId, factorId, token) Promise
+generateRecoveryCodes(userId, count) Promise
}
NotificationService --> DatabaseAbstraction : "uses"
MFAServce --> DatabaseAbstraction : "uses"
```

### Error Handling Strategy
A centralized error handler normalizes responses, maps database and JWT errors, and avoids leaking internal details in production. Validation errors are surfaced with structured details.

```mermaid
flowchart TD
Start(["Unhandled Exception"]) --> Catch["Global Error Handler"]
Catch --> Normalize["Normalize message/status"]
Normalize --> MapDB{"DB Error?"}
MapDB --> |Yes| DBMap["Map ER_* to user-friendly messages"]
MapDB --> |No| MapJWT{"JWT Error?"}
MapJWT --> |Yes| JWTMap["Map JsonWebTokenError/TokenExpiredError"]
MapJWT --> |No| RateLimit{"Status 429?"}
RateLimit --> |Yes| RLMsg["Override message"]
RateLimit --> |No| ProdCheck{"Production?"}
ProdCheck --> |Yes| Hide["Hide stack & details"]
ProdCheck --> |No| Dev["Include stack"]
DBMap --> Respond["Return JSON"]
JWTMap --> Respond
RLMsg --> Respond
Hide --> Respond
Dev --> Respond
```

### Request Validation and Sanitization
Validation is enforced via express-validator on route handlers. Pagination sanitization ensures safe limit/page/offset computation.

```mermaid
flowchart TD
Req["Incoming Request"] --> Validate["express-validator rules"]
Validate --> HasErrors{"Has validation errors?"}
HasErrors --> |Yes| Return400["Return 400 with details"]
HasErrors --> |No| Sanitize["sanitizePagination()"]
Sanitize --> Safe["Safe limit/page/offset"]
Safe --> Next["Route Handler"]
```

### Security Middleware Stack
Security measures include:
- Helmet for secure headers.
- CORS configured with dynamic origins and credentials support.
- Rate limiting with environment-configurable window and max requests.
- Morgan for structured logging.
- Body parsing with size limits.

```mermaid
graph LR
A["Helmet"] --> B["CORS"]
B --> C["Rate Limit"]
C --> D["Body Parser (JSON/URL-encoded)"]
D --> E["Morgan"]
```

### Upload and File Handling
Multer stores files in memory with type filtering and size limits. This enables streaming to external services or local storage.

```mermaid
flowchart TD
Req["HTTP Upload Request"] --> Filter["fileFilter()"]
Filter --> |Allowed| Store["memoryStorage()"]
Filter --> |Denied| Err["400 Invalid file type"]
Store --> Next["Route Handler"]
```

### Audit Logging
Centralized audit logger writes structured entries to the audit_logs table, supporting auth, CRUD, config, and backup events. It tolerates failures to avoid breaking the main flow.

```mermaid
sequenceDiagram
participant Route as "Route Handler"
participant Audit as "auditLogger"
participant DB as "executeQuery"
Route->>Audit : "logAuth()/logCRUD()/logBackup()"
Audit->>DB : "INSERT INTO audit_logs"
DB-->>Audit : "ack"
Audit-->>Route : "void"
```

### Data Model Overview
The schema defines core entities and relationships:
- Users, Departments, Assets, Issues, Notifications, Audit Logs, Asset Requests, and related lookup tables.

```mermaid
erDiagram
USERS {
char id PK
varchar email UK
varchar password_hash
varchar name
enum role
char department_id FK
boolean is_active
timestamp last_login
}
DEPARTMENTS {
char id PK
varchar name UK
varchar location
char manager_id
}
ASSETS {
char id PK
varchar name
varchar type
varchar serial_number UK
decimal purchase_price
decimal current_value
enum status
char assigned_to FK
char department_id FK
}
ISSUES {
char id PK
varchar title
enum status
enum priority
char reported_by FK
char assigned_to FK
char asset_id FK
char department_id FK
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
enum status
enum priority
}
USERS }o--|| DEPARTMENTS : "belongs to"
ASSETS }o--|| USERS : "assigned to"
ASSETS }o--|| DEPARTMENTS : "department"
ISSUES }o--|| USERS : "reported by"
ISSUES }o--|| USERS : "assigned to"
ISSUES }o--|| ASSETS : "asset"
NOTIFICATIONS }o--|| USERS : "user"
AUDIT_LOGS }o--|| USERS : "user"
ASSET_REQUESTS }o--|| USERS : "user"
```

## Dependency Analysis
External dependencies include Express, helmet, cors, rate-limit, bcrypt, JWT, Morgan, Multer, mysql2/pg, node-cron, nodemailer, and others. These enable routing, security, persistence, scheduling, and communications.

```mermaid
graph TB
P["package.json"] --> E["express"]
P --> H["helmet"]
P --> C["cors"]
P --> RL["express-rate-limit"]
P --> V["express-validator"]
P --> B["bcryptjs"]
P --> J["jsonwebtoken"]
P --> M["morgan"]
P --> MU["multer"]
P --> MY["mysql2"]
P --> PG["pg"]
P --> CR["node-cron"]
P --> N["nodemailer"]
```

## Performance Considerations
```bash
# Connection pooling
MySQL pool defaults to 10 concurrent connections; PostgreSQL pool mirrors with similar concurrency and timeouts. Adjust via environment variables for workload characteristics.
```
- Query normalization: Postgres placeholder conversion and RETURNING id emulation reduce adapter differences.
- Pagination: sanitizePagination caps limits and computes offsets safely to prevent heavy queries.
- Logging overhead: Morgan logging is environment-aware; disable verbose logging in production if needed.
- Upload buffering: Multer memory storage avoids disk I/O for small files; consider streaming to external storage for large payloads.
- Background tasks: node-cron schedules periodic notifications and backups; ensure adequate worker resources.

## Troubleshooting Guide
Common issues and resolutions:
- Database connectivity: Use testConnection to verify pool health; check DB_CLIENT, host, port, user, password, and SSL settings.
- JWT errors: Invalid/expired tokens return 401; confirm JWT_SECRET and expiration alignment.
- Validation failures: express-validator returns structured details; review route-specific rules.
- Rate limiting: Excessive requests yield 429; adjust RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX_REQUESTS.
- CORS errors: Confirm FRONTEND_URL(s) and credentials flag; ensure origin matches client.
- Audit logging failures: The audit logger is resilient and does not throw; check console for suppressed errors.

## Conclusion
The backend implements a clean, layered architecture with strong emphasis on security, maintainability, and scalability. The unified database abstraction, robust middleware stack, modular routes, and dedicated service layer collectively support a reliable API. Operational excellence is reinforced by comprehensive audit logging, structured error handling, and environment-driven configuration.
