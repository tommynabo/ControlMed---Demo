// ============================================================================
// CLEANUP: Fix Doctor-User Sync Issues
// ============================================================================
// Purpose:
//   1. Sync User.name → Doctor.name for mismatched pairs
//   2. Reassign Appointments & DoctorSchedules off orphaned Doctor records
//      to the correct active Doctor (matched by name)
//   3. Delete orphaned Doctor records with no remaining references
//
// Usage:  node scripts/fix_doctor_sync.js           (DRY RUN — no changes)
//         node scripts/fix_doctor_sync.js --apply   (APPLY changes to DB)
//
// Always run without --apply first to review what will change.
// ============================================================================

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ log: [] });
const DRY_RUN = !process.argv.includes('--apply');

if (DRY_RUN) {
    console.log('🔍 MODO DRY RUN — solo muestra cambios, no modifica nada.');
    console.log('   Para aplicar cambios: node scripts/fix_doctor_sync.js --apply\n');
} else {
    console.log('⚠️  MODO APPLY — SE MODIFICARÁ LA BASE DE DATOS\n');
}

async function main() {
    // ─── Load all data ────────────────────────────────────────────────────────
    const allDoctors = await prisma.doctor.findMany({
        select: {
            id: true, name: true,
            users: { select: { id: true, name: true, isDoctor: true, role: true, isActive: true } },
            _count: { select: { appointments: true, schedules: true } }
        }
    });

    const doctorUsers = await prisma.user.findMany({
        where: { OR: [{ isDoctor: true }, { role: 'DOCTOR' }] },
        select: { id: true, name: true, isDoctor: true, role: true, isActive: true, doctorId: true }
    });

    // ─── STEP 1: Sync names (User.name → Doctor.name) ─────────────────────────
    console.log('=== PASO 1: Sincronizar nombres (User → Doctor) ===');
    let nameSyncCount = 0;

    for (const user of doctorUsers) {
        const targetDoctorId = user.doctorId || user.id;
        const doctor = allDoctors.find(d => d.id === targetDoctorId);
        if (!doctor) continue;
        if (doctor.name === user.name) continue;

        console.log(`  • Actualizar Doctor "${doctor.name}" → "${user.name}" (id: ${doctor.id})`);
        nameSyncCount++;

        if (!DRY_RUN) {
            await prisma.doctor.update({
                where: { id: doctor.id },
                data: { name: user.name }
            });
        }
    }

    if (nameSyncCount === 0) console.log('  ✅ No hay diferencias de nombre.');
    else if (DRY_RUN) console.log(`  → ${nameSyncCount} cambio(s) pendiente(s) (dry run).`);
    else console.log(`  ✅ ${nameSyncCount} nombre(s) sincronizado(s).`);
    console.log();

    // ─── STEP 2: Handle orphaned Doctors ──────────────────────────────────────
    console.log('=== PASO 2: Doctores huérfanos (sin Usuario vinculado) ===');
    const orphaned = allDoctors.filter(d => d.users.length === 0);

    if (orphaned.length === 0) {
        console.log('  ✅ No hay doctores huérfanos.');
    } else {
        for (const orphan of orphaned) {
            console.log(`\n  • Doctor huérfano: "${orphan.name}" (id: ${orphan.id})`);
            console.log(`    Citas: ${orphan._count.appointments} | Horarios: ${orphan._count.schedules}`);

            // Try to find an active Doctor with a similar name to transfer references.
            // Strips honorifics and checks if any meaningful word matches.
            const HONORIFICS = new Set(['dr', 'dra', 'dr.', 'dra.', 'doctor', 'doctora']);
            const meaningfulWords = (name) =>
                name.trim().toLowerCase().split(/\s+/).filter(w => !HONORIFICS.has(w) && w.length > 2);

            const orphanWords = meaningfulWords(orphan.name);
            const replacement = allDoctors.find(d =>
                d.id !== orphan.id &&
                d.users.length > 0 &&
                d.users.some(u => u.isActive) &&
                meaningfulWords(d.name).some(w => orphanWords.includes(w))
            );

            if (orphan._count.appointments === 0 && orphan._count.schedules === 0) {
                console.log(`    → Sin referencias. Se eliminará.`);
                if (!DRY_RUN) {
                    await prisma.doctor.delete({ where: { id: orphan.id } });
                    console.log(`    ✅ Eliminado.`);
                }
            } else if (replacement) {
                console.log(`    → Reasignar referencias a: "${replacement.name}" (id: ${replacement.id})`);
                if (!DRY_RUN) {
                    if (orphan._count.appointments > 0) {
                        await prisma.appointment.updateMany({
                            where: { doctorId: orphan.id },
                            data: { doctorId: replacement.id }
                        });
                        console.log(`    ✅ ${orphan._count.appointments} cita(s) reasignada(s).`);
                    }
                    if (orphan._count.schedules > 0) {
                        await prisma.doctorSchedule.updateMany({
                            where: { doctorId: orphan.id },
                            data: { doctorId: replacement.id, doctorName: replacement.name }
                        });
                        console.log(`    ✅ ${orphan._count.schedules} horario(s) reasignado(s).`);
                    }
                    await prisma.doctor.delete({ where: { id: orphan.id } });
                    console.log(`    ✅ Doctor huérfano eliminado.`);
                }
            } else {
                console.log(`    ⚠️  Tiene referencias pero NO se encontró reemplazo por nombre.`);
                console.log(`    → El registro Doctor se conserva (necesario para FK de citas históricas).`);
                if (orphan._count.schedules > 0) {
                    console.log(`    → Se eliminarán ${orphan._count.schedules} horario(s) huérfano(s).`);
                    if (!DRY_RUN) {
                        await prisma.doctorSchedule.deleteMany({ where: { doctorId: orphan.id } });
                        console.log(`    ✅ Horario(s) eliminado(s).`);
                    }
                }
            }
        }
    }
    console.log();

    // ─── STEP 3: Create missing Doctor records for active doctor-users ────────
    console.log('=== PASO 3: Crear registros Doctor faltantes ===');
    let createdCount = 0;

    for (const user of doctorUsers) {
        if (!user.isActive) continue;
        const targetId = user.doctorId || user.id;
        const exists = allDoctors.find(d => d.id === targetId);
        if (exists) continue;

        console.log(`  • Crear Doctor para: "${user.name}" (id: ${targetId})`);
        createdCount++;

        if (!DRY_RUN) {
            await prisma.$transaction(async (tx) => {
                await tx.doctor.create({
                    data: { id: targetId, name: user.name, specialization: 'Odontólogo', commissionPercentage: 0 }
                });
                if (!user.doctorId) {
                    await tx.user.update({ where: { id: user.id }, data: { doctorId: targetId } });
                }
            });
            console.log(`    ✅ Creado y vinculado.`);
        }
    }

    if (createdCount === 0) console.log('  ✅ No faltan registros Doctor.');
    else if (DRY_RUN) console.log(`  → ${createdCount} registro(s) a crear (dry run).`);
    console.log();

    console.log('=== FIN ===');
    if (DRY_RUN) {
        console.log('\nNingún cambio aplicado. Para aplicar:');
        console.log('  node scripts/fix_doctor_sync.js --apply\n');
    } else {
        console.log('\n✅ Todos los cambios aplicados.\n');
    }
}

main()
    .catch(e => { console.error('Error:', e.message); process.exit(1); })
    .finally(() => prisma.$disconnect());
