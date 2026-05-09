import React, { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, UserPlus, Download, Plus, Minus, Package, AlertTriangle, CheckCircle2, FileText as FileTextIcon, MessageSquare, QrCode, History, Send, RefreshCw, Trash2, Smartphone, Stethoscope, Edit3, X, Filter, Check, Building2, Calendar, Users as UsersIcon, Eye, ShieldCheck, ChevronDown, Mail, Lock, Printer } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { DocumentTemplate } from '../../types';
import { api } from '../services/api';
import ClinicInfo from '../components/ClinicInfo';
import ScheduleAvailability from '../components/ScheduleAvailability';
import Vacations from '../components/Vacations';
import GmailSettings from '../components/GmailSettings';
import TemplateEditorModal from '../components/TemplateEditorModal';

interface Service {
    id: string;
    external_id?: string;
    name: string;
    specialty_id?: string;
    specialty_name: string;
    specialty_color: string;
    duration_min: number;
    base_price: number;
    discount_percent: number;
    tax_percent: number;
    final_price: number;
    is_active: boolean;
    created_at?: string;
}

const Settings: React.FC = () => {
    const { stock, setStock, currentUserRole } = useAppContext();
    const isReception = currentUserRole === 'RECEPTION';
    
    // URL Deep Linking
    const [searchParams, setSearchParams] = useSearchParams();
    const tabFromUrl = searchParams.get('tab') as any;

    const [settingsTab, setSettingsTab] = useState<'templates' | 'stock' | 'whatsapp' | 'gmail' | 'services' | 'clinic' | 'schedule' | 'vacations' | 'audit' | 'pagos'>(tabFromUrl || 'templates');

    // PIN management state
    const [pinInput, setPinInput] = useState('');
    const [pinConfirm, setPinConfirm] = useState('');
    const [pinHasValue, setPinHasValue] = useState(false);
    const [pinSaving, setPinSaving] = useState(false);
    const [pinSaved, setPinSaved] = useState(false);
    // Ref so URL→State effect can read latest tab without being re-triggered by it
    const settingsTabRef = React.useRef(settingsTab);
    settingsTabRef.current = settingsTab;

    const [templateSearch, setTemplateSearch] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync State -> URL
    useEffect(() => {
        const urlTab = searchParams.get('tab') || 'templates';
        if (settingsTab && settingsTab !== urlTab) {
            setSearchParams({ tab: settingsTab }, { replace: true });
        }
    }, [settingsTab, searchParams, setSearchParams]);

    // Sync URL -> State (browser back/forward or direct link)
    // settingsTab is intentionally read via ref — adding it as a dep would revert
    // the tab selection when the user clicks a tab before the URL updates.
    useEffect(() => {
        const urlTab = searchParams.get('tab');
        if (urlTab && urlTab !== settingsTabRef.current) {
            setSettingsTab(urlTab as any);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchParams]);

    // SECURITY: Limit tabs for RECEPTION role
    useEffect(() => {
        if (isReception && !['templates', 'whatsapp', 'gmail', 'pagos', 'schedule'].includes(settingsTab)) {
            setSettingsTab('templates');
        }
    }, [isReception, settingsTab]);

    // Services State
    const [services, setServices] = useState<Service[]>([]);
    const [serviceSearch, setServiceSearch] = useState('');
    const [isLoadingServices, setIsLoadingServices] = useState(false);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
    const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [serviceFormData, setServiceFormData] = useState({
        name: '',
        specialty_name: '',
        specialty_color: '#3b638e',
        duration_min: 30,
        final_price: 0,
        base_price: 0
    });

    // Audit log state (ADMIN only)
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [auditTotal, setAuditTotal] = useState(0);
    const [auditLoading, setAuditLoading] = useState(false);
    const [auditFilter, setAuditFilter] = useState({ resource_type: '', action: '', date_from: '', date_to: '' });
    const [auditOffset, setAuditOffset] = useState(0);
    const AUDIT_LIMIT = 50;

    const loadAuditLogs = async (offset = 0, filter = auditFilter) => {
        setAuditLoading(true);
        try {
            const result = await api.audit.getLogs({
                ...filter,
                resource_type: filter.resource_type || undefined,
                action: filter.action || undefined,
                date_from: filter.date_from || undefined,
                date_to: filter.date_to || undefined,
                limit: AUDIT_LIMIT,
                offset,
            });
            setAuditLogs(result.data);
            setAuditTotal(result.total);
            setAuditOffset(offset);
        } catch (e) {
            console.error('Error loading audit logs:', e);
        } finally {
            setAuditLoading(false);
        }
    };

    // WhatsApp State
    const [waStatus, setWaStatus] = useState<{ status: string; qrCode: string | null }>({ status: 'DISCONNECTED', qrCode: null });
    const [waTemplates, setWaTemplates] = useState<any[]>([]);
    const [waLogs, setWaLogs] = useState<any[]>([]);
    const [waActiveTab, setWaActiveTab] = useState<'dashboard' | 'connection' | 'templates'>('dashboard');
    const [newWaTemplate, setNewWaTemplate] = useState({ name: '', content: '', triggerType: 'APPOINTMENT_REMINDER', triggerOffsetValue: '12', triggerOffsetUnit: 'h', triggerOffsetDirection: 'before' });
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);

    // TEMPLATES STATE — loaded from backend
    const [templates, setTemplates] = useState<DocumentTemplate[]>([]);
    const [isLoadingTemplates, setIsLoadingTemplates] = useState(false);
    const [editingTemplate, setEditingTemplate] = useState<DocumentTemplate | null | undefined>(undefined); // undefined=closed, null=new, obj=edit

    const loadTemplates = async () => {
        setIsLoadingTemplates(true);
        try {
            const data = await api.templates.getAll();
            setTemplates(data);
        } catch (e) {
            console.error('Error loading templates:', e);
        } finally {
            setIsLoadingTemplates(false);
        }
    };

    useEffect(() => {
        if (settingsTab === 'whatsapp') {
            refreshWhatsApp();
        } else if (settingsTab === 'templates') {
            loadTemplates();
        } else if (settingsTab === 'services') {
            loadServices();
        } else if (settingsTab === 'audit') {
            loadAuditLogs(0, auditFilter);
        }
    }, [settingsTab, waActiveTab]);

    const refreshWhatsApp = async () => {
        try {
            const status = await api.whatsapp.getStatus();
            setWaStatus(status);
            const tmpls = await api.whatsapp.getTemplates();
            setWaTemplates(tmpls);
            const logs = await api.whatsapp.getLogs();
            setWaLogs(logs);
        } catch (e) {
            console.error(e);
        }
    };

    const handleGenerateQR = async () => {
        setIsGeneratingQr(true);
        try {
            const res = await api.whatsapp.getQr();
            if (res && res.qrCode) {
                setWaStatus(prev => ({ ...prev, qrCode: res.qrCode }));
            } else {
                alert('No se pudo generar el código QR. Inténtalo de nuevo.');
            }
        } catch (e: any) {
            console.error('Error generating QR:', e);
            alert(`Error al generar el QR:\n\n${e.message}`);
        } finally {
            setIsGeneratingQr(false);
        }
    };

    const loadServices = async () => {
        setIsLoadingServices(true);
        try {
            const data = await api.services.getAll();
            setServices(data || []);
        } catch (e) {
            console.error("Error loading services:", e);
        } finally {
            setIsLoadingServices(false);
        }
    };

    // Services Handlers
    const handleEditService = (service: Service) => {
        setEditingService(service);
        setServiceFormData({
            name: service.name,
            specialty_name: service.specialty_name,
            specialty_color: service.specialty_color,
            duration_min: service.duration_min,
            final_price: service.final_price,
            base_price: service.base_price
        });
        setIsServiceModalOpen(true);
    };

    const handleAddService = () => {
        setEditingService(null);
        setServiceFormData({
            name: '',
            specialty_name: 'Odontología',
            specialty_color: '#3b638e',
            duration_min: 30,
            final_price: 0,
            base_price: 0
        });
        setIsServiceModalOpen(true);
    };

    const handleSaveService = async () => {
        try {
            if (editingService) {
                await api.services.update(editingService.id, {
                    ...serviceFormData,
                    base_price: serviceFormData.final_price
                });
            } else {
                await api.services.create({
                    ...serviceFormData,
                    base_price: serviceFormData.final_price,
                    is_active: true
                });
            }
            setIsServiceModalOpen(false);
            loadServices();
        } catch (error) {
            console.error('Error saving service:', error);
            alert('Error al guardar el servicio');
        }
    };

    const handleDeleteService = async (id: string, name: string) => {
        if (!confirm(`¿Eliminar el servicio "${name}"?`)) return;
        try {
            await api.services.delete(id);
            loadServices();
        } catch (error) {
            console.error('Error deleting service:', error);
            alert('Error al eliminar el servicio');
        }
    };

    const handleUploadTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || !e.target.files[0]) return;
        const file = e.target.files[0];
        const title = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
        const category = 'General';
        try {
            setIsLoadingTemplates(true);
            await api.templates.upload(file, title, category);
            await loadTemplates();
        } catch (err: any) {
            alert(`❌ Error al subir plantilla: ${err.message}`);
        } finally {
            setIsLoadingTemplates(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDeleteTemplate = async (id: string, title: string) => {
        if (!confirm(`¿Eliminar la plantilla "${title}"?`)) return;
        try {
            await api.templates.delete(id);
            await loadTemplates();
        } catch (err: any) {
            alert(`❌ Error al eliminar: ${err.message}`);
        }
    };

    const handlePreviewTemplate = (doc: DocumentTemplate) => {
        const url = api.templates.getDownloadUrl(doc.content || doc.title) + '?preview=1';
        window.open(url, '_blank');
    };

    const handleDownloadTemplate = (doc: DocumentTemplate) => {
        const url = api.templates.getDownloadUrl(doc.content || doc.title);
        const a = document.createElement('a');
        a.href = url;
        a.download = doc.title;
        document.body.appendChild(a);
        a.click();
        a.remove();
    };

    const handlePrintHtmlTemplate = (doc: DocumentTemplate) => {
        const win = window.open('', '_blank');
        if (!win) return;
        win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>${doc.title}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12pt; line-height: 1.6; margin: 40px; color: #000; }
    h1, h2, h3 { color: #1a1a1a; }
    p { margin: 0.5em 0; }
    @media print { body { margin: 20mm; } @page { size: A4; margin: 20mm; } }
  </style>
</head>
<body>
  <h2 style="text-align:center; border-bottom:2px solid #333; padding-bottom:10px; margin-bottom:20px;">${doc.title}</h2>
  ${doc.content || ''}
  <div style="margin-top:60px; display:flex; justify-content:space-between;">
    <div style="text-align:center;"><div style="border-top:1px solid #333; width:200px; padding-top:5px;">Firma del Paciente</div></div>
    <div style="text-align:center;"><div style="border-top:1px solid #333; width:200px; padding-top:5px;">Firma del Profesional</div></div>
  </div>
</body>
</html>`);
        win.document.close();
        setTimeout(() => { win.focus(); win.print(); }, 400);
    };

    const handleSaveTemplate = async (data: { id?: string; title: string; category: string; content: string }) => {
        if (data.id) {
            await api.templates.update(data.id, { title: data.title, category: data.category, content: data.content });
        } else {
            await api.templates.create({ title: data.title, category: data.category, content: data.content });
        }
        await loadTemplates();
    };

    const handleUpdateStock = (id: string, delta: number) => {
        setStock(prev => prev.map(item => {
            if (item.id === id) {
                const newQty = Math.max(0, item.quantity + delta);
                return { ...item, quantity: newQty };
            }
            return item;
        }));
    };

    const handleCreateWaTemplate = async () => {
        if (!newWaTemplate.name || !newWaTemplate.content) return;
        try {
            const offsetString = `${newWaTemplate.triggerOffsetValue}${newWaTemplate.triggerOffsetUnit}`;
            await api.whatsapp.createTemplate({
                ...newWaTemplate,
                triggerOffset: offsetString
            });
            setNewWaTemplate({ ...newWaTemplate, name: '', content: '' }); // Reset fields but keep settings
            refreshWhatsApp();
        } catch (e) { alert('Error creando plantilla'); }
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(serviceSearch.toLowerCase()) ||
        s.specialty_name?.toLowerCase().includes(serviceSearch.toLowerCase())
    );

    return (
        <>
        <div className="flex h-full overflow-hidden bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* SETTINGS SIDEBAR */}
            <div className="w-64 bg-white border-r border-slate-200 p-6 flex flex-col gap-2 shrink-0">
                <h3 className="text-xl font-bold text-slate-900 mb-6 px-2">Configuración</h3>
                
                {/* GRUPO 1: GENERAL — hidden for RECEPTION */}
                {!isReception && (
                <div className="mb-4">
                    <p className="text-[9px] font-black uppercase text-slate-400 px-2 mb-2">General</p>
                    <button onClick={() => setSettingsTab('clinic')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'clinic' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Building2 size={14} /> Clínica
                    </button>
                    <button onClick={() => setSettingsTab('schedule')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'schedule' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Calendar size={14} /> Horarios
                    </button>
                    <button onClick={() => setSettingsTab('vacations')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'vacations' ? 'bg-orange-50 text-orange-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Calendar size={14} /> Vacaciones
                    </button>
                    <button onClick={() => setSettingsTab('audit')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'audit' ? 'bg-rose-50 text-rose-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <ShieldCheck size={14} /> Auditoría
                    </button>
                </div>
                )}

                {/* HORARIOS — visible for RECEPTION */}
                {isReception && (
                <div className="mb-4">
                    <p className="text-[9px] font-black uppercase text-slate-400 px-2 mb-2">Agendas</p>
                    <button onClick={() => setSettingsTab('schedule')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'schedule' ? 'bg-purple-50 text-purple-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Calendar size={14} /> Horarios
                    </button>
                </div>
                )}

                {/* GRUPO 2: OPERACIÓN */}
                <div className={`${!isReception ? 'border-t border-slate-200 pt-4 ' : ''}mb-4`}>
                    <p className="text-[9px] font-black uppercase text-slate-400 px-2 mb-2">Operación</p>
                    <button onClick={() => setSettingsTab('templates')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${settingsTab === 'templates' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        Plantillas
                    </button>
                    <button onClick={() => setSettingsTab('whatsapp')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${settingsTab === 'whatsapp' ? 'bg-green-50 text-green-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        WhatsApp & CRM
                    </button>
                    <button onClick={() => setSettingsTab('gmail')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'gmail' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Mail size={14} /> Gmail
                    </button>
                    <button onClick={() => { setSettingsTab('pagos'); api.clinicSettings.hasPaymentPin().then(setPinHasValue).catch(() => {}); }} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center gap-2 ${settingsTab === 'pagos' ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        <Lock size={14} /> Cobros
                    </button>
                    {!isReception && (
                    <>
                    <button onClick={() => setSettingsTab('stock')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${settingsTab === 'stock' ? 'bg-blue-50 text-blue-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        Inventario
                    </button>
                    <button onClick={() => setSettingsTab('services')} className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold uppercase tracking-widest transition-all ${settingsTab === 'services' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}>
                        Servicios / Tarifas
                    </button>
                    </>
                    )}
                </div>
            </div>

            {/* SETTINGS CONTENT */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                {settingsTab === 'whatsapp' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-end mb-6">
                            <div>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                    <Smartphone className="text-green-500" size={32} />
                                    WhatsApp Manager
                                </h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Automatización y Recordatorios</p>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setWaActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${waActiveTab === 'dashboard' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border'}`}>Dashboard</button>
                                <button onClick={() => setWaActiveTab('connection')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${waActiveTab === 'connection' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border'}`}>Conexión</button>
                                <button onClick={() => setWaActiveTab('templates')} className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${waActiveTab === 'templates' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border'}`}>Plantillas</button>
                            </div>
                        </div>

                        {waActiveTab === 'dashboard' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* CARD 1: Recordatorios (Reminders) */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <History size={18} className="text-blue-500" />
                                        Recordatorios (Últimos Enviados)
                                    </h4>
                                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                                        {waLogs.filter(l => l.type === 'APPOINTMENT_REMINDER').map(log => (
                                            <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className={`w-2 h-2 rounded-full mt-2 ${log.status === 'SENT' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <div className="flex-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs font-bold text-slate-700">{log.patient?.name || 'Paciente'}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(log.sentAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{log.content}</p>
                                                    {log.error && <p className="text-[10px] text-red-500 mt-1">{log.error}</p>}
                                                </div>
                                            </div>
                                        ))}
                                        {waLogs.filter(l => l.type === 'APPOINTMENT_REMINDER').length === 0 && <p className="text-center text-xs text-slate-400 py-4">No hay recordatorios recientes.</p>}
                                    </div>
                                </div>

                                {/* CARD 2: Seguimientos (Follow ups) */}
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                                        <RefreshCw size={18} className="text-purple-500" />
                                        Seguimientos (Follow-up)
                                    </h4>
                                    <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                                        {waLogs.filter(l => l.type === 'TREATMENT_FOLLOWUP').map(log => (
                                            <div key={log.id} className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                                                <div className={`w-2 h-2 rounded-full mt-2 ${log.status === 'SENT' ? 'bg-green-500' : 'bg-red-500'}`} />
                                                <div className="flex-1">
                                                    <div className="flex justify-between">
                                                        <span className="text-xs font-bold text-slate-700">{log.patient?.name || 'Paciente'}</span>
                                                        <span className="text-[10px] text-slate-400">{new Date(log.sentAt).toLocaleString()}</span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 line-clamp-2">{log.content}</p>
                                                </div>
                                            </div>
                                        ))}
                                        {waLogs.filter(l => l.type === 'TREATMENT_FOLLOWUP').length === 0 && <p className="text-center text-xs text-slate-400 py-4">No hay seguimientos registrados.</p>}
                                    </div>
                                </div>
                            </div>
                        )}

                        {waActiveTab === 'connection' && (
                            <div className="flex flex-col items-center justify-center bg-white p-12 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                                {waStatus.status === 'READY' || waStatus.status === 'AUTHENTICATED' ? (
                                    <div className="text-center animate-in zoom-in duration-300">
                                        <div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <CheckCircle2 size={48} className="text-green-600" />
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900">WhatsApp Conectado</h3>
                                        <p className="text-slate-500 mb-8">El servicio está activo y enviando recordatorios automáticos.</p>
                                        <div className="flex gap-4 justify-center">
                                            <button onClick={refreshWhatsApp} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-colors flex items-center gap-2">
                                                <RefreshCw size={14} /> Actualizar Estado
                                            </button>
                                            <button onClick={() => api.whatsapp.logout().then(refreshWhatsApp)} className="px-6 py-3 bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase hover:bg-red-100 transition-colors">
                                                Desconectar Sesión
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <div className="mb-8">
                                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <QrCode size={40} className="text-slate-400" />
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900">Vinculación de Dispositivo</h3>
                                            <p className="text-slate-500 max-w-md mx-auto mt-2">
                                                Para activar el envío de recordatorios, vincula el WhatsApp de la clínica escaneando el código.
                                            </p>
                                        </div>

                                        {waStatus.qrCode ? (
                                            <div className="space-y-6 animate-in fade-in zoom-in duration-500">
                                                <div className="bg-white p-4 rounded-3xl border-4 border-slate-900 inline-block shadow-2xl">
                                                    <img src={waStatus.qrCode} alt="WhatsApp QR" className="w-72 h-72 object-contain rounded-xl" />
                                                </div>
                                                <div className="flex flex-col items-center gap-2">
                                                    <p className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 text-amber-600 rounded-full text-[10px] font-black uppercase tracking-wider">
                                                        <RefreshCw size={12} className="animate-spin" /> Esperando escaneo...
                                                    </p>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        Abre WhatsApp {'>'} Dispositivos Vinculados {'>'} Vincular
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="w-72 h-72 bg-slate-50 rounded-3xl border border-dashed border-slate-200 flex items-center justify-center mx-auto mb-6">
                                                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center px-8">
                                                        {waStatus.status === 'INITIALIZING' ? 'Iniciando conexión...' : 'Haz clic en el botón para generar un código QR'}
                                                    </p>
                                                </div>
                                                <button 
                                                    onClick={handleGenerateQR}
                                                    disabled={isGeneratingQr}
                                                    className={`px-10 py-4 ${isGeneratingQr ? 'bg-slate-400' : 'bg-green-500 hover:scale-105'} text-white rounded-2xl font-black text-sm uppercase shadow-lg shadow-green-100 transition-all flex items-center gap-3 mx-auto`}
                                                >
                                                    {isGeneratingQr ? (
                                                        <>
                                                            <RefreshCw size={20} className="animate-spin" /> Generando...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <QrCode size={20} /> Generar Código QR
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        )}

                                        <button onClick={refreshWhatsApp} className="mt-12 text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] hover:text-blue-600 transition-colors flex items-center gap-2 mx-auto">
                                            <RefreshCw size={12} /> Refrescar Estado
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {waActiveTab === 'templates' && (
                            <div className="space-y-6">
                                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                                    <h4 className="text-sm font-bold text-slate-900 uppercase mb-4">Nueva Plantilla</h4>
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <input
                                            placeholder="Nombre de la plantilla"
                                            value={newWaTemplate.name}
                                            onChange={e => setNewWaTemplate({ ...newWaTemplate, name: e.target.value })}
                                            className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                        <div className="flex gap-2">
                                            <select
                                                value={newWaTemplate.triggerType}
                                                onChange={e => setNewWaTemplate({ ...newWaTemplate, triggerType: e.target.value })}
                                                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 flex-1"
                                            >
                                                <option value="APPOINTMENT_REMINDER">Recordatorio de Cita</option>
                                                <option value="BIRTHDAY">Felicitación Cumpleaños</option>
                                                <option value="TREATMENT_FOLLOWUP">Seguimiento Tratamiento</option>
                                            </select>

                                        </div>
                                    </div>
                                    {/* Structured Offset Input */}
                                    <div className="flex gap-2 mb-4 items-center">
                                        <div className="flex-1">
                                            <label className="text-[10px] font-black uppercase text-slate-400">Cuándo enviar</label>
                                            <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden mt-1">
                                                <input
                                                    type="number"
                                                    value={newWaTemplate.triggerOffsetValue}
                                                    onChange={e => setNewWaTemplate({ ...newWaTemplate, triggerOffsetValue: e.target.value })}
                                                    className="w-16 px-3 py-2 text-sm font-bold bg-transparent outline-none text-center"
                                                />
                                                <div className="w-px bg-slate-200"></div>
                                                <select
                                                    value={newWaTemplate.triggerOffsetUnit}
                                                    onChange={e => setNewWaTemplate({ ...newWaTemplate, triggerOffsetUnit: e.target.value })}
                                                    className="flex-1 px-3 py-2 text-xs font-bold bg-transparent outline-none uppercase"
                                                >
                                                    <option value="h">Horas</option>
                                                    <option value="d">Días</option>
                                                    <option value="mo">Meses</option>
                                                </select>
                                                <div className="w-px bg-slate-200"></div>
                                                <select
                                                    value={newWaTemplate.triggerOffsetDirection}
                                                    onChange={e => setNewWaTemplate({ ...newWaTemplate, triggerOffsetDirection: e.target.value })}
                                                    className="flex-1 px-3 py-2 text-xs font-bold bg-transparent outline-none uppercase"
                                                >
                                                    <option value="before">Antes de la cita</option>
                                                    <option value="after">Después de la cita</option>
                                                </select>
                                            </div>
                                        </div>
                                    </div>

                                    <textarea
                                        placeholder="Contenido del mensaje..."
                                        value={newWaTemplate.content}
                                        onChange={e => setNewWaTemplate({ ...newWaTemplate, content: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-100 min-h-[100px] mb-2"
                                    />
                                    <p className="text-[10px] text-slate-400 font-medium mb-4">
                                        Variables disponibles: <span className="font-bold text-slate-600">{"{{PACIENTE}}"}</span>, <span className="font-bold text-slate-600">{"{{CITA}}"}</span>, <span className="font-bold text-slate-600">{"{{DOCTOR}}"}</span>, <span className="font-bold text-slate-600">{"{{FECHA}}"}</span>, <span className="font-bold text-slate-600">{"{{HORA}}"}</span>, <span className="font-bold text-slate-600">{"{{TRATAMIENTO}}"}</span>
                                    </p>
                                    <div className="flex justify-end">
                                        <button onClick={handleCreateWaTemplate} className="bg-slate-900 text-white px-6 py-2 rounded-xl text-xs font-bold uppercase hover:bg-slate-800">
                                            Guardar Plantilla
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {waTemplates.map(t => (
                                        <div key={t.id} className="bg-white p-5 rounded-xl border border-slate-200 hover:shadow-md transition-shadow relative group">
                                            <button
                                                onClick={async () => { await api.whatsapp.deleteTemplate(t.id); refreshWhatsApp(); }}
                                                className="absolute top-4 right-4 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <div className="flex items-center gap-2 mb-3">
                                                <MessageSquare size={16} className="text-blue-500" />
                                                <h5 className="font-bold text-slate-900">{t.name}</h5>
                                            </div>
                                            <div className="flex gap-2 mb-3">
                                                <span className="text-[10px] font-bold uppercase bg-slate-100 text-slate-500 px-2 py-1 rounded">{t.triggerType}</span>
                                                <span className="text-[10px] font-bold uppercase bg-blue-50 text-blue-600 px-2 py-1 rounded">{t.triggerOffset}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-100">
                                                {t.content}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {settingsTab === 'services' && (() => {
                    // Helper variables for filtering and grouping - calculated inside render to avoid state duplication issues or just use previous pattern
                    const specialties = [...new Set(services.map(s => s.specialty_name).filter(Boolean))].sort();

                    const filtered = services.filter(service => {
                        const matchesSearch = service.name.toLowerCase().includes(serviceSearch.toLowerCase());
                        const matchesSpecialty = !selectedSpecialty || service.specialty_name === selectedSpecialty;
                        return matchesSearch && matchesSpecialty;
                    });

                    const groupedServices = filtered.reduce((acc, service) => {
                        const specialty = service.specialty_name || 'Otros';
                        if (!acc[specialty]) acc[specialty] = [];
                        acc[specialty].push(service);
                        return acc;
                    }, {} as Record<string, Service[]>);

                    return (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                            {/* Header & Controls */}
                            <div className="flex flex-col gap-6">
                                <div className="flex justify-between items-end">
                                    <div>
                                        <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                            <Stethoscope className="text-violet-500" size={32} />
                                            Tarifas y Servicios
                                        </h3>
                                        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">{services.length} Servicios Activos</p>
                                    </div>
                                    <button
                                        onClick={handleAddService}
                                        className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg hover:shadow-violet-200"
                                    >
                                        <Plus size={16} /> Nuevo Servicio
                                    </button>
                                </div>

                                {/* Filters */}
                                <div className="flex gap-4">
                                    <div className="flex-1 relative">
                                        <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
                                        <input
                                            value={serviceSearch}
                                            onChange={(e) => setServiceSearch(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-violet-50 transition-all min-w-[250px]"
                                            placeholder="Buscar servicio..."
                                        />
                                    </div>
                                    <div className="relative min-w-[200px]">
                                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                        <select
                                            value={selectedSpecialty}
                                            onChange={(e) => setSelectedSpecialty(e.target.value)}
                                            className="w-full bg-white border border-slate-200 rounded-xl pl-11 pr-8 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-violet-50 transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">Todas las especialidades</option>
                                            {specialties.map(spec => (
                                                <option key={spec} value={spec}>{spec}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {isLoadingServices ? (
                                <div className="bg-white rounded-[2rem] p-12 border border-slate-200 shadow-lg text-center">
                                    <div className="animate-spin w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full mx-auto mb-4"></div>
                                    <p className="text-slate-500 font-bold">Cargando servicios...</p>
                                </div>
                            ) : filtered.length === 0 ? (
                                <div className="bg-white rounded-[2rem] p-12 border border-slate-200 shadow-lg text-center">
                                    <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                                    <p className="text-slate-500 font-bold">No se encontraron servicios</p>
                                </div>
                            ) : (
                                <div className="space-y-8 pb-20">
                                    {(Object.entries(groupedServices) as [string, Service[]][]).sort().map(([specialty, items]) => (
                                        <div key={specialty}>
                                            <div className="flex items-center gap-3 mb-4 sticky top-0 bg-slate-50/95 backdrop-blur z-10 py-2">
                                                <div
                                                    className="w-3 h-3 rounded-full"
                                                    style={{ backgroundColor: items[0]?.specialty_color || '#3b638e' }}
                                                />
                                                <h2 className="text-lg font-black text-slate-900">{specialty}</h2>
                                                <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-2 py-0.5 rounded-full">{items.length}</span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {items.map(service => (
                                                    <div
                                                        key={service.id}
                                                        className="bg-white rounded-2xl p-5 border border-slate-200 hover:border-violet-300 hover:shadow-lg transition-all group relative"
                                                    >
                                                        <div className="flex justify-between items-start mb-3">
                                                            <h3 className="text-xs font-black text-slate-900 leading-tight pr-8 uppercase">{service.name}</h3>

                                                            <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white pl-2">
                                                                <button
                                                                    onClick={() => handleEditService(service)}
                                                                    className="p-1.5 hover:bg-violet-50 rounded-lg text-slate-400 hover:text-violet-600 transition-colors"
                                                                >
                                                                    <Edit3 size={14} />
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteService(service.id, service.name)}
                                                                    className="p-1.5 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                                                                >
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-end justify-between mt-4">
                                                            <p className="text-lg font-black text-violet-600">{service.final_price.toFixed(2)}€</p>
                                                            <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">{service.duration_min} min</span>
                                                        </div>
                                                        {!service.is_active && (
                                                            <div className="absolute top-2 left-2 px-2 py-0.5 bg-slate-100 text-slate-400 text-[9px] font-bold rounded-full">
                                                                INACTIVO
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Service Modal (Nested here to access state, could be outside) */}
                            {isServiceModalOpen && (
                                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                                    <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                                        <div className="flex justify-between items-center mb-6">
                                            <h3 className="text-xl font-black text-slate-900">
                                                {editingService ? '✏️ Editar Servicio' : '➕ Nuevo Servicio'}
                                            </h3>
                                            <button
                                                onClick={() => setIsServiceModalOpen(false)}
                                                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
                                            >
                                                <X size={20} />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            <div>
                                                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Nombre del servicio</label>
                                                <input
                                                    type="text"
                                                    value={serviceFormData.name}
                                                    onChange={(e) => setServiceFormData({ ...serviceFormData, name: e.target.value })}
                                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200"
                                                    placeholder="Ej: Limpieza Dental"
                                                />
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Especialidad</label>
                                                    <select
                                                        value={serviceFormData.specialty_name}
                                                        onChange={(e) => setServiceFormData({ ...serviceFormData, specialty_name: e.target.value })}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200"
                                                    >
                                                        {specialties.map(spec => (
                                                            <option key={spec} value={spec}>{spec}</option>
                                                        ))}
                                                        <option value="">Otra...</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Color</label>
                                                    <input
                                                        type="color"
                                                        value={serviceFormData.specialty_color}
                                                        onChange={(e) => setServiceFormData({ ...serviceFormData, specialty_color: e.target.value })}
                                                        className="w-full h-12 rounded-xl cursor-pointer border border-slate-200"
                                                    />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Precio (€)</label>
                                                    <input
                                                        type="number"
                                                        value={serviceFormData.final_price}
                                                        onChange={(e) => setServiceFormData({ ...serviceFormData, final_price: parseFloat(e.target.value) || 0 })}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200"
                                                        min="0"
                                                        step="0.01"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Duración (min)</label>
                                                    <input
                                                        type="number"
                                                        value={serviceFormData.duration_min}
                                                        onChange={(e) => setServiceFormData({ ...serviceFormData, duration_min: parseInt(e.target.value) || 30 })}
                                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200"
                                                        min="5"
                                                        step="5"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex gap-4 mt-8">
                                            <button
                                                onClick={() => setIsServiceModalOpen(false)}
                                                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                onClick={handleSaveService}
                                                disabled={!serviceFormData.name || !serviceFormData.final_price}
                                                className="flex-1 bg-gradient-to-r from-violet-600 to-purple-600 text-white py-3 rounded-xl font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Check size={18} />
                                                {editingService ? 'Guardar' : 'Crear'}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

                {settingsTab === 'gmail' && <GmailSettings />}

                {settingsTab === 'templates' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Gestor de Plantillas</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Documentos y Consentimientos</p>
                            </div>
                            {/* TEMPLATE SEARCH BAR */}
                            <div className="flex-1 max-w-sm mx-4">
                                <div className="relative">
                                    <Search size={16} className="absolute left-4 top-3.5 text-slate-400" />
                                    <input
                                        value={templateSearch}
                                        onChange={(e) => setTemplateSearch(e.target.value)}
                                        className="w-full bg-white border border-slate-200 rounded-2xl pl-12 pr-4 py-3 text-xs font-bold outline-none focus:ring-4 focus:ring-slate-100 transition-all"
                                        placeholder="Buscar plantilla..."
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept=".pdf,.docx,.txt"
                                    onChange={handleUploadTemplate}
                                />
                                <button
                                    onClick={() => setEditingTemplate(null)}
                                    className="bg-blue-600 text-white px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2"
                                >
                                    <Plus size={16} /> Nueva Plantilla
                                </button>
                                <button onClick={() => fileInputRef.current?.click()} disabled={isLoadingTemplates} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 disabled:opacity-60">
                                    <UserPlus size={16} /> {isLoadingTemplates ? 'Subiendo...' : 'Subir Archivo'}
                                </button>
                            </div>
                        </div>

                        {isLoadingTemplates && templates.length === 0 ? (
                            <div className="py-20 text-center">
                                <div className="animate-spin w-10 h-10 border-4 border-slate-200 border-t-slate-700 rounded-full mx-auto mb-4" />
                                <p className="text-xs text-slate-400 font-bold uppercase">Cargando plantillas...</p>
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="py-20 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
                                <FileTextIcon size={40} className="mx-auto text-slate-300 mb-4" />
                                <p className="text-sm font-bold text-slate-400">No hay plantillas subidas</p>
                                <p className="text-xs text-slate-400 mt-1">Haz clic en "Subir Plantilla" para añadir documentos</p>
                            </div>
                        ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {templates.map(doc => {
                                const isMatch = templateSearch ? doc.title.toLowerCase().includes(templateSearch.toLowerCase()) : true;
                                if (!isMatch) return null;
                                return (
                                    <div
                                        key={doc.id}
                                        id={`template-${doc.id}`}
                                        className="group bg-white p-6 rounded-xl border border-slate-200 hover:shadow-lg hover:border-slate-300 transition-all relative"
                                    >
                                        {/* Delete button */}
                                        <button
                                            onClick={() => handleDeleteTemplate(doc.id, doc.title)}
                                            className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 bg-red-50 text-red-400 hover:text-red-600 rounded-lg"
                                            title="Eliminar"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                        <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                            {doc.type === 'pdf' ? <FileTextIcon size={24} className="text-rose-500" /> : doc.type === 'html' ? <FileTextIcon size={24} className="text-emerald-600" /> : <FileTextIcon size={24} className="text-blue-600" />}
                                        </div>
                                        <h4 className="text-xs font-bold text-slate-900 uppercase leading-snug mb-2 line-clamp-2 min-h-[2.5em] pr-6">{doc.title}</h4>
                                        <div className="flex justify-between items-center opacity-60 mb-4">
                                            <span className="text-[9px] font-bold uppercase bg-slate-100 px-2 py-1 rounded text-slate-600">{doc.category || 'General'}</span>
                                            <span className="text-[9px] font-bold text-slate-400">{doc.size}</span>
                                        </div>
                                        {/* Action buttons */}
                                        <div className="flex gap-2 mt-auto flex-wrap">
                                            {/* HTML templates: edit + print */}
                                            {doc.type === 'html' && (
                                                <>
                                                    <button
                                                        onClick={() => setEditingTemplate(doc)}
                                                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-blue-600 bg-blue-50 hover:bg-blue-100 py-2 rounded-lg transition-colors"
                                                    >
                                                        <Edit3 size={12} /> Editar
                                                    </button>
                                                    <button
                                                        onClick={() => handlePrintHtmlTemplate(doc)}
                                                        className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 hover:bg-emerald-100 py-2 rounded-lg transition-colors"
                                                    >
                                                        <Printer size={12} /> Imprimir
                                                    </button>
                                                </>
                                            )}
                                            {/* PDF templates: preview + download */}
                                            {doc.type === 'pdf' && (
                                                <button
                                                    onClick={() => handlePreviewTemplate(doc)}
                                                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-indigo-600 bg-indigo-50 hover:bg-indigo-100 py-2 rounded-lg transition-colors"
                                                >
                                                    <Eye size={12} /> Ver
                                                </button>
                                            )}
                                            {/* DOCX/PDF: download */}
                                            {doc.type !== 'html' && (
                                                <button
                                                    onClick={() => handleDownloadTemplate(doc)}
                                                    className="flex-1 flex items-center justify-center gap-1 text-[10px] font-bold uppercase text-slate-600 bg-slate-100 hover:bg-slate-200 py-2 rounded-lg transition-colors"
                                                >
                                                    <Download size={12} /> Descargar
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        )}
                    </div>
                )}

                {settingsTab === 'stock' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
                        <div className="flex justify-between items-end">
                            <div>
                                <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Inventario Global</h3>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Gestión de Stock y Mínimos</p>
                            </div>
                            <button className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2">
                                <Plus size={16} /> Añadir Producto
                            </button>
                        </div>


                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100">
                                    <tr><th className="p-6">Producto</th><th className="p-6">Categoría</th><th className="p-6 text-right">Stock</th><th className="p-6 text-right">Mínimo</th><th className="p-6 text-center">Estado</th><th className="p-6"></th></tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {stock.map(item => (
                                        <tr key={item.id} className="text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                            <td className="p-6 text-slate-900">{item.name}</td>
                                            <td className="p-6"><span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-[10px] uppercase font-bold">{item.category}</span></td>
                                            <td className="p-6 text-right font-bold">{item.quantity} <span className="text-[10px] font-bold text-slate-400 uppercase">{item.unit}</span></td>
                                            <td className="p-6 text-right text-slate-400">{item.minStock}</td>
                                            <td className="p-6 text-center">
                                                {item.quantity <= item.minStock ? (
                                                    <span className="bg-rose-100 text-rose-600 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center justify-center gap-1 mx-auto w-fit"><AlertTriangle size={10} /> Bajo Stock</span>
                                                ) : (
                                                    <span className="bg-emerald-100 text-emerald-600 px-3 py-1 rounded-full text-[9px] font-black uppercase flex items-center justify-center gap-1 mx-auto w-fit"><CheckCircle2 size={10} /> OK</span>
                                                )}
                                            </td>
                                            <td className="p-6 text-right">
                                                {currentUserRole === 'ADMIN' && (
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button onClick={() => handleUpdateStock(item.id, -1)} className="p-1 hover:bg-slate-200 rounded"><Minus size={14} /></button>
                                                        <button onClick={() => handleUpdateStock(item.id, 1)} className="p-1 hover:bg-slate-200 rounded"><Plus size={14} /></button>
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* CLINIC INFO SECTION */}
                {settingsTab === 'clinic' && !isReception && <ClinicInfo />}

                {/* SCHEDULE AVAILABILITY SECTION */}
                {settingsTab === 'schedule' && <ScheduleAvailability />}

                {/* VACATIONS SECTION */}
                {settingsTab === 'vacations' && !isReception && <Vacations />}

                {/* ─── PAGOS / PIN SECTION ─────────────────────────────────────────── */}
                {settingsTab === 'pagos' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                <Lock className="text-amber-500" size={28} />
                                Seguridad de Cobros
                            </h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                PIN obligatorio para autorizar cobros por Tarjeta y Transferencia
                            </p>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-5">
                            <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
                                <Lock size={16} className="text-amber-600 flex-shrink-0" />
                                <p className="text-xs font-bold text-amber-700">
                                    {pinHasValue
                                        ? 'El PIN de autorización está configurado. Cámbialo introduciendo uno nuevo.'
                                        : 'No hay PIN configurado. Los cobros por Tarjeta y Transferencia no lo requerirán hasta que establezcas uno.'}
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Nuevo PIN (4–8 dígitos)</label>
                                    <input
                                        type="password"
                                        value={pinInput}
                                        onChange={e => { setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinSaved(false); }}
                                        placeholder="••••"
                                        maxLength={8}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-amber-100 tracking-widest"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Confirmar PIN</label>
                                    <input
                                        type="password"
                                        value={pinConfirm}
                                        onChange={e => { setPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8)); setPinSaved(false); }}
                                        placeholder="••••"
                                        maxLength={8}
                                        className={`w-full bg-slate-50 border rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 tracking-widest ${
                                            pinConfirm && pinInput !== pinConfirm
                                                ? 'border-red-300 focus:ring-red-100'
                                                : 'border-slate-200 focus:ring-amber-100'
                                        }`}
                                    />
                                    {pinConfirm && pinInput !== pinConfirm && (
                                        <p className="text-[10px] text-red-500 font-bold mt-1">Los PINs no coinciden</p>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <button
                                    disabled={pinSaving || pinInput.length < 4 || pinInput !== pinConfirm}
                                    onClick={async () => {
                                        setPinSaving(true);
                                        try {
                                            await api.clinicSettings.setPaymentPin(pinInput);
                                            setPinHasValue(true);
                                            setPinSaved(true);
                                            setPinInput('');
                                            setPinConfirm('');
                                        } catch {
                                            alert('Error al guardar el PIN');
                                        } finally {
                                            setPinSaving(false);
                                        }
                                    }}
                                    className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                                >
                                    {pinSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                    Guardar PIN
                                </button>
                                {pinSaved && (
                                    <span className="text-xs text-emerald-600 font-black flex items-center gap-1">
                                        <CheckCircle2 size={14} /> PIN guardado correctamente
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── AUDIT LOG SECTION (ADMIN only) ─────────────────────────────── */}
                {settingsTab === 'audit' && (
                    <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                        <div>
                            <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                                <ShieldCheck className="text-rose-500" size={28} />
                                Log de Auditoría
                            </h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">
                                Registro completo de acciones sobre citas, pacientes, historiales, tratamientos y pagos
                            </p>
                        </div>

                        {/* Filters */}
                        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Módulo</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                                        value={auditFilter.resource_type}
                                        onChange={e => setAuditFilter(f => ({ ...f, resource_type: e.target.value }))}
                                    >
                                        <option value="">Todos</option>
                                        <option value="appointments">Citas</option>
                                        <option value="patients">Pacientes</option>
                                        <option value="clinical_records">Historiales Clínicos</option>
                                        <option value="treatments">Tratamientos</option>
                                        <option value="clinical_plans">Planes de Tratamiento</option>
                                        <option value="payments">Pagos</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Acción</label>
                                    <select
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                                        value={auditFilter.action}
                                        onChange={e => setAuditFilter(f => ({ ...f, action: e.target.value }))}
                                    >
                                        <option value="">Todas</option>
                                        <option value="CREATE">Creación</option>
                                        <option value="UPDATE">Modificación</option>
                                        <option value="DELETE">Eliminación</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Desde</label>
                                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                                        value={auditFilter.date_from}
                                        onChange={e => setAuditFilter(f => ({ ...f, date_from: e.target.value }))} />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Hasta</label>
                                    <input type="date" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-600 outline-none"
                                        value={auditFilter.date_to}
                                        onChange={e => setAuditFilter(f => ({ ...f, date_to: e.target.value }))} />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => { setAuditOffset(0); loadAuditLogs(0, auditFilter); }}
                                    className="flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase"
                                >
                                    <Filter size={13} /> Filtrar
                                </button>
                                <button
                                    onClick={() => {
                                        const cleared = { resource_type: '', action: '', date_from: '', date_to: '' };
                                        setAuditFilter(cleared);
                                        loadAuditLogs(0, cleared);
                                    }}
                                    className="flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-slate-200"
                                >
                                    <X size={13} /> Limpiar
                                </button>
                                <button onClick={() => loadAuditLogs(auditOffset, auditFilter)} className="flex items-center gap-2 bg-slate-100 text-slate-500 px-4 py-2 rounded-xl text-xs font-bold uppercase hover:bg-slate-200">
                                    <RefreshCw size={13} className={auditLoading ? 'animate-spin' : ''} /> Actualizar
                                </button>
                                <span className="ml-auto text-xs text-slate-400 self-center font-bold">{auditTotal} resultado{auditTotal !== 1 ? 's' : ''}</span>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            {auditLoading ? (
                                <div className="flex items-center justify-center py-16 text-slate-400">
                                    <RefreshCw className="animate-spin mr-2" size={18} /> Cargando...
                                </div>
                            ) : auditLogs.length === 0 ? (
                                <div className="text-center py-16 text-slate-400 text-sm font-bold">No hay registros de auditoría para los filtros seleccionados.</div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-slate-50 border-b border-slate-200">
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">Fecha y Hora</th>
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">Usuario</th>
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">Rol</th>
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">Acción</th>
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">Módulo</th>
                                                <th className="px-4 py-3 text-left font-black uppercase text-slate-400 tracking-wide">ID Registro</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {auditLogs.map((log: any) => {
                                                const actionColors: Record<string, string> = {
                                                    CREATE: 'bg-emerald-100 text-emerald-700',
                                                    UPDATE: 'bg-blue-100 text-blue-700',
                                                    DELETE: 'bg-red-100 text-red-700',
                                                    LOGIN:  'bg-slate-100 text-slate-600',
                                                    LOGOUT: 'bg-slate-100 text-slate-600',
                                                };
                                                const moduleLabels: Record<string, string> = {
                                                    appointments:    'Citas',
                                                    patients:        'Pacientes',
                                                    clinical_records:'Historiales',
                                                    treatments:      'Tratamientos',
                                                    clinical_plans:  'Planes',
                                                    payments:        'Pagos',
                                                };
                                                return (
                                                    <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                                                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                                                            {new Date(log.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                            {' '}<span className="text-slate-400">{new Date(log.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
                                                        </td>
                                                        <td className="px-4 py-3 font-bold text-slate-700">{log.user_name || '—'}</td>
                                                        <td className="px-4 py-3 text-slate-500">{log.user_role || '—'}</td>
                                                        <td className="px-4 py-3">
                                                            <span className={`px-2 py-1 rounded-full font-black text-[10px] uppercase ${actionColors[log.action] || 'bg-slate-100 text-slate-500'}`}>
                                                                {log.action}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-slate-600 font-bold">{moduleLabels[log.resource_type] || log.resource_type}</td>
                                                        <td className="px-4 py-3 text-slate-400 font-mono text-[10px] truncate max-w-[120px]">{log.resource_id || '—'}</td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            {/* Pagination */}
                            {auditTotal > AUDIT_LIMIT && (
                                <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                                    <button
                                        disabled={auditOffset === 0}
                                        onClick={() => loadAuditLogs(Math.max(0, auditOffset - AUDIT_LIMIT), auditFilter)}
                                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold disabled:opacity-40 hover:bg-slate-200"
                                    >← Anterior</button>
                                    <span className="text-xs text-slate-400 font-bold">
                                        {auditOffset + 1}–{Math.min(auditOffset + AUDIT_LIMIT, auditTotal)} de {auditTotal}
                                    </span>
                                    <button
                                        disabled={auditOffset + AUDIT_LIMIT >= auditTotal}
                                        onClick={() => loadAuditLogs(auditOffset + AUDIT_LIMIT, auditFilter)}
                                        className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-bold disabled:opacity-40 hover:bg-slate-200"
                                    >Siguiente →</button>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div >

        {/* Template Editor Modal */}
        {editingTemplate !== undefined && (
            <TemplateEditorModal
                template={editingTemplate}
                onSave={handleSaveTemplate}
                onClose={() => setEditingTemplate(undefined)}
            />
        )}
        </>
    );
};

export default Settings;
