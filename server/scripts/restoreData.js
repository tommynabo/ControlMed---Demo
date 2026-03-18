const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const crypto = require('crypto');

const prisma = new PrismaClient();

// Paths
const CUSTOM_CSV_PATH = process.argv[2] ? path.resolve(process.argv[2]) : null;
const ASSETS_PATH = CUSTOM_CSV_PATH || path.join(__dirname, '../../assets');
const ROOT_PATH = path.join(__dirname, '../../');

if (CUSTOM_CSV_PATH && !fs.existsSync(CUSTOM_CSV_PATH)) {
    console.error(`ERROR: La carpeta especificada no existe: ${CUSTOM_CSV_PATH}`);
    process.exit(1);
}

// Maps to keep track of new IDs
const idMap = {
    specialties: new Map(), // name -> id
    doctors: new Map(),     // name or email -> id
    users: new Map(),       // email -> id
    patients: new Map(),    // oldID -> id
    treatments: new Map()   // name -> id
};

// Helper to read CSV with specific separator
async function readCsv(filePath, separator = ';') {
    return new Promise((resolve, reject) => {
        const results = [];
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ Archivo no encontrado: ${filePath}`);
            return resolve([]);
        }
        // Use utf8 to avoid encoding issues
        fs.createReadStream(filePath, { encoding: 'utf8' })
            .pipe(csv({ separator }))
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
}

// Clean price strings
function parsePrice(priceStr) {
    if (!priceStr) return 0;
    const clean = priceStr.toString().replace('€', '').replace(/\s/g, '').replace(',', '.');
    return parseFloat(clean) || 0;
}

// Clean date strings
function parseDate(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length === 3) {
        // Handle DD/MM/YYYY or YYYY-MM-DD
        if (parts[0].length === 4) return new Date(dateStr);
        return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
    }
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
}

async function restoreData() {
    try {
        console.log('🚀 Iniciando restauración de datos...');

        // 1. ESPECIALIDADES
        console.log('📦 Especialidades...');
        const specsCsv = await readCsv(path.join(ASSETS_PATH, 'especialidades.csv'), ','); 
        const uniqueSpecs = new Set(['General', 'Ortodoncia', 'Implantes', 'Estética', 'Periodoncia', 'Endodoncia', 'Odontopediatría', 'Cirugía Oral']);
        specsCsv.forEach(row => { 
            const s = row.Especialidad || row.especialidad;
            if (s) uniqueSpecs.add(s); 
        });

        for (const specName of uniqueSpecs) {
            const spec = await prisma.specialty.upsert({
                where: { name: specName },
                update: {},
                create: { name: specName }
            });
            idMap.specialties.set(specName, spec.id);
        }

        // 2. DOCTORES Y USUARIOS
        console.log('👥 Usuarios y Doctores...');
        const usersCsv = await readCsv(path.join(ASSETS_PATH, 'Listado_de_usuarios_avanzado.csv'), ';');
        for (const row of usersCsv) {
            const email = row.USUARIO || row.email || row.Email;
            const fullName = row.NOMBRE || row.nombre || row.Nombre;
            const roleStr = row.ROL || row.rol || row.Rol;
            const estado = row.ESTADO || row.estado || row.Estado;
            
            if (!email || !fullName) continue;

            const roleMap = { 'Administrador': 'ADMIN', 'Recepcionista': 'RECEPTION', 'Usuario': 'DOCTOR' };
            const role = roleMap[roleStr] || 'DOCTOR';
            const isActive = estado === 'Alta' || estado === 'Activo';
            
            let doctorId = null;
            if (role === 'DOCTOR' || fullName.includes('Dr.') || fullName.includes('Dra.')) {
                let doc = await prisma.doctor.findFirst({ where: { name: fullName } });
                if (!doc) {
                    doc = await prisma.doctor.create({
                        data: {
                            name: fullName,
                            specialization: 'Odontólogo'
                        }
                    });
                }
                doctorId = doc.id;
                idMap.doctors.set(fullName, doc.id);
                idMap.doctors.set(email, doc.id);
            }

            await prisma.user.upsert({
                where: { email },
                update: { role, doctorId, name: fullName, isActive },
                create: {
                    email,
                    password: '123', 
                    name: fullName,
                    role,
                    doctorId,
                    isActive
                }
            });
        }

        // 3. TRATAMIENTOS
        console.log('🩺 Tratamientos...');
        const treatmentsCsv = await readCsv(path.join(ASSETS_PATH, 'tratamientos.csv'), ';');
        for (const row of treatmentsCsv) {
            const name = row.Servicio || row.servicio;
            const price = parsePrice(row.Importe || row.importe);
            const specName = row.Especialidad || row.especialidad;

            if (!name) continue;

            const t = await prisma.treatment.create({
                data: {
                    name,
                    price,
                    specialtyId: idMap.specialties.get(specName) || null
                }
            });
            idMap.treatments.set(name, t.id);
        }

        // 4. PACIENTES
        console.log('👤 Pacientes...');
        const patientsCsv = await readCsv(path.join(ROOT_PATH, 'patients.csv'), ';');
        for (const row of patientsCsv) {
            const oldId = row.IDCONTACTO;
            const firstName = row.NOMBRE;
            const lastName = row.APELLIDOS;
            const dni = row.DNI;
            const email = row.EMAIL || `pac_${oldId}@notfound.com`;
            const phone = row['TELF. MOVIL'];
            const docName = row.USUARIO;

            if (!firstName || !dni) continue;

            try {
                const bDatePart = row['F. NACIMIENTO'];
                const p = await prisma.patient.create({
                    data: {
                        historyNumber: oldId,
                        name: `${firstName} ${lastName}`.trim(),
                        firstName,
                        lastName1: lastName,
                        dni,
                        email,
                        phone,
                        birthDate: parseDate(bDatePart) || new Date('2000-01-01'),
                        assignedDoctorId: idMap.doctors.get(docName) || null
                    }
                });
                idMap.patients.set(oldId, p.id);
            } catch (err) { /* ignore duplicates */ }
        }

        // 5. CITAS
        console.log('📅 Citas...');
        const appointmentsCsv = await readCsv(path.join(ASSETS_PATH, 'citas.csv'), ';');
        for (const row of appointmentsCsv) {
            const keys = Object.keys(row);
            const dateStr = row[keys[0]];
            const timeStr = row[keys[1]];
            const statusStr = row[keys[4]]; 
            const treatmentName = row[keys[8]];
            const docNameCSV = row[keys[9]];
            const oldPatientId = row[keys[13]];

            const patientId = idMap.patients.get(oldPatientId);
            if (!patientId) continue;

            let doctorId = null;
            if (docNameCSV) {
                const cleanDoc = docNameCSV.toLowerCase().replace('dr. ', '').replace('dra. ', '').trim();
                for (let [name, id] of idMap.doctors) {
                    if (name.toLowerCase().includes(cleanDoc)) {
                        doctorId = id;
                        break;
                    }
                }
            }
            if (!doctorId) doctorId = Array.from(idMap.doctors.values())[0];

            try {
                await prisma.appointment.create({
                    data: {
                        date: new Date(dateStr),
                        time: timeStr ? timeStr.slice(0, 5) : '09:00',
                        status: statusStr === 'Realizada' ? 'COMPLETED' : 'Scheduled',
                        patientId,
                        doctorId: doctorId || undefined,
                        treatmentId: idMap.treatments.get(treatmentName) || null,
                        treatmentName: treatmentName
                    }
                });
            } catch (err) {}
        }

        console.log('✅ Restauración completada.');
    } catch (e) {
        console.error('❌ Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

restoreData();
