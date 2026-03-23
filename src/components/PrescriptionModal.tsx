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
        const w = window.open('', '_blank');
        if (!w) return;

        const content = `
            <html>
                <head>
                    <title>Receta - ${patient.name}</title>
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        @media print {
                            body { padding: 0; }
                            .no-print { display: none; }
                        }
                    </style>
                </head>
                <body class="p-10 font-sans">
                    <div class="flex justify-between items-start border-b-4 border-slate-900 pb-6 mb-8">
                        <div>
                            <h1 class="text-4xl font-black uppercase text-slate-900">${formData.prescriberName}</h1>
                            <p class="text-lg font-bold text-slate-500 uppercase">${formData.prescriberSpecialty}</p>
                        </div>
                        <div class="text-right text-sm font-bold text-slate-400">
                            <p>FECHA: ${new Date(formData.prescriptionDate).toLocaleDateString('es-ES')}</p>
                            <p>Nº ORDEN: ${formData.dispensationOrderNumber || '---'}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-8 mb-8 bg-slate-50 p-6 rounded-2xl border border-slate-200">
                        <div>
                            <p class="text-[10px] font-black uppercase text-slate-400 mb-1">Paciente</p>
                            <p class="text-xl font-bold text-slate-900">${patient.name} ${patient.lastName1 || ''} ${patient.lastName2 || ''}</p>
                            <p class="text-sm font-bold text-slate-500">DNI: ${patient.dni}</p>
                        </div>
                        <div class="text-right">
                            <p class="text-[10px] font-black uppercase text-slate-400 mb-1">F. Nacimiento</p>
                            <p class="text-lg font-bold text-slate-900">${patient.birthDate ? new Date(patient.birthDate).toLocaleDateString('es-ES') : '--/--/----'}</p>
                        </div>
                    </div>

                    <div class="mb-10">
                        <div class="flex items-center gap-2 mb-4 border-b-2 border-slate-100 pb-2">
                             <h3 class="text-xl font-black uppercase text-slate-900">RP/ ${formData.medication}</h3>
                        </div>
                        <div class="grid grid-cols-3 gap-6 text-sm">
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-400">Forma / Vía</p>
                                <p class="font-bold text-slate-700">${formData.pharmaceuticalForm} / ${formData.administrationRoute}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-400">Pauta / Dosis</p>
                                <p class="font-bold text-slate-700">${formData.schedulePattern} - ${formData.dose}</p>
                            </div>
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-400">Duración</p>
                                <p class="font-bold text-slate-700">${formData.duration} días (${formData.units})</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 gap-8 mb-12">
                        {formData.patientInstructions && (
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-400 mb-2">Instrucciones para el Paciente</p>
                                <div class="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 text-sm leading-relaxed text-slate-700">
                                    ${formData.patientInstructions}
                                </div>
                            </div>
                        )}
                        {formData.diagnosis && (
                            <div>
                                <p class="text-[10px] font-black uppercase text-slate-400 mb-2">Diagnóstico</p>
                                <p class="text-sm font-bold text-slate-600">${formData.diagnosis}</p>
                            </div>
                        )}
                    </div>

                    <div class="mt-20 flex justify-between items-end border-t-2 border-slate-100 pt-8">
                        <div class="text-[10px] font-bold text-slate-300 uppercase leading-wide">
                            RECETA ELECTRÓNICA PRIVADA<br/>
                            VALIDA DURANTE 10 DÍAS
                        </div>
                        <div class="text-center w-64">
                             <div class="h-20 flex items-center justify-center italic text-slate-300">Firma y Sello</div>
                             <div class="border-t border-slate-900 pt-2">
                                <p class="text-xs font-black uppercase">${formData.prescriberName}</p>
                                <p class="text-[10px] font-bold text-slate-400 uppercase">Col: 28001234</p>
                             </div>
                        </div>
                    </div>
                </body>
            </html>
        `;

        w.document.write(content);
        w.document.close();
        setTimeout(() => { w.print(); w.close(); }, 500);
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
                            <>
                                <button
                                    onClick={handleSendEmail}
                                    className="flex items-center gap-2 px-6 py-3 rounded-2xl font-black bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all text-sm uppercase shadow-sm"
                                >
                                    <Mail size={20} />
                                    Email
                                </button>
                                <button
                                    onClick={handlePrint}
                                    className="flex items-center gap-2 px-8 py-3 rounded-2xl font-black bg-slate-900 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all text-sm uppercase"
                                >
                                    <Printer size={20} />
                                    Imprimir
                                </button>
                            </>
                        )}
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
