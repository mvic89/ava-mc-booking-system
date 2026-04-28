// ── Centralised permission system ─────────────────────────────────────────────
// Single source of truth for what each role can access.
// Used by:  lib/useRoleGuard (client pages)  ·  canAccess() (inline checks)

export type Role =
  | 'admin'
  | 'sales_manager'
  | 'sales'
  | 'accountant'
  | 'technician'
  | 'service';

export type Permission =
  | 'dashboard'
  | 'leads'
  | 'customers'
  | 'invoices'
  | 'inventory'
  | 'documents'
  | 'settings'
  | 'billing'
  | 'audit_log'
  | 'analytics'
  | 'accounting'
  | 'branches'
  | 'performance'
  | 'service_module';

// ─── Matrix ───────────────────────────────────────────────────────────────────

const MATRIX: Record<Role, Permission[]> = {
  admin: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
    'documents', 'settings', 'billing', 'audit_log', 'analytics',
    'accounting', 'branches', 'performance', 'service_module',
  ],
  sales_manager: [
    'dashboard', 'leads', 'customers', 'invoices',
    'inventory', 'analytics', 'performance',
  ],
  sales: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
  ],
  accountant: [
    'dashboard', 'invoices', 'accounting', 'analytics',
  ],
  technician: [
    'dashboard', 'inventory', 'documents', 'service_module',
  ],
  service: [
    'dashboard', 'inventory', 'documents', 'service_module',
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getPermissions(role: string): Permission[] {
  return MATRIX[role as Role] ?? [];
}

export function hasPermission(role: string, permission: Permission): boolean {
  return getPermissions(role).includes(permission);
}

/** Read role from localStorage — client-only. */
export function getUserRole(): Role | null {
  if (typeof window === 'undefined') return null;
  try {
    const user = JSON.parse(localStorage.getItem('user') ?? '{}');
    return (user.role as Role) || null;
  } catch {
    return null;
  }
}

/** Quick inline check: canAccess('analytics'). */
export function canAccess(permission: Permission): boolean {
  const role = getUserRole();
  if (!role) return false;
  return hasPermission(role, permission);
}

// ─── Route → permission map ────────────────────────────────────────────────────
// Used by pages to declare what permission they require.

export const ROUTE_PERMISSIONS: Record<string, Permission> = {
  '/analytics':      'analytics',
  '/accounting':     'accounting',
  '/audit-log':      'audit_log',
  '/settings':       'settings',
  '/documents':      'documents',
  '/sales/leads':    'leads',
  '/customers':      'customers',
  '/invoices':       'invoices',
  '/inventory':      'inventory',
};
