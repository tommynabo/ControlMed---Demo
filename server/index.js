const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const path = require('path');

// Services
const financeService = require('./services/financeService');
const orthoService = require('./services/orthoService');
const inventoryService = require('./services/inventoryService');
const invoiceService = require('./services/invoiceService');
const quipuService = require('./services/quipuService');
const aiAgent = require('./services/aiAgent'); // Commented out to reduce noise if missing
const budgetService = require('./services/budgetService');
const templateService = require('./services/templateService');
const whatsappService = require('./services/whatsappService');
const schedulerService = require('./services/schedulerService');

const prisma = global.__prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['warn', 'error'] : ['query', 'info', 'warn', 'error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        },
    },
});

// Singleton: avoid exhausting connection pool on hot-reloads (serverless/dev)
if (process.env.NODE_ENV !== 'production') {
    global.__prisma = prisma;
}

// Global Error Handler for Prisma Connection
// Global Error Handler for Prisma Connection
prisma.$connect()
    .then(() => {
        const dbUrl = process.env.DATABASE_URL || 'Unknown';
        const maskedUrl = dbUrl.replace(/:([^:@]+)@/, ':****@');
        console.log(`✅ Base de datos conectada correctamente [${process.env.NODE_ENV || 'DEV'}]`);
        console.log(`📡 URL: ${maskedUrl}`);
    })
    .catch((e) => {
        console.error('❌ Error fatal de conexión a base de datos (PostgreSQL/Supabase):');
        console.error(e.message);
        // Do not log the full error object to avoid leaking secrets if any
    });
const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Increased for Base64 Uploads

// --- MOCK AUTH MIDDLEWARE (MODULE 3: RBAC) ---
const authMiddleware = (req, res, next) => {
    // In a real app, verify JWT. Here we assume a header 'x-user-role' for demo purposes.
    // Defaults to DOCTOR if not specified.
    const role = req.headers['x-user-role'] || 'DOCTOR';
    const userId = req.headers['x-user-id'] || '00000000-0000-0000-0000-000000000000';
    req.user = { id: userId, role };
    next();
};

app.use(authMiddleware);

// --- CACHE-CONTROL MIDDLEWARE ---
// Critical Fix: Prevent Vercel from caching API responses (Next.js / ISR / Edge Cache)
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    next();
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date(), env: process.env.NODE_ENV });
});

// --- WHATSAPP INIT ---
whatsappService.initialize();
schedulerService.startScheduler(prisma);

