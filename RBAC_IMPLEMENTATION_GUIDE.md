# Role-Based Access Control Implementation Guide

## Overview
This system implements role-based access control (RBAC) with two roles:
- **Admin**: Full access to all pages and can manage users
- **Staff**: Limited access to Job Cards and Reports only

## Database Changes

### Step 1: Update Your Database
Run this SQL command in your database:

```sql
-- For existing databases:
ALTER TABLE auth_users ADD COLUMN role ENUM('admin', 'staff') DEFAULT 'staff' AFTER password_hash;
ALTER TABLE auth_users ADD INDEX idx_role (role);
```

**Note**: If you're creating a fresh database, the new schema in `backend/database/auth-users.sql` already includes the role column.

## What Was Updated

### Backend Changes
1. **Database Schema** (`backend/database/auth-users.sql`)
   - Added `role` column with ENUM values: 'admin' or 'staff'
   - Default role for new users: 'staff'

2. **DTOs** (`backend/src/modules/users/dto/`)
   - `create-user.dto.ts`: Added optional `role` field
   - `update-user.dto.ts`: Added optional `role` field

3. **Services** (`backend/src/modules/`)
   - `users/users.service.ts`: Updated to handle role in create/update/find operations
   - `auth/auth.service.ts`: Updated login and validateUser to return role

### Frontend Changes
1. **Interfaces** (`frontend/src/services/`)
   - `auth.service.ts`: Updated User interface with role
   - `users.service.ts`: Updated User, CreateUserData, and UpdateUserData interfaces

2. **Context** (`frontend/src/contexts/AuthContext.tsx`)
   - Added `userRole` property
   - Added `hasRole()` helper method
   - Added `hasAccess()` helper method for checking multiple roles

3. **Pages & Components**
   - `app/library/assign-users/page.tsx`: Updated to include role selector in user form and role display in table

4. **Hooks** (`frontend/src/hooks/useRoleAccess.ts`)
   - New hook for role-based page access control
   - Includes permission map for routes

5. **Components** (`frontend/src/components/RoleGate.tsx`)
   - New wrapper component to protect pages based on roles

## Usage Examples

### Protecting a Page with RoleGate

```tsx
'use client';

import { RoleGate } from '@/components/RoleGate';

export default function AdminPage() {
  return (
    <RoleGate allowedRoles={['admin']}>
      <div>
        {/* Admin-only content */}
      </div>
    </RoleGate>
  );
}
```

### Checking User Role in Components

```tsx
import { useAuth } from '@/contexts/AuthContext';

export default function MyComponent() {
  const { hasRole, hasAccess, userRole } = useAuth();

  if (hasRole('admin')) {
    return <div>Admin dashboard</div>;
  }

  if (hasAccess(['admin', 'staff'])) {
    return <div>Both roles can see this</div>;
  }

  return <div>Guest view</div>;
}
```

## Role Permissions Map

Edit `frontend/src/hooks/useRoleAccess.ts` to define which roles can access which pages:

```typescript
export const PAGE_PERMISSIONS = {
  '/job-cards': ['admin', 'staff'],
  '/reports': ['admin', 'staff'],
  '/library': ['admin'],
  '/library/assign-users': ['admin'],
  '/employees': ['admin'],
  '/users': ['admin'],
  // Add more pages as needed
} as const;
```

## Assigning Roles to Users

1. Go to `/library/assign-users` (Admin only)
2. Click "Add New User" or edit an existing user
3. Select the role:
   - **Staff**: Access to Job Cards and Reports
   - **Admin**: Full access to all pages
4. Click "Create User" or "Update User"

The role is saved to the `auth_users` table and returned on login.

## Restricting Page Access

### Option 1: Using RoleGate Component (Recommended)

```tsx
'use client';

import { RoleGate } from '@/components/RoleGate';
import JobCardsContent from './job-cards-content';

export default function JobCardsPage() {
  return (
    <RoleGate allowedRoles={['admin', 'staff']}>
      <JobCardsContent />
    </RoleGate>
  );
}
```

### Option 2: Using useRoleAccess Hook

```tsx
'use client';

import { useRoleAccess } from '@/hooks/useRoleAccess';

export default function JobCardsPage() {
  const { isAllowed, isLoading } = useRoleAccess({
    allowedRoles: ['admin', 'staff'],
  });

  if (isLoading) return <div>Loading...</div>;
  if (!isAllowed) return <div>Access Denied</div>;

  return <div>Job Cards Content</div>;
}
```

## Testing the Implementation

1. **Create an Admin User**
   - Go to `/library/assign-users`
   - Create user with role: "Admin"

2. **Create a Staff User**
   - Create user with role: "Staff"

3. **Login as Admin**
   - Should have access to all pages

4. **Login as Staff**
   - Should only have access to Job Cards and Reports
   - Should be redirected if trying to access admin pages

## API Endpoints

### Create User with Role
```bash
POST /users
{
  "employeeId": "EMP001",
  "email": "user@example.com",
  "mobileNumber": "1234567890",
  "password": "password123",
  "role": "admin"
}
```

### Update User Role
```bash
PUT /users/:id
{
  "role": "staff"
}
```

### Login (Returns Role)
```bash
POST /auth/login
{
  "employeeId": "EMP001",
  "password": "password123"
}

// Response:
{
  "success": true,
  "user": {
    "id": 1,
    "employeeId": "EMP001",
    "email": "user@example.com",
    "mobileNumber": "1234567890",
    "role": "admin"
  }
}
```

## Security Notes

- Role is stored in `localStorage` on the client and returned with login response
- Role is also stored in `auth_users` table on backend
- Always validate role on backend before allowing sensitive operations
- The middleware provides basic authentication, but role checks are done on the frontend for page access
- Consider adding backend authorization guards for API endpoints in future

## Troubleshooting

### Role Not Showing After Login
- Clear browser localStorage and cookies
- Log out and log back in
- Check that the database column was added correctly

### Access Still Allowed to Restricted Pages
- Verify the RoleGate component is wrapping the page
- Check that the role value is correct ('admin' or 'staff')
- Look for any middleware bypassing role checks

### Database Error When Creating Users
- Run the ALTER TABLE command above
- Ensure MySQL supports ENUM type (it should)
- Check that the role column was added with correct default

## Future Enhancements

1. Add more granular permissions (e.g., per-page or per-action)
2. Implement backend authorization guards for all API endpoints
3. Add role management UI (create, edit, delete roles)
4. Add audit logging for role changes
5. Implement permission caching to reduce database queries
