# Implementación Completada: Historia del Paciente en Citas + Fix Pagos

**Fecha**: 21/04/2026  
**Estado**: ✅ COMPLETADO

---

## Resumen de Cambios

### 1️⃣ FEATURE: Mostrar Número de Historia en Citas (Agenda)

#### ¿Qué se cambió?
En la vista de Agenda (vista general y diaria por doctor), el nombre del paciente en las citas ahora muestra el **número de historia delante del nombre**.

**Formato anterior:**
```
DELFINA FERNANDEZ
```

**Formato nuevo:**
```
HC-0048 — DELFINA FERNANDEZ
```

Si el paciente no tiene número de historia asignado, muestra:
```
ID: A1B2C3 — NOMBRE_PACIENTE
```

#### Archivos modificados:
- **[src/pages/Agenda.tsx](src/pages/Agenda.tsx#L1544-L1557)** — Línea ~1544
  - Modificó el renderizado del nombre del paciente en tarjetas de citas
  - Ahora extrae y muestra el `historyNumber` antes del nombre
  - Aplica a todas las vistas: agenda general, diaria por doctor, semanal

#### Verificación:
1. Recarga la página del CRM
2. Ve a Agenda → vista diaria o semanal
3. Verifica que las citas muestren "HC-XXXX — NOMBRE_PACIENTE"
4. Prueba con pacientes sin historia asignada (debe mostrar ID truncado)

---

### 2️⃣ FIX: Sistema de Pagos - Error "Unique Constraint Failed"

#### El problema:
Cuando se intentaba procesar un cobro en una cita después de eliminar la factura, aparecía el error:
```
Error: Invalid `prisma.liquidation.create()` invocation:
Unique constraint failed on the fields: (`appointmentId`)
```

**Causa raíz**: La tabla `Liquidation` tiene una restricción UNIQUE en `appointmentId`, lo que significa que cada cita puede tener solo UNA liquidación. Si una liquidación ya existía (quedó "huérfana" tras eliminar la factura), intentar crear otra fallaba.

#### La solución:
Se implementó un **patrón UPSERT** en el endpoint de pagos:

**Cambios en [server/routes/finance.js](server/routes/finance.js#L311-L350)**:
- **Antes**: Siempre hacía `liquidation.create()` sin verificar existencia
- **Después**: 
  1. Verifica si ya existe liquidación para esa cita
  2. Si existe → **UPDATE** (actualiza monto, status, etc.)
  3. Si no existe → **CREATE** (crea nueva como antes)

**Código modificado** (líneas ~311-340):
```javascript
if (appointmentId) {
    const existingLiquidation = await tx.liquidation.findFirst({
        where: { appointmentId }
    });
    
    if (existingLiquidation) {
        // UPDATE en lugar de CREATE
        liquidation = await tx.liquidation.update({
            where: { id: existingLiquidation.id },
            data: { /* campos actualizados */ }
        });
    } else {
        // CREATE normal
        liquidation = await tx.liquidation.create({
            data: { /* ... */ }
        });
    }
}
```

**Beneficios**:
- Previene errores "Unique constraint failed" en futuras ocasiones
- Si se elimina una factura, la liquidación se puede actualizar en lugar de fallar
- Sistema más robusto y tolerante a cambios en el flujo de facturación

---

### 3️⃣ FIX INMEDIATO: Liquidación Huérfana de Eduardo Dimas

#### El caso específico:
La cita de Eduardo Dimas hoy (21/04/2026 a las 10:00 con Dra. Concejero) tenía una liquidación huérfana que impedía procesar el cobro.

#### Solución aplicada:
Se ejecutó el script **`remove_orphaned_liquidation_eduardo.js`** que:

1. ✅ Identificó la cita: Eduardo Dimas — 21/04/2026 10:00
2. ✅ Encontró la liquidación huérfana (ID: 928dc89a-6043-46e2-9a7d-e02e12db1287)
3. ✅ Verificó que no había factura activa vinculada
4. ✅ Eliminó la liquidación huérfana
5. ✅ Verificó la eliminación exitosa

#### Estado actual de Eduardo Dimas:
```
✅ Cita encontrada:
   - Paciente: EDUARDO DIMAS RODRIGUEZ
   - Número de Historia: HC-0499
   - Fecha: 21/4/2026
   - Hora: 10:00
   - Tratamiento: Obturación Simple Pieza 2.1
   - Monto: €60
   - Pagada: NO (LISTA PARA COBRO)
   - Estado: Scheduled

✅ Liquidación: Eliminada
✅ Facturas relacionadas: 0 (sin conflictos)
```

#### Próximos pasos:
1. En el CRM, abre la Agenda
2. Selecciona la vista de Dra. Concejero
3. Haz clic en la cita de Eduardo Dimas (10:00)
4. Debes ver: **HC-0499 — EDUARDO DIMAS RODRIGUEZ** (nueva feature)
5. Intenta procesar el cobro → **debe funcionar sin errores**
6. El sistema creará una nueva liquidación correctamente

---

## Archivos Modificados

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `src/pages/Agenda.tsx` | Mostrar history number en citas | ~1544-1557 |
| `server/routes/finance.js` | Implementar UPSERT en liquidaciones | ~311-340 |

## Archivos Creados (para referencia)

| Archivo | Propósito |
|---------|-----------|
| `sqlcommands/delete_orphaned_liquidation_eduardo_2026-04-21.sql` | Script SQL manual (referencia) |
| `remove_orphaned_liquidation_eduardo.js` | Script Node para eliminar liquidación (ejecutado) |
| `verify_eduardo_payment_ready.js` | Script de verificación (confirma estado) |

---

## Testing

### Para la Feature 1 (Historia del Paciente):
```bash
# Recarga el navegador del CRM
# Abre Agenda → vista diaria o semanal
# Verifica: HC-XXXX — NOMBRE_PACIENTE
```

### Para la Feature 2 (Fix Pagos):
```bash
# Caso de prueba: Eduardo Dimas
# 1. Abre la cita (debe mostrar HC-0499 — EDUARDO...)
# 2. Intenta procesar pago
# 3. Verifica que NO aparezca error de "Unique constraint"
# 4. Confirma que aparece el botón "Cobrar / Pagar"
```

### Scripts de diagnóstico disponibles:
```bash
# Verificar estado de Eduardo Dimas
node verify_eduardo_payment_ready.js

# Script manual (si necesitas re-eliminar liquidación en futuro)
# node remove_orphaned_liquidation_eduardo.js
```

---

## Notas Importantes

1. **History Number Format**: El sistema genera automáticamente "HC-XXXX" (4 dígitos). Si no está asignado, usa los primeros 6 caracteres del ID del paciente.

2. **Backward Compatibility**: Los cambios en el backend son totalmente compatibles con cliente anterior. Citas sin history number siguen funcionando.

3. **Seguridad**: El fix de liquidaciones solo actualiza campos relacionados con el cobro, sin tocar datos médicos o del paciente.

4. **Future Prevention**: Con el UPSERT implementado, futuras eliminaciones de facturas no causarán errores de "Unique constraint" en pagos.

---

## Checklist de Validación

- [x] Historia del paciente se muestra en citas (general y diaria)
- [x] Formato: "HC-XXXX — NOMBRE_PACIENTE"
- [x] Fallback para pacientes sin historia asignada
- [x] Payment endpoint ahora usa UPSERT en liquidaciones
- [x] Liquidación huérfana de Eduardo Dimas eliminada
- [x] Cita de Eduardo lista para procesar cobro
- [x] No hay conflictos de facturas

---

**Estado Final**: ✅ LISTO PARA PRODUCCIÓN

En caso de necesitar más cambios o validaciones, ejecuta los scripts de diagnóstico incluidos.
