/**
 * FIX CLINICAL RECORDS - Auto-assign doctors based on specialization
 * 
 * This script corrects ClinicalRecord entries that have NULL authorId
 * and assigns the correct doctor based on specialty mentioned in the text.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Map of doctor emails to their IDs (from DB)
const DOCTOR_MAP = {
  'castaycaroline@gmail.com': 'ae2daf0b-b524-4b75-a72b-f8cb42e70118', // Dra. Castay
  'kevinchrabieh@gmail.com': '25087aad-d3e0-484d-820d-f146a1ef283a',   // Dr. Kevin
};

// Keywords to identify doctor specialty
const DOCTOR_KEYWORDS = {
  'Castay|castay': 'ae2daf0b-b524-4b75-a72b-f8cb42e70118',
  'Kevin|KEVIN|Chrabieh': '25087aad-d3e0-484d-820d-f146a1ef283a',
};

const SPECIALTY_MAPPING = {
  'ORTODONCIA': 'ae2daf0b-b524-4b75-a72b-f8cb42e70118', // Default to Castay for ortho
  'Odontología': '25087aad-d3e0-484d-820d-f146a1ef283a', // Default to Kevin for dental
  'Periodoncia': '25087aad-d3e0-484d-820d-f146a1ef283a',
};

async function fixClinicalRecords() {
  console.log('🔧 Starting Clinical Records Doctor Assignment Fix...\n');

  try {
    // 1. Find all unassigned records
    const unassignedRecords = await prisma.clinicalRecord.findMany({
      where: { authorId: null },
      include: { patient: true },
      orderBy: { date: 'desc' },
    });

    console.log(`📊 Found ${unassignedRecords.length} unassigned clinical records.\n`);

    if (unassignedRecords.length === 0) {
      console.log('✅ No records to fix.');
      return;
    }

    let fixed = 0;
    let skipped = 0;
    const results = [];

    // 2. Process each record
    for (const record of unassignedRecords) {
      let assignedDoctorId = null;
      let assignReason = 'UNKNOWN';

      // Try to extract doctor from text
      if (record.text) {
        for (const [keywords, doctorId] of Object.entries(DOCTOR_KEYWORDS)) {
          const keywordRegex = new RegExp(keywords, 'i');
          if (keywordRegex.test(record.text)) {
            assignedDoctorId = doctorId;
            assignReason = `FOUND_NAME: ${keywords}`;
            break;
          }
        }
      }

      // Fallback: Extract from specialty
      if (!assignedDoctorId && record.text) {
        const specialtyMatch = record.text.match(/\[ALTA\]:\s*(.*?)(?:\n|\[)/);
        if (specialtyMatch) {
          const specialty = specialtyMatch[1].trim();
          assignedDoctorId = SPECIALTY_MAPPING[specialty];
          assignReason = `SPECIALTY: ${specialty}`;
        }
      }

      // Last resort: If contains "ORTODONCIA", assign Castay
      if (!assignedDoctorId) {
        if (record.text?.includes('ORTODONCIA')) {
          assignedDoctorId = DOCTOR_MAP['castaycaroline@gmail.com'];
          assignReason = 'ORTODONCIA_KEYWORD';
        } else {
          assignReason = 'SKIPPED_NO_MATCH';
          skipped++;
          results.push({
            patientName: record.patient?.name,
            recordDate: record.date,
            reason: assignReason,
            status: '❌',
          });
          continue;
        }
      }

      // Update the record
      await prisma.clinicalRecord.update({
        where: { id: record.id },
        data: { authorId: assignedDoctorId },
      });

      fixed++;
      results.push({
        patientName: record.patient?.name,
        recordDate: record.date,
        reason: assignReason,
        status: '✅',
      });
    }

    // 3. Print results
    console.log('\n📋 RESULTS:');
    console.table(results);

    console.log(`\n✨ SUMMARY:`);
    console.log(`  ✅ Fixed: ${fixed}`);
    console.log(`  ⏭️  Skipped: ${skipped}`);
    console.log(`  📊 Total: ${unassignedRecords.length}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixClinicalRecords();
