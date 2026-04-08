const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Delete only ghost Doctor records that have 0 appointments
// Dra. Blathra (18 appointments) is kept — she is a real doctor
const GHOST_DOCTOR_IDS = [
  '6c1c4982-70e6-472c-880f-6550c3945c4d', // Prueba medico (0 appointments)
  'f4f54750-c691-43ae-9f58-15092e184035', // Francisca (0 appointments)
  '67a42820-5bb2-4376-9ce6-c0dfa8d8d8cf', // Laura (0 appointments)
  '960643e6-193b-4766-89c6-9c1224d6f886', // Leticia Rodriguez Silvera (0 appointments)
];

async function main() {
  for (const id of GHOST_DOCTOR_IDS) {
    const doc = await prisma.doctor.findUnique({ where: { id }, select: { name: true } });
    if (!doc) { console.log(`Doctor ${id} not found, skipping`); continue; }

    // Delete schedules first (FK constraint)
    const delSchedules = await prisma.doctorSchedule.deleteMany({ where: { doctorId: id } });
    // Delete the doctor
    await prisma.doctor.delete({ where: { id } });
    console.log(`✅ Deleted ghost doctor: "${doc.name}" (${delSchedules.count} schedules removed)`);
  }
  console.log('\nDone. Remaining standalone doctors are all legitimate.');
}

main().catch(e => console.error('❌ Error:', e)).finally(() => prisma.$disconnect());
