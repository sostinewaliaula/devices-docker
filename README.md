## Assets Management System – Full Setup & Guide

This document provides end-to-end setup, configuration, and operations for the system across frontend, Supabase backend, Edge Functions, and common troubleshooting.

### 1) Tech Stack
- React + TypeScript + Vite
- Supabase (Postgres, Auth, Storage, RLS, RPC)
- Supabase Edge Functions (Deno)

### 2) Local Prerequisites
- Node.js 18+
- PNPM or NPM
- Supabase CLI (Windows): `choco install supabase -y`
- Supabase project ref (e.g., `myvmqncragvxfmwztnml`)

### 3) Environment Variables (.env)
Frontend uses Vite env vars (no quotes, KEY=VALUE):
```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon_key>
```
Notes:
- Keep lines strictly `KEY=VALUE`. Comments start with `#`.
- Do not include `export` or wrap keys in quotes.

### 4) Project Install & Run
```powershell
pnpm install   # or npm install
pnpm dev       # or npm run dev
```

### 5) Supabase Project Link & Auth
```powershell
supabase login
supabase link --project-ref <project-ref>
```

### 6) Database Schema & Security
Run the SQL files in order via Supabase SQL Editor:
1. `database-schema.sql` (base tables, triggers, policies for issues, comments, notifications if present)
2. `supabase_notifications.sql` (RPCs: create/get/mark read)
3. `supabase_asset_requests.sql` (asset_requests table + RLS)
4. `supabase_asset_requests_rpc.sql` (create_asset_request RPC)

Comments (issue_comments):
- Ensure RLS uses UUID/text casts correctly when comparing with `auth.uid()`.
- Example policy fix: `user_id::text = auth.uid()` for UPDATE/DELETE.

Notifications:
- Use RPCs (SECURITY DEFINER) for inserts and reads:
  - `public.create_notification`
  - `public.get_notifications_for_user`
  - `public.mark_notification_read`
  - `public.mark_all_notifications_read`

Asset Requests:
- Table: `public.asset_requests`
- RPC: `public.create_asset_request` (SECURITY DEFINER) for inserts

### 7) Edge Functions
Function: `admin_create_user` creates auth user (password-set) and upserts `public.users` profile.

Secrets:
- Do not prefix with `SUPABASE_` when setting via CLI.
```powershell
supabase secrets set SERVICE_ROLE_KEY="<service_role_key>"
```

Deploy & Test:
```powershell
supabase functions deploy admin_create_user --no-verify-jwt
supabase functions invoke admin_create_user --no-verify-jwt --body '{
  "email":"new.user@example.com",
  "name":"New User",
  "role":"user",
  "department_id":null,
  "position":null,
  "phone":null,
  "password":"Password123!"
}'
```

Reference: `SUPABASE_FUNCTIONS_SETUP.md` for detailed instructions and Windows-specific tips.

### 8) Frontend Services & Key Integrations
- `src/services/database.ts` centralizes Supabase calls.
  - `commentService`: CRUD for `issue_comments` with `user_name` payload.
  - `notificationService`: uses RPCs for persistence and reads.
  - `assetService`, `issueService`, `userService`, `assetRequestsService` (RPC for create).
- `src/lib/supabase.ts` defines TypeScript interfaces.
- `src/contexts/NotificationContext.tsx` manages unread counts and toasts.

### 9) Core Pages & Features
- Admin
  - `src/pages/admin/AssetManagement.tsx`: edit assets, assignment notifications.
  - `src/pages/admin/IssueManagement.tsx`: issues list from backend, comments, status updates as system comments.
  - `src/pages/admin/UserManagement.tsx`: add/edit users; Add User calls `admin_create_user`.
- User
  - `src/pages/user/UserDashboard.tsx`: assets/issues for logged-in user; report issue modal.
  - `src/pages/user/UserAssets.tsx`: request new asset (RPC + notifications).
  - `src/pages/shared/NotificationsPage.tsx`: all notifications; mark read/all.
- Shared
  - `src/components/layout/Header.tsx`, `NotificationDropdown.tsx`: recent unread, mark read/all.
  - `src/components/layout/Sidebar.tsx`: role-aware links, single Notifications entry.

### 10) RLS, RPC, and Auth Tips
- Prefer `SECURITY DEFINER` RPCs for client-critical writes blocked by RLS.
- Use `auth.uid()` and cast table UUIDs to text when necessary, e.g., `user_id::text = auth.uid()`.
- Ensure admin checks use a trusted table (e.g., `users.role = 'admin'`).

### 11) Image Placeholders
- All placeholder images are inline SVG data URIs to avoid network/DNS errors.

### 12) Troubleshooting
- 400 on insert (null violation): ensure required fields are provided (e.g., `issue_comments.user_name`).
- 403 RLS errors: verify policies or switch to RPC for the operation.
- 404 table not found: run the SQL scripts to create tables/functions.
- 406 PGRST116 on update/delete: RLS filters return zero rows; check ownership conditions and UUID casting.
- Duplicate Notifications links: Sidebar logic shows a single Notifications entry for admins.
- `.env` parse errors: enforce strict `KEY=VALUE` format; bypass with `--env-file` if needed.

### 13) Production
- Store secrets via `supabase secrets set`.
- Keep RPCs audited; ensure least-privilege in SQL functions.
- Monitor Edge Function logs in Supabase Dashboard.

### 14) Useful Scripts
```json
// package.json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### 15) Documentation Index
- `README.md` (this file): end-to-end overview
- `SUPABASE_FUNCTIONS_SETUP.md`: Edge Functions setup/deploy
- `COMMENTS_SETUP.md`: comments table, RLS, troubleshooting
- `AUTHENTICATION_SETUP.md`: auth provider, route guards, onboarding

# Magic Patterns - Vite Template

This code was generated by [Magic Patterns](https://magicpatterns.com) for this design: [Source Design](https://www.magicpatterns.com/c/in8gsigtgvox4poz5ar6f9)

## Getting Started

1. Run `npm install`
2. Run `npm run dev`
