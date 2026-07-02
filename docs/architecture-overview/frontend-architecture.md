# Frontend Architecture

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
This document describes the frontend architecture of the React application, focusing on component hierarchy, context-based state management, routing architecture, role-based access control, global state patterns, reusable UI components, external library integrations, build system configuration, development workflow, deployment pipeline, performance optimization strategies, and code-splitting techniques.

## Project Structure
The frontend is organized around a layered structure:
- Root entry renders the application shell and providers
- Routing defines protected and public routes with role-based guards
- Providers encapsulate cross-cutting concerns (authentication, notifications, theming, branding)
- Pages represent feature areas grouped by roles
- Components encapsulate UI and layout
- Services abstract API communication and interceptors
- Build tooling configured via Vite

```mermaid
graph TB
A["index.tsx<br/>Root render"] --> B["App.tsx<br/>Routing + Providers"]
B --> C["Layout.tsx<br/>Shell + Outlet"]
C --> D["Header.tsx<br/>Top bar"]
C --> E["Sidebar.tsx<br/>Navigation"]
B --> F["AuthContextNew.tsx<br/>Auth state"]
B --> G["NotificationContext.tsx<br/>Notifications + Toasts"]
B --> H["ThemeContext.tsx<br/>Theme state"]
B --> I["BrandingContext.tsx<br/>Branding settings"]
B --> J["apiService.ts<br/>Axios + interceptors"]
K["UserDashboard.tsx<br/>Feature page"] --> J
```

## Core Components
- Application shell and routing: Centralized in App.tsx with nested routes, role redirects, and guards
- Providers: Auth, Notifications, Theme, Branding, and Google OAuth provider
- Layout: Responsive shell with Header and Sidebar
- UI: ToastContainer and reusable UI components
- Services: Axios-based API client with request/response interceptors
- Pages: Feature-specific pages grouped by role

Key responsibilities:
- App.tsx orchestrates routing, guards, and provider composition
- AuthContextNew manages authentication state, MFA flows, and user metadata
- NotificationContext centralizes notifications and toast lifecycle
- ThemeContext persists and applies theme preferences
- BrandingContext loads and applies branding settings
- apiService centralizes HTTP calls and error handling
- Layout composes Header and Sidebar and exposes outlet for routed content

## Architecture Overview
The frontend follows a provider-centric architecture:
- Providers wrap the routing tree to supply global state and services
- Routing enforces authentication and role-based access
- Layout composes navigation and content area
- Services abstract HTTP communication and error handling

```mermaid
graph TB
subgraph "Providers"
P1["Auth Provider"]
P2["Notification Provider"]
P3["Theme Provider"]
P4["Branding Provider"]
P5["Google OAuth Provider"]
end
subgraph "Routing"
R1["Public Routes"]
R2["Protected Routes"]
R3["Role Guards"]
end
subgraph "UI Shell"
S1["Layout"]
S2["Header"]
S3["Sidebar"]
end
subgraph "Services"
SV1["apiService (Axios)"]
end
P5 --> P1 --> P2 --> P4 --> P3 --> R1
R1 --> R2 --> R3 --> S1 --> S2
S1 --> S3
R3 --> SV1
```

## Detailed Component Analysis

### Routing and Role-Based Access Control
- Public routes: Login, registration, password reset, MFA setup, and legal pages
- Protected routes: Wrapped with RequireAuth to enforce authentication
- Role guards: RequireAdmin and RequireManager restrict access by role
- Index redirect: RoleIndexRedirect navigates users to role-specific dashboards
- Nested routes: Admin, Manager, and User route groups encapsulate feature areas

```mermaid
sequenceDiagram
participant U as "User"
participant R as "Router"
participant GA as "RequireAuth"
participant RG as "Role Guards"
participant L as "Layout"
U->>R : Navigate to "/admin/dashboard"
R->>GA : Check authentication
GA-->>R : Authenticated?
alt Authenticated
R->>RG : Check role (admin/manager/user)
RG-->>R : Authorized?
alt Authorized
R->>L : Render Layout + Outlet
L-->>U : Render Admin Dashboard
else Unauthorized
R-->>U : Redirect to "/user/dashboard"
end
else Not authenticated
R-->>U : Redirect to "/login"
end
```

### Authentication Context Pattern
AuthContextNew encapsulates:
- User state, loading flags, and role flags
- Authentication actions: login, register, logout, MFA flows
- Profile updates, password management, and OAuth login
- Local storage persistence and token verification on startup
- Memoized value object to prevent unnecessary re-renders

```mermaid
classDiagram
class AuthContextType {
+user
+loading
+login(email,password)
+verifyMfaLogin(userId,factorId,token)
+register(userData)
+googleLogin(credential)
+completeGoogleProfile(data)
+logout()
+updateProfile(userData)
+changePassword(old,new)
+forgotPassword(email)
+resetPassword(token,password)
+validateResetToken(token)
+verifyResetCode(email,code)
+changePasswordWithCode(email,code,password)
+isAuthenticated
+isAdmin
+isManager
+startEnrollTotp(friendlyName)
+verifyEnrollTotp(factorId,token)
+disableTotp(factorId)
+listMfaFactors()
}
class AuthProvider {
+useState(user,loading,initializing)
+useEffect(initAuth)
+login()
+verifyMfaLogin()
+register()
+googleLogin()
+completeGoogleProfile()
+logout()
+updateProfile()
+changePassword()
+forgotPassword()
+resetPassword()
+validateResetToken()
+verifyResetCode()
+changePasswordWithCode()
+startEnrollTotp()
+verifyEnrollTotp()
+disableTotp()
+listMfaFactors()
}
AuthProvider --> AuthContextType : "provides"
```

