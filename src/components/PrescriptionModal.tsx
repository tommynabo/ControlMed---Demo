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
        const logoUrl = `${window.location.origin}/logo.jpeg`;
        const w = window.open('', '_blank');
        if (!w) return;

        const content = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Receta Médica – ${patient.name} ${patient.lastName1 || ''}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page { size: A4; margin: 18mm 22mm 22mm 22mm; }
        body { font-family: Arial, Helvetica, sans-serif; font-size: 10.5pt; color: #111827; background: white; }
        .header { display: flex; justify-content: space-between; align-items: flex-end; padding-bottom: 10px; border-bottom: 3px solid #111827; margin-bottom: 14px; }
        .clinic-name { font-size: 17pt; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
        .clinic-specialty { font-size: 9pt; color: #6b7280; margin-top: 3px; }
        .clinic-private { margin-top: 6px; font-size: 7.5pt; font-weight: 700; color: #9ca3af; letter-spacing: 1.5px; text-transform: uppercase; }
        .logo-box img { height: 68px; max-width: 130px; object-fit: contain; }
        .doc-meta { display: flex; gap: 28px; margin-bottom: 14px; font-size: 8.5pt; color: #6b7280; }
        .doc-meta strong { color: #111827; font-weight: 700; }
        .section-label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1.2px; color: #9ca3af; margin-bottom: 5px; }
        .patient-box { display: grid; grid-template-columns: 2fr 1fr 1fr; border: 1px solid #d1d5db; border-radius: 5px; margin-bottom: 16px; overflow: hidden; }
        .patient-field { padding: 9px 14px; border-right: 1px solid #d1d5db; }
        .patient-field:last-child { border-right: none; }
        .patient-field .label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 3px; }
        .patient-field .value { font-size: 11.5pt; font-weight: 700; }
        .patient-field .value-sm { font-size: 9.5pt; font-weight: 600; color: #374151; }
        .rp-box { border: 2px solid #111827; border-radius: 6px; padding: 14px 18px; margin-bottom: 14px; }
        .rp-header { display: flex; align-items: baseline; gap: 10px; padding-bottom: 10px; margin-bottom: 12px; border-bottom: 1px solid #e5e7eb; }
        .rp-label { font-size: 22pt; font-weight: 900; font-style: italic; color: #111827; line-height: 1; }
        .rp-medication { font-size: 14pt; font-weight: 700; color: #1d4ed8; }
        .rp-details { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; }
        .rp-detail .label { font-size: 7pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #9ca3af; margin-bottom: 3px; }
        .rp-detail .value { font-size: 9.5pt; font-weight: 600; color: #1f2937; }
        .instructions-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 5px; padding: 12px 15px; margin-bottom: 12px; }
        .instructions-box p { font-size: 9pt; line-height: 1.65; color: #1e3a8a; white-space: pre-wrap; }
        .diagnosis-box { background: #fefce8; border: 1px solid #fde68a; border-radius: 5px; padding: 9px 14px; margin-bottom: 14px; font-size: 9pt; color: #713f12; }
        .footer-row { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 30px; padding-top: 12px; border-top: 1px solid #d1d5db; }
        .validity { font-size: 7pt; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; line-height: 1.7; }
        .signature-block { text-align: center; min-width: 210px; }
        .signature-space { height: 52px; }
        .signature-line { border-top: 1.5px solid #111827; margin-bottom: 5px; }
        .signature-name { font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
        .signature-col { font-size: 8pt; color: #6b7280; margin-top: 2px; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="clinic-name">${formData.prescriberName}</div>
            <div class="clinic-specialty">${formData.prescriberSpecialty}</div>
            <div class="clinic-private">Receta Médica Privada</div>
        </div>
        <div class="logo-box"><img src="${logoUrl}" onerror="this.style.display='none'" /></div>
    </div>
    <div class="doc-meta">
        <span>Fecha Prescripción: <strong>${new Date(formData.prescriptionDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>
        ${formData.dispensationDate ? `<span>Fecha Dispensación: <strong>${new Date(formData.dispensationDate).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}</strong></span>` : ''}
        <span>Nº Orden: <strong>${formData.dispensationOrderNumber || '—'}</strong></span>
    </div>
    <div class="section-label">Datos del Paciente</div>
    <div class="patient-box">
        <div class="patient-field">
            <div class="label">Nombre y Apellidos</div>
            <div class="value">${patient.name} ${patient.lastName1 || ''} ${patient.lastName2 || ''}</div>
        </div>
        <div class="patient-field">
            <div class="label">DNI / NIE</div>
            <div class="value-sm">${patient.dni || '—'}</div>
        </div>
        <div class="patient-field">
            <div class="label">Fecha de Nacimiento</div>
            <div class="value-sm">${patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-ES') : '—'}</div>
        </div>
    </div>
    <div class="rp-box">
        <div class="rp-header">
            <span class="rp-label">Rp/</span>
            <span class="rp-medication">${formData.medication || '—'}</span>
        </div>
        <div class="rp-details">
            <div class="rp-detail">
                <div class="label">Forma Farm.</div>
                <div class="value">${formData.pharmaceuticalForm}</div>
            </div>
            <div class="rp-detail">
                <div class="label">Vía Administración</div>
                <div class="value">${formData.administrationRoute}</div>
            </div>
            <div class="rp-detail">
                <div class="label">Pauta / Dosis</div>
                <div class="value">${formData.schedulePattern} — ${formData.dose}</div>
            </div>
            <div class="rp-detail">
                <div class="label">Duración / Envases</div>
                <div class="value">${formData.duration} días (${formData.units})</div>
            </div>
        </div>
    </div>
    ${formData.patientInstructions ? `
    <div class="section-label">Instrucciones para el Paciente</div>
    <div class="instructions-box"><p>${formData.patientInstructions.replace(/\n/g, '<br>')}</p></div>` : ''}
    ${formData.diagnosis ? `
    <div class="diagnosis-box"><strong>Diagnóstico:</strong> ${formData.diagnosis}</div>` : ''}
    <div class="footer-row">
        <div class="validity">
            Receta Electrónica Privada<br>
            Válida durante 10 días desde la fecha de prescripción
        </div>
        <div class="signature-block">
            <div class="signature-space"></div>
            <div class="signature-line"></div>
            <div class="signature-name">${formData.prescriberName}</div>
            <div class="signature-col">${formData.prescriberSpecialty}</div>
        </div>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body>
</html>`;

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
                        <div className="max-w-[210mm] mx-auto bg-white shadow-2xl p-16 border border-slate-100 min-h-[600px] rounded-sm">
                             {/* Preview content matches print layout */}
                             <div className="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                                <div>
                                    <h1 className="text-4xl font-black uppercase text-slate-900">{formData.prescriberName}</h1>
                                    <p className="text-lg font-bold text-slate-500 uppercase">{formData.prescriberSpecialty}</p>
                                </div>
                                <div className="text-right text-sm font-bold text-slate-400">
                                    <p>FECHA: {new Date(formData.prescriptionDate).toLocaleDateString('es-ES')}</p>
                                    <p>Nº ORDEN: {formData.dispensationOrderNumber || '---'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-8 rounded-[2rem] border border-slate-200">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Paciente</p>
                                    <p className="text-2xl font-black text-slate-900">{patient.name} {patient.lastName1}</p>
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">DNI: {patient.dni}</p>
                                </div>
                                <div className="text-right flex flex-col justify-center">
                                    <p className="text-[10px] font-black uppercase text-slate-400 mb-1">F. Nacimiento</p>
                                    <p className="text-xl font-bold text-slate-900">{new Date(patient.birthDate).toLocaleDateString('es-ES')}</p>
                                </div>
                            </div>

                            <div className="mb-12">
                                <h3 className="text-3xl font-black text-blue-600 mb-6 flex items-center gap-3">
                                    <Pill size={32} />
                                    RP/ {formData.medication}
                                </h3>
                                <div className="grid grid-cols-3 gap-8 p-6 bg-blue-50/30 rounded-2xl border border-blue-100/50">
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Forma / Vía</p>
                                        <p className="font-black text-slate-700">{formData.pharmaceuticalForm} / {formData.administrationRoute}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Pauta / Dosis</p>
                                        <p className="font-black text-slate-700">{formData.schedulePattern} - {formData.dose}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Duración</p>
                                        <p className="font-black text-slate-700">{formData.duration} días</p>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8">
                                {formData.patientInstructions && (
                                    <div>
                                        <p className="text-[10px] font-black uppercase text-slate-400 mb-2">Instrucciones para el Paciente</p>
                                        <div className="prose prose-slate max-w-none text-slate-600 font-medium leading-relaxed">
                                            {formData.patientInstructions}
                                        </div>
                                    </div>
                                )}
                            </div>
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
                            onClick={() => onSave(formData)}
                            className="flex items-center gap-2 px-10 py-3 rounded-2xl font-black bg-emerald-500 text-white shadow-xl hover:bg-emerald-600 transition-all text-sm uppercase"
                        >
                            <Save size={20} />
                            {prescription ? 'Guardar Cambios' : 'Guardar Receta'}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
