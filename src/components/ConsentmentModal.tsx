import React, { useState } from 'react';
import { X, FileText, Download, Check, Printer } from 'lucide-react';
import { pdfService } from '../services/pdfService';

interface ConsentTemplate {
    id: string;
    title: string;
    category: 'Medical' | 'Privacy' | 'Financial';
    content: string;
}

interface ConsentRecord {
    id: string;
    patientId: string;
    templateId: string;
    title: string;
    signedDate?: string;
    isSigned: boolean;
}

interface ConsentmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientName: string;
    patientId: string;
    currentConsents?: ConsentRecord[];
    onSaveConsent?: (consentId: string, templateId: string, signed: boolean) => Promise<void>;
}

const CONSENT_TEMPLATES: ConsentTemplate[] = [
    {
        id: 'template-1',
        title: 'Consentimiento Informado General',
        category: 'Medical',
        content: `CONSENTIMIENTO INFORMADO - TRATAMIENTO DENTAL

PACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | FECHA: {{TODAY}}

He sido informado/a sobre:
✓ La naturaleza de mi condición dental
✓ Los tratamientos propuestos y sus beneficios
✓ Los posibles riesgos y complicaciones
✓ Las alternativas terapéuticas disponibles
✓ La duración estimada del tratamiento

DECLARO que otorgo mi CONSENTIMIENTO VOLUNTARIO para los tratamientos acordados.

FIRMA DEL PACIENTE: ________________________  FIRMA DEL DOCTOR: ________________________`
    },
    {
        id: 'template-2',
        title: 'Consentimiento para Anestesia',
        category: 'Medical',
        content: `CONSENTIMIENTO INFORMADO PARA ANESTESIA

PACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | FECHA: {{TODAY}}

He sido informado/a que la anestesia a utilizarse es:
☐ Anestesia Local  ☐ Sedación Ligera  ☐ Óxido Nitroso

RIESGOS: Reacción alérgica (rara), síntomas temporales menores

CUIDADOS POST-OPERATORIOS:
- No conducir durante 24 horas
- Evitar comidas calientes
- Seguir instrucciones del personal

ACEPTO el procedimiento con anestesia.

FIRMA DEL PACIENTE: ________________________  FIRMA DEL ANESTESIÓLOGO: ________________________`
    },
    {
        id: 'template-3',
        title: 'Protección de Datos RGPD',
        category: 'Privacy',
        content: `CONSENTIMIENTO PARA TRATAMIENTO DE DATOS - RGPD

En conformidad con el Reglamento (UE) 2016/679 (RGPD):

RESPONSABLE: {{CLINIC_NAME}}
DATOS A PROCESAR: Historia clínica, radiografías, datos de contacto

FINALIDADES:
✓ Prestación de servicios médicos-dentales
✓ Facturación
✓ Cumplimiento de obligaciones legales
✓ Seguimiento post-tratamiento

DERECHOS: Acceso, rectificación, supresión, portabilidad de datos

CONSENTIMIENTO:
☐ Autorizo el tratamiento de mis datos
☐ Autorizo comunicaciones de seguimiento
☐ Autorizo uso estadístico (anonimizado)

FIRMA DEL PACIENTE: ________________________  FECHA: {{TODAY}}`
    },
    {
        id: 'template-4',
        title: 'Procedimientos Quirúrgicos',
        category: 'Medical',
        content: `CONSENTIMIENTO PARA CIRUGÍA ORAL

PACIENTE: {{PATIENT_NAME}} | PROCEDIMIENTO: {{PROCEDURE}} | FECHA: {{TODAY}}

He sido informado/a sobre:
✓ Naturaleza de la cirugía
✓ Riesgos: sangrado, hinchazón, infección (rara), cambios de sensibilidad
✓ Cuidados post-operatorios: hielo, reposo, antibióticos si procede

CUIDADOS ESPECIALES:
1. Aplicar hielo 15 min/hora durante 24h
2. Evitar actividad física 3-7 días
3. Dieta blanda la primera semana
4. No fumar ni alcohol 48 horas

EMERGENCIA: Contactar si fiebre >38.5°C, sangrado abundante

ACEPTO los riesgos y compromisos del procedimiento.

FIRMA DEL PACIENTE: ________________________  FIRMA DEL CIRUJANO: ________________________`
    },
    {
        id: 'template-5',
        title: 'Responsabilidad Financiera',
        category: 'Financial',
        content: `ACUERDO DE RESPONSABILIDAD FINANCIERA

PACIENTE: {{PATIENT_NAME}} | FECHA: {{TODAY}}

TÉRMINOS DE PAGO:
✓ Aceptación de formas de pago: efectivo, tarjeta, transferencia
✓ Presupuestos válidos por 30 días
✓ Planes de pago disponibles bajo criterio clínico

CANCELACIÓN DE CITAS:
- Cancelación >24h: Sin cargo
- Cancelación <24h: 50% de la cita
- No presentación: 100%

DEUDA Y COBRANZA:
✓ Facturas vencidas > 30 días generan intereses
✓ Deudas importantes pueden derivarse a agencia de cobro

SEGURO: La clínica no responde por rechazos de seguro

He recibido y comprendido este acuerdo financiero.

FIRMA DEL PACIENTE: ________________________  FIRMA ADMINISTRACIÓN: ________________________`
    }
];

