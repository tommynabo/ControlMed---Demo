#!/usr/bin/env node
/**
 * Verify that Eduardo Dimas's appointment is ready for payment processing
 * Usage: node verify_eduardo_payment_ready.js
 */

const { prisma } = require('./server/lib/db');

async function main() {
    try {
        console.log('🔍 Verificando estado de la cita de Eduardo Dimas...\n');

        // Find Eduardo Dimas's appointment
        const appointment = await prisma.appointment.findFirst({
            where: {
                date: new Date('2026-04-21'),
                time: '10:00',
                patient: {
                    name: {
                        contains: 'Eduardo',
                        mode: 'insensitive'
                    }
                },
                deleted_at: null
            },
            include: { 
                patient: true, 
                doctor: true,
                treatment: true
            }
        });

        if (!appointment) {
            console.log('❌ No se encontró cita para Eduardo Dimas');
            return;
        }

        console.log('✅ CITA ENCONTRADA:');
        console.log(`   - ID: ${appointment.id}`);
        console.log(`   - Paciente: ${appointment.patient.name}`);
        console.log(`   - Doctor: ${appointment.doctor?.name || 'Sin asignar'}`);
        console.log(`   - Fecha: ${appointment.date.toLocaleDateString('es-ES')}`);
        console.log(`   - Hora: ${appointment.time}`);
        console.log(`   - Tratamiento: ${appointment.treatmentName || 'No especificado'}`);
        console.log(`   - Monto: €${appointment.amount || '0'}`);
        console.log(`   - Pagada: ${appointment.paid ? '✅ SÍ' : '❌ NO (LISTA PARA COBRO)}'}`);
        console.log(`   - Estado: ${appointment.status}\n`);

        // Check for orphaned liquidation
        const liquidation = await prisma.liquidation.findFirst({
            where: { appointmentId: appointment.id }
        });

        if (liquidation) {
            console.log(`⚠️  ADVERTENCIA: Aún existe una liquidación para esta cita:`);
            console.log(`   - Liquidation ID: ${liquidation.id}`);
            console.log(`   - Estado: ${liquidation.status}\n`);
            return;
        }

        console.log('✅ NO hay liquidación huérfana (eliminada exitosamente)\n');

        // Check for related invoices
        const invoices = await prisma.invoice.findMany({
            where: { appointmentId: appointment.id }
        });

        console.log(`📄 Facturas relacionadas: ${invoices.length}`);
        invoices.forEach(inv => {
            console.log(`   - ${inv.invoiceNumber} (${inv.status})`);
        });
        console.log();

        // Check patient wallet
        const patient = await prisma.patient.findUnique({
            where: { id: appointment.patientId }
        });

        console.log(`💰 Información del paciente:`);
        console.log(`   - Nombre: ${patient.name}`);
        console.log(`   - Número de Historia: ${patient.historyNumber || 'No asignado'}`);
        console.log(`   - Saldo en monedero: €${patient.wallet || 0}`);
        console.log(`   - Email: ${patient.email || 'No disponible'}\n`);

        console.log('═══════════════════════════════════════════════════════════════');
        console.log('✅ ESTADO: Listo para procesar el cobro');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n📝 PRÓXIMOS PASOS:');
        console.log('   1. Abre el CRM en el navegador');
        console.log('   2. Ve a la Agenda (vista diaria de Dra. Concejero)');
        console.log('   3. Haz clic en la cita de Eduardo Dimas (10:00)');
        console.log('   4. Verifica que el número de historia aparezca (HC-XXXX EDUARDO...)');
        console.log('   5. Intenta procesar el cobro con el botón "Cobrar / Pagar"');
        console.log('   6. El sistema debe crear una liquidación sin errores\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
