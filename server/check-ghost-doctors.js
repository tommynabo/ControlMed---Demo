const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ghostIds = [
    '6c1c4982-70e6-472c-880f-6550c3945c4d', // Prueba medico
    'f4f54750-c691-43ae-9f58-15092e184035', // Francisca
    'f4f25ebe-e2c0-49d8-bfd2-f3bd890656f7', // Dra. Blathra
    '67a42820-5bb2-4376-9ce6-c0dfa8d8d8cf', // Laura
    '960643e6-193b-4766-89c6-9c1224d6f886', // Leticia Rodriguez Silvera
  ];

  for (const id of ghostIds) {
    const appts = await prisma.appointment.count({ where: { doctorId: id } });
    const scheds = await prisma.doctorSchedule.count({ where: { doctorId: id } });
    const doc = await prisma.doctor.findUnique({ where: { id }, select: { name: true } });
    console.log(`${doc.name}: appointments=${appts}, schedules=${scheds}`);
  }
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
