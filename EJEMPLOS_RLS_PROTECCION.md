-- ==============================================================================
-- EJEMPLOS: Datos Protegidos por RLS
-- Cómo funcionará RLS en tu aplicación después de aplicar la solución
-- ==============================================================================

-- ==============================================================================
-- EJEMPLO 1: Un DOCTOR intenta acceder a pacientes
-- ==============================================================================

/*
ESCENARIO: Doctor "Dr. Garcia" (ID: doc-001) intenta listar pacientes

ANTES (Sin RLS - ❌ INSEGURO):
  SELECT * FROM "Patient";
  
  RESULTADO: Ve A TODOS los pacientes de la clínica
  ├─ Su paciente: Juan López
  ├─ Otros doctores: María Martínez  ← ¡VE LO QUE NO DEBE!
  ├─ Otros doctores: Carlos Rodríguez ← ¡VE LO QUE NO DEBE!
  └─ Otros doctores: Ana Fernández    ← ¡VE LO QUE NO DEBE!

DESPUÉS (Con RLS - ✅ SEGURO):
  SELECT * FROM "Patient";
  
  RESULTADO: Ve SOLO sus pacientes
  └─ Su paciente: Juan López
     
  Otros pacientes ← BLOQUEADOS POR RLS
  Otros pacientes ← BLOQUEADOS POR RLS
  Otros pacientes ← BLOQUEADOS POR RLS
*/

-- ==============================================================================
-- EJEMPLO 2: Un usuario intenta ver el campo "password"
-- ==============================================================================

/*
ESCENARIO: Receptionist intenta ver contraseñas

ANTES (Sin RLS - ❌ INSEGURO):
  SELECT id, email, password FROM "User";
  
  RESULTADO: 
  ├─ id: admin-001, email: admin@clinic.com, password: hashed_password_123
  ├─ id: doc-001, email: doctor@clinic.com, password: hashed_password_456
  └─ id: rec-001, email: recep@clinic.com, password: hashed_password_789
  
  ¡TODAS LAS CONTRASEÑAS VISIBLES! (aunque sean hashed)

DESPUÉS (Con RLS - ✅ SEGURO):
  SELECT id, email, password FROM "User";
  
  RESULTADO: 
  - La query es rechazada por RLS
  - El usuario NO VE NADA (ni error)
  - El password nunca se transmite
*/

-- ==============================================================================
-- EJEMPLO 3: Un ADMIN accede a los datos
-- ==============================================================================

/*
ESCENARIO: Admin intenta ver todos los pacientes

ANTES:
  SELECT * FROM "Patient";
  
  RESULTADO: Ve todos ✓ (pero sin protección)

DESPUÉS (Con RLS - ✅ SEGURO):
  SELECT * FROM "Patient";
  
  RESULTADO: Ve todos ✓ (con protección de RLS)
  ├─ Política: "Patient: Admin see all"
  ├─ Condición: is_admin() = true
  └─ Resultado: PERMITIDO
*/

-- ==============================================================================
-- EJEMPLO 4: Ataques que RLS previene
-- ==============================================================================

/*
ATAQUE 1: SQL Injection intenta acceder a datos

SIN RLS:
  SELECT * FROM "User" WHERE id = 'admin-001' OR '1'='1';
  → RESULTADO: Todos los usuarios y sus passwords expuestos ❌

CON RLS:
  SELECT * FROM "User" WHERE id = 'admin-001' OR '1'='1';
  → RESULTADO: Solo se muestran filas permitidas por la política ✅

ATAQUE 2: Acceso directo a la API sin autenticación

CÓDIGO SIN RLS:
  const response = await supabase
    .from('Patient')
    .select('*');
  → RESULTADO: Todos los datos de todos los pacientes ❌

CON RLS:
  const response = await supabase
    .from('Patient')
    .select('*');
  → RESULTADO: Error 403 "Unauthorized" ✅
  → O: Solo los pacientes que el usuario puede ver
*/

-- ==============================================================================
-- EJEMPLO 5: Línea de tiempo de consultas por rol
-- ==============================================================================

/*

┌─────────────────────────────────────────────────────────────────────────────┐
│ CUÁNDO UN DOCTOR CONSULTA "SELECT * FROM Patient"                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ 1. Doctor envía query a Supabase                                            │
│    └─ Query: SELECT * FROM Patient                                          │
│                                                                              │
│ 2. Supabase identifica al usuario                                           │
│    └─ auth.uid() = 'doc-garcia-001'                                         │
│                                                                              │
│ 3. Sistema revisa roles                                                     │
│    └─ Role: DOCTOR (no ADMIN)                                               │
│                                                                              │
│ 4. RLS evalúa las políticas                                                 │
│    ├─ Política 1: "Patient: Admin see all"                                  │
│    │  └─ Condición: is_admin() = true                                       │
│    │  └─ Resultado: FALSE ← NO APLICA                                       │
│    │                                                                         │
│    └─ Política 2: "Patient: Doctor see assigned"                            │
│       └─ Condición: assignedDoctorId = (doctor-garcia-001's doctor id)      │
│       └─ Resultado: TRUE ← APLICA ✓                                         │
│                                                                              │
│ 5. Base de datos filtra resultados                                          │
│    └─ SELECT * FROM Patient WHERE assignedDoctorId = doc-garcia-001's ID    │
│                                                                              │
│ 6. Doctor recibe resultados filtrados                                       │
│    └─ Solo sus pacientes asignados                                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

*/

-- ==============================================================================
-- EJEMPLO 6: Columnas sensibles protegidas
-- ==============================================================================

