import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, FileText, Download, Check, Printer, Search, User, Tablet, Copy, ExternalLink } from 'lucide-react';
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
    signedPdfUrl?: string;
    signatureImageUrl?: string;
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
    onConsentSigned?: () => void;
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
    onConsentSigned
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

    // Tablet signing state
    const [tabletModal, setTabletModal] = useState<{
        open: boolean;
        consentId: string;
        signUrl: string;
        expiresAt: string;
        qrDataUrl: string;
        timeLeft: string;
    } | null>(null);
    const [tabletLoading, setTabletLoading] = useState<string | null>(null); // consentId being processed
    const [localConsents, setLocalConsents] = useState<ConsentRecord[]>(currentConsents);
    const tabletPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // Keep localConsents in sync if parent updates
    useEffect(() => { setLocalConsents(currentConsents); }, [currentConsents]);

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
    const isSigned = (templateId: string) => localConsents.some(c => c.templateId === templateId && c.isSigned);

    const handleSendToTablet = async (template: ConsentTemplate) => {
        const targetPatientId = overridePatient?.id || patientId;
        const existing = localConsents.find(c => c.templateId === template.id);
        let consentId = existing?.id;

        setTabletLoading(template.id);
        try {
            if (!consentId) {
                const created = await api.consents.create(targetPatientId, template.id, false);
                consentId = created.id;
                setLocalConsents(prev => [...prev, created]);
            }

            const { signUrl, expiresAt } = await api.consents.createSignToken(targetPatientId, consentId!);

            const QRCode = await import('qrcode');
            const qrDataUrl = await (QRCode.default as any).toDataURL(signUrl, {
                width: 220, margin: 1, color: { dark: '#1e293b', light: '#ffffff' }
            });

            const calcTimeLeft = () => {
                const diff = new Date(expiresAt).getTime() - Date.now();
                if (diff <= 0) return '0:00';
                const m = Math.floor(diff / 60000);
                const s = Math.floor((diff % 60000) / 1000);
                return `${m}:${String(s).padStart(2, '0')}`;
            };

            setTabletModal({ open: true, consentId: consentId!, signUrl, expiresAt, qrDataUrl, timeLeft: calcTimeLeft() });

            if (tabletPollRef.current) clearInterval(tabletPollRef.current);
            tabletPollRef.current = setInterval(async () => {
                setTabletModal(prev => {
                    if (!prev) return null;
                    const tl = calcTimeLeft();
                    if (tl === '0:00') {
                        clearInterval(tabletPollRef.current!);
                        return { ...prev, timeLeft: '0:00' };
                    }
                    return { ...prev, timeLeft: tl };
                });
                try {
                    const consents = await api.consents.getAll(targetPatientId);
                    const updated = consents.find((c: ConsentRecord) => c.id === consentId);
                    if (updated?.isSigned) {
                        setLocalConsents(prev => prev.map(c => c.id === consentId ? { ...c, ...updated } : c));
                        setTabletModal(null);
                        clearInterval(tabletPollRef.current!);
                        onConsentSigned?.();
                    }
                } catch { /* non-critical */ }
            }, 5000);
        } catch (e) {
            alert('Error al generar el enlace de firma: ' + (e as any).message);
        } finally {
            setTabletLoading(null);
        }
    };

    const closeTabletModal = () => {
        setTabletModal(null);
        if (tabletPollRef.current) clearInterval(tabletPollRef.current);
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
                                    const signedRecord = localConsents.find(c => c.templateId === t.id && c.isSigned);
                                    return <div key={t.id} className="border-2 border-slate-200 rounded-xl p-6">
                                        <div className="flex items-start justify-between mb-4">
                                            <div><div className="flex items-center gap-2"><FileText size={18} className="text-blue-600" /><h3 className="text-sm font-black">{t.title}</h3></div><p className="text-xs text-slate-500 mt-1">{t.category}</p></div>
                                            {signed && (
                                                <div className="flex items-center gap-1 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                                    <Check size={11} className="text-green-600" />
                                                    <span className="text-xs text-green-700 font-semibold">Firmado</span>
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 mb-4">{t.content.substring(0, 100)}</p>
                                        {signed && signedRecord?.signedPdfUrl && (
                                            <a href={signedRecord.signedPdfUrl} target="_blank" rel="noopener noreferrer"
                                               className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 mb-3 font-semibold">
                                                <ExternalLink size={12} /> Ver PDF firmado
                                            </a>
                                        )}
                                        <div className="flex gap-2">
                                            <button onClick={() => setSelectedTemplate(t)} className="flex-1 bg-blue-50 text-blue-600 text-xs py-2 rounded"><FileText size={14} /> Ver</button>
                                            <button onClick={() => requestAction(t, 'pdf')} className="flex-1 bg-orange-50 text-orange-600 text-xs py-2 rounded"><Download size={14} /> PDF</button>
                                            {!signed && (
                                                <button
                                                    onClick={() => handleSendToTablet(t)}
                                                    disabled={tabletLoading === t.id}
                                                    className="flex-1 bg-purple-50 text-purple-600 text-xs py-2 rounded disabled:opacity-50 flex items-center justify-center gap-1"
                                                >
                                                    {tabletLoading === t.id
                                                        ? <div className="w-3 h-3 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                                                        : <><Tablet size={13} /> Tablet</>}
                                                </button>
                                            )}
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
                                    {!isSigned(selectedTemplate.id) && (
                                        <button
                                            onClick={() => { handleSendToTablet(selectedTemplate); setSelectedTemplate(null); }}
                                            className="flex-1 bg-purple-500 text-white px-6 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                                        >
                                            <Tablet size={18} /> Enviar a Tablet
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Tablet QR Modal */}
            {tabletModal?.open && (
                <div className="absolute inset-0 bg-slate-900/75 z-[200] flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl w-full max-w-sm p-7 space-y-5 text-center shadow-2xl">
                        <div className="flex justify-between items-start">
                            <div className="text-left">
                                <h3 className="text-lg font-black text-slate-800">Firma en tablet</h3>
                                <p className="text-xs text-slate-500 mt-0.5">El paciente escanea el código con la cámara de la tablet</p>
                            </div>
                            <button onClick={closeTabletModal} className="text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>

                        {tabletModal.qrDataUrl && (
                            <div className="flex justify-center">
                                <div className="p-3 border-2 border-slate-200 rounded-xl inline-block">
                                    <img src={tabletModal.qrDataUrl} alt="QR de firma" className="w-44 h-44" />
                                </div>
                            </div>
                        )}

                        <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center gap-2">
                            <span className="text-xs text-slate-500 truncate flex-1 font-mono">{tabletModal.signUrl}</span>
                            <button
                                onClick={() => navigator.clipboard.writeText(tabletModal.signUrl)}
                                className="text-blue-600 hover:text-blue-800 flex-shrink-0"
                                title="Copiar URL"
                            >
                                <Copy size={15} />
                            </button>
                        </div>

                        <div className="flex items-center justify-center gap-2 text-sm">
                            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                            <span className="text-slate-600">Esperando firma…</span>
                            <span className="font-mono text-amber-600 font-bold">{tabletModal.timeLeft}</span>
                        </div>

                        <button onClick={closeTabletModal} className="w-full py-2.5 text-sm text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-50 transition-colors">
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {pickerTemplate && <div className="absolute inset-0 bg-slate-900/70 z-[200] flex items-center justify-center p-6">                <div className="bg-white rounded-2xl w-full max-w-md p-8 space-y-5">                    <div className="flex justify-between items-center">
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
