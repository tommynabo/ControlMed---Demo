#!/usr/bin/env node

/**
 * Verificar que los doctores están disponibles en la API
 */

async function verifyDoctors() {
    try {
        console.log('🔍 Verificando disponibilidad de doctores en API...\n');
        
        const response = await fetch('http://localhost:3001/api/doctors');
        const doctors = await response.json();
        
        console.log(`✅ Doctores disponibles en la API: ${doctors.length}\n`);
        
        if (doctors.length > 0) {
            console.log('Primeros 5 doctores:');
            doctors.slice(0, 5).forEach((doc, i) => {
                console.log(`  ${i + 1}. ${doc.name} (${doc.specialization})`);
            });
            console.log('...\n');
        }
        
        console.log('✅ ¡Los doctores están listos para usar en la aplicación!\n');
        
    } catch (error) {
        console.error('⚠️  No se pudo conectar al servidor.');
        console.error('   Inicia el servidor con: cd server && npm start\n');
    }
}

verifyDoctors();
