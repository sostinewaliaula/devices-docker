# User Dashboard & Personal Features

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
This document provides comprehensive documentation for the User Dashboard and Personal Features module. It covers the user dashboard overview, personal asset tracking, individual issue management, asset request workflows, approval processes, status tracking, personal issue detail views, collaborative commenting, resolution updates, profile management, personal settings, notification preferences, personal reporting features, activity timelines, and self-service capabilities. It also includes user onboarding, help resources, support access, workflow optimization shortcuts, and productivity tools with practical examples.

## Project Structure
The user-facing personal features are implemented as React components under the `/src/pages/user` directory, with supporting components and services in `/src/components` and `/src/services`. The architecture follows a clear separation of concerns:
- Pages: UserDashboard, UserAssets, UserAssetRequests, UserIssues, UserIssueDetail
- Shared: Profile, Settings
- Components: AssetImage, CommentsSection, NotificationPreferences
- Services: apiDatabase (API client), notificationPreferencesService

```mermaid
graph TB
subgraph "User Pages"
UD["UserDashboard.tsx"]
UA["UserAssets.tsx"]
UAR["UserAssetRequests.tsx"]
UI["UserIssues.tsx"]
UID["UserIssueDetail.tsx"]
end
subgraph "Shared Pages"
PROF["Profile.tsx"]
SET["Settings.tsx"]
end
subgraph "Components"
IMG["AssetImage.tsx"]
CMNT["CommentsSection.tsx"]
NPREF["NotificationPreferences.tsx"]
end
subgraph "Services"
APIS["apiDatabase.ts"]
end
UD --> APIS
UA --> APIS
UAR --> APIS
UI --> APIS
UID --> APIS
PROF --> APIS
SET --> APIS
UID --> CMNT
UA --> IMG
UD --> IMG
SET --> NPREF
```

## Core Components
This section outlines the primary components that deliver user dashboard and personal features:

- UserDashboard: Provides a personalized overview with quick actions, assigned devices summary, recent issues, and modal forms for reporting issues and requesting assets.
- UserAssets: Displays a user's assigned assets, supports filtering/searching, and enables reporting issues per asset.
- UserAssetRequests: Allows users to track, edit, and delete their asset requests with comments and status visibility.
- UserIssues: Lists issues reported by the user, supports filtering, search, and inline editing/deletion.
- UserIssueDetail: Detailed view for an issue with comments, resolution notes, and collaborative editing controls.
- Profile: Self-service profile management with personal information updates and password changes.
- Settings: Centralized personal settings including notification preferences, MFA configuration, and account information.
- NotificationPreferences: Configurable notification channels and frequencies.
- CommentsSection: Collaborative commenting for asset requests.
- AssetImage: Dynamic asset image rendering with fallbacks.

## Architecture Overview
The user personal features follow a unidirectional data flow:
- Components consume services (apiDatabase) to fetch and mutate data.
- Contexts (AuthContext, NotificationContext) provide global state and notifications.
- UI components render lists, forms, and modals with controlled state and validation.
- Backend APIs handle business logic, notifications, and audit logging.

```mermaid
sequenceDiagram
participant User as "User"
participant Dashboard as "UserDashboard"
participant Assets as "UserAssets"
participant Issues as "UserIssues"
participant Detail as "UserIssueDetail"
participant API as "apiDatabase.ts"
participant Backend as "Backend API"
User->>Dashboard : Navigate to Dashboard
Dashboard->>API : Fetch assigned assets + reported issues
API->>Backend : GET /assets?assigned_to=user_id<br/>GET /issues?reported_by=user_id
Backend-->>API : Assets + Issues data
API-->>Dashboard : Data enriched with asset names
Dashboard-->>User : Render dashboard widgets
User->>Assets : View assigned devices
Assets->>API : GET /assets (filtered by user)
API->>Backend : GET /assets
Backend-->>API : Assets[]
API-->>Assets : Assets[]
Assets-->>User : Render asset list with actions
User->>Issues : View reported issues
Issues->>API : GET /issues (filtered by reporter)
API->>Backend : GET /issues
Backend-->>API : Issues[]
API-->>Issues : Issues[]
Issues-->>User : Render issues with filters
User->>Detail : Open issue detail
Detail->>API : GET /issues/ : id (with comments + attachments)
API->>Backend : GET /issues/ : id
Backend-->>API : Issue + Comments + Attachments
API-->>Detail : Data
Detail-->>User : Render comments + resolution + actions
```

