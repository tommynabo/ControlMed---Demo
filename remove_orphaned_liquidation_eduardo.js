#!/usr/bin/env node
/**
 * Script to remove orphaned liquidation for Eduardo Dimas's appointment
 * Usage: node remove_orphaned_liquidation_eduardo.js
 */

const { prisma } = require('./server/lib/db');

async function main() {
    try {
        console.log('🔍 PASO 1: Buscando liquidación huérfana para Eduardo Dimas...\n');

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
            include: { patient: true, doctor: true }
        });

        if (!appointment) {
            console.log('❌ No se encontró cita para Eduardo Dimas el 21/04/2026 a las 10:00');
            return;
        }

        console.log('✅ Cita encontrada:');
        console.log(`   - ID: ${appointment.id}`);
        console.log(`   - Paciente: ${appointment.patient.name}`);
        console.log(`   - Fecha: ${appointment.date}`);
        console.log(`   - Hora: ${appointment.time}`);
        console.log(`   - Pagada: ${appointment.paid}\n`);

        // Find liquidation for this appointment
        const liquidation = await prisma.liquidation.findFirst({
            where: { appointmentId: appointment.id }
        });

        if (!liquidation) {
            console.log('ℹ️  No hay liquidación para esta cita (ya fue eliminada o nunca existió)');
            return;
        }

        console.log('⚠️  LIQUIDACIÓN HUÉRFANA ENCONTRADA:');
        console.log(`   - ID: ${liquidation.id}`);
        console.log(`   - appointmentId: ${liquidation.appointmentId}`);
        console.log(`   - doctorId: ${liquidation.doctorId}`);
        console.log(`   - Monto: €${liquidation.grossAmount}`);
        console.log(`   - Estado: ${liquidation.status}`);
        console.log(`   - Creada: ${liquidation.createdAt}\n`);

        // Verify no active invoice is linked to this appointment
        const activeInvoice = await prisma.invoice.findFirst({
            where: {
                appointmentId: appointment.id,
                status: { notIn: ['CANCELLED', 'cancelled'] }
            }
        });

        if (activeInvoice) {
            console.log(`❌ ABORT: Hay una factura activa vinculada a esta cita (${activeInvoice.invoiceNumber})`);
            console.log('   No se eliminará la liquidación para proteger datos consistentes');
            return;
        }

        console.log('✅ Verificación: No hay factura activa vinculada\n');

        // Delete the orphaned liquidation
        console.log('🗑️  PASO 2: Eliminando liquidación huérfana...\n');
        const deleted = await prisma.liquidation.delete({
            where: { id: liquidation.id }
        });

        console.log('✅ Liquidación eliminada exitosamente:');
        console.log(`   - ID eliminado: ${deleted.id}`);
        console.log(`   - appointmentId: ${deleted.appointmentId}\n`);

        // Verify deletion
        console.log('🔍 PASO 3: Verificando eliminación...\n');
        const remaining = await prisma.liquidation.findFirst({
            where: { appointmentId: appointment.id }
        });

        if (!remaining) {
            console.log('✅ Verificación completada: Liquidación eliminada exitosamente\n');
            console.log('═══════════════════════════════════════════════════════════════');
            console.log('📝 PRÓXIMO PASO: En el CRM, abre la cita de Eduardo Dimas');
            console.log('   - El botón "Cobrar / Pagar" ahora debe estar disponible');
            console.log('   - Intenta procesar el cobro nuevamente');
            console.log('   - El sistema creará una nueva liquidación sin errores');
            console.log('═══════════════════════════════════════════════════════════════\n');
        } else {
            console.log('❌ ERROR: La liquidación aún existe después de intentar eliminarla');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.code === 'P2025') {
            console.log('\n⚠️  Nota: El registro puede haber sido eliminado por otra sesión');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main();
