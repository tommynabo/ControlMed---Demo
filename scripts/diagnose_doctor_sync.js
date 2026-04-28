// ============================================================================
// DIAGNOSTIC: Doctor-User Sync Issues
// ============================================================================
// Purpose: Identify orphaned Doctor records, name mismatches, and duplicates
// Usage:   node scripts/diagnose_doctor_sync.js   (from /server directory)
// ============================================================================

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
    console.log('=== DIAGNÓSTICO: Sincronización Doctores-Usuarios ===\n');

    // ─── 1. All Doctors + their linked Users ──────────────────────────────────
    const allDoctors = await prisma.doctor.findMany({
        orderBy: { name: 'asc' },
        select: {
            id: true,
            name: true,
            users: { select: { id: true, name: true, isDoctor: true, role: true, isActive: true } },
            _count: { select: { appointments: true, schedules: true } }
        }
    });

    // ─── 2. All active doctor-flagged Users ───────────────────────────────────
    const doctorUsers = await prisma.user.findMany({
        where: { OR: [{ isDoctor: true }, { role: 'DOCTOR' }] },
        select: { id: true, name: true, isDoctor: true, role: true, isActive: true, doctorId: true }
    });

    console.log(`Usuarios con isDoctor/role=DOCTOR: ${doctorUsers.length}`);
    console.log(`Registros Doctor en tabla Doctor:  ${allDoctors.length}\n`);

    // ─── 3. Orphaned Doctors (no linked User) ─────────────────────────────────
    const orphaned = allDoctors.filter(d => d.users.length === 0);
    if (orphaned.length > 0) {
        console.log(`⚠️  DOCTORES HUÉRFANOS (sin Usuario vinculado): ${orphaned.length}`);
        orphaned.forEach(d => {
            console.log(`   • "${d.name}" (id: ${d.id})`);
            console.log(`     → Citas: ${d._count.appointments} | Horarios: ${d._count.schedules}`);
        });
    } else {
        console.log('✅ No hay doctores huérfanos.');
    }
    console.log();

    // ─── 4. Name mismatches (User.name ≠ Doctor.name) ────────────────────────
    const mismatches = [];
    for (const du of doctorUsers) {
        const targetDoctorId = du.doctorId || du.id;
        const doctor = allDoctors.find(d => d.id === targetDoctorId);
        if (doctor && doctor.name !== du.name) {
            mismatches.push({ user: du, doctor });
        }
    }

    if (mismatches.length > 0) {
        console.log(`⚠️  DIFERENCIAS DE NOMBRE (User.name ≠ Doctor.name): ${mismatches.length}`);
        mismatches.forEach(({ user, doctor }) => {
            console.log(`   • Usuario:  "${user.name}" (id: ${user.id})`);
            console.log(`     Doctor:   "${doctor.name}" (id: ${doctor.id})`);
            console.log(`     → Activo: ${user.isActive} | isDoctor: ${user.isDoctor}`);
        });
    } else {
        console.log('✅ Todos los nombres coinciden entre User y Doctor.');
    }
    console.log();

    // ─── 5. Doctor Users with no Doctor record at all ─────────────────────────
    const missingDoctorRecord = doctorUsers.filter(u => {
        const targetId = u.doctorId || u.id;
        return !allDoctors.find(d => d.id === targetId);
    });

    if (missingDoctorRecord.length > 0) {
        console.log(`⚠️  USUARIOS DOCTOR SIN REGISTRO EN TABLA Doctor: ${missingDoctorRecord.length}`);
        missingDoctorRecord.forEach(u => {
            console.log(`   • "${u.name}" (userId: ${u.id}, doctorId: ${u.doctorId || 'NULL'})`);
        });
    } else {
        console.log('✅ Todos los usuarios doctor tienen su registro en la tabla Doctor.');
    }
    console.log();

    // ─── 6. Users whose doctorId points to wrong/missing Doctor ──────────────
    const badLink = doctorUsers.filter(u => {
        if (!u.doctorId) return false;
        return !allDoctors.find(d => d.id === u.doctorId);
    });

    if (badLink.length > 0) {
        console.log(`⚠️  USUARIOS CON doctorId QUE NO EXISTE: ${badLink.length}`);
        badLink.forEach(u => {
            console.log(`   • "${u.name}" → doctorId: ${u.doctorId} (no encontrado en tabla Doctor)`);
        });
    } else {
        console.log('✅ Todos los doctorId apuntan a registros existentes.');
    }
    console.log();

    // ─── 7. Summary table ─────────────────────────────────────────────────────
    console.log('=== RESUMEN COMPLETO DE DOCTORES ===');
    console.log('Nombre Doctor (tabla Doctor) | Nombre Usuario vinculado | Activo | Citas | Horarios');
    console.log('-'.repeat(100));
    for (const d of allDoctors) {
        const linkedUser = d.users[0];
        const userName = linkedUser ? linkedUser.name : '⚠️  SIN USUARIO';
        const isActive = linkedUser ? (linkedUser.isActive ? 'SÍ' : 'NO') : '—';
        const nameDiff = linkedUser && linkedUser.name !== d.name ? ' ← NOMBRE DIFERENTE' : '';
        console.log(`  "${d.name}" | "${userName}"${nameDiff} | Activo:${isActive} | Citas:${d._count.appointments} | Horarios:${d._count.schedules}`);
    }

    console.log('\n=== FIN DIAGNÓSTICO ===');
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
