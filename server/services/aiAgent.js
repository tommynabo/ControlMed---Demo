
const OpenAI = require('openai');
const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');

// Lazy Init to prevent crash if Key is missing on startup
let openai;
function getOpenAI() {
    if (!openai) {
        if (!process.env.OPENAI_API_KEY) throw new Error("Missing OPENAI_API_KEY");
        openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
    return openai;
}

// Supabase client helper
function getSupabase() {
    const URL = process.env.SUPABASE_URL || "https://gnnacijqglcqonholpwt.supabase.co";
    const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdubmFjaWpxZ2xjcW9uaG9scHd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODQ3NjU0NCwiZXhwIjoyMDg0MDUyNTQ0fQ.6qexkezsBpOhvTch_eRsr8lF_mixdp9sfv0ScjUmxp4";
    return createClient(URL, KEY);
}

// Treatment prices catalog (default prices for common dental treatments)
const TREATMENT_CATALOG = {
    'extraccion': { name: 'Extracción dental', price: 80, status: 'EXTRACTED' },
    'extracción': { name: 'Extracción dental', price: 80, status: 'EXTRACTED' },
    'extraction': { name: 'Extracción dental', price: 80, status: 'EXTRACTED' },
    'endodoncia': { name: 'Endodoncia', price: 250, status: 'ENDODONCIA' },
    'empaste': { name: 'Empaste/Obturación', price: 60, status: 'FILLED' },
    'obturacion': { name: 'Obturación', price: 60, status: 'FILLED' },
    'obturación': { name: 'Obturación', price: 60, status: 'FILLED' },
    'limpieza': { name: 'Limpieza dental', price: 50, status: 'HEALTHY' },
    'corona': { name: 'Corona', price: 400, status: 'CROWN' },
    'implante': { name: 'Implante dental', price: 1200, status: 'IMPLANT' },
    'blanqueamiento': { name: 'Blanqueamiento', price: 300, status: 'HEALTHY' },
    'ortodoncia': { name: 'Ortodoncia', price: 2500, status: 'ORTHO' },
    'caries': { name: 'Tratamiento caries', price: 80, status: 'CARIES' },
    'funda': { name: 'Funda dental', price: 350, status: 'CROWN' },
    'reconstruccion': { name: 'Reconstrucción', price: 150, status: 'RECONSTRUCTED' },
    'reconstrucción': { name: 'Reconstrucción', price: 150, status: 'RECONSTRUCTED' }
};

async function processQuery(userQuery, userInfo = {}, extraContext = {}) {
    try {
        const supabase = getSupabase();
        const userRole = userInfo.role || 'DOCTOR';
        const userId = userInfo.id || null;
        const doctorId = userInfo.doctorId || null;

        console.log("AI DEBUG: Processing query with role:", userRole, "Query:", userQuery.substring(0, 100));

        const isVIP = userRole === 'ADMIN';
        const isDoctor = userRole === 'DOCTOR';
        const canModify = isVIP || isDoctor; // Both can modify patient data

        // 1. Gather Context with Role-Based Filtering
        let patientsQuery = supabase.from('Patient').select('id, name, email, phone, dni, insurance, assignedDoctorId, createdAt').limit(20);

        if (isDoctor && doctorId) {
            patientsQuery = patientsQuery.eq('assignedDoctorId', doctorId);
        }

        const { data: patients, error: patientsError } = await patientsQuery;
        if (patientsError) console.error("AI: Error fetching patients:", patientsError.message);

        // [NEW] Fetch Active Patient Context
        let activePatient = null;
        let activePatientOdontogram = null;
        if (extraContext.patientId) {
            const { data: ap } = await supabase.from('Patient').select('*').eq('id', extraContext.patientId).single();
            if (ap) {
                activePatient = ap;
                // Fetch recent history/odontogram for this patient
                const { data: od } = await supabase.from('Odontogram').select('teethState').eq('patientId', ap.id).single();
                activePatientOdontogram = od;
            }
        }

        // Fetch treatments catalog for pricing
        const { data: treatments } = await supabase.from('Treatment').select('id, name, price');

        // Fetch inventory
        const { data: stock } = await supabase.from('InventoryItem').select('*');

        // Fetch appointments
        let appointmentsQuery = supabase.from('Appointment').select('*').gte('date', new Date().toISOString()).limit(15);
        if (isDoctor && doctorId) appointmentsQuery = appointmentsQuery.eq('doctorId', doctorId);
        const { data: appointments } = await appointmentsQuery;

        // Fetch liquidations (ADMIN only)
        let liquidations = [];
        if (isVIP) {
            const { data: liqData } = await supabase.from('Liquidation').select('*').order('createdAt', { ascending: false }).limit(10);
            liquidations = liqData || [];
        }

        // Fetch available doctors for context
        const { data: availableDoctors } = await supabase.from('Doctor').select('id, name, specialization').order('name');
        const doctorsList = (availableDoctors || []).map(d => `${d.name} (${d.specialization || 'General'})`).join(', ');

        const constraints = canModify
            ? `USER ROLE: ${userRole}. Tienes permiso COMPLETO para modificar fichas de pacientes, odontogramas, crear presupuestos, y añadir historias clínicas.`
            : "USER ROLE: RECEPTION. Acceso de solo lectura. No puedes modificar datos.";

        const context = `
        CONTEXTO DEL SISTEMA (Rol: ${userRole}):
        - Fecha actual: ${new Date().toLocaleDateString('es-ES')}
        - Hora actual: ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
        
        ${activePatient ? `
        ======== PACIENTE ACTIVO (CONFIRMADO) ========
        Estás viendo la ficha de: **${activePatient.name}** (DNI: ${activePatient.dni})
        - ID: ${activePatient.id}
        - Email: ${activePatient.email}
        - Teléfono: ${activePatient.phone}
        ${activePatientOdontogram ? '- Odontograma existente: SÍ' : '- Odontograma: No iniciado'}
        
        NOTA IMPORTANTE: El usuario probablemente se refiera a este paciente ("este paciente", "añádele", "su historia").
        Usa el nombre "${activePatient.name}" por defecto en las herramientas si no se especifica otro.
        ==============================================
        ` : '- No hay paciente seleccionado explícitamente.'}

        - Otros pacientes en sistema: ${JSON.stringify((patients || []).slice(0, 5).map(p => ({ name: p.name, dni: p.dni })))}
        - Doctores disponibles: ${doctorsList}
        - Catálogo de tratamientos: ${JSON.stringify(treatments || [])}
        - Citas próximas: ${JSON.stringify((appointments || []).slice(0, 5).map(a => ({ date: a.date, time: a.time, status: a.status })))}
        
        ${constraints}

        Eres ControlMed AI, el asistente inteligente de la clínica dental.
        
        ⚠️⚠️⚠️ REGLA MÁS IMPORTANTE — RECOPILAR INFORMACIÓN ANTES DE ACTUAR:
        NUNCA ejecutes una herramienta/acción sin tener TODA la información necesaria.
        Si el usuario pide crear una cita, presupuesto, receta, o cualquier acción, PRIMERO debes preguntar
        por TODOS los campos que faltan. Solo cuando tengas TODOS los datos, ejecuta la herramienta.
        
        CAMPOS OBLIGATORIOS POR ACCIÓN:
        - **Crear cita (create_appointment)**: nombre del paciente, fecha (YYYY-MM-DD), hora (HH:MM), doctor asignado, duración (15/30/45/60/90/120 min), tipo de tratamiento/motivo
        - **Crear presupuesto (create_budget)**: nombre del paciente, lista de tratamientos con nombre, precio unitario, cantidad, diente (si aplica)
        - **Crear receta (create_prescription)**: nombre del paciente, medicamento completo (principio activo), dosis, frecuencia/posología, duración del tratamiento, instrucciones especiales
        - **Nota clínica (add_clinical_record)**: nombre del paciente, tratamiento realizado, observación detallada, especialidad
        - **Odontograma (update_odontogram_and_create_budget)**: nombre del paciente, dientes afectados (números válidos 11-48), tipo de tratamiento por diente
        
        FLUJO CORRECTO:
        1. El usuario pide una acción (ej: "pon una cita a las 8")
        2. TÚ identificas qué información falta (paciente, fecha, doctor, duración, motivo...)
        3. TÚ preguntas TODA la información faltante de forma clara y organizada
        4. El usuario responde con los datos
        5. TÚ resumes lo que vas a hacer y pides confirmación: "¿Confirmo esta acción?"
        6. El usuario dice "sí" / "confirmar" / "ok"
        7. SOLO ENTONCES ejecutas la herramienta
        
        Si el usuario dice "añade a este paciente" o "su historia", REFIÉRETE AL PACIENTE ACTIVO (${activePatient ? activePatient.name : 'Desconocido'}).

        FORMATO DE RESPUESTA:
        - Usa SIEMPRE listas Markdown (-) para enumerar acciones, tratamientos o datos.
        - Usa **negrita** para resaltar precios, nombres de pacientes y conceptos clave.
        - Si hay múltiples pasos, sepáralos claramente.
        
        BÚSQUEDA DE PACIENTES:
        - El sistema busca pacientes de forma parcial e insensible a mayúsculas (fuzzy).
        - Si el usuario dice solo un nombre (ej: "Kevin"), usa ese nombre directamente en la herramienta — el sistema encontrará coincidencias parciales (ej: "Kevin Chrabieh").
        - NO pidas el nombre completo si el usuario ya dio un nombre parcial. Deja que el sistema busque.

        MANEJO DE ERRORES:
        - Si el usuario indica un número de diente inválido (ej: "diente 1"), asume que es un error tipográfico y corrígelo si es obvio.
        - Si hay errores tipográficos en los comandos (ej: "losdientes"), intenta interpretarlos lógicamente.

        INSTRUCCIONES:
        1. Para EXTRACCIONES + PRESUPUESTO: Usa "update_odontogram_and_create_budget"
        2. Para AÑADIR NOTAS: Usa "add_clinical_record"
        3. Para CREAR CITAS: Usa "create_appointment" (SOLO con TODOS los datos)
        4. Para BUSCAR INFO: Usa "search_patient_info"
        5. Para RECETAS: Usa "create_prescription" (SOLO con datos completos del medicamento)
        
        IMPORTANTE: Cuando el usuario CONFIRME una acción que previamente resumiste, 
        ENTONCES sí ejecuta la herramienta con todos los datos recopilados.
        
        Responde siempre en español.
        
        CATÁLOGO DE PRECIOS:
        - Extracción: 80€
        - Endodoncia: 250€
        - Empaste/Obturación: 60€
        - Corona: 400€
        - Implante: 1200€
        - Limpieza: 50€
        `;


        // 2. Define Tools - Enhanced with full capabilities
        const tools = [
            {
                type: "function",
                function: {
                    name: "update_odontogram_and_create_budget",
                    description: "Actualiza el odontograma del paciente marcando dientes con tratamientos específicos Y crea un presupuesto automáticamente. Usar cuando el usuario pida añadir extracciones, tratamientos, etc.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            treatments: {
                                type: "array",
                                description: "Lista de tratamientos a aplicar",
                                items: {
                                    type: "object",
                                    properties: {
                                        tooth: { type: "integer", description: "Número del diente (ej: 14, 27, 36)" },
                                        treatmentType: { type: "string", description: "Tipo: extraccion, endodoncia, empaste, corona, implante, caries, limpieza" },
                                        notes: { type: "string", description: "Notas adicionales opcionales" }
                                    },
                                    required: ["tooth", "treatmentType"]
                                }
                            },
                            createBudget: { type: "boolean", description: "Si se debe crear presupuesto automáticamente (default: true)" }
                        },
                        required: ["patientName", "treatments"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "update_odontogram",
                    description: "Actualiza solo el odontograma del paciente sin crear presupuesto.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            teeth: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        tooth: { type: "integer", description: "Número del diente" },
                                        status: { type: "string", description: "Estado: EXTRACTED, CARIES, FILLED, CROWN, IMPLANT, ENDODONCIA, HEALTHY" }
                                    },
                                    required: ["tooth", "status"]
                                }
                            }
                        },
                        required: ["patientName", "teeth"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "add_clinical_record",
                    description: "Añadir una nota o registro a la historia clínica del paciente.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            treatment: { type: "string", description: "Nombre del tratamiento realizado" },
                            observation: { type: "string", description: "Observaciones o notas clínicas" },
                            specialization: { type: "string", description: "Especialidad: General, Ortodoncia, Cirugía, Endodoncia, etc." }
                        },
                        required: ["patientName", "treatment", "observation"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "create_budget",
                    description: "Crear un presupuesto para un paciente con tratamientos específicos.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            items: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        name: { type: "string", description: "Nombre del tratamiento" },
                                        price: { type: "number", description: "Precio en euros" },
                                        tooth: { type: "string", description: "Número del diente afectado" },
                                        quantity: { type: "integer", description: "Cantidad (default 1)" }
                                    },
                                    required: ["name", "price"]
                                }
                            }
                        },
                        required: ["patientName", "items"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "create_prescription",
                    description: "Generar una receta médica para un paciente.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            medication: { type: "string", description: "Medicamento y dosis" },
                            instructions: { type: "string", description: "Instrucciones de uso" }
                        },
                        required: ["patientName", "medication", "instructions"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "create_appointment",
                    description: "Crear una cita para un paciente. SOLO usar cuando tengas TODOS los datos: paciente, fecha, hora, doctor, duración y motivo.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            date: { type: "string", description: "Fecha en formato YYYY-MM-DD" },
                            time: { type: "string", description: "Hora en formato HH:MM" },
                            doctorName: { type: "string", description: "Nombre del doctor que atenderá la cita" },
                            duration: { type: "integer", description: "Duración en minutos: 15, 30, 45, 60, 90 o 120" },
                            treatmentType: { type: "string", description: "Tipo de tratamiento o motivo de la cita" },
                            observations: { type: "string", description: "Observaciones o notas adicionales para la cita" }
                        },
                        required: ["patientName", "date", "time", "doctorName", "duration", "treatmentType"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "search_patient_info",
                    description: "Buscar información completa de un paciente incluyendo historia clínica y odontograma.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente a buscar" }
                        },
                        required: ["patientName"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "modify_clinical_record",
                    description: "Modificar una nota o registro existente en la historia clínica del paciente. Usa esto cuando el usuario pida cambiar, actualizar o corregir algo en la historia.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            searchText: { type: "string", description: "Texto a buscar en las notas existentes para identificar cuál modificar" },
                            newContent: { type: "string", description: "Nuevo contenido que reemplazará o actualizará la nota" },
                            action: { type: "string", enum: ["replace", "append", "delete"], description: "Acción: replace=reemplazar contenido, append=añadir al final, delete=eliminar la nota" }
                        },
                        required: ["patientName", "searchText", "newContent"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "delete_clinical_record",
                    description: "Eliminar una nota clínica específica de un paciente.",
                    parameters: {
                        type: "object",
                        properties: {
                            patientName: { type: "string", description: "Nombre del paciente" },
                            searchText: { type: "string", description: "Texto que identifica la nota a eliminar" }
                        },
                        required: ["patientName", "searchText"]
                    }
                }
            }
        ];

        // 3. Detect if query is an action request - force tool usage
        const actionKeywords = ['añade', 'añadir', 'crear', 'crea', 'marcar', 'marca', 'registra', 'registrar',
            'modifica', 'modificar', 'actualiza', 'actualizar', 'extraccion', 'extracción',
            'presupuesto', 'odontograma', 'historia', 'cita', 'receta',
            'elimina', 'eliminar', 'borra', 'borrar', 'cambia', 'cambiar', 'corrige', 'corregir',
            'mismo paciente', 'al mismo', 'además', 'también'];
        const queryLower = userQuery.toLowerCase();
        const isActionRequest = actionKeywords.some(kw => queryLower.includes(kw));

        // 4. Build messages array with chat history for context continuity
        const messages = [{ role: "system", content: context }];

        // Add previous chat history if provided (for patient context)
        if (extraContext.chatHistory && Array.isArray(extraContext.chatHistory)) {
            for (const msg of extraContext.chatHistory.slice(-8)) { // Last 8 messages
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({ role: msg.role, content: msg.content });
                }
            }
        } else {
            // Just add current query
            messages.push({ role: "user", content: userQuery });
        }

        // 5. Call OpenAI with conversation history
        const aiClient = getOpenAI();
        const response = await aiClient.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools,
            tool_choice: "auto"  // Let AI decide — it should ask questions first if data is missing
        });

        const responseMessage = response.choices[0].message;

        // 4. Handle Tool Calls
        if (responseMessage.tool_calls) {
            const results = [];

            for (const toolCall of responseMessage.tool_calls) {
                const args = JSON.parse(toolCall.function.arguments);
                console.log(`AI: Executing tool ${toolCall.function.name} with args:`, JSON.stringify(args).substring(0, 200));

                let result;
                switch (toolCall.function.name) {
                    case "update_odontogram_and_create_budget":
                        result = await handleUpdateOdontogramAndBudget(supabase, args, userInfo);
                        break;
                    case "update_odontogram":
                        result = await handleUpdateOdontogram(supabase, args, userInfo);
                        break;
                    case "add_clinical_record":
                        result = await handleAddClinicalRecord(supabase, args, userInfo);
                        break;
                    case "create_budget":
                        result = await handleCreateBudget(supabase, args, userInfo);
                        break;
                    case "create_prescription":
                        result = await handleCreatePrescription(supabase, args, userInfo);
                        break;
                    case "create_appointment":
                        result = await handleCreateAppointment(supabase, args, userInfo);
                        break;
                    case "search_patient_info":
                        result = await handleSearchPatientInfo(supabase, args, userInfo);
                        break;
                    case "modify_clinical_record":
                        result = await handleModifyClinicalRecord(supabase, args, userInfo);
                        break;
                    case "delete_clinical_record":
                        result = await handleDeleteClinicalRecord(supabase, args, userInfo);
                        break;
                    default:
                        result = { type: 'error', content: `Herramienta desconocida: ${toolCall.function.name}` };
                }

                results.push(result);
            }

            // Combine all results
            if (results.length === 1) {
                return results[0];
            }

            const combinedContent = results.map(r => r.content).join('\n\n');
            return { type: 'action_completed', content: combinedContent };
        }

        return { type: 'text', content: responseMessage.content };

    } catch (error) {
        console.error("AI Error Details:", {
            message: error.message,
            code: error.code,
            keyStatus: process.env.OPENAI_API_KEY ? 'Present' : 'Missing'
        });
        return { type: 'error', content: `AI Error: ${error.message || "Check API Key"}` };
    }
}

