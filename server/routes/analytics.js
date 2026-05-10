'use strict';
const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

// Payment types that represent real clinical income.
// ADVANCE_PAYMENT and WALLET_TOPUP are balance deposits, not actual service payments.
const CLINICAL_INCOME_TYPES = ['DIRECT_CHARGE'];

// ─── GET /api/analytics/monthly?month=YYYY-MM ────────────────────────────────
// Returns aggregated KPIs + patient-level rows for the requested calendar month.
// All counts/sums default to 0 when no data exists.
router.get('/monthly', async (req, res) => {
    const { month } = req.query;

    // Validate format: YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return res.status(400).json({ error: 'El parámetro "month" es requerido en formato YYYY-MM.' });
    }

    const [year, monthNum] = month.split('-').map(Number);
    if (monthNum < 1 || monthNum > 12) {
        return res.status(400).json({ error: 'Mes inválido. Debe estar entre 01 y 12.' });
    }

    // Build inclusive date range for the requested month (UTC)
    const startDate = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    const endDate   = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));

    try {
        // ── 1. KPI aggregations + patient detail (parallel) ──────────────────
        const [
            newPatientsCount,
            budgetsCreatedAgg,
            budgetsAcceptedAgg,
            realRevenueAgg,
            budgetsInMonth,
            newPatientList,
            paymentDetailRows,
        ] = await Promise.all([
            // Nuevos pacientes creados en el mes
            prisma.patient.count({
                where: { createdAt: { gte: startDate, lte: endDate } },
            }),
            // Presupuestos entregados (creados) en el mes
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where:  { createdAt: { gte: startDate, lte: endDate } },
            }),
            // Presupuestos aceptados (updatedAt en el mes, status ACCEPTED)
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where:  { status: 'ACCEPTED', updatedAt: { gte: startDate, lte: endDate } },
            }),
            // Ingresos reales: solo cobros clínicos directos (excluye recargas de monedero y anticipos)
            prisma.payment.aggregate({
                _sum:   { amount: true },
                _count: { id: true },
                where:  {
                    createdAt: { gte: startDate, lte: endDate },
                    type: { in: CLINICAL_INCOME_TYPES },
                    amount: { gt: 0 },
                },
            }),
            // Detalle por paciente: presupuestos creados en el mes
            prisma.budget.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                include: {
                    patient: {
                        select: {
                            id:            true,
                            historyNumber: true,
                            name:          true,
                            firstName:     true,
                            lastName1:     true,
                            createdAt:     true,
                        },
                    },
                    items: { select: { name: true, price: true, quantity: true } },
                },
                orderBy: { createdAt: 'asc' },
                take: 300,
            }),
            // Lista de nuevos pacientes del mes (para desplegable en tarjeta)
            prisma.patient.findMany({
                where: { createdAt: { gte: startDate, lte: endDate } },
                select: { historyNumber: true, name: true, firstName: true, lastName1: true },
                orderBy: { createdAt: 'asc' },
                take: 100,
            }),
            // Cobros individuales para trazabilidad (modal "Ingresos Reales")
            prisma.payment.findMany({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                    type: { in: CLINICAL_INCOME_TYPES },
                    amount: { gt: 0 },
                },
                select: {
                    id: true,
                    amount: true,
                    method: true,
                    notes: true,
                    patientId: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'asc' },
                take: 500,
            }),
        ]);

        // ── 1b. Enrich payment details with patient names ─────────────────────
        const patientIdsForPayments = [...new Set(paymentDetailRows.map(p => p.patientId).filter(Boolean))];
        let paymentPatientMap = {};
        if (patientIdsForPayments.length > 0) {
            const pts = await prisma.patient.findMany({
                where: { id: { in: patientIdsForPayments } },
                select: { id: true, name: true, historyNumber: true, firstName: true, lastName1: true },
            });
            pts.forEach(p => { paymentPatientMap[p.id] = p; });
        }
        const paymentDetails = paymentDetailRows.map(p => {
            const pt = paymentPatientMap[p.patientId] || {};
            return {
                id:            p.id,
                date:          p.createdAt,
                amount:        p.amount,
                method:        p.method,
                concept:       p.notes || 'Cobro',
                patientName:   ([pt.firstName, pt.lastName1].filter(Boolean).join(' ')) || pt.name || 'Desconocido',
                historyNumber: pt.historyNumber || '—',
            };
        });

        // ── 2. Payment totals per budget ──────────────────────────────────────
        const budgetIds = budgetsInMonth.map(b => b.id);
        const paymentTotals = budgetIds.length > 0
            ? await prisma.payment.groupBy({
                by:    ['budgetId'],
                _sum:  { amount: true },
                where: { budgetId: { in: budgetIds } },
            })
            : [];

        const paymentMap = {};
        for (const pt of paymentTotals) {
            if (pt.budgetId) paymentMap[pt.budgetId] = pt._sum.amount ?? 0;
        }

        // ── 3. Top treatment of the month (most frequent item name) ───────────
        const treatmentFreq = {};
        for (const b of budgetsInMonth) {
            for (const item of b.items) {
                if (item.name) {
                    const key = item.name.trim().toUpperCase();
                    treatmentFreq[key] = (treatmentFreq[key] ?? 0) + (item.quantity ?? 1);
                }
            }
        }
        const topTreatment = Object.entries(treatmentFreq)
            .sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

        // ── 4. Conversion rate ────────────────────────────────────────────────
        // New patients this month who accepted a budget AND paid at least once
        const newAcceptedPaidSet = new Set(
            budgetsInMonth
                .filter(b => {
                    const isNew      = b.patient.createdAt >= startDate && b.patient.createdAt <= endDate;
                    const isAccepted = b.status === 'ACCEPTED';
                    const hasPaid    = (paymentMap[b.id] ?? 0) > 0;
                    return isNew && isAccepted && hasPaid;
                })
                .map(b => b.patient.id)
        );
        const conversionRate = newPatientsCount > 0
            ? Math.round((newAcceptedPaidSet.size / newPatientsCount) * 100)
            : 0;

        // ── 5. Build patient rows ─────────────────────────────────────────────
        const patientRows = budgetsInMonth.map(budget => {
            const p             = budget.patient;
            const isFirstVisit  = p.createdAt >= startDate && p.createdAt <= endDate;
            const closedAmount  = paymentMap[budget.id] ?? 0;

            // Most expensive item in this budget
            const topItem = budget.items.length > 0
                ? budget.items.reduce((best, item) =>
                    (item.price * (item.quantity ?? 1)) > (best.price * (best.quantity ?? 1)) ? item : best
                  )
                : null;

            // Budget display reference
            const nhcNum    = p.historyNumber ? p.historyNumber.replace(/[^\d]/g, '') : null;
            const budgetRef = budget.title
                ?? (nhcNum ? `Presupuesto Nº ${nhcNum}` : `Presupuesto #${budget.id.slice(0, 6)}`);

            return {
                nhc:          p.historyNumber ?? '—',
                date:         budget.createdAt.toISOString().split('T')[0],
                name:         ([p.firstName, p.lastName1].filter(Boolean).join(' ')) || p.name,
                isFirstVisit,
                budgetRef,
                budgetStatus: budget.status,
                budgetAmount: budget.totalAmount,
                closedAmount,
                topTreatment: topItem?.name?.trim().toUpperCase() ?? '—',
            };
        });

        return res.json({
            month,
            newPatients: newPatientsCount ?? 0,
            budgetsCreated: {
                count: budgetsCreatedAgg._count.id        ?? 0,
                total: budgetsCreatedAgg._sum.totalAmount ?? 0,
            },
            budgetsAccepted: {
                count: budgetsAcceptedAgg._count.id        ?? 0,
                total: budgetsAcceptedAgg._sum.totalAmount ?? 0,
            },
            realRevenue: {
                count: realRevenueAgg._count.id   ?? 0,
                total: realRevenueAgg._sum.amount ?? 0,
            },
            conversionRate,
            topTreatment,
            newPatientList: newPatientList.map(p => ({
                nhc:  p.historyNumber ?? '—',
                name: ([p.firstName, p.lastName1].filter(Boolean).join(' ')) || p.name,
            })),
            patientRows,
            paymentDetails,
        });
    } catch (err) {
        console.error('[Analytics] Error fetching monthly KPIs:', err);
        return res.status(500).json({ error: 'Error al obtener las métricas mensuales.' });
    }
});

