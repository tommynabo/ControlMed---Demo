const express = require('express');
const router = express.Router();
const { getSupabase } = require('../lib/db');

/**
 * POST /api/reminders
 * Create a new reminder
 */
router.post('/', async (req, res) => {
    try {
        const { patientId, description, dueDate, priority, notificationMethod, notes } = req.body;

        if (!patientId || !description || !dueDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const { data, error } = await getSupabase()
            .from('Reminder')
            .insert([{
                patient_id: patientId,
                description,
                due_date: dueDate,
                priority: priority || 'MEDIUM',
                notification_method: notificationMethod || 'IN_APP',
                notes: notes || null,
                status: 'PENDING',
                notification_sent: false
            }])
            .select();

        if (error) throw error;
        res.json(data?.[0] || {});
    } catch (error) {
        console.error('Error creating reminder:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reminders?patientId=UUID
 * Get reminders for a patient
 */
router.get('/', async (req, res) => {
    try {
        const { patientId } = req.query;

        if (!patientId) {
            return res.status(400).json({ error: 'patientId required' });
        }

        const { data, error } = await getSupabase()
            .from('Reminder')
            .select('*')
            .eq('patient_id', patientId)
            .order('due_date', { ascending: true });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reminders/:id
 * Get a single reminder
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await getSupabase()
            .from('Reminder')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error fetching reminder:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * PUT /api/reminders/:id
 * Update a reminder
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Convert camelCase to snake_case
        if (updates.status === 'COMPLETED' && !updates.completed_at) {
            updates.completed_at = new Date().toISOString();
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await getSupabase()
            .from('Reminder')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (error) {
        console.error('Error updating reminder:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * DELETE /api/reminders/:id
 * Delete a reminder
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { error } = await getSupabase()
            .from('Reminder')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting reminder:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/reminders/pending/due
 * Get all pending reminders due today or overdue
 */
router.get('/pending/due', async (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        const { data, error } = await getSupabase()
            .from('Reminder')
            .select('*, Patient:patient_id(name, phoneNumber)')
            .eq('status', 'PENDING')
            .lte('due_date', today)
            .order('due_date', { ascending: false });

        if (error) throw error;
        res.json(data || []);
    } catch (error) {
        console.error('Error fetching pending reminders:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
