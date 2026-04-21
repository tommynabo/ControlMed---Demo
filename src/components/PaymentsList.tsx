import React, { useEffect, useState } from 'react';
import { CreditCard, Download, Mail, QrCode, FileText as FileTextIcon, Edit3, Check, X } from 'lucide-react';
import { api } from '../services/api';

interface PaymentsListProps {
    patientId: string;
    invoices: any[]; // Passed from parent to avoid re-fetching
}

export const PaymentsList: React.FC<PaymentsListProps> = ({ patientId, invoices }) => {
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<{ amount: string; createdAt: string; method: string; notes: string }>({ amount: '', createdAt: '', method: '', notes: '' });
    const [saving, setSaving] = useState(false);

    const loadPayments = () => {
        setLoading(true);
        api.payments.getByPatient(patientId)
            .then(setPayments)
            .catch(err => console.error("Error fetching payments:", err))
            .finally(() => setLoading(false));
    };

    const handleDownload = async (id: string) => {
        try {
            const { url } = await (api.invoices as any).getDownloadUrl(id);
            if (url) window.open(url, '_blank');
            else alert("Error obteniendo PDF");
        } catch (e) {
            console.error(e);
            alert("Error al descargar");
        }
    };

    const handleStartEdit = (pay: any) => {
        // Convert the stored ISO date to a local YYYY-MM-DD for the date input
        const d = new Date(pay.createdAt);
        const dateStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
        setEditForm({
            amount: String(pay.amount),
            createdAt: dateStr,
            method: pay.method || 'cash',
            notes: pay.notes || '',
        });
        setEditingId(pay.id);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
    };

    const handleSaveEdit = async (payId: string) => {
        const numAmount = parseFloat(editForm.amount);
        if (isNaN(numAmount) || numAmount <= 0) {
            alert('El importe debe ser un número positivo');
            return;
        }
        setSaving(true);
        try {
            // Send date as UTC midnight of the selected day
            const isoDate = editForm.createdAt ? `${editForm.createdAt}T12:00:00.000Z` : undefined;
            await (api.payments as any).update(payId, {
                amount: numAmount,
                ...(isoDate ? { createdAt: isoDate } : {}),
                method: editForm.method,
                notes: editForm.notes || null,
            });
            setEditingId(null);
            loadPayments();
        } catch (e: any) {
            alert('Error al guardar: ' + (e.message || 'Error desconocido'));
        } finally {
            setSaving(false);
        }
    };

    useEffect(() => {
        loadPayments();
    }, [patientId]);

    if (loading) return <div className="text-center p-4 text-xs text-slate-400">Cargando pagos...</div>;

    if (payments.length === 0) {
        return <p className="text-xs text-slate-500 font-bold opacity-50 p-4">No hay pagos registrados.</p>;
    }

    return (
        <div className="space-y-2">
            {payments.map(pay => {
                const relatedInvoice = invoices.find(inv =>
                    inv.id === pay.invoiceId || inv.relatedPaymentId === pay.id
                );
                const isEditing = editingId === pay.id;

                return (
                    <div key={pay.id} className="bg-slate-50 rounded-xl overflow-hidden">
                        <div className="flex justify-between items-center p-4">
                            <div>
                                <p className="text-sm font-black text-slate-900">
                                    {pay.method === 'cash' ? 'Efectivo' : pay.method === 'card' ? 'Tarjeta' : pay.method === 'transfer' ? 'Transferencia' : pay.method}
                                </p>
                                <p className="text-[10px] font-bold text-slate-400">
                                    {new Date(pay.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} — {
                                        pay.type === 'ADVANCE_PAYMENT' ? 'Anticipo' :
                                            (relatedInvoice?.items?.[0]?.name || relatedInvoice?.concept || 'Pago Factura')
                                    }
                                </p>
                                {relatedInvoice?.invoiceNumber && (
                                    <p className="text-[10px] font-bold text-blue-400 mt-0.5">{relatedInvoice.invoiceNumber}</p>
                                )}
                            </div>
                            <div className="flex items-center gap-3">
                                <p className={`text-sm font-black ${pay.type === 'ADVANCE_PAYMENT' ? 'text-emerald-600' : 'text-slate-900'}`}>
                                    {pay.type === 'ADVANCE_PAYMENT' ? '+' : ''}{pay.amount}€
                                </p>
                                <button
                                    onClick={() => isEditing ? handleCancelEdit() : handleStartEdit(pay)}
                                    className="p-2 bg-slate-100 text-slate-500 rounded-lg hover:bg-blue-50 hover:text-blue-600 transition-colors"
                                    title="Editar pago"
                                >
                                    {isEditing ? <X size={13} /> : <Edit3 size={13} />}
                                </button>
                                {relatedInvoice?.url && (
                                    <button
                                        onClick={() => handleDownload(relatedInvoice.id)}
                                        className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                        title={`Descargar Factura ${relatedInvoice.invoiceNumber}`}
                                    >
                                        <Download size={14} />
                                    </button>
                                )}
                            </div>
                        </div>

                        {isEditing && (
                            <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 space-y-3">
                                <p className="text-[10px] font-black uppercase text-slate-400">Editar Pago</p>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Importe (€)</label>
                                        <input
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            value={editForm.amount}
                                            onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Fecha</label>
                                        <input
                                            type="date"
                                            value={editForm.createdAt}
                                            onChange={e => setEditForm(p => ({ ...p, createdAt: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Método</label>
                                        <select
                                            value={editForm.method}
                                            onChange={e => setEditForm(p => ({ ...p, method: e.target.value }))}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                        >
                                            <option value="cash">Efectivo</option>
                                            <option value="card">Tarjeta</option>
                                            <option value="transfer">Transferencia</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Notas</label>
                                        <input
                                            type="text"
                                            value={editForm.notes}
                                            onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))}
                                            placeholder="Opcional..."
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <button
                                        onClick={handleCancelEdit}
                                        className="flex-1 py-2 text-sm font-bold text-slate-500 hover:bg-slate-100 rounded-xl border border-slate-200"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => handleSaveEdit(pay.id)}
                                        disabled={saving}
                                        className="flex-1 py-2 text-sm font-black text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                                    >
                                        {saving ? 'Guardando...' : 'Guardar'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