async function improveMessage(text, patientName, type = 'whatsapp') {
    try {
        const aiClient = getOpenAI();

        let systemPrompt = "";

        switch (type) {
            case 'clinical_note':
                systemPrompt = `Eres un asistente médico experto en redacción de historias clínicas.
                Tu tarea es reescribir notas rápidas o borradores en un formato clínico profesional, estructurado y preciso.
                
                Reglas:
                1. Usa terminología médica correcta (ej: "dolor de muela" -> "odontalgia").
                2. Estructura la respuesta claramente (Motivo de consulta, Exploración, Diagnóstico, Plan/Tratamiento).
                3. Sé objetivo y formal.
                4. NO inventes información, solo estructura y mejora lo que se te da.
                5. El paciente es: ${patientName || 'el paciente'}.
                6. Devuelve SOLAMENTE el texto mejorado, sin introducciones.`;
                break;

            case 'prescription':
                systemPrompt = `Eres un asistente médico encargado de redactar recetas.
                Tu tarea es generar el TEXTO COMPLETO de una receta médica válida basada en la entrada del usuario.
                
                Reglas:
                1. Formato claro y legible.
                2. Incluye: Nombre del Medicamento (principio activo/comercial), Dosis, Posología (frecuencia), Duración del tratamiento.
                3. Añade recomendaciones estándar según el medicamento (ej: "tomar con comida", "evitar alcohol").
                4. El paciente es: ${patientName || 'el paciente'}.
                5. Devuelve SOLAMENTE el texto de la receta, sin introducciones ni marcas de "Aquí tienes la receta".`;
                break;

            case 'whatsapp':
            default:
                systemPrompt = `Eres un asistente experto en comunicación clínica y atención al paciente. 
                Tu tarea es reescribir borradores de mensajes de WhatsApp para pacientes de forma profesional, cordial y clara.
                
                El mensaje es para el paciente: ${patientName || 'el paciente'}.
                
                Reglas:
                1. Mantén un tono cercano pero profesional.
                2. Sé conciso y directo (es WhatsApp).
                3. Corrige ortografía y gramática.
                4. Si el texto original es muy informal o incompleto, complétalo lógicamente.
                5. NO uses saludos genéricos como "Estimado paciente", usa su nombre si lo tienes o sé neutro.
                6. Devuelve SOLAMENTE el texto mejorado, sin introducciones ni comillas.`;
                break;
        }

        const response = await aiClient.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: text }
            ]
        });
        return response.choices[0].message.content;
    } catch (e) {
        console.error("AI Improve Error:", e);
        if (!process.env.OPENAI_API_KEY) {
            console.error("CRITICAL: OPENAI_API_KEY is missing in environment variables.");
        }
        throw e;
    }
}

