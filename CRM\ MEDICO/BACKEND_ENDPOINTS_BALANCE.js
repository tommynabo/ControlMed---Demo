// Backend endpoint for /api/patients/:id/balance
app.get('/api/patients/:id/balance', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;

        // Get patient's advance balance from payments or wallet
        const patient = await supabase
            .from('pacientes')
            .select('id, saldo_favor')
            .eq('id', id)
            .single();

        if (!patient.data) {
            return res.status(404).json({ balance: 0 });
        }

        // Return balance (saldo_favor = advance balance they can use)
        res.json({
            balance: patient.data?.saldo_favor || 0
        });
    } catch (error) {
        console.error('Error fetching patient balance:', error);
        res.status(500).json({ error: 'Failed to fetch patient balance' });
    }
});

// PUT endpoint to use patient balance
app.put('/api/patients/:id/use-balance', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get current balance
        const patient = await supabase
            .from('pacientes')
            .select('saldo_favor')
            .eq('id', id)
            .single();

        if (!patient.data) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const currentBalance = patient.data?.saldo_favor || 0;
        if (currentBalance < amount) {
            return res.status(400).json({ error: 'Insufficient balance' });
        }

        // Deduct from balance
        const newBalance = currentBalance - amount;
        const { data } = await supabase
            .from('pacientes')
            .update({ saldo_favor: newBalance })
            .eq('id', id)
            .select('saldo_favor');

        // Log transaction
        await supabase.from('payment_logs').insert({
            paciente_id: id,
            tipo: 'balance_used',
            cantidad: amount,
            saldo_nuevo: newBalance,
            fecha: new Date().toISOString()
        });

        res.json({
            balance: newBalance,
            usedAmount: amount
        });
    } catch (error) {
        console.error('Error using patient balance:', error);
        res.status(500).json({ error: 'Failed to use balance' });
    }
});

// POST endpoint to add balance to patient
app.post('/api/patients/:id/add-balance', authenticateUser, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount } = req.body;

        if (amount <= 0) {
            return res.status(400).json({ error: 'Invalid amount' });
        }

        // Get current balance
        const patient = await supabase
            .from('pacientes')
            .select('saldo_favor')
            .eq('id', id)
            .single();

        if (!patient.data) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        const currentBalance = patient.data?.saldo_favor || 0;
        const newBalance = currentBalance + amount;

        // Add to balance
        const { data } = await supabase
            .from('pacientes')
            .update({ saldo_favor: newBalance })
            .eq('id', id)
            .select('saldo_favor');

        // Log transaction
        await supabase.from('payment_logs').insert({
            paciente_id: id,
            tipo: 'balance_added',
            cantidad: amount,
            saldo_nuevo: newBalance,
            fecha: new Date().toISOString()
        });

        res.json({
            balance: newBalance,
            addedAmount: amount
        });
    } catch (error) {
        console.error('Error adding balance:', error);
        res.status(500).json({ error: 'Failed to add balance' });
    }
});
