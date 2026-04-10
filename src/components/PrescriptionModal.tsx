import React, { useState, useEffect } from 'react';
import { X, Printer, Save, Sparkles, FileText, User, UserCheck, Pill, Calendar, ClipboardList, Eye, Mail } from 'lucide-react';
import { api } from '../services/api';
import { Patient } from '../../types';

interface PrescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient;
    onSave: (prescriptionData: any) => void;
    prescription?: any;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ 
    isOpen, 
    onClose, 
    patient, 
    onSave,
    prescription
}) => {
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initial State Helper
    const getInitialData = () => {
        if (prescription) {
            return {
                ...prescription,
                // Ensure dates are string for date input
                prescriptionDate: prescription.prescriptionDate ? new Date(prescription.prescriptionDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                dispensationDate: prescription.dispensationDate ? new Date(prescription.dispensationDate).toISOString().split('T')[0] : '',
            };
        }
        return {
            medication: '',
            pharmaceuticalForm: 'Comprimidos',
            administrationRoute: 'Oral',
            packagesNumber: 1,
            dose: '',
            duration: '',
            posology: '',
            units: '1 caja',
            schedulePattern: 'Cada 8 horas',
            prescriptionDate: new Date().toISOString().split('T')[0],
            dispensationDate: '',
            dispensationOrderNumber: '',
            diagnosis: '',
            patientInstructions: '',
            pharmacyInstructions: '',
            prescriberName: 'CHC Clínica Dental',
            prescriberSpecialty: 'Odontología General'
        };
    };

    // Form State
    const [formData, setFormData] = useState(getInitialData());

    // Effect to update formData when prescription changes (when modal opens)
    useEffect(() => {
        if (isOpen) {
            setFormData(getInitialData());
            setViewMode(prescription ? 'preview' : 'edit');
        }
    }, [isOpen, prescription]);

    const specialties = [
        'Odontología General',
        'Ortodoncia',
        'Implantología',
        'Periodoncia',
        'Endodoncia',
        'Estética Dental',
        'Cirugía Oral'
    ];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleGenerateAI = async () => {
        if (!formData.medication && !formData.diagnosis) return;
        setIsGenerating(true);
        try {
            const prompt = `Genera instrucciones detalladas para el paciente para el medicamento ${formData.medication} con diagnóstico ${formData.diagnosis}. Pauta: ${formData.schedulePattern}.`;
            const improved = await api.ai.improveMessage(prompt, patient.name, 'prescription');
            setFormData(prev => ({ ...prev, patientInstructions: improved }));
        } catch (e) {
            console.error(e);
            alert("Error generando con IA");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSendEmail = () => {
        const subject = encodeURIComponent(`Receta Médica - ${patient.name}`);
        const bodyContent = `
Hola ${patient.name},

Te enviamos tu receta médica:

Medicamento: ${formData.medication}
Pauta: ${formData.schedulePattern}
Duración: ${formData.duration}
Instrucciones: ${formData.patientInstructions}

Saludos,
${formData.prescriberName}
        `.trim();
        const body = encodeURIComponent(bodyContent);
        window.location.href = `mailto:${patient.email}?subject=${subject}&body=${body}`;
    };

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;

        const patientFullName = [patient.name, patient.lastName1, patient.lastName2].filter(Boolean).join(' ');
        const prescDate = formData.prescriptionDate
            ? new Date(formData.prescriptionDate + 'T12:00:00').toLocaleDateString('es-ES')
            : '—';
        const dispDate = formData.dispensationDate
            ? new Date(formData.dispensationDate + 'T12:00:00').toLocaleDateString('es-ES')
            : '—';
        const birthDate = patient.birthDate
            ? new Date(patient.birthDate).toLocaleDateString('es-ES')
            : '—';

        const col1 = `<div class="col col-1">
            <div class="section-header">Prescripción</div>
            <div class="rp-prefix">RP/</div>
            <div class="medication-name">${formData.medication || '—'}</div>
            <div class="col-label">Forma Farmacéutica</div>
            <div class="col-value-sm">${formData.pharmaceuticalForm}</div>
            <div class="col-label">Vía de Administración</div>
            <div class="col-value-sm">${formData.administrationRoute}</div>
            <div class="col-label">Núm. Envases</div>
            <div class="col-value">${formData.packagesNumber || 1}</div>
            <div class="sustituir-block">
                <div class="sustituir-title">Sustituir en caso de:</div>
                <div class="checkbox-row"><span class="checkbox-sq"></span> Urgencia</div>
                <div class="checkbox-row"><span class="checkbox-sq"></span> Desabastecimiento</div>
                <div class="checkbox-row"><span class="checkbox-sq"></span> Otros</div>
            </div>
        </div>`;

        const col2 = `<div class="col col-2">
            <div class="section-header">Posología y Dispensación</div>
            <div class="col-label">Duración del Tratamiento</div>
            <div class="col-value-sm">${formData.duration || '—'} días</div>
            <div class="grid-2" style="margin-top:6px;">
                <div class="grid-cell grid-left">
                    <div class="grid-cell-label">Unidades</div>
                    <div class="grid-cell-val">${formData.dose || formData.units || '—'}</div>
                </div>
                <div class="grid-cell">
                    <div class="grid-cell-label">Pauta</div>
                    <div class="grid-cell-val">${formData.schedulePattern || '—'}</div>
                </div>
            </div>
            <div class="col-label">Núm. Orden Dispensación</div>
            <div class="col-value-sm">${formData.dispensationOrderNumber || '—'}</div>
            <div class="col-label">Fecha Prevista Dispensación</div>
            <div class="col-value-sm">${dispDate}</div>
            <div class="advertencia">
                <div class="advertencia-title">Advertencia para el Farmacéutico</div>
                ${formData.schedulePattern || formData.posology || 'Dispensar según pauta prescrita'}
            </div>
        </div>`;

        const col3 = `<div class="col col-3">
            <div class="section-header">Paciente Privado</div>
            <div class="col-label">Nombre y Apellidos</div>
            <div class="col-value-sm">${patientFullName}</div>
            <div class="col-label">Fecha de Nacimiento</div>
            <div class="col-value-sm">${birthDate}</div>
            <div class="col-label">DNI / NIE</div>
            <div class="col-value-sm">${patient.dni || '—'}</div>
            <div class="prescriptor-section">
                <div class="section-header">Prescriptor</div>
                <div class="col-label">Nombre</div>
                <div class="col-value-sm">${formData.prescriberName}</div>
                <div class="col-label">Núm. Colegiado</div>
                <div class="col-value-sm">—</div>
                <div class="col-label">Especialidad</div>
                <div class="col-value-sm">${formData.prescriberSpecialty}</div>
                <div class="col-label">Fecha Prescripción</div>
                <div class="col-value-sm">${prescDate}</div>
            </div>
            <div class="farmacia-section">
                <div class="section-header">Farmacia (NIF/CIF)</div>
            </div>
        </div>`;

        const copyFooter = `<div class="copy-footer">
            <div class="footer-left">Esta receta es válida para su dispensación durante 10 días desde la fecha de prescripción. Solo es válida en territorio nacional. El médico prescriptor es responsable de la indicación terapéutica.</div>
            <div class="footer-right">De conformidad con la Ley Orgánica 15/1999 de Protección de Datos de Carácter Personal, los datos personales reflejados en este documento son tratados con absoluta confidencialidad y únicamente con fines sanitarios.</div>
        </div>`;

        const buildCopy = (label: string) => `<div class="copy">
            <div class="copy-label">${label}</div>
            <div class="copy-body">${col1}${col2}${col3}</div>
            ${copyFooter}
        </div>`;

        const indicaciones = formData.patientInstructions
            ? `<div class="indicaciones">
            <div class="indicaciones-title">Indicaciones para el Paciente</div>
            <div class="indicaciones-text">${formData.patientInstructions.replace(/\n/g, '<br>')}</div>
        </div>`
            : '';

        const content = `<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>Receta Médica – ${patientFullName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 8mm 12mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #000; background: white; }
        .copy { border: 1.5px solid #000; margin-bottom: 6mm; page-break-inside: avoid; }
        .copy-label { background: #e0e0e0; text-align: center; font-size: 6.5pt; font-weight: 900; text-transform: uppercase; padding: 3px 0; border-bottom: 1px solid #000; letter-spacing: 1px; }
        .copy-body { display: grid; grid-template-columns: 1.2fr 1fr 1fr; }
        .col { padding: 6px 8px; vertical-align: top; }
        .col-1 { border-right: 1px solid #000; }
        .col-2 { border-right: 1px solid #000; }
        .col-label { font-size: 5.5pt; text-transform: uppercase; font-weight: 900; color: #555; margin-bottom: 1px; margin-top: 6px; }
        .col-value { font-size: 9pt; font-weight: 700; }
        .col-value-sm { font-size: 7.5pt; font-weight: 600; }
        .section-header { font-size: 6.5pt; font-weight: 900; text-transform: uppercase; border-bottom: 1px solid #999; padding-bottom: 2px; margin-bottom: 4px; letter-spacing: 0.5px; }
        .medication-name { font-size: 11pt; font-weight: 900; margin-bottom: 4px; line-height: 1.2; }
        .rp-prefix { font-size: 9pt; font-style: italic; font-weight: 700; color: #444; }
        .checkbox-row { font-size: 7pt; margin-top: 4px; display: flex; align-items: center; gap: 5px; }
        .checkbox-sq { display: inline-block; width: 9px; height: 9px; border: 1.5px solid #000; flex-shrink: 0; }
        .sustituir-block { margin-top: 8px; border-top: 1px solid #ccc; padding-top: 6px; }
        .sustituir-title { font-size: 6pt; font-weight: 900; text-transform: uppercase; color: #555; margin-bottom: 3px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; border: 1px solid #888; }
        .grid-cell { padding: 3px 5px; }
        .grid-cell-label { font-size: 5.5pt; font-weight: 900; text-transform: uppercase; color: #666; }
        .grid-cell-val { font-size: 8pt; font-weight: 700; }
        .grid-left { border-right: 1px solid #888; }
        .advertencia { margin-top: 6px; border: 1px dashed #aaa; padding: 4px 5px; font-size: 7pt; color: #333; }
        .advertencia-title { font-size: 5.5pt; font-weight: 900; text-transform: uppercase; color: #666; margin-bottom: 2px; }
        .prescriptor-section { border-top: 1px solid #ccc; margin-top: 6px; padding-top: 4px; }
        .farmacia-section { border-top: 1px solid #ccc; margin-top: 6px; padding-top: 4px; min-height: 22px; }
        .copy-footer { display: flex; border-top: 1px solid #000; }
        .footer-left { flex: 1; padding: 4px 7px; border-right: 1px solid #000; font-size: 5.5pt; color: #444; line-height: 1.5; }
        .footer-right { flex: 1; padding: 4px 7px; font-size: 5.5pt; color: #444; line-height: 1.5; }
        .indicaciones { margin-top: 4mm; border: 1px solid #000; padding: 8px 10px; }
        .indicaciones-title { font-size: 8pt; font-weight: 900; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px; }
        .indicaciones-text { font-size: 8.5pt; line-height: 1.6; white-space: pre-wrap; }
    </style></head>
<body>
    ${buildCopy('EJEMPLAR PARA EL FARMACÉUTICO')}
    ${buildCopy('EJEMPLAR PARA EL PACIENTE')}
    ${indicaciones}
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body></html>`;

        w.document.write(content);
        w.document.close();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white max-w-5xl w-full rounded-[2.5rem] shadow-2xl flex flex-col max-h-[95vh] overflow-hidden">
                
                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                            <FileText className="text-blue-600" size={28} />
                            {prescription ? 'Detalle de Receta' : (viewMode === 'edit' ? 'Nueva Receta Simplificada' : 'Vista Previa de Impresión')}
                        </h3>
                        <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                            Paciente: {patient.name} {patient.lastName1} | DNI: {patient.dni}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full text-slate-400 hover:text-slate-900 transition-colors shadow-sm">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 bg-white">
                    {viewMode === 'edit' ? (
                        <div className="space-y-10">
                            
                            {/* Paciente & Prescriptor (ReadOnly/Select) */}
                            <div className="grid grid-cols-3 gap-8 p-6 bg-slate-50 rounded-[2rem] border border-slate-100">
                                <div className="space-y-1 text-center border-r border-slate-200">
                                    <User className="mx-auto text-slate-400" size={20} />
                                    <p className="text-[10px] font-black uppercase text-slate-400">Paciente</p>
                                    <p className="text-sm font-black text-slate-900 truncate">{patient.name} {patient.lastName1}</p>
                                </div>
                                <div className="space-y-1 text-center border-r border-slate-200">
                                    <UserCheck className="mx-auto text-blue-500" size={20} />
                                    <p className="text-[10px] font-black uppercase text-slate-400">Prescriptor</p>
                                    <p className="text-sm font-black text-blue-700">CHC Clínica Dental</p>
                                </div>
                                <div className="space-y-2">
                                     <p className="text-[10px] font-black uppercase text-slate-400 text-center">Especialidad</p>
                                     <select 
                                        name="prescriberSpecialty"
                                        value={formData.prescriberSpecialty}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-slate-200 p-2 rounded-xl text-xs font-black outline-none shadow-sm"
                                     >
                                         {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                                     </select>
                                </div>
                            </div>

                            {/* Detalle Medicación */}
                            <section className="space-y-4">
                                <h4 className="text-xs font-black uppercase text-blue-600 flex items-center gap-2">
                                    <Pill size={16} /> Datos de la Receta
                                </h4>
                                <div className="grid grid-cols-4 gap-4">
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Medicamento</label>
                                        <input
                                            name="medication"
                                            value={formData.medication}
                                            onChange={handleChange}
                                            placeholder="Ej: Amoxicilina 500mg"
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Forma Farmacéutica</label>
                                        <input
                                            name="pharmaceuticalForm"
                                            value={formData.pharmaceuticalForm}
                                            onChange={handleChange}
                                            placeholder="Ej: Cápsulas"
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Vía</label>
                                        <select
                                            name="administrationRoute"
                                            value={formData.administrationRoute}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                        >
                                            <option value="Oral">Oral</option>
                                            <option value="Tópica">Tópica</option>
                                            <option value="Inyectable">Inyectable</option>
                                            <option value="Inhalatoria">Inhalatoria</option>
                                            <option value="Sublingual">Sublingual</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-5 gap-4">
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Nº Envases</label>
                                        <input
                                            type="number"
                                            name="packagesNumber"
                                            value={formData.packagesNumber}
                                            onChange={handleChange}
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Dosis x Envase</label>
                                        <input
                                            name="dose"
                                            value={formData.dose}
                                            onChange={handleChange}
                                            placeholder="Ej: 20 unid."
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Duración (Días)</label>
                                        <input
                                            name="duration"
                                            value={formData.duration}
                                            onChange={handleChange}
                                            placeholder="Ej: 7"
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none"
                                        />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Pauta / Intervalo</label>
                                        <input
                                            name="schedulePattern"
                                            value={formData.schedulePattern}
                                            onChange={handleChange}
                                            placeholder="Ej: Cada 8 horas"
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none"
                                        />
                                    </div>
                                </div>
                            </section>

                            {/* Gestión y Diagnóstico */}
                            <section className="grid grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase text-purple-600 flex items-center gap-2">
                                        <Calendar size={16} /> Fechas y Control
                                    </h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Prescripción</label>
                                            <input
                                                type="date"
                                                name="prescriptionDate"
                                                value={formData.prescriptionDate}
                                                onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold mt-1 outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Fecha Dispensación</label>
                                            <input
                                                type="date"
                                                name="dispensationDate"
                                                value={formData.dispensationDate}
                                                onChange={handleChange}
                                                className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-xs font-bold mt-1 outline-none"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Diagnóstico Primario</label>
                                        <input
                                            name="diagnosis"
                                            value={formData.diagnosis}
                                            onChange={handleChange}
                                            placeholder="Diagnóstico que justifica la receta"
                                            className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl text-sm font-bold mt-1 outline-none"
                                        />
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xs font-black uppercase text-emerald-600 flex items-center gap-2">
                                        <ClipboardList size={16} /> Instrucciones
                                    </h4>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Instrucciones Paciente</label>
                                        <button
                                            onClick={handleGenerateAI}
                                            disabled={isGenerating}
                                            className="text-[10px] font-black text-blue-600 flex items-center gap-1 hover:bg-blue-50 px-2 py-1 rounded-lg transition-all"
                                        >
                                            <Sparkles size={12} /> {isGenerating ? 'Generando...' : 'Autocompletar con IA'}
                                        </button>
                                    </div>
                                    <textarea
                                        name="patientInstructions"
                                        value={formData.patientInstructions}
                                        onChange={handleChange}
                                        placeholder="Ej: Tomar con alimentos, no suspender tratamiento..."
                                        className="w-full bg-slate-50 border border-slate-200 p-3 rounded-2xl text-sm font-bold mt-1 outline-none h-24 resize-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </section>
                        </div>
                    ) : (
                        // ── PREVIEW: exact replica of the print layout ──────────────────
                        <div className="max-w-[210mm] mx-auto">
                            <p className="text-center text-[10px] font-black uppercase text-slate-400 tracking-widest mb-4">Vista Previa — Idéntica al documento impreso</p>
                            {/* Simulate both copies as they appear in print */}
                            {(['EJEMPLAR PARA EL FARMACÉUTICO', 'EJEMPLAR PARA EL PACIENTE'] as const).map(label => {
                                const patientFullName = [patient.name, patient.lastName1, patient.lastName2].filter(Boolean).join(' ');
                                const prescDate = formData.prescriptionDate
                                    ? new Date(formData.prescriptionDate + 'T12:00:00').toLocaleDateString('es-ES')
                                    : '—';
                                const dispDate = formData.dispensationDate
                                    ? new Date(formData.dispensationDate + 'T12:00:00').toLocaleDateString('es-ES')
                                    : '—';
                                const birthDate = patient.birthDate
                                    ? new Date(patient.birthDate).toLocaleDateString('es-ES')
                                    : '—';

                                return (
                                    <div key={label} style={{ fontFamily: 'Arial, Helvetica, sans-serif', fontSize: '8pt', color: '#000', border: '1.5px solid #000', marginBottom: '8px' }}>
                                        {/* Copy label */}
                                        <div style={{ background: '#e0e0e0', textAlign: 'center', fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', padding: '3px 0', borderBottom: '1px solid #000', letterSpacing: '1px' }}>{label}</div>
                                        {/* 3-column body */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr' }}>
                                            {/* COL 1: Prescripción */}
                                            <div style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>
                                                <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '4px', letterSpacing: '0.5px' }}>Prescripción</div>
                                                <div style={{ fontSize: '9pt', fontStyle: 'italic', fontWeight: 700, color: '#444' }}>RP/</div>
                                                <div style={{ fontSize: '11pt', fontWeight: 900, marginBottom: '4px', lineHeight: 1.2 }}>{formData.medication || '—'}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Forma Farmacéutica</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.pharmaceuticalForm}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Vía de Administración</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.administrationRoute}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Núm. Envases</div>
                                                <div style={{ fontSize: '9pt', fontWeight: 700 }}>{formData.packagesNumber || 1}</div>
                                                <div style={{ marginTop: '8px', borderTop: '1px solid #ccc', paddingTop: '6px' }}>
                                                    <div style={{ fontSize: '6pt', fontWeight: 900, textTransform: 'uppercase', color: '#555', marginBottom: '3px' }}>Sustituir en caso de:</div>
                                                    {['Urgencia', 'Desabastecimiento', 'Otros'].map(s => (
                                                        <div key={s} style={{ fontSize: '7pt', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                            <span style={{ display: 'inline-block', width: '9px', height: '9px', border: '1.5px solid #000', flexShrink: 0 }} /> {s}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {/* COL 2: Posología y Dispensación */}
                                            <div style={{ padding: '6px 8px', borderRight: '1px solid #000' }}>
                                                <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '4px', letterSpacing: '0.5px' }}>Posología y Dispensación</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Duración del Tratamiento</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.duration || '—'} días</div>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', border: '1px solid #888', marginTop: '6px' }}>
                                                    <div style={{ padding: '3px 5px', borderRight: '1px solid #888' }}>
                                                        <div style={{ fontSize: '5.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#666' }}>Unidades</div>
                                                        <div style={{ fontSize: '8pt', fontWeight: 700 }}>{formData.dose || formData.units || '—'}</div>
                                                    </div>
                                                    <div style={{ padding: '3px 5px' }}>
                                                        <div style={{ fontSize: '5.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#666' }}>Pauta</div>
                                                        <div style={{ fontSize: '8pt', fontWeight: 700 }}>{formData.schedulePattern || '—'}</div>
                                                    </div>
                                                </div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Núm. Orden Dispensación</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.dispensationOrderNumber || '—'}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Fecha Prevista Dispensación</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{dispDate}</div>
                                                <div style={{ marginTop: '6px', border: '1px dashed #aaa', padding: '4px 5px', fontSize: '7pt', color: '#333' }}>
                                                    <div style={{ fontSize: '5.5pt', fontWeight: 900, textTransform: 'uppercase', color: '#666', marginBottom: '2px' }}>Advertencia para el Farmacéutico</div>
                                                    {formData.schedulePattern || formData.posology || 'Dispensar según pauta prescrita'}
                                                </div>
                                            </div>
                                            {/* COL 3: Paciente + Prescriptor */}
                                            <div style={{ padding: '6px 8px' }}>
                                                <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '4px', letterSpacing: '0.5px' }}>Paciente Privado</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Nombre y Apellidos</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{patientFullName}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Fecha de Nacimiento</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{birthDate}</div>
                                                <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>DNI / NIE</div>
                                                <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{patient.dni || '—'}</div>
                                                {/* Prescriptor sub-section */}
                                                <div style={{ borderTop: '1px solid #ccc', marginTop: '6px', paddingTop: '4px' }}>
                                                    <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #999', paddingBottom: '2px', marginBottom: '4px', letterSpacing: '0.5px' }}>Prescriptor</div>
                                                    <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Nombre</div>
                                                    <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.prescriberName}</div>
                                                    <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Núm. Colegiado</div>
                                                    <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>—</div>
                                                    <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Especialidad</div>
                                                    <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{formData.prescriberSpecialty}</div>
                                                    <div style={{ fontSize: '5.5pt', textTransform: 'uppercase', fontWeight: 900, color: '#555', marginBottom: '1px', marginTop: '6px' }}>Fecha Prescripción</div>
                                                    <div style={{ fontSize: '7.5pt', fontWeight: 600 }}>{prescDate}</div>
                                                </div>
                                                <div style={{ borderTop: '1px solid #ccc', marginTop: '6px', paddingTop: '4px', minHeight: '22px' }}>
                                                    <div style={{ fontSize: '6.5pt', fontWeight: 900, textTransform: 'uppercase', borderBottom: '1px solid #999', paddingBottom: '2px', letterSpacing: '0.5px' }}>Farmacia (NIF/CIF)</div>
                                                </div>
                                            </div>
                                        </div>
                                        {/* Footer */}
                                        <div style={{ display: 'flex', borderTop: '1px solid #000' }}>
                                            <div style={{ flex: 1, padding: '4px 7px', borderRight: '1px solid #000', fontSize: '5.5pt', color: '#444', lineHeight: 1.5 }}>Esta receta es válida para su dispensación durante 10 días desde la fecha de prescripción. Solo es válida en territorio nacional. El médico prescriptor es responsable de la indicación terapéutica.</div>
                                            <div style={{ flex: 1, padding: '4px 7px', fontSize: '5.5pt', color: '#444', lineHeight: 1.5 }}>De conformidad con la Ley Orgánica 15/1999 de Protección de Datos de Carácter Personal, los datos personales reflejados en este documento son tratados con absoluta confidencialidad y únicamente con fines sanitarios.</div>
                                        </div>
                                    </div>
                                );
                            })}
                            {/* Indicaciones */}
                            {formData.patientInstructions && (
                                <div style={{ border: '1px solid #000', padding: '8px 10px', marginTop: '8px', fontFamily: 'Arial, Helvetica, sans-serif' }}>
                                    <div style={{ fontSize: '8pt', fontWeight: 900, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.5px' }}>Indicaciones para el Paciente</div>
                                    <div style={{ fontSize: '8.5pt', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{formData.patientInstructions}</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Controls */}
                <div className="p-8 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
                    <button
                        onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                        className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-slate-600 hover:bg-white transition-all shadow-sm active:scale-95 text-sm uppercase"
                    >
                        {viewMode === 'edit' ? <Eye size={20} /> : <FileText size={20} />}
                        {viewMode === 'edit' ? 'Vista Previa' : 'Volver a Editar'}
                    </button>

                    <div className="flex gap-4">
                        {viewMode === 'preview' && (
                            <button
                                onClick={handleSendEmail}
                                className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all text-sm uppercase shadow-sm"
                            >
                                <Mail size={20} />
                                Email
                            </button>
                        )}
                        <button
                            onClick={handlePrint}
                            className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-sm uppercase"
                        >
                            <Printer size={20} />
                            Generar e Imprimir
                        </button>
                        <button
                            onClick={async () => {
                                if (isSubmitting) return;
                                setIsSubmitting(true);
                                try { await onSave(formData); }
                                catch (e) { /* parent handles errors */ }
                                finally { setIsSubmitting(false); }
                            }}
                            disabled={isSubmitting}
                            className="flex items-center gap-2 px-10 py-3 rounded-2xl font-black bg-emerald-500 text-white shadow-xl hover:bg-emerald-600 transition-all text-sm uppercase disabled:opacity-50"
                        >
                            <Save size={20} />
                            {isSubmitting ? 'Guardando...' : (prescription ? 'Guardar Cambios' : 'Guardar Receta')}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