## Detailed Component Analysis

### User Dashboard
The dashboard serves as a central hub for users to:
- View quick actions (View Devices, Report Issue, Notifications)
- See assigned devices summary and recent issues
- Report issues via a modal with attachments
- Access notifications and manage personal workflows

Key behaviors:
- Concurrently loads assigned assets and reported issues
- Enriches issues with asset names for better context
- Validates issue reports (title length, description length, category selection)
- Handles file uploads with attachment limits and previews
- Triggers notification refresh upon successful submissions

```mermaid
flowchart TD
Start(["User opens Dashboard"]) --> LoadData["Fetch assigned assets + reported issues"]
LoadData --> Enrich["Enrich issues with asset names"]
Enrich --> Render["Render dashboard widgets"]
Render --> Actions{"User clicks action"}
Actions --> |Report Issue| OpenIssueModal["Open Issue Report Modal"]
Actions --> |View Devices| NavigateAssets["Navigate to User Assets"]
Actions --> |Notifications| NavigateNotif["Navigate to Notifications"]
OpenIssueModal --> Validate["Validate form inputs"]
Validate --> |Valid| SubmitIssue["Submit issue via API"]
Validate --> |Invalid| ShowErrors["Show validation errors"]
SubmitIssue --> Notify["Trigger notification refresh"]
Notify --> CloseModal["Close modal and reset form"]
CloseModal --> End(["Dashboard updated"])
```

### Personal Asset Tracking
The personal asset tracking feature allows users to:
- View assigned devices with images, status, and location
- Search and filter assets by type and status
- Report issues directly from the asset list
- Manage assets (view details, report issues)

Implementation highlights:
- Uses AssetImage component for dynamic image rendering
- Supports search by name, serial number, or type
- Filters by asset type and status
- Integrates issue reporting with selected asset context

```mermaid
sequenceDiagram
participant User as "User"
participant Assets as "UserAssets"
participant API as "apiDatabase.ts"
participant Backend as "Backend API"
User->>Assets : Open My Devices
Assets->>API : GET /assets (filtered by assigned user)
API->>Backend : GET /assets
Backend-->>API : Assets[]
API-->>Assets : Assets[]
Assets-->>User : Render asset table with actions
User->>Assets : Click "Report Issue" on an asset
Assets->>Assets : Open Issue Modal with preselected asset
Assets->>API : POST /issues (FormData with attachments)
API->>Backend : POST /issues
Backend-->>API : Issue created
API-->>Assets : Issue
Assets-->>User : Show success toast + refresh list
```

### Individual Issue Management
The individual issue management system provides:
- Comprehensive list of reported issues with status and priority
- Filtering by status and priority
- Inline editing and deletion for eligible issues
- Detailed view with comments, attachments, and resolution notes
- Collaborative commenting and attachment previews

```mermaid
sequenceDiagram
participant User as "User"
participant Issues as "UserIssues"
participant Detail as "UserIssueDetail"
participant API as "apiDatabase.ts"
participant Backend as "Backend API"
User->>Issues : View My Issues
Issues->>API : GET /issues?reported_by=user_id
API->>Backend : GET /issues
Backend-->>API : Issues[]
API-->>Issues : Issues[]
Issues-->>User : Render list with filters
User->>Detail : Open issue detail
Detail->>API : GET /issues/ : id
API->>Backend : GET /issues/ : id
Backend-->>API : Issue + Comments + Attachments
API-->>Detail : Data
Detail-->>User : Render comments + resolution + actions
User->>Detail : Add comment
Detail->>Backend : POST /issues/ : id/comments
Backend-->>Detail : Comment saved
Detail-->>User : Update comments list
```

