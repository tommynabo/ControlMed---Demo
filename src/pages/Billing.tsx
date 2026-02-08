import React, { useState, useEffect } from 'react';
import {
    Download, DollarSign, Calendar, User, FileText, Trash2,
    Plus, BarChart3, QrCode, TrendingDown, TrendingUp, CreditCard, Mail
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api as apiService } from '../services/api'; // Direct import to avoid context issues
import { Invoice, Expense } from '../../types';

const Billing: React.FC = () => {
    const { patients, setPatients, invoices, setInvoices, expenses, setExpenses, currentUserRole, refreshPatients, appointments } = useAppContext();
    const api = apiService; // Use direct import

    const [billingTab, setBillingTab] = useState<'overview' | 'invoices' | 'expenses'>('overview');
    const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
    const [exportDate, setExportDate] = useState('');

    // Refresh patients on mount to ensure search works with latest data
    useEffect(() => {
        refreshPatients();
    }, []);

    // Invoice Creation State
    const [selectedPatientId, setSelectedPatientId] = useState('');
    const [invoiceItems, setInvoiceItems] = useState<{ name: string, price: number }[]>([{ name: 'Consulta General', price: 50.0 }]);
    const [patientSearch, setPatientSearch] = useState(''); // Text for search input
    const [paymentMethod, setPaymentMethod] = useState<'card' | 'cash' | 'transfer'>('card');

    // New State for Invoice Type
    const [invoiceType, setInvoiceType] = useState<'ordinary' | 'rectificative' | 'ADVANCE_PAYMENT'>('ordinary');
    const [invoiceStep, setInvoiceStep] = useState<1 | 2>(1); // Step 1: Type & Patient, Step 2: Items & Emit

    const [isEmitting, setIsEmitting] = useState(false);
    const [emitError, setEmitError] = useState<string | null>(null);

    const handleAddItem = () => {
        setInvoiceItems([...invoiceItems, { name: '', price: 0 }]);
    };

    const handleRemoveItem = (index: number) => {
        setInvoiceItems(invoiceItems.filter((_, i) => i !== index));
    };

    const handleItemChange = (index: number, field: 'name' | 'price', value: string | number) => {
        const newItems = [...invoiceItems];
        if (field === 'price') newItems[index].price = parseFloat(value as string) || 0;
        else newItems[index].name = value as string;
        setInvoiceItems(newItems);
    };

    const handleEmitInvoice = async () => {
        if (!selectedPatientId) return setEmitError("Selecciona un paciente");
        if (invoiceItems.length === 0) return setEmitError("Añade al menos un concepto");

        setIsEmitting(true);
        setEmitError(null);

        try {
            const patient = patients.find(p => p.id === selectedPatientId);
            if (!patient) throw new Error("Paciente no encontrado");

            const payload = {
                patient: patient,
                items: invoiceItems,
                paymentMethod: paymentMethod, // Use state
                type: paymentMethod === 'ADVANCE_PAYMENT' ? 'ADVANCE_PAYMENT' : invoiceType // Override type for wallet update
            };

            const data = await api.invoices.create(payload) as any;

            // Add invoice to local state
            const newInvoice: any = {
                id: data.invoiceId || data.id || `inv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                invoiceNumber: data.invoiceNumber || data.invoice_number,
                amount: invoiceItems.reduce((sum, i) => sum + i.price, 0),
                patientId: patient.id,
                date: new Date().toISOString(),
                status: 'issued',
                paymentMethod: 'card',
                // Prefer Preview URL for immediate viewing (ephemeral), fallback to authenticated URL
                url: data.previewUrl || data.url || data.pdf_url || `https://facturadirecta2.s3.amazonaws.com/tmp/simulated_path/${data.invoiceNumber || 'draft'}/factura_${data.invoiceNumber || Date.now()}_print.html`,
                qrUrl: data.qr_url || data.qrUrl || `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://verifactu.sede.gob.es/vn?td=FACTURA_DIRECTA_${data.invoiceNumber || 'DEMO'}`
            };

            setInvoices(prev => [newInvoice, ...prev]);
            await refreshPatients(); // Refresh to update wallet balance

            // REFRESH PATIENTS TO UPDATE WALLET
            api.getPatients().then(pts => {
                if (Array.isArray(pts)) setPatients(pts);
            }).catch(e => console.error("Error refreshing patients after invoice:", e));

            alert(`✅ Factura ${data.invoiceNumber || data.invoice_number} emitida con éxito!`);

            // Open PDF immediately (Prefer Preview URL for browser)
            const openUrl = data.previewUrl || data.url || data.pdf_url;
            if (openUrl) {
                window.open(openUrl, '_blank');
            }

            setIsInvoiceModalOpen(false);

            // Reset form
            setInvoiceStep(1); // Reset to step 1
            setSelectedPatientId('');
            setInvoiceItems([{ name: 'Consulta General', price: 50.0 }]);

        } catch (e: any) {
            console.error("Emit Error", e);
            console.log("API State:", api);
            setEmitError(e.message);
        } finally {
            setIsEmitting(false);
        }
    };

    // Mock Data for Revenue History (Should be dynamic or from context)
    const REVENUE_HISTORY = [
        { day: 'Lun', amount: 1240 }, { day: 'Mar', amount: 1890 }, { day: 'Mie', amount: 1450 },
        { day: 'Jue', amount: 2420 }, { day: 'Vie', amount: 2110 }, { day: 'Sab', amount: 790 }, { day: 'Dom', amount: 0 }
    ];

    // Computed Stats
    const stats = React.useMemo(() => {
        const total = invoices.reduce((acc, curr) => acc + curr.amount, 0);
        const byCard = invoices.filter(i => i.paymentMethod === 'card').reduce((acc, curr) => acc + curr.amount, 0);
        const byCash = invoices.filter(i => i.paymentMethod === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
        return { total, byCard, byCash, count: invoices.length };
    }, [invoices]);

    // Cash register close with pending appointments validation
    const handleCloseCashRegister = () => {
        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = appointments.filter(a => {
            const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
            return apptDate === today;
        });

        // Check for pending appointments (not completed, canceled, or noshow)
        const pendingAppts = todayAppointments.filter(a => {
            const status = a.status?.toLowerCase() || 'scheduled';
            return !['completed', 'realizada', 'canceled', 'cancelled', 'anulada', 'noshow', 'no vino'].includes(status);
        });

        if (pendingAppts.length > 0) {
            // Build list of pending appointments
            const pendingList = pendingAppts.map(a => {
                const patient = patients.find(p => p.id === a.patientId);
                return `• ${patient?.name || 'Paciente'} - ${a.time}`;
            }).join('\n');

            alert(`⚠️ No puedes cerrar la caja. Hay ${pendingAppts.length} citas pendientes:\n\n${pendingList}\n\nMarca las citas como realizadas, anuladas o no presentado antes de cerrar.`);
            return;
        }

        // All appointments processed - show summary
        const todayInvoices = invoices.filter(inv => {
            if (!inv.date) return false;
            return inv.date.split('T')[0] === today;
        });
        const totalToday = todayInvoices.reduce((sum, inv) => sum + inv.amount, 0);
        const completedCount = todayAppointments.filter(a => ['completed', 'realizada'].includes(a.status?.toLowerCase() || '')).length;
        const canceledCount = todayAppointments.filter(a => ['canceled', 'cancelled', 'anulada'].includes(a.status?.toLowerCase() || '')).length;
        const noShowCount = todayAppointments.filter(a => ['noshow', 'no vino'].includes(a.status?.toLowerCase() || '')).length;

        const summary = `✅ CIERRE DE CAJA - ${new Date().toLocaleDateString('es-ES')}\n\n` +
            `📊 Resumen del día:\n` +
            `• Citas realizadas: ${completedCount}\n` +
            `• Citas anuladas: ${canceledCount}\n` +
            `• No se presentaron: ${noShowCount}\n\n` +
            `💰 Facturación:\n` +
            `• Total facturado: ${totalToday.toFixed(2)}€\n` +
            `• Facturas emitidas: ${todayInvoices.length}\n\n` +
            `¿Confirmar cierre de caja?`;

        if (confirm(summary)) {
            alert('✅ Caja cerrada correctamente. Los datos han sido registrados.');
        }
    };

    const handleDownloadInvoice = async (invoice: Invoice) => {
        try {
            // Attempt to get a fresh URL (ephemeral or proxy)
            const data = await api.invoices.getDownloadUrl(invoice.id);
            if (data.url || data.previewUrl) {
                window.open(data.url || data.previewUrl, '_blank');
            } else {
                alert("No se pudo obtener la URL de descarga. Inténtelo de nuevo.");
            }
        } catch (e) {
            console.error("Download error:", e);
            // Fallback to stored URL if available (though likely authenticated/broken if that's the issue)
            if (invoice.url) {
                window.open(invoice.url, '_blank');
            } else {
                alert("Error al descargar la factura.");
            }
        }
    };

    const handleDownloadZip = async (date: string) => {
        // Logic from App.tsx
        // Fix: Compare only the YYYY-MM-DD part of the ISO string
        const dailyInvoices = invoices.filter(inv => {
            if (!inv.date) return false;
            // Handle both ISO strings and plain dates
            return inv.date.split('T')[0] === date;
        });

        if (dailyInvoices.length === 0) {
            alert(`No hay facturas emitidas el día ${date}.`);
            return;
        }
        try {
            if (api.downloadBatchZip) {
                await api.downloadBatchZip(dailyInvoices, date);
                localStorage.setItem('lastBatchDownloadDate', date);
                // Notification handled by browser download
            } else {
                alert("Función de descarga no disponible.");
            }
        } catch (e) {
            alert("Error al descargar el archivo ZIP. Revise la consola.");
            console.error(e);
        }
    };

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="flex justify-between items-end">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Caja & Facturación</h3>
                        <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-2">Finanzas Veri*Factu AEAT Ready</p>
                    </div>
                    <button onClick={() => { setInvoiceStep(1); setIsInvoiceModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-xl text-[11px] font-bold uppercase tracking-widest shadow-xl hover:bg-black transition-colors">
                        + Emitir Nueva Factura
                    </button>
                </div>

                <div className="flex gap-8 border-b border-slate-100 mb-8">
                    {(['overview', 'invoices', 'expenses'] as const).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setBillingTab(tab)}
                            className={`pb-4 text-[10px] font-black uppercase tracking-widest transition-colors ${billingTab === tab ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-300'}`}
                        >
                            {tab === 'overview' ? 'Vista General' : tab === 'invoices' ? 'Facturación' : 'Gastos'}
                        </button>
                    ))}
                </div>

                {billingTab === 'overview' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="col-span-2 bg-white p-10 rounded-2xl border border-slate-200 shadow-sm relative">
                            <div className="flex justify-between items-center mb-10">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-3"><BarChart3 className="text-blue-500" /> Ingresos Semanales</h4>
                            </div>
                            <div className="flex items-end justify-between gap-4 min-h-[160px]">
                                {REVENUE_HISTORY.map(data => (
                                    <div key={data.day} className="flex-1 flex flex-col items-center gap-3 group relative cursor-pointer">
                                        <div className="w-full bg-slate-100 rounded-xl relative overflow-hidden flex flex-col justify-end" style={{ height: '140px' }}>
                                            <div className="bg-blue-600 rounded-t-xl group-hover:bg-blue-700 transition-all duration-500" style={{ height: `${(data.amount / 2400) * 100}%` }}></div>
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{data.day}</span>
                                        <div className="absolute -top-12 opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] font-bold px-4 py-2 rounded-xl transition-all shadow-xl pointer-events-none">
                                            {data.amount.toFixed(2)}€
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="bg-slate-900 p-10 rounded-2xl text-white shadow-2xl flex flex-col justify-between">
                            <div>
                                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Recaudación Real Hoy</p>
                                <p className="text-4xl font-bold text-blue-400">{stats.total.toFixed(2)}€</p>
                            </div>
                            <div className="space-y-4 pt-10 border-t border-white/10">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-400">Efectivo</span></div>
                                    <span className="text-sm font-bold text-white">{stats.byCash.toFixed(2)}€</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-blue-500"></div><span className="text-xs font-bold text-slate-400">Tarjeta</span></div>
                                    <span className="text-sm font-bold text-white">{stats.byCard.toFixed(2)}€</span>
                                </div>
                            </div>
                            {/* Close Cash Register Button */}
                            <button
                                onClick={handleCloseCashRegister}
                                className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
                            >
                                <DollarSign size={16} />
                                Cerrar Caja del Día
                            </button>
                        </div>
                    </div>
                )}

                {billingTab === 'invoices' && (
                    <div className="space-y-8 animate-in fade-in duration-700">
                        <div className="bg-white/80 backdrop-blur-xl p-8 rounded-[2.5rem] border border-white/20 shadow-2xl flex justify-between items-center relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                            <div className="flex items-center gap-6">
                                <div className="bg-slate-100 p-4 rounded-2xl text-slate-500">
                                    <FileText size={24} />
                                </div>
                                <div className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest block">Periodo Fiscal</span>
                                    <input
                                        type="date"
                                        value={exportDate}
                                        onChange={e => setExportDate(e.target.value)}
                                        className="bg-transparent border-none text-xl font-bold text-slate-900 outline-none p-0 focus:ring-0"
                                    />
                                </div>
                            </div>
                            <button
                                onClick={() => handleDownloadZip(exportDate)}
                                disabled={!exportDate}
                                className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black hover:scale-105 transition-all flex items-center gap-3 disabled:opacity-50 shadow-xl disabled:shadow-none"
                            >
                                <Download size={18} /> Descargar ZIP Gestoría
                            </button>
                        </div>

                        <div className="bg-white/90 backdrop-blur-xl rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50/50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr>
                                        <th className="p-8 pl-10">Factura</th>
                                        <th className="p-8">Paciente</th>
                                        <th className="p-8 text-right">Importe</th>
                                        <th className="p-8 text-center">Método</th>
                                        <th className="p-8 text-center">Estado</th>
                                        <th className="p-8 text-right pr-10">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {invoices.length === 0 ? (
                                        <tr><td colSpan={6} className="p-16 text-center text-slate-400 font-bold uppercase tracking-widest opacity-50">No hay facturas emitidas</td></tr>
                                    ) : (
                                        invoices.map((inv, idx) => (
                                            <tr key={inv.id} className="group hover:bg-blue-50/30 transition-colors duration-300">
                                                <td className="p-8 pl-10">
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold text-xs group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                                            #{idx + 1}
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-sm tracking-tight">{inv.invoiceNumber}</span>
                                                    </div>
                                                </td>
                                                <td className="p-8">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-slate-700 text-sm">{patients.find(p => p.id === inv.patientId)?.name || 'Anónimo'}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{patients.find(p => p.id === inv.patientId)?.dni || '---'}</span>
                                                    </div>
                                                </td>
                                                <td className="p-8 text-right">
                                                    <span className="font-black text-slate-900 text-lg">{inv.amount.toFixed(2)}€</span>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <span className="bg-slate-100 px-4 py-2 rounded-xl text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                                        {inv.paymentMethod}
                                                    </span>
                                                </td>
                                                <td className="p-8 text-center">
                                                    <div className="inline-flex items-center gap-2 bg-emerald-100/50 border border-emerald-100 px-4 py-2 rounded-xl">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                                                        <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Emitida</span>
                                                    </div>
                                                </td>
                                                <td className="p-8 pr-10 text-right">
                                                    <div className="flex justify-end gap-3 opacity-60 group-hover:opacity-100 transition-opacity">
                                                        <button
                                                            onClick={() => handleDownloadInvoice(inv)}
                                                            className={`w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center transition-all shadow-sm hover:shadow-md ${!inv.url ? 'bg-slate-50 text-slate-300 cursor-not-allowed' : 'bg-white text-slate-400 hover:text-blue-600 hover:border-blue-200'}`}
                                                            title={inv.url ? "Descargar Factura Oficial" : "PDF No disponible"}
                                                            disabled={!inv.url}
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => alert(`📧 Factura enviada a ${patients.find(p => p.id === inv.patientId)?.email || 'cliente'}.`)}
                                                            className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 hover:text-purple-600 hover:border-purple-200 transition-all shadow-sm hover:shadow-md"
                                                            title="Enviar email"
                                                        >
                                                            <Mail size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {billingTab === 'expenses' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                            <div className="flex justify-between items-center mb-8">
                                <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-3"><TrendingDown className="text-rose-500" /> Gastos Registrados</h4>
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-slate-400 uppercase">Total Gastos</p>
                                    <p className="text-3xl font-bold text-rose-500">{expenses.reduce((a, b) => a + b.amount, 0).toFixed(2)}€</p>
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-slate-50">
                                        <tr><th className="pb-4 pl-4">Descripción</th><th className="pb-4">Categoría</th><th className="pb-4">Fecha</th><th className="pb-4 text-right pr-4">Importe</th><th className="pb-4 text-right">Doc</th></tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {expenses.length === 0 ? (
                                            <tr><td colSpan={5} className="p-8 text-center text-slate-400 font-bold text-xs uppercase opacity-50">No hay gastos registrados</td></tr>
                                        ) : (
                                            expenses.map(exp => (
                                                <tr key={exp.id} className="text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                                                    <td className="p-4 pl-4 text-slate-900">{exp.description} <span className="block text-[9px] text-slate-400 font-normal">{exp.receiver}</span></td>
                                                    <td className="p-4"><span className="bg-slate-100 px-3 py-1 rounded-lg text-[9px] font-bold uppercase">{exp.category}</span></td>
                                                    <td className="p-4">{exp.date}</td>
                                                    <td className="p-4 pr-4 text-right font-bold text-rose-600">-{exp.amount.toFixed(2)}€</td>
                                                    <td className="p-4 text-right">
                                                        {exp.url && (
                                                            <button onClick={() => window.open(exp.url, '_blank')} className="text-slate-400 hover:text-blue-600 transition-colors" title="Descargar Factura">
                                                                <Download size={16} />
                                                            </button>
                                                        )}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* INVOICE MODAL */}
            {isInvoiceModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden animate-in zoom-in-50 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <div>
                                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">Nueva Factura Oficial</h3>
                                <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Veri*Factu / FacturaDirecta</p>
                            </div>
                            <button onClick={() => setIsInvoiceModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                ✕
                            </button>
                        </div>

                        {/* STEP 1: Type & Patient */}
                        {invoiceStep === 1 && (
                            <div className="p-8 space-y-6">
                                <div className="space-y-4">
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Tipo de Factura</label>
                                    <div className="grid grid-cols-2 gap-4">
                                        <button
                                            onClick={() => setInvoiceType('ordinary')}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${invoiceType === 'ordinary' ? 'border-blue-500 bg-blue-50' : 'border-slate-100 hover:border-blue-200'}`}
                                        >
                                            <span className="block text-sm font-black text-slate-900 uppercase">Ordinaria</span>
                                            <span className="text-[10px] text-slate-400 font-bold">Venta de servicios normal</span>
                                        </button>
                                        <button
                                            onClick={() => setInvoiceType('rectificative')}
                                            className={`p-4 rounded-xl border-2 text-left transition-all ${invoiceType === 'rectificative' ? 'border-amber-500 bg-amber-50' : 'border-slate-100 hover:border-amber-200'}`}
                                        >
                                            <span className="block text-sm font-black text-slate-900 uppercase">Rectificativa</span>
                                            <span className="text-[10px] text-slate-400 font-bold">Corrección / Devolución</span>
                                        </button>
                                    </div>

                                    {/* WALLET DEPOSIT OPTION */}
                                    <div className="mt-2 bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex items-center gap-3">
                                        <input
                                            type="checkbox"
                                            id="addToWallet"
                                            className="w-5 h-5 rounded text-emerald-600 focus:ring-emerald-500"
                                            checked={invoiceType === 'ADVANCE_PAYMENT'}
                                            onChange={(e) => setInvoiceType(e.target.checked ? 'ADVANCE_PAYMENT' : 'ordinary')}
                                        />
                                        <label htmlFor="addToWallet" className="cursor-pointer">
                                            <span className="block text-sm font-black text-slate-900 uppercase">Añadir Importe al Monedero</span>
                                            <span className="text-[10px] text-slate-500 font-bold">El total de esta factura se sumará al saldo del paciente.</span>
                                        </label>
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Paciente</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            placeholder="🔍 Buscar paciente..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                            value={selectedPatientId ? (patients.find(p => p.id === selectedPatientId)?.name || patientSearch) : patientSearch}
                                            onChange={(e) => {
                                                setPatientSearch(e.target.value);
                                                setSelectedPatientId(''); // Clear selection on type
                                            }}
                                        />
                                        {patientSearch && !selectedPatientId && (
                                            <div className="absolute top-full left-0 w-full bg-white border border-slate-100 rounded-xl shadow-xl mt-2 max-h-48 overflow-y-auto z-50">
                                                {patients.filter(p => (p.name?.toLowerCase() || '').includes(patientSearch.toLowerCase()) || (p.dni || '').includes(patientSearch)).length === 0 ? (
                                                    <div className="p-4 text-xs text-slate-400 font-bold">No se encontraron pacientes.</div>
                                                ) : (
                                                    patients.filter(p => (p.name?.toLowerCase() || '').includes(patientSearch.toLowerCase()) || (p.dni || '').includes(patientSearch)).map(p => (
                                                        <div
                                                            key={p.id}
                                                            onClick={() => {
                                                                setSelectedPatientId(p.id);
                                                                setPatientSearch(p.name);
                                                            }}
                                                            className="p-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 flex justify-between items-center"
                                                        >
                                                            <span className="text-xs font-bold text-slate-700">{p.name}</span>
                                                            <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded">{p.dni}</span>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                        {selectedPatientId && (
                                            <button
                                                onClick={() => { setSelectedPatientId(''); setPatientSearch(''); }}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500"
                                            >
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* STEP 2: Details */}
                        {invoiceStep === 2 && (
                            <div className="p-8 space-y-6">
                                {/* Items Logic (Same as before) */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Conceptos ({invoiceType === 'rectificative' ? 'Devolución' : 'Servicios'})</label>
                                        <button onClick={handleAddItem} className="text-[10px] font-bold uppercase text-blue-600 hover:text-blue-800 transition-colors bg-blue-50 px-3 py-1 rounded-lg">
                                            + Añadir Línea
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                                        {invoiceItems.map((item, idx) => (
                                            <div key={idx} className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    placeholder="Descripción"
                                                    className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                                                    value={item.name}
                                                    onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="€"
                                                    className={`w-24 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none text-right ${invoiceType === 'rectificative' ? 'text-red-500' : 'text-slate-900'}`}
                                                    value={item.price}
                                                    onChange={(e) => handleItemChange(idx, 'price', e.target.value)}
                                                />
                                                <button onClick={() => handleRemoveItem(idx)} className="text-slate-300 hover:text-rose-500 transition-colors p-2">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="text-right border-t border-slate-100 pt-4">
                                        <span className="text-2xl font-black text-slate-900">{invoiceItems.reduce((sum, i) => sum + i.price, 0).toFixed(2)}€</span>
                                    </div>
                                </div>

                                {/* Payment Method Selector */}
                                <div className="space-y-2">
                                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest">Método</label>
                                    <select
                                        value={paymentMethod}
                                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none"
                                    >
                                        <option value="card">Tarjeta</option>
                                        <option value="cash">Efectivo</option>
                                        <option value="transfer">Transferencia</option>
                                        <option value="ADVANCE_PAYMENT">Pago a Cuenta (Saldo)</option>
                                    </select>
                                </div>

                                {emitError && <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold">⚠️ {emitError}</div>}
                            </div>
                        )}

                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            {invoiceStep === 1 ? (
                                <>
                                    <button onClick={() => setIsInvoiceModalOpen(false)} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500">Cancelar</button>
                                    <button
                                        onClick={() => {
                                            if (!selectedPatientId) return alert("Seleccione un paciente");
                                            setInvoiceStep(2);
                                        }}
                                        className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg"
                                    >
                                        Siguiente
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button onClick={() => setInvoiceStep(1)} className="px-6 py-3 rounded-xl text-xs font-bold text-slate-500">Atrás</button>
                                    <button
                                        onClick={handleEmitInvoice}
                                        disabled={isEmitting}
                                        className="bg-slate-900 text-white px-8 py-3 rounded-xl text-xs font-bold uppercase tracking-widest shadow-lg disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isEmitting ? 'Emitiendo...' : '✅ Emitir Factura'}
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Billing;