// ==================== TOOL HANDLERS ====================

async function findPatient(supabase, patientName, userInfo) {
    let patient = null;

    // 1. Fuzzy Search: try each word of the name individually for partial matching
    if (patientName && patientName.trim().length > 0) {
        // First try full name match
        const { data: patients } = await supabase
            .from('Patient')
            .select('id, name, assignedDoctorId, email, phone')
            .ilike('name', `%${patientName.trim()}%`)
            .limit(5);

        if (patients && patients.length === 1) {
            // Single match — use it directly
            patient = patients[0];
        } else if (patients && patients.length > 1) {
            // Multiple matches — prefer exact match, otherwise take first
            const exact = patients.find(p => p.name.toLowerCase() === patientName.trim().toLowerCase());
            patient = exact || patients[0];
        } else {
            // No results — try searching by individual words (e.g. first name only)
            const words = patientName.trim().split(/\s+/).filter(w => w.length >= 2);
            for (const word of words) {
                const { data: wordResults } = await supabase
                    .from('Patient')
                    .select('id, name, assignedDoctorId, email, phone')
                    .ilike('name', `%${word}%`)
                    .limit(5);
                if (wordResults && wordResults.length === 1) {
                    patient = wordResults[0];
                    console.log(`AI: Fuzzy matched "${patientName}" → ${patient.name} (via word "${word}")`);
                    break;
                }
            }
        }
    }

    // 2. Fallback: Context/Active Patient
    if (!patient && userInfo.activePatientId) {
        const { data: active } = await supabase.from('Patient').select('*').eq('id', userInfo.activePatientId).single();
        if (active) {
            console.log(`AI: Using Active Patient Context: ${active.name}`);
            patient = active;
        }
    }

    if (!patient) return { error: `No se encontró al paciente "${patientName}". Prueba con el nombre o apellido exacto.` };

    // Permission check for doctors
    if (userInfo.role === 'DOCTOR' && userInfo.doctorId && patient.assignedDoctorId !== userInfo.doctorId) {
        return { error: `No tienes permiso para modificar este paciente.` };
    }

    return { patient };
}

