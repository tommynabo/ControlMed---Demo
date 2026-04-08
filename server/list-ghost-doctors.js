const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const docs = await prisma.doctor.findMany({
    select: {
      id: true,
      name: true,
      users: { select: { id: true, name: true, isActive: true, isDoctor: true, role: true } }
    }
  });

  const standalone = docs.filter(d => d.users.length === 0);
  const inactiveLinked = docs.filter(d =>
    d.users.length > 0 &&
    !d.users.some(u => u.isActive && (u.isDoctor || u.role === 'DOCTOR'))
  );

  console.log('=== STANDALONE DOCTORS (no linked user) ===');
  standalone.forEach(d => console.log(JSON.stringify(d)));

  console.log('\n=== DOCTORS WITH INACTIVE/NON-DOCTOR USERS ===');
  inactiveLinked.forEach(d => console.log(JSON.stringify(d)));

  console.log('\n=== ALL GHOST DOCTORS TO DELETE ===');
  [...standalone, ...inactiveLinked].forEach(d => console.log(`  ID: ${d.id}  NAME: ${d.name}`));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
