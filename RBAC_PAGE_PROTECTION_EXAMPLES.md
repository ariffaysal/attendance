# Role-Based Page Protection Examples

## Example 1: Protect Job Cards Page (Staff + Admin)

**File**: `frontend/src/app/job-cards/page.tsx`

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

Then create a separate file: `frontend/src/app/job-cards/job-cards-content.tsx` with the actual page content.

---

## Example 2: Protect Admin-Only Page (Library)

**File**: `frontend/src/app/library/page.tsx`

```tsx
'use client';

import { RoleGate } from '@/components/RoleGate';
import LibraryContent from './library-content';

export default function LibraryPage() {
  return (
    <RoleGate allowedRoles={['admin']}>
      <LibraryContent />
    </RoleGate>
  );
}
```

---

## Example 3: Conditional Rendering Based on Role

**In any component:**

```tsx
'use client';

import { useAuth } from '@/contexts/AuthContext';

export default function Dashboard() {
  const { user, hasRole, hasAccess, userRole } = useAuth();

  return (
    <div>
      <h1>Welcome, {user?.employeeId}!</h1>
      <p>Your role: <strong>{userRole}</strong></p>

      {hasRole('admin') && (
        <div className="admin-section">
          <h2>Admin Section</h2>
          <button>Manage Users</button>
          <button>View Reports</button>
        </div>
      )}

      {hasAccess(['admin', 'staff']) && (
        <div className="accessible-section">
          <h2>Job Cards</h2>
          <button>View Job Cards</button>
        </div>
      )}

      {!hasRole('admin') && (
        <div className="staff-only-message">
          <p>You have limited access as a Staff member.</p>
        </div>
      )}
    </div>
  );
}
```

---

## Example 4: Custom Unauthorized Page

```tsx
'use client';

import { RoleGate } from '@/components/RoleGate';

function UnauthorizedFallback() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a1a] text-white">
      <h1 className="text-4xl font-bold mb-4">Access Denied</h1>
      <p className="text-xl text-slate-400 mb-8">
        This page is only available to Admin users
      </p>
      <button 
        onClick={() => window.history.back()}
        className="px-6 py-3 bg-cyan-400 text-black rounded-lg font-bold"
      >
        Go Back
      </button>
    </div>
  );
}

export default function RestrictedPage() {
  return (
    <RoleGate 
      allowedRoles={['admin']} 
      fallback={<UnauthorizedFallback />}
    >
      <div>Admin Content Here</div>
    </RoleGate>
  );
}
```

---

## Implementation Steps

### Step 1: Check Current Page Structure
Look at the current `job-cards/page.tsx` to understand its content.

### Step 2: Split Page Component
- Keep all the actual content in a new file (e.g., `job-cards-content.tsx`)
- Make `page.tsx` just a wrapper with RoleGate

### Step 3: Test Access Control
1. Log in as Admin - should see all pages
2. Log in as Staff - should see only Job Cards and Reports
3. Try accessing admin pages directly - should be redirected

---

## Complete Implementation Checklist

- [ ] Run database migration (ALTER TABLE query)
- [ ] Verify role column exists with correct enum values
- [ ] Test user creation with role assignment
- [ ] Test login returns role in response
- [ ] Wrap Job Cards page with RoleGate for ['admin', 'staff']
- [ ] Wrap Reports page with RoleGate for ['admin', 'staff']
- [ ] Wrap all admin pages with RoleGate for ['admin'] only
- [ ] Test Staff user access (should be restricted to Job Cards & Reports)
- [ ] Test Admin user access (should have full access)
- [ ] Update navigation to hide restricted links from Staff users
- [ ] Verify localStorage stores role correctly

