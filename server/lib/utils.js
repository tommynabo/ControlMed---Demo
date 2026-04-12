'use strict';

/**
 * UUID validation helper
 */
const isUuid = (value) => {
    if (!value || typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

/**
 * Normalize a Prisma DoctorSchedule object to snake_case for frontend compatibility
 */
const normalizeSchedule = (schedule) => ({
    ...schedule,
    doctor_id: schedule.doctorId,
    doctor_name: schedule.doctorName,
    morning_start: schedule.morningStart,
    morning_end: schedule.morningEnd,
    afternoon_start: schedule.afternoonStart,
    afternoon_end: schedule.afternoonEnd,
    is_active: schedule.isActive,
    created_at: schedule.createdAt
});

/**
 * Normalize a patient record — parse JSON string fields into arrays
 */
const normalizePatient = (patient) => {
    if (!patient) return patient;

    const parseJsonArray = (field) => {
        if (Array.isArray(field)) return field;
        if (typeof field === 'string') {
            try { return JSON.parse(field); } catch { return []; }
        }
        return [];
    };

    return {
        ...patient,
        prescriptions:  parseJsonArray(patient.prescriptions),
        medicalHistory: parseJsonArray(patient.medicalHistory),
        criticalAlerts: parseJsonArray(patient.criticalAlerts),
        historyNumber:  patient.historyNumber || patient.history_number || patient.historynumber,
    };
};

/**
 * Recalculate and persist a patient's wallet balance from Payment ledger entries.
 * Returns the computed balance (or 0 on error).
 */
const calculateWalletBalance = async (supabase, patientId) => {
    try {
        const { data: payments, error } = await supabase
            .from('Payment')
            .select('amount, type, method')
            .eq('patientId', patientId);

        if (error) throw error;

        let balance = 0;
        (payments || []).forEach((p) => {
            if (p.type === 'ADVANCE_PAYMENT') {
                balance += (p.amount || 0);
            }
            if (p.type === 'TRANSFER') {
                balance -= (p.amount || 0);
            }
            if ((p.method === 'wallet' || p.method === 'ADVANCE_PAYMENT') &&
                p.type !== 'ADVANCE_PAYMENT' && p.type !== 'TRANSFER') {
                balance -= (p.amount || 0);
            }
            if (p.type === 'DIRECT_CHARGE' && p.method === 'wallet') {
                balance -= (p.amount || 0);
            }
        });

        await supabase.from('Patient').update({ wallet: balance }).eq('id', patientId);
        console.log(`💰 [WALLET] Updated balance for ${patientId}: ${balance.toFixed(2)}€`);
        return balance;
    } catch (e) {
        console.error('❌ Error calculating wallet:', e);
        return 0;
    }
};

module.exports = { isUuid, normalizeSchedule, normalizePatient, calculateWalletBalance };
