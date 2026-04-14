'use strict';
const express = require('express');
const { getSupabase } = require('../lib/db');

const router = express.Router();

// ─── GET audit logs (ADMIN only) ─────────────────────────────────────────────
router.get('/logs', async (req, res) => {
    try {
        // Only ADMIN can access audit logs
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Acceso denegado. Solo administradores pueden ver el log de auditoría.' });
        }

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { resource_type, user_id, action, date_from, date_to, limit = 100, offset = 0 } = req.query;

        let query = supabase
            .from('system_audit_log')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (resource_type) query = query.eq('resource_type', resource_type);
        if (user_id)       query = query.eq('user_id', user_id);
        if (action)        query = query.eq('action', action);
        if (date_from)     query = query.gte('created_at', new Date(date_from).toISOString());
        if (date_to) {
            const end = new Date(date_to); end.setHours(23, 59, 59, 999);
            query = query.lte('created_at', end.toISOString());
        }

        const { data, error, count } = await query;
        if (error) return res.status(500).json({ error: error.message });

        // Enrich with User name from User table if possible
        const userIds = [...new Set((data || []).map(r => r.user_id).filter(Boolean))];
        const userMap = {};
        if (userIds.length > 0) {
            try {
                const { data: users } = await supabase
                    .from('User')
                    .select('id, name, role')
                    .in('id', userIds);
                (users || []).forEach(u => { userMap[u.id] = { name: u.name, role: u.role }; });
            } catch (_) {}
        }

        const enriched = (data || []).map(row => ({
            ...row,
            user_name: userMap[row.user_id]?.name || row.user_email || '—',
            user_role: row.user_role || userMap[row.user_id]?.role || '—',
        }));

        res.json({ data: enriched, total: count || 0, limit: Number(limit), offset: Number(offset) });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