async function handleUpdateOdontogramAndBudget(supabase, { patientName, treatments, createBudget = true }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    const results = [];
    const budgetItems = [];

    // 1. Get current odontogram
    const { data: currentOdontogram } = await supabase
        .from('Odontogram')
        .select('*')
        .eq('patientId', patient.id)
        .single();

    let teethState = {};
    try {
        teethState = currentOdontogram?.teethState ? JSON.parse(currentOdontogram.teethState) : {};
    } catch (e) {
        teethState = {};
    }

    // 2. Process each treatment & Grouping Logic
    const groupedTreatments = {}; // { key: { name, price, status, quantity, teeth: [] } }

    for (const t of treatments) {
        try {
            const treatmentKey = t.treatmentType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const catalogEntry = TREATMENT_CATALOG[treatmentKey] || TREATMENT_CATALOG[t.treatmentType.toLowerCase()];

            const status = catalogEntry?.status || t.treatmentType.toUpperCase();
            const price = catalogEntry?.price || 50;
            const name = catalogEntry?.name || t.treatmentType;

            // Validate Tooth
            const toothNum = parseInt(t.tooth);
            if (isNaN(toothNum) || toothNum < 11 || toothNum > 85) {
                console.warn(`Skipping invalid tooth number: ${t.tooth}`);
                continue;
            }

            // Update tooth state (Odontogram always individual)
            teethState[t.tooth.toString()] = {
                status: status,
                notes: t.notes || '',
                updatedAt: new Date().toISOString()
            };

            // Grouping for Budget/Treatments
            if (!groupedTreatments[treatmentKey]) {
                groupedTreatments[treatmentKey] = {
                    name: name,
                    price: price, // Single unit price
                    status: status,
                    quantity: 0,
                    teeth: []
                };
            }
            groupedTreatments[treatmentKey].quantity += 1;
            groupedTreatments[treatmentKey].teeth.push(t.tooth);

            results.push(`• Diente ${t.tooth}: ${name} (${status})`);
        } catch (err) {
            console.error(`Error processing treatment for tooth ${t.tooth}:`, err);
        }
    }

    // Convert grouped items to budgetItems
    Object.values(groupedTreatments).forEach(group => {
        budgetItems.push({
            name: group.name,
            price: group.price * group.quantity, // Total price for the group
            tooth: group.teeth.join(', '), // List of teeth
            quantity: group.quantity,
            unitPrice: group.price
        });
    });

    // 3. Save odontogram
    const teethStateJson = JSON.stringify(teethState);

    if (currentOdontogram) {
        await supabase.from('Odontogram').update({ teethState: teethStateJson }).eq('patientId', patient.id);
    } else {
        await supabase.from('Odontogram').insert([{
            id: crypto.randomUUID(),
            patientId: patient.id,
            teethState: teethStateJson
        }]);
    }

    // 4. Create budget if requested
    let budgetTotal = 0;
    if (createBudget !== false && budgetItems.length > 0) {
        const budgetId = crypto.randomUUID();
        budgetTotal = budgetItems.reduce((sum, item) => sum + item.price * (item.quantity || 1), 0);

        await supabase.from('Budget').insert([{
            id: budgetId,
            patientId: patient.id,
            status: 'DRAFT',
            totalAmount: budgetTotal,
            date: new Date().toISOString()
        }]);

        for (const item of budgetItems) {
            await supabase.from('BudgetLineItem').insert([{
                id: crypto.randomUUID(),
                budgetId: budgetId,
                name: item.name,
                price: item.price,
                tooth: item.tooth,
                quantity: item.quantity || 1
            }]);
        }
    }

    // 4b. [NEW] Save to PatientTreatment table (Source of Truth for connection with Billing/History)
    if (treatments.length > 0) {
        const patientTreatments = treatments.map(t => {
            const treatmentKey = t.treatmentType.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const catalogEntry = TREATMENT_CATALOG[treatmentKey] || TREATMENT_CATALOG[t.treatmentType.toLowerCase()];
            const name = catalogEntry?.name || t.treatmentType;
            const price = catalogEntry?.price || 0;

            return {
                id: crypto.randomUUID(),
                patientId: patient.id,
                serviceName: name,
                toothId: t.tooth,
                price: price,
                status: 'PENDIENTE', // Default status
                notes: t.notes || 'Creado por AI Assistant',
                createdAt: new Date().toISOString()
            };
        });

        const { error: ptError } = await supabase.from('PatientTreatment').insert(patientTreatments);
        if (ptError) console.error("Error creating PatientTreatments from AI:", ptError);
    }

    // 5. Add clinical record
    const clinicalNote = `Tratamientos registrados:\n${results.join('\n')}`;
    await supabase.from('ClinicalRecord').insert([{
        id: crypto.randomUUID(),
        patientId: patient.id,
        date: new Date().toISOString(),
        text: JSON.stringify({
            treatment: 'Actualización odontograma',
            observation: clinicalNote,
            specialization: 'General'
        }),
        authorId: userInfo.id || 'ai-agent'
    }]);

    let response = `✅ **Odontograma actualizado para ${patient.name}**\n\n${results.join('\n')}`;

    if (createBudget !== false && budgetTotal > 0) {
        response += `\n\n💰 **Presupuesto creado:** ${budgetTotal}€`;
    }

    return { type: 'action_completed', content: response };
}

