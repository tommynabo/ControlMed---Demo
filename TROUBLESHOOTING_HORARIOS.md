# 🐛 Guía de Solución de Problemas - Configuración de Horarios

## Problema 1: La búsqueda de doctores NO funciona o sale vacía

### Síntoma
- Haces clic en "Nuevo Horario"
- Aparece la barra de búsqueda
- Escribes pero NO sale ningún doctor
- O sale: "No se encontraron doctores"

### Causa Raíz
1. No hay doctores con `role = 'DOCTOR'` en la tabla `system_users`
2. Los doctores están marcados como `is_active = false`
3. La API `systemUsers.getAll()` retorna error

### Solución

#### Paso 1: Verificar en Supabase
```sql
-- En Supabase SQL Editor, ejecuta:
SELECT id, full_name, email, role, is_active 
FROM system_users 
WHERE role = 'DOCTOR' 
ORDER BY full_name;
```

**Resultado esperado:** Deberías ver 6+ doctores como:
```
id    | full_name          | email                    | role   | is_active
------|------------------|--------------------------|--------|----------
uuid1 | Dr. Chrabieh     | kevinchrabieh@gmail.com | DOCTOR | true
uuid2 | Dr. ROO          | pablorooblanco@gmail.com| DOCTOR | true
uuid3 | Dra. Concejero   | blati98172023@hotmail.com| DOCTOR | true
...
```

#### Paso 2: Si hay docotres pero no aparecen
```sql
-- Verifica que está_active es TRUE
UPDATE system_users 
SET is_active = true 
WHERE role = 'DOCTOR' AND is_active IS NOT TRUE;

-- Aplica cambios
COMMIT;
```

#### Paso 3: Si aún no funciona
```javascript
// En consola del navegador (F12 → Console):
// Ejecuta esto en ScheduleAvailability.tsx:
const users = await api.systemUsers.getAll();
const doctors = users.filter(u => u.role === 'DOCTOR');
console.log('Doctores encontrados:', doctors);
```

Si muestra `[]` (array vacío), el problema está en la API.

---

## Problema 2: Los horarios se guardan pero NO aparecen en la agenda

### Síntoma
- Configuras horarios para Dr. Chrabieh
- Haces clic en "Guardar" → Aparece checkmark verde ✓
- Vas a Agenda
- Seleccionas Dr. Chrabieh
- Los slots siguen siendo TODOS (09:00-18:45) ❌

### Causa Raíz
1. Los datos NO se guardaron en Supabase
2. LaAgenda NO está leyendo los `doctorSchedules`
3. El formato de tiempo es incorrecto
4. El `doctor_id` no coincide entre tablas

### Solución

#### Paso 1: Verificar que se guardó en Supabase
```sql
SELECT doctor_id, doctor_name, morning_start, morning_end, is_active 
FROM doctor_schedules 
ORDER BY created_at DESC 
LIMIT 10;
```

**Si sale vacío:** Los datos NO se guardaron. Ir a Paso 3.

**Si hay datos:** Continuar a Paso 2.

#### Paso 2: Verificar formato de tiempo
```sql
-- Los tiempos DEBEN ser HH:MM:SS
SELECT 
  doctor_name,
  morning_start,
  morning_end,
  length(morning_start::text) as length_check
FROM doctor_schedules 
LIMIT 1;
```

**Resultado correcto:**
```
doctor_name    | morning_start | morning_end | length_check
---------------|------|-----------|----------
Dr. Chrabieh   | 09:00:00 | 13:00:00 | 8
```

**Si sale `09:00` (solo 5 caracteres):** PROBLEMA ENCONTRADO

Arreglar:
```sql
UPDATE doctor_schedules 
SET 
  morning_start = morning_start || ':00',
  morning_end = morning_end || ':00',
  afternoon_start = afternoon_start || ':00',
  afternoon_end = afternoon_end || ':00'
WHERE morning_start NOT LIKE '%:%:%';
```

#### Paso 3: Verificar sincronización con agenda
```javascript
// En Agenda.tsx, abre consola (F12)
// Después de que se cargue, ejecuta:
console.log('doctorSchedules:', doctorSchedules);
console.log('selectedDoctorId:', selectedDoctorId);
```

**Esperado:**
```javascript
doctorSchedules: [
  {
    id: "uuid",
    doctor_id: "doctor-uuid",
    doctor_name: "Dr. Chrabieh",
    morning_start: "09:00",  // ← Sin :00
    morning_end: "13:00",
    afternoon_start: "16:00",
    afternoon_end: "20:00",
    ...
  }
]
selectedDoctorId: "doctor-uuid"
```

#### Paso 4: Si aún no funciona
Recarga la página completamente:
```
Windows/Linux: Ctrl+Shift+Del (Limpiar caché)
macOS: Cmd+Shift+Del
```

O en el navegador:
```
- Abre DevTools (F12)
- Click derecho en logo recargar
- Selecciona "Vaciar caché y recargar"
```

---

## Problema 3: El modal no abre después de seleccionar doctor

