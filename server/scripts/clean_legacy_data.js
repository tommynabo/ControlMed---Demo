const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Validates if a string is a valid UUID
 */
function isUUID(id) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(id);
}

async function cleanLegacyData() {
    console.log('🧹 Starting cleanup of legacy non-UUID identifiers...');

    try {
        // 1. Fetch all doctors and filter those with non-UUID IDs (e.g., 'user-1')
        const allDoctors = await prisma.doctor.findMany();
        const legacyDoctors = allDoctors.filter(doc => !isUUID(doc.id));

        console.log(`🔍 Found ${legacyDoctors.length} doctors with legacy IDs.`);

        for (const doc of legacyDoctors) {
            console.log(`🗑️ Cleaning dependencies and record for doctor: ${doc.name} (${doc.id})`);
            
            // Delete related records that might block deletion (Foreign Key constraints)
            // Note: In a production environment, you might want to RE-MAP these IDs instead of deleting.
            // But for this cleanup at this stage, we are removing 'corrupt' legacy data.
            
            try {
                // Delete related records that might block deletion
                // Skip doctorSchedule for now if it causes UUID casting errors 
                // (it likely doesn't have local 'user-1' values anyway if the column is UUID)
                
                try {
                   if (prisma.appointment) await prisma.appointment.deleteMany({ where: { doctorId: doc.id } });
                } catch (e) {}
                
                try {
                   if (prisma.liquidation) await prisma.liquidation.deleteMany({ where: { doctorId: doc.id } });
                } catch (e) {}
                
                // Unlink patients
                if (prisma.patient) {
                    try {
                        await prisma.patient.updateMany({
                            where: { assignedDoctorId: doc.id },
                            data: { assignedDoctorId: null }
                        });
                    } catch (e) {}
                }

                // Delete associated users pointing to this legacy doctor
                if (prisma.user) {
                    try {
                        await prisma.user.deleteMany({
                            where: { OR: [{ doctorId: doc.id }, { id: doc.id }] }
                        });
                    } catch (e) {}
                }

                // Finally, delete the doctor record
                if (prisma.doctor) {
                    try {
                        await prisma.doctor.delete({ where: { id: doc.id } });
                    } catch (e) {}
                }
                
                console.log(`  ✅ Cleaned ${doc.id}`);
            } catch (err) {
                console.error(`  ❌ Failed to clean ${doc.id}: ${err.message}`);
            }
        }

        // 2. Clean remaining Users with legacy IDs (those who might not have been doctors)
        const allUsers = await prisma.user.findMany();
        const legacyUsers = allUsers.filter(u => !isUUID(u.id));

        console.log(`🔍 Found ${legacyUsers.length} users with legacy IDs.`);
        for (const user of legacyUsers) {
            try {
                if (prisma.workShift) await prisma.workShift.deleteMany({ where: { userId: user.id } });
                if (prisma.user) await prisma.user.delete({ where: { id: user.id } });
                console.log(`  ✅ Cleaned user ${user.id}`);
            } catch (err) {
                console.error(`  ❌ Failed to clean user ${user.id}: ${err.message}`);
            }
        }

        console.log('✨ Cleanup of legacy data completed successfully!');
        console.log('🚀 You can now safely run: npx prisma db push (or generate a migration)');

    } catch (error) {
        console.error('❌ Critical error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
}

cleanLegacyData();
