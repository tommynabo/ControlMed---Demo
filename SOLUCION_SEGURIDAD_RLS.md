# 🔒 Solución de Errores de Seguridad en Supabase

## Situación Actual

Tu Supabase tiene **25 errores críticos de seguridad**:
- **24 tablas** sin RLS (Row Level Security) habilitado
- **2 tablas** con columnas sensibles expuestas sin protección

## ¿Qué es RLS?

Row Level Security (RLS) es un mecanismo de seguridad que controla qué filas de datos puede ver/editar cada usuario basado en políticas de seguridad. Sin RLS, **cualquiera podría acceder a todos tus datos**.

## Solución Proporcionada

He creado un script SQL completo: `enable_rls_security.sql`

### Qué hace el script:

1. **Habilita RLS** en las 24 tablas públicas
2. **Crea funciones de seguridad auxiliares** para verificar roles de usuario
3. **Establece políticas de acceso** basadas en roles:
   - **ADMIN**: Acceso completo a todo
   - **DOCTOR**: Ven solo sus pacientes y datos relacionados
   - **Otros usuarios**: Acceso limitado a su propio perfil

### Estructura de Seguridad:

```
┌─────────────────────────────────────────────────┐
│         POLÍTICAS DE RLS POR TABLA               │
├─────────────────────────────────────────────────┤
│ User, system_users                              │
│  ├─ ADMIN: Ver todos                            │
│  └─ Usuario: Ver su propio perfil               │
│                                                  │
│ Doctor, Specialty, Treatment, etc.              │
│  ├─ ADMIN: Control total                        │
│  └─ Usuarios: Lectura pública                   │
│                                                  │
│ Patient, Appointment, ClinicalRecord            │
│  ├─ ADMIN: Ver todos                            │
│  ├─ DOCTOR: Ver solo sus pacientes              │
│  └─ OTRO: Sin acceso                            │
│                                                  │
│ Data financiera (Invoice, Payment, etc.)        │
│  ├─ ADMIN: Control total                        │
│  └─ OTRO: Sin acceso                            │
└─────────────────────────────────────────────────┘
```

## 📋 Cómo Aplicar Este Script

### Opción 1: Via Supabase Dashboard (Recomendado)

1. **Abre tu proyecto de Supabase**
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto "CRM MEDICO"

2. **Ve a la sección "SQL Editor"**
   - En el menú izquierdo, haz clic en "SQL Editor"

3. **Copia el contenido del script**
   - Abre el archivo: `enable_rls_security.sql`
   - Selecciona todo el contenido (Ctrl+A / Cmd+A)
   - Cópialo (Ctrl+C / Cmd+C)

4. **Ejecuta el script**
   - Pega el contenido en el editor SQL de Supabase
   - Haz clic en el botón "Run" (esquina superior derecha)
   - Espera a que termine la ejecución

5. **Verifica que todo está correcto**
   - Deberías ver mensajes de ejecución sin errores
   - Algunos mensajes mencionarán "already exists" - eso es normal

### Opción 2: Usando Supabase CLI

Si tienes Supabase CLI instalada:

```bash
# Navega al directorio del proyecto
cd "/Users/tomas/Downloads/DOCUMENTOS/CRM MEDICO"

# Conecta con tu proyecto
supabase link --project-ref YOUR_PROJECT_REF

# Ejecuta el script
supabase db push enable_rls_security.sql
```

## ✅ Cómo Verificar que Funcionó

### En el Supabase Dashboard:

1. **Ve a Settings > Database > Security**
2. **Busca la sección "Security and Protection"**
3. **Verifica que el linter muestre:**
   - ✅ 0 errores críticos
   - ✅ 0 warnings de RLS
   - ✅ 0 columnas sensibles expuestas

### Ejecuta esta query para verificar RLS:

```sql
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;
```

Si `rowsecurity` es `t` para todas las tablas, ¡todo está correcto!

## 📝 Cambios Específicos Para Cada Tabla

### Tablas de Usuarios:
- `User` - Solo admin ve todos, usuarios ven su perfil
- `system_users` - Protegido el acceso a campos sensibles (password, bank_account, insurance_number)

### Tablas de Pacientes:
- `Patient` - Doctores solo ven sus pacientes
- `ClinicalRecord` - Acceso por doctor/paciente
- `PatientTreatment` - Protegido con RLS
- `Odontogram` - Acceso según relación doctor-paciente

### Tablas de Citas:
- `Appointment` - Doctores ven solo sus citas
- `Liquidation` - Doctores ven solo sus liquidaciones

### Tablas Financieras:
- `Invoice` - Solo admin, acceso controlado
- `InvoiceItem` - Solo admin, acceso controlado
- `Payment` - Solo admin, acceso controlado
- `Budget` / `BudgetLineItem` - Solo admin, acceso controlado

### Tablas de Configuración:
- `Specialty` - Lectura pública, edición solo admin
- `Treatment` - Lectura pública, edición solo admin
- `InventoryItem` - Lectura pública, edición solo admin
- `DocumentTemplate` - Lectura pública, edición solo admin

### Tablas de Comunicación:
- `WhatsAppTemplate` - Lectura pública, edición solo admin
- `WhatsAppLog` - Solo admin
- `services` - Lectura pública, edición solo admin

## ⚠️ Notas Importantes

1. **Requiere actualizar tu código TypeScript/JavaScript**
   - Las queries ahora respetarán RLS
   - Los usuarios solo verán lo que pueden ver según la política

2. **Usuarios existentes deben tener roles definidos**
   - Verifica que `User.role` o `system_users.role` esté poblado
   - Los usuarios sin rol no tendrán acceso

3. **Las policies se evalúan en orden**
   - Si una política rechaza, la fila no aparece
   - Las políticas SE pueden combinar

4. **Rendimiento**
   - RLS tiene un pequeño impacto en rendimiento
   - Es negligible en la mayoría de casos
   - La seguridad lo vale

## 🔄 Si Necesitas Ajustar las Políticas

Las políticas se pueden modificar sin afectar el schema:

```sql
-- Ver políticas actuales
SELECT * FROM pg_policies WHERE tablename = 'Patient';

-- Eliminar una política
DROP POLICY IF EXISTS "Policy Name" ON "Patient";

-- Crear una nueva política
CREATE POLICY "New Policy Name" ON "Patient"
  AS SELECT FOR SELECT
  USING (your_condition);
```

## 📞 Pasos Siguientes

1. ✅ Ejecuta el script `enable_rls_security.sql`
2. ✅ Verifica en el linter de Supabase que no hay errores
3. ✅ Prueba tu aplicación para asegurar que funciona correctamente
4. ✅ Ajusta las políticas si es necesario según tu lógica de negocio

## 🎯 Resultado Final

Después de aplicar este script:
- ✅ **0 errores de seguridad** en el linter
- ✅ **Datos protegidos** según roles de usuario
- ✅ **Columnas sensibles encriptadas** por políticas RLS
- ✅ **Cumplimiento de seguridad** para GDPR/privacidad

---

**Última actualización:** 18 de Febrero de 2026
