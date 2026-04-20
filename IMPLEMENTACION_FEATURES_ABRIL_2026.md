# 📋 Guía de Integración: Packs, Pagos Parciales y Recordatorios

**Fecha**: 20 Abril 2026  
**Cambios completados**: 3 features principales implementadas

---

## 🎯 Resumen Rápido

Se han implementado tres características complementarias para mejorar la gestión de citas, pagos y seguimiento de pacientes:

1. **Packs de 1ª Visita Dobles** ✅
2. **Visualización de Pagos Parciales** ✅  
3. **Sistema de Recordatorios Manuales** ✅

---

## ✅ FEATURE 1: Packs de Primera Visita Dobles

### 📝 Cambios Realizados

#### Archivos Modificados:
- **[src/constants.ts](src/constants.ts)** 
  - ✅ Actualizado precios de servicios:
    - `srv-11` (Primera visita): 0€ → **20€**
    - `srv-12` (OPG): 30€ → **10€** (Pack 1a) / **20€** (Pack 1b)
    - `srv-13` (Tartrectomía): 50€ → **0€**
    - ✨ Nuevo: `srv-14` (Higiene): **30€**
  - ✅ Nuevos packs:
    - `pack-1a`: "1ª Consulta + OPG + Higiene" = **60€**
    - `pack-1b`: "1ª Consulta + OPG" = **45€**

#### Archivos Creados:
- **[src/components/PackSelectionModal.tsx](src/components/PackSelectionModal.tsx)** ✨
  - Modal elegante con selección visual de dos packs
  - Muestra servicios incluidos y precios por servicio
  - Botones de confirmación con radio buttons interactivos

- **[sqlcommands/update_pack_prices.sql](sqlcommands/update_pack_prices.sql)** 📊
  - Script SQL para actualizar precios en Supabase
  - Crea nuevos servicios (srv-14, pack-1a, pack-1b)
  - Con verificación final

#### Archivos Modificados (Agenda):
- **[src/pages/Agenda.tsx](src/pages/Agenda.tsx)**
  - ✅ Import: `import PackSelectionModal from '../components/PackSelectionModal'`
  - ✅ Estado: `const [isPackSelectionModalOpen, setIsPackSelectionModalOpen] = useState(false)`
  - ✅ Handler: `handlePackPrimeraVisita()` → abre modal (línea ~788)
  - ✅ Nuevo Handler: `handleSelectPack()` → recibe servicios y actualiza UI
  - ✅ JSX: Componente `<PackSelectionModal />` agregado al final

### 🚀 Cómo Usar (Usuario Final)

1. En la agenda, abre una cita nueva o existente
2. Haz click en el botón "Pack 1ª Visita" (con icono ✨)
3. Se abre modal con dos opciones:
   - **Pack Completo (60€)**: Consulta + OPG + Higiene
   - **Pack Esencial (45€)**: Consulta + OPG
4. Selecciona uno y confirma
5. Los servicios se agregan automáticamente a la cita

### ⚠️ Paso de Ejecución SQL

Antes de usar la feature, ejecuta en Supabase:

```sql
-- Ejecuta este archivo completo:
sqlcommands/update_pack_prices.sql
```

---

## 💰 FEATURE 2: Visualización de Pagos Parciales

### 📝 Cambios Realizados

**Feature utiliza infraestructura EXISTENTE:**
- La tabla `Appointment` ya tiene columnas `amount` y `paidAmount`
- La tabla `Payment` ya tiene campos `isPartial` y `originalAmount`
- `PaymentModal.tsx` ya visualiza saldo pendiente

### ✅ Ya Funciona:
- ✅ Registrar pago parcial (ej: 175€ de 350€)
- ✅ Mostrar "Pendiente tras este cobro: 175€" en modal
- ✅ Marcar cita como "Pago Parcial"
- ✅ Calcular balance en PaymentModal

### 📊 Visualización

