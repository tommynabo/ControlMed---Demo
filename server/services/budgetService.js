// server/services/budgetService.js

const createBudget = async (supabase, patientId, items = [], title = "", userId = null) => {
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);

    // 1. Create Budget
    const { data: budget, error: budgetError } = await supabase
        .from('Budget')
        .insert([{
            id: crypto.randomUUID(),
            patientId,
            title: title || "Presupuesto General",
            status: 'DRAFT',
            totalAmount,
            date: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            updated_by: userId,
        }])
        .select()
        .single();

    if (budgetError) throw new Error("Error creating budget: " + budgetError.message);

    // 2. Create Items
    if (items.length > 0) {
        const lineItems = items.map(item => ({
            id: crypto.randomUUID(),
            budgetId: budget.id,
            name: item.tooth ? `${item.name} - Diente ${item.tooth}` : item.name,
            price: Number(item.price),
            quantity: Number(item.quantity) || 1,
            tooth: item.tooth ? String(item.tooth) : null,
            face: item.face || null,
            treatmentId: (item.treatmentId && !item.treatmentId.startsWith('temp-')) ? item.treatmentId : null
        }));

        const { error: itemsError } = await supabase
            .from('BudgetLineItem')
            .insert(lineItems);

        if (itemsError) {
            // Rollback: delete the budget header to avoid orphaned records
            await supabase.from('Budget').delete().eq('id', budget.id);
            throw new Error("Error al guardar los conceptos del presupuesto: " + itemsError.message);
        }

        // NEW: Update status of source treatments to 'PRESUPUESTADO'
        const treatmentIds = items.map(i => i.treatmentId).filter(id => id && !id.startsWith('temp-'));
        if (treatmentIds.length > 0) {
            console.log("Updating status for treatments:", treatmentIds);
            const { error: updateError } = await supabase
                .from('PatientTreatment')
                .update({ status: 'PRESUPUESTADO' })
                .in('id', treatmentIds);

            if (updateError) console.error("Error updating treatment status to PRESUPUESTADO:", updateError);
            else console.log("✅ Treatments marked as PRESUPUESTADO");
        }
    }

    // 3. Add to Clinical History (Shadow Record)
    const historyPayload = {
        treatment: 'Nuevo Presupuesto',
        observation: `Presupuesto creado con importe total: ${totalAmount}€ (${items.length} items)`,
        specialization: 'General'
    };

    const { error: historyError } = await supabase.from('ClinicalRecord').insert([{
        id: crypto.randomUUID(),
        patientId,
        date: new Date().toISOString(),
        text: JSON.stringify(historyPayload),
        authorId: 'system'
    }]);

    if (historyError) console.error("❌ Error creating shadow clinical record for budget:", historyError);
    else console.log("✅ Shadow clinical record created for budget.");

    // Return full structure
    const { data: fullBudget } = await supabase
        .from('Budget')
        .select('*, items:BudgetLineItem(*)')
        .eq('id', budget.id)
        .single();

    return fullBudget;
};