### Síntoma
- Haces clic en "Nuevo Horario"
- Aparece la búsqueda
- Escribes y ves el doctor
- Haces clic en el doctor
- **NADA PASA** ❌

### Causa Raíz
1. Error de JavaScript en la consola
2. El `handleSelectDoctor` no se ejecutó
3. El `doctor.id` es undefined

### Solución

#### Verificar en consola:
```javascript
// F12 → Console
// Ejecuta esto después de hacer clic:
console.log('Doctor ID:', doctor?.id);
console.log('Hospital ID:', doctor?.full_name);
```

Si muestra `undefined`, el Doctor object está corrupto.

#### Debug paso a paso:
```javascript
// En ScheduleAvailability.tsx, añade esto temporalmente:
const handleSelectDoctor = (doctor: SystemUser) => {
  console.log('1. Doctor seleccionado:', doctor);  // ← Verifica que es correcto
  
  const existingSchedule = doctors.find(d => d.doctor_id === doctor.id);
  console.log('2. Schedule existente encontrado:', existingSchedule);  // ← Sí/no tiene
  
  setDoctorForm({
    doctor_id: doctor.id,
    doctor_name: doctor.full_name,
    // ... resto
  });
  console.log('3. DoctorForm actualizado');  // ← Llega aquí?
  
  setShowDoctorModal(true);
  console.log('4. Modal debería estar visible');  // ← Y aquí?
};
```

Copia la consola y comparte el output.

---

## Problema 4: Al editar horarios, se guarda pero NO actualiza la lista

### Síntoma
- Editas un doctor existente
- Cambias, por ejemplo, y deselecciona Jueves
- Haces clic en "Guardar"
- Aparece checkmark ✓
- Pero la lista sigue mostrando los días ANTIGUOS

### Causa Raíz
1. La `loadScheduleData()` no se ejecutó después de guardar
2. Los datos en Supabase se guardaron pero el estado local no se actualizó
3. Hay un error silencioso en la actualización

### Solución

#### Verifica la consola:
```javascript
// F12 → Console
// Después de hacer clic en "Guardar":
// Deberías ver: "Horario guardado correctamente ✓"

// Si no ves nada, ejecuta:
console.log('isSaving:', isSaving);  // Debería ser false al terminar
```

#### Fuerza una recarga manual:
```javascript
// En el navegador, presiona:
// Windows: F5
// macOS: Cmd+R
```

Después de recargar, debería verlas cambios.

#### Si persiste:
Verifica en Supabase directamente:
```sql
SELECT doctor_name, thursday
FROM doctor_schedules 
WHERE doctor_name = 'Dr. Chrabieh';
```

Si `thursday = false`, los cambios sí se guardaron. Solo es visualización.

---

## Problema 5: Error "Por favor selecciona un doctor"

### Síntoma
- Configuras horarios
- Haces clic en "Guardar"
- Sale alerta: **"Por favor selecciona un doctor"** ❌

### Causa Raíz
El `doctor_id` está vacío cuando intentas guardar.

### Solución

#### Verificar que seleccionaste un doctor:
```javascript
// F12 → Console
console.log('doctorForm.doctor_id:', doctorForm.doctor_id);
console.log('doctorForm.doctor_name:', doctorForm.doctor_name);
```

**Correcto:**
```
doctorForm.doctor_id: "9a3b...uuid...1234"
doctorForm.doctor_name: "Dr. Chrabieh"
```

**Problemático:**
```
doctorForm.doctor_id: ""
doctorForm.doctor_name: ""
```

#### Solución:
Verifica que hiciste el flujo correto:
1. Clickeaste "Nuevo Horario"
2. Buscaste un doctor
3. **Hiciste clic en el doctor** (no solo escribiste)
4. Se abrió el modal
5. **RECIÉN AHORA** haces clic en "Guardar"

Si saltaste el paso 3, el `doctor_id` no se habrá asignado.

---

## Problema 6: La agenda no filtra slots pero en Supabase están los horarios

### Síntoma
- Verificas en Supabase: `SELECT * FROM doctor_schedules` → ✓ Datos están
- Vas a Agenda
- Seleccionas doctor
- Aún ve: 09:00, 09:15, 09:30... 18:45 (TODOS) ❌

### Causa Raíz
1.  `doctorSchedules` no se cargó en Agenda.tsx
2. La función `getAvailableTimeSlots()` no se llama
3. El formato de tiempo es inconsistente

### Solución

#### Verificar que se cargó:
```javascript
// F12 → Console en Agenda
console.log('doctorSchedules:', doctorSchedules);
console.log('doctorSchedules.length:', doctorSchedules.length);
```

**Esperado:** Array con múltiples doctores

**Si sale `[]`:** Paso 2.

