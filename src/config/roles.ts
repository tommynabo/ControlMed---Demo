// ============================================================
// Role-Based Access Control (RBAC) Configuration
// ============================================================
// Roles:
//   ADMIN     - Full CRM access, configuration, all users
//   RECEPTION - All accounts, billing, agendas, stock
//   AUXILIAR  - Agendas (view+edit), clinical records
//   DOCTOR    - Agendas (view+edit), clinical records (view)
// ============================================================

export type UserRole = 'ADMIN' | 'RECEPTION' | 'AUXILIAR' | 'DOCTOR';

export const ROLE_LABELS: Record<UserRole, string> = {
    ADMIN: 'Administrador',
    RECEPTION: 'Recepción',
    AUXILIAR: 'Auxiliar',
    DOCTOR: 'Doctor',
};

// Pages each role can access
export const ROLE_ALLOWED_PAGES: Record<UserRole, string[]> = {
    ADMIN: [
        'dashboard', 'patients', 'agenda', 'caja', 'billing',
        'stock', 'ai', 'payroll', 'settings', 'users',
    ],
    RECEPTION: [
        'dashboard', 'patients', 'agenda', 'caja', 'billing', 'stock',
    ],
    AUXILIAR: [
        'dashboard', 'patients', 'agenda',
    ],
    DOCTOR: [
        'dashboard', 'patients', 'agenda',
    ],
};

// Map route paths to page IDs
export const ROUTE_TO_PAGE: Record<string, string> = {
    '/dashboard': 'dashboard',
    '/pacientes': 'patients',
    '/agenda': 'agenda',
    '/caja': 'caja',
    '/billing': 'billing',
    '/stock': 'stock',
    '/ai': 'ai',
    '/payroll': 'payroll',
    '/settings': 'settings',
    '/users': 'users',
};

export function canAccessPage(role: UserRole, pageId: string): boolean {
    return ROLE_ALLOWED_PAGES[role]?.includes(pageId) ?? false;
}

export function canAccessRoute(role: UserRole, path: string): boolean {
    // Allow appointment detail for roles with agenda access
    if (path.startsWith('/appointment/')) {
        return canAccessPage(role, 'agenda');
    }
    const pageId = ROUTE_TO_PAGE[path];
    if (!pageId) return true; // Unknown routes → let them through (fallback handles it)
    return canAccessPage(role, pageId);
}

// Granular permissions per role
export const ROLE_PERMISSIONS: Record<UserRole, Record<string, boolean>> = {
    ADMIN: {
        'patients.edit': true,
        'clinical.view': true,
        'clinical.edit': true,
        'agenda.edit': true,
        'billing.edit': true,
        'cashregister.edit': true,
        'stock.edit': true,
        'users.manage': true,
    },
    RECEPTION: {
        'patients.edit': true,
        'clinical.view': true,
        'clinical.edit': false,
        'agenda.edit': true,
        'billing.edit': true,
        'cashregister.edit': true,
        'stock.edit': true,
        'users.manage': false,
    },
    AUXILIAR: {
        'patients.edit': true,
        'clinical.view': true,
        'clinical.edit': true,
        'agenda.edit': true,
        'billing.edit': false,
        'cashregister.edit': false,
        'stock.edit': false,
        'users.manage': false,
    },
    DOCTOR: {
        'patients.edit': false,
        'clinical.view': true,
        'clinical.edit': false,
        'agenda.edit': true,
        'billing.edit': false,
        'cashregister.edit': false,
        'stock.edit': false,
        'users.manage': false,
    },
};

export function hasPermission(role: UserRole, permission: string): boolean {
    return ROLE_PERMISSIONS[role]?.[permission] ?? false;
}