### Notification and Toast Management
NotificationContext provides:
- Fetching, marking as read, and deleting notifications
- Unread count tracking and polling
- Toast queue management with auto-dismiss
- Integration with authentication state to avoid retries on auth errors

```mermaid
flowchart TD
Start(["Fetch Notifications"]) --> CheckAuth["Check Auth Status"]
CheckAuth --> |Unauthorized| Stop["Stop Polling/Error"]
CheckAuth --> |Authorized| Request["HTTP GET /notifications"]
Request --> Success{"Success?"}
Success --> |Yes| Normalize["Normalize is_read booleans"]
Normalize --> UpdateState["Update notifications + unreadCount"]
UpdateState --> Poll["Schedule next poll (30s)"]
Success --> |No| HandleError["Set authError if 401"]
HandleError --> Poll
Poll --> CheckAuth
```

### Theme and Branding Contexts
- ThemeContext persists and applies theme preference, supporting system theme detection
- BrandingContext loads public settings (site name, browser title, logos, favicon) and synchronizes with DOM

```mermaid
graph LR
TC["ThemeContext.tsx"] --> DOC["document.documentElement"]
BC["BrandingContext.tsx"] --> SET["settingsAPI.getPublicSettings()"]
BC --> DOM["document.title/favicon"]
```

### Layout Composition Patterns
- Layout composes Header and Sidebar and exposes Outlet for routed content
- Header integrates with Auth, Theme, and Notification contexts
- Sidebar adapts navigation based on user role and maintains active state

```mermaid
classDiagram
class Layout {
+useState(sidebarOpen)
+toggleSidebar()
}
class Header {
+useAuth()
+useTheme()
+useNotifications()
}
class Sidebar {
+useAuth()
+useNotifications()
+useBranding()
}
Layout --> Header : "contains"
Layout --> Sidebar : "contains"
```

### API Client and Interceptors
- Axios instance configured with base URL, credentials, and timeouts
- Request interceptor adds Authorization header from localStorage
- Response interceptor handles 401 by clearing auth and redirecting to login
- Strongly typed APIs for auth, users, departments, assets, issues, notifications, budget, and settings

```mermaid
sequenceDiagram
participant C as "Component"
participant AX as "apiService"
participant INT as "Interceptors"
participant BE as "Backend"
C->>AX : authAPI.login(email,password)
AX->>INT : Request Interceptor (add Bearer token)
INT->>BE : HTTP POST /auth/login
BE-->>INT : Response (200/401)
INT-->>AX : Response (200) or error (401)
alt 401
INT->>INT : Clear localStorage + redirect to /login
end
AX-->>C : Result or error
```

### Example Page: UserDashboard
- Demonstrates composition of contexts (Auth, Notifications), services, and UI
- Concurrent data fetching and enrichment
- Form handling with validation and submission
- Toast and notification integration

```mermaid
flowchart TD
Enter(["UserDashboard Mount"]) --> CheckUser["Check user.id"]
CheckUser --> |Missing| InitEmpty["Initialize empty lists"]
CheckUser --> |Present| Fetch["Concurrent fetch: assets, issues, types"]
Fetch --> Enrich["Enrich issues with asset names"]
Enrich --> Success["Set state + success toast"]
InitEmpty --> Done(["Render"])
Success --> Done
```

## Dependency Analysis
External dependencies include React, React Router, Axios, Lucide icons, Recharts, Tailwind CSS, and Vite. The build system splits bundles by feature and vendor libraries.

```mermaid
graph TB
subgraph "Runtime Dependencies"
D1["react"]
D2["react-dom"]
D3["react-router-dom"]
D4["@react-oauth/google"]
D5["axios"]
D6["lucide-react"]
D7["recharts"]
end
subgraph "Build Tooling"
B1["vite"]
B2["@vitejs/plugin-react"]
B3["terser"]
B4["tailwindcss"]
end
D1 --> D3
D1 --> D4
D5 --> D1
D6 --> D1
D7 --> D1
B1 --> B2
B1 --> B3
B1 --> B4
```

## Performance Considerations
- Code splitting and chunking:
  - Manual chunks separate vendor, router, UI, and utils libraries
  - Dynamic chunk names with hashed filenames
- Minification and source maps:
  - Terser minification with console/debugger removal
  - Production disables source maps
- Build targets and CSS splitting:
  - ES2015 target, CSS code splitting
- Bundle size monitoring:
  - Increased chunk size warning threshold
- Development proxy:
  - Configured proxy for API traffic with logging

Recommendations:
- Lazy-load heavy pages and modals using dynamic imports
- Defer non-critical resources
- Use React.memo and useMemo for expensive computations
- Virtualize long lists in pages

## Troubleshooting Guide
Common issues and resolutions:
- Authentication errors:
  - 401 responses trigger automatic logout and redirect to login
  - Verify localStorage tokens and network connectivity
- Notification polling:
  - Auth errors halt polling; ensure authentication state is valid
  - Use custom event refresh to force reload
- Theme and branding:
  - Confirm theme preference persistence and system theme changes
  - Validate favicon and browser title updates
- Build and preview:
  - Use dev script for local development
  - Preview builds locally to validate production behavior

## Conclusion
The frontend employs a robust, provider-driven architecture with clear separation of concerns. Routing and guards enforce role-based access, while contexts manage global state for authentication, notifications, theme, and branding. The API client centralizes HTTP operations with interceptors for resilience. The build system emphasizes performance via code splitting, minification, and optimized chunking. Pages demonstrate composition patterns and integration with services and UI components.

## Appendices
- TypeScript configuration supports bundler mode and strict linting
- Development workflow includes scripts for dev, build, preview, and backend coordination

- `package.json:6-16`
