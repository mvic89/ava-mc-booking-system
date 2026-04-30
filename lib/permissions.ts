// ── Centralised permission system ─────────────────────────────────────────────
// Single source of truth for what each role can access.
// Used by:  lib/useRoleGuard (client pages)  ·  canAccess() (inline checks)

export type Role =
  | 'admin'
  | 'platform_admin'
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
  // Platform owner — manages all dealerships, no dealership context
  platform_admin: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
    'documents', 'settings', 'billing', 'audit_log', 'analytics',
    'accounting', 'branches', 'performance', 'service_module',
  ],
  // Dealership owner / full access
  admin: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
    'documents', 'settings', 'billing', 'audit_log', 'analytics',
    'accounting', 'branches', 'performance', 'service_module',
  ],
  // Sales team lead — everything sales + reporting, no admin settings
  sales_manager: [
    'dashboard', 'leads', 'customers', 'invoices',
    'inventory', 'analytics', 'performance',
  ],
  // Salesperson
  sales: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
  ],
  // Finance / bookkeeping
  accountant: [
    'dashboard', 'customers', 'invoices', 'accounting', 'analytics',
  ],
  // Workshop technician — full core visibility + service
  technician: [
    'dashboard', 'inventory', 'documents', 'service_module',
  ],
  // Note: technician sees all Core nav items (offer, purchase orders, etc.)
  // Those routes are not permission-gated so sidebar visibility is sufficient.
  // Service adviser / service desk — all core + service + customer-facing
  service: [
    'dashboard', 'leads', 'customers', 'invoices', 'inventory',
    'documents', 'service_module',
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
