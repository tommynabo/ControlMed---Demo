import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Download, Check, Printer, Search, User } from 'lucide-react';
import { pdfService } from '../services/pdfService';
import { api } from '../services/api';

interface ConsentTemplate {
    id: string;
    title: string;
    category: 'Médico' | 'Privacidad' | 'Financiero';
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
    patientDni?: string;
    patientDob?: string;
    doctorName?: string;
    currentConsents?: ConsentRecord[];
    onSaveConsent?: (consentId: string, templateId: string, signed: boolean) => Promise<void>;
}

const CONSENT_TEMPLATES: ConsentTemplate[] = [
    {
        id: 'template-1',
        title: 'Consentimiento Informado General',
        category: 'Médico',
        content: `CONSENTIMIENTO INFORMADO - TRATAMIENTO DENTAL

PACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | FECHA: {{TODAY}}

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
        category: 'Médico',
        content: `CONSENTIMIENTO INFORMADO PARA ANESTESIA

PACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | FECHA: {{TODAY}}

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
        category: 'Privacidad',
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
        category: 'Médico',
        content: `CONSENTIMIENTO PARA CIRUGÍA ORAL

PACIENTE: {{PATIENT_NAME}} | DNI: {{PATIENT_DNI}} | F. NACIMIENTO: {{PATIENT_DOB}} | PROCEDIMIENTO: {{PROCEDURE}} | FECHA: {{TODAY}}

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
        category: 'Financiero',
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
    patientDni,
    patientDob,
    doctorName,
    currentConsents = [],
    onSaveConsent
}) => {
    const [selectedTemplate, setSelectedTemplate] = useState<ConsentTemplate | null>(null);
    const [filter, setFilter] = useState<'Todos' | 'Médico' | 'Privacidad' | 'Financiero'>('Todos');

    // Patient search state (header bar)
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [overridePatient, setOverridePatient] = useState<{ id: string; name: string; dni?: string; birthDate?: string; assignedDoctorId?: string } | null>(null);

    // Patient picker popup (shown before PDF/Print when no patient selected)
    const [pickerTemplate, setPickerTemplate] = useState<{ template: ConsentTemplate; mode: 'pdf' | 'print' } | null>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerResults, setPickerResults] = useState<any[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerPatient, setPickerPatient] = useState<{ id: string; name: string; dni?: string; birthDate?: string } | null>(null);
    const pickerRef = useRef<HTMLDivElement>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Resolved patient data: picker > override (header search) > props
    const activePatient = pickerPatient || overridePatient;
    const resolvedName = activePatient?.name || patientName;
    const resolvedDni = activePatient?.dni || patientDni || 'DNI/Pasaporte';
    const resolvedDob = activePatient?.birthDate
        ? new Date(activePatient.birthDate).toLocaleDateString('es-ES')
        : patientDob ? new Date(patientDob).toLocaleDateString('es-ES') : 'Fecha de Nacimiento';
    const resolvedDoctor = doctorName || 'Dr./Dra.';

    // Debounced patient search
    useEffect(() => {
        if (!searchTerm.trim() || searchTerm.length < 2) { setSearchResults([]); setShowDropdown(false); return; }
        const timer = setTimeout(async () => {
            setSearchLoading(true);
            try {
                const result = await api.patients.getPatientsPage(1, 8, searchTerm);
                setSearchResults(result.data || []);
                setShowDropdown(true);
            } catch (_) {
                setSearchResults([]);
            } finally {
                setSearchLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Picker popup search debounce
    useEffect(() => {
        if (!pickerSearch.trim() || pickerSearch.length < 2) { setPickerResults([]); return; }
        const timer = setTimeout(async () => {
            setPickerLoading(true);
            try {
                const result = await api.patients.getPatientsPage(1, 8, pickerSearch);
                setPickerResults(result.data || []);
            } catch (_) {
                setPickerResults([]);
            } finally {
                setPickerLoading(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [pickerSearch]);

    if (!isOpen) return null;

    const filteredTemplates = filter === 'Todos' 
        ? CONSENT_TEMPLATES 
        : CONSENT_TEMPLATES.filter(t => t.category === filter);

    const isSigned = (templateId: string) => {
        return currentConsents.some(c => c.templateId === templateId && c.isSigned);
    };

    const handleSignConsent = async (template: ConsentTemplate) => {
        if (onSaveConsent) {
            try {
                await onSaveConsent(overridePatient?.id || patientId, template.id, true);
                alert('✅ Consentimiento registrado como firmado');
            } catch (e) {
                alert('Error: ' + (e as any).message);
            }
        }
    };

    // Open picker popup before PDF/Print if we need to confirm the patient
    const requestAction = (template: ConsentTemplate, mode: 'pdf' | 'print') => {
        // Pre-fill picker with current resolved patient if available
        setPickerPatient(activePatient ? { id: activePatient.id, name: activePatient.name, dni: activePatient.dni, birthDate: activePatient.birthDate } : null);
        setPickerSearch(activePatient?.name || patientName || '');
        setPickerResults([]);
        setPickerTemplate({ template, mode });
    };

    const confirmAndGenerate = () => {
        if (!pickerTemplate) return;
        const { template, mode } = pickerTemplate;
        setPickerTemplate(null);

        const pName = pickerPatient?.name || resolvedName;
        const pDni = pickerPatient?.dni || resolvedDni;
        const pDob = pickerPatient?.birthDate
            ? new Date(pickerPatient.birthDate).toLocaleDateString('es-ES')
            : resolvedDob;

        const formattedContent = template.content
            .replace(/{{PATIENT_NAME}}/g, pName)
            .replace(/{{TODAY}}/g, new Date().toLocaleDateString('es-ES'))
            .replace(/{{PATIENT_DNI}}/g, pDni)
            .replace(/{{PATIENT_DOB}}/g, pDob)
            .replace(/{{CLINIC_NAME}}/g, 'CHC Clínica Dental')
            .replace(/{{DOCTOR_NAME}}/g, resolvedDoctor);

        if (mode === 'print') {
            // Open formatted document in new window and trigger browser print dialog
            const printWin = window.open('', '_blank', 'width=900,height=700');
            if (!printWin) { alert('Activa los popups para usar la impresión.'); return; }
            const printHtml = [
                '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>', template.title, '</title>',
                '<style>',
                'body{font-family:Arial,sans-serif;font-size:11pt;color:#111;margin:40px 60px;line-height:1.7;}',
                'h1{font-size:16pt;font-weight:800;text-transform:uppercase;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:16px;}',
                '.meta{background:#f0f9ff;border-left:4px solid #3b82f6;padding:10px 14px;margin-bottom:20px;font-size:10pt;}',
                'pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:11pt;}',
                '@media print{body{margin:20px 30px;}}',
                '</style></head><body>',
                '<h1>', template.title, '</h1>',
                '<div class="meta"><strong>Paciente:</strong> ', pName,
                ' &nbsp;|&nbsp; <strong>DNI:</strong> ', pDni,
                ' &nbsp;|&nbsp; <strong>Fecha:</strong> ', new Date().toLocaleDateString('es-ES'), '</div>',
                '<pre>', formattedContent, '</pre>',
                '</body></html>'
            ].join('');
            printWin.document.write(printHtml);
            printWin.document.close();
            printWin.onload = () => printWin.print();
        } else {
            // Generate PDF — build HTML outside template literal to avoid esbuild regex parsing issues
            const isAllCaps = (s: string) => /^[A-Z][A-Z\s:()-]+$/.test(s);
            const htmlLines = formattedContent.split('\n').filter((line: string) => line.trim()).map((line: string) => {
                if (isAllCaps(line)) {
                    return '<h3 style="color:#1e293b;margin-top:15px;margin-bottom:8px;font-weight:600;">' + line + '</h3>';
                }
                if (line.includes('_____') || line.includes('FIRMA')) {
                    return '<div style="margin:20px 0;display:grid;grid-template-columns:1fr 1fr;gap:30px;">'
                        + '<div style="text-align:center;"><div style="border-top:1px solid #000;margin-bottom:8px;width:100%;height:50px;"></div><span style="font-size:10pt;color:#666;">FIRMA DEL PACIENTE</span></div>'
                        + '<div style="text-align:center;"><div style="border-top:1px solid #000;margin-bottom:8px;width:100%;height:50px;"></div><span style="font-size:10pt;color:#666;">FIRMA DOCTOR</span></div>'
                        + '</div>';
                }
                return '<p style="margin:6px 0;text-align:justify;">' + line + '</p>';
            });
            const htmlContent = '<h2>' + template.title + '</h2>'
                + '<div style="white-space:pre-wrap;font-family:\'Segoe UI\',Arial,sans-serif;line-height:1.8;">'
                + htmlLines.join('')
                + '</div>';
            pdfService.generatePDFFromHTML({
                title: template.title,
                content: htmlContent,
                patientName: pName,
                doctorName: resolvedDoctor,
                logo: `${window.location.origin}/logo.jpeg`,
                fileName: `${template.title.replace(/\s+/g, '_')}_${pName.replace(/\s+/g, '_')}.pdf`
            });
        }
    };

    // Pre-compute preview content without regex literals inside JSX (esbuild TSX parser
    // misreads /{{X}}/g patterns inside JSX {} expressions as unterminated regex)
    const previewContent = selectedTemplate
        ? selectedTemplate.content
            .split('{{PATIENT_NAME}}').join(resolvedName)
            .split('{{TODAY}}').join(new Date().toLocaleDateString('es-ES'))
            .split('{{PATIENT_DNI}}').join(resolvedDni)
            .split('{{PATIENT_DOB}}').join(resolvedDob)
            .split('{{CLINIC_NAME}}').join('CHC Clínica Dental')
            .split('{{DOCTOR_NAME}}').join(resolvedDoctor)
        : '';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-4">
                        <h2 className="text-2xl font-black text-white tracking-tight">Gestión de Consentimientos</h2>
                        {/* Patient search bar */}
                        <div ref={searchRef} className="relative mt-3">
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-3 py-2">
                                <Search size={16} className="text-white/70 shrink-0" />
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={e => { setSearchTerm(e.target.value); if (!e.target.value) { setOverridePatient(null); } }}
                                    placeholder={resolvedName || 'Buscar paciente…'}
                                    className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-full"
                                />
                                {overridePatient && (
                                    <button onClick={() => { setOverridePatient(null); setSearchTerm(''); }} className="text-white/70 hover:text-white ml-1">
                                        <X size={14} />
                                    </button>
                                )}
                                {searchLoading && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin shrink-0" />}
                            </div>
                            {/* Results dropdown */}
                            {showDropdown && searchResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl z-50 overflow-hidden max-h-56 overflow-y-auto">
                                    {searchResults.map((p: any) => (
                                        <button
                                            key={p.id}
                                            onClick={() => { setOverridePatient({ id: p.id, name: p.name, dni: p.dni, birthDate: p.birthDate, assignedDoctorId: p.assignedDoctorId }); setSearchTerm(p.name); setShowDropdown(false); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                <User size={14} className="text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                                                <div className="text-xs text-slate-500">{p.dni || 'Sin DNI'}{p.historyNumber ? ` · Nº ${p.historyNumber}` : ''}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {showDropdown && !searchLoading && searchResults.length === 0 && searchTerm.length >= 2 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl z-50 px-4 py-3 text-sm text-slate-500">
                                    Sin resultados para "{searchTerm}"
                                </div>
                            )}
                        </div>
                        {overridePatient && (
                            <p className="text-xs text-blue-100 mt-2 flex items-center gap-1">
                                <Check size={12} /> Paciente seleccionado: <strong className="text-white">{overridePatient.name}</strong>
                            </p>
                        )}
                        {!overridePatient && resolvedName && (
                            <p className="text-sm text-blue-100 mt-1">{resolvedName}</p>
                        )}
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
                                {['Todos', 'Médico', 'Privacidad', 'Financiero'].map(cat => (
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
                                                    onClick={() => requestAction(template, 'pdf')}
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
                                    {previewContent}
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        onClick={() => requestAction(selectedTemplate, 'pdf')}
                                        className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all"
                                    >
                                        <Download size={18} /> Descargar PDF
                                    </button>
                                    <button
                                        onClick={() => requestAction(selectedTemplate, 'print')}
                                        className="flex-1 bg-gradient-to-r from-slate-400 to-slate-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:shadow-lg hover:scale-[1.02] transition-all"
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

            {/* ── Patient picker popup (appears over the modal when PDF/Print clicked) ── */}
            {pickerTemplate && (
                <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-sm z-[200] flex items-center justify-center p-6 rounded-2xl">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-5">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">¿Para qué paciente?</h3>
                                <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[280px]">{pickerTemplate.template.title}</p>
                            </div>
                            <button onClick={() => setPickerTemplate(null)} className="text-slate-400 hover:text-slate-700 p-1">
                                <X size={20} />
                            </button>
                        </div>

                        {/* Search input */}
                        <div ref={pickerRef} className="relative">
                            <div className="flex items-center gap-2 bg-slate-50 border-2 border-slate-200 focus-within:border-blue-400 rounded-xl px-4 py-3 transition-colors">
                                <Search size={16} className="text-slate-400 shrink-0" />
                                <input
                                    autoFocus
                                    type="text"
                                    value={pickerSearch}
                                    onChange={e => { setPickerSearch(e.target.value); if (!e.target.value) setPickerPatient(null); }}
                                    placeholder="Escribe nombre, DNI o nº historia…"
                                    className="bg-transparent text-sm text-slate-800 outline-none w-full placeholder-slate-400"
                                />
                                {pickerLoading && <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin shrink-0" />}
                            </div>
                            {pickerResults.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden max-h-52 overflow-y-auto">
                                    {pickerResults.map((p: any) => (
                                        <button
                                            key={p.id}
                                            onClick={() => { setPickerPatient({ id: p.id, name: p.name, dni: p.dni, birthDate: p.birthDate }); setPickerSearch(p.name); setPickerResults([]); }}
                                            className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                                        >
                                            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                                <User size={14} className="text-blue-600" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                                                <div className="text-xs text-slate-500">{p.dni || 'Sin DNI'}{p.historyNumber ? ` · Nº ${p.historyNumber}` : ''}</div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Selected patient summary */}
                        {pickerPatient && (
                            <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 space-y-1">
                                <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                                    <Check size={14} /> {pickerPatient.name}
                                </div>
                                <div className="text-xs text-slate-500 flex gap-4">
                                    <span>DNI: <strong>{pickerPatient.dni || '—'}</strong></span>
                                    <span>F. Nac.: <strong>{pickerPatient.birthDate ? new Date(pickerPatient.birthDate).toLocaleDateString('es-ES') : '—'}</strong></span>
                                </div>
                            </div>
                        )}

                        {!pickerPatient && patientName && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs text-slate-600">
                                Se usará el paciente actual: <strong>{patientName}</strong>
                            </div>
                        )}

                        <div className="flex gap-3 pt-1">
                            <button
                                onClick={() => setPickerTemplate(null)}
                                className="flex-1 py-3 text-sm font-bold text-slate-500 hover:text-slate-700"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={confirmAndGenerate}
                                disabled={!pickerPatient && !patientName}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                {pickerTemplate.mode === 'print' ? <><Printer size={16} /> Imprimir</> : <><Download size={16} /> Descargar PDF</>}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
        </div>
    );
};