// ─── GET /api/analytics/annual?year=YYYY ─────────────────────────────────────
// Returns aggregated KPIs for the full calendar year.
router.get('/annual', async (req, res) => {
    const { year } = req.query;

    if (!year || !/^\d{4}$/.test(year)) {
        return res.status(400).json({ error: 'El parámetro "year" es requerido en formato YYYY.' });
    }

    const y = Number(year);
    const startDate = new Date(Date.UTC(y, 0,  1, 0, 0, 0, 0));
    const endDate   = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));

    try {
        const [
            newPatientsCount,
            budgetsCreatedAgg,
            budgetsAcceptedAgg,
            realRevenueAgg,
            paymentDetailRows,
        ] = await Promise.all([
            prisma.patient.count({ where: { createdAt: { gte: startDate, lte: endDate } } }),
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where:  { createdAt: { gte: startDate, lte: endDate } },
            }),
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where:  { status: 'ACCEPTED', updatedAt: { gte: startDate, lte: endDate } },
            }),
            prisma.payment.aggregate({
                _sum:   { amount: true },
                _count: { id: true },
                where:  { createdAt: { gte: startDate, lte: endDate }, type: { in: CLINICAL_INCOME_TYPES }, amount: { gt: 0 } },
            }),
            prisma.payment.findMany({
                where: { createdAt: { gte: startDate, lte: endDate }, type: { in: CLINICAL_INCOME_TYPES }, amount: { gt: 0 } },
                select: { id: true, amount: true, method: true, notes: true, patientId: true, createdAt: true },
                orderBy: { createdAt: 'asc' },
                take: 2000,
            }),
        ]);

        // Enrich payment details with patient names
        const patientIdsForPayments = [...new Set(paymentDetailRows.map(p => p.patientId).filter(Boolean))];
        let paymentPatientMap = {};
        if (patientIdsForPayments.length > 0) {
            const pts = await prisma.patient.findMany({
                where: { id: { in: patientIdsForPayments } },
                select: { id: true, name: true, historyNumber: true, firstName: true, lastName1: true },
            });
            pts.forEach(p => { paymentPatientMap[p.id] = p; });
        }
        const paymentDetails = paymentDetailRows.map(p => {
            const pt = paymentPatientMap[p.patientId] || {};
            return {
                id:            p.id,
                date:          p.createdAt,
                amount:        p.amount,
                method:        p.method,
                concept:       p.notes || 'Cobro',
                patientName:   ([pt.firstName, pt.lastName1].filter(Boolean).join(' ')) || pt.name || 'Desconocido',
                historyNumber: pt.historyNumber || '—',
            };
        });

        // Monthly breakdown for the year chart
        const monthlyBreakdown = [];
        for (let m = 1; m <= 12; m++) {
            const mStart = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
            const mEnd   = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
            const agg = await prisma.payment.aggregate({
                _sum: { amount: true },
                where: { createdAt: { gte: mStart, lte: mEnd }, type: { in: CLINICAL_INCOME_TYPES }, amount: { gt: 0 } },
            });
            monthlyBreakdown.push({ month: m, total: agg._sum.amount ?? 0 });
        }

        return res.json({
            year,
            newPatients:     newPatientsCount ?? 0,
            budgetsCreated:  { count: budgetsCreatedAgg._count.id ?? 0,        total: budgetsCreatedAgg._sum.totalAmount ?? 0 },
            budgetsAccepted: { count: budgetsAcceptedAgg._count.id ?? 0,       total: budgetsAcceptedAgg._sum.totalAmount ?? 0 },
            realRevenue:     { count: realRevenueAgg._count.id ?? 0,           total: realRevenueAgg._sum.amount ?? 0 },
            monthlyBreakdown,
            paymentDetails,
        });
    } catch (err) {
        console.error('[Analytics] Error fetching annual KPIs:', err);
        return res.status(500).json({ error: 'Error al obtener las métricas anuales.' });
    }
});

