#!/usr/bin/env node

/**
 * Verificador en TIEMPO REAL de duplicados
 * Ejecutar: node check_duplicates_now.js
 */

import * as dotenv from "dotenv";
dotenv.config();

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkDuplicates() {
    console.log("🔍 Verificando duplicados EN TIEMPO REAL...\n");

    try {
        // 1. Obtener TODOS los appointments para el 2026-04-20
        const { data: appointments, error } = await supabase
            .from("Appointment")
            .select("id, doctorId, patientId, date, startTime")
            .eq("date", "2026-04-20");

        if (error) {
            console.error("❌ Error fetching appointments:", error);
            return;
        }

        console.log(`📊 Total de appointments el 2026-04-20: ${appointments.length}\n`);

        // 2. Agrupar por (doctorId, patientId, startTime)
        const groups = {};
        appointments.forEach((apt) => {
            const key = `${apt.doctorId}|${apt.patientId}|${apt.startTime}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(apt.id);
        });

        // 3. Mostrar duplicados
        let duplicateCount = 0;
        console.log("📋 Verificación de duplicados:\n");
        
        Object.entries(groups).forEach(([key, ids]) => {
            if (ids.length > 1) {
                const [doctorId, patientId, time] = key.split("|");
                console.log(`  ⚠️  DUPLICADO ENCONTRADO:`);
                console.log(`     Doctor: ${doctorId}, Paciente: ${patientId}, Hora: ${time}`);
                console.log(`     IDs duplicados: ${ids.join(", ")}`);
                console.log(`     Total copias: ${ids.length}\n`);
                duplicateCount += ids.length - 1;
            }
        });

        if (duplicateCount === 0) {
            console.log("✅ ¡SIN DUPLICADOS ENCONTRADOS!\n");
        } else {
            console.log(
                `\n❌ DUPLICADOS ENCONTRADOS: ${duplicateCount} copias extra (${duplicateCount + Object.values(groups).filter(x => x.length > 1).length} registros totales)`
            );
        }

        // 4. Listar appointments sin duplicados
        console.log("\n📝 Lista de citas ÚNICAS:\n");
        let i = 1;
        Object.entries(groups).forEach(([key, ids]) => {
            const [doctorId, patientId, time] = key.split("|");
            console.log(`  ${i}. Doctor: ${doctorId}, Paciente: ${patientId}, Hora: ${time}`);
            i++;
        });

        console.log(`\n✅ Total de citas ÚNICAS: ${Object.keys(groups).length}`);

        // 5. Query general para ver estado de TODA la tabla
        const { data: allAppointments } = await supabase
            .from("Appointment")
            .select("id")
            .limit(1000);

        console.log(`\n📊 Estado general de la tabla Appointment:`);
        console.log(`   Total de registros: ${allAppointments.length}`);
        
    } catch (e) {
        console.error("❌ Error:", e.message);
    }
}

checkDuplicates();