async function handleUpdateOdontogram(supabase, { patientName, teeth }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    const { data: currentOdontogram } = await supabase
        .from('Odontogram')
        .select('*')
        .eq('patientId', patient.id)
        .single();

    let teethState = {};
    try {
        teethState = currentOdontogram?.teethState ? JSON.parse(currentOdontogram.teethState) : {};
    } catch (e) {
        teethState = {};
    }

    const updates = [];
    for (const t of teeth) {
        teethState[t.tooth.toString()] = {
            status: t.status.toUpperCase(),
            updatedAt: new Date().toISOString()
        };
        updates.push(`• Diente ${t.tooth}: ${t.status}`);
    }

    const teethStateJson = JSON.stringify(teethState);

    if (currentOdontogram) {
        await supabase.from('Odontogram').update({ teethState: teethStateJson }).eq('patientId', patient.id);
    } else {
        await supabase.from('Odontogram').insert([{
            id: crypto.randomUUID(),
            patientId: patient.id,
            teethState: teethStateJson
        }]);
    }

    return { type: 'action_completed', content: `✅ Odontograma de ${patient.name} actualizado:\n${updates.join('\n')}` };
}

async function handleAddClinicalRecord(supabase, { patientName, treatment, observation, specialization }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    await supabase.from('ClinicalRecord').insert([{
        id: crypto.randomUUID(),
        patientId: patient.id,
        date: new Date().toISOString(),
        text: JSON.stringify({
            treatment: treatment,
            observation: observation,
            specialization: specialization || 'General'
        }),
        authorId: userInfo.id || 'ai-agent'
    }]);

    return { type: 'action_completed', content: `✅ Historia clínica actualizada para ${patient.name}:\n• Tratamiento: ${treatment}\n• Observación: ${observation}` };
}