export const ConsentmentModal: React.FC<ConsentmentModalProps> = ({
    isOpen,
    onClose,
    patientName,
    patientId,
    currentConsents = [],
    onSaveConsent
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<ConsentTemplate | null>(null);
    const [filter, setFilter] = useState<'All' | 'Medical' | 'Privacy' | 'Financial'>('All');

    if (!isOpen) return null;

    const filteredTemplates = filter === 'All' 
        ? CONSENT_TEMPLATES 
        : CONSENT_TEMPLATES.filter(t => t.category === filter);

    const isSigned = (templateId: string) => {
        return currentConsents.some(c => c.templateId === templateId && c.isSigned);
    };

    const handleSignConsent = async (template: ConsentTemplate) => {
        if (onSaveConsent) {
            try {
                await onSaveConsent(patientId, template.id, true);
                alert('✅ Consentimiento registrado como firmado');
            } catch (e) {
                alert('Error: ' + (e as any).message);
            }
        }
    };

    const handleDownloadPDF = (template: ConsentTemplate) => {
        const formattedContent = template.content
            .replace(/{{PATIENT_NAME}}/g, patientName)
            .replace(/{{TODAY}}/g, new Date().toLocaleDateString('es-ES'))
            .replace(/{{PATIENT_DNI}}/g, 'DNI/Pasaporte')
            .replace(/{{CLINIC_NAME}}/g, 'CHC Clínica Dental')
            .replace(/{{DOCTOR_NAME}}/g, 'Dr. General');

        // Convertir formato de texto a HTML mejorado
        const htmlContent = `
            <h2>${template.title}</h2>
            <div style="white-space: pre-wrap; font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.8;">
                ${formattedContent
                    .split('\n')
                    .filter((line: string) => line.trim())
                    .map((line: string) => {
                        // Detectar títulos (líneas en mayúsculas)
                        if (line.match(/^[A-Z][A-Z\s\-:]+$/)) {
                            return `<h3 style="color: #1e293b; margin-top: 15px; margin-bottom: 8px; font-weight: 600;">${line}</h3>`;
                        }
                        // Detectar líneas de firma
                        if (line.includes('_____') || line.includes('FIRMA')) {
                            return `<div style="margin: 20px 0; display: grid; grid-template-columns: 1fr 1fr; gap: 30px;">
                                ${line.split('FIRMA DEL').length > 1 ? 
                                    `<div style="text-align: center;">
                                        <div style="border-top: 1px solid #000; margin-bottom: 8px; width: 100%; height: 50px;"></div>
                                        <span style="font-size: 10pt; color: #666;">FIRMA DEL PACIENTE</span>
                                    </div>
                                    <div style="text-align: center;">
                                        <div style="border-top: 1px solid #000; margin-bottom: 8px; width: 100%; height: 50px;"></div>
                                        <span style="font-size: 10pt; color: #666;">FIRMA DOCTOR</span>
                                    </div>`
                                    : `<div style="text-align: center;">
                                        <div style="border-top: 1px solid #000; margin-bottom: 8px; width: 100%;"></div>
                                    </div>`
                                }
                            </div>`;
                        }
                        // Líneas normales
                        return `<p style="margin: 6px 0; text-align: justify;">${line}</p>`;
                    })
                    .join('')}
            </div>
        `;

        pdfService.generatePDFFromHTML({
            title: template.title,
            content: htmlContent,
            patientName,
            doctorName: 'Dr. General',
            logo: `${window.location.origin}/logo.jpeg`,
            fileName: `${template.title.replace(/\s+/g, '_')}_${patientName.replace(/\s+/g, '_')}.pdf`
        });
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Gestión de Consentimientos</h2>
                        <p className="text-sm text-blue-100 mt-1">{patientName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedTemplate ? (
                        <div className="p-8 space-y-6">

                            {/* Filter Tabs */}
                            <div className="flex gap-2 flex-wrap">
                                {['All', 'Medical', 'Privacy', 'Financial'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setFilter(cat as any)}
                                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                                            filter === cat
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Templates Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map(template => {
                                    const signed = isSigned(template.id);
                                    return (
                                        <div
                                            key={template.id}
                                            className="border-2 border-slate-200 rounded-xl p-6 hover:border-blue-400 transition-all hover:shadow-lg group"
                                        >
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <FileText size={18} className="text-blue-600" />
                                                        <h3 className="text-sm font-black text-slate-900">{template.title}</h3>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1">
                                                        {template.category}
                                                    </p>
                                                </div>
                                                {signed && (
                                                    <div className="bg-green-100 text-green-600 p-2 rounded-lg">
                                                        <Check size={16} className="font-bold" />
                                                    </div>
                                                )}
                                            </div>

                                            <p className="text-xs text-slate-600 line-clamp-3 mb-4">
                                                {template.content.substring(0, 150)}...
                                            </p>

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => setSelectedTemplate(template)}
                                                    className="flex-1 bg-blue-50 hover:bg-blue-100 text-blue-600 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                                >
                                                    <FileText size={14} /> Ver
                                                </button>
                                                <button
                                                    onClick={() => handleDownloadPDF(template)}
                                                    className="flex-1 bg-orange-50 hover:bg-orange-100 text-orange-600 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                                    title="Descargar como PDF"
                                                >
                                                    <Download size={14} /> PDF
                                                </button>
                                                {!signed && (
                                                    <button
                                                        onClick={() => handleSignConsent(template)}
                                                        className="flex-1 bg-green-50 hover:bg-green-100 text-green-600 font-bold text-xs py-2 rounded-lg transition-colors flex items-center justify-center gap-1"
                                                    >
                                                        <Check size={14} /> Firmar
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8">
                            <button
                                onClick={() => setSelectedTemplate(null)}
                                className="mb-6 text-sm font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                ← Volver
                            </button>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-8 space-y-4">
                                <h3 className="text-xl font-black text-slate-900">{selectedTemplate.title}</h3>
                                <p className="text-xs text-slate-500 uppercase font-bold">{selectedTemplate.category}</p>
                                <div className="bg-white p-6 rounded-lg border border-slate-200 max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm text-slate-700 font-mono leading-relaxed">
                                    {selectedTemplate.content
                                        .replace(/{{PATIENT_NAME}}/g, patientName)
                                        .replace(/{{TODAY}}/g, new Date().toLocaleDateString('es-ES'))
                                        .replace(/{{PATIENT_DNI}}/g, 'DNI/Pasaporte')
                                        .replace(/{{CLINIC_NAME}}/g, 'CHC Clínica Dental')
                                        .replace(/{{DOCTOR_NAME}}/g, 'Dr. General')}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => handleDownloadPDF(selectedTemplate)}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all"
                                        title="Descargar como PDF formateado profesionalmente"
                                    >
                                        <Download size={18} /> Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => window.print()}
                                        className="flex-1 bg-gradient-to-r from-slate-400 to-slate-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all"
                                        title="Imprimir documento"
                                    >
                                        <Printer size={18} /> Imprimir
                                    </button>
                                    {!isSigned(selectedTemplate.id) && (
                                        <button
                                            onClick={() => {
                                                handleSignConsent(selectedTemplate);
                                                setSelectedTemplate(null);
                                            }}
                                            className="flex-1 bg-gradient-to-r from-green-500 to-green-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all"
                                        >
                                            <Check size={18} /> Registrar Firma
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
