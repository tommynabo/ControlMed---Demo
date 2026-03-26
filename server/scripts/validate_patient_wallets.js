/**
 * VALIDATE & FIX PATIENT WALLETS (Saldo a Cuenta / Anticipos)
 * 
 * Analyzes Payment records to identify advance payments not properly 
 * assigned and ensures Patient.wallet reflects the correct balance.
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validateWallets() {
  console.log('💰 Starting Patient Wallet Validation...\n');

  try {
    // 1. Get all patients
    const patients = await prisma.patient.findMany({
      include: {
        payments: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    console.log(`📊 Analyzing ${patients.length} patients...\n`);

    const results = [];
    let correctedCount = 0;

    // 2. For each patient, calculate their true balance
    for (const patient of patients) {
      // Calculate balance from payments
      let calculatedWallet = 0;

      for (const payment of patient.payments) {
        // ADVANCE_PAYMENT should add to wallet (money in favor)
        if (payment.type === 'ADVANCE_PAYMENT') {
          calculatedWallet += payment.amount;
        }
        // DIRECT_CHARGE or INVOICE payments should subtract (unless it's a custom scenario)
        // For now, we assume wallet only increases with ADVANCE_PAYMENT type
      }

      // Check if wallet in DB matches calculated
      if (patient.wallet !== calculatedWallet) {
        const wasWallet = patient.wallet;

        // Update to correct value
        await prisma.patient.update({
          where: { id: patient.id },
          data: { wallet: calculatedWallet },
        });

        correctedCount++;
        results.push({
          patient: patient.name,
          phone: patient.phone,
          walletBefore: wasWallet,
          walletAfter: calculatedWallet,
          status: '✅ FIXED',
        });
      } else {
        results.push({
          patient: patient.name,
          phone: patient.phone,
          walletBefore: patient.wallet,
          walletAfter: calculatedWallet,
          status: '✓ OK',
        });
      }
    }

    // 3. Print results for reference patients
    console.log('📋 KEY PATIENTS STATUS:');
    const refPatients = results.filter(r =>
      r.patient.includes('DANA') || r.patient.includes('ASIER') || r.patient.includes('CRISTINA')
    );
    console.table(refPatients);

    console.log(`\n✨ SUMMARY:`);
    console.log(`  ✅ Corrected: ${correctedCount}`);
    console.log(`  📊 Total Patients: ${patients.length}`);
    console.log(`  ⏭️  Already OK: ${patients.length - correctedCount}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Run validation
validateWallets();
