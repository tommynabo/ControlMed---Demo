'use strict';
const express = require('express');
const crypto = require('crypto');
const { prisma, getSupabase } = require('../lib/db');

const router = express.Router();

// ─── GET services ─────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { specialty, search, includeInactive } = req.query;

        let query = supabase.from('services').select('*').order('specialty_name').order('name');
        if (!includeInactive) query = query.eq('is_active', true);
        if (specialty) query = query.eq('specialty_name', specialty);

        const { data, error } = await query;
        if (error) return res.status(500).json({ error: error.message });

        let filtered = data;
        if (search) {
            const searchLower = String(search).toLowerCase().slice(0, 100);
            filtered = data.filter(s => s.name.toLowerCase().includes(searchLower));
        }

        res.json(filtered);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── GET specialties ──────────────────────────────────────────────────────────
router.get('/specialties', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('services').select('specialty_name, specialty_color').eq('is_active', true);
        if (error) throw error;
        const specialties = [...new Map(data.map(s => [s.specialty_name, s])).values()];
        res.json(specialties);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── Search (Prisma Treatment model) ─────────────────────────────────────────
router.get('/search', async (req, res) => {
    try {
        const { query } = req.query;
        if (!query || query.length < 2) return res.json([]);

        const services = await prisma.treatment.findMany({
            where: { name: { contains: String(query).slice(0, 100), mode: 'insensitive' } },
            select: { id: true, name: true, price: true },
            take: 20
        });

        res.json(services.map(s => ({ value: s.id, label: s.name, price: s.price })));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── POST create service ──────────────────────────────────────────────────────
router.post('/', async (req, res) => {
    try {
        const supabase = getSupabase();
        const serviceData = req.body;

        if (!serviceData.name || serviceData.final_price === undefined) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const { data, error } = await supabase
            .from('services')
            .insert([{ ...serviceData, is_active: true, created_at: new Date().toISOString() }])
            .select().single();

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── POST fix/seed services ───────────────────────────────────────────────────
router.post('/fix', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { count, error: countErr } = await supabase.from('services').select('*', { count: 'exact', head: true });
        if (countErr) throw countErr;
        if (count > 0) return res.json({ message: `Services table already has ${count} items.` });

        const DENTAL_SERVICES = [
            { name: 'Limpieza Dental',               final_price: 50,   specialty_name: 'General' },
            { name: 'Obturación Simple',             final_price: 60,   specialty_name: 'General' },
            { name: 'Endodoncia Unirradicular',      final_price: 120,  specialty_name: 'General' },
            { name: 'Implante Titanio',              final_price: 1200, specialty_name: 'Implantología' },
            { name: 'Ortodoncia Brackets (Mensual)', final_price: 100,  specialty_name: 'Ortodoncia' },
            { name: 'Invisalign Full',               final_price: 3500, specialty_name: 'Ortodoncia' },
            { name: 'Blanqueamiento Zoom',           final_price: 300,  specialty_name: 'Estética' },
            { name: 'Corona Zirconio',               final_price: 350,  specialty_name: 'Estética' },
            { name: 'Extracción Simple',             final_price: 40,   specialty_name: 'General' },
            { name: 'Curetaje por Cuadrante',        final_price: 70,   specialty_name: 'Periodoncia' },
        ];

        const toInsert = DENTAL_SERVICES.map(s => ({
            id: crypto.randomUUID(), ...s, specialty_color: '#3b82f6', is_active: true, created_at: new Date().toISOString()
        }));

        const { data, error } = await supabase.from('services').insert(toInsert).select();
        if (error) throw error;
        res.json({ success: true, count: data.length });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── PUT update service ───────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const updates = { ...req.body };
        delete updates.id; delete updates.created_at;

        const { data, error } = await supabase
            .from('services').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// ─── DELETE service (soft) ────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('services').update({ is_active: false, updated_at: new Date().toISOString() }).eq('id', req.params.id).select().single();
        if (error) throw error;
        res.json({ success: true, data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
