export interface ConsentTemplate {
    id: string;
    title: string;
    category: 'Médico' | 'Privacidad' | 'Financiero';
    content: string;
}

export const CONSENT_TEMPLATES: ConsentTemplate[] = [
    {
        id: 'template-1',
        title: 'Consentimiento Informado General',
        category: 'Médico',
        content: 'CONSENTIMIENTO INFORMADO - TRATAMIENTO DENTAL\n\nPACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | FECHA: {{TODAY}}\n\nHe sido informado/a sobre:\n- La naturaleza de mi condición dental\n- Los tratamientos propuestos y sus beneficios\n- Los posibles riesgos y complicaciones\n- Las alternativas terapéuticas disponibles\n- La duración estimada del tratamiento\n\nDECLARO que otorgo mi CONSENTIMIENTO VOLUNTARIO para los tratamientos acordados.\n\nFIRMA DEL PACIENTE: ________________________  FIRMA DEL DOCTOR: ________________________'
    },
    {
        id: 'template-2',
        title: 'Consentimiento para Anestesia',
        category: 'Médico',
        content: 'CONSENTIMIENTO INFORMADO PARA ANESTESIA\n\nPACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | FECHA: {{TODAY}}\n\nHe sido informado/a que la anestesia a utilizarse es:\n- Anestesia Local\n- Sedación Ligera\n- Óxido Nitroso\n\nRIESGOS: Reacción alérgica (rara), síntomas temporales menores\n\nCUIDDOS POST-OPERATORIOS:\n- No conducir durante 24 horas\n- Evitar comidas calientes\n- Seguir instrucciones del personal\n\nACEPTO el procedimiento con anestesia.\n\nFIRMA DEL PACIENTE: ________________________  FIRMA DEL ANESTESIÓLOGO: ________________________'
    },
    {
        id: 'template-3',
        title: 'Protección de Datos RGPD',
        category: 'Privacidad',
        content: 'CONSENTIMIENTO PARA TRATAMIENTO DE DATOS - RGPD\n\nEn conformidad con el Reglamento (UE) 2016/679 (RGPD):\n\nRESPONSABLE: {{CLINIC_NAME}}\nDATOS A PROCESAR: Historia clínica, radiografías, datos de contacto\n\nFINALIDADES:\n- Prestación de servicios médicos-dentales\n- Facturación\n- Cumplimiento de obligaciones legales\n- Seguimiento post-tratamiento\n\nDERECHOS: Acceso, rectificación, supresión, portabilidad de datos\n\nCONSENTIMIENTO:\n- Autorizo el tratamiento de mis datos\n- Autorizo comunicaciones de seguimiento\n- Autorizo uso estadístico (anonimizado)\n\nFIRMA DEL PACIENTE: ________________________  FECHA: {{TODAY}}'
    },
    {
        id: 'template-4',
        title: 'Procedimientos Quirúrgicos',
        category: 'Médico',
        content: 'CONSENTIMIENTO PARA CIRUGÍA ORAL\n\nPACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | PROCEDIMIENTO: {{PROCEDURE}} | FECHA: {{TODAY}}\n\nHe sido informado/a sobre:\n- Naturaleza de la cirugía\n- Riesgos: sangrado, hinchazón, infección (rara), cambios de sensibilidad\n- Cuidados post-operatorios: hielo, reposo, antibióticos si procede\n\nCUIDDOS ESPECIALES:\n1. Aplicar hielo 15 min/hora durante 24h\n2. Evitar actividad física 3-7 días\n3. Dieta blanda la primera semana\n4. No fumar ni alcohol 48 horas\n\nEMERGENCIA: Contactar si fiebre >38.5°C, sangrado abundante\n\nACEPTO los riesgos y compromisos del procedimiento.\n\nFIRMA DEL PACIENTE: ________________________  FIRMA DEL CIRUJANO: ________________________'
    },
    {
        id: 'template-5',
        title: 'Responsabilidad Financiera',
        category: 'Financiero',
        content: 'ACUERDO DE RESPONSABILIDAD FINANCIERA\n\nPACIENTE: {{PATIENT_NAME}} | FECHA: {{TODAY}}\n\nTÉRMINOS DE PAGO:\n- Aceptación de formas de pago: efectivo, tarjeta, transferencia\n- Presupuestos válidos por 30 días\n- Planes de pago disponibles bajo criterio clínico\n\nCANCELACIÓN DE CITAS:\n- Cancelación >24h: Sin cargo\n- Cancelación <24h: 50% de la cita\n- No presentación: 100%\n\nDEUDA Y COBRANZA:\n- Facturas vencidas > 30 días generan intereses\n- Deudas importantes pueden derivarse a agencia de cobro\n\nSEGURO: La clínica no responde por rechazos de seguro\n\nHe recibido y comprendido este acuerdo financiero.\n\nFIRMA DEL PACIENTE: ________________________  FIRMA ADMINISTRACIÓN: ________________________'
    }
];