async function handleCreateBudget(supabase, { patientName, items }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    const budgetId = crypto.randomUUID();
    const total = items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);

    await supabase.from('Budget').insert([{
        id: budgetId,
        patientId: patient.id,
        status: 'DRAFT',
        totalAmount: total,
        date: new Date().toISOString()
    }]);

    for (const item of items) {
        await supabase.from('BudgetLineItem').insert([{
            id: crypto.randomUUID(),
            budgetId: budgetId,
            name: item.name,
            price: item.price,
            tooth: item.tooth || null,
            quantity: item.quantity || 1
        }]);
    }

    const itemsList = items.map(i => `• ${i.name}: ${i.price}€${i.tooth ? ` (Diente ${i.tooth})` : ''}`).join('\n');
    return { type: 'action_completed', content: `✅ Presupuesto creado para ${patient.name}:\n${itemsList}\n\n💰 **Total: ${total}€**` };
}

async function handleCreatePrescription(supabase, { patientName, medication, instructions }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    const prescriptionNote = `[RECETA]\nMedicamento: ${medication}\nInstrucciones: ${instructions}`;

    await supabase.from('ClinicalRecord').insert([{
        id: crypto.randomUUID(),
        patientId: patient.id,
        date: new Date().toISOString(),
        text: JSON.stringify({
            treatment: 'Receta médica',
            observation: prescriptionNote,
            specialization: 'General'
        }),
        authorId: userInfo.id || 'ai-agent'
    }]);

    return { type: 'action_completed', content: `✅ Receta emitida para ${patient.name}:\n💊 ${medication}\n📋 ${instructions}` };
}