// ─── GET /api/analytics/doctors?month=YYYY-MM  (or ?year=YYYY) ───────────────
// Returns billing and commission breakdown grouped by doctor.
router.get('/doctors', async (req, res) => {
    const { month, year } = req.query;

    let startDate, endDate, periodLabel;

    if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [y, m] = month.split('-').map(Number);
        startDate  = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
        endDate    = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
        periodLabel = month;
    } else if (year && /^\d{4}$/.test(year)) {
        const y = Number(year);
        startDate  = new Date(Date.UTC(y, 0,  1, 0, 0, 0, 0));
        endDate    = new Date(Date.UTC(y, 11, 31, 23, 59, 59, 999));
        periodLabel = year;
    } else {
        // Default: current month
        const now  = new Date();
        startDate  = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
        endDate    = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
        periodLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    }

    try {
        // Fetch all liquidations in the period (using appointment.date as reference)
        // We can't do this efficiently in pure Prisma without raw SQL; use two queries.
        const allLiquidations = await prisma.liquidation.findMany({
            where: { createdAt: { gte: startDate, lte: endDate } },
            select: {
                id: true,
                doctorId: true,
                grossAmount: true,
                labCost: true,
                finalAmount: true,
                treatmentName: true,
                appointmentId: true,
                itemIndex: true,
            },
        });

        // Group by doctorId
        const grouped = {};
        for (const liq of allLiquidations) {
            if (!liq.doctorId) continue;
            if (!grouped[liq.doctorId]) {
                grouped[liq.doctorId] = {
                    doctorId:         liq.doctorId,
                    appointmentCount: 0,
                    totalBilled:      0,
                    totalLabCost:     0,
                    totalCommission:  0,
                    treatments:       new Set(),
                    seenAppointments: new Set(),
                };
            }
            const g = grouped[liq.doctorId];
            g.totalBilled     += liq.grossAmount  || 0;
            g.totalLabCost    += liq.labCost       || 0;
            g.totalCommission += liq.finalAmount   || 0;
            if (liq.treatmentName) g.treatments.add(liq.treatmentName);
            if (liq.appointmentId) g.seenAppointments.add(liq.appointmentId);
        }

        // Enrich with doctor names
        const doctorIds = Object.keys(grouped);
        let doctorMap = {};
        if (doctorIds.length > 0) {
            const doctors = await prisma.doctor.findMany({
                where: { id: { in: doctorIds } },
                select: { id: true, name: true, specialization: true },
            });
            doctors.forEach(d => { doctorMap[d.id] = d; });
        }

        const result = Object.values(grouped).map(g => ({
            doctorId:         g.doctorId,
            doctorName:       doctorMap[g.doctorId]?.name || 'Doctor desconocido',
            specialization:   doctorMap[g.doctorId]?.specialization || null,
            appointmentCount: g.seenAppointments.size,
            totalBilled:      Math.round(g.totalBilled * 100) / 100,
            totalLabCost:     Math.round(g.totalLabCost * 100) / 100,
            totalCommission:  Math.round(g.totalCommission * 100) / 100,
            treatments:       Array.from(g.treatments),
        })).sort((a, b) => b.totalBilled - a.totalBilled);

        return res.json({ period: periodLabel, doctors: result });
    } catch (err) {
        console.error('[Analytics] Error fetching doctor analytics:', err);
        return res.status(500).json({ error: 'Error al obtener el análisis por doctor.' });
    }
});

module.exports = router;

