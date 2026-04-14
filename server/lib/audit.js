'use strict';

/**
 * Audit logging utility.
 * Writes to the `system_audit_log` table. Errors are swallowed silently
 * so audit failures never interrupt the main request flow.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} opts
 * @param {string}  opts.userId       - UUID of the acting user (req.user.id)
 * @param {string}  opts.userRole     - Role of the acting user (req.user.role)
 * @param {string}  opts.action       - 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT'
 * @param {string}  opts.resourceType - Table/module name, e.g. 'appointments'
 * @param {string} [opts.resourceId]  - ID of the affected record
 * @param {object} [opts.oldValues]   - Snapshot before the change
 * @param {object} [opts.newValues]   - Snapshot after the change
 * @param {string} [opts.ipAddress]   - Client IP (req.ip)
 * @param {string} [opts.userAgent]   - User-Agent header
 */
async function logAudit(supabase, {
    userId,
    userRole,
    action,
    resourceType,
    resourceId,
    oldValues,
    newValues,
    ipAddress,
    userAgent,
}) {
    try {
        await supabase.from('system_audit_log').insert([{
            user_id:       userId       || null,
            user_role:     userRole     || null,
            action,
            resource_type: resourceType,
            resource_id:   resourceId   ? String(resourceId) : null,
            old_values:    oldValues    || null,
            new_values:    newValues    || null,
            ip_address:    ipAddress    || null,
            user_agent:    userAgent    || null,
        }]);
    } catch (_) {
        // Audit must never break the main flow
    }
}

module.exports = { logAudit };
