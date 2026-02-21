# ⚡ Quick Start - Configuración de Horarios en 5 Minutos

## 🚀 Comenzar Ahora

### PASO 1: Ve a Configuración
```
1. Abre tu CRM
2. Haz clic en el icono ⚙️ (esquina inferior izquierda)
3. Selecciona: "Configuración"
4. En el menú izquierdo: "General" → "Horarios"
```
✅ Deberías ver: "Horarios Médicos" con botón "➕ Nuevo Horario"

---

### PASO 2: Crea Horario para un Doctor
```
1. Haz clic en "➕ Nuevo Horario"
2. Aparece: "🔍 Selecciona un Doctor"
3. Empieza a escribir: "Chrab"
4. Haz clic en: "Dr. Chrabieh"
```
✅ Se abre modal con "Dr. Chrabieh" (NO editable)

---

### PASO 3: Configura los Días
```
Días Laborales:
[L] [M] [X] [J] [V] [✗] [✗]
 ✓   ✓   ✓   ✓   ✓   ✗   ✗

(Dentro de Horarios: Deselecciona SOLO si necesitas)
```
✅ Por defecto: Lunes-Viernes

---

### PASO 4: Configura Horarios
```
☀️ TURNO MAÑANA
  Inicio: 09:00
  Fin:    13:00

🌙 TURNO TARDE
  Inicio: 16:00
  Fin:    20:00
```
✅ Valores  predeterminados listos

---

### PASO 5: Guarda
```
[Cancelar]  [Guardar] ← Haz clic aquí
```
✅ Aparece: "Horario guardado correctamente ✓"

---

## 📋 Lista de Doctores a Configurar

### 📌 Checa esta lista

```
□ Dr. Chrabieh
  Email: kevinchrabieh@gmail.com
  Horarios: Lunes-Viernes
  
□ Dr. ROO (Pablo Roo Blanco)
  Email: pablorooblanco@gmail.com
  Horarios: Lunes-Viernes
  
□ Dra. Concejero
  Email: blati98172023@hotmail.com
  Horarios: Lunes-Viernes
  
□ Dra. Castay
  Email: castaycaroline@gmail.com
  Horarios: Lunes, Martes, Jueves, Viernes (SIN Miércoles)
  
□ Alvaro Babiano
  Email: alvarobabianon@uic.es
  Horarios: Lunes, Martes, Miércoles, Viernes (SIN Jueves)
  
□ Elissa
  Email: elissaeid@uic.es
  Horarios: Lunes-Viernes
```

**Copiar-Pega en la búsqueda:** Dr. / Dra. / Alvaro / Elissa

---

##  🔍 Verificaración Rápida

Después de crear 2-3 horarios, verifica:

### Test 1: Visualizar Configurados
```
En Settings → Horarios
Deberías ver tarjetas con los doctores:

┌─────────────────────────┐
│ Dr. Chrabieh            │
│ Mañana: 09:00 - 13:00   │
│ Tarde:  16:00 - 20:00   │
│ L M X J V - -           │
│ [✏️] [🗑️]              │
└─────────────────────────┘
```
✅ Si ves esto → CORRECTO

---

### Test 2: Filtrado en Agenda
```
1. Ve a Agenda
2. Haz clic en selector de doctor (arriba a la derecha)
3. Selecciona: "Dr. Chrabieh"
4. Observa los horarios
```
✅ ESPERADO: Solo estos slots aparecen
- 09:00, 09:15, 09:30... 12:45 (Mañana)
- 16:00, 16:15, 16:30... 19:45 (Tarde)

❌ NO DEBERÍAS VER:
- 13:00-15:59 (Descanso)
- 20:00+ (Cerrado)

---

### Test 3: Cambio de Día
```
1. Sigue en Agenda con Dr. Chrabieh
2. Haz clic en: "❮ Miércoles ❯"
3. Observa el listado de horarios
```
✅ ESPERADO (Dr. Chrabieh): 
- Lunes-Viernes: ✓ Horarios visibles
- Sábado-Domingo: ❌ VACÍO (no trabaja)