En [src/components/PaymentModal.tsx](src/components/PaymentModal.tsx#L438-L446):

```
┌─────────────────────────────────────────┐
│ 📋 IMPORTE ORIGINAL: 350.00€            │
│ ⚠️ PENDIENTE TRAS ESTE COBRO: 175.00€   │
│ ℹ️ La visita quedará en "Pago Parcial"  │
└─────────────────────────────────────────┘
```

### 🔄 Flujo de Pago Parcial

```
1. Cita Original: "Blanqueamiento" = 350€ (NO PAGADO)
   ↓
2. Paciente paga 175€ (TARJETA)
   → Appointment.paidAmount = 175
   → Payment.isPartial = true
   → Status: "PAGO PARCIAL" 🟡
   ↓
3. Agenda muestra automáticamente:
   "Blanqueamiento - Pendiente: 175€" 
   ↓
4. Paciente paga 175€ restantes
   → Appointment.paidAmount = 350
   → Status: "PAGADO" ✅
```

### ⚙️ Para Usuario (Caso Amaya Espiga):

1. **Primera visita (Viernes)**: Cita de blanqueamiento (350€)
2. Paciente paga 175€ con tarjeta
   - El modal mostrará "Pendiente: 175€"
3. **Segunda visita (Hoy)**: Registra nuevo pago de 175€
   - Sistema calcula automáticamente que es el balance restante
4. **Resultado**: 
   - Blanqueamiento marcado como PAGADO ✅
   - Dos movimientos de pago (175€ + 175€ = 350€)

---

## 🔔 FEATURE 3: Sistema de Recordatorios Manuales

### 📝 Cambios Realizados

#### Archivos Creados:

**Base de Datos:**
- **[sqlcommands/create_reminder_table.sql](sqlcommands/create_reminder_table.sql)** 📊
  - Tabla `Reminder` con campos: id, patientId, description, dueDate, priority, status, etc.
  - Índices optimizados para búsquedas
  - RLS policies de seguridad

**Frontend - Componentes:**
- **[src/components/ReminderModal.tsx](src/components/ReminderModal.tsx)** ✨
  - Modal elegante para crear recordatorios
  - Lista de recordatorios pendientes y completados
  - 3 niveles de prioridad (Bajo, Normal, Urgente)
  - 4 opciones de notificación (App, WhatsApp, Email, Ambas)
  - Campos: descripción, fecha, prioridad, notas

**API - Frontend:**
- **[src/services/api-reminders.ts](src/services/api-reminders.ts)** 🔌
  - Funciones para CRUD de recordatorios
  - `create()`, `getByPatient()`, `update()`, `delete()`, `getPendingDue()`

**Backend - API:**
- **[server/routes/reminders.js](server/routes/reminders.js)** 🚀
  - 5 endpoints REST:
    - `POST /api/reminders` - Crear
    - `GET /api/reminders?patientId=X` - Listar
    - `GET /api/reminders/:id` - Obtener uno
    - `PUT /api/reminders/:id` - Actualizar
    - `DELETE /api/reminders/:id` - Eliminar
    - `GET /api/reminders/pending/due` - Obtener vencidos

**Scheduler - Backend:**
- **[server/services/schedulerService.js](server/services/schedulerService.js)** ⏰
  - Job diario a las 9 AM
  - Busca recordatorios vencidos (dueDate ≤ hoy)
  - Envía notificaciones según preferencia:
    - 📱 In-app
    - 💬 WhatsApp (si tiene teléfono)
    - 📧 Email (si tiene email)
  - Marca como "notificationSent = true"

### 🚀 Cómo Usar (Usuario Final)

**Crear Recordatorio:**

1. Abre perfil de paciente (ej: Paki)
2. Haz click en botón "🔔 Recordatorios" (por crear - ver INTEGRACIÓN)
3. Se abre modal con formulario
4. Completa:
   - **Descripción**: "Llamar a Paki para seguimiento"
   - **Fecha**: 6 meses desde hoy (seleccionar en picker)
   - **Prioridad**: Normal / Urgente / Baja
   - **Notificación**: WhatsApp / Email / Ambas
   - **Notas**: Datos de contacto o context adicional
5. Click en "Crear Recordatorio"
6. ✅ Recordatorio guardado

**Ver Recordatorios:**

- **Pendientes** 🟠: Muestra en el modal, ordenadas por fecha
- **Completados** ✅: Grises, al final de la lista
- **Acciones**: 
  - Click ✓ para marcar como completado
  - Click ✕ para eliminar

**Recibir Notificación:**

- **En la fecha programada** (a las 9 AM):
  - Si elegiste WhatsApp → SMS automático
  - Si elegiste Email → Correo automático
  - Si elegiste Ambas → Ambos
  - Si elegiste App → Sección "Recordatorios Vencidos"

---

## 🔧 INTEGRACIÓN - PASOS CRÍTICOS

### 1️⃣ SQL: Crear tablas y actualizar precios

```bash
# Ejecuta en Supabase SQL Editor:

1. sqlcommands/update_pack_prices.sql
   ✅ Actualiza precios de servicios
   ✅ Crea nuevos servicios (srv-14, packs)

2. sqlcommands/create_reminder_table.sql
   ✅ Crea tabla Reminder con RLS
```

### 2️⃣ Backend: Registrar ruta de recordatorios

En **[server/index.js](server/index.js)** o tu archivo principal de Express:

```javascript
// Agregar después de otras rutas de API
const remindersRouter = require('./routes/reminders');
app.use('/api/reminders', remindersRouter);
```

### 3️⃣ Frontend: Agregar API de recordatorios

En **[src/services/api.ts](src/services/api.ts)**:

```typescript
// Importar al inicio
import * as remindersAPI from './api-reminders';

// Agregar a las exportaciones
export const reminders = remindersAPI.reminders;
```

Uso en componentes:
```typescript
await api.reminders.create({...})
await api.reminders.getByPatient(patientId)
```

### 4️⃣ Frontend: Agregar botón a Patient Detail

En el componente donde se ve el perfil del paciente (ej: PatientDetail.tsx):

```typescript
import ReminderModal from '../components/ReminderModal';

// En el JSX, agregar:
<button 
  onClick={() => setIsReminderModalOpen(true)}
  className="flex items-center gap-2 bg-blue-100 text-blue-600 px-3 py-2 rounded-lg"
>
  <Bell size={16} /> Recordatorios
</button>

<ReminderModal
  isOpen={isReminderModalOpen}
  onClose={() => setIsReminderModalOpen(false)}
  patient={patient}
/>
```

### 5️⃣ Backend: Asegurar que Scheduler está activo

En **[server/services/schedulerService.js](server/services/schedulerService.js)**:

✅ Ya actualizado con nueva lógica de Job 2 (9 AM)

Verifica que el scheduler se inicia en `server/index.js`:
```javascript
const { initializeScheduler } = require('./services/schedulerService');
initializeScheduler(); // ← Debe estar presente
```

---

## 📊 Resumen Técnico

| Feature | Tabla | Componente | Endpoint | Scheduler |
|---------|-------|-----------|----------|-----------|
| **Packs** | N/A | PackSelectionModal | GET /api/services | N/A |
| **Pagos Parciales** | Appointment.paidAmount | PaymentModal | POST /api/finance/pay | N/A |
| **Recordatorios** | Reminder | ReminderModal | /api/reminders/* | 9 AM daily |

---

## ✅ Checklist de Implementación

- [ ] Ejecutar `update_pack_prices.sql` en Supabase
- [ ] Ejecutar `create_reminder_table.sql` en Supabase
- [ ] Registrar `/api/reminders` en `server/index.js`
- [ ] Importar `api.reminders` en `src/services/api.ts`
- [ ] Agregar botón de Recordatorios en Patient Detail
- [ ] Probar creación de pack en agenda (2 opciones)
- [ ] Probar pago parcial en una cita
- [ ] Probar creación de recordatorio
- [ ] Verificar notificaciones a las 9 AM (si configurado)

---

## 🐛 Troubleshooting

### Packs no aparecen en modal
- ✅ Verificar que `PackSelectionModal.tsx` está en `src/components/`
- ✅ Verificar import en `Agenda.tsx`
- ✅ Verificar precios en `constants.ts`

### Pagos parciales no se guardan
- ✅ Verificar que Appointment tiene columna `paidAmount`
- ✅ Revisar logs del backend al cobrar

### Recordatorios no se envían
- ✅ Verificar tabla `Reminder` existe en Supabase
- ✅ Verificar scheduler está activo
- ✅ Revisar logs del server a las 9 AM
- ✅ Verificar configuración de WhatsApp/Email services

### Modal de recordatorios no abre
- ✅ Verificar `ReminderModal` está importado
- ✅ Verificar estado `isReminderModalOpen` está definido
- ✅ Verificar botón tiene `onClick` correcto

---

## 📝 Notas Adicionales

- **Pagos Parciales**: La visualización ya existía, no se necesitó cambio importante
- **Packs**: Totalmente nuevo, reemplaza sistema anterior de un único pack
- **Recordatorios**: Sistema completo (BD + API + UI + Scheduler)

---

**¿Necesitas ayuda con algún paso?** 🚀
