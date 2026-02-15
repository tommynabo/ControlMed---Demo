# 🚀 Configuración Final - Frontend + Supabase

Ahora el frontend está **completamente conectado** a Supabase. Aquí están los pasos finales para que todo funcione.

## ✅ Lo Que Ya Está Hecho

**Backend:** Las tablas SQL ya fueron creadas:
- ✓ clinic_info (con datos de CHC Clinica Dental)
- ✓ clinic_addresses
- ✓ clinic_billing_info  
- ✓ doctor_schedules (con horarios de 6 doctores)
- ✓ system_users (vacía, esperando usuarios)
- ✓ service_durations
- ✓ Todas las demás tablas

**Frontend:** Los componentes ya cargan datos de Supabase:
- ✓ ClinicInfo.tsx → Carga de clinic_info
- ✓ Users.tsx → Carga de system_users
- ✓ ScheduleAvailability.tsx → Carga de doctor_schedules
- ✓ Api.ts → Métodos Supabase directo

---

## 📋 Paso 1: Configurar Variables de Entorno

### En VS Code, en la raíz del proyecto, crear archivo `.env.local`:

```
VITE_SUPABASE_URL=tu_url_aqui
VITE_SUPABASE_ANON_KEY=tu_anon_key_aqui
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui
```

### Dónde obtener estas credenciales:

1. Ir a **Supabase Dashboard** → **Settings** → **API**
2. Copiar:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon (public)** key → `VITE_SUPABASE_ANON_KEY`
   - **Service Role** key → `SUPABASE_SERVICE_ROLE_KEY`

⚠️ **IMPORTANTE:** 
- Nunca subir el `.env.local` a GitHub (ya está en .gitignore)
- El `SUPABASE_SERVICE_ROLE_KEY` es solo para scripts del servidor

---

## 🔐 Paso 2: Crear los 14 Usuarios

### Opción A: Script Automático (Recomendado)

```bash
# 1. Instalar dependencias
npm install @supabase/supabase-js dotenv

# 2. Ejecutar el script
node supabase_import_users.js
```

**Resultado esperado:**
```
🚀 Iniciando importación de usuarios...

⏳ Creando usuario: kevinchrabieh@gmail.com...
   ✅ Usuario creado: abc123...
   ✓ Registro en system_users creado

[...]

📊 RESUMEN DE IMPORTACIÓN
==============================================================
✅ Creados: 14
⚠️  Errores/Existentes: 0
📝 Total procesados: 14
```

### Opción B: Crear Manualmente en Supabase

1. Ir a **Supabase Dashboard** → **Authentication** → **Users**
2. Click en "Invite user" 
3. Agregar cada email de la siguiente lista:

**ADMINS:**
- kevinchrabieh@gmail.com
- almudena.deana.81@gmail.com
- tomasnivraone@gmail.com

**DOCTORES:**
- pablorooblanco@gmail.com
- blati98172023@hotmail.com
- castaycaroline@gmail.com
- alvarobabianon@uic.es
- elissaeid@uic.es

**RECEPCIONISTAS:**
- admin@chcclinicadental.com
- letmanmon@gmail.com
- alisonGUADAMUDALAY@hotmail.com
- CLAUDIAVALENTINA30@GMAIL.COM
- info@echalemarketing.es
- Velasconerea98@gmail.com

---

## 🎨 Paso 3: Probar en el Frontend

### Ejecutar la aplicación:

```bash
npm run dev
```

### Ir a Settings y ver los datos:

1. **Clínica** → Debe mostrar:
   - Nombre: CHC Clinica Dental
   - Email: Admin@chcclinicadental.com
   - Teléfono: 615049704
   - Horarios: 09:00 - 20:00

2. **Horarios** → Debe mostrar:
   - Dr. Chrabieh (L-V)
   - Dr. ROO (L-V)
   - Dra. Concejero (L-V)
   - Dra. Castay (L,M,J,V)
   - Alvaro Babiano (L,M,X,V)
   - Elissa (L-V)

3. **Usuarios** → Debe mostrar:
   - Lista de 14 usuarios
   - Roles asignados (ADMIN, DOCTOR, RECEPTIONIST)
   - Estado activo/inactivo

---

## 🔍 Paso 4: Verificar Data en Supabase

Para confirmar que todo está bien, ejecutar en **Supabase SQL Editor**:

```sql
-- Ver información de clínica
SELECT * FROM clinic_info LIMIT 1;
-- Debe retornar 1 fila con los datos de CHC

-- Ver doctores configurados
SELECT doctor_name, monday, tuesday, morning_start, closing_time 
FROM doctor_schedules 
WHERE is_active = true;
-- Debe retornar 6 doctores

-- Ver usuarios del sistema
SELECT email, full_name, role, is_active 
FROM system_users 
ORDER BY role, full_name;
-- Debe retornar 14 usuarios (si ejecutaste el script)

-- Ver especialidades
SELECT name, duration_min, duration_max 
FROM service_durations;
-- Debe retornar 7 especialidades
```

---

## ⚡ Solución de Problemas

### Los datos no aparecen en el frontend

**Causa:** Las variables de entorno no están configuradas  
**Solución:** Verificar que `.env.local` exista y tenga los valores correctos

```bash
# Verificar que el archivo existe
cat .env.local
```

### "Error: VITE_SUPABASE_URL is required"

**Causa:** Faltó crear el archivo `.env.local`  
**Solución:** Crear el archivo con las 3 variables

### El script de usuarios falla

**Causa:** SUPABASE_SERVICE_ROLE_KEY incorrecta  
**Solución:** 
1. Ir a Supabase → Settings → API
2. Copiar exactamente la "Service Role" key (la larga)
3. Pegar en `.env.local` como `SUPABASE_SERVICE_ROLE_KEY`

### Los usuarios no aparecen en Settings → Usuarios

**Causa:** No se ejecutó `supabase_import_users.js`  
**Solución:** Ejecutar el script manualmente:
```bash
npm install @supabase/supabase-js dotenv
node supabase_import_users.js
```

---

## 📊 Estructura Final

```
Frontend (React/TypeScript)
    ↓
services/supabase.ts (Cliente Supabase)
    ↓
services/api.ts (Métodos de Supabase)
    ↓
Components (ClinicInfo, Users, ScheduleAvailability)
    ↓
Supabase Tables
    • clinic_info ✓
    • system_users ✓
    • doctor_schedules ✓
    • service_durations ✓
    • [más tablas]
```

---

## ✨ Próximos Pasos (Opcionales)

1. **Customización de datos:** Editar clínica, horarios, usuarios desde el UI
2. **Integración de citas:** Conectar appointments a los horarios de doctores
3. **Email de bienvenida:** Notificar a usuarios con sus credenciales
4. **Dashboard:** Ver estadísticas en tiempo real de Supabase

---

## 📞 Resumen de Credenciales

| Usuario | Email | Rol | Contraseña Temp |
|---------|-------|-----|-----------------|
| Dr. Chrabieh | kevinchrabieh@gmail.com | ADMIN | Temporal123! |
| Almudena | almudena.deana.81@gmail.com | ADMIN | Temporal123! |
| Tomas | tomasnivraone@gmail.com | ADMIN | Temporal123! |
| Dr. ROO | pablorooblanco@gmail.com | DOCTOR | Temporal123! |
| Dra. Concejero | blati98172023@hotmail.com | DOCTOR | Temporal123! |
| ... | ... | ... | ... |

---

¡Listo! El sistema está completamente configurado. Ahora puedes ver los datos de la clínica en Settings. 🎉