### Asset Request Workflows
The asset request workflow enables users to:
- Track submitted requests with status and priority
- View admin notes and comments
- Edit pending requests and delete them
- Communicate via comments with administrators

```mermaid
flowchart TD
Start(["User submits asset request"]) --> Submit["POST /asset-requests"]
Submit --> Notify["Backend notifies admins + user"]
Notify --> Track["User tracks status in My Asset Requests"]
Track --> Pending{"Status: Pending?"}
Pending --> |Yes| Edit["Edit/Delete request (if allowed)"]
Pending --> |No| Comments["View admin comments/notes"]
Edit --> Save["Save edits"]
Save --> Track
Comments --> End(["Complete"])
```

### Profile Management and Settings
Profile management includes:
- Viewing and editing personal information (name, phone, position, department)
- Changing passwords with complexity requirements
- Managing notification preferences (email/in-app, types, frequency)
- Configuring two-factor authentication (TOTP) and recovery codes

Settings consolidates:
- Notification preferences UI
- MFA enrollment and verification
- Account information display
- System settings (admin-only)

```mermaid
sequenceDiagram
participant User as "User"
participant Profile as "Profile"
participant Settings as "Settings"
participant API as "apiDatabase.ts"
participant Backend as "Backend API"
User->>Profile : Open Profile
Profile-->>User : Display current info
User->>Profile : Edit profile
Profile->>API : PUT /users/ : id
API->>Backend : PUT /users/ : id
Backend-->>API : Updated user
API-->>Profile : Success
Profile-->>User : Show success toast
User->>Settings : Open Settings
Settings-->>User : Show notification preferences
Settings->>API : Update preferences
API->>Backend : Update preferences
Backend-->>API : Updated preferences
API-->>Settings : Success
Settings-->>User : Show success toast
```

### Collaboration and Communication
Collaboration features include:
- Comments on asset requests with nested replies
- Real-time comment addition and editing
- Deletion controls for authorized users
- Rich comment UI with timestamps and user identification

## Dependency Analysis
The personal features depend on:
- apiDatabase service for all CRUD operations
- Contexts for authentication and notifications
- Utility components for images and UI elements
- Backend APIs for business logic, notifications, and audit trails

```mermaid
graph LR
UD["UserDashboard.tsx"] --> APIS["apiDatabase.ts"]
UA["UserAssets.tsx"] --> APIS
UAR["UserAssetRequests.tsx"] --> APIS
UI["UserIssues.tsx"] --> APIS
UID["UserIssueDetail.tsx"] --> APIS
PROF["Profile.tsx"] --> APIS
SET["Settings.tsx"] --> APIS
NPREF["NotificationPreferences.tsx"] --> APIS
CMNT["CommentsSection.tsx"] --> APIS
IMG["AssetImage.tsx"] --> APIS
```

## Performance Considerations
- Concurrent data fetching reduces initial load time (e.g., dashboard loads assets and issues together).
- Memoization and controlled re-renders minimize unnecessary computations.
- Optimistic UI updates followed by backend synchronization improve perceived responsiveness.
- Image lazy-loading and fallbacks prevent blocking renders.
- Validation prevents invalid submissions, reducing server errors and retries.

## Troubleshooting Guide
Common issues and resolutions:
- Dashboard fails to load: Check network connectivity and authentication state; verify concurrent fetches and error notifications.
- Issue submission errors: Validate minimum lengths for title/description and ensure category selection; confirm attachment limits.
- Asset request not updating: Ensure status is pending; verify user permissions; check backend notifications.
- Profile update failures: Confirm required fields and password complexity; verify email uniqueness.
- Notification preferences not saving: Ensure user is authenticated; check service responses and toast messages.

## Conclusion
The User Dashboard and Personal Features module delivers a cohesive, efficient, and user-friendly experience for managing personal assets, tracking issues, and configuring preferences. Its modular architecture, robust service layer, and rich collaboration features enable streamlined workflows, improved productivity, and seamless self-service capabilities.
