
/**
 * Calculates the liquidation for a doctor when a treatment is completed.
 * Formula: (TreatmentPrice - LabCost) * CommissionPercentage
 */
async function calculateLiquidation(prisma, appointment) {
    const { treatment, doctor } = appointment;

    if (!treatment || !doctor) {
        throw new Error('Missing Treatment or Doctor data');
    }

    const grossAmount = treatment.price;
    const labCost = treatment.labCost || 0;
    const commissionRate = doctor.commissionPercentage || 0;

    // Logic: Commission is applied on NET amount (Price - LabCost)
    const netAmount = grossAmount - labCost;
    const finalAmount = netAmount > 0 ? netAmount * commissionRate : 0;

    // Create Record
    return await prisma.liquidation.create({
        data: {
            doctorId: doctor.id,
            appointmentId: appointment.id,
            grossAmount,
            labCost,
            commissionRate,
            finalAmount,
            status: 'PENDING'
        }
    });
}

async function getPayroll(prisma, doctorId, monthStr) {
    // monthStr format 'YYYY-MM'
    const where = {};
    if (doctorId) where.doctorId = doctorId;

    // Date filtering logic could be added here using monthStr

    const records = await prisma.liquidation.findMany({
        where,
        include: {
            appointment: {
                include: {
                    treatment: true,
                    patient: true
                }
            }
        },
        orderBy: { createdAt: 'desc' }
    });

    // Format records for frontend display
    const formattedRecords = records.map(r => ({
        id: r.id,
        doctorId: r.doctorId,
        grossAmount: r.grossAmount,
        labCost: r.labCost || 0,
        commissionRate: r.commissionRate,
        finalAmount: r.finalAmount,
        status: r.status,
        date: r.createdAt || r.appointment?.date,
        treatmentName: r.treatmentName ||
            r.appointment?.treatment?.name ||
            r.appointment?.notes ||
            'Pago con Saldo',
        patientName: r.patientName || r.appointment?.patient?.name || 'Paciente',
        paymentMethod: r.paymentMethod // Pass payment method for badge
    }));

    const total = formattedRecords.reduce((sum, r) => sum + r.finalAmount, 0);

    return {
        records: formattedRecords,
        totalToPay: total
    };
}


/**
 * Creates a financing plan with installments.
 * @param {string} patientId 
 * @param {string} name - e.g. "Financiación Ortodoncia"
 * @param {number} totalAmount 
 * @param {number} downPayment - Initial payment
 * @param {number} installmentsCount - Number of monthly payments
 * @param {string} startDateStr - YYYY-MM-DD
 */
async function createFinancingPlan(prisma, { patientId, name, totalAmount, downPayment, installmentsCount, startDateStr }) {
    const startDate = new Date(startDateStr);
    const financedAmount = totalAmount - downPayment;
    const monthlyAmount = installmentsCount > 0 ? (financedAmount / installmentsCount) : 0;

    // 1. Create the Treatment Plan container
    const plan = await prisma.treatmentPlan.create({
        data: {
            patientId,
            name,
            totalCost: totalAmount, // Schema uses totalCost, we receive totalAmount
            startDate,
            duration: installmentsCount,
            status: 'ACTIVE'
        }
    });

    // 2. Create Down Payment Installment (if any)
    const installmentsData = [];

    if (downPayment > 0) {
        installmentsData.push({
            planId: plan.id,
            dueDate: new Date(), // Now
            amount: downPayment,
            status: 'PENDING', // Waiting for immediate payment
            description: 'Entrada Inicial'
        });
    }

    // 3. Create Monthly Installments
    for (let i = 1; i <= installmentsCount; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i); // Add i months

        installmentsData.push({
            planId: plan.id,
            dueDate: dueDate,
            amount: parseFloat(monthlyAmount.toFixed(2)), // Round to 2 decimals
            status: 'PENDING',
            description: `Cuota ${i}/${installmentsCount}`
        });
    }

    // Batch create installments
    const createdInstallments = [];
    for (const inst of installmentsData) {
        const created = await prisma.installment.create({ data: inst });
        createdInstallments.push(created);
    }

    // Generate invoice for down payment if applicable
    let downPaymentInvoice = null;
    if (downPayment > 0 && createdInstallments.length > 0) {
        const downPaymentInst = createdInstallments[0]; // First installment is the down payment
        try {
            // Get patient info for invoice
            const patient = await prisma.patient.findUnique({ where: { id: patientId } });
            if (patient) {
                const quipuService = require('./quipuService');
                // const { createClient } = require('@supabase/supabase-js'); // Unused
                const crypto = require('crypto');

                // Create contact in Quipu
                const contact = await quipuService.getOrCreateContact(patient);

                if (contact && contact.id) {
                    // Create invoice in Quipu
                    const today = new Date().toISOString().split('T')[0];
                    const invoiceResult = await quipuService.createInvoice(
                        contact.id,
                        [{ name: `${name} - Entrada Inicial`, quantity: 1, price: downPayment }],
                        today,
                        today,
                        'card'
                    );

                    if (invoiceResult && invoiceResult.success) {
                        try {
                            // 1. Save to CRM Invoice Table (Using Prisma)
                            const savedInvoice = await prisma.invoice.create({
                                data: {
                                    invoiceNumber: invoiceResult.number || 'PENDING',
                                    externalId: invoiceResult.id.toString(),
                                    amount: parseFloat(downPayment),
                                    status: 'issued',
                                    date: new Date(),
                                    url: invoiceResult.pdf_url || null, // Might be null initially
                                    patientId: patient.id,
                                    paymentMethod: 'card',
                                    concept: `${name} - Entrada Inicial`
                                }
                            });
                            console.log(`✅ Invoice saved to CRM (Prisma): ${savedInvoice.invoiceNumber}`);

                            // 2. Create Payment Record (So it appears in Payment History)
                            // Check if Payment model exists and has relation? Yes, based on schema.
                            await prisma.payment.create({
                                data: {
                                    patientId: patient.id,
                                    amount: parseFloat(downPayment),
                                    method: 'card',
                                    type: 'DIRECT_CHARGE',
                                    invoiceId: savedInvoice.id,
                                    notes: `Entrada Financiación: ${name}`
                                }
                            });
                            console.log(`✅ Payment record created for invoice ${savedInvoice.invoiceNumber}`);

                            // 3. Update the installment
                            await prisma.installment.update({
                                where: { id: downPaymentInst.id },
                                data: {
                                    invoiceId: invoiceResult.id.toString(), // Keep Quipu ID for reference? Or use savedInvoice.id?
                                    // Existing logic used Quipu ID. Let's keep consistency for now.
                                    invoiceId: invoiceResult.id.toString(),
                                    invoicedAt: new Date(),
                                    status: 'PAID'
                                }
                            });

                            downPaymentInvoice = {
                                ...invoiceResult,
                                crmInvoiceId: savedInvoice.id
                            };
                            console.log(`✅ Down payment invoice created: ${invoiceResult.number}`);

                        } catch (dbError) {
                            console.error('❌ Error saving invoice/payment to DB:', dbError);
                            // Even if DB save fails, we return the Quipu result so flow continues
                            downPaymentInvoice = invoiceResult;
                        }
                    }
                }
            }
        } catch (invoiceError) {
            console.error('⚠️ Failed to create down payment invoice:', invoiceError.message);
            // Continue anyway - plan created, invoice can be generated manually
        }
    }

    const finalPlan = await prisma.treatmentPlan.findUnique({
        where: { id: plan.id },
        include: { installments: true }
    });

    return {
        plan: finalPlan,
        downPaymentInvoice
    };
}