#### Si está vacío, verificar useEffect:
```javascript
// En Agenda.tsx, en el useEffect:
useEffect(() => {
  const loadSchedules = async () => {
    console.log('Cargando doctorSchedules...');  // ← Debe salir
    try {
      const schedules = await api.doctorSchedules.getAll();
      console.log('Schedules cargados:', schedules);  // ← Cuántos?
      setDoctorSchedules(schedules);
    } catch (err) {
      console.error('Error:', err);  // ← Sale error?
    }
  };
  loadSchedules();
}, []);
```

#### Si hay error:
```javascript
// Ejecuta manualmente:
const allSchedules = await api.doctorSchedules.getAll();
```

Comparte el error en consola.

#### Verificar que se llama el filtro:
```javascript
// Después de seleccionar un doctor:
const availableSlots = getAvailableTimeSlots(currentDate, selectedDoctorId);
console.log('Slots disponibles:', availableSlots);
console.log('Total slots:', availableSlots.length);
```

**Correcto:** Debería retornar menos slots que TIME_SLOTS.length

**Si retorna TODO TIME_SLOTS:** El filtro no funciona.

---

## Problema 7: TypeError: Cannot read property 'split' of undefined

### Síntoma
Consola muestra:
```
TypeError: Cannot read property 'split' of undefined
  at getAvailableTimeSlots (Agenda.tsx:125)
```

### Causa Raíz
El `doctor_id` seleccionado NO existe en `doctorSchedules`
→ `schedule` es `undefined`
→ Intentas hacer `.split()` en undefined

### Solución

```javascript
// En Agenda.tsx, el filtro debe validar primero:
const getAvailableTimeSlots = (date: Date, doctorId?: string): string[] => {
  if (!doctorId || doctorId === 'all') return TIME_SLOTS;  // ← Añade esto

  const schedule = doctorSchedules.find(s => s.doctor_id === doctorId);
  
  if (!schedule) {
    console.warn('Schedule no encontrado para:', doctorId);
    return TIME_SLOTS;  // ← Fallback seguro
  }
  
  // ... resto del código
};
```

---

## Problema 8: Si NADA funciona

### Debug completo:

```bash
# 1. Abre la consola del navegador (F12)

# 2. Verifica la API:
api.systemUsers.getAll().then(d => console.log('Users:', d))

# 3. Verifica doctores:
api.systemUsers.getAll()
  .then(u => u.filter(x => x.role === 'DOCTOR'))
  .then(d => console.log('Doctores:', d))

# 4. Verifica schedules:
api.doctorSchedules.getAll().then(s => console.log('Schedules:', s))

# 5. Verifica guardado:
api.doctorSchedules.create({
  doctor_id: 'test-id',
  doctor_name: 'Test',
  monday: true,
  morning_start: '09:00:00',
  morning_end: '13:00:00',
  afternoon_start: '16:00:00',
  afternoon_end: '20:00:00'
}).then(r => console.log('Guardado:', r))
```

### Si dice "api is not defined":
```javascript
// Importa la API manualmente:
import { api } from '../src/services/api';

// Y luego ejecuta los comandos
```

---

## Checklist de Debug

Antes de reportar un problema, verifica:

- [ ] Instalé todas las dependencias (`npm install`)
- [ ] Recargué la página (`Ctrl+Shift+Del`)
- [ ] Limpié la consola de errores anteriores
- [ ] Verifiqué en Supabase directamente (datos están)
- [ ] Ejecuté los comandos del console en el mismo orden
- [ ] Copié exactamente el error que sale
- [ ] Verifiqué que los timestamps son recientes (no de ayer)

---

## Información a Proporcionar si Reportas Bug

```
Así debería verse tu reporte:

**Descripción:**
Los horarios no aparecen en la agenda después de guardar

**Pasos para reproducir:**
1. Hago clic en Configuración → Horarios
2. Selecciono Dr. Chrabieh
3. Configuro Lunes-Viernes, 09:00-13:00 / 16:00-20:00
4. Hago clic en Guardar (aparece checkmark ✓)
5. Voy a Agenda
6. Selecciono Dr. Chrabieh
7. VEO: 09:00, 09:15... 18:45 (TODOS los slots)
8. ESPERO: Solo 09:00-12:45 y 16:00-19:45

**Consola (F12):**
```
doctorSchedules: [
  {
    doctor_id: "uuid-xxx",
    doctor_name: "Dr. Chrabieh",
    morning_start: "09:00:00",
    morning_end: "13:00:00",
    ...
  }
]
```

**Verific en Supabase:**
```sql
SELECT * FROM doctor_schedules 
WHERE doctor_name = 'Dr. Chrabieh';
-- Resultado: ✅ 1 fila
```
```

---

## Contacto / Escalación

Si después de todo esto aún NO funciona:
1. Comparte los **logs de consola completos** (F12)
2. Comparte la **query de Supabase** y resultado
3. Indica qué **sistema operativo** y **navegador** usas
4. Comparte el **screenshot del error** exacto

**Email:** [Tomas]
**Telegram:** [Link]
**Discord:** [Link]

---

**Última actualización:** Febrero 21, 2026

**Versión:** 1.0 - Implementación Inicial

**Estado:** ✅ DEPLOYABLE