const getBudgetsByPatient = async (supabase, patientId) => {
    const { data, error } = await supabase
        .from('Budget')
        .select('*, items:BudgetLineItem(*)')
        .eq('patientId', patientId)
        .order('createdAt', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
};

const updateBudgetStatus = async (supabase, budgetId, status, userId = null) => {
    const { data, error } = await supabase
        .from('Budget')
        .update({ status, updatedAt: new Date().toISOString(), updated_by: userId })
        .eq('id', budgetId)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
};

const addItemToDraftBudget = async (supabase, patientId, item) => {
    // Find most recent DRAFT budget
    let { data: budget } = await supabase
        .from('Budget')
        .select('*')
        .eq('patientId', patientId)
        .eq('status', 'DRAFT')
        .order('createdAt', { ascending: false })
        .limit(1)
        .single();

    // Create if not exists
    if (!budget) {
        const { data: newBudget, error: createError } = await supabase
            .from('Budget')
            .insert([{
                patientId,
                status: 'DRAFT',
                totalAmount: 0,
                date: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (createError) throw new Error("Error creating draft budget: " + createError.message);
        budget = newBudget;
    }

    // Add Item
    const { data: lineItem, error: itemError } = await supabase
        .from('BudgetLineItem')
        .insert([{
            budgetId: budget.id,
            name: item.tooth ? `${item.name} - Diente ${item.tooth}` : item.name,
            price: Number(item.price),
            quantity: Number(item.quantity) || 1,
            tooth: item.tooth ? String(item.tooth) : null,
            face: item.face || null,
            treatmentId: item.treatmentId || null
        }])
        .select()
        .single();

    if (itemError) throw new Error("Error adding item: " + itemError.message);

    // Update Total
    const newTotal = Number(budget.totalAmount) + (Number(lineItem.price) * Number(lineItem.quantity));
    await supabase.from('Budget').update({ totalAmount: newTotal, updatedAt: new Date().toISOString() }).eq('id', budget.id);

    return await supabase
        .from('Budget')
        .select('*, items:BudgetLineItem(*)')
        .eq('id', budget.id)
        .single();
};

const deleteItem = async (supabase, itemId) => {
    const { data: item, error } = await supabase.from('BudgetLineItem').select('budgetId').eq('id', itemId).single();
    if (error) throw new Error("Item not found");

    await supabase.from('BudgetLineItem').delete().eq('id', itemId);

    // Recalculate total
    const { data: items } = await supabase.from('BudgetLineItem').select('price, quantity').eq('budgetId', item.budgetId);
    const newTotal = items.reduce((acc, i) => acc + (Number(i.price) * (Number(i.quantity) || 1)), 0);

    await supabase.from('Budget').update({ totalAmount: newTotal, updatedAt: new Date().toISOString() }).eq('id', item.budgetId);
    return { success: true };
};

const convertBudgetToInvoice = async (supabase, budgetId, userId = null) => {
    // 1. Get Budget
    const { data: budget, error: budgetError } = await supabase
        .from('Budget')
        .select('*, items:BudgetLineItem(*)')
        .eq('id', budgetId)
        .single();

    if (budgetError || !budget) throw new Error("Budget not found");

    // 2. Create Invoice
    const invoiceData = {
        invoiceNumber: `INV-${Date.now()}`,
        patientId: budget.patientId,
        amount: budget.totalAmount,
        status: 'PENDING',
        date: new Date().toISOString()
    };

    const { data: invoice, error: invoiceError } = await supabase
        .from('Invoice')
        .insert([invoiceData])
        .select()
        .single();

    if (invoiceError) throw new Error("Error creating invoice: " + invoiceError.message);

    // 3. Create Invoice Items
    if (budget.items && budget.items.length > 0) {
        const invoiceItems = budget.items.map(item => ({
            invoiceId: invoice.id,
            name: item.name,
            price: item.price,
            serviceId: item.treatmentId || null
        }));
        await supabase.from('InvoiceItem').insert(invoiceItems);
    }

    // 4. Update Budget Status
    const { error: updateError } = await supabase
        .from('Budget')
        .update({ status: 'CONVERTED', updatedAt: new Date().toISOString(), updated_by: userId })
        .eq('id', budgetId);

    if (updateError) {
        console.error("Failed to update budget status:", updateError);
        throw new Error("Error updating budget status: " + updateError.message);
    }

    return invoice;
};

const updateBudget = async (supabase, budgetId, items = [], title = "", userId = null) => {
    const totalAmount = items.reduce((sum, item) => sum + (Number(item.price) * (Number(item.quantity) || 1)), 0);

    // Update budget title & total
    const { error: budgetError } = await supabase
        .from('Budget')
        .update({ title: title || "Presupuesto General", totalAmount, updatedAt: new Date().toISOString(), updated_by: userId })
        .eq('id', budgetId);

    if (budgetError) throw new Error("Error updating budget: " + budgetError.message);

    // Delete existing items
    await supabase.from('BudgetLineItem').delete().eq('budgetId', budgetId);

    // Create new items
    if (items.length > 0) {
        const lineItems = items.map(item => ({
            id: crypto.randomUUID(),
            budgetId: budgetId,
            name: item.tooth && !item.name.includes('Diente') ? `${item.name} - Diente ${item.tooth}` : item.name,
            price: Number(item.price),
            quantity: Number(item.quantity) || 1,
            tooth: item.tooth ? String(item.tooth) : null,
            face: item.face || null,
            treatmentId: (item.treatmentId && !item.treatmentId.startsWith('temp-')) ? item.treatmentId : null
        }));

        const { error: itemsError } = await supabase.from('BudgetLineItem').insert(lineItems);
        if (itemsError) throw new Error("Error al actualizar los conceptos del presupuesto: " + itemsError.message);
    }

    const { data: fullBudget } = await supabase
        .from('Budget')
        .select('*, items:BudgetLineItem(*)')
        .eq('id', budgetId)
        .single();
    
    return fullBudget;
};

module.exports = {
    createBudget,
    getBudgetsByPatient,
    updateBudgetStatus,
    addItemToDraftBudget,
    deleteItem,
    convertBudgetToInvoice,
    updateBudget
};