⚠️ ESPECIAL (Dra. Castay): 
- Lunes, Martes, Jueves, Viernes: ✓ Horarios visibles
- Miércoles: ❌ VACÍO (no trabaja este día)

---

## 🎯 Resumen Visual

### Antes ❌
```
Búsqueda:   "Ej: Dr. Juan..." ← Manual
Vinculación: Nombre de texto ← No confiable
Guardado:    ??? ← No funciona
Agenda:      Todos los slots ← Sin filtro
```

### Ahora ✅
```
Búsqueda:    🔍 Autocompletado en tiempo real ← Filtros mientras escribes
Vinculación: 🔗 doctor_id del sistema ← Único y confiable
Guardado:    ☁️  Supabase sincronizado ← Garantizado
Agenda:      📅 Solo slots disponibles ← Filtrado automático
```

---

##  ⚠️ Errores Comunes

### ❌ "No se encontraron doctores"
**Solución:** Escribe solo "Chrab" (no "Dr. Chrab")

### ❌ Los horarios no aparecen en Agenda
**Solución:** Recarga la página (Ctrl+Shift+Del)

### ❌ No se puede seleccionar el doctor
**Solución:** Verifica que hiciste clic en el doctor (no solo escribiste)

### ❌ Se guarda pero "Horario guardado" no aparece
**Solución:** Revisa F12 → Console (debería decir "✓")

---

## 📞 Quick Debug

Si algo falla, en el navegador abre **F12** y ejecuta:

```javascript
// Ver doctores del sistema
api.systemUsers.getAll().then(u => console.log(u.filter(x => x.role === 'DOCTOR')))

// Ver horarios guardados
api.doctorSchedules.getAll().then(s => console.log(s))

// Verificar tu selección actual  
console.log({selectedDoctorId, doctorSchedules})
```

**Pegue el output en un mensaje** si hay problema.

---

##  ✨ Features Extra (Si Quieres Editar)

### Editar un horario existente:
```
1. En Settings → Horarios
2. Haz clic en el icono ✏️ (lápiz)
3. Se abre el modal con los datos actuales
4. Modifica lo que necesites
5. Haz clic en "Guardar" ✓
```

### Eliminar un horario:
```
1. En Settings → Horarios
2. Haz clic en el icono 🗑️ (papelera)
3. Confirma: "¿Eliminar horario de Dr. ...?"
4. Se marca como inactivo
```

---

## 🎬 Video Tutorial (Si Disponible)

Enlace a video demo:
`https://[TU_DOMINIO]/docs/video-horarios-tutorial.mp4`

Duración: ~5 minutos

---

## ✅ Checklist Final

Después de configurar todos los doctores:

- [ ] Creé horarios para al menos 3 doctores
- [ ] Verifiqué que aparecen en Settings → Horarios
- [ ] Probé en Agenda seleccionando cada doctor
- [ ] Verifiqué que los slots se filtran correctamente
- [ ] Cambié de día (incluyendo días sin trabajo)
- [ ] Probé editar un horario existente
- [ ] Todo funciona como se espera ✓

---

## 🎓 Siguiente: Integración WhatsApp

Próximamente:
- Automáticamente enviar horarios disponibles a clientes
- Integración con calendario compartido
- Sincronización con Google Calendar

---

**¿Listo?** ⚡ Comienza desde PASO 1

**¿Problema?** 🚨 Ve a [TROUBLESHOOTING_HORARIOS.md](TROUBLESHOOTING_HORARIOS.md)

**¿Oficial?** 📖 Lee [CONFIGURACION_HORARIOS_ACTUALIZADA.md](CONFIGURACION_HORARIOS_ACTUALIZADA.md)

---

**Versión:** 1.0  
**Actualizado:** 21 de Febrero, 2026  
**Estado:** ✅ LISTO PARA USAR
