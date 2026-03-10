import React, { useState, useEffect } from 'react';
import { DollarSign } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Expense, Doctor, Specialization } from '../../types';

const Payroll: React.FC = () => {
    const { api, setExpenses, doctors } = useAppContext();
    const [payrollViewMode, setPayrollViewMode] = useState<string>('general');
    const [liquidations, setLiquidations] = useState<{ records: any[], totalToPay: number } | null>(null);
    const [editedRecords, setEditedRecords] = useState<Record<string, { grossAmount?: number, labCost?: number, commissionRate?: number }>>({});
    const [manualAdjustment, setManualAdjustment] = useState<string>('');

    // Fetch Liquidations when view mode changes
    useEffect(() => {
        const fetchLiquidations = async () => {
            if (payrollViewMode === 'general') {
                setLiquidations(null); // Or fetch global summary
            } else {
                try {
                    // This function is defined in api services but expects arguments
                    const data = await api.getLiquidations(payrollViewMode);
                    setLiquidations(data);
                } catch (e) {
                    console.error("Error fetching liquidations", e);
                }
            }
        };
        fetchLiquidations();
    }, [payrollViewMode, api]);

    const getEffectiveTotal = () => {
        if (manualAdjustment) return parseFloat(manualAdjustment);
        if (!liquidations) return 0;

        let total = 0;
        liquidations.records.forEach(r => {
            const edit = editedRecords[r.id] || {};
            const gross = edit.grossAmount !== undefined ? edit.grossAmount : r.grossAmount;
            const lab = edit.labCost !== undefined ? edit.labCost : r.labCost;
            const rate = edit.commissionRate !== undefined ? edit.commissionRate : r.commissionRate;
            total += (gross - lab) * (rate / 100);
        });
        return total;
    };

    const handleCreateInvoice = async () => {
        const doc = doctors.find(d => d.id === payrollViewMode);
        if (doc) {
            const total = getEffectiveTotal();
            try {
                const res = await api.generateInvoice({
                    patient: { id: doc.id, name: doc.name, dni: 'DOC-NIF', email: 'doctor@medicore.cloud', birthDate: '01/01/1980' } as any,
                    items: [{ name: `Liquidación Comisiones ${new Date().toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`, price: total }],
                    paymentMethod: 'cash',
                    type: 'rectificative'
                });

                const newExpense: Expense = {
                    id: `exp-${Date.now()}`,
                    description: `Liquidación Comisiones - ${doc.name}`,
                    category: 'Comision',
                    amount: total,
                    date: new Date().toLocaleDateString(),
                    receiver: doc.name,
                    url: res.url
                };
                setExpenses(prev => [...prev, newExpense]);
                alert(`✅ Auto-Factura de Doctor Generada y Gasto Registrado.\nReferencia: ${res.invoiceNumber}\n(El doctor recibirá su copia automáticamente)`);
            } catch (e) {
                alert("Error al generar factura de doctor.");
                console.error(e);
            }
        }
    }


    const updateRecord = (id: string, field: keyof typeof editedRecords[string], val: number) => {
        setEditedRecords(prev => ({
            ...prev,
            [id]: { ...prev[id], [field]: val }
        }));
    };

    return (
        <div className="p-10 h-full flex gap-8 overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="w-64 shrink-0 space-y-2">
                <button onClick={() => setPayrollViewMode('general')} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${payrollViewMode === 'general' ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-400 hover:bg-slate-50'}`}>Vista General</button>
                <p className="px-5 pt-4 pb-2 text-[9px] font-bold text-slate-400 uppercase tracking-widest">Doctores</p>
                {doctors.map(d => (
                    <button key={d.id} onClick={() => setPayrollViewMode(d.id)} className={`w-full text-left px-5 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${payrollViewMode === d.id ? 'bg-blue-50 text-blue-600 border border-blue-100' : 'text-slate-500 hover:bg-slate-50'}`}>
                        {d.name}
                    </button>
                ))}
            </div>

            <div className="flex-1 space-y-8">
                <div className="flex justify-between items-start mb-10">
                    <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">Liquidaciones y Comisiones</h3>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">
                            {payrollViewMode === 'general' ? 'Resumen Global' : `Detalle: ${doctors.find(d => d.id === payrollViewMode)?.name}`}
                        </p>
                    </div>

                    {payrollViewMode !== 'general' && (
                        <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-xl flex flex-col gap-4 min-w-[300px]">
                            <div className="flex justify-between items-center py-4 border-b border-slate-50">
                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total a Pagar</span>
                                <span className="text-2xl font-black text-blue-600">{getEffectiveTotal().toFixed(2)}€</span>
                            </div>

                            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 mb-2">
                                <p className="text-[10px] font-bold text-amber-600 uppercase mb-2">Ajuste Manual (€)</p>
                                <input
                                    type="number"
                                    value={manualAdjustment}
                                    onChange={(e) => setManualAdjustment(e.target.value)}
                                    className="w-full bg-white border border-amber-200 rounded-lg px-2 py-1 text-right font-bold"
                                    placeholder="Sobreescribir Cantidad"
                                />
                            </div>

                            <button
                                onClick={handleCreateInvoice}
                                className="w-full bg-slate-900 text-white py-3 rounded-xl text-[10px] font-bold uppercase hover:bg-black transition shadow-lg flex justify-center items-center gap-2"
                            >
                                <DollarSign size={14} /> Registrar Factura Dr.
                            </button>
                        </div>
                    )}
                </div>

                {liquidations && liquidations.records && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-4">Paciente</th>
                                    <th className="p-4">Tratamiento</th>
                                    <th className="p-4">Pago</th>
                                    <th className="p-4">Fecha</th>
                                    <th className="p-4 text-right">Importe Bruto</th>
                                    <th className="p-4 text-right">Coste Lab</th>
                                    <th className="p-4 text-right">% Comisión</th>
                                    <th className="p-4 text-right">Neto Dr.</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {liquidations.records.map((r: any) => {
                                    const edit = editedRecords[r.id] || {};
                                    const gross = edit.grossAmount !== undefined ? edit.grossAmount : r.grossAmount;
                                    const lab = edit.labCost !== undefined ? edit.labCost : r.labCost;
                                    const rate = edit.commissionRate !== undefined ? edit.commissionRate : r.commissionRate;
                                    const final = (gross - lab) * (rate / 100);

                                    // Payment method badge
                                    const getPaymentBadge = (method: string) => {
                                        switch (method?.toLowerCase()) {
                                            case 'wallet': return { bg: 'bg-purple-100', text: 'text-purple-700', label: 'Saldo' };
                                            case 'cash': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Efectivo' };
                                            case 'card': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Tarjeta' };
                                            case 'transfer': return { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Transf.' };
                                            default: return { bg: 'bg-slate-100', text: 'text-slate-600', label: method || '-' };
                                        }
                                    };
                                    const paymentBadge = getPaymentBadge(r.paymentMethod);

                                    return (
                                        <tr key={r.id} className="text-xs font-medium text-slate-600 hover:bg-slate-50">
                                            <td className="p-4 font-bold text-slate-900">{r.patientName || 'Paciente'}</td>
                                            <td className="p-4 font-medium">{r.treatmentName || 'Tratamiento'}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-lg text-[9px] font-bold ${paymentBadge.bg} ${paymentBadge.text}`}>
                                                    {paymentBadge.label}
                                                </span>
                                            </td>
                                            <td className="p-4">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : 'N/A'}</td>
                                            <td className="p-4 text-right">
                                                <input
                                                    type="number"
                                                    className="w-20 text-right bg-transparent hover:bg-white border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none transition-all"
                                                    value={gross}
                                                    onChange={e => updateRecord(r.id, 'grossAmount', Number(e.target.value))}
                                                />€
                                            </td>
                                            <td className="p-4 text-right text-rose-400">
                                                -<input
                                                    type="number"
                                                    className="w-16 text-right bg-transparent hover:bg-white border-b border-transparent hover:border-rose-300 focus:border-rose-500 outline-none transition-all text-rose-500"
                                                    value={lab}
                                                    onChange={e => updateRecord(r.id, 'labCost', Number(e.target.value))}
                                                />€
                                            </td>
                                            <td className="p-4 text-right text-blue-600">
                                                <input
                                                    type="number"
                                                    className="w-12 text-right bg-transparent hover:bg-white border-b border-transparent hover:border-blue-300 focus:border-blue-500 outline-none transition-all text-blue-600 font-bold"
                                                    value={rate}
                                                    onChange={e => updateRecord(r.id, 'commissionRate', Number(e.target.value))}
                                                />%
                                            </td>
                                            <td className="p-4 text-right font-bold text-emerald-600 text-sm bg-emerald-50/30">
                                                {final.toFixed(2)}€
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Payroll;
