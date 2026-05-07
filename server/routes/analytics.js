'use strict';
const express = require('express');
const { prisma } = require('../lib/db');

const router = express.Router();

// ─── GET /api/analytics/monthly?month=YYYY-MM ────────────────────────────────
// Returns aggregated KPIs for the requested calendar month.
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
    const endDate   = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999)); // last day of month

    try {
        const [
            newPatientsCount,
            budgetsCreatedAgg,
            budgetsAcceptedAgg,
            realRevenueAgg,
        ] = await Promise.all([
            // 1. Nuevos pacientes creados en el mes
            prisma.patient.count({
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),

            // 2. Presupuestos entregados (creados) en el mes
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),

            // 3. Presupuestos aceptados (actualizados a ACCEPTED) en el mes
            prisma.budget.aggregate({
                _count: { id: true },
                _sum:   { totalAmount: true },
                where: {
                    status:    'ACCEPTED',
                    updatedAt: { gte: startDate, lte: endDate },
                },
            }),

            // 4. Ingresos reales: suma de todos los pagos creados en el mes
            prisma.payment.aggregate({
                _sum:   { amount: true },
                _count: { id: true },
                where: {
                    createdAt: { gte: startDate, lte: endDate },
                },
            }),
        ]);

        return res.json({
            month,
            newPatients: newPatientsCount ?? 0,
            budgetsCreated: {
                count: budgetsCreatedAgg._count.id    ?? 0,
                total: budgetsCreatedAgg._sum.totalAmount ?? 0,
            },
            budgetsAccepted: {
                count: budgetsAcceptedAgg._count.id    ?? 0,
                total: budgetsAcceptedAgg._sum.totalAmount ?? 0,
            },
            realRevenue: {
                count: realRevenueAgg._count.id    ?? 0,
                total: realRevenueAgg._sum.amount  ?? 0,
            },
        });
    } catch (err) {
        console.error('[Analytics] Error fetching monthly KPIs:', err);
        return res.status(500).json({ error: 'Error al obtener las métricas mensuales.' });
    }
});

module.exports = router;
