# 📋 Guía Completa de Configuración del Sistema - CHC Clinica Dental

## 📌 Índice
1. [Resumen de Cambios](#resumen)
2. [Archivos SQL Creados](#archivos-sql)
3. [Instrucciones de Supabase](#supabase)
4. [Configuración de IDs de Pacientes](#ids-pacientes)
5. [Carga de Usuarios](#usuarios)
6. [Verificación Final](#verificacion)

---

## 🔄 Resumen de Cambios {#resumen}

Se han creado **4 nuevas subpáginas de configuración** en el sistema:

### 1. **Información de la Clínica**
- Nombre, dirección, teléfono, email
- Horarios de apertura y cierre
- País y datos de ubicación

### 2. **Horarios y Disponibilidad**
- Horarios de doctores (días laborales)
- Turnos: Mañana (9:00-13:00) y Tarde (16:00-20:00)
- Duración estándar de citas por especialidad

### 3. **Gestión de Vacaciones**
- Solicitud y aprobación de vacaciones
- Fechas y duración automática
- Notas y estado de aprobación

### 4. **Usuarios del Sistema**
- Crear/editar usuarios con roles (ADMIN, DOCTOR, RECEPTIONIST, ASSISTANT)
- Activar/desactivar usuarios
- Gestión de permisos

---

## 📄 Archivos SQL Creados {#archivos-sql}

### 1. `supabase_new_config_tables.sql`
**Contenido:** Creación de todas las nuevas tablas
- ✅ `clinic_info` - Información básica
- ✅ `clinic_addresses` - Direcciones
- ✅ `clinic_billing_info` - Facturación
- ✅ `doctor_schedules` - Horarios médicos
- ✅ `service_durations` - Duraciones de servicios
- ✅ `vacations` - Períodos de descanso
- ✅ `system_users` - Usuarios extendidos
- ✅ `system_settings` - Configuración general
- ✅ `specialties` - Especialidades
- ✅ `system_audit_log` - Auditoría

**Incluye:**
- Índices para optimización
- Políticas de RLS (Row Level Security)
- Datos iniciales de CHC Clinica Dental
- Triggers para timestamps

### 2. `supabase_users_import.sql`
**Contenido:** Inserción de usuarios
- ✅ Administradores (Kevin, Almudena, Tomas)
- ✅ Doctores (Dr. Chrabieh, Dra. Concejero, etc.)
- ✅ Personal administrativo
- ✅ Horarios predefinidos para doctores

### 3. `GUIA_SUPABASE_CONFIGURACION.sql`
**Contenido:** Guía paso a paso para Supabase
- Verificación de IDs
- Mapeo de datos del CSV
- Creación de usuarios
- Configuración de horarios
- Tests de funcionamiento

### 4. `VERIFICACION_IDS_HISTORIALES.sql`
**Contenido:** Validación de integridad de datos
- Mapeo CSV → Base de datos
- Detección de discrepancias
- Reportes de validación
- Tablas de control de integridad

---

## 🚀 Instrucciones para Supabase {#supabase}

### Paso 1: Ejecutar Script Principal

1. **Ir a Supabase Dashboard**
   - Abrir tu proyecto
   - Ir a **SQL Editor**
   - Click en "New Query"

2. **Copiar y ejecutar `supabase_new_config_tables.sql`**
   - Copiar TODO el contenido del archivo
   - Pegarlo en el SQL Editor
   - Click en **Run** (Ctrl+Enter)
   - ✅ Esperar a que complete

**Resultado esperado:**
```
✓ Tables created
✓ Indexes created
✓ RLS policies created
✓ Initial data inserted
✓ Triggers created
```

### Paso 2: Crear Usuarios en Auth

**Opción A: Panel Supabase**
1. Ir a **Authentication** → **Users**
2. Click en **Invite user**
3. Ingresar email del usuario
4. Click **Send invite**
5. El usuario recibirá email de invitación

**Usuarios a crear:**
```
kevinchrabieh@gmail.com         (ADMIN)
admin@chcclinicadental.com       (RECEPTIONIST)
pablorooblanco@gmail.com         (DOCTOR)
almudena.deana.81@gmail.com      (ADMIN)
blati98172023@hotmail.com        (DOCTOR)
castaycaroline@gmail.com         (DOCTOR)
alvarobabianon@uic.es            (DOCTOR)
elissaeid@uic.es                 (DOCTOR)
letmanmon@gmail.com              (RECEPTIONIST)
alisonGUADAMUDALAY@hotmail.com   (RECEPTIONIST)
CLAUDIAVALENTINA30@GMAIL.COM     (RECEPTIONIST)
info@echalemarketing.es          (RECEPTIONIST)
Velasconerea98@gmail.com         (RECEPTIONIST)
tomasnivraone@gmail.com          (ADMIN)
```

**Opción B: SQL Script**
Si prefieres usar SQL después de crear usuarios:
1. Obtener los UUIDs de auth.users
2. Ejecutar `supabase_users_import.sql`
3. Esto mapea los usuarios a `system_users`

### Paso 3: Verificar Integridad de Datos

```sql
-- Ver información de la clínica
SELECT * FROM clinic_info;

-- Ver dirección
SELECT * FROM clinic_addresses;

-- Ver horarios de doctores
SELECT doctor_name, morning_start, morning_end FROM doctor_schedules;

-- Ver especialidades
SELECT name FROM specialties;

-- Ver usuarios creados
SELECT email, full_name, role FROM system_users;
```

---

## 👥 Configuración de IDs de Pacientes {#ids-pacientes}

### Problema a Resolver
Los IDs de pacientes en el CSV de historiales (`38e2cb5bf2f1ecab4b9861a51f5377a2_36424_1771171925.csv`) deben coincidiir exactamente con los IDs en la tabla `patients` de la BD.

### Estructura de Datos

**CSV de Contactos:**
```
IDCONTACTO  | NOMBRE    | APELLIDOS    | ESTADO
35021367    | ALI       | AMRANI       | Activo
35008535    | MANUEL    | ROJAS LOPEZ  | Activo
35097215    | ERNESTINA | ZUÑIGA GARCIA| Activo
```

**CSV de Historiales:**
```
IDCONTACTO | CONTACTO              | ESPECIALIDAD  | FECHA
35021367   | ALI AMRANI            | Odontología   | 2025-05-27
35008535   | MANUEL ROJAS LOPEZ    | Odontología   | 2025-05-28
```

### Solución

1. **El IDCONTACTO es el ID principal del paciente**
   - Usar como UUID en la tabla `patients`
   - FK en `clinical_records`

2. **Crear tabla de mapeo**
   ```sql
   INSERT INTO csv_to_db_id_mapping (csv_idcontacto, db_patient_id)
   VALUES ('35021367', <uuid_del_paciente_ali>);
   ```

3. **Validar coincidencias**
   ```sql
   SELECT * FROM data_integrity_check WHERE nombre_match = 'DISCREPANCIA';
   ```

### Checklist de Sincronización

- [ ] Importar todos los pacientes del CSV a tabla `patients`
- [ ] Crear mapeos en `csv_to_db_id_mapping`
- [ ] Validar que nombres coinciden
- [ ] Contar historiales por paciente (deben coincidir CSV ↔ BD)
- [ ] Ejecutar `generate_integrity_report()`
- [ ] Resolver discrepancias
- [ ] Marcar all como validados

---

## 👤 Carga de Usuarios {#usuarios}

### Información de CHC Clinica Dental

```
Nombre: CHC Clinica Dental
Responsable: Kevin Chrabieh
Email: Admin@chcclinicadental.com
Teléfono: 615049704
Web: www.chcclinicadental.com

DIRECCIÓN:
Carrer De La Foneria, 24
08038 Barcelona, Barcelona, España

FACTURACIÓN:
Razón Social: CHCMEDIC SL
CIF: B75759746
IBAN: ES21003014722201023555
```

**Esto ya está cargado automáticamente en:**
- ✅ `clinic_info`
- ✅ `clinic_addresses`
- ✅ `clinic_billing_info`

### Roles de Usuario

| Rol | Privilegios | Usuarios |
|-----|-----------|----------|
| **ADMIN** | Control total del sistema | Kevin, Almudena, Tomas |
| **DOCTOR** | Gestión de pacientes y citas | Dr. Chrabieh, Dr. ROO, Dras. |
| **RECEPTIONIST** | Citas, facturación | Leticia, Alison, Claudia, etc. |
| **ASSISTANT** | Asistencia general | (Disponible para futuros usuarios) |

### Cambiar Rol de Usuario

```sql
UPDATE system_users
SET role = 'DOCTOR'
WHERE email = 'pablorooblanco@gmail.com';
```

---

## ✅ Verificación Final {#verificacion}

### Test 1: ¿Está cargada la información de la clínica?
```sql
SELECT name, email, phone, opening_time, closing_time 
FROM clinic_info 
WHERE name = 'CHC Clinica Dental';
```
**Resultado esperado:**
```
CHC Clinica Dental | Admin@chcclinicadental.com | 615049704 | 09:00 | 20:00
```

### Test 2: ¿Se ven los doctores y sus horarios?
```sql
SELECT doctor_name, morning_start, afternoon_end, is_active
FROM doctor_schedules
WHERE is_active = true;
```
**Resultado esperado:** Lista de doctores con horarios

### Test 3: ¿Existen las especialidades?
```sql
SELECT COUNT(*) as especialidades FROM specialties WHERE is_active = true;
```
**Resultado esperado:** 7 especialidades

### Test 4: ¿Se cargaron los usuarios?
```sql
SELECT COUNT(*) as usuarios_activos 
FROM system_users 
WHERE is_active = true;
```
**Resultado esperado:** 14 usuarios

### Test 5: ¿Las políticas de RLS están activas?
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
LIMIT 10;
```
**Resultado esperado:** Todas las tablas con `rowsecurity = true`

---

## 📊 Datos Visibles en el Sistema

Una vez completada la configuración, verás en la aplicación:

### En Settings → Clínica
- ✅ Nombre: CHC Clinica Dental
- ✅ Dirección: Carrer De La Foneria, 24, Barcelona
- ✅ Teléfono: 615049704
- ✅ Horarios: 09:00 - 20:00
- ✅ Email: Admin@chcclinicadental.com

### En Settings → Horarios
- ✅ Dr. Chrabieh: Lunes-Viernes, 09:00-13:00 y 16:00-20:00
- ✅ Dr. ROO: Lunes-Viernes, 09:00-13:00 y 16:00-20:00
- ✅ Otros doctores...

### En Settings → Usuarios
- ✅ Lista completa de 14 usuarios activos
- ✅ Roles y permisos asignados
- ✅ Posibilidad de activar/desactivar

### En Settings → Vacaciones
- ✅ Interfaz para agregar períodos de descanso
- ✅ Aprobación de ausencias
- ✅ Calendario de disponibilidad

---

## 🔒 Seguridad

**Implementado:**
- ✅ Row Level Security (RLS) en todas las tablas
- ✅ Autenticación con Supabase Auth
- ✅ Rol-based access control (RBAC)
- ✅ Auditoría de cambios en `system_audit_log`
- ✅ Enumeración de timestamps automatizados

---

## 📞 Soporte

Si tienes problemas:

1. **Error de permisos:** Revisar que el usuario existe en `auth.users` Y en `system_users`
2. **Datos no aparecen:** Ejecutar nuevamente el script principal
3. **IDs no coinciden:** Ver sección "Configuración de IDs de Pacientes"
4. **Backup:** Hacer backup en Supabase antes de cambios masivos

---

**¡Sistema configurado y listo para usar! 🎉**