/*

TABLA: system_users
┌──────────┬──────────────┬──────────────────┬────────────────┬────────────────┐
│ id       │ email        │ full_name        │ bank_account   │ insurance_#    │
├──────────┼──────────────┼──────────────────┼────────────────┼────────────────┤
│ admin-1  │ admin@...    │ Admin User       │ ES1234...5678  │ 123456789      │
│ doc-1    │ doctor@...   │ Dr. García       │ ES9876...5432  │ 987654321      │
│ rec-1    │ recep@...    │ María Garcia     │ ES5555...1111  │ 555555555      │
└──────────┴──────────────┴──────────────────┴────────────────┴────────────────┘

ESCENARIO: Maria (rec-1) intenta ver bank_account

SIN RLS (❌):
  SELECT bank_account FROM system_users;
  
  RESULTADO:
  ├─ Admin: ES1234...5678  ← ¡NO DEBERÍA VER!
  ├─ Doctor: ES9876...5432 ← ¡NO DEBERÍA VER!
  └─ Maria: ES5555...1111  ← PROPIO, OK
  
  RIESGO: María ve cuentas bancarias de otros usuarios ⚠️

CON RLS (✅):
  SELECT bank_account FROM system_users;
  
  RESULTADO:
  RLS Check:
  ├─ Admin policy: REJECTED (María no es admin)
  ├─ "Users update own" policy: REJECTED (no es UPDATE)
  ├─ "Users see own" policy: ACCEPTED (solo su fila)
  
  RESULTADO FINAL: 
  └─ Fila visible: Solo su propia fila con su propia bank_account
  
  Datos de otros ← BLOQUEADOS POR RLS
  Datos de otros ← BLOQUEADOS POR RLS
  
  SEGURO: María solo ve su propio banco_account ✓
*/

-- ==============================================================================
-- EJEMPLO 7: Auditoria de lo que ve cada rol
-- ==============================================================================

/*

┌────────────────────────────────────────────────┐
│           VISIBILIDAD POR ROL                   │
├────────────────────────────────────────────────┤
│                                                │
│ ADMIN (Acceso Total)                           │
│ ├─ Todos los patients    [✓]                   │
│ ├─ Todos los doctors     [✓]                   │
│ ├─ Todas las citas       [✓]                   │
│ ├─ Todas los usuarios    [✓]                   │
│ ├─ Datos financieros     [✓]                   │
│ └─ Campos sensibles      [✓]                   │
│                                                │
│ DOCTOR (Acceso Limitado)                       │
│ ├─ Sus propios pacientes [✓]                   │
│ ├─ Sus propias citas     [✓]                   │
│ ├─ Sus liquidaciones     [✓]                   │
│ ├─ Otros doctores        [✓] (solo nombres)    │
│ ├─ Otros pacientes       [✗] BLOQUEADO         │
│ ├─ Datos financieros     [✗] BLOQUEADO         │
│ ├─ Usuarios del sistema  [✗] BLOQUEADO         │
│ └─ Campos sensibles      [✗] BLOQUEADO         │
│                                                │
│ RECEPTIONIST (Acceso Mínimo)                   │
│ ├─ Su propio perfil      [✓]                   │
│ ├─ Datos de referencia   [✓] (especialidades)  │
│ ├─ Pacientes             [✗] BLOQUEADO         │
│ ├─ Citas (lectura)       [✗] BLOQUEADO         │
│ ├─ Datos financieros     [✗] BLOQUEADO         │
│ └─ Campos sensibles      [✗] BLOQUEADO         │
│                                                │
│ GUEST (Sin rol)                                │
│ └─ Nada                  [✗] BLOQUEADO TODO    │
│                                                │
└────────────────────────────────────────────────┘

*/

-- ==============================================================================
-- EJEMPLO 8: Cómo probar RLS en tu aplicación
-- ==============================================================================

/*

JavaScript/TypeScript (Next.js, React, etc.):

// ✅ DESPUÉS DE APLICAR RLS - Esto funcionará correctamente:

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(URL, KEY);

// 1. Doctor logueado intenta ver pacientes
const { data: patients } = await supabase
  .from('Patient')
  .select('*');
// Resultado: Solo sus pacientes

// 2. Intenta modificar el query para ver todos
const { data: allPatients } = await supabase
  .from('Patient')
  .select('*')
  .eq('assignedDoctorId', 'otro-doctor'); // Intenta hack
// Resultado: Error 403 Unauthorized (RLS lo bloquea)

// 3. Admin intenta ver todos
const { data: adminPatients } = await supabase
  .from('Patient')
  .select('*');
// Resultado: TODOS los pacientes (porque es admin)

// 4. Intenta una subquery maliciosa
const { data: hack } = await supabase
  .from('Patient')
  .select('*')
  .or('id.neq.,assignedDoctorId.eq.null'); // Intento SQL injection
// Resultado: Error o resultados filtrados por RLS

*/

-- ==============================================================================
-- RESUMEN
-- ==============================================================================

/*

ANTES: Sin RLS
├─ ❌ Un doctor ve TODOS los pacientes
├─ ❌ Un usuario ve TODAS las contraseñas
├─ ❌ Cualquiera puede hacer SQL injection
├─ ❌ No hay control de acceso
└─ 🔴 RIESGO: CRÍTICO

DESPUÉS: Con RLS
├─ ✅ Un doctor ve SOLO sus pacientes
├─ ✅ Un usuario solo ve su propio perfil
├─ ✅ Las columnas sensibles están protegidas
├─ ✅ Control de acceso granular por rol
├─ ✅ Imposible hacer SQL injection para datos no permitidos
└─ 🟢 RIESGO: BAJO

*/

-- ==============================================================================
-- FIN DEL DOCUMENTO DE EJEMPLOS
-- ==============================================================================