// --- MODULE 1: FINANCIAL ENGINE ---
app.post('/api/treatments/:appointmentId/complete', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        // 1. Mark appointment as completed
        const appointment = await prisma.appointment.update({
            where: { id: appointmentId },
            data: { status: 'COMPLETED' },
            include: { treatment: true, doctor: true }
        });

        // 2. Trigger Liquidation Calculation
        const liquidation = await financeService.calculateLiquidation(prisma, appointment);
        res.json({ appointment, liquidation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/liquidations', async (req, res) => {
    // RBAC Check: Only ADMIN or the specific DOCTOR can see this
    if (req.user.role === 'RECEPTION') return res.status(403).json({ error: 'Access Denied' });

    try {
        const { doctorId, month } = req.query;

        // Security: If DOCTOR, force doctorId to be own
        if (req.user.role === 'DOCTOR') {
            // In real app, check if requested doctorId matches req.user.doctorId
            // allowing for now but ignoring filter if it tries to see others
        }

        const payroll = await financeService.getPayroll(prisma, doctorId, month);
        res.json(payroll);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- BUDGETS ---
// --- BUDGETS (Moved to Module 8 below) ---

// --- PRESCRIPTIONS ---
app.get('/api/patients/:patientId/prescriptions', async (req, res) => {
    try {
        const { patientId } = req.params;
        const prescriptions = await prisma.prescription.findMany({
            where: { patientId },
            include: { doctor: { select: { id: true, name: true } } },
            orderBy: { prescriptionDate: 'desc' }
        });
        res.json(prescriptions);
    } catch (e) {
        console.error('Error fetching prescriptions:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/prescriptions', async (req, res) => {
    try {
        const data = req.body;
        // In this system, doctorId often comes from headers via authMiddleware unless provided
        const doctorId = data.doctorId || req.user.id;
        
        if (!data.patientId) return res.status(400).json({ error: 'patientId is required' });

        const prescription = await prisma.prescription.create({
            data: {
                id: crypto.randomUUID(),
                patientId: data.patientId,
                doctorId: doctorId,
                medication: data.medication,
                pharmaceuticalForm: data.pharmaceuticalForm,
                administrationRoute: data.administrationRoute,
                packagesNumber: data.packagesNumber ? parseInt(data.packagesNumber) : null,
                dose: data.dose,
                duration: data.duration,
                posology: data.posology,
                units: data.units,
                schedulePattern: data.schedulePattern,
                diagnosis: data.diagnosis,
                patientInstructions: data.patientInstructions,
                pharmacyInstructions: data.pharmacyInstructions,
                prescriptionDate: data.prescriptionDate ? new Date(data.prescriptionDate) : new Date(),
                dispensationDate: data.dispensationDate ? new Date(data.dispensationDate) : null,
                dispensationOrderNumber: data.dispensationOrderNumber
            },
            include: { doctor: { select: { id: true, name: true } } }
        });
        res.status(201).json(prescription);
    } catch (e) {
        console.error('Error creating prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/prescriptions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // RGPD Soft Delete via Prisma
        await prisma.prescription.update({
            where: { id },
            data: { deleted_at: new Date() }
        }).catch(async () => {
            // If Prisma schema lacks deleted_at yet, try Supabase
            const sb = getSupabase();
            await sb.from('Prescription').update({ deleted_at: new Date().toISOString() }).eq('id', id);
        });
        res.json({ success: true });
    } catch (e) {
        console.error('Error soft-deleting prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/prescriptions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = req.body;
        
        // Remove nested fields if present to avoid prisma update error
        if (data.doctor) delete data.doctor;
        if (data.patient) delete data.patient;
        if (data.id) delete data.id;

        const updated = await prisma.prescription.update({
            where: { id },
            data: {
                ...data,
                // Ensure dates are Date objects if provided
                prescriptionDate: data.prescriptionDate ? new Date(data.prescriptionDate) : undefined,
                dispensationDate: data.dispensationDate ? new Date(data.dispensationDate) : undefined,
                packagesNumber: data.packagesNumber ? parseInt(data.packagesNumber) : undefined,
            },
            include: { doctor: { select: { id: true, name: true } } }
        });
        res.json(updated);
    } catch (e) {
        console.error('Error updating prescription:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- SCHEDULE DURATIONS (Missing API Endpoints) ---
app.get('/api/schedule/durations', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('service_durations').select('*').order('specialty', { ascending: true });
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching durations:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/schedule/durations', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('service_durations').insert([req.body]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating duration:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/schedule/durations/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { data, error } = await supabase.from('service_durations').update(req.body).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating duration:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/schedule/durations/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { error } = await supabase.from('service_durations').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting duration:', e);
        res.status(500).json({ error: e.message });
    }
});
// --- SYSTEM USERS API ---
// Using Supabase service role key to bypass RLS and avoid text=uuid casting issues on frontend
app.get('/api/system-users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' }
        });
        // Map to frontend naming if needed (full_name)
        const mappedUsers = users.map(u => ({
            ...u,
            full_name: u.name,
            is_active: u.isActive,
            isDoctor: u.isDoctor
        }));
        res.json(mappedUsers);
    } catch (e) {
        console.error('Error fetching system users:', e);
        res.status(500).json({ error: e.message });
    }
});  app.get('/api/system-users/all', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: [
                { role: 'asc' },
                { name: 'asc' }
            ]
        });
        const mappedUsers = users.map(u => ({
            ...u,
            full_name: u.name,
            is_active: u.isActive,
            isDoctor: u.isDoctor
        }));
        res.json(mappedUsers);
    } catch (e) {
        console.error('Error fetching all system users:', e);
        res.status(500).json({ error: e.message });
    }
});  app.get('/api/system-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id }
        });
        if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
        
        res.json({
            ...user,
            full_name: user.name,
            is_active: user.isActive
        });
    } catch (e) {
        console.error('Error fetching system user:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/system-users', async (req, res) => {
    try {
        const { email, full_name, role, is_active, password, doctorId, isDoctor } = req.body;

        // Map frontend roles to Prisma enum values
        const ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTIONIST': 'RECEPTION', 'RECEPTION': 'RECEPTION', 'ASSISTANT': 'RECEPTION', 'AUXILIAR': 'RECEPTION' };
        const prismaRole = ROLE_MAP[role] || 'DOCTOR';

        // isDoctor: true when role is DOCTOR or explicitly set
        const isDoctorFlag = isDoctor === true || prismaRole === 'DOCTOR';

        const result = await prisma.$transaction(async (tx) => {
            const sharedId = crypto.randomUUID();

            const user = await tx.user.create({
                data: {
                    id: sharedId,
                    email,
                    name: full_name,
                    role: prismaRole,
                    isDoctor: isDoctorFlag,
                    isActive: is_active !== undefined ? is_active : true,
                    password: password || '123',
                    doctorId: doctorId || null
                }
            });

            // If isDoctor (DOCTOR role OR explicitly flagged), create Doctor profile + default schedule
            if (isDoctorFlag && !doctorId) {
                await tx.doctor.create({
                    data: {
                        id: sharedId,
                        name: full_name,
                        specialization: 'Odontólogo',
                        commissionPercentage: 0
                    }
                });
                await tx.user.update({
                    where: { id: sharedId },
                    data: { doctorId: sharedId }
                });
                await tx.doctorSchedule.create({
                    data: {
                        doctorId: sharedId,
                        doctorName: full_name,
                        monday: true, tuesday: true, wednesday: true,
                        thursday: true, friday: true, saturday: false, sunday: false,
                        morningStart: '09:00:00', morningEnd: '13:00:00',
                        afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                    }
                });
            }

            return tx.user.findUnique({ where: { id: sharedId } });
        });

        res.status(201).json({
            ...result,
            full_name: result.name,
            is_active: result.isActive,
            isDoctor: result.isDoctor
        });
    } catch (e) {
        console.error('Error creating system user:', e);
        res.status(500).json({ error: e.message });
   }
});

app.put('/api/system-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, full_name, role, is_active, doctorId, isDoctor } = req.body;

        // Map frontend roles to Prisma enum values
        const SU_ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTIONIST': 'RECEPTION', 'RECEPTION': 'RECEPTION', 'ASSISTANT': 'RECEPTION', 'AUXILIAR': 'RECEPTION' };
        const prismaRole = role ? (SU_ROLE_MAP[role] || role) : undefined;

        // Determine isDoctor: explicit flag takes precedence; role=DOCTOR always implies isDoctor
        const isDoctorFlag = isDoctor !== undefined
            ? isDoctor === true
            : prismaRole === 'DOCTOR' ? true : undefined;

        const updateData = {
            ...(email !== undefined && { email }),
            ...(full_name !== undefined && { name: full_name }),
            ...(prismaRole !== undefined && { role: prismaRole }),
            ...(is_active !== undefined && { isActive: is_active }),
            ...(isDoctorFlag !== undefined && { isDoctor: isDoctorFlag }),
            ...(doctorId !== undefined && { doctorId: doctorId || null })
        };

        const user = await prisma.$transaction(async (tx) => {
            const updated = await tx.user.update({ where: { id }, data: updateData });

            // If now isDoctor and no Doctor profile exists, create one
            if (updated.isDoctor) {
                const targetId = updated.doctorId || id;
                const existingDoctor = await tx.doctor.findUnique({ where: { id: targetId } });
                if (!existingDoctor) {
                    await tx.doctor.create({
                        data: { id, name: updated.name, specialization: 'Odontólogo', commissionPercentage: 0 }
                    });
                    await tx.user.update({ where: { id }, data: { doctorId: id } });
                    await tx.doctorSchedule.create({
                        data: {
                            doctorId: id, doctorName: updated.name,
                            monday: true, tuesday: true, wednesday: true,
                            thursday: true, friday: true, saturday: false, sunday: false,
                            morningStart: '09:00:00', morningEnd: '13:00:00',
                            afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                        }
                    });
                } else if (full_name) {
                    await tx.doctor.update({ where: { id: existingDoctor.id }, data: { name: full_name } });
                }
            }

            return tx.user.findUnique({ where: { id } });
        });

        res.json({
            ...user,
            full_name: user.name,
            is_active: user.isActive,
            isDoctor: user.isDoctor
        });
    } catch (e) {
        console.error('Error updating system user:', e);
        res.status(500).json({ error: e.message });
    }
});  app.delete('/api/system-users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.user.delete({
            where: { id }
        });
        res.status(204).send();
    } catch (e) {
        console.error('Error deleting system user:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DOCTOR SCHEDULES API ---
const isUuid = (value) => {
    if (!value || typeof value !== 'string') return false;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
};

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

app.get('/api/doctor-schedules', async (req, res) => {
    try {
        const schedules = await prisma.doctorSchedule.findMany({
            where: { isActive: true },
            include: { doctor: true }
        });
        res.json(schedules.map(normalizeSchedule));
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/doctor-schedules/doctor/:doctorId', async (req, res) => {
    try {
        const { doctorId } = req.params;
        if (!isUuid(doctorId)) {
            return res.status(400).json({ error: 'doctorId debe ser un UUID válido' });
        }

        const schedules = await prisma.doctorSchedule.findMany({
            where: { doctorId }
        });
        res.json(schedules.map(normalizeSchedule));
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/doctor-schedules', async (req, res) => {
    try {
        const {
            doctor_id, doctorId, doctor_name, monday, tuesday, wednesday, thursday, friday, saturday, sunday,
            morning_start, morning_end, afternoon_start, afternoon_end, notes, is_active
        } = req.body;

        const safeDoctorId = doctorId || doctor_id;
        if (!safeDoctorId) return res.status(400).json({ error: 'doctor_id es obligatorio' });
        if (!isUuid(safeDoctorId)) return res.status(400).json({ error: 'doctor_id debe ser un UUID válido' });

        const doctorExists = await prisma.doctor.findUnique({ where: { id: safeDoctorId } });
        if (!doctorExists) {
            return res.status(404).json({ error: 'El doctor especificado no existe (UUID no encontrado)' });
        }

        const newSchedule = await prisma.doctorSchedule.create({
            data: {
                doctorId: safeDoctorId,
                doctorName: doctor_name,
                monday: monday !== undefined ? monday : true,
                tuesday: tuesday !== undefined ? tuesday : true,
                wednesday: wednesday !== undefined ? wednesday : true,
                thursday: thursday !== undefined ? thursday : true,
                friday: friday !== undefined ? friday : true,
                saturday: saturday !== undefined ? saturday : false,
                sunday: sunday !== undefined ? sunday : false,
                morningStart: morning_start,
                morningEnd: morning_end,
                afternoonStart: afternoon_start,
                afternoonEnd: afternoon_end,
                notes: notes,
                isActive: is_active !== undefined ? is_active : true
            }
        });

        res.status(201).json(normalizeSchedule(newSchedule));
    } catch (e) {
        console.error('Error creating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/doctor-schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: 'id debe ser un UUID válido' });

        const updates = req.body;

        const data = {};
        const safeDoctorId = updates.doctorId || updates.doctor_id;
        if (safeDoctorId) {
            if (!isUuid(safeDoctorId)) return res.status(400).json({ error: 'doctor_id debe ser un UUID válido' });
            const doctorExists = await prisma.doctor.findUnique({ where: { id: safeDoctorId } });
            if (!doctorExists) return res.status(404).json({ error: 'El doctor especificado no existe (UUID no encontrado)' });
            data.doctorId = safeDoctorId;
        }

        if (updates.doctor_name !== undefined) data.doctorName = updates.doctor_name;
        if (updates.monday !== undefined) data.monday = updates.monday;
        if (updates.tuesday !== undefined) data.tuesday = updates.tuesday;
        if (updates.wednesday !== undefined) data.wednesday = updates.wednesday;
        if (updates.thursday !== undefined) data.thursday = updates.thursday;
        if (updates.friday !== undefined) data.friday = updates.friday;
        if (updates.saturday !== undefined) data.saturday = updates.saturday;
        if (updates.sunday !== undefined) data.sunday = updates.sunday;
        if (updates.morning_start !== undefined) data.morningStart = updates.morning_start;
        if (updates.morning_end !== undefined) data.morningEnd = updates.morning_end;
        if (updates.afternoon_start !== undefined) data.afternoonStart = updates.afternoon_start;
        if (updates.afternoon_end !== undefined) data.afternoonEnd = updates.afternoon_end;
        if (updates.notes !== undefined) data.notes = updates.notes;
        if (updates.is_active !== undefined) data.isActive = updates.is_active;

        const updated = await prisma.doctorSchedule.update({
            where: { id },
            data
        });
        res.json(normalizeSchedule(updated));
    } catch (e) {
        console.error('Error updating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/doctor-schedules/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!isUuid(id)) return res.status(400).json({ error: 'id debe ser un UUID válido' });
        await prisma.doctorSchedule.delete({ where: { id } });
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/finance/financing', async (req, res) => {
    try {
        const result = await financeService.createFinancingPlan(prisma, req.body);
        res.json(result);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get installments for a treatment plan
app.get('/api/finance/installments/:planId', async (req, res) => {
    try {
        const installments = await prisma.installment.findMany({
            where: { planId: req.params.planId },
            orderBy: { dueDate: 'asc' }
        });
        res.json(installments);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Mark installment as paid
app.post('/api/finance/installments/:id/pay', async (req, res) => {
    try {
        const updated = await financeService.markInstallmentPaid(prisma, req.params.id);
        res.json(updated);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Manual trigger for processing due installments (for testing)
app.post('/api/finance/installments/process-due', async (req, res) => {
    try {
        console.log('🔧 Manual trigger: Processing due installments...');
        const results = await financeService.processDueInstallments(prisma);
        res.json({ processed: results.length, results });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Get all treatment plans for a patient with installments
app.get('/api/finance/plans/:patientId', async (req, res) => {
    try {
        const plans = await prisma.treatmentPlan.findMany({
            where: { patientId: req.params.patientId },
            include: { installments: { orderBy: { dueDate: 'asc' } } },
            orderBy: { startDate: 'desc' }
        });
        res.json(plans);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- CLINICAL RECORDS (Module 4 Extension) ---
app.post('/api/clinical-records', async (req, res) => {
    try {
        const { patientId, treatment, observation, specialization, price, date, doctorId } = req.body;

        if (!doctorId) {
            return res.status(400).json({ error: 'Se requiere seleccionar un doctor responsable.' });
        }

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const payload = {
            treatment: treatment || 'Nota Clínica',
            observation: observation || '',
            specialization: specialization || 'General',
            price: price || 0,
            doctorId: doctorId,
        };

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .insert([{
                id: crypto.randomUUID(),
                patientId,
                date: new Date().toISOString(),
                text: JSON.stringify(payload),
                authorId: doctorId
            }])
            .select()
            .single();

        if (error) {
            console.error("❌ Error Saving Clinical Record:", error);
            return res.status(500).json({ error: error.message });
        }

        // Return object with parsed structure for frontend consistency
        const responseData = {
            ...data,
            clinicalData: payload,
            specialization: payload.specialization
        };

        res.status(201).json(responseData);
    } catch (e) {
        console.error("❌ Error in POST /api/clinical-records:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/clinical-records/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // RGPD Soft Delete: set deleted_at instead of hard-deleting
        const { error } = await supabase
            .from('ClinicalRecord')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/budgets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // RGPD Soft Delete
        const { error } = await supabase
            .from('Budget')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);
        if (error) throw error;

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/patients/:patientId/clinical-records', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .select('*')
            .eq('patientId', req.params.patientId)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });

        // Map 'text' back to 'clinicalData' for frontend
        const mappedData = data.map(record => {
            let parsed = {};
            let isJson = false;
            try {
                if (record.text && (record.text.startsWith('{') || record.text.startsWith('['))) {
                    parsed = JSON.parse(record.text);
                    isJson = true;
                }
            } catch (e) { }

            return {
                ...record,
                clinicalData: isJson ? parsed : { treatment: 'Nota', observation: record.text },
                specialization: isJson && parsed.specialization ? parsed.specialization : 'General'
            };
        });

        res.json(mappedData);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- DOCTORS ---
app.get('/api/doctors', async (req, res) => {
    try {
        // Join Doctor table with User table to filter real medical staff only.
        // A Doctor record is included when:
        //   a) It has NO linked User (standalone clinic doctor) → always include
        //   b) It has a linked User with isDoctor=true OR role='DOCTOR' → include
        //   c) It has a linked User who is ADMIN/RECEPTION with isDoctor=false → EXCLUDE
        const allDoctors = await prisma.doctor.findMany({
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                specialization: true,
                users: {
                    // Fetch ALL linked users (active and inactive) so we can correctly
                    // distinguish truly standalone records from records tied to inactive users.
                    select: { isDoctor: true, role: true, isActive: true }
                }
            }
        });

        // Ghost/test doctor names to permanently exclude from the Agenda
        const GHOST_DOCTOR_NAMES = new Set([
            'Francisca',
            'Prueba medico',
            'Leticia Rodriguez Silvera',
            'LauraLeticia Rodriguez Silvera',
            'Laura Leticia Rodriguez Silvera',
        ]);
        // Ghost Doctor record IDs (belt-and-suspenders, in case names change)
        const GHOST_DOCTOR_IDS = new Set([
            '6c1c4982-70e6-472c-880f-6550c3945c4d', // Prueba medico
            'f4f54750-c691-43ae-9f58-15092e184035', // Francisca
        ]);

        const filteredDoctors = allDoctors
            .filter(d => {
                // Explicit ghost/test account exclusion
                if (GHOST_DOCTOR_IDS.has(d.id) || GHOST_DOCTOR_NAMES.has(d.name)) return false;
                if (d.users.length === 0) return true; // truly standalone doctor (no user account at all) → keep
                // Only include if at least one linked user is active AND is a real doctor
                return d.users.some(u => u.isActive === true && (u.isDoctor === true || u.role === 'DOCTOR'));
            })
            .map(({ users, ...rest }) => rest); // strip the users field from response

        if (filteredDoctors.length > 0) {
            console.log(`✅ Loaded ${filteredDoctors.length} doctors (filtered Doctor table)`);
            return res.json(filteredDoctors);
        }

        // Fallback: if Doctor table is empty or no filtered doctors, use isDoctor users directly
        const doctorUsers = await prisma.user.findMany({
            where: { isDoctor: true, isActive: true },
            select: { id: true, name: true, doctorId: true }
        });

        // Return users with isDoctor=true as doctors (use doctorId if available, otherwise user id)
        const fallbackDoctors = doctorUsers.map(u => ({
            id: u.doctorId || u.id,
            name: u.name,
            specialization: 'Odontólogo'
        }));

        console.log(`✅ Loaded ${fallbackDoctors.length} doctors (fallback from User table)`);
        res.json(fallbackDoctors);
    } catch (e) {
        console.error('Error fetching doctors:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// DEBUG: Check doctors sync status
app.get('/api/debug/doctors', async (req, res) => {
    try {
        const supabase = getSupabase();

        // Check Doctor table
        const { data: doctors, error: doctorError } = await supabase
            .from('Doctor')
            .select('*');

        // Check User table for DOCTOR role
        const { data: doctorUsers, error: userError } = await supabase
            .from('User')
            .select('id, name, role')
            .eq('role', 'DOCTOR');

        res.json({
            status: 'debug',
            doctor_table: {
                count: doctors?.length || 0,
                error: doctorError?.message,
                doctors: doctors || []
            },
            user_table_doctors: {
                count: doctorUsers?.length || 0,
                error: userError?.message,
                users: doctorUsers || []
            },
            sync_status: {
                doctors_synced: doctors?.length || 0,
                users_with_doctor_role: doctorUsers?.length || 0,
                needs_sync: (doctorUsers?.length || 0) > (doctors?.length || 0)
            }
        });
    } catch (e) {
        console.error('Error in debug endpoint:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// AUTO-SYNC: Sincronizar doctores desde User a Doctor
app.post('/api/sync/doctors', async (req, res) => {
    try {
        const supabase = getSupabase();

        // Get all users with isDoctor=true
        const { data: doctorUsers, error: userError } = await supabase
            .from('User')
            .select('id, name')
            .eq('isDoctor', true);

        if (userError) {
            return res.status(500).json({ error: 'Error fetching doctor users: ' + userError.message });
        }

        if (!doctorUsers || doctorUsers.length === 0) {
            return res.json({
                success: true,
                message: 'No doctor users to sync',
                synced: 0
            });
        }

        // Insert/update each doctor in Doctor table
        const syncPromises = doctorUsers.map(user =>
            supabase
                .from('Doctor')
                .upsert({
                    id: user.id,
                    name: user.name,
                    specialization: 'Odontólogo'
                })
                .select()
        );

        const results = await Promise.all(syncPromises);
        const synced = results.filter(r => !r.error).length;

        console.log(`✅ Synchronized ${synced} doctors from User table`);

        res.json({
            success: true,
            message: `Synchronized ${synced} doctors from User table`,
            synced: synced
        });
    } catch (e) {
        console.error('Error syncing doctors:', e.message);
        res.status(500).json({ error: 'Sync failed: ' + e.message });
    }
});

// --- PATIENT MANAGEMENT ---
// Normalize patient data - parse JSON fields
const normalizePatient = (patient) => {
    if (!patient) return patient;

    return {
        ...patient,
        prescriptions: Array.isArray(patient.prescriptions)
            ? patient.prescriptions
            : (typeof patient.prescriptions === 'string'
                ? (() => {
                    try {
                        return JSON.parse(patient.prescriptions);
                    } catch {
                        return [];
                    }
                })()
                : []),
        medicalHistory: Array.isArray(patient.medicalHistory)
            ? patient.medicalHistory
            : (typeof patient.medicalHistory === 'string'
                ? (() => {
                    try {
                        return JSON.parse(patient.medicalHistory);
                    } catch {
                        return [];
                    }
                })()
                : []),
        criticalAlerts: Array.isArray(patient.criticalAlerts)
            ? patient.criticalAlerts
            : (typeof patient.criticalAlerts === 'string'
                ? (() => {
                    try {
                        return JSON.parse(patient.criticalAlerts);
                    } catch {
                        return [];
                    }
                })()
                : [])
    };
};

app.get('/api/patients', async (req, res) => {
    try {
        let supabase;
        try {
            supabase = getSupabase();
        } catch (configError) {
            return res.status(500).json({ error: configError.message });
        }

        const { page, limit, search } = req.query;
        const isPaginated = page !== undefined && limit !== undefined;

        let query = supabase
            .from('Patient')
            .select('*', isPaginated ? { count: 'exact' } : undefined)
            .order('name', { ascending: true });

        if (search) {
            // Sanitize search to avoid injection via PostgREST filter values
            const safe = String(search).replace(/[%_]/g, '\\$&').slice(0, 100);
            query = query.or(`name.ilike.%${safe}%,dni.ilike.%${safe}%`);
        }

        if (isPaginated) {
            const pageNum = Math.max(1, parseInt(page)) - 1;
            const limitNum = Math.min(200, Math.max(1, parseInt(limit)));
            const from = pageNum * limitNum;
            const to = from + limitNum - 1;
            query = query.range(from, to);
        }

        const { data, error, count } = await query;

        if (error) {
            console.error("❌ Supabase Fetch Error (Patients):", error);
            return res.status(500).json({ error: error.message });
        }

        const normalizedData = data.map(normalizePatient);

        if (isPaginated) {
            return res.json({ data: normalizedData, total: count, page: parseInt(page), limit: parseInt(limit) });
        }

        console.log(`✅ Loaded ${data.length} patients.`);
        res.json(normalizedData);
    } catch (e) {
        console.error("Error Fetching Patients:", e);
        res.status(500).json({ error: e.message });
    }
});

// GET single patient by ID — must be declared AFTER GET /api/patients (no conflict: differs in path depth)
app.get('/api/patients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let supabase;
        try {
            supabase = getSupabase();
        } catch (configError) {
            return res.status(500).json({ error: configError.message });
        }
        const { data, error } = await supabase
            .from('Patient')
            .select('*')
            .eq('id', id)
            .single();
        if (error) return res.status(404).json({ error: error.message });
        res.json(normalizePatient(data));
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients', async (req, res) => {
    try {
        console.log("POST /api/patients Body:", JSON.stringify(req.body, null, 2)); // VERBOSE DEBUG

        // Clone body to avoid mutating req.body directly if needed, though req.body is usually fine
        const data = { ...req.body };

        // --- CRITICAL FIX: Always generate a proper UUID, ignore any client-side ID ---
        const isValidUuid = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
        if (!data.id || !isValidUuid(data.id)) {
            data.id = crypto.randomUUID();
        }

        // --- VALIDATION & TRANSFORMATION ---
        const { firstName, lastName1, dni, birthDate } = data;

        if (!firstName) return res.status(400).json({ error: "Falta rellenar el campo: Nombre" });
        if (!lastName1) return res.status(400).json({ error: "Falta rellenar el campo: Primer Apellido" });
        if (!dni) return res.status(400).json({ error: "Falta rellenar el campo: DNI" });
        if (!birthDate) return res.status(400).json({ error: "Falta rellenar el campo: Fecha de Nacimiento" });

        // Prisma ISO-8601 Fix
        data.birthDate = new Date(birthDate).toISOString();

        // Auto-construir campo 'name' si se proporcionan firstName, lastName1, lastName2
        const lastName2 = data.lastName2 || '';
        data.name = `${firstName} ${lastName1} ${lastName2}`.trim();
        console.log(`🏷️ Scaled and validated name: "${data.name}", ISO Date: ${data.birthDate}`);

        // --- AUTO-GENERATE HISTORY NUMBER ---
        // Ensure array fields (if any) are correctly stored as strings, to prevent Prisma errors
        if (Array.isArray(data.prescriptions)) data.prescriptions = JSON.stringify(data.prescriptions);
        if (Array.isArray(data.medicalHistory)) data.medicalHistory = JSON.stringify(data.medicalHistory);
        if (Array.isArray(data.criticalAlerts)) data.criticalAlerts = JSON.stringify(data.criticalAlerts);

        let created;
        if (!data.historyNumber) {
            created = await prisma.$transaction(async (tx) => {
                const existingPatient = await tx.patient.findFirst({
                    where: { historyNumber: { not: null } },
                    orderBy: { historyNumber: 'desc' },
                    select: { historyNumber: true }
                });

                let nextNumber = 1;
                if (existingPatient && existingPatient.historyNumber) {
                    const match = existingPatient.historyNumber.match(/HC-(\d+)/) || existingPatient.historyNumber.match(/HCL-(\d+)/);
                    if (match) {
                        nextNumber = parseInt(match[1], 10) + 1;
                    }
                }
                data.historyNumber = `HC-${String(nextNumber).padStart(4, '0')}`;
                console.log(`📋 Generated history number: ${data.historyNumber}`);

                return await tx.patient.create({ data });
            });
        } else {
            created = await prisma.patient.create({ data });
        }

        console.log("✅ Patient created:", created.id);
        // Normalize the returned patient
        res.json(normalizePatient(created));
    } catch (e) {
        console.error("Error creating patient:", e);
        // Handle Prisma Unique Constraint error (P2002)
        if (e.code === 'P2002') {
            const target = e.meta?.target || [];
            if (target.includes('dni')) {
                return res.status(400).json({ error: "DNI ya existe." });
            }
            if (target.includes('historyNumber')) {
                return res.status(400).json({ error: "Número de historial ya existe." });
            }
        }
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/patients/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        console.log(`📝 Updating patient ${id}:`, JSON.stringify(updates, null, 2));

        // Remove ID from updates if present to avoid PK change errors
        delete updates.id;
        delete updates.createdAt;

        // If birthDate is updated, ensure it's a valid Date object/ISO string for Prisma/Supabase
        if (updates.birthDate) {
            updates.birthDate = new Date(updates.birthDate).toISOString();
        }

        // Auto-construir campo 'name' si se proporcionan firstName, lastName1, lastName2
        if (updates.firstName || updates.lastName1 || updates.lastName2) {
            const firstName = updates.firstName || '';
            const lastName1 = updates.lastName1 || '';
            const lastName2 = updates.lastName2 || '';
            updates.name = `${firstName} ${lastName1} ${lastName2}`.trim();
            console.log(`🏷️ Auto-generated name: "${updates.name}"`);
        }

        // Convert arrays to JSON strings for Supabase storage
        if (Array.isArray(updates.prescriptions)) {
            updates.prescriptions = JSON.stringify(updates.prescriptions);
        }
        if (Array.isArray(updates.medicalHistory)) {
            updates.medicalHistory = JSON.stringify(updates.medicalHistory);
        }
        if (Array.isArray(updates.criticalAlerts)) {
            updates.criticalAlerts = JSON.stringify(updates.criticalAlerts);
        }

        // Sanitize: only allow known Patient columns to avoid Supabase errors
        const allowedColumns = [
            'name', 'firstName', 'lastName1', 'lastName2', 'dni', 'birthDate',
            'email', 'phone', 'insurance', 'assignedDoctorId', 'balance', 'wallet',
            'allergies', 'smoker', 'diseases', 'medications', 'criticalAlerts',
            'prescriptions', 'medicalHistory', 'historyNumber'
        ];
        const sanitized = {};
        for (const key of allowedColumns) {
            if (updates[key] !== undefined) sanitized[key] = updates[key];
        }

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Patient')
            .update(sanitized)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error("❌ Supabase Update Error:", error);
            return res.status(500).json({ error: error.message });
        }

        console.log("✅ Patient updated:", data.id);
        // Normalize the returned patient
        res.json(normalizePatient(data));
    } catch (e) {
        console.error("Error updating patient:", e);
        // Handle Prisma Unique Constraint error (P2002)
        if (e.code === 'P2002') {
            const target = e.meta?.target || [];
            if (target.includes('dni')) {
                return res.status(400).json({ error: "DNI ya existe." });
            }
        }
        res.status(500).json({ error: e.message });
    }
});

// --- APPOINTMENTS ---
app.post('/api/appointments', async (req, res) => {
    try {
        const { date, time, patientId, doctorId, treatmentId, treatmentName, duration, observations, budgetId, budgetItemId, budgetItemIds, amount } = req.body;

        console.log('📅 Creating appointment:', { date, time, patientId, doctorId, treatmentId, treatmentName, duration, observations, budgetId, budgetItemId, budgetItemIds, amount });

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Sanitization: Ensure empty strings become null for UUID fields to prevent invalid input syntax
        const isValidUUID = (s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
        const safeTreatmentId = (treatmentId && isValidUUID(treatmentId)) ? treatmentId : null;
        const safeDoctorId = (doctorId && doctorId !== 'undefined' && doctorId.trim().length > 0) ? doctorId : null;
        const safeBudgetId = (budgetId && budgetId !== 'undefined' && budgetId.trim().length > 0) ? budgetId : null;
        const safeBudgetItemId = (budgetItemId && budgetItemId !== 'undefined' && budgetItemId.trim().length > 0) ? budgetItemId : null;
        const safeBudgetItemIds = Array.isArray(budgetItemIds) && budgetItemIds.length > 0 ? budgetItemIds.filter(id => id && id !== 'undefined') : null;

        // VALIDATION: Doctor Account Status Check (Ensure doctor exists)
        if (safeDoctorId) {
            try {
                // Query all columns from Doctor table
                const { data: doctor, error: doctorErr } = await supabase
                    .from('Doctor')
                    .select()
                    .eq('id', safeDoctorId)
                    .maybeSingle();

                if (doctorErr) {
                    console.error('❌ Doctor lookup error:', doctorErr.message);
                    return res.status(400).json({ error: 'Error al validar doctor: ' + doctorErr.message });
                }

                if (!doctor) {
                    // Auto-sync: try to find in User table and create Doctor record
                    console.warn('⚠️ Doctor not in Doctor table, attempting auto-sync for ID:', safeDoctorId);
                    const { data: userDoc, error: userErr } = await supabase
                        .from('User')
                        .select('id, name')
                        .eq('id', safeDoctorId)
                        .maybeSingle();

                    if (userDoc) {
                        const { error: insertErr } = await supabase
                            .from('Doctor')
                            .upsert({ id: userDoc.id, name: userDoc.name, specialization: 'Odontólogo' });

                        if (insertErr) {
                            console.error('❌ Auto-sync insert failed:', insertErr.message);
                            return res.status(400).json({ error: `No se pudo sincronizar el doctor (ID: ${safeDoctorId}). Error: ${insertErr.message}` });
                        }
                        console.log(`✅ Auto-synced doctor: ${userDoc.name} (${safeDoctorId})`);
                    } else {
                        // Also try by doctorId field in User table
                        const { data: userByDocId } = await supabase
                            .from('User')
                            .select('id, name, doctorId')
                            .eq('doctorId', safeDoctorId)
                            .maybeSingle();

                        if (userByDocId) {
                            const { error: insertErr } = await supabase
                                .from('Doctor')
                                .upsert({ id: safeDoctorId, name: userByDocId.name, specialization: 'Odontólogo' });

                            if (!insertErr) {
                                console.log(`✅ Auto-synced doctor via doctorId: ${userByDocId.name} (${safeDoctorId})`);
                            }
                        } else {
                            console.error('❌ Doctor not found in any table with ID:', safeDoctorId);
                            return res.status(400).json({ error: `Doctor no encontrado (ID: ${safeDoctorId}). Asegúrate de que el doctor existe en el sistema.` });
                        }
                    }
                } else {
                    // Check if doctor is active (if is_active column exists)
                    if (doctor.is_active === false) {
                        return res.status(400).json({ error: `El Dr. ${doctor.name} está inactivo. No se pueden crear citas con este doctor.` });
                    }
                    console.log(`✓ Doctor validation passed: Dr. ${doctor.name} (${doctor.specialization})`);
                }
            } catch (validationErr) {
                console.error('❌ Doctor validation error:', validationErr.message);
                return res.status(500).json({ error: 'Error al validar doctor: ' + validationErr.message });
            }
        }

        const appointmentId = crypto.randomUUID();
        const { data, error } = await supabase
            .from('Appointment')
            .insert([{
                id: appointmentId,
                date: new Date(date).toISOString(),
                time,
                duration: duration || 60,
                observations: observations || null,
                patientId,
                doctorId: safeDoctorId,
                treatmentId: safeTreatmentId,
                treatmentName: treatmentName || null,
                budgetId: safeBudgetId,
                budgetItemId: safeBudgetItemId || null,
                amount: amount || null,
                status: 'Scheduled',
                paid: false
            }])
            .select()
            .single();

        if (error) {
            console.error("❌ Supabase Insert Error (Appointment):", JSON.stringify(error, null, 2));
            return res.status(500).json({
                error: `DB Error: ${error.message}`,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
        }

        console.log("✅ Appointment Created:", data.id);
        res.json(data);
    } catch (e) {
        console.error("Error Saving Appointment:", e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/appointments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Appointment')
            .select('*, budget:Budget(id, totalAmount, items:BudgetLineItem(name, price, tooth))')
            .is('deleted_at', null);

        if (error) {
            console.error("❌ Supabase Fetch Error (Appointments):", error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Patient appointments - filtered by patientId
app.get('/api/patients/:patientId/appointments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Appointment')
            .select('*')
            .eq('patientId', req.params.patientId)
            .is('deleted_at', null)
            .order('date', { ascending: false });

        if (error) {
            console.error("❌ Supabase Fetch Error (Patient Appointments):", error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/appointments/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        console.log(`📅 Fetching appointment ${req.params.id}`);

        // Simplified query without joins to avoid foreign key issues
        const { data, error } = await supabase
            .from('Appointment')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) {
            console.error("❌ Supabase Fetch Error (Single Appointment):", JSON.stringify(error, null, 2));
            return res.status(404).json({ error: `Appointment not found: ${error.message}` });
        }

        console.log(`✅ Appointment found: ${data.id}`);
        res.json(data);
    } catch (e) {
        console.error("❌ Unexpected error fetching appointment:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        console.log(`📝 Updating Appointment ${id}:`, JSON.stringify(updates));

        // Validación: ID requerido
        if (!id || id.trim() === '') {
            return res.status(400).json({ error: 'ID de cita requerido' });
        }

        // Validación: Campos obligatorios
        if (!updates.patientId || !updates.doctorId) {
            return res.status(400).json({ error: 'Paciente y Doctor son obligatorios' });
        }

        // Sanitization: Convert empty strings to null for UUID fields
        if (typeof updates.budgetId === 'string' && updates.budgetId.trim() === '') updates.budgetId = null;
        if (typeof updates.budgetItemId === 'string' && updates.budgetItemId.trim() === '') updates.budgetItemId = null;
        if (typeof updates.treatmentId === 'string' && updates.treatmentId.trim() === '') updates.treatmentId = null;
        if (typeof updates.doctorId === 'string' && updates.doctorId.trim() === '') updates.doctorId = null;
        if (typeof updates.patientId === 'string' && updates.patientId.trim() === '') {
            return res.status(400).json({ error: 'Paciente es obligatorio' });
        }

        if (updates.date) {
            updates.date = new Date(updates.date).toISOString();
        }

        // Preserve status if provided, default to current value
        if (!updates.status) {
            const current = await prisma.appointment.findUnique({ where: { id } });
            if (current) updates.status = current.status;
        }

        // Remove relation objects from updates to avoid Prisma errors
        delete updates.treatment;
        delete updates.doctor;
        delete updates.patient;
        delete updates.budget;
        delete updates.liquidation;
        delete updates.id;

        const updatedAppointment = await prisma.appointment.update({
            where: { id: id },
            data: updates,
            include: {
                patient: true,
                doctor: true,
                treatment: true,
                budget: true
            }
        });

        console.log("✅ Appointment Updated:", updatedAppointment.id);
        res.json(updatedAppointment);
    } catch (e) {
        console.error("❌ Error updating appointment:", e);
        res.status(500).json({ error: e.message || 'Error desconocido al actualizar cita' });
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Soft-deleting Appointment ${id}`);

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // RGPD Soft Delete: mark as deleted instead of hard-deleting
        const { error } = await supabase
            .from('Appointment')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            // Fallback to Prisma if supabase column not yet migrated
            console.warn('Supabase soft-delete failed, falling back to Prisma hard-delete:', error.message);
            await prisma.appointment.delete({ where: { id } });
        }

        console.log("✅ Appointment Soft-Deleted:", id);
        res.json({ success: true });
    } catch (e) {
        console.error("Error deleting appointment:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- ODONTOGRAM (Module 2) ---
app.get('/api/patients/:patientId/odontogram', async (req, res) => {
    try {
        const o = await prisma.odontogram.findUnique({ where: { patientId: req.params.patientId } });
        res.json(o || { teethState: "{}" });
    } catch (e) {
        // Return empty state instead of 500 for demo robustness
        res.json({ teethState: "{}" });
    }
});

app.post('/api/patients/:patientId/odontogram', async (req, res) => {
    try {
        const { teethState } = req.body;
        // Check if patient exists to avoid FK error (especially for dummy patients p-0, etc)
        const patient = await prisma.patient.findUnique({ where: { id: req.params.patientId } });
        if (!patient) {
            // Mock success for demo users
            return res.json({ patientId: req.params.patientId, teethState });
        }

        const o = await prisma.odontogram.upsert({
            where: { patientId: req.params.patientId },
            update: { teethState },
            create: { patientId: req.params.patientId, teethState }
        });
        res.json(o);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/patients/:patientId/snapshots', async (req, res) => {
    try {
        const { imageUrl, description } = req.body;
        const s = await prisma.dentalSnapshot.create({
            data: {
                patientId: req.params.patientId,
                imageUrl,
                description
            }
        });
        res.json(s);
    } catch (e) {
        // Return empty list for demo/dummy patients instead of 500
        res.json([]);
    }
});

app.get('/api/patients/:patientId/snapshots', async (req, res) => {
    try {
        const list = await prisma.dentalSnapshot.findMany({
            where: { patientId: req.params.patientId },
            orderBy: { date: 'desc' }
        });
        res.json(list);
    } catch (e) {
        res.json([]);
    }
});

app.post('/api/patients/:patientId/snapshots', async (req, res) => {
    try {
        const { imageUrl, description } = req.body;
        const snapshot = await prisma.dentalSnapshot.create({
            data: {
                patientId: req.params.patientId,
                imageUrl,
                description: description || 'Nueva captura'
            }
        });
        res.json(snapshot);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/snapshots/:id', async (req, res) => {
    try {
        const { description } = req.body;
        const snapshot = await prisma.dentalSnapshot.update({
            where: { id: req.params.id },
            data: { description }
        });
        res.json(snapshot);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 2: ORTHODONTICS ---
app.post('/api/plans', async (req, res) => {
    try {
        const plan = await orthoService.createPlan(prisma, req.body);
        res.json(plan);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/patients/:patientId/alerts', async (req, res) => {
    try {
        const alerts = await orthoService.checkDelinquency(prisma, req.params.patientId);
        res.json(alerts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- MODULE 4: AI OMNISCIENT AGENT ---
app.post('/api/ai/query', async (req, res) => {
    try {
        const { message, context } = req.body;
        // Pass user info for role-based filtering (new Supabase-based agent)
        const userInfo = {
            id: req.user.id,
            role: req.user.role,
            doctorId: req.user.doctorId || null, // Linked doctor profile if user is a doctor
            activePatientId: context?.patientId // [NEW] Pass Active Patient ID
        };
        const response = await aiAgent.processQuery(message, userInfo, context);
        res.json(response);
    } catch (error) {
        console.error("AI Query Error:", error);
        res.status(500).json({ error: error.message });
    }
});

// --- MISSING ENDPOINT: PAYMENTS ---
app.get('/api/finance/payments', async (req, res) => {
    try {
        const { patientId } = req.query;
        let supabase = getSupabase();

        let query = supabase.from('Payment').select('*').order('createdAt', { ascending: false });
        if (patientId) query = query.eq('patientId', patientId);

        const { data, error } = await query;
        if (error) {
            console.error("❌ Error fetching payments:", error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 5: INVENTORY INTELLIGENCE ---
app.post('/api/inventory/check', async (req, res) => {
    try {
        const { currentStock } = req.body;
        const analysis = await inventoryService.analyzeStock(prisma, currentStock);
        res.json(analysis);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// --- USER AUTH & SEEDING (MODULE 3) ---

const { createClient } = require('@supabase/supabase-js');

// Lazy Supabase Initializer to prevent startup crashes
// Lazy Supabase Initializer to prevent startup crashes
const getSupabase = () => {
    const URL = process.env.SUPABASE_URL || "https://gnnacijqglcqonholpwt.supabase.co";
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubmFjaWpxZ2xjcW9uaG9scHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3NjU0NCwiZXhwIjoyMDg0MDUyNTQ0fQ.6qexkezsBpOhvTch_eRsr8lF_mixdp9sfv0ScjUmxp4";

    if (!URL || !KEY) {
        throw new Error('SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son requeridos para acceder a Supabase.');
    }

    return createClient(URL, KEY);
};

app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    // FORCE DEPLOY: Restored Login Logic from Backup v1
    try {
        console.log(`🔐 Login Attempt (Supabase Native): ${email}`);

        // Initialize Supabase safely
        let supabase;
        try {
            supabase = getSupabase();
        } catch (configError) {
            return res.status(500).json({ error: configError.message });
        }

        // Use Prisma with case-insensitive email match to handle mixed-case stored emails
        const user = await prisma.user.findFirst({
            where: { email: { equals: email, mode: 'insensitive' } }
        });

        if (!user) {
            return res.status(401).json({ error: 'Usuario no encontrado en base de datos' });
        }

        if (user.password !== password) {
            return res.status(401).json({ error: 'Contraseña incorrecta' });
        }

        console.log(`✅ Login Success: ${user.name} (${user.role})`);
        res.json(user);
    } catch (e) {
        console.error("🔥 Critical Login Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- USER MANAGEMENT API (ADMIN ONLY) ---
const VALID_ROLES = ['ADMIN', 'RECEPTION', 'AUXILIAR', 'DOCTOR'];

// GET all users
app.get('/api/auth/users', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                isDoctor: true,
                doctorId: true,
                createdAt: true
            }
        });
        res.json(users);
    } catch (e) {
        console.error('Error fetching users:', e);
        res.status(500).json({ error: e.message });
    }
});

// POST create user (Atomic with Doctor/Schedule if role is DOCTOR)
app.post('/api/auth/users', async (req, res) => {
    try {
        const { email, name, password, role } = req.body;
        if (!email || !name || !password || !role) {
            return res.status(400).json({ error: 'Email, nombre, contraseña y rol son obligatorios' });
        }

        // Map frontend roles to Prisma enum values
        const AUTH_ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTION': 'RECEPTION', 'RECEPTIONIST': 'RECEPTION', 'AUXILIAR': 'RECEPTION', 'ASSISTANT': 'RECEPTION' };
        const prismaRole = AUTH_ROLE_MAP[role] || role;
        if (!VALID_ROLES.includes(prismaRole)) {
            return res.status(400).json({ error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` });
        }

        // isDoctor is true when the role is DOCTOR, or explicitly set for other roles (ADMIN etc)
        const isDoctorFlag = req.body.isDoctor === true || prismaRole === 'DOCTOR';

        const result = await prisma.$transaction(async (tx) => {
            // Check duplicate email
            const existing = await tx.user.findUnique({ where: { email } });
            if (existing) {
                throw new Error('Ya existe un usuario con ese email');
            }

            // Generate shared UUID
            const sharedId = crypto.randomUUID();

            // 1. Create User record
            const user = await tx.user.create({
                data: {
                    id: sharedId,
                    email,
                    name,
                    password,
                    role: prismaRole,
                    isDoctor: isDoctorFlag
                }
            });

            // 2. If isDoctor (DOCTOR role OR explicitly flagged), create profile and schedule
            if (isDoctorFlag) {
                await tx.doctor.create({
                    data: {
                        id: sharedId,
                        name: name,
                        specialization: 'Odontólogo',
                        commissionPercentage: 0
                    }
                });

                // Self-link the user to the doctor record
                await tx.user.update({
                    where: { id: sharedId },
                    data: { doctorId: sharedId }
                });

                // 3. Create default schedule
                await tx.doctorSchedule.create({
                    data: {
                        doctorId: sharedId,
                        doctorName: name,
                        monday: true,
                        tuesday: true,
                        wednesday: true,
                        thursday: true,
                        friday: true,
                        saturday: false,
                        sunday: false,
                        morningStart: '09:00:00',
                        morningEnd: '13:00:00',
                        afternoonStart: '16:00:00',
                        afternoonEnd: '20:00:00'
                    }
                });
            }

            return tx.user.findUnique({
                where: { id: sharedId },
                select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
            });
        });

        console.log(`✅ User/Doctor created atomically: ${name} (${role}, isDoctor=${isDoctorFlag})`);
        res.status(201).json(result);
    } catch (e) {
        console.error('Error creating user/doctor:', e);
        const isConflict = e.message.includes('existe');
        res.status(isConflict ? 409 : 500).json({ error: e.message });
    }
});

// PUT update user
app.put('/api/auth/users/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { email, name, password, role, doctorId } = req.body;

        // Map frontend roles to Prisma enum values
        const UPDATE_ROLE_MAP = { 'ADMIN': 'ADMIN', 'DOCTOR': 'DOCTOR', 'RECEPTION': 'RECEPTION', 'RECEPTIONIST': 'RECEPTION', 'AUXILIAR': 'RECEPTION', 'ASSISTANT': 'RECEPTION' };
        const prismaRole = role ? (UPDATE_ROLE_MAP[role] || role) : undefined;
        if (prismaRole && !VALID_ROLES.includes(prismaRole)) {
            return res.status(400).json({ error: `Rol inválido. Roles válidos: ${VALID_ROLES.join(', ')}` });
        }

        const isDoctorFlag = req.body.isDoctor !== undefined
            ? req.body.isDoctor === true
            : prismaRole === 'DOCTOR' ? true : undefined;

        const updateData = {
            ...(email !== undefined && { email }),
            ...(name !== undefined && { name }),
            ...(password !== undefined && password !== '' && { password }),
            ...(prismaRole !== undefined && { role: prismaRole }),
            ...(isDoctorFlag !== undefined && { isDoctor: isDoctorFlag }),
            ...(doctorId !== undefined && { doctorId: doctorId || null })
        };

        const updated = await prisma.$transaction(async (tx) => {
            const user = await tx.user.update({
                where: { id },
                data: updateData,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    isDoctor: true,
                    doctorId: true,
                    createdAt: true
                }
            });

            // If now isDoctor and no Doctor profile exists, create one
            if (user.isDoctor) {
                const existingDoctor = await tx.doctor.findUnique({ where: { id: user.doctorId || id } });
                if (!existingDoctor) {
                    await tx.doctor.create({
                        data: { id, name: user.name, specialization: 'Odontólogo', commissionPercentage: 0 }
                    });
                    await tx.user.update({ where: { id }, data: { doctorId: id } });
                    await tx.doctorSchedule.create({
                        data: {
                            doctorId: id, doctorName: user.name,
                            monday: true, tuesday: true, wednesday: true,
                            thursday: true, friday: true, saturday: false, sunday: false,
                            morningStart: '09:00:00', morningEnd: '13:00:00',
                            afternoonStart: '16:00:00', afternoonEnd: '20:00:00'
                        }
                    });
                } else if (name) {
                    // Keep doctor name in sync
                    await tx.doctor.update({ where: { id: existingDoctor.id }, data: { name } });
                }
            }

            return tx.user.findUnique({
                where: { id },
                select: { id: true, email: true, name: true, role: true, isDoctor: true, doctorId: true, createdAt: true }
            });
        });

        console.log(`✅ User updated: ${updated.name} (${updated.role}, isDoctor=${updated.isDoctor})`);
        res.json(updated);
    } catch (e) {
        console.error('Error updating user:', e);
        res.status(500).json({ error: e.message });
    }
});

// DELETE user
app.delete('/api/auth/users/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Use transaction to clean up doctor profile if it was a 1:1 match
        await prisma.$transaction(async (tx) => {
            const user = await tx.user.findUnique({ where: { id } });
            if (user && user.doctorId === user.id) {
                // Delete schedule first (Cascade should handle it naturally if defined in schema, 
                // but let's be safe if it's not)
                await tx.doctorSchedule.deleteMany({ where: { doctorId: id } });
                await tx.doctor.delete({ where: { id } });
            }
            await tx.user.delete({ where: { id } });
        });

        console.log(`🗑️ User deleted: ${id}`);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting user:', e);
        res.status(500).json({ error: e.message });
    }
});

// PATCH display name (user self-service)
app.patch('/api/auth/users/:id/display-name', async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;

        if (!name || typeof name !== 'string' || !name.trim()) {
            return res.status(400).json({ error: 'El nombre no puede estar vacío' });
        }
        const trimmedName = name.trim().slice(0, 100);

        const updated = await prisma.user.update({
            where: { id },
            data: { name: trimmedName },
            select: { id: true, email: true, name: true, role: true, doctorId: true, createdAt: true }
        });

        // Keep doctor name in sync if applicable
        if (updated.doctorId) {
            try {
                await prisma.doctor.update({ where: { id: updated.doctorId }, data: { name: trimmedName } });
            } catch (_) { /* ignore if no doctor record */ }
        }

        console.log(`✅ Display name updated: ${updated.name} (${updated.id})`);
        res.json(updated);
    } catch (e) {
        console.error('Error updating display name:', e);
        res.status(500).json({ error: e.message });
    }
});

// CHANGE PASSWORD (user self-service)
app.post('/api/auth/change-password', async (req, res) => {
    try {
        const { userId, currentPassword, newPassword } = req.body;
        if (!userId || !currentPassword || !newPassword) {
            return res.status(400).json({ error: 'Faltan campos obligatorios' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
        }

        const supabase = getSupabase();

        // Verify current password
        const { data: user, error: fetchErr } = await supabase
            .from('User')
            .select('id, password')
            .eq('id', userId)
            .single();

        if (fetchErr || !user) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        if (user.password !== currentPassword) {
            return res.status(401).json({ error: 'La contraseña actual es incorrecta' });
        }

        // Update password
        const { error: updateErr } = await supabase
            .from('User')
            .update({ password: newPassword })
            .eq('id', userId);

        if (updateErr) throw updateErr;

        console.log(`🔑 Password changed for user: ${userId}`);
        res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (e) {
        console.error('Error changing password:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DEBUG ENDPOINT (Temporary) ---
app.get('/api/debug/db-check', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('User').select('*');
        res.json({
            status: "Online",
            env: {
                url: process.env.SUPABASE_URL ? 'Configured' : 'Missing',
                key: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Configured' : 'Missing'
            },
            queryResult: {
                error,
                count: data?.length,
                usersFound: data?.map(u => u.email)
            }
        });
    } catch (e) {
        res.json({ fatalError: e.message });
    }
});

app.post('/api/seed', async (req, res) => {
    try {
        // 1. Create Doctors
        const doctorsData = [
            { name: 'Dr. House', spec: 'Diagnostico', email: 'dr1@clinic.com' },
            { name: 'Dra. Grey', spec: 'Cirugía', email: 'dr2@clinic.com' },
            { name: 'Dr. Strange', spec: 'Neurología', email: 'dr3@clinic.com' },
            { name: 'Dra. Quinn', spec: 'General', email: 'dr4@clinic.com' }
        ];

        for (const d of doctorsData) {
            // Check if doctor exists
            const existing = await prisma.user.findUnique({ where: { email: d.email } });
            if (!existing) {
                // Create Doctor Profile
                const doc = await prisma.doctor.create({
                    data: { name: d.name, specialization: d.spec, commissionPercentage: 0.30 }
                });
                // Create User
                await prisma.user.create({
                    data: {
                        email: d.email,
                        password: '123', // Dummy password
                        name: d.name,
                        role: 'DOCTOR',
                        doctorId: doc.id
                    }
                });
            }
        }

        // 2. Create Receptionists
        const recepts = ['recepcion1@clinic.com', 'recepcion2@clinic.com'];
        for (const mail of recepts) {
            if (!(await prisma.user.findUnique({ where: { email: mail } }))) {
                await prisma.user.create({
                    data: {
                        email: mail,
                        password: '123',
                        name: 'Recepción ' + mail.split('@')[0].slice(-1),
                        role: 'RECEPTION'
                    }
                });
            }
        }

        // 3. Create Owner/Admin
        if (!(await prisma.user.findUnique({ where: { email: 'admin@clinic.com' } }))) {
            await prisma.user.create({
                data: {
                    email: 'admin@clinic.com',
                    password: '123',
                    name: 'Director Médico',
                    role: 'ADMIN'
                }
            });
        }

        res.json({ message: "Seed completed: Admin, Receptionists, Doctors created." });
    } catch (e) {
        res.json({ error: e.message });
    }
});

// --- MODULE 6: EXTERNAL INVOICING (FACTURADIRECTA / VERI*FACTU) ---
app.get('/api/finance/invoices', async (req, res) => {
    try {
        const supabase = getSupabase();
        // Join with Patient to get names
        const { data: invoices, error } = await supabase
            .from('Invoice')
            .select('*, patient:Patient(name, dni)')
            .order('date', { ascending: false });

        if (error) {
            console.error("❌ Error fetching invoices:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(invoices);
    } catch (e) {
        console.error("GET Invoices Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/finance/invoice', async (req, res) => {
    try {
        const { patient, items, paymentMethod, type } = req.body;

        console.log('💸 ========== QUIPU INVOICE CREATION ==========');

        if (!patient || !items || !items.length) {
            return res.status(400).json({ error: 'Faltan datos del paciente o servicios.' });
        }

        // 1. Get/Create Contact in Quipu
        // Map patient data structure correctly
        const contactData = {
            name: patient.name,
            tax_id: patient.dni || patient.tax_id || 'UNKNOWN',
            email: patient.email,
            address: patient.address,
            city: patient.city,
            zip_code: patient.zipCode || patient.zip_code
        };

        const contact = await quipuService.getOrCreateContact(contactData);
        if (!contact || !contact.id) {
            console.error("❌ Failed to resolve Quipu Contact");
            return res.status(500).json({ error: "Error conectando con Quipu (Contacto)" });
        }

        // 2. Generate sequential filing_number from local DB (Quipu requires it when issue_date is set)
        const today = new Date().toISOString().split('T')[0];
        let filingNumber;
        try {
            const supabaseForNum = getSupabase();
            const year = new Date().getFullYear();
            const { count } = await supabaseForNum
                .from('Invoice')
                .select('*', { count: 'exact', head: true })
                .gte('date', `${year}-01-01T00:00:00.000Z`);
            const seq = String((count || 0) + 1).padStart(4, '0');
            filingNumber = `F-${year}-${seq}`;
        } catch (numErr) {
            // Fallback: use timestamp-based number to guarantee uniqueness
            filingNumber = `F-${new Date().getFullYear()}-${Date.now()}`;
            console.warn('⚠️ Could not get invoice count from DB, using timestamp filing_number:', filingNumber);
        }
        console.log(`📋 [Invoice] Generated filing_number: ${filingNumber}`);

        // 3. Create Invoice in Quipu
        const result = await quipuService.createInvoice(
            contact.id,
            items,
            today,
            today,
            paymentMethod || 'card',
            filingNumber
        );

        // 3. Save to Local DB (Mirror)
        if (result.success) {
            // Get PDF URL immediately
            const pdfUrl = result.pdf_url || await quipuService.getInvoicePdf(result.id);
            const previewUrl = result.preview_url || undefined; // Use what we got from creation

            let savedInvoice = null;
            try {
                const supabase = getSupabase();
                const totalAmount = items.reduce((sum, item) => sum + Number(item.price), 0);

                // Create Invoice Record
                const invoiceId = crypto.randomUUID();
                const { data: dbInvoice, error: invError } = await supabase
                    .from('Invoice')
                    .insert([{
                        id: invoiceId,
                        invoiceNumber: result.number || 'PENDING',
                        externalId: result.id, // Store Quipu ID
                        amount: totalAmount,
                        status: 'issued',
                        date: new Date().toISOString(),
                        url: pdfUrl,
                        patientId: patient.id,
                        paymentMethod: paymentMethod || 'card'
                    }])
                    .select()
                    .single();

                savedInvoice = dbInvoice;

                if (invError) {
                    console.error("❌ DB Error saving Invoice header:", invError);
                } else if (savedInvoice) {
                    console.log(`✅ Invoice saved locally: ${savedInvoice.invoiceNumber}`);

                    // Create Items
                    const invoiceItems = items.map(i => ({
                        id: crypto.randomUUID(),
                        invoiceId: savedInvoice.id,
                        name: i.name,
                        price: Number(i.price)
                    }));
                    await supabase.from('InvoiceItem').insert(invoiceItems);

                    // Create Payment Record
                    const paymentType = (type === 'ADVANCE_PAYMENT' || type === 'PAGO_A_CUENTA') ? 'ADVANCE_PAYMENT' : 'INVOICE';
                    await supabase.from('Payment').insert([{
                        id: crypto.randomUUID(),
                        patientId: patient.id,
                        amount: totalAmount,
                        method: paymentMethod || 'card',
                        type: paymentType,
                        invoiceId: savedInvoice.id,
                        createdAt: new Date().toISOString(),
                        notes: `Factura Quipu: ${savedInvoice.invoiceNumber}`
                    }]);

                    // Update Wallet if Advance Payment
                    if (paymentType === 'ADVANCE_PAYMENT') {
                        // Assuming calculateWalletBalance exists or simpler update
                        // Simple increment for now to ensure robustness
                        const { data: pData } = await supabase.from('Patient').select('wallet').eq('id', patient.id).single();
                        const currentWallet = pData ? (pData.wallet || 0) : 0;
                        await supabase.from('Patient').update({ wallet: currentWallet + totalAmount }).eq('id', patient.id);
                    }
                }
            } catch (dbErr) {
                console.error("❌ Unexpected DB Error during Invoice save:", dbErr);
            }

            // Respond success with PDF
            // pdfUrl: ephemeral/preview URL that opens directly in-browser without auth token
            res.json({
                success: true,
                invoiceNumber: result.number,
                pdfUrl: previewUrl || pdfUrl,
                url: pdfUrl,
                previewUrl: previewUrl,
                invoiceId: savedInvoice?.id || result.id, // Prefer Local UUID, fallback to Quipu
                id: savedInvoice?.id || result.id,         // Use Local UUID for frontend compatibility
                externalId: result.id                      // Send Quipu ID for reference
            });
        } else {
            res.status(500).json({ error: result.error });
        }

    } catch (e) {
        // PASO 1: Bubble up the exact Quipu rejection body so the frontend can display the real reason.
        const quipuError = e.response?.data;  // exact JSON from Quipu (e.g. { errors: [{ detail: "NIF is invalid" }] })
        const statusCode = e.response?.status || 500;
        console.error(
            `❌ [Invoice Endpoint] Quipu rejected with HTTP ${statusCode}:`,
            JSON.stringify(quipuError || e.message, null, 2)
        );
        res.status(statusCode < 400 ? 500 : statusCode).json({
            error:      quipuError || e.message,
            quipu_raw:  quipuError,
            message:    e.message
        });
    }
});

app.get('/api/finance/invoices/:id/download', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📥 Request to download Invoice ID: ${id}`);
        const supabase = getSupabase();

        // 1. Find Invoice to get External ID (Quipu ID)
        // Check if ID is UUID (Local DB ID) or Quipu ID (Numeric usually)
        let invoiceIdToFetch = id;

        const { data: invoice } = await supabase
            .from('Invoice')
            .select('id, externalId, url')
            .eq('id', id)
            .maybeSingle();

        if (invoice) {
            // If we have strict mapping, use externalId
            if (invoice.externalId) invoiceIdToFetch = invoice.externalId;
            else if (invoice.url) {
                // If we have URL but no externalId (legacy), return URL
                return res.json({ url: invoice.url });
            }
        }

        console.log(`📥 Fetching PDF for Invoice ID: ${invoiceIdToFetch}`);

        // 2. Call Quipu Service
        const urls = await quipuService.getInvoiceUrls(invoiceIdToFetch);

        if (urls) {
            // Update DB cache with persistent URL (for backend use)
            if (invoice) {
                supabase.from('Invoice').update({ url: urls.download }).eq('id', invoice.id).then();
            }
            // Send EPHEMERAL/PREVIEW URL to frontend so they can access it without Token
            res.json({
                url: urls.preview, // Use preview/ephemeral as the main URL for frontend
                previewUrl: urls.preview,
                persistentUrl: urls.download
            });
        } else {
            console.warn("⚠️ PDF not found in Quipu, returning stored URL if any.");
            // If stored URL is authenticated, it might fail for user, but better than nothing?
            // Actually, if we have no fresh URL, the stored one (authenticated) effectively is dead for frontend.
            res.json({ url: invoice?.url || '' });
        }
    } catch (e) {
        console.error("Download Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/finance/invoices/export/batch', async (req, res) => {
    try {
        const { invoices, date } = req.body;
        if (!invoices || !date) {
            return res.status(400).send("Faltan datos (invoices, date)");
        }
        await invoiceService.exportBatchInvoices(invoices, date, res);
    } catch (e) {
        console.error("Export Error:", e);
        if (!res.headersSent) res.status(500).send("Error generating ZIP");
    }
});

app.post('/api/finance/pay-with-wallet', async (req, res) => {
    try {
        const { patientId, amount, treatmentIds, doctorId } = req.body;

        console.log(`💰 Paying with wallet: ${amount}€ for Patient ${patientId}`);

        const supabase = getSupabase();

        // 1. Check Balance
        const { data: patient, error: pError } = await supabase.from('Patient').select('wallet').eq('id', patientId).single();
        if (pError || !patient) return res.status(404).json({ error: 'Paciente no encontrado' });

        if (patient.wallet < amount) {
            return res.status(400).json({ error: `Saldo insuficiente (${patient.wallet}€ disponibles)` });
        }

        // 2. Deduct Balance
        const newBalance = patient.wallet - amount;
        await supabase.from('Patient').update({ wallet: newBalance }).eq('id', patientId);

        // 3. Create Payment Record (No Invoice)
        const paymentId = crypto.randomUUID();
        await supabase.from('Payment').insert([{
            id: paymentId,
            patientId,
            amount,
            method: 'wallet',
            type: 'DIRECT_CHARGE', // Or specific type
            notes: `Pago con Saldo a favor. Doctor: ${doctorId || 'N/A'}`,
            createdAt: new Date().toISOString()
        }]);

        // 4. Update Treatments (if any)
        if (treatmentIds && treatmentIds.length > 0) {
            await supabase.from('PatientTreatment').update({ status: 'COMPLETED' }).in('id', treatmentIds);
        }

        // 5. Create Liquidation (Doctor Commission)
        if (doctorId) {
            // Get doctor's commission rate
            const { data: doctor } = await supabase.from('Doctor').select('commissionPercentage').eq('id', doctorId).single();
            const commissionRate = doctor?.commissionPercentage || 0;

            // Get patient name for display
            const { data: patientData } = await supabase.from('Patient').select('name').eq('id', patientId).single();
            const patientName = patientData?.name || 'Paciente';

            // Get treatment details to calculate labCost and get treatment names
            let totalLabCost = 0;
            let treatmentNames = [];
            if (treatmentIds && treatmentIds.length > 0) {
                // Get treatments from PatientTreatment with their service details
                const { data: treatmentData, error: tError } = await supabase
                    .from('PatientTreatment')
                    .select('id, serviceId, price, toothId, serviceName') // Fetch serviceName column
                    .in('id', treatmentIds);

                if (treatmentData && treatmentData.length > 0) {
                    // Get service names and lab costs from Treatment table
                    const serviceIds = treatmentData.map(t => t.serviceId).filter(id => id);
                    let services = [];

                    if (serviceIds.length > 0) {
                        const { data: cols } = await supabase
                            .from('Treatment')
                            .select('id, name, labCost')
                            .in('id', serviceIds);
                        services = cols || [];
                    }

                    // Calculate total lab cost
                    if (services.length > 0) {
                        // We need to map lab cost per treatment usage
                        // If multiple treatments use same service, we add lab cost for each
                        treatmentData.forEach(t => {
                            const svc = services.find(s => s.id === t.serviceId);
                            if (svc) {
                                totalLabCost += (svc.labCost || 0);
                            }
                        });
                    }

                    // Resolve names for EACH treatment
                    treatmentNames = treatmentData.map(t => {
                        const svc = services.find(s => s.id === t.serviceId);
                        return svc ? svc.name : (t.serviceName || `Tratamiento Diente ${t.tooth || 'N/A'}`);
                    });
                }
            }

            // Build treatment name string for display with grouping (e.g., "Treatment x2")
            let treatmentNameStr = 'Pago de tratamiento';

            if (treatmentNames.length > 0) {
                const counts = {};
                treatmentNames.forEach(name => {
                    counts[name] = (counts[name] || 0) + 1;
                });

                treatmentNameStr = Object.entries(counts)
                    .map(([name, count]) => count > 1 ? `${name} x${count}` : name)
                    .join(', ');
            }

            // Create a shadow appointment for the liquidation (required by schema)
            const appointmentId = crypto.randomUUID();
            const { error: appError } = await supabase.from('Appointment').insert([{
                id: appointmentId,
                patientId,
                doctorId,
                date: new Date().toISOString(),
                time: new Date().toLocaleTimeString(),
                status: 'Completed'  // Use proper status format
            }]);

            if (!appError) {
                // Calculate net amount and commission
                const netAmount = amount - totalLabCost;
                const finalAmount = netAmount > 0 ? netAmount * commissionRate : 0;

                console.log(`💰 Liquidation: Gross=${amount}, LabCost=${totalLabCost}, Net=${netAmount}, Rate=${commissionRate}, Final=${finalAmount}`);
                console.log(`📋 Treatment: ${treatmentNameStr}, Patient: ${patientName}`);

                await supabase.from('Liquidation').insert([{
                    id: crypto.randomUUID(),
                    doctorId,
                    appointmentId,
                    grossAmount: amount,
                    labCost: totalLabCost,
                    commissionRate,
                    finalAmount,
                    treatmentName: treatmentNameStr,
                    patientName: patientName,
                    paymentMethod: 'wallet',
                    status: 'PENDING',
                    createdAt: new Date().toISOString()
                }]);
                console.log(`✅ Liquidation created for Doctor ${doctorId}`);
            } else {
                console.error("❌ Error creating shadow appointment:", appError);
            }
        }

        res.json({ success: true, newBalance });

    } catch (e) {
        console.error("Pay with Wallet Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 7: TEMPLATES ---
app.get('/api/templates', async (req, res) => {
    try {
        const templates = await templateService.getTemplates(prisma);
        res.json(templates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/templates', async (req, res) => {
    try {
        const template = await templateService.uploadTemplate(prisma, req.body);
        res.json(template);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/templates/:id', async (req, res) => {
    try {
        await templateService.deleteTemplate(prisma, req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE: VACACIONES ---
app.get('/api/vacations', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('DoctorVacation')
            .select('*')
            .order('start_date', { ascending: false });
        if (error) return res.json([]); // table may not exist yet
        res.json(data || []);
    } catch (e) {
        res.json([]); // graceful fallback
    }
});

app.post('/api/vacations', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('DoctorVacation')
            .insert([req.body])
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        res.status(201).json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/vacations/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('DoctorVacation')
            .update(req.body)
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/vacations/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('DoctorVacation')
            .delete()
            .eq('id', req.params.id);
        if (error) return res.status(500).json({ error: error.message });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 8: BUDGETS ---
app.get('/api/patients/:patientId/budgets', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const data = await budgetService.getBudgetsByPatient(supabase, req.params.patientId);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/patients/:patientId/budgets', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const { items, title } = req.body;
        const data = await budgetService.createBudget(supabase, req.params.patientId, items, title);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/budgets/items/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const data = await budgetService.deleteItem(supabase, req.params.id);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/budgets/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const { items, title } = req.body;
        const data = await budgetService.updateBudget(supabase, req.params.id, items, title);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/patients/:patientId/budgets/draft/items', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const data = await budgetService.addItemToDraftBudget(supabase, req.params.patientId, req.body);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/budgets/:id/status', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const { status } = req.body;
        const data = await budgetService.updateBudgetStatus(supabase, req.params.id, status);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/budgets/:id/convert', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }
        const data = await budgetService.convertBudgetToInvoice(supabase, req.params.id);
        res.json(data);
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- PATIENT TREATMENTS (Tratamientos asignados a pacientes) ---
app.get('/api/patients/:patientId/treatments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Fetch treatments - serviceName and price are stored directly in PatientTreatment
        const { data, error } = await supabase
            .from('PatientTreatment')
            .select('*')
            .eq('patientId', req.params.patientId)
            .order('createdAt', { ascending: false });

        if (error) {
            console.error("❌ Error fetching patient treatments:", error);
            return res.status(500).json({ error: error.message });
        }

        // Map data to ensure correct format for frontend
        const mapped = (data || []).map(t => ({
            id: t.id,
            patientId: t.patientId,
            serviceId: t.serviceId,
            serviceName: t.serviceName || 'Tratamiento',
            toothId: t.toothId,
            price: t.price || t.customPrice || 0,
            customPrice: t.customPrice,
            status: t.status || 'PENDIENTE',
            notes: t.notes,
            createdAt: t.createdAt
        }));

        res.json(mapped);
    } catch (e) {
        console.error("❌ GET treatments error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients/:patientId/treatments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { serviceId, toothId, customPrice, status, notes } = req.body;

        if (!serviceId) {
            return res.status(400).json({ error: 'serviceId is required' });
        }

        const { data, error } = await supabase
            .from('PatientTreatment')
            .insert([{
                id: crypto.randomUUID(),
                patientId: req.params.patientId,
                serviceId,
                toothId: toothId || null,
                customPrice: customPrice || null,
                status: status || 'PENDIENTE',
                notes: notes || null,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error("❌ Error creating patient treatment:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients/:patientId/treatments/batch', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { treatments } = req.body;

        if (!treatments || !Array.isArray(treatments)) {
            return res.status(400).json({ error: 'treatments array is required' });
        }

        console.log('📝 Creating batch treatments:', JSON.stringify(treatments, null, 2));

        // Build insert data
        const toInsert = treatments.map(t => {
            // Validate and sanitize inputs
            // If serviceId is temporary (starts with srv-), send NULL so DB doesn't fail FK constraint
            // Ensure price is a number
            return {
                id: crypto.randomUUID(),
                patientId: req.params.patientId,
                serviceId: (t.serviceId && !t.serviceId.toString().startsWith('srv-')) ? t.serviceId : null,
                serviceName: t.serviceName || 'Tratamiento',
                toothId: t.toothId || null,
                price: Number(t.price) || Number(t.customPrice) || 0,
                customPrice: Number(t.customPrice) || Number(t.price) || null,
                status: t.status || 'PENDIENTE',
                notes: t.notes || null,
                createdAt: new Date().toISOString()
            };
        });

        const { data, error } = await supabase
            .from('PatientTreatment')
            .insert(toInsert)
            .select();

        if (error) {
            console.error("❌ Error creating batch treatments:", JSON.stringify(error, null, 2));
            return res.status(500).json({ error: `DB Error: ${error.message} - ${error.details || ''}` });
        }

        // Add to Clinical Audit/History
        try {
            const summary = data.map(t => t.serviceName + (t.toothId ? ` (Diente ${t.toothId})` : '')).join(', ');
            await supabase.from('ClinicalRecord').insert([{
                id: crypto.randomUUID(),
                patientId: req.params.patientId,
                date: new Date().toISOString(),
                treatment: 'Planificación de Tratamientos',
                observation: `Se han añadido ${data.length} tratamientos: ${summary}`,
                specialization: 'Odontología',
                price: data.reduce((sum, t) => sum + (t.price || 0), 0),
                authorId: 'system' // Or user ID if available
            }]);
        } catch (auditError) {
            console.error("⚠️ Error saving clinical history:", auditError);
            // Don't fail the request
        }

        console.log(`✅ Created ${data.length} treatments`);
        res.json(data);
    } catch (e) {
        console.error("❌ Batch treatments error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- DEBUG ENDPOINT ---
app.get('/api/debug-latest-data', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const ids = ["dc2d03e8-209d-4309-b772-68f009082b28", "659d9108-28d4-4c60-8389-7aa2c300c0f1"];

        const { data: treatments, error } = await supabase
            .from('PatientTreatment')
            .select('*')
            .in('id', ids);

        if (error) throw error;

        res.json({ treatments });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/treatments/:id', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { error } = await supabase
            .from('PatientTreatment')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- PAYMENTS (Sistema de cobros y monedero virtual) ---
// --- HELPER: Wallet Calculation (Ledger System) ---
const calculateWalletBalance = async (supabase, patientId) => {
    try {
        const { data: payments, error } = await supabase
            .from('Payment')
            .select('amount, type, method')
            .eq('patientId', patientId);

        if (error) throw error;

        let balance = 0;
        payments.forEach(p => {
            // Add if it's an advance payment (deposit)
            if (p.type === 'ADVANCE_PAYMENT') {
                balance += (p.amount || 0);
            }
            // Subtract TRANSFERS (advance money assigned to treatments)
            if (p.type === 'TRANSFER') {
                balance -= (p.amount || 0);
            }
            // Subtract if paid WITH wallet (method can be 'wallet' or 'ADVANCE_PAYMENT' due to legacy frontend mapping)
            if ((p.method === 'wallet' || p.method === 'ADVANCE_PAYMENT') && p.type !== 'ADVANCE_PAYMENT' && p.type !== 'TRANSFER') {
                balance -= (p.amount || 0);
            }
            // Subtract if direct charge from wallet (e.g. manual adjustment)
            if (p.type === 'DIRECT_CHARGE' && p.method === 'wallet') {
                balance -= (p.amount || 0);
            }
        });

        // Update Patient Record
        await supabase.from('Patient').update({ wallet: balance }).eq('id', patientId);
        console.log(`💰 [WALLET] Updated balance for ${patientId}: ${balance.toFixed(2)}€`);
        return balance;
    } catch (e) {
        console.error("❌ Error calculating wallet:", e);
        return 0;
    }
};

app.get('/api/patients/:id/payments', async (req, res) => {
    try {
        const { id } = req.params;
        const supabase = getSupabase();

        const { data, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', id)
            .order('createdAt', { ascending: false });

        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/payments/create', async (req, res) => {
    try {
        const { patientId, budgetId, appointmentId, amount, method, type, notes, doctorId, isPartial, originalAmount } = req.body;

        if (!patientId || !amount || !method || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const numericAmount = parseFloat(amount);

        // Fetch patient for Quipu contact creation
        const patient = await prisma.patient.findUnique({ where: { id: patientId } });
        if (!patient) {
            return res.status(404).json({ error: 'Patient not found' });
        }

        // Fetch doctor info if needed for payroll
        let doctor = null;
        let appointment = null;

        if (appointmentId) {
            appointment = await prisma.appointment.findUnique({
                where: { id: appointmentId },
                include: { doctor: true, treatment: true, budget: { include: { items: true } } }
            });
            doctor = appointment?.doctor;
        } else if (doctorId) {
            doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        }

        // --- IDEMPOTENCY CHECK ---
        // Skip for partial payments — multiple payments are allowed for the same appointment
        if (appointmentId && !isPartial) {
            const existingInvoice = await prisma.invoice.findUnique({
                where: { appointmentId },
                include: { relatedPayment: true }
            });

            if (existingInvoice) {
                console.log(`ℹ️ [Idempotency] Appointment ${appointmentId} already paid. Returning existing invoice.`);
                return res.json({
                    success: true,
                    payment: existingInvoice.relatedPayment,
                    invoice: existingInvoice,
                    pdfUrl: existingInvoice.url
                });
            }
        }

        // --- DYNAMIC CONCEPT DERIVATION ---
        let solvedTreatmentName = '';
        if (appointment) {
            solvedTreatmentName = appointment.treatmentName;
            if (!solvedTreatmentName && appointment.treatment?.name) {
                solvedTreatmentName = appointment.treatment.name;
            }
            if (!solvedTreatmentName && appointment.budget?.items?.length > 0) {
                solvedTreatmentName = appointment.budget.items.map(i => i.name).join(', ');
            }
        }
        if (!solvedTreatmentName) {
            solvedTreatmentName = type === 'ADVANCE_PAYMENT' ? 'Pago a Cuenta' : 'Tratamiento General';
        }

        // --- QUIPU INTEGRATION ---
        console.log('💸 [Quipu] Starting invoice generation for payment...');
        let quipuResult = { success: false };
        try {
            const contactData = {
                name: patient.name,
                tax_id: patient.dni || 'UNKNOWN',
                email: patient.email,
                address: patient.address,
                city: patient.city,
                zip_code: patient.zipCode || patient.zip_code
            };
            const contact = await quipuService.getOrCreateContact(contactData);

            if (contact && contact.id) {
                const today = new Date().toISOString().split('T')[0];
                quipuResult = await quipuService.createInvoice(
                    contact.id,
                    [{ name: solvedTreatmentName, quantity: 1, price: numericAmount }],
                    today,
                    today,
                    method === 'card' ? 'credit_card' : method
                );
            }
        } catch (qErr) {
            console.error('⚠️ Quipu Error (Continuing with local only):', qErr.response?.data || qErr.message);
            // Log full error details for debugging if available
            if (qErr.response?.data?.errors) {
                console.error('Quipu Validation Errors:', JSON.stringify(qErr.response.data.errors, null, 2));
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Create Payment record
            const payment = await tx.payment.create({
                data: {
                    id: crypto.randomUUID(),
                    patientId,
                    budgetId: budgetId || null,
                    amount: numericAmount,
                    method,
                    type,
                    notes: notes || null,
                    doctorId: doctor?.id || null,
                    createdAt: new Date().toISOString()
                }
            });

            // 2. Mark Appointment as Paid (or Partially Paid)
            if (appointmentId) {
                const isPartialPayment = isPartial === true;
                await tx.appointment.update({
                    where: { id: appointmentId },
                    data: isPartialPayment
                        ? { paid: false, status: 'EN_PROCESO' }
                        : { paid: true, status: 'Completed' }
                });
            }

            // 3. Generate Invoice
            let invoiceNumber = quipuResult.success ? quipuResult.number : null;

            if (!invoiceNumber || invoiceNumber === 'PENDING') {
                // Generate a robust local format: F-YEAR-TIMESTAMP-RANDOM
                const year = new Date().getFullYear();
                const ts = Date.now();
                const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
                invoiceNumber = `F-${year}-${ts}-${random}`;
            }

            // DOUBLE CHECK: Ensure this number doesn't exist locally (rare with the random suffix but good for safety)
            const collision = await tx.invoice.findUnique({ where: { invoiceNumber } });
            if (collision) {
                invoiceNumber += `-${Math.random().toString(36).substring(2, 5)}`;
            }

            const invoice = await tx.invoice.create({
                data: {
                    id: crypto.randomUUID(),
                    invoiceNumber,
                    externalId: quipuResult.success ? String(quipuResult.id) : null,
                    url: quipuResult.success ? quipuResult.pdf_url : null,
                    patientId,
                    amount: numericAmount,
                    date: new Date(),
                    status: 'issued',
                    paymentMethod: method,
                    concept: isPartial ? `${solvedTreatmentName} (Pago Parcial)` : solvedTreatmentName,
                    // For partial payments, don't link to appointmentId to allow multiple invoices per appointment
                    appointmentId: (appointmentId && !isPartial) ? appointmentId : null,
                    relatedPaymentId: payment.id
                }
            });

            // Create Invoice Item
            await tx.invoiceItem.create({
                data: {
                    id: crypto.randomUUID(),
                    invoiceId: invoice.id,
                    name: solvedTreatmentName,
                    price: numericAmount
                }
            });

            // Link invoice back to payment
            await tx.payment.update({
                where: { id: payment.id },
                data: { invoiceId: invoice.id }
            });

            // 4. Create Liquidation (Support both appointment-linked and direct doctor-assigned payments)
            let liquidation = null;
            if (doctor && type === 'DIRECT_CHARGE') {
                const rawRate = doctor.commissionPercentage || 30;
                const commissionRateDecimal = rawRate / 100;
                const labCost = req.body.costeLab || 0;
                const finalAmount = (numericAmount - labCost) * commissionRateDecimal;

                liquidation = await tx.liquidation.create({
                    data: {
                        id: crypto.randomUUID(),
                        doctorId: doctor.id,
                        appointmentId: appointmentId || null, // Optional now
                        grossAmount: numericAmount,
                        labCost,
                        commissionRate: rawRate,
                        finalAmount,
                        treatmentName: solvedTreatmentName,
                        patientName: patient?.name || 'Paciente',
                        paymentMethod: method,
                        status: 'PENDING',
                        createdAt: new Date().toISOString()
                    }
                });
            }

            // 5. Update Patient Wallet/Balance
            if (type === 'ADVANCE_PAYMENT' || (type === 'DIRECT_CHARGE' && method === 'wallet')) {
                const balanceAdjustment = method === 'wallet' ? -numericAmount : numericAmount;
                await tx.patient.update({
                    where: { id: patientId },
                    data: { wallet: { increment: balanceAdjustment } }
                });
            }

            return {
                payment,
                invoice,
                payroll: liquidation,
                pdfUrl: quipuResult.success ? quipuResult.pdf_url : null,
                previewUrl: quipuResult.success ? quipuResult.preview_url : null,
                isPartial: isPartial === true,
                remainingBalance: (isPartial && originalAmount) ? parseFloat(originalAmount) - numericAmount : 0
            };
        });

        res.status(200).json({ success: true, ...result });
    } catch (e) {
        console.error("❌ Payment creation error:", e);
        res.status(500).json({ error: e.message || 'Unknown transaction error' });
    }
});

app.get('/api/finance/invoices/appointment/:appointmentId', async (req, res) => {
    try {
        const { appointmentId } = req.params;
        const invoice = await prisma.invoice.findFirst({
            where: { appointmentId },
            orderBy: { date: 'desc' }
        });

        if (!invoice) {
            return res.status(404).json({ error: 'Invoice not found for this appointment' });
        }

        res.json(invoice);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * TRANSFER ADVANCE PAYMENT TO TREATMENT
 * This endpoint transfers money from "a cuenta" (advance) to a specific treatment/concept
 * WITHOUT generating a new invoice (to avoid duplicate invoices and Hacienda issues).
 * 
 * It updates the original payment's concept and links it to a doctor for commission tracking.
 */
app.post('/api/payments/transfer', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, sourcePaymentId, amount, treatmentId, treatmentName, doctorId, notes } = req.body;

        if (!patientId || !sourcePaymentId || !amount || !doctorId) {
            return res.status(400).json({ error: 'Campos requeridos: patientId, sourcePaymentId, amount, doctorId' });
        }

        // 1. Verificar que el pago original existe y tiene saldo disponible
        const { data: sourcePayment, error: sourceError } = await supabase
            .from('Payment')
            .select('*')
            .eq('id', sourcePaymentId)
            .single();

        if (sourceError || !sourcePayment) {
            return res.status(404).json({ error: 'Pago origen no encontrado' });
        }

        if (sourcePayment.type !== 'ADVANCE_PAYMENT') {
            return res.status(400).json({ error: 'Solo se pueden transferir pagos a cuenta (ADVANCE_PAYMENT)' });
        }

        // 2. Crear registro de transferencia (NO genera nueva factura)
        const transferId = crypto.randomUUID();
        const { data: transfer, error: transferError } = await supabase
            .from('Payment')
            .insert([{
                id: transferId,
                patientId,
                amount: parseFloat(amount),
                method: 'wallet', // Indica uso de saldo
                type: 'TRANSFER', // Nuevo tipo: transferencia de saldo
                sourcePaymentId, // Referencia al pago original
                treatmentId: treatmentId || null,
                doctorId, // Para calcular comisión
                notes: notes || `Transferencia de anticipo a: ${treatmentName || 'Tratamiento'}`,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (transferError) {
            console.error("❌ Error creating transfer:", transferError);
            return res.status(500).json({ error: transferError.message });
        }

        // 3. Recalcular saldo del monedero
        await calculateWalletBalance(supabase, patientId);

        // 4. Si hay tratamiento, marcar como pagado y actualizar/crear Liquidación
        if (treatmentId) {
            // A. Marcar tratamiento como PAGADO en Supabase
            const { data: treatmentData } = await supabase
                .from('PatientTreatment')
                .update({ status: 'PAGADO' })
                .eq('id', treatmentId)
                .select()
                .single();

            // B. Sincronizar con Nóminas (Liquidación) usando Prisma
            if (treatmentData && treatmentData.serviceId) {
                try {
                    // 1. Buscar si ya existe una liquidación pendiente asociada a este paciente y tratamiento (vía Cita)
                    // Buscamos liquidaciones pendientes donde la cita sea del mismo paciente y tenga el mismo treatmentId
                    const existingLiquidation = await prisma.liquidation.findFirst({
                        where: {
                            appointment: {
                                patientId: patientId,
                                treatmentId: treatmentData.serviceId
                            },
                            status: 'PENDING'
                        },
                        orderBy: { createdAt: 'desc' }
                    });

                    if (existingLiquidation) {
                        // Caso 1: Existe cita previa. Actualizamos el doctor de la liquidación para que coincida con la transferencia
                        console.log(`🔄 Updating Liquidation ${existingLiquidation.id} doctor to ${doctorId}`);
                        await prisma.liquidation.update({
                            where: { id: existingLiquidation.id },
                            data: { doctorId: doctorId }
                        });
                    } else {
                        // Caso 2: No existe cita (ej. tratamiento manual). Creamos Cita "Dummy" y Liquidación para que salga en nómina
                        console.log(`➕ Creating Dummy Appointment & Liquidation for Transfer. Doctor: ${doctorId}`);

                        // Crear cita técnica completada
                        const dummyAppt = await prisma.appointment.create({
                            data: {
                                date: new Date(),
                                time: "00:00",
                                status: "COMPLETED",
                                patientId: patientId,
                                doctorId: doctorId,
                                treatmentId: treatmentData.serviceId
                            },
                            include: { treatment: true, doctor: true }
                        });

                        // Generar liquidación
                        await financeService.calculateLiquidation(prisma, dummyAppt);
                    }
                } catch (liqError) {
                    console.error("⚠️ Error syncing liquidation on transfer:", liqError);
                    // No fallamos el request principal, solo logueamos
                }
            }
        }

        // 5. Añadir al historial clínico
        const historyPayload = {
            treatment: 'Asignación de Saldo',
            observation: `Saldo de ${amount}€ asignado a: ${treatmentName || 'Tratamiento'}. Doctor: ${doctorId.substring(0, 8)}...`,
            specialization: 'Administración'
        };

        await supabase.from('ClinicalRecord').insert([{
            id: crypto.randomUUID(),
            patientId,
            date: new Date().toISOString(),
            text: JSON.stringify(historyPayload),
            authorId: 'system'
        }]);

        console.log(`✅ [TRANSFER] ${amount}€ transferred from advance to treatment. Doctor: ${doctorId}`);

        res.json({
            success: true,
            transfer,
            message: 'Saldo transferido correctamente. No se ha generado nueva factura.'
        });
    } catch (e) {
        console.error("❌ Transfer error:", e);
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET DOCTOR COMMISSIONS
 * Calculates commissions based on payments assigned to doctors (both direct and transfers)
 */
app.get('/api/doctors/:doctorId/commissions', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { doctorId } = req.params;
        const { month, year } = req.query;

        // Default to current month
        const targetMonth = month ? parseInt(month) : new Date().getMonth() + 1;
        const targetYear = year ? parseInt(year) : new Date().getFullYear();

        const startDate = new Date(targetYear, targetMonth - 1, 1).toISOString();
        const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59).toISOString();

        // Get all payments assigned to this doctor in the month
        const { data: payments, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('doctorId', doctorId)
            .gte('createdAt', startDate)
            .lte('createdAt', endDate);

        if (error) throw error;

        // Calculate total and breakdown
        const directPayments = payments.filter(p => p.type === 'DIRECT_CHARGE');
        const transfers = payments.filter(p => p.type === 'TRANSFER');

        const totalDirect = directPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalTransfers = transfers.reduce((sum, p) => sum + (p.amount || 0), 0);
        const grandTotal = totalDirect + totalTransfers;

        // Default commission rate (can be configured per doctor)
        const commissionRate = 0.30; // 30%
        const commissionAmount = grandTotal * commissionRate;

        res.json({
            doctorId,
            period: { month: targetMonth, year: targetYear },
            breakdown: {
                directPayments: { count: directPayments.length, total: totalDirect },
                transfers: { count: transfers.length, total: totalTransfers }
            },
            grandTotal,
            commissionRate: `${commissionRate * 100}%`,
            commissionAmount: parseFloat(commissionAmount.toFixed(2)),
            payments: payments.slice(0, 50) // Limit to 50 for response size
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET UNASSIGNED ADVANCE PAYMENTS (Saldo a Cuenta disponible)
 * Returns advance payments that haven't been fully transferred to treatments
 */
app.get('/api/patients/:patientId/advance-balance', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;

        // Get all advance payments
        const { data: advances, error: advError } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', patientId)
            .eq('type', 'ADVANCE_PAYMENT')
            .order('createdAt', { ascending: false });

        if (advError) throw advError;

        // Get all transfers (usage of advance money)
        const { data: transfers, error: transError } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', patientId)
            .eq('type', 'TRANSFER');

        if (transError) throw transError;

        // Calculate totals
        const totalAdvanced = advances.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalTransferred = transfers.reduce((sum, p) => sum + (p.amount || 0), 0);
        const availableBalance = totalAdvanced - totalTransferred;

        res.json({
            patientId,
            totalAdvanced,
            totalTransferred,
            availableBalance,
            advances: advances.map(a => ({
                id: a.id,
                amount: a.amount,
                date: a.createdAt,
                invoiceId: a.invoiceId,
                notes: a.notes
            })),
            transfers: transfers.map(t => ({
                id: t.id,
                amount: t.amount,
                date: t.createdAt,
                treatmentId: t.treatmentId,
                doctorId: t.doctorId,
                notes: t.notes
            }))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

/**
 * GET SIMPLIFIED BALANCE
 * Returns just the available balance (saldo a favor)
 */
app.get('/api/patients/:patientId/balance', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId } = req.params;

        // Get all advance payments
        const { data: advances, error: advError } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', patientId)
            .eq('type', 'ADVANCE_PAYMENT')
            .order('createdAt', { ascending: false });

        if (advError) throw advError;

        // Get all transfers (usage of advance money)
        const { data: transfers, error: transError } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', patientId)
            .eq('type', 'TRANSFER');

        if (transError) throw transError;

        // Calculate totals
        const totalAdvanced = advances.reduce((sum, p) => sum + (p.amount || 0), 0);
        const totalTransferred = transfers.reduce((sum, p) => sum + (p.amount || 0), 0);
        const availableBalance = totalAdvanced - totalTransferred;

        res.json({
            balance: parseFloat(availableBalance.toFixed(2))
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/patients/:patientId/payments', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Payment')
            .select('*')
            .eq('patientId', req.params.patientId)
            .order('createdAt', { ascending: false });

        if (error) {
            console.error("❌ Error fetching payments:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- INVOICES (Get all with enriched data) ---
app.get('/api/invoices', async (req, res) => {
    try {
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { data, error } = await supabase
            .from('Invoice')
            .select('*, items:InvoiceItem(*)')
            .order('date', { ascending: false });

        if (error) {
            console.error("❌ Error fetching invoices:", error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 7: WHATSAPP INTEGRATION ---
app.get('/api/whatsapp/status', async (req, res) => {
    res.json(await whatsappService.getStatus());
});

app.get('/api/whatsapp/qr', async (req, res) => {
    try {
        const qr = await whatsappService.getQrCode();
        res.json({ qrCode: qr });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/whatsapp/send-test', async (req, res) => {
    try {
        const { phone, message } = req.body;
        const response = await whatsappService.sendMessage(phone, message || 'Test message from CRM Medico');
        res.json(response);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/whatsapp/logout', async (req, res) => {
    const result = await whatsappService.logout();
    res.json(result);
});

app.post('/api/whatsapp/schedule', async (req, res) => {
    try {
        const { patientId, templateId, scheduledDate, content } = req.body;

        const log = await prisma.whatsAppLog.create({
            data: {
                patientId,
                type: 'TREATMENT_FOLLOWUP', // Generic type for scheduled msgs
                status: 'PENDING',
                content,
                scheduledFor: new Date(scheduledDate),
                sentAt: new Date(scheduledDate)
            }
        });
        res.json(log);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/whatsapp/templates', async (req, res) => {
    try {
        const templates = await prisma.whatsAppTemplate.findMany();
        res.json(templates);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/whatsapp/templates', async (req, res) => {
    try {
        const { name, content, triggerType, triggerOffset } = req.body;
        const t = await prisma.whatsAppTemplate.create({
            data: { name, content, triggerType, triggerOffset }
        });
        res.json(t);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/whatsapp/templates/:id', async (req, res) => {
    try {
        await prisma.whatsAppTemplate.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/whatsapp/logs', async (req, res) => {
    try {
        const { patientId } = req.query;
        const where = patientId ? { patientId } : {};

        const logs = await prisma.whatsAppLog.findMany({
            where,
            orderBy: { sentAt: 'desc' },
            take: 100,
            include: { patient: true }
        });
        res.json(logs);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// --- CRON ENGINE: AUTOMATIC REMINDERS ---
// ─────────────────────────────────────────────────────────────────────────────
// MASTER CRON — called daily by cron-job.org via POST /api/cron/whatsapp-reminders
// Runs sequentially: 1) Appointment reminders  2) Birthdays  3) Follow-ups
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cron/whatsapp-reminders', async (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;

    console.log('[MASTER CRON] CRON_SECRET en entorno:', !!expectedSecret);

    if (!expectedSecret) {
        console.error('[MASTER CRON] CRON_SECRET no definido.');
        return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    const providedToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    if (!providedToken || providedToken !== expectedSecret.trim()) {
        console.warn(`[MASTER CRON] Intento no autorizado. Token: ${providedToken ? '***' : 'NULO'}`);
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const globalStats = {
        reminders: { sent: 0, failed: 0, skipped: 0 },
        birthdays:  { sent: 0, failed: 0, skipped: 0 },
        followups:  { sent: 0, failed: 0, skipped: 0 }
    };

    // ── BLOQUE 1: Recordatorios de citas (mañana) ────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 1 — Recordatorios de citas...');

        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const startOfTomorrow = new Date(new Date(tomorrow).setHours(0, 0, 0, 0));
        const endOfTomorrow   = new Date(new Date(tomorrow).setHours(23, 59, 59, 999));

        const appointments = await prisma.appointment.findMany({
            where: {
                status: { in: ['Scheduled', 'Confirmed'] },
                date: { gte: startOfTomorrow, lte: endOfTomorrow },
                whatsappSent: false
            },
            include: { patient: true, treatment: true }
        });

        console.log(`[MASTER CRON] Citas encontradas: ${appointments.length}`);

        const reminderTemplate = await prisma.whatsAppTemplate.findFirst({
            where: { triggerType: 'APPOINTMENT_REMINDER' }
        });

        if (!reminderTemplate && appointments.length > 0) {
            console.warn('[MASTER CRON] Sin plantilla APPOINTMENT_REMINDER. Saltando bloque 1.');
        } else {
            for (const appt of appointments) {
                if (!appt.patient?.phone) { globalStats.reminders.skipped++; continue; }

                const appointmentDate = new Date(appt.date);
                const formattedDate = appointmentDate.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const formattedTime = appt.time ? appt.time.substring(0, 5)
                    : appointmentDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false });
                const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta General';

                const message = reminderTemplate.content
                    .replace(/{{nombre}}/g, appt.patient.name)
                    .replace(/{{fecha}}/g, formattedDate)
                    .replace(/{{hora}}/g, formattedTime)
                    .replace(/{{tratamiento}}/g, treatmentName);

                try {
                    let number = appt.patient.phone.replace(/[^0-9]/g, '');
                    if (number.length === 9) number = '34' + number;

                    await whatsappService.sendMessage(number, message);
                    await prisma.appointment.update({ where: { id: appt.id }, data: { whatsappSent: true } });
                    await prisma.whatsAppLog.create({
                        data: { patientId: appt.patientId, type: 'APPOINTMENT_REMINDER', status: 'SENT', content: message, sentAt: new Date() }
                    });
                    globalStats.reminders.sent++;
                } catch (err) {
                    console.error(`[MASTER CRON] Recordatorio fallido (appt ${appt.id}):`, err.message);
                    globalStats.reminders.failed++;
                    await prisma.whatsAppLog.create({
                        data: { patientId: appt.patientId, type: 'APPOINTMENT_REMINDER', status: 'FAILED', content: message, error: err.message, sentAt: new Date() }
                    });
                }
            }
        }

        console.log('[MASTER CRON] ✅ Bloque 1 completado:', globalStats.reminders);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 1 (Recordatorios):', e.message);
        // No return — continúa con los siguientes bloques
    }

    // ── BLOQUE 2: Cumpleaños ─────────────────────────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 2 — Cumpleaños...');

        const today = new Date();
        const todayMonth = today.getMonth() + 1;
        const todayDay   = today.getDate();
        const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

        const allPatients = await prisma.patient.findMany({
            where: { phone: { not: null } },
            select: { id: true, name: true, phone: true, birthDate: true }
        });

        const birthdayPatients = allPatients.filter(p => {
            if (!p.birthDate) return false;
            const bd = new Date(p.birthDate);
            return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay;
        });

        console.log(`[MASTER CRON] Pacientes con cumpleaños hoy: ${birthdayPatients.length}`);

        const birthdayTemplate = await prisma.whatsAppTemplate.findFirst({
            where: { triggerType: 'BIRTHDAY' }
        });
        const birthdayDefault = '¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo de la clínica te deseamos un día estupendo. ¡Muchas felicidades!';

        for (const patient of birthdayPatients) {
            if (!patient.phone) { globalStats.birthdays.skipped++; continue; }

            const alreadySent = await prisma.whatsAppLog.findFirst({
                where: { patientId: patient.id, type: 'BIRTHDAY', sentAt: { gte: startOfToday } }
            });
            if (alreadySent) { globalStats.birthdays.skipped++; continue; }

            const content = (birthdayTemplate?.content || birthdayDefault)
                .replace(/{{nombre}}/g, patient.name)
                .replace(/{{PACIENTE}}/g, patient.name);

            try {
                let number = patient.phone.replace(/[^0-9]/g, '');
                if (number.length === 9) number = '34' + number;

                await whatsappService.sendMessage(number, content);
                await prisma.whatsAppLog.create({
                    data: { patientId: patient.id, type: 'BIRTHDAY', status: 'SENT', content, sentAt: new Date() }
                });
                globalStats.birthdays.sent++;
                console.log(`[MASTER CRON] 🎂 Cumpleaños enviado a ${patient.name}`);
            } catch (err) {
                console.error(`[MASTER CRON] Error cumpleaños (${patient.name}):`, err.message);
                await prisma.whatsAppLog.create({
                    data: { patientId: patient.id, type: 'BIRTHDAY', status: 'FAILED', content, error: err.message, sentAt: new Date() }
                });
                globalStats.birthdays.failed++;
            }
        }

        console.log('[MASTER CRON] ✅ Bloque 2 completado:', globalStats.birthdays);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 2 (Cumpleaños):', e.message);
        // No return — continúa con el siguiente bloque
    }

    // ── BLOQUE 3: Seguimientos post-operatorios ──────────────────────────────
    try {
        console.log('[MASTER CRON] ▶️ Bloque 3 — Seguimientos post-operatorios...');

        const followupTemplates = await prisma.whatsAppTemplate.findMany({
            where: { triggerType: 'TREATMENT_FOLLOWUP' }
        });

        if (followupTemplates.length === 0) {
            console.warn('[MASTER CRON] Sin plantillas TREATMENT_FOLLOWUP configuradas.');
        } else {
            for (const template of followupTemplates) {
                const offsetDays = parseInt(template.triggerOffset, 10);
                if (isNaN(offsetDays) || offsetDays <= 0) continue;

                const target = new Date();
                target.setDate(target.getDate() - offsetDays);
                const startOfTarget = new Date(new Date(target).setHours(0, 0, 0, 0));
                const endOfTarget   = new Date(new Date(target).setHours(23, 59, 59, 999));

                const appts = await prisma.appointment.findMany({
                    where: {
                        status: { in: ['Completed', 'Attended'] },
                        date: { gte: startOfTarget, lte: endOfTarget }
                    },
                    include: { patient: true, treatment: true }
                });

                console.log(`[MASTER CRON] Template "${template.name}" (offset ${offsetDays}d): ${appts.length} cita(s)`);

                for (const appt of appts) {
                    if (!appt.patient?.phone) { globalStats.followups.skipped++; continue; }

                    const alreadySent = await prisma.whatsAppLog.findFirst({
                        where: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', sentAt: { gte: startOfTarget } }
                    });
                    if (alreadySent) { globalStats.followups.skipped++; continue; }

                    const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta';
                    const content = template.content
                        .replace(/{{nombre}}/g, appt.patient.name)
                        .replace(/{{PACIENTE}}/g, appt.patient.name)
                        .replace(/{{tratamiento}}/g, treatmentName)
                        .replace(/{{TRATAMIENTO}}/g, treatmentName);

                    try {
                        let number = appt.patient.phone.replace(/[^0-9]/g, '');
                        if (number.length === 9) number = '34' + number;

                        await whatsappService.sendMessage(number, content);
                        await prisma.whatsAppLog.create({
                            data: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', status: 'SENT', content, sentAt: new Date() }
                        });
                        globalStats.followups.sent++;
                        console.log(`[MASTER CRON] 📋 Seguimiento enviado a ${appt.patient.name}`);
                    } catch (err) {
                        console.error(`[MASTER CRON] Error seguimiento (${appt.patient.name}):`, err.message);
                        await prisma.whatsAppLog.create({
                            data: { patientId: appt.patient.id, type: 'TREATMENT_FOLLOWUP', status: 'FAILED', content, error: err.message, sentAt: new Date() }
                        });
                        globalStats.followups.failed++;
                    }
                }
            }
        }

        console.log('[MASTER CRON] ✅ Bloque 3 completado:', globalStats.followups);
    } catch (e) {
        console.error('[MASTER CRON] ❌ Error en Bloque 3 (Seguimientos):', e.message);
    }

    // ── Respuesta final unificada ────────────────────────────────────────────
    console.log('[MASTER CRON] 🏁 Todos los bloques ejecutados.', globalStats);
    res.json({ message: 'Master Cron finished successfully', stats: globalStats });
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Birthday greetings — called daily by cron-job.org at 10:00
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cron/whatsapp-birthdays', async (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('[CRON BIRTHDAYS] CRON_SECRET no definido en el entorno.');
        return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    const providedToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    if (!providedToken || providedToken !== expectedSecret.trim()) {
        console.warn('[CRON BIRTHDAYS] Intento no autorizado.');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[CRON BIRTHDAYS] Iniciando envío de felicitaciones...');

        const today = new Date();
        const todayMonth = today.getMonth() + 1; // 1-12
        const todayDay = today.getDate();

        // Fetch all patients and filter by birth day/month in JS
        // (Prisma/PostgreSQL raw function needed for day/month comparison)
        const allPatients = await prisma.patient.findMany({
            where: { phone: { not: null } },
            select: { id: true, name: true, phone: true, birthDate: true }
        });

        const birthdayPatients = allPatients.filter(p => {
            if (!p.birthDate) return false;
            const bd = new Date(p.birthDate);
            return bd.getMonth() + 1 === todayMonth && bd.getDate() === todayDay;
        });

        console.log(`[CRON BIRTHDAYS] ${birthdayPatients.length} paciente(s) cumplen años hoy.`);

        const template = await prisma.whatsAppTemplate.findFirst({
            where: { triggerType: 'BIRTHDAY' }
        });

        if (!template && birthdayPatients.length > 0) {
            console.warn('[CRON BIRTHDAYS] No se encontró plantilla BIRTHDAY. Usando mensaje por defecto.');
        }

        const defaultMessage = '¡Feliz cumpleaños, {{nombre}}! 🎉 Todo el equipo de la clínica te deseamos un día estupendo. ¡Muchas felicidades!';

        const stats = { sent: 0, failed: 0, skipped: 0 };

        for (const patient of birthdayPatients) {
            if (!patient.phone) { stats.skipped++; continue; }

            // Avoid duplicate: check if already sent today
            const alreadySent = await prisma.whatsAppLog.findFirst({
                where: {
                    patientId: patient.id,
                    type: 'BIRTHDAY',
                    sentAt: { gte: new Date(today.setHours(0, 0, 0, 0)) }
                }
            });
            if (alreadySent) { stats.skipped++; continue; }

            const content = (template?.content || defaultMessage)
                .replace(/{{nombre}}/g, patient.name)
                .replace(/{{PACIENTE}}/g, patient.name);

            try {
                let number = patient.phone.replace(/[^0-9]/g, '');
                if (number.length === 9) number = '34' + number;

                await whatsappService.sendMessage(number, content);

                await prisma.whatsAppLog.create({
                    data: {
                        patientId: patient.id,
                        type: 'BIRTHDAY',
                        status: 'SENT',
                        content,
                        sentAt: new Date()
                    }
                });
                stats.sent++;
                console.log(`[CRON BIRTHDAYS] ✅ Enviado a ${patient.name}`);
            } catch (err) {
                console.error(`[CRON BIRTHDAYS] ❌ Error enviando a ${patient.name}:`, err.message);
                await prisma.whatsAppLog.create({
                    data: {
                        patientId: patient.id,
                        type: 'BIRTHDAY',
                        status: 'FAILED',
                        content,
                        error: err.message,
                        sentAt: new Date()
                    }
                });
                stats.failed++;
            }
        }

        res.json({ message: 'Birthday cron finished', stats });
    } catch (e) {
        console.error('[CRON BIRTHDAYS] Error general:', e);
        res.status(500).json({ error: e.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// CRON: Post-op follow-ups — called daily by cron-job.org
// Sends follow-up messages to patients whose completed appointment was N days ago
// based on the triggerOffset defined in TREATMENT_FOLLOWUP templates.
// ─────────────────────────────────────────────────────────────────────────────
app.post('/api/cron/whatsapp-followups', async (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const expectedSecret = process.env.CRON_SECRET;

    if (!expectedSecret) {
        console.error('[CRON FOLLOWUPS] CRON_SECRET no definido en el entorno.');
        return res.status(500).json({ error: 'Configuración del servidor incompleta' });
    }

    const providedToken = authHeader ? authHeader.replace(/^Bearer\s+/i, '').trim() : null;
    if (!providedToken || providedToken !== expectedSecret.trim()) {
        console.warn('[CRON FOLLOWUPS] Intento no autorizado.');
        return res.status(401).json({ error: 'Unauthorized' });
    }

    try {
        console.log('[CRON FOLLOWUPS] Iniciando check de seguimientos post-operatorios...');

        // Load all TREATMENT_FOLLOWUP templates (each defines its own triggerOffset in days)
        const templates = await prisma.whatsAppTemplate.findMany({
            where: { triggerType: 'TREATMENT_FOLLOWUP' }
        });

        if (templates.length === 0) {
            console.warn('[CRON FOLLOWUPS] No hay plantillas TREATMENT_FOLLOWUP configuradas.');
            return res.json({ message: 'No followup templates found', stats: { sent: 0, failed: 0, skipped: 0 } });
        }

        const stats = { sent: 0, failed: 0, skipped: 0 };

        for (const template of templates) {
            // triggerOffset is stored as a string like "3" (days after appointment)
            const offsetDays = parseInt(template.triggerOffset, 10);
            if (isNaN(offsetDays) || offsetDays <= 0) continue;

            // Target date: appointments completed exactly offsetDays ago
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() - offsetDays);
            const startOfTarget = new Date(targetDate.setHours(0, 0, 0, 0));
            const endOfTarget = new Date(targetDate.setHours(23, 59, 59, 999));

            const appointments = await prisma.appointment.findMany({
                where: {
                    status: { in: ['Completed', 'Attended'] },
                    date: { gte: startOfTarget, lte: endOfTarget }
                },
                include: { patient: true, treatment: true }
            });

            console.log(`[CRON FOLLOWUPS] Template "${template.name}" (offset ${offsetDays}d): ${appointments.length} cita(s) candidatas.`);

            for (const appt of appointments) {
                if (!appt.patient?.phone) { stats.skipped++; continue; }

                // Avoid duplicate follow-up for this patient & template combo
                const alreadySent = await prisma.whatsAppLog.findFirst({
                    where: {
                        patientId: appt.patient.id,
                        type: 'TREATMENT_FOLLOWUP',
                        sentAt: { gte: startOfTarget }
                    }
                });
                if (alreadySent) { stats.skipped++; continue; }

                const treatmentName = appt.treatmentName || appt.treatment?.name || 'Consulta';

                const content = template.content
                    .replace(/{{nombre}}/g, appt.patient.name)
                    .replace(/{{PACIENTE}}/g, appt.patient.name)
                    .replace(/{{tratamiento}}/g, treatmentName)
                    .replace(/{{TRATAMIENTO}}/g, treatmentName);

                try {
                    let number = appt.patient.phone.replace(/[^0-9]/g, '');
                    if (number.length === 9) number = '34' + number;

                    await whatsappService.sendMessage(number, content);

                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: appt.patient.id,
                            type: 'TREATMENT_FOLLOWUP',
                            status: 'SENT',
                            content,
                            sentAt: new Date()
                        }
                    });
                    stats.sent++;
                    console.log(`[CRON FOLLOWUPS] ✅ Seguimiento enviado a ${appt.patient.name}`);
                } catch (err) {
                    console.error(`[CRON FOLLOWUPS] ❌ Error enviando a ${appt.patient.name}:`, err.message);
                    await prisma.whatsAppLog.create({
                        data: {
                            patientId: appt.patient.id,
                            type: 'TREATMENT_FOLLOWUP',
                            status: 'FAILED',
                            content,
                            error: err.message,
                            sentAt: new Date()
                        }
                    });
                    stats.failed++;
                }
            }
        }

        res.json({ message: 'Followup cron finished', stats });
    } catch (e) {
        console.error('[CRON FOLLOWUPS] Error general:', e);
        res.status(500).json({ error: e.message });
    }
});


// Serve static files from React app (Production Support)
app.use(express.static(path.join(__dirname, '../dist')));

// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
// --- MODULE 10: SERVICES CATALOG ---
app.get('/api/services', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { specialty, search, includeInactive } = req.query;

        let query = supabase.from('services').select('*').order('specialty_name').order('name');

        // Filter by active status (default: only active)
        if (!includeInactive) {
            query = query.eq('is_active', true);
        }

        // Filter by specialty
        if (specialty) {
            query = query.eq('specialty_name', specialty);
        }

        const { data, error } = await query;

        if (error) {
            console.error('❌ Error fetching services:', error);
            return res.status(500).json({ error: error.message });
        }

        // Apply search filter in memory (Supabase ilike can be slow on large datasets)
        let filtered = data;
        if (search) {
            const searchLower = search.toLowerCase();
            filtered = data.filter(s => s.name.toLowerCase().includes(searchLower));
        }

        res.json(filtered);
    } catch (e) {
        console.error('Error in GET /api/services:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/services/specialties', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase
            .from('services')
            .select('specialty_name, specialty_color')
            .eq('is_active', true);

        if (error) throw error;

        // Get unique specialties
        const specialties = [...new Map(data.map(s => [s.specialty_name, s])).values()];
        res.json(specialties);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/services', async (req, res) => {
    try {
        const supabase = getSupabase();
        const serviceData = req.body;

        // Ensure required fields
        if (!serviceData.name || serviceData.final_price === undefined) {
            return res.status(400).json({ error: 'Name and price are required' });
        }

        const { data, error } = await supabase
            .from('services')
            .insert([{
                ...serviceData,
                is_active: true,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) {
            console.error('❌ Error creating service:', error);
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/fix-services', async (req, res) => {
    try {
        const supabase = getSupabase();

        // 1. Check if services exist
        const { count, error: countErr } = await supabase
            .from('services')
            .select('*', { count: 'exact', head: true });

        if (countErr) throw countErr;

        if (count > 0) {
            return res.json({ message: `Services table already has ${count} items. No action taken.` });
        }

        // 2. Seed Data
        const DENTAL_SERVICES = [
            { name: 'Limpieza Dental', price: 50, insurancePrice: { 'Sanitas': 0, 'Adeslas': 10 }, specialty_name: 'General' },
            { name: 'Obturación Simple', price: 60, insurancePrice: { 'Sanitas': 40, 'Adeslas': 45 }, specialty_name: 'General' },
            { name: 'Endodoncia Unirradicular', price: 120, insurancePrice: { 'Sanitas': 90, 'Adeslas': 100 }, specialty_name: 'General' },
            { name: 'Implante Titanio', price: 1200, specialty_name: 'Implantología' },
            { name: 'Ortodoncia Brackets (Mensual)', price: 100, specialty_name: 'Ortodoncia' },
            { name: 'Invisalign Full', price: 3500, specialty_name: 'Ortodoncia' },
            { name: 'Blanqueamiento Zoom', price: 300, specialty_name: 'Estética' },
            { name: 'Corona Zirconio', price: 350, specialty_name: 'Estética' },
            { name: 'Extracción Simple', price: 40, specialty_name: 'General' },
            { name: 'Curetaje por Cuadrante', price: 70, specialty_name: 'Periodoncia' }
        ];

        const toInsert = DENTAL_SERVICES.map(s => ({
            id: crypto.randomUUID(),
            name: s.name,
            final_price: s.price, // Map price to final_price
            specialty_name: s.specialty_name || 'General',
            specialty_color: '#3b82f6', // Default blue
            is_active: true,
            created_at: new Date().toISOString()
        }));

        const { data, error } = await supabase.from('services').insert(toInsert).select();

        if (error) throw error;

        res.json({ success: true, count: data.length, message: "Services seeded successfully" });

    } catch (e) {
        console.error("Fix Services Error:", e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/services/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const updates = req.body;

        delete updates.id;
        delete updates.created_at;

        const { data, error } = await supabase
            .from('services')
            .update({ ...updates, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating service:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/services/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;

        // Soft delete - just mark as inactive
        const { data, error } = await supabase
            .from('services')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json({ success: true, data });
    } catch (e) {
        console.error('Error deleting service:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- MODULE 9: AI ----
app.post('/api/ai/improve', async (req, res) => {
    try {
        const { text, patientName, type } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        const improved = await aiAgent.improveMessage(text, patientName, type);
        res.json({ text: improved });
    } catch (e) {
        console.error("AI Endpoint Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- CLINICAL TREATMENT PLANS (Feature 1) ---

app.get('/api/clinical-plans/:patientId', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { patientId } = req.params;

        const { data: plans, error } = await supabase
            .from('clinical_treatment_plans')
            .select('*, steps:clinical_treatment_steps(*)')
            .eq('patientId', patientId)
            .order('createdAt', { ascending: false });

        if (error) throw error;

        // Sort steps by stepOrder within each plan
        const sorted = (plans || []).map(p => ({
            ...p,
            steps: (p.steps || []).sort((a, b) => a.stepOrder - b.stepOrder)
        }));

        res.json(sorted);
    } catch (e) {
        console.error('Error fetching clinical plans:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/clinical-plans', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { patientId, name, notes, steps } = req.body;

        if (!patientId) return res.status(400).json({ error: 'patientId is required' });

        // 1. Create Plan
        const planId = crypto.randomUUID();
        const { data: plan, error: planError } = await supabase
            .from('clinical_treatment_plans')
            .insert([{
                id: planId,
                patientId: patientId,
                name: name || 'Plan de Tratamiento',
                status: 'ACTIVE',
                notes: notes || null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (planError) throw planError;

        // 2. Create Steps
        if (steps && steps.length > 0) {
            const stepsToInsert = steps.map((s, idx) => ({
                id: crypto.randomUUID(),
                planId: planId,
                stepOrder: idx,
                treatmentName: s.treatmentName || s.treatment_name,
                toothId: s.toothId || s.tooth_id || null,
                status: 'PENDIENTE',
                notes: s.notes || null,
                createdAt: new Date().toISOString()
            }));

            const { error: stepsError } = await supabase
                .from('clinical_treatment_steps')
                .insert(stepsToInsert);

            if (stepsError) throw stepsError;
        }

        // Return plan with steps
        const { data: fullPlan } = await supabase
            .from('clinical_treatment_plans')
            .select('*, steps:clinical_treatment_steps(*)')
            .eq('id', planId)
            .single();

        res.status(201).json(fullPlan);
    } catch (e) {
        console.error('Error creating clinical plan:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/clinical-plans/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { name, status, notes } = req.body;

        const updates = { updatedAt: new Date().toISOString() };
        if (name !== undefined) updates.name = name;
        if (status !== undefined) updates.status = status;
        if (notes !== undefined) updates.notes = notes;

        const { data, error } = await supabase
            .from('clinical_treatment_plans')
            .update(updates)
            .eq('id', id)
            .select('*, steps:clinical_treatment_steps(*)')
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating clinical plan:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/clinical-plans/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;

        // Cascade delete removes steps automatically
        const { error } = await supabase
            .from('clinical_treatment_plans')
            .delete()
            .eq('id', id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting clinical plan:', e);
        res.status(500).json({ error: e.message });
    }
});

// Clinical Plan Steps - Individual CRUD
app.post('/api/clinical-plan-steps', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { planId, treatmentName, toothId, notes, stepOrder } = req.body;

        if (!planId || !treatmentName) {
            return res.status(400).json({ error: 'planId and treatmentName are required' });
        }

        // Get current max stepOrder
        const { data: existing } = await supabase
            .from('clinical_treatment_steps')
            .select('stepOrder')
            .eq('planId', planId)
            .order('stepOrder', { ascending: false })
            .limit(1);

        const maxOrder = existing && existing.length > 0 ? existing[0].stepOrder : -1;

        const { data, error } = await supabase
            .from('clinical_treatment_steps')
            .insert([{
                id: crypto.randomUUID(),
                planId: planId,
                stepOrder: stepOrder !== undefined ? stepOrder : maxOrder + 1,
                treatmentName: treatmentName,
                toothId: toothId || null,
                status: 'PENDIENTE',
                notes: notes || null,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating clinical step:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/clinical-plan-steps/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { status, stepOrder, treatmentName, notes, toothId } = req.body;

        const updates = {};
        if (status !== undefined) {
            updates.status = status;
            if (status === 'COMPLETADO') updates.completedAt = new Date().toISOString();
            else updates.completedAt = null;
        }
        if (stepOrder !== undefined) updates.stepOrder = stepOrder;
        if (treatmentName !== undefined) updates.treatmentName = treatmentName;
        if (notes !== undefined) updates.notes = notes;
        if (toothId !== undefined) updates.toothId = toothId;

        const { data, error } = await supabase
            .from('clinical_treatment_steps')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating clinical step:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/clinical-plan-steps/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('clinical_treatment_steps')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting clinical step:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- CONTROL DE JORNADA (Fichaje) ---

app.post('/api/jornada/clock-in', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || req.user?.id;
        const role = req.headers['x-user-role'] || req.user?.role;

        if (!userId) {
            console.error('❌ Clock-in error: No user ID found in headers or session');
            return res.status(401).json({ error: 'Usuario no identificado.' });
        }

        const today = new Date().toISOString().split('T')[0];

        // Check for open shift
        console.log(`🕒 Checking open shift for User: ${userId}`);
        const openShift = await prisma.workShift.findFirst({
            where: { userId, clockOut: null }
        });

        if (openShift) {
            return res.status(400).json({ error: 'Ya tienes una jornada abierta.' });
        }

        console.log(`📝 Creating new shift for User: ${userId} on Date: ${today}`);
        const newShift = await prisma.workShift.create({
            data: {
                id: crypto.randomUUID(),
                userId,
                clockIn: new Date(),
                date: today
            }
        });

        console.log(`✅ Shift created: ${newShift.id}`);
        res.status(201).json(newShift);
    } catch (e) {
        console.error('🔥 CRITICAL ERROR in clock-in:', e);
        res.status(500).json({
            error: 'Error interno al registrar entrada.',
            details: e.message,
            stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
        });
    }
});

app.put('/api/jornada/clock-out', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || req.user?.id;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no identificado.' });
        }

        console.log(`🕒 Clocking out for User: ${userId}`);
        const openShift = await prisma.workShift.findFirst({
            where: { userId, clockOut: null }
        });

        if (!openShift) {
            return res.status(400).json({ error: 'No tienes ninguna jornada abierta para cerrar.' });
        }

        const updatedShift = await prisma.workShift.update({
            where: { id: openShift.id },
            data: { clockOut: new Date() }
        });

        console.log(`✅ Shift closed: ${updatedShift.id}`);
        res.json(updatedShift);
    } catch (e) {
        console.error('🔥 CRITICAL ERROR in clock-out:', e);
        res.status(500).json({
            error: 'Error interno al registrar salida.',
            details: e.message
        });
    }
});

app.post('/api/jornada/manual', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || req.user?.id;
        const { date, startTime, endTime, breakMinutes, notes } = req.body;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no identificado.' });
        }

        if (!date || !startTime || !endTime) {
            return res.status(400).json({ error: 'Faltan campos obligatorios (fecha, inicio, fin).' });
        }

        // Combine date and time
        const clockIn = new Date(`${date}T${startTime}:00`);
        const clockOut = new Date(`${date}T${endTime}:00`);

        if (clockOut <= clockIn) {
            return res.status(400).json({ error: 'La hora de fin debe ser posterior a la de inicio.' });
        }

        const newShift = await prisma.workShift.create({
            data: {
                id: crypto.randomUUID(),
                userId,
                clockIn,
                clockOut,
                breakMinutes: parseInt(breakMinutes) || 0,
                notes,
                isManual: true,
                date
            }
        });

        res.status(201).json(newShift);
    } catch (e) {
        console.error('🔥 Error in manual clock-in:', e);
        res.status(500).json({ error: 'Error al registrar jornada manual.', details: e.message });
    }
});

app.get('/api/jornada/history', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || req.user?.id;
        const role = req.headers['x-user-role'] || req.user?.role;

        if (!userId) {
            return res.status(401).json({ error: 'Usuario no identificado.' });
        }

        console.log(`📋 Fetching attendance history for User: ${userId}, Role: ${role}`);
        let whereClause = { userId };
        if (role === 'ADMIN') {
            whereClause = {}; // Admin sees all
            console.log('👑 Admin access: showing all shifts');
        }

        const history = await prisma.workShift.findMany({
            where: whereClause,
            include: { user: { select: { name: true } } },
            orderBy: { clockIn: 'desc' }
        });

        console.log(`✅ Returned ${history.length} shifts`);
        res.json(history);
    } catch (e) {
        console.error('🔥 CRITICAL ERROR fetching history:', e);
        res.status(500).json({
            error: 'Error interno al obtener el historial.',
            details: e.message
        });
    }
});

// --- AGENDA CLOSURES (Feature 4) ---

app.get('/api/agenda-closures', async (req, res) => {
    try {
        const { date, doctorId } = req.query;
        let whereClause = {};

        if (date) {
            whereClause.date = new Date(date);
        }
        if (doctorId) {
            whereClause.OR = [
                { doctorId: doctorId },
                { doctorId: null }
            ];
        }

        const data = await prisma.agendaClosure.findMany({
            where: whereClause,
            orderBy: { date: 'desc' }
        });
        
        res.json(data || []);
    } catch (e) {
        console.error('🔥 CRITICAL PRISMA ERROR fetching agenda closures:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.post('/api/agenda-closures', async (req, res) => {
    try {
        const { date, doctorId, reason, createdBy } = req.body;

        if (!date) return res.status(400).json({ error: 'date is required' });

        // Check if already closed
        let checkWhere = { date: new Date(date) };
        if (doctorId) {
            checkWhere.doctorId = doctorId;
        } else {
            checkWhere.doctorId = null;
        }

        const existing = await prisma.agendaClosure.findMany({ where: checkWhere });
        
        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'This agenda is already closed for this date' });
        }

        const data = await prisma.agendaClosure.create({
            data: {
                id: crypto.randomUUID(),
                date: new Date(date),
                doctorId: doctorId || null,
                reason: reason || null,
                createdBy: createdBy || null
            }
        });

        res.status(201).json(data);
    } catch (e) {
        console.error('🔥 CRITICAL PRISMA ERROR creating agenda closure:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

app.delete('/api/agenda-closures/:id', async (req, res) => {
    try {
        await prisma.agendaClosure.delete({
            where: { id: req.params.id }
        });
        res.json({ success: true });
    } catch (e) {
        console.error('🔥 CRITICAL PRISMA ERROR deleting agenda closure:', e);
        res.status(500).json({ error: e.message, stack: e.stack });
    }
});

// =========================================================
// EXPENSES (Gastos de la Clínica)
// =========================================================
app.get('/api/expenses', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { month } = req.query; // optional YYYY-MM filter
        let query = supabase.from('expenses').select('*').order('date', { ascending: false });
        if (month) {
            const from = `${month}-01`;
            const to = `${month}-31`;
            query = query.gte('date', from).lte('date', to);
        }
        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching expenses:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/expenses', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, description, category, amount, paymentMethod, receiptUrl } = req.body;
        if (!description || !category || !amount || !paymentMethod) {
            return res.status(400).json({ error: 'Faltan campos obligatorios: description, category, amount, paymentMethod' });
        }
        const { data, error } = await supabase
            .from('expenses')
            .insert([{ date, description, category, amount, paymentMethod, receiptUrl }])
            .select()
            .single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating expense:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/expenses/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, description, category, amount, paymentMethod, receiptUrl } = req.body;
        const { data, error } = await supabase
            .from('expenses')
            .update({ date, description, category, amount, paymentMethod, receiptUrl })
            .eq('id', req.params.id)
            .select()
            .single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating expense:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/expenses/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('expenses')
            .delete()
            .eq('id', req.params.id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting expense:', e);
        res.status(500).json({ error: e.message });
    }
});

// ========== BLOQUE 1.3: DOCTOR REASSIGNMENT ==========
app.put('/api/clinical-records/:recordId/reassign-doctor', async (req, res) => {
    try {
        const { recordId } = req.params;
        const { doctorId } = req.body;

        if (!doctorId) {
            return res.status(400).json({ error: 'doctorId is required' });
        }

        const record = await prisma.clinicalRecord.update({
            where: { id: recordId },
            data: { authorId: doctorId },
            include: {
                patient: true,
            },
        });

        console.log(`✅ Clinical Record ${recordId} reassigned to doctor ${doctorId}`);
        res.json({
            success: true,
            message: `Registro clínico de ${record.patient.name} actualizado`,
            record,
        });
    } catch (e) {
        console.error('Error reassigning doctor:', e);
        res.status(500).json({ error: e.message });
    }
});

// ========== BLOQUE 2.1: LIQUIDATIONS ENDPOINTS ==========
app.get('/api/liquidations/summary', async (req, res) => {
    try {
        const { doctorId, month, year, dateFrom, dateTo } = req.query;

        if (!doctorId) {
            return res.status(400).json({ error: 'doctorId is required' });
        }

        // --- NEW: dateFrom/dateTo format (used by Liquidations.tsx) ---
        if (dateFrom && dateTo) {
            let supabase;
            try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

            const startISO = new Date(dateFrom).toISOString();
            const endDate = new Date(dateTo);
            endDate.setHours(23, 59, 59, 999);
            const endISO = endDate.toISOString();

            // Fetch payments for doctor in date range
            const { data: payments, error: pmtError } = await supabase
                .from('Payment')
                .select('*')
                .eq('doctorId', doctorId)
                .gte('createdAt', startISO)
                .lte('createdAt', endISO)
                .order('createdAt', { ascending: true });

            if (pmtError) throw pmtError;

            // Fetch patient names for the payment set
            const patientIds = [...new Set((payments || []).map(p => p.patientId).filter(Boolean))];
            const patientMap = {};
            if (patientIds.length > 0) {
                const { data: patients } = await supabase
                    .from('Patient')
                    .select('id, name, historyNumber')
                    .in('id', patientIds);
                (patients || []).forEach(pt => { patientMap[pt.id] = pt; });
            }

            const records = (payments || []).map(p => {
                const patient = patientMap[p.patientId] || {};
                return {
                    id: p.id,
                    fecha: p.createdAt,
                    concepto: p.notes || (p.treatmentId ? `Tratamiento ${p.treatmentId}` : 'Pago'),
                    importeCobrado: p.amount || 0,
                    nombrePaciente: patient.name || 'Paciente desconocido',
                    numeroHistoria: patient.historyNumber || '-',
                    doctorId: p.doctorId,
                };
            });

            const total = records.reduce((sum, r) => sum + r.importeCobrado, 0);
            return res.json({ records, dateFrom, dateTo, doctorId, total });
        }

        // --- EXISTING: month/year format (backward compatibility) ---
        const monthInt = parseInt(month, 10) || new Date().getMonth() + 1;
        const yearInt  = parseInt(year,  10) || new Date().getFullYear();

        const startDate = new Date(yearInt, monthInt - 1, 1);
        const endDate   = new Date(yearInt, monthInt, 0, 23, 59, 59);

        // Lookup doctor first — return 404 if not found
        const doctor = await prisma.doctor.findUnique({ where: { id: doctorId } });
        if (!doctor) {
            return res.status(404).json({ error: 'Doctor not found' });
        }

        // Get all liquidations for doctor in period
        let liquidations = [];
        try {
            liquidations = await prisma.liquidation.findMany({
                where: {
                    doctorId,
                    createdAt: { gte: startDate, lte: endDate },
                },
                orderBy: { createdAt: 'asc' },
            });
        } catch (prismaErr) {
            // Table may not exist yet in DB — return empty result gracefully
            console.warn('Liquidation table query failed, returning empty:', prismaErr.message);
        }

        // Calculate totals
        const totals = { totalGross: 0, totalLabCost: 0, totalCommission: 0, totalToPay: 0 };
        liquidations.forEach(liq => {
            totals.totalGross      += liq.grossAmount  || 0;
            totals.totalLabCost    += liq.labCost      || 0;
            totals.totalCommission += liq.finalAmount  || 0;
            totals.totalToPay      += liq.finalAmount  || 0;
        });

        const MONTHS = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

        res.json({
            doctor: { id: doctor.id, name: doctor.name, specialization: doctor.specialization },
            period: `${MONTHS[monthInt]} ${yearInt}`,
            treatments: liquidations,
            totals,
            count: liquidations.length,
        });
    } catch (e) {
        console.error('Error fetching liquidation summary:', e);
        res.status(500).json({ error: e.message });
    }
});

// ========== BLOQUE 2.2: SERVICES SEARCH ==========
app.get('/api/services/search', async (req, res) => {
    try {
        const { query } = req.query;

        if (!query || query.length < 2) {
            return res.json([]);
        }

        const services = await prisma.treatment.findMany({
            where: {
                name: {
                    contains: query,
                    mode: 'insensitive',
                },
            },
            select: {
                id: true,
                name: true,
                price: true,
            },
            take: 20,
        });

        // Format for frontend
        const formatted = services.map(s => ({
            value: s.id,
            label: s.name,
            price: s.price,
        }));

        res.json(formatted);
    } catch (e) {
        console.error('Error searching services:', e);
        res.status(500).json({ error: e.message });
    }
});

// Note: Using regex pattern for Express 5 compatibility
app.get(/^\/(?!api).*/, (req, res) => {
    // Check if file exists, if not send error (debugging)
    const indexPath = path.join(__dirname, '../dist/index.html');
    res.sendFile(indexPath, (err) => {
        if (err) {
            console.error("Error serving index.html:", err);
            res.status(500).send("Server Error: Could not serve frontend.");
        }
    });
});

// --- CONSENTMENTS (Block 4.1) ---
app.post('/api/patients/:patientId/consents', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { templateId, isSigned } = req.body;

        if (!patientId || !templateId) {
            return res.status(400).json({ error: 'patientId and templateId are required' });
        }

        // Create consent record
        const consent = await prisma.consent.create({
            data: {
                id: require('crypto').randomUUID(),
                patientId,
                templateId,
                title: 'Consentimiento',
                isSigned: isSigned || false,
                signedDate: isSigned ? new Date().toISOString() : null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        });

        console.log('✅ Consent created:', consent.id);
        res.json(consent);
    } catch (e) {
        console.error('Error creating consent:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/patients/:patientId/consents', async (req, res) => {
    try {
        const { patientId } = req.params;

        const consents = await prisma.consent.findMany({
            where: { patientId },
            orderBy: { createdAt: 'desc' }
        });

        res.json(consents);
    } catch (e) {
        console.error('Error fetching consents:', e);
        res.status(500).json({ error: e.message });
    }
});

app.patch('/api/patients/:patientId/consents/:consentId', async (req, res) => {
    try {
        const { patientId, consentId } = req.params;
        const { isSigned } = req.body;

        const consent = await prisma.consent.update({
            where: { id: consentId },
            data: {
                isSigned: isSigned || false,
                signedDate: isSigned ? new Date().toISOString() : null,
                updatedAt: new Date().toISOString()
            }
        });

        console.log('✅ Consent updated:', consentId);
        res.json(consent);
    } catch (e) {
        console.error('Error updating consent:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/patients/:patientId/consents/:consentId', async (req, res) => {
    try {
        const { consentId } = req.params;

        await prisma.consent.delete({
            where: { id: consentId }
        });

        console.log('✅ Consent deleted:', consentId);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting consent:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DOCUMENTS (Block 4.2) ---
app.get('/api/patients/:patientId/documents', async (req, res) => {
    try {
        const { patientId } = req.params;
        
        // In production, fetch from database
        // For now, return mock data structure
        const documents = [];
        
        res.json(documents);
    } catch (e) {
        console.error('Error fetching documents:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients/:patientId/documents', async (req, res) => {
    try {
        const { patientId } = req.params;
        const { fileName, documentType, fileUrl, description } = req.body;

        if (!patientId || !fileName || !documentType) {
            return res.status(400).json({ error: 'patientId, fileName, and documentType are required' });
        }

        // In production, save file to cloud storage and create DB record
        const document = {
            id: require('crypto').randomUUID(),
            patientId,
            fileName,
            documentType,
            fileSize: 0,
            uploadDate: new Date().toISOString(),
            createdBy: 'System',
            description: description || null
        };

        console.log('✅ Document uploaded:', document.id);
        res.status(201).json(document);
    } catch (e) {
        console.error('Error uploading document:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/patients/:patientId/documents/:documentId', async (req, res) => {
    try {
        const { patientId, documentId } = req.params;

        // In production, delete from cloud storage and DB
        console.log('✅ Document deleted:', documentId);
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting document:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/patients/:patientId/documents/:documentId/download', async (req, res) => {
    try {
        const { patientId, documentId } = req.params;

        // In production, stream file from cloud storage
        console.log('📥 Document download:', documentId);
        res.json({ message: 'Document download started' });
    } catch (e) {
        console.error('Error downloading document:', e);
        res.status(500).json({ error: e.message });
    }
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        if (!process.env.OPENAI_API_KEY) {
            console.warn("⚠️  WARNING: OPENAI_API_KEY is missing. AI features will fail.");
        } else {
            console.log("✅ AI Agent initialized with API Key.");
        }
    });
}

module.exports = app;