async function handleCreateAppointment(supabase, { patientName, date, time, doctorName, duration, treatmentType, observations }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    // Resolve doctor by name or fall back to logged-in doctor
    let doctorId = userInfo.doctorId;
    let resolvedDoctorName = doctorName || 'Doctor asignado';

    if (doctorName) {
        const { data: doctors } = await supabase
            .from('Doctor')
            .select('id, name')
            .ilike('name', `%${doctorName}%`)
            .limit(1);
        if (doctors && doctors.length > 0) {
            doctorId = doctors[0].id;
            resolvedDoctorName = doctors[0].name;
        }
    }

    if (!doctorId) {
        const { data: doctors } = await supabase.from('Doctor').select('id, name').limit(1);
        if (doctors && doctors.length > 0) {
            doctorId = doctors[0].id;
            resolvedDoctorName = doctors[0].name;
        }
    }

    const appointmentData = {
        id: crypto.randomUUID(),
        date: new Date(date).toISOString(),
        time: time,
        duration: duration || 60,
        patientId: patient.id,
        doctorId: doctorId,
        treatmentName: treatmentType || null,
        observations: observations || null,
        status: 'Scheduled'
    };

    await supabase.from('Appointment').insert([appointmentData]);

    return {
        type: 'action_completed',
        content: `✅ **Cita creada correctamente**\n\n` +
            `- **Paciente:** ${patient.name}\n` +
            `- **Fecha:** ${date}\n` +
            `- **Hora:** ${time}\n` +
            `- **Doctor:** ${resolvedDoctorName}\n` +
            `- **Duración:** ${duration || 60} minutos\n` +
            (treatmentType ? `- **Motivo:** ${treatmentType}\n` : '') +
            (observations ? `- **Observaciones:** ${observations}\n` : '')
    };
}

