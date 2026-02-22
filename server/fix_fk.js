const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    try {
        // Drop the problematic constraint
        await prisma.$executeRawUnsafe(`
      ALTER TABLE public.doctor_schedules 
      DROP CONSTRAINT IF EXISTS doctor_schedules_doctor_id_fkey;
    `);

        // Add the correct constraint pointing to system_users
        await prisma.$executeRawUnsafe(`
      ALTER TABLE public.doctor_schedules 
      ADD CONSTRAINT doctor_schedules_doctor_id_fkey 
      FOREIGN KEY (doctor_id) REFERENCES public.system_users(id) ON DELETE CASCADE;
    `);

        console.log("Successfully updated doctor_schedules foreign key!");
    } catch (err) {
        console.error("Error updating constraint:", err.message);
    } finally {
        await prisma.$disconnect();
    }
}

run();
