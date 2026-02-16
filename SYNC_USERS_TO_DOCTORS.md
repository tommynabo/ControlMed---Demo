# 🔄 Sincronización de Doctores: User → Doctor

**Fecha:** 16 de Febrero, 2026

---

## 📋 Problema

Los doctores están registrados en la tabla `User` con `role='DOCTOR'`, pero el sistema necesita que también estén en la tabla `Doctor` para funcionar correctamente.

---

## ✅ Solución

### **Paso 1: Ejecutar la migración SQL**

Ve a tu consola SQL en Supabase y copia/pega este comando:

```sql
-- Sincronizar Usuarios Doctores a Tabla Doctor
INSERT INTO "Doctor" (id, name, specialization, "commissionPercentage")
SELECT 
    u.id,
    u.name,
    'Odontólogo' as specialization,
    0.0 as "commissionPercentage"
FROM "User" u
WHERE u.role = 'DOCTOR'
  AND u.id NOT IN (SELECT id FROM "Doctor")
ON CONFLICT (id) DO NOTHING;
```

**Esto hará:**
- ✅ Busca todos los usuarios con `role='DOCTOR'` en la tabla `User`
- ✅ Inserta cada uno en la tabla `Doctor` con su ID y nombre
- ✅ Asigna "Odontólogo" como especialización por defecto
- ✅ Comisión inicial: 0%
- ✅ Si ya existen, no hace nada (ON CONFLICT)

---

### **Paso 2: Verificar que funcionó**

Ejecuta esta query para ver cuántos doctores se sincronizaron:

```sql
SELECT 
    COUNT(*) as total_doctores,
    COUNT(DISTINCT u.id) as doctores_de_usuarios
FROM "Doctor" d
LEFT JOIN "User" u ON d.id = u.id AND u.role = 'DOCTOR';
```

---

### **Paso 3: Ver la lista de doctores**

```sql
SELECT id, name, specialization, "commissionPercentage" 
FROM "Doctor" 
ORDER BY name;
```

---

## 🔄 Conexión Bidireccional

Ahora la tabla `User` y `Doctor` están sincronizadas:

```
┌─────────────────────┐
│       User          │
├─────────────────────┤
│ id (PK)             │
│ name                │──────┐
│ email               │      │
│ role = 'DOCTOR'     │      │
│ doctorId (FK)       │      │
└─────────────────────┘      │
                             │ LINKED
                             │
┌─────────────────────┐      │
│      Doctor         │      │
├─────────────────────┤      │
│ id (PK) ◄───────────┼──────┘
│ name                │
│ specialization      │
│ commissionPercentage│
└─────────────────────┘
```

---

## 📊 Datos Sincronizados

**De la tabla User:**
- `id` → Será el ID del doctor
- `name` → Nombre del doctor
- `role = 'DOCTOR'` → Identificador de que es doctor

**En la tabla Doctor:**
- `id` ← Viene del `User.id`
- `name` ← Viene del `User.name`
- `specialization` ← "Odontólogo" (configurable después)
- `commissionPercentage` ← 0% (puedes modificar)

---

## 🎯 Resultado

Después de ejecutar el SQL:

✅ Los doctores aparecerán en el selector de la Agenda
✅ Los doctores estarán disponibles para crear citas
✅ El error "Doctor no encontrado" se resolverá
✅ Puedes editar especialización y porcentaje de comisión en cada doctor

---

## 📝 Notas Importantes

1. **No causa daño ejecutar 2 veces:** El `ON CONFLICT (id) DO NOTHING` previene duplicados
2. **Los datos originales de User quedan intactos**
3. **Puedes actualizar especialización después:** 
   ```sql
   UPDATE "Doctor" SET specialization = 'Odontólogo Especialista' WHERE name = 'Dr. Juan Pérez';
   ```

4. **Para agregar nuevos doctores en el futuro:**
   - Crear usuario en Users con role='DOCTOR'
   - Ejecutar el SQL de sincronización nuevamente
   - O crear manualmente en tabla Doctor

---

## 🔗 Archivo SQL Completo

El archivo `supabase_sync_users_to_doctors.sql` contiene todo lo necesario y está listo para ejecutar.

