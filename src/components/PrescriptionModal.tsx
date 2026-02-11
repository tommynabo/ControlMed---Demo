import React, { useState, useRef } from 'react';
import { X, Printer, Save, Sparkles, FileText } from 'lucide-react';
import { api } from '../services/api';

interface PrescriptionModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientName: string;
    initialText?: string; // If editing
    onSave: (text: string) => void;
}

export const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ isOpen, onClose, patientName, initialText = '', onSave }) => {
    const [text, setText] = useState(initialText);
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
    const [isGenerating, setIsGenerating] = useState(false);

    // Reset state on open
    React.useEffect(() => {
        if (isOpen) {
            setText(initialText);
            setViewMode('edit');
        }
    }, [isOpen, initialText]);

    const handleGenerateAI = async () => {
        if (!text) return;
        setIsGenerating(true);
        try {
            const improved = await api.ai.improveMessage(text, patientName, 'prescription');
            setText(improved);
        } catch (e) {
            console.error(e);
            alert("Error generando con IA");
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePrint = () => {
        const printContent = document.getElementById('prescription-preview-content');
        if (!printContent) return;

        const w = window.open('', '_blank');
        if (w) {
            w.document.write(`
                <html>
                    <head>
                        <title>Receta Médica - ${patientName}</title>
                        <script src="https://cdn.tailwindcss.com"></script>
                        <style>
                            @media print {
                                body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; }
                                @page { margin: 0; }
                            }
                        </style>
                    </head>
                    <body class="bg-white p-8 min-h-screen relative">
                         <!-- Header (Logo Placeholder) -->
                        <div class="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
                            <div>
                                <h1 class="text-3xl font-black text-slate-900 uppercase tracking-tighter">Clínica Dental</h1>
                                <p class="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Dr. Martin & Asociados</p>
                            </div>
                            <div class="text-right text-xs font-bold text-slate-400 uppercase">
                                <p>C/ Ejemplo 123, Madrid</p>
                                <p>Tel: 91 123 45 67</p>
                                <p>N.R.S: 12345678</p>
                            </div>
                        </div>

                        <!-- Patient Info -->
                        <div class="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="text-[10px] font-black uppercase text-slate-400">Paciente</p>
                                    <p class="text-xl font-bold text-slate-900">${patientName}</p>
                                </div>
                                <div class="text-right">
                                    <p class="text-[10px] font-black uppercase text-slate-400">Fecha</p>
                                    <p class="text-lg font-bold text-slate-900">${new Date().toLocaleDateString('es-ES')}</p>
                                </div>
                            </div>
                        </div>

                        <!-- Content -->
                        <div class="prose prose-slate max-w-none mb-12 min-h-[400px]">
                             <pre class="whitespace-pre-wrap font-mono text-sm text-slate-700">${text}</pre>
                        </div>

                        <!-- Footer / Signature -->
                        <div class="absolute bottom-12 left-8 right-8 flex justify-between items-end border-t border-slate-200 pt-8">
                            <div class="text-[10px] font-bold text-slate-300 uppercase max-w-xs">
                                Validez de 10 días desde la fecha de expedición. Esta receta es personal e intransferible.
                            </div>
                            <div class="text-center">
                                <div class="h-20 mb-2 flex items-center justify-center">
                                     <!-- Signature Placeholder -->
                                    <span class="font-dancing-script text-2xl text-slate-400 italic">Fdo. El Doctor</span>
                                </div>
                                <div class="border-t border-slate-900 w-48 mx-auto pt-2">
                                    <p class="text-xs font-black uppercase text-slate-900">Firma y Sello</p>
                                    <p class="text-[10px] font-bold text-slate-400 uppercase">Num. Col: 28001234</p>
                                </div>
                            </div>
                        </div>
                    </body>
                </html>
            `);
            w.document.close();
            setTimeout(() => {
                w.print();
                w.close();
            }, 500);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white max-w-3xl w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-xl font-black text-slate-900">
                            {viewMode === 'edit' ? 'Editar Receta' : 'Vista Previa'}
                        </h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-900">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto bg-slate-50 p-6">
                    {viewMode === 'edit' ? (
                        <div className="space-y-4">
                            <div className="flex justify-between items-center mb-2">
                                <label className="text-[10px] font-black uppercase text-slate-400">Contenido de la Receta</label>
                                <button
                                    onClick={handleGenerateAI}
                                    disabled={isGenerating}
                                    className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:text-blue-700 disabled:opacity-50"
                                >
                                    <Sparkles size={14} />
                                    {isGenerating ? 'Mejorando...' : 'Mejorar con IA'}
                                </button>
                            </div>
                            <textarea
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                className="w-full h-96 bg-white border border-slate-200 rounded-xl p-6 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500/20 resize-none leading-relaxed"
                                placeholder="Escribe aquí el medicamento, posología y duración..."
                            />
                        </div>
                    ) : (
                        <div id="prescription-preview-content" className="bg-white shadow-lg p-12 min-h-[600px] relative max-w-[210mm] mx-auto">
                            {/* Preview specific UI mirroring print layout */}
                            <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8 opacity-50 pointer-events-none select-none">
                                <div>
                                    <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Clínica Dental</h1>
                                    <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-1">Dr. Martin & Asociados</p>
                                </div>
                                <div className="text-right text-xs font-bold text-slate-400 uppercase">
                                    <p>C/ Ejemplo 123, Madrid</p>
                                    <p>Tel: 91 123 45 67</p>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 mb-8 flex justify-between items-center">
                                <div>
                                    <p className="text-[10px] font-black uppercase text-slate-400">Paciente</p>
                                    <p className="text-xl font-bold text-slate-900">{patientName}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-slate-400">Fecha</p>
                                    <p className="text-lg font-bold text-slate-900">{new Date().toLocaleDateString('es-ES')}</p>
                                </div>
                            </div>

                            <div className="prose prose-slate max-w-none mb-12">
                                <pre className="whitespace-pre-wrap font-mono text-sm text-slate-700">{text}</pre>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-slate-100 bg-white rounded-b-[2rem] flex justify-between items-center h-20">
                    <div className="flex gap-2">
                        <button
                            onClick={() => setViewMode(viewMode === 'edit' ? 'preview' : 'edit')}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-xl font-bold transition-colors flex items-center gap-2"
                        >
                            {viewMode === 'edit' ? <FileText size={18} /> : <Sparkles size={18} />}
                            {viewMode === 'edit' ? 'Ver Vista Previa' : 'Volver a Editar'}
                        </button>
                    </div>
                    <div className="flex gap-2">
                        {viewMode === 'preview' && (
                            <button
                                onClick={handlePrint}
                                className="bg-slate-900 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                            >
                                <Printer size={18} />
                                Imprimir
                            </button>
                        )}
                        <button
                            onClick={() => onSave(text)}
                            className="bg-emerald-500 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2"
                        >
                            <Save size={18} />
                            Guardar
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
