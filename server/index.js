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
    const userId = req.headers['x-user-id'] || 'mock-user-id';
    req.user = { id: userId, role };
    next();
};

app.use(authMiddleware);

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
        const supabase = getSupabase();
        // Return active users
        const { data, error } = await supabase.from('system_users').select('*').eq('is_active', true);
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching active system users:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/system-users/all', async (req, res) => {
    try {
        const supabase = getSupabase();
        // Return all users and sort them
        const { data, error } = await supabase.from('system_users').select('*').order('role').order('full_name');
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching all system users:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/system-users/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { data, error } = await supabase.from('system_users').select('*').eq('id', id).single();
        if (error && error.code !== 'PGRST116') throw error;
        res.json(data || null);
    } catch (e) {
        console.error('Error fetching system user:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/system-users', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('system_users').insert([req.body]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating system user:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/system-users/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { data, error } = await supabase.from('system_users').update(req.body).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating system user:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/system-users/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { error } = await supabase.from('system_users').delete().eq('id', id);
        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting system user:', e);
        res.status(500).json({ error: e.message });
    }
});

// --- DOCTOR SCHEDULES API ---
app.get('/api/doctor-schedules', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('doctor_schedules').select('*').eq('is_active', true);
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/doctor-schedules/doctor/:doctorId', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('doctor_schedules').select('*').eq('doctor_id', req.params.doctorId);
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching doctor schedules:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/doctor-schedules', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { data, error } = await supabase.from('doctor_schedules').insert([req.body]).select().single();
        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

app.put('/api/doctor-schedules/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { data, error } = await supabase.from('doctor_schedules').update(req.body).eq('id', id).select().single();
        if (error) throw error;
        res.json(data);
    } catch (e) {
        console.error('Error updating doctor schedule:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/doctor-schedules/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { id } = req.params;
        const { error } = await supabase.from('doctor_schedules').delete().eq('id', id);
        if (error) throw error;
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
        const { patientId, treatment, observation, specialization, price, date } = req.body;

        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Schema Adaptation: valid columns are id, patientId, date, text
        // We store structured data in 'text' as a stringified JSON
        const payload = {
            treatment: treatment || 'Nota Clínica',
            observation: observation || '',
            specialization: specialization || 'General',
            price: price || 0
        };

        const { data, error } = await supabase
            .from('ClinicalRecord')
            .insert([{
                id: crypto.randomUUID(),
                patientId,
                date: new Date().toISOString(),
                text: JSON.stringify(payload), // Serialize structure
                authorId: 'system' // Optional
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

        const { error } = await supabase.from('ClinicalRecord').delete().eq('id', id);
        if (error) throw error;

        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/budgets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        // Determine if logic needs to delete items first (Cascade usually handles this, assuming Supabase/Postgres FK is set to Cascade)
        // If not, we might need to delete line items first manually.
        // For now trusting cascade or simple delete.
        const { error } = await supabase.from('Budget').delete().eq('id', id);
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
        const supabase = getSupabase();

        // Fetch ALL doctors from Doctor table
        const { data: doctors, error } = await supabase
            .from('Doctor')
            .select('id, name, specialization')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching doctors from Doctor table:', error.message);
            return res.status(500).json({ error: error.message });
        }

        if (!doctors || doctors.length === 0) {
            console.warn('⚠️ No doctors found in Doctor table. Have you run the sync?');
            return res.json([]);
        }

        // Filter out doctors whose corresponding system_user is inactive or deleted
        const { data: activeSystemUsers } = await supabase
            .from('system_users')
            .select('full_name')
            .eq('is_active', true)
            .in('role', ['DOCTOR', 'ADMIN']);

        let filteredDoctors = doctors;
        if (activeSystemUsers && activeSystemUsers.length > 0) {
            const activeNames = new Set(activeSystemUsers.map(u => u.full_name?.toLowerCase()));
            filteredDoctors = doctors.filter(d => activeNames.has(d.name?.toLowerCase()));
        }

        console.log(`✅ Loaded ${filteredDoctors.length} active doctors (${doctors.length} total)`);
        res.json(filteredDoctors);
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

        // Get all users with DOCTOR role
        const { data: doctorUsers, error: userError } = await supabase
            .from('User')
            .select('id, name')
            .eq('role', 'DOCTOR');

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
        console.log("GET /api/patients - Fetching all patients...");

        let supabase;
        try {
            supabase = getSupabase();
        } catch (configError) {
            return res.status(500).json({ error: configError.message });
        }

        const { data, error } = await supabase
            .from('Patient')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error("❌ Supabase Fetch Error (Patients):", error);
            return res.status(500).json({ error: error.message });
        }

        console.log(`✅ Loaded ${data.length} patients.`);
        // Normalize all patients to ensure JSON fields are parsed
        const normalizedData = data.map(normalizePatient);
        res.json(normalizedData);
    } catch (e) {
        console.error("Error Fetching Patients:", e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/patients', async (req, res) => {
    try {
        console.log("POST /api/patients Body:", JSON.stringify(req.body, null, 2)); // VERBOSE DEBUG

        // Clone body to avoid mutating req.body directly if needed, though req.body is usually fine
        const data = { ...req.body };

        // --- CRITICAL FIX: Ensure ID exists ---
        if (!data.id) {
            console.log("⚠️ ID missing in payload (Server), generating UUID...");
            data.id = crypto.randomUUID();
        } else {
            console.log("✅ ID present in payload:", data.id);
        }

        // --- FIX: Ensure birthDate exists (DB constraint) ---
        if (!data.birthDate) {
            console.log("⚠️ birthDate missing, using current date");
            data.birthDate = new Date().toISOString();
        }

        // Auto-construir campo 'name' si se proporcionan firstName, lastName1, lastName2
        if (data.firstName || data.lastName1 || data.lastName2) {
            const firstName = data.firstName || '';
            const lastName1 = data.lastName1 || '';
            const lastName2 = data.lastName2 || '';
            data.name = `${firstName} ${lastName1} ${lastName2}`.trim();
            console.log(`🏷️ Auto-generated name: "${data.name}"`);
        }

        // Validate
        if (!data.name || !data.dni) {
            console.error("❌ Missing name or dni");
            return res.status(400).json({ error: "Name and DNI are required" });
        }

        // --- AUTO-GENERATE HISTORY NUMBER ---
        if (!data.historyNumber) {
            const supabase = getSupabase();
            // Get the highest existing history number
            const { data: existingPatients, error: countError } = await supabase
                .from('Patient')
                .select('historyNumber')
                .not('historyNumber', 'is', null)
                .order('historyNumber', { ascending: false })
                .limit(1);

            let nextNumber = 1;
            if (!countError && existingPatients && existingPatients.length > 0) {
                // Parse the number from HCL-0001 format
                const lastNumber = existingPatients[0].historyNumber;
                const match = lastNumber?.match(/HCL-(\d+)/);
                if (match) {
                    nextNumber = parseInt(match[1], 10) + 1;
                }
            }
            data.historyNumber = `HCL-${String(nextNumber).padStart(4, '0')}`;
            console.log(`📋 Generated history number: ${data.historyNumber}`);
        }

        // Explicitly insert the modified object 'data' NOT req.body
        const { data: created, error } = await getSupabase().from('Patient').insert(data).select().single();

        if (error) {
            console.error("❌ Supabase Insert Error:", error);
            throw error;
        }

        console.log("✅ Patient created:", created.id);
        // Normalize the returned patient
        res.json(normalizePatient(created));
    } catch (e) {
        console.error("Error creating patient:", e);
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
                    console.error('❌ Doctor not found with ID:', safeDoctorId);
                    return res.status(400).json({ error: `Doctor no encontrado (ID: ${safeDoctorId}). Asegúrate de que el doctor existe en la tabla Doctor.` });
                }

                // Check if doctor is active (if is_active column exists)
                if (doctor.is_active === false) {
                    return res.status(400).json({ error: `El Dr. ${doctor.name} está inactivo. No se pueden crear citas con este doctor.` });
                }

                console.log(`✓ Doctor validation passed: Dr. ${doctor.name} (${doctor.specialization})`);
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
                budgetId: safeBudgetId,
                budget_item_id: safeBudgetItemId || null,
                budget_item_ids: safeBudgetItemIds ? JSON.stringify(safeBudgetItemIds) : null,
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
            .select('*, budget:Budget(id, totalAmount, items:BudgetLineItem(name, price, tooth))');

        if (error) {
            console.error("❌ Supabase Fetch Error (Appointments):", error);
            return res.status(500).json({ error: error.message });
        }
        res.json(data);
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

        // Sanitization: Convert empty strings to null for UUID fields
        if (typeof updates.budgetId === 'string' && updates.budgetId.trim() === '') updates.budgetId = null;
        if (typeof updates.budgetItemId === 'string' && updates.budgetItemId.trim() === '') updates.budgetItemId = null;
        if (typeof updates.treatmentId === 'string' && updates.treatmentId.trim() === '') updates.treatmentId = null;
        if (typeof updates.doctorId === 'string' && updates.doctorId.trim() === '') updates.doctorId = null;

        // Remove relation objects from updates to avoid Prisma errors
        delete updates.treatment;
        delete updates.doctor;
        delete updates.patient;
        delete updates.budget;
        delete updates.liquidation;
        delete updates.id;

        const updatedAppointment = await prisma.appointment.update({
            where: { id: id },
            data: updates
        });

        console.log("✅ Appointment Updated:", updatedAppointment.id);
        res.json(updatedAppointment);
    } catch (e) {
        console.error("Error updating appointment:", e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/appointments/:id', async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🗑️ Deleting Appointment ${id}`);

        // Try deleting via Prisma
        await prisma.appointment.delete({
            where: { id: id }
        });

        console.log("✅ Appointment Deleted:", id);
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
    // HARDCODED DEBUGGING - REMOVE BEFORE FINAL PROD IF POSSIBLE
    const URL = "https://gnnacijqglcqonholpwt.supabase.co";
    const KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubmFjaWpxZ2xjcW9uaG9scHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3NjU0NCwiZXhwIjoyMDg0MDUyNTQ0fQ.6qexkezsBpOhvTch_eRsr8lF_mixdp9sfv0ScjUmxp4";

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

        const { data: user, error } = await supabase
            .from('User')
            .select('*')
            .eq('email', email)
            .single();

        if (error) {
            console.error("❌ DB Query Error:", error);
            // DEBUG: Return full error to UI for diagnosis
            return res.status(500).json({ error: `DB Error: ${error.message} (${error.code || 'NoCode'})` });
        }

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

        // 2. Create Invoice
        const today = new Date().toISOString().split('T')[0];
        const result = await quipuService.createInvoice(
            contact.id,
            items,
            today,
            today,
            paymentMethod || 'card'
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
            res.json({
                success: true,
                invoiceNumber: result.number,
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
        console.error("Invoice Error:", e);
        res.status(500).json({ error: e.message });
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
        let supabase;
        try { supabase = getSupabase(); } catch (e) { return res.status(500).json({ error: e.message }); }

        const { patientId, budgetId, amount, method, type, notes } = req.body;

        if (!patientId || !amount || !method || !type) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // 1. Crear registro de pago
        const paymentId = crypto.randomUUID();
        const { data: payment, error: paymentError } = await supabase
            .from('Payment')
            .insert([{
                id: paymentId,
                patientId,
                budgetId: budgetId || null,
                amount: parseFloat(amount),
                method,
                type,
                notes: notes || null,
                createdAt: new Date().toISOString()
            }])
            .select()
            .single();

        if (paymentError) {
            console.error("❌ Error creating payment:", paymentError);
            return res.status(500).json({ error: paymentError.message });
        }

        // 2 & 3. Recalculate Wallet (Single Source of Truth)
        if (type === 'ADVANCE_PAYMENT' || (type === 'DIRECT_CHARGE' && method === 'wallet')) {
            await calculateWalletBalance(supabase, patientId);
        }

        // 4. Generar factura automáticamente
        const invoiceNumber = `F-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

        let concept = '';
        let items = [];

        if (type === 'ADVANCE_PAYMENT') {
            concept = 'Pago a Cuenta';
            items = [{ name: 'Anticipo', price: parseFloat(amount) }];
        } else if (budgetId) {
            // Obtener items del presupuesto
            const { data: budget } = await supabase
                .from('Budget')
                .select('*, items:BudgetLineItem(*)')
                .eq('id', budgetId)
                .single();

            concept = `Cobro Presupuesto #${budgetId.substring(0, 6)}`;
            items = budget?.items?.map(i => ({ name: i.name, price: i.price })) || [];
        }

        const { data: invoice, error: invoiceError } = await supabase
            .from('Invoice')
            .insert([{
                id: crypto.randomUUID(),
                invoiceNumber,
                patientId,
                amount: parseFloat(amount),
                date: new Date().toISOString(),
                status: 'issued',
                paymentMethod: method,
                concept,
                relatedPaymentId: paymentId
            }])
            .select()
            .single();

        if (invoiceError) {
            console.error("❌ Error creating invoice:", invoiceError);
            // No fallar el pago si falla la factura
        }

        // 5. Crear items de factura
        if (invoice && items.length > 0) {
            const invoiceItems = items.map(item => ({
                id: crypto.randomUUID(),
                invoiceId: invoice.id,
                name: item.name,
                price: item.price
            }));

            await supabase.from('InvoiceItem').insert(invoiceItems);
        }

        // 6. Actualizar payment con invoiceId
        if (invoice) {
            await supabase
                .from('Payment')
                .update({ invoiceId: invoice.id })
                .eq('id', paymentId);
        }

        // 7. Si hay appointmentId, marcar la cita como pagada para evitar doble cobro
        const appointmentId = req.body.appointmentId;
        if (appointmentId) {
            try {
                await prisma.appointment.update({
                    where: { id: appointmentId },
                    data: { paid: true, status: 'Completed' }
                });
                console.log(`✅ Appointment ${appointmentId} marked as paid`);
            } catch (apptErr) {
                console.error("⚠️ Could not mark appointment as paid:", apptErr.message);
            }
        }

        res.json({
            payment: { ...payment, invoiceId: invoice?.id },
            invoice: invoice || null
        });
    } catch (e) {
        console.error("❌ Payment creation error:", e);
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
app.get('/api/whatsapp/status', (req, res) => {
    res.json(whatsappService.getStatus());
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
            .eq('patient_id', patientId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        // Sort steps by step_order within each plan
        const sorted = (plans || []).map(p => ({
            ...p,
            steps: (p.steps || []).sort((a, b) => a.step_order - b.step_order)
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
                patient_id: patientId,
                name: name || 'Plan de Tratamiento',
                status: 'ACTIVE',
                notes: notes || null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (planError) throw planError;

        // 2. Create Steps
        if (steps && steps.length > 0) {
            const stepsToInsert = steps.map((s, idx) => ({
                id: crypto.randomUUID(),
                plan_id: planId,
                step_order: idx,
                treatment_name: s.treatmentName || s.treatment_name,
                tooth_id: s.toothId || s.tooth_id || null,
                status: 'PENDIENTE',
                notes: s.notes || null,
                created_at: new Date().toISOString()
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

        const updates = { updated_at: new Date().toISOString() };
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

        // Get current max step_order
        const { data: existing } = await supabase
            .from('clinical_treatment_steps')
            .select('step_order')
            .eq('plan_id', planId)
            .order('step_order', { ascending: false })
            .limit(1);

        const maxOrder = existing && existing.length > 0 ? existing[0].step_order : -1;

        const { data, error } = await supabase
            .from('clinical_treatment_steps')
            .insert([{
                id: crypto.randomUUID(),
                plan_id: planId,
                step_order: stepOrder !== undefined ? stepOrder : maxOrder + 1,
                treatment_name: treatmentName,
                tooth_id: toothId || null,
                status: 'PENDIENTE',
                notes: notes || null,
                created_at: new Date().toISOString()
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
            if (status === 'COMPLETADO') updates.completed_at = new Date().toISOString();
            else updates.completed_at = null;
        }
        if (stepOrder !== undefined) updates.step_order = stepOrder;
        if (treatmentName !== undefined) updates.treatment_name = treatmentName;
        if (notes !== undefined) updates.notes = notes;
        if (toothId !== undefined) updates.tooth_id = toothId;

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

// --- AGENDA CLOSURES (Feature 4) ---

app.get('/api/agenda-closures', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, doctorId } = req.query;

        let query = supabase.from('agenda_closures').select('*').order('date', { ascending: false });

        if (date) query = query.eq('date', date);
        if (doctorId) query = query.or(`doctor_id.eq.${doctorId},doctor_id.is.null`);

        const { data, error } = await query;
        if (error) throw error;
        res.json(data || []);
    } catch (e) {
        console.error('Error fetching agenda closures:', e);
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/agenda-closures', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { date, doctorId, reason, createdBy } = req.body;

        if (!date) return res.status(400).json({ error: 'date is required' });

        // Check if already closed
        let checkQuery = supabase.from('agenda_closures').select('id').eq('date', date);
        if (doctorId) {
            checkQuery = checkQuery.eq('doctor_id', doctorId);
        } else {
            checkQuery = checkQuery.is('doctor_id', null);
        }
        const { data: existing } = await checkQuery;
        if (existing && existing.length > 0) {
            return res.status(409).json({ error: 'This agenda is already closed for this date' });
        }

        const { data, error } = await supabase
            .from('agenda_closures')
            .insert([{
                id: crypto.randomUUID(),
                date,
                doctor_id: doctorId || null,
                reason: reason || null,
                created_by: createdBy || null,
                created_at: new Date().toISOString()
            }])
            .select()
            .single();

        if (error) throw error;
        res.status(201).json(data);
    } catch (e) {
        console.error('Error creating agenda closure:', e);
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/agenda-closures/:id', async (req, res) => {
    try {
        const supabase = getSupabase();
        const { error } = await supabase
            .from('agenda_closures')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting agenda closure:', e);
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
