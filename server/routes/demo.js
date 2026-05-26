'use strict';
const express = require('express');
const { getSupabase } = require('../lib/db');
const router = express.Router();

router.post('/reset', async (req, res) => {
  const secret = req.headers['x-demo-secret'];
  if (!secret || secret !== process.env.DEMO_RESET_SECRET) {
    return res.status(403).json({ error: 'No autorizado' });
  }
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase.rpc('reset_demo_data');
    if (error) throw error;
    res.json({ ok: true, result: data });
  } catch (e) {
    console.error('[DEMO RESET] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
