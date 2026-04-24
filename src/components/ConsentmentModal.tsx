import React, { useState, useEffect, useRef } from 'react';
import { X, FileText, Download, Check, Printer, Search, User } from 'lucide-react';
import { pdfService } from '../services/pdfService';
import { api } from '../services/api';
import { CONSENT_TEMPLATES, ConsentTemplate } from './consentTemplates';

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

function generatePDFOrPrint(
    template: ConsentTemplate,
    mode: 'pdf' | 'print',
    patientName: string,
    patientDni: string,
    patientDob: string,
    doctorName: string
) {
    let content = template.content;
    content = content.split('{{PATIENT_NAME}}').join(patientName);
    content = content.split('{{TODAY}}').join(new Date().toLocaleDateString('es-ES'));
    content = content.split('{{PATIENT_DNI}}').join(patientDni);
    content = content.split('{{PATIENT_DOB}}').join(patientDob);
    content = content.split('{{CLINIC_NAME}}').join('CHC Clínica Dental');
    content = content.split('{{DOCTOR_NAME}}').join(doctorName);

    if (mode === 'print') {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (!w) {
            alert('Activa los popups para usar la impresión.');
            return;
        }
        const html = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>' + template.title + '</title><style>'
            + 'body{font-family:Arial,sans-serif;font-size:11pt;color:#111;margin:40px 60px;line-height:1.7;}'
            + 'h1{font-size:16pt;font-weight:800;text-transform:uppercase;border-bottom:3px solid #111;padding-bottom:8px;margin-bottom:16px;}'
            + '.meta{background:#f0f9ff;border-left:4px solid #3b82f6;padding:10px 14px;margin-bottom:20px;font-size:10pt;}'
            + 'pre{white-space:pre-wrap;font-family:Arial,sans-serif;font-size:11pt;}'
            + '@media print{body{margin:20px 30px;}}'
            + '</style></head><body><h1>' + template.title + '</h1>'
            + '<div class="meta"><strong>Paciente:</strong> ' + patientName + ' &nbsp;|&nbsp; <strong>DNI:</strong> ' + patientDni + ' &nbsp;|&nbsp; <strong>Fecha:</strong> ' + new Date().toLocaleDateString('es-ES') + '</div>'
            + '<pre>' + content + '</pre></body></html>';
        w.document.write(html);
        w.document.close();
        w.onload = function() { w.print(); };
    } else {
        const isAllCaps = function(s: string): boolean {
            if (!s || s.length === 0) return false;
            for (let i = 0; i < s.length; i++) {
                if (s[i] >= 'a' && s[i] <= 'z') return false;
            }
            return true;
        };

        const lines = content.split('\n');
        let html = '';
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            if (isAllCaps(line)) {
                html += '<h3 style="color:#1e293b;margin-top:15px;margin-bottom:8px;font-weight:600;">' + line + '</h3>';
            } else if (line.indexOf('_____') >= 0 || line.indexOf('FIRMA') >= 0) {
                html += '<div style="margin:20px 0;display:grid;grid-template-columns:1fr 1fr;gap:30px;">'
                    + '<div style="text-align:center;"><div style="border-top:1px solid #000;margin-bottom:8px;width:100%;height:50px;"></div><span style="font-size:10pt;color:#666;">FIRMA DEL PACIENTE</span></div>'
                    + '<div style="text-align:center;"><div style="border-top:1px solid #000;margin-bottom:8px;width:100%;height:50px;"></div><span style="font-size:10pt;color:#666;">FIRMA DOCTOR</span></div></div>';
            } else {
                html += '<p style="margin:6px 0;text-align:justify;">' + line + '</p>';
            }
        }
        const fullHtml = '<h2>' + template.title + '</h2><div style="white-space:pre-wrap;font-family:Segoe UI,Arial,sans-serif;line-height:1.8;">' + html + '</div>';
        pdfService.generatePDFFromHTML({
            title: template.title,
            content: fullHtml,
            patientName: patientName,
            doctorName: doctorName,
            logo: window.location.origin + '/logo.jpeg',
            fileName: template.title.split(' ').join('_') + '_' + patientName.split(' ').join('_') + '.pdf'
        });
    }
}

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
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [overridePatient, setOverridePatient] = useState<any>(null);
    const [pickerTemplate, setPickerTemplate] = useState<any>(null);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerResults, setPickerResults] = useState<any[]>([]);
    const [pickerLoading, setPickerLoading] = useState(false);
    const [pickerPatient, setPickerPatient] = useState<any>(null);
    const pickerRef = useRef<any>(null);
    const [showDropdown, setShowDropdown] = useState(false);
    const searchRef = useRef<any>(null);

    const activePatient = pickerPatient || overridePatient;
    const resolvedName = activePatient?.name || patientName;
    const resolvedDni = activePatient?.dni || patientDni || 'DNI';
    const resolvedDob = activePatient?.birthDate ? new Date(activePatient.birthDate).toLocaleDateString('es-ES') : (patientDob || 'Fecha');
    const resolvedDoctor = doctorName || 'Dr.';

    useEffect(() => {
        if (!searchTerm.trim() || searchTerm.length < 2) {
            setSearchResults([]);
            setShowDropdown(false);
            return;
        }
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

    useEffect(() => {
        const handler = (e: any) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (!pickerSearch.trim() || pickerSearch.length < 2) {
            setPickerResults([]);
            return;
        }
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

    const filteredTemplates = filter === 'Todos' ? CONSENT_TEMPLATES : CONSENT_TEMPLATES.filter(t => t.category === filter);
    const isSigned = (templateId: string) => currentConsents.some(c => c.templateId === templateId && c.isSigned);

    const handleSignConsent = async (template: ConsentTemplate) => {
        if (onSaveConsent) {
            try {
                await onSaveConsent(overridePatient?.id || patientId, template.id, true);
                alert('OK');
            } catch (e) {
                alert('Error: ' + (e as any).message);
            }
        }
    };

    const requestAction = (template: ConsentTemplate, mode: any) => {
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
        const pDob = pickerPatient?.birthDate ? new Date(pickerPatient.birthDate).toLocaleDateString('es-ES') : resolvedDob;
        generatePDFOrPrint(template, mode, pName, pDni, pDob, resolvedDoctor);
    };

    const previewContent = selectedTemplate ? selectedTemplate.content
        .split('{{PATIENT_NAME}}').join(resolvedName)
        .split('{{TODAY}}').join(new Date().toLocaleDateString('es-ES'))
        .split('{{PATIENT_DNI}}').join(resolvedDni)
        .split('{{PATIENT_DOB}}').join(resolvedDob)
        .split('{{CLINIC_NAME}}').join('CHC')
        .split('{{DOCTOR_NAME}}').join(resolvedDoctor) : '';

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[110] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-4xl w-full rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden relative">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 flex justify-between items-start">
                    <div className="flex-1 min-w-0 mr-4">
                        <h2 className="text-2xl font-black text-white tracking-tight">Consentimientos</h2>
                        <div ref={searchRef} className="relative mt-3">
                            <div className="flex items-center gap-2 bg-white/20 backdrop-blur rounded-xl px-3 py-2">
                                <Search size={16} className="text-white/70" />
                                <input type="text" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); if (!e.target.value) setOverridePatient(null); }} placeholder={resolvedName || 'Buscar'} className="bg-transparent text-white placeholder-white/60 text-sm outline-none w-full" />
                                {overridePatient && <button onClick={() => { setOverridePatient(null); setSearchTerm(''); }} className="text-white/70"><X size={14} /></button>}
                                {searchLoading && <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
                            </div>
                            {showDropdown && searchResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-2xl z-50 max-h-56 overflow-y-auto">
                                {searchResults.map((p: any) => <button key={p.id} onClick={() => { setOverridePatient({ id: p.id, name: p.name, dni: p.dni, birthDate: p.birthDate }); setSearchTerm(p.name); setShowDropdown(false); }} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 border-b border-slate-100 last:border-0"><div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center"><User size={14} className="text-blue-600" /></div><div><div className="text-sm font-semibold text-slate-800">{p.name}</div><div className="text-xs text-slate-500">{p.dni}</div></div></button>)}
                            </div>}
                        </div>
                        {overridePatient && <p className="text-xs text-blue-100 mt-2"><Check size={12} /> {overridePatient.name}</p>}
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white p-2"><X size={24} /></button>
                </div>

                <div className="flex-1 overflow-y-auto">
                    {!selectedTemplate ? (
                        <div className="p-8 space-y-6">
                            <div className="flex gap-2 flex-wrap">
                                {['Todos', 'Médico', 'Privacidad', 'Financiero'].map(cat => <button key={cat} onClick={() => setFilter(cat as any)} className={`px-4 py-2 rounded-lg text-xs font-bold ${filter === cat ? 'bg-blue-600 text-white' : 'bg-slate-100'}`}>{cat}</button>)}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {filteredTemplates.map(t => {
                                    const signed = isSigned(t.id);
                                    return <div key={t.id} className="border-2 border-slate-200 rounded-xl p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div><div className="flex items-center gap-2"><FileText size={18} className="text-blue-600" /><h3 className="text-sm font-black">{t.title}</h3></div><p className="text-xs text-slate-500 mt-1">{t.category}</p></div>
                                            {signed && <Check size={16} className="text-green-600" />}
                                        </div>
                                        <p className="text-xs text-slate-600 mb-4">{t.content.substring(0, 100)}</p>
                                        <div className="flex gap-2">
                                            <button onClick={() => setSelectedTemplate(t)} className="flex-1 bg-blue-50 text-blue-600 text-xs py-2 rounded"><FileText size={14} /> Ver</button>
                                            <button onClick={() => requestAction(t, 'pdf')} className="flex-1 bg-orange-50 text-orange-600 text-xs py-2 rounded"><Download size={14} /> PDF</button>
                                            {!signed && <button onClick={() => handleSignConsent(t)} className="flex-1 bg-green-50 text-green-600 text-xs py-2 rounded"><Check size={14} /> Firmar</button>}
                                        </div>
                                    </div>;
                                })}
                            </div>
                        </div>
                    ) : (
                        <div className="p-8">
                            <button onClick={() => setSelectedTemplate(null)} className="mb-6 text-sm text-blue-600">← Volver</button>
                            <div className="bg-slate-50 border rounded-xl p-8 space-y-4">
                                <h3 className="text-xl font-black">{selectedTemplate.title}</h3>
                                <p className="text-xs text-slate-500">{selectedTemplate.category}</p>
                                <div className="bg-white p-6 rounded border max-h-[400px] overflow-y-auto whitespace-pre-wrap text-sm">{previewContent}</div>
                                <div className="flex gap-3">
                                    <button onClick={() => requestAction(selectedTemplate, 'pdf')} className="flex-1 bg-orange-500 text-white px-6 py-3 rounded-xl font-bold text-sm"><Download size={18} /> PDF</button>
                                    <button onClick={() => requestAction(selectedTemplate, 'print')} className="flex-1 bg-slate-400 text-white px-6 py-3 rounded-xl font-bold text-sm"><Printer size={18} /> Imprimir</button>
                                    {!isSigned(selectedTemplate.id) && <button onClick={() => { handleSignConsent(selectedTemplate); setSelectedTemplate(null); }} className="flex-1 bg-green-500 text-white px-6 py-3 rounded-xl font-bold text-sm"><Check size={18} /> Registrar</button>}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {pickerTemplate && <div className="absolute inset-0 bg-slate-900/70 z-[200] flex items-center justify-center p-6">
                <div className="bg-white rounded-2xl w-full max-w-md p-8 space-y-5">
                    <div className="flex justify-between items-center">
                        <h3 className="text-lg font-black">Paciente</h3>
                        <button onClick={() => setPickerTemplate(null)}><X size={20} /></button>
                    </div>
                    <div ref={pickerRef} className="relative">
                        <div className="flex items-center gap-2 bg-slate-50 border-2 rounded-xl px-4 py-3">
                            <Search size={16} className="text-slate-400" />
                            <input autoFocus type="text" value={pickerSearch} onChange={e => { setPickerSearch(e.target.value); if (!e.target.value) setPickerPatient(null); }} placeholder="Nombre, DNI" className="bg-transparent text-sm outline-none w-full" />
                            {pickerLoading && <div className="w-3 h-3 border-2 border-slate-300 border-t-blue-500 animate-spin" />}
                        </div>
                        {pickerResults.length > 0 && <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-xl z-50 max-h-52 overflow-y-auto">
                            {pickerResults.map((p: any) => <button key={p.id} onClick={() => { setPickerPatient({ id: p.id, name: p.name, dni: p.dni, birthDate: p.birthDate }); setPickerSearch(p.name); setPickerResults([]); }} className="w-full text-left px-4 py-3 hover:bg-blue-50 border-b last:border-0"><div className="font-semibold">{p.name}</div><div className="text-xs text-slate-500">{p.dni}</div></button>)}
                        </div>}
                    </div>
                    {pickerPatient && <div className="bg-blue-50 border rounded-xl px-4 py-3"><Check size={14} /> {pickerPatient.name}</div>}
                    <div className="flex gap-3">
                        <button onClick={() => setPickerTemplate(null)} className="flex-1 py-3 text-sm">Cancelar</button>
                        <button onClick={confirmAndGenerate} disabled={!pickerPatient && !patientName} className="flex-1 bg-blue-600 text-white py-3 rounded-xl font-bold">{pickerTemplate.mode === 'print' ? 'Imprimir' : 'PDF'}</button>
                    </div>
                </div>
            </div>}
        </div>
    );
};
