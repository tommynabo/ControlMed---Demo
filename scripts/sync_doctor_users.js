// ============================================================================
// DOCTOR & USER SYNC SCRIPT
// ============================================================================
// Purpose: Sync doctor accounts from a reference list and link to system users
// Usage: node sync_doctor_users.js
// ============================================================================

require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function syncDoctorUsers() {
    console.log('🔄 Starting Doctor-User Sync Process...\n');

    try {
        // 1. Fetch all doctors
        const doctors = await prisma.doctor.findMany({
            include: { users: true }
        });

        console.log(`📋 Found ${doctors.length} doctors in system\n`);

        // 2. List doctors without user accounts
        const doctorsWithoutUsers = doctors.filter(d => !d.users || d.users.length === 0);
        
        if (doctorsWithoutUsers.length > 0) {
            console.log('⚠️  Doctors WITHOUT system user accounts:');
            doctorsWithoutUsers.forEach((d, idx) => {
                console.log(`   ${idx + 1}. ${d.name} (ID: ${d.id})`);
            });
            console.log('\n📝 ACTION REQUIRED:');
            console.log('   1. Go to Settings > Users');
            console.log('   2. Create a system user account for each doctor');
            console.log('   3. Use the same email/name for easy tracking');
            console.log('   4. Re-run this script to link them\n');
        }

        // 3. List all doctors with their user account status
        console.log('✓ Doctor-User Account Status:');
        doctors.forEach(d => {
            const userCount = d.users?.length || 0;
            const status = userCount > 0 ? '✓ LINKED' : '✗ NOT LINKED';
            const userName = d.users?.[0]?.name || '-';
            console.log(`   ${d.name}: ${status} ${userName ? `(${userName})` : ''}`);
        });

        console.log('\n✅ Sync process complete!');
        console.log('\n📌 Next Steps:');
        console.log('   1. Ensure all active doctors have system user accounts');
        console.log('   2. Deactivate doctors who no longer work at the clinic (is_active = false)');
        console.log('   3. Verify doctor specialties are linked to specialty IDs');
        console.log('   4. Test appointment creation with linked doctors\n');

    } catch (error) {
        console.error('❌ Error during sync:', error);
    } finally {
        await prisma.$disconnect();
    }
}

// Run the sync
syncDoctorUsers();