/**
 * Process due installments - Generate invoices for installments due today
 */
async function processDueInstallments(prisma) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find installments due today that haven't been invoiced yet
    const dueInstallments = await prisma.installment.findMany({
        where: {
            dueDate: {
                gte: today,
                lt: tomorrow
            },
            invoiceId: null,
            status: 'PENDING'
        },
        include: {
            plan: {
                include: {
                    patient: true
                }
            }
        }
    });

    console.log(`📋 Found ${dueInstallments.length} installments due today`);

    const results = [];
    const quipuService = require('./quipuService');

    for (const inst of dueInstallments) {
        try {
            const patient = inst.plan.patient;
            if (!patient) continue;

            // Create contact in Quipu
            const contact = await quipuService.getOrCreateContact(patient);
            if (!contact || !contact.id) continue;

            // Create invoice
            const todayStr = new Date().toISOString().split('T')[0];
            const invoiceResult = await quipuService.createInvoice(
                contact.id,
                [{ name: `${inst.plan.name} - ${inst.description}`, quantity: 1, price: inst.amount }],
                todayStr,
                todayStr,
                'card'
            );

            if (invoiceResult && invoiceResult.success) {
                // Update installment
                await prisma.installment.update({
                    where: { id: inst.id },
                    data: {
                        invoiceId: invoiceResult.id,
                        invoicedAt: new Date()
                    }
                });

                results.push({
                    installmentId: inst.id,
                    patientName: patient.name,
                    amount: inst.amount,
                    invoiceNumber: invoiceResult.number,
                    success: true
                });

                console.log(`✅ Invoice created for ${patient.name}: ${inst.description} (${inst.amount}€)`);
            }
        } catch (err) {
            console.error(`❌ Failed to invoice installment ${inst.id}:`, err.message);
            results.push({
                installmentId: inst.id,
                error: err.message,
                success: false
            });
        }
    }

    return results;
}

/**
 * Get upcoming installments for reminders (due in X days)
 */
async function getUpcomingInstallments(prisma, daysAhead = 3) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(today);
    targetDate.setDate(targetDate.getDate() + daysAhead);

    const nextDay = new Date(targetDate);
    nextDay.setDate(nextDay.getDate() + 1);

    return await prisma.installment.findMany({
        where: {
            dueDate: {
                gte: targetDate,
                lt: nextDay
            },
            reminderSent: false,
            status: 'PENDING'
        },
        include: {
            plan: {
                include: {
                    patient: true
                }
            }
        }
    });
}

/**
 * Mark installment as paid
 */
async function markInstallmentPaid(prisma, installmentId) {
    return await prisma.installment.update({
        where: { id: installmentId },
        data: {
            status: 'PAID',
            paidDate: new Date()
        }
    });
}

module.exports = {
    calculateLiquidation,
    getPayroll,
    createFinancingPlan,
    processDueInstallments,
    getUpcomingInstallments,
    markInstallmentPaid
};
