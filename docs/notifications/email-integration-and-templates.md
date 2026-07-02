# Email Integration & Templates

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
10. [Appendices](#appendices)

## Introduction
This document explains the email notification system integration for the assets management platform. It covers the backend email service architecture, SMTP configuration, database-backed email templates, frontend email configuration, and the weekly notification scheduling feature. It also documents how emails are rendered, delivered via a Supabase Edge Function, and how to configure, customize, and troubleshoot the system for reliable, scalable email delivery.

## Project Structure
The email system spans three layers:
- Backend Node.js service that initializes SMTP transport, renders branded emails, and sends them via a Supabase Edge Function.
- Frontend configuration and service that orchestrates email sending, validates configuration, and supports bulk operations.
- Database migrations that define the email templates and SMTP settings schema.

```mermaid
graph TB
subgraph "Frontend"
FE_Config["emailConfig.ts<br/>Frontend SMTP config"]
FE_Service["emailNotificationService.ts<br/>Frontend email orchestration"]
FE_UI["WeeklyNotifications.tsx<br/>Weekly schedule UI"]
end
subgraph "Backend"
BE_EmailSvc["emailService.js<br/>SMTP init, templates, branding"]
BE_Routes["notifications.js<br/>Notifications API"]
end
subgraph "Database"
DB_Templates["email_templates.sql<br/>Templates schema"]
DB_ModernTpl["modern_email_template.sql<br/>Password reset template"]
DB_SMTP["ensure_smtp_settings.sql<br/>SMTP settings schema"]
DB_UserPref["add_email_notifications_column.sql<br/>User preference flag"]
end
subgraph "External"
Supabase["Supabase Edge Functions"]
end
FE_Config --> FE_Service
FE_Service --> Supabase
FE_UI --> FE_Service
BE_EmailSvc --> Supabase
BE_Routes --> BE_EmailSvc
DB_Templates --> BE_EmailSvc
DB_ModernTpl --> BE_EmailSvc
DB_SMTP --> BE_EmailSvc
DB_UserPref --> FE_Service
```

## Core Components
- Backend Email Service
  - Initializes SMTP transport from database/system settings.
  - Renders branded HTML emails with optional embedded logo.
  - Sends password reset emails using database-stored templates.
  - Provides connection verification and branded email dispatch.
- Frontend Email Configuration
  - Defines SMTP defaults and branding options.
  - Exposes helpers to check email enablement and configuration.
- Frontend Email Notification Service
  - Orchestrates sending via Supabase Edge Functions.
  - Supports bulk sending and basic configuration checks.
- Database Templates and SMTP Settings
  - Schema for email templates and variables.
  - Modern password reset template with placeholders.
  - SMTP settings table with keys for host, port, credentials, and branding.

## Architecture Overview
The system integrates frontend configuration with backend rendering and Supabase Edge Functions for delivery. The frontend invokes a Supabase Edge Function to send emails, while the backend can also render and send branded emails directly when needed.

```mermaid
sequenceDiagram
participant UI as "WeeklyNotifications.tsx"
participant FE as "emailNotificationService.ts"
participant SB as "Supabase Edge Functions"
participant DB as "Database"
UI->>FE : "sendNotificationEmail(data)"
FE->>SB : "invoke send-email-notification"
SB-->>FE : "{ success }"
FE-->>UI : "boolean result"
Note over FE,DB : "Backend can also use emailService.js to render and send"
FE->>DB : "check user preferences (optional)"
DB-->>FE : "preferences"
```

## Detailed Component Analysis

### Backend Email Service
Responsibilities:
- Initialize SMTP transport from database/system settings.
- Load email templates from the database and substitute variables.
- Render a modern branded HTML email with optional embedded logo.
- Send emails via Supabase Edge Functions or direct SMTP.

Key behaviors:
- Transport initialization merges database and environment overrides.
- Branded renderer composes HTML with dynamic variables and optional logo attachment.
- Password reset flow fetches template by name and performs placeholder replacement.

```mermaid
classDiagram
class EmailService {
-transporter
-initialized
-smtp_from
-brand_name
-email_logo_url
+initializeTransporter(force=false)
+sendPasswordResetEmail(email,name,resetCode)
+sendNotificationEmail(email,subject,message)
+renderBrandedEmail(options) string
+sendBrandedNotificationEmail(to,subject,options)
+testConnection()
}
```

### Frontend Email Configuration
Defines SMTP defaults and branding options for the client-side configuration. Includes helper to check if email is enabled based on presence of credentials and sender email.

Highlights:
- SMTP host/port/secure/auth derived from environment variables.
- Sender name and email configurable.
- Template branding colors and default subject.
- Preferences for default enabled state, default types, retries, and retry delay.

### Frontend Email Notification Service
Orchestrates email sending and configuration checks:
- Sends individual and bulk notifications via Supabase Edge Functions.
- Tests email configuration by invoking the Edge Function and checking user preferences.
- Provides a template factory for generating HTML and text bodies.

```mermaid
sequenceDiagram
participant Caller as "Caller"
participant Service as "EmailNotificationService"
participant SB as "Supabase Edge Functions"
Caller->>Service : "sendNotificationEmail(data)"
Service->>Service : "createEmailTemplate(data)"
Service->>SB : "invoke send-email-notification"
SB-->>Service : "{ error }"
Service-->>Caller : "boolean"
```

### Email Templates and Variables
Templates are stored in the database with subject, body, and supported variables. The modern password reset template includes placeholders for user name and reset code.

```mermaid
erDiagram
EMAIL_TEMPLATES {
char id PK
varchar name UK
varchar subject
text body
json variables
boolean is_active
timestamp created_at
timestamp updated_at
}
```

### SMTP Configuration and Provider Support
SMTP settings are persisted in the system settings table and can be overridden by environment variables. The backend initializes the transporter using host, port, secure flag, and credentials, then sets a branded sender address.

- Keys include host, port, user, pass, secure, sender address, logo URL, and brand name.
- Environment variables serve as fallbacks for runtime configuration.

### User Notification Preferences
A per-user flag controls whether email notifications are enabled. Defaults to enabled for existing users.

### Weekly Notification Scheduling (Admin UI)
The admin UI allows configuring weekly notifications for unresolved issues and pending asset requests. It supports enabling/disabling, selecting days, setting time and timezone, and triggering tests.

```mermaid
flowchart TD
Start(["Open Weekly Notifications"]) --> Load["Load current schedule"]
Load --> Config["Configure: enabled/days/time/timezone"]
Config --> Save["Save schedule"]
Config --> Test["Test now"]
Save --> Done(["Updated"])
Test --> Result{"Sent?"}
Result --> |Yes| Success["Show stats and success"]
Result --> |No| Failure["Show error"]
```

## Dependency Analysis
- Frontend depends on Supabase Edge Functions for sending emails.
- Backend depends on database for SMTP settings and email templates.
- Both layers depend on environment variables for fallback configuration.
- Notifications API supports retrieving and managing notifications.

```mermaid
graph LR
FE["emailNotificationService.ts"] --> SB["Supabase Edge Functions"]
BE["emailService.js"] --> DB["Database (SMTP settings, templates)"]
FE --> ENV["Environment Variables"]
BE --> ENV
BE --> API["Backend Routes (notifications.js)"]
```

## Performance Considerations
- Asynchronous processing: Frontend bulk sending iterates sequentially; consider batching and concurrency limits for high-volume scenarios.
- Edge Function invocation overhead: Centralize template creation on the server to reduce payload sizes and leverage database-backed templates.
- Logo embedding: Optional embedded logo adds attachment overhead; disable embedding in high-volume scenarios.
- Retry strategy: Frontend configuration exposes retry count and delay; implement exponential backoff at the caller level for resilience.
- Caching: Cache SMTP settings and templates to minimize repeated database queries during bursts.

## Troubleshooting Guide
Common issues and resolutions:
- Missing SMTP configuration
  - Ensure SMTP host, port, user, and pass are present in system settings or environment variables.
  - Use the connection test method to verify connectivity.
- Template not found
  - Confirm the template exists and is active in the database.
  - Verify the template name matches the lookup key.
- Email sending fails
  - Check Edge Function accessibility and error responses.
  - Validate user preferences and notification flags.
- Logo embedding errors
  - Disable logo embedding or provide a valid logo path.
- Environment variables
  - Review frontend environment configuration and ensure required keys are set.

## Conclusion
The email integration combines a robust backend email service with database-backed templates, a flexible frontend configuration, and a weekly notification scheduler. By centralizing SMTP configuration, leveraging Edge Functions for delivery, and supporting customizable templates and branding, the system provides a scalable foundation for automated email communication.

## Appendices

### SMTP Configuration Options
- Keys and categories
  - smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, smtp_from, email_logo_url, brand_name
- Environment variable fallbacks
  - Host, port, user, pass, secure, sender, logo URL, brand name can be supplied via environment variables.

### Email Template Variables
- Supported variables
  - user_name, reset_code (example: password reset)
- Template lookup
  - Templates are fetched by name and activated flag.

### Example Workflows

- Sending a password reset email
  - Backend loads the password reset template from the database, substitutes variables, and sends a branded email.
  
  ```mermaid
sequenceDiagram
participant Caller as "Caller"
participant BE as "emailService.js"
participant DB as "Database"
participant SB as "Supabase Edge Functions"
Caller->>BE : "sendPasswordResetEmail(email,name,resetCode)"
BE->>DB : "SELECT subject, body FROM email_templates WHERE name='password_reset'"
DB-->>BE : "Template data"
BE->>BE : "Replace {{user_name}}, {{reset_code}}"
BE->>SB : "sendBrandedNotificationEmail(...)"
SB-->>BE : "{ success, messageId }"
BE-->>Caller : "Result"
```

    - `emailService.js:73-118`
  - `2024-12-19_modern_email_template.sql:6-131`

- Sending a generic notification email
  - Frontend composes HTML and text bodies and invokes the Edge Function.

    - `emailNotificationService.ts:166-239`
  - `emailNotificationService.ts:31-55`

- Weekly notification scheduling
  - Admin configures schedule, triggers a test, and receives feedback on delivery statistics.

    - `WeeklyNotifications.tsx:51-128`

### Best Practices
- Prefer database-backed templates for maintainability and localization.
- Use Edge Functions for delivery to offload SMTP to the cloud provider.
- Implement retry with backoff and circuit breaker patterns for high-volume sending.
- Monitor delivery failures and maintain logs for debugging.
- Keep branding consistent by centralizing sender name and logo configuration.