async function handleSearchPatientInfo(supabase, { patientName }, userInfo) {
    const { data: patients } = await supabase
        .from('Patient')
        .select('*')
        .ilike('name', `%${patientName}%`)
        .limit(1);

    const patient = patients?.[0];
    if (!patient) return { type: 'error', content: `No se encontró al paciente "${patientName}"` };

    // Get clinical records
    const { data: records } = await supabase
        .from('ClinicalRecord')
        .select('*')
        .eq('patientId', patient.id)
        .order('date', { ascending: false })
        .limit(5);

    // Get odontogram
    const { data: odontogram } = await supabase
        .from('Odontogram')
        .select('*')
        .eq('patientId', patient.id)
        .single();

    // Get budgets
    const { data: budgets } = await supabase
        .from('Budget')
        .select('*')
        .eq('patientId', patient.id)
        .order('date', { ascending: false })
        .limit(3);

    let response = `📋 **${patient.name}**\n`;
    response += `• DNI: ${patient.dni}\n`;
    response += `• Email: ${patient.email}\n`;
    response += `• Teléfono: ${patient.phone || 'No registrado'}\n`;

    if (records && records.length > 0) {
        response += `\n📝 **Últimas notas clínicas:**\n`;
        records.forEach(r => {
            let text = r.text;
            try { text = JSON.parse(r.text)?.observation || r.text; } catch (e) { }
            response += `• ${new Date(r.date).toLocaleDateString('es-ES')}: ${text.substring(0, 100)}...\n`;
        });
    }

    if (odontogram) {
        let teethState = {};
        try { teethState = JSON.parse(odontogram.teethState); } catch (e) { }
        const affectedTeeth = Object.keys(teethState).filter(k => teethState[k]?.status !== 'HEALTHY');
        if (affectedTeeth.length > 0) {
            response += `\n🦷 **Dientes con tratamiento:** ${affectedTeeth.join(', ')}\n`;
        }
    }

    if (budgets && budgets.length > 0) {
        response += `\n💰 **Presupuestos:** ${budgets.length} (Total: ${budgets.reduce((s, b) => s + (b.totalAmount || 0), 0)}€)\n`;
    }

    return { type: 'text', content: response };
}

async function handleModifyClinicalRecord(supabase, { patientName, searchText, newContent, action = 'replace' }, userInfo) {
    const { patient, error } = await findPatient(supabase, patientName, userInfo);
    if (error) return { type: 'error', content: error };

    // Find matching clinical records
    const { data: records } = await supabase
        .from('ClinicalRecord')
        .select('*')
        .eq('patientId', patient.id)
        .order('date', { ascending: false });

    if (!records || records.length === 0) {
        return { type: 'error', content: `No se encontraron notas clínicas para ${patient.name}` };
    }

    // Search for the record containing the search text
    let targetRecord = null;
    for (const record of records) {
        let text = record.text;
        try {
            const parsed = JSON.parse(record.text);
            text = parsed.observation || parsed.treatment || record.text;
        } catch (e) { }

        if (text.toLowerCase().includes(searchText.toLowerCase())) {
            targetRecord = record;
            break;
        }
    }

    if (!targetRecord) {
        return { type: 'error', content: `No se encontró ninguna nota que contenga "${searchText}"` };
    }

    // Parse current content
    let currentData = {};
    try {
        currentData = JSON.parse(targetRecord.text);
    } catch (e) {
        currentData = { observation: targetRecord.text };
    }

    // Apply the action
    if (action === 'delete') {
        const { error: deleteError } = await supabase
            .from('ClinicalRecord')
            .delete()
            .eq('id', targetRecord.id);

        if (deleteError) {
            return { type: 'error', content: `Error al eliminar: ${deleteError.message}` };
        }
        return { type: 'action_completed', content: `✅ Nota clínica eliminada de ${patient.name}` };
    }

    // Update content
    if (action === 'append') {
        currentData.observation = (currentData.observation || '') + '\n' + newContent;
    } else {
        // Replace
        currentData.observation = newContent;
    }

    const { error: updateError } = await supabase
        .from('ClinicalRecord')
        .update({ text: JSON.stringify(currentData) })
        .eq('id', targetRecord.id);

    if (updateError) {
        return { type: 'error', content: `Error al actualizar: ${updateError.message}` };
    }

    return { type: 'action_completed', content: `✅ Historia clínica de ${patient.name} actualizada:\n📝 ${newContent}` };
}

async function handleDeleteClinicalRecord(supabase, { patientName, searchText }, userInfo) {
    return handleModifyClinicalRecord(supabase, { patientName, searchText, newContent: '', action: 'delete' }, userInfo);
}

module.exports = {
    processQuery,
    improveMessage
};
