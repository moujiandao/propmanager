# Admin Users Feature Design

**Date:** 2026-04-29  
**Status:** Approved

## Problem

Creating additional landlord accounts requires manually hitting the Supabase dashboard (two steps: create auth user + insert landlord_profiles row). There's no in-app way to do it.

## Solution

Add an "Admin Users" page to the landlord sidebar that wraps the existing `/api/auth/register-landlord` endpoint in a simple form.

## Scope

- Small fixed set of co-admins (not ongoing user management)
- Create only - no list, edit, or delete of admins needed
- All admins see all data (landlord queries are not filtered by landlord_id)

## Changes

All changes are in `property-management-app.jsx`. No new files, no API changes.

### 1. Translation keys

Add to both `EN` and `ZH` objects in the `T` constant:

```js
navAdminUsers: "Admin Users"   // EN
navAdminUsers: "管理员用户"     // ZH
```

### 2. Sidebar nav entry

Add to `landlordBottomNav` array in the `Sidebar` component:

```js
{ id: "admin-users", label: t.navAdminUsers, icon: "users" }
```

### 3. AdminUsersPage component

New component (~40 lines) placed near the end of the landlord page components. Fields:
- Name (text)
- Email (email)
- Password (password, min 8 chars enforced client-side)

On submit: POST to `/api/auth/register-landlord`, show inline success or error message. Reset form on success.

Uses existing `Inp`, `Btn`, `PageHeader` components. No new state management patterns.

### 4. renderPage case

Add to the landlord switch in `renderPage`:

```js
case "admin-users": return <AdminUsersPage t={t} />;
```

## Out of Scope

- Listing existing admin users
- Deleting or deactivating admin accounts (use Supabase dashboard for that)
- Role-based access control (all landlords see all data)
- Password strength meter
