'use strict';
const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

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
            // Ingresos reales: todos los pagos creados en el mes
            prisma.payment.aggregate({
                _sum:   { amount: true },
                _count: { id: true },
                where:  { createdAt: { gte: startDate, lte: endDate } },
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
        ]);

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
        });
    } catch (err) {
        console.error('[Analytics] Error fetching monthly KPIs:', err);
        return res.status(500).json({ error: 'Error al obtener las métricas mensuales.' });
    }
});

module.exports = router;
