import React, { useState, useEffect } from 'react';
import { DollarSign, Download, Calendar } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Expense, Doctor, Specialization } from '../../types';

const Payroll: React.FC = () => {
    const { api, setExpenses, doctors } = useAppContext();
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [liquidations, setLiquidations] = useState<any>(null);
    const [editedRecords, setEditedRecords] = useState<Record<string, { grossAmount?: number, labCost?: number, commissionRate?: number }>>({});
    const [manualAdjustment, setManualAdjustment] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // Fetch Liquidations when filters change
    useEffect(() => {
        const fetchLiquidations = async () => {
            if (!selectedDoctorId) return;
            
            setIsLoading(true);
            try {
                const data = await api.liquidations.getSummary(selectedDoctorId, selectedMonth, selectedYear);
                setLiquidations(data);
            } catch (e) {
                console.error("Error fetching liquidations", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLiquidations();
    }, [selectedDoctorId, selectedMonth, selectedYear, api]);

    const getEffectiveTotal = () => {
        if (manualAdjustment) return parseFloat(manualAdjustment);
        if (!liquidations || !liquidations.treatments) return 0;

        let total = 0;
        liquidations.treatments.forEach((r: any) => {
            const edit = editedRecords[r.id] || {};
            const gross = edit.grossAmount !== undefined ? edit.grossAmount : r.grossAmount;
            const lab = edit.labCost !== undefined ? edit.labCost : r.labCost;
            const rate = edit.commissionRate !== undefined ? edit.commissionRate : r.commissionRate;
            total += (gross - lab) * (rate / 100);
        });
        return total;
    };

    const handleCreateInvoice = async () => {
        const doc = doctors.find(d => d.id === selectedDoctorId);
        if (doc) {
            const total = getEffectiveTotal();
            try {
                const res = await api.generateInvoice({
                    patient: { id: doc.id, name: doc.name, dni: 'DOC-NIF', email: 'doctor@medicore.cloud', birthDate: '01/01/1980' } as any,
                    items: [{ name: `Liquidación Comisiones ${new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}`, price: total }],
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

    const handleDownloadPDF = async () => {
        if (!selectedDoctorId || !liquidations) return;
        alert('⏳ Función de PDF en desarrollo. Use "Registrar Factura Dr." para generar reporte.');
    };

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-4xl font-black text-slate-900">Liquidaciones Mensuales</h1>
                    <p className="text-slate-500 font-bold mt-2">Gestiona comisiones y pagos a doctores</p>
                </div>

                {/* Filters */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Doctor Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-400 block mb-2">Doctor</label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">-- Selecciona Doctor --</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-400 block mb-2">Mes</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {[
                                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                            ].map((m, idx) => (
                                <option key={idx} value={idx + 1}>{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-400 block mb-2">Año</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={!selectedDoctorId || isLoading}
                            className="flex-1 bg-amber-50 border border-amber-200 text-amber-700 px-3 py-2 rounded-lg font-bold text-xs uppercase hover:bg-amber-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Download size={14} /> PDF
                        </button>
                    </div>
                </div>

                {/* Summary Card */}
                {liquidations && (
                    <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-8 rounded-2xl shadow-lg">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div>
                                <p className="text-blue-100 text-xs font-bold uppercase">Doctor</p>
                                <p className="text-2xl font-black mt-1">{liquidations.doctor?.name || 'N/A'}</p>
                            </div>
                            <div>
                                <p className="text-blue-100 text-xs font-bold uppercase">Período</p>
                                <p className="text-lg font-black mt-1">{liquidations.period}</p>
                            </div>
                            <div>
                                <p className="text-blue-100 text-xs font-bold uppercase">Total Bruto</p>
                                <p className="text-2xl font-black text-white mt-1">{liquidations.totals?.totalGross?.toFixed(2)}€</p>
                            </div>
                            <div>
                                <p className="text-blue-100 text-xs font-bold uppercase">Coste Lab</p>
                                <p className="text-lg font-black text-red-200 mt-1">-{liquidations.totals?.totalLabCost?.toFixed(2)}€</p>
                            </div>
                            <div className="bg-blue-500/30 p-4 rounded-xl">
                                <p className="text-blue-100 text-xs font-bold uppercase">Comisión Final</p>
                                <p className="text-3xl font-black text-white mt-1">{liquidations.totals?.totalToPay?.toFixed(2)}€</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Table */}
                {liquidations && liquidations.treatments && liquidations.treatments.length > 0 ? (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                        <div className="w-full overflow-x-auto">
                            <table className="w-full min-w-max text-left text-sm">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                    <tr>
                                        <th className="px-6 py-4">Paciente</th>
                                        <th className="px-6 py-4">Tratamiento</th>
                                        <th className="px-6 py-4">Fecha</th>
                                        <th className="px-6 py-4 text-right">Importe Bruto</th>
                                        <th className="px-6 py-4 text-right">Coste Lab</th>
                                        <th className="px-6 py-4 text-right">% Comisión</th>
                                        <th className="px-6 py-4 text-right">Neto Dr.</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {liquidations.treatments.map((r: any) => {
                                        const edit = editedRecords[r.id] || {};
                                        const gross = edit.grossAmount !== undefined ? edit.grossAmount : r.grossAmount;
                                        const lab = edit.labCost !== undefined ? edit.labCost : r.labCost;
                                        const rate = edit.commissionRate !== undefined ? edit.commissionRate : r.commissionRate;
                                        const final = (gross - lab) * (rate / 100);

                                        return (
                                            <tr key={r.id} className="hover:bg-slate-50 transition">
                                                <td className="px-6 py-4 font-bold text-slate-900">{r.patientName || '-'}</td>
                                                <td className="px-6 py-4 font-medium text-slate-700">{r.treatmentName || '-'}</td>
                                                <td className="px-6 py-4 text-slate-600">{r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : '-'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-24 text-right bg-transparent hover:bg-slate-50 border-b border-transparent hover:border-slate-300 focus:border-blue-500 outline-none rounded px-1 font-bold transition-all"
                                                        value={gross}
                                                        onChange={e => updateRecord(r.id, 'grossAmount', Number(e.target.value))}
                                                    />€
                                                </td>
                                                <td className="px-6 py-4 text-right text-red-500 font-bold">
                                                    -<input
                                                        type="number"
                                                        className="w-20 text-right bg-transparent hover:bg-slate-50 border-b border-transparent hover:border-red-300 focus:border-red-500 outline-none rounded px-1 transition-all"
                                                        value={lab}
                                                        onChange={e => updateRecord(r.id, 'labCost', Number(e.target.value))}
                                                    />€
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <input
                                                        type="number"
                                                        className="w-16 text-right bg-transparent hover:bg-slate-50 border-b border-transparent hover:border-blue-300 focus:border-blue-500 outline-none rounded px-1 font-bold transition-all"
                                                        value={rate}
                                                        onChange={e => updateRecord(r.id, 'commissionRate', Number(e.target.value))}
                                                    />%
                                                </td>
                                                <td className="px-6 py-4 text-right font-black text-emerald-600 text-base bg-emerald-50">{final.toFixed(2)}€</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer with totals */}
                        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200">
                            <div className="flex justify-end gap-12">
                                <div className="text-right">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Manual Override</p>
                                    <input
                                        type="number"
                                        value={manualAdjustment}
                                        onChange={(e) => setManualAdjustment(e.target.value)}
                                        placeholder="Monto personalizado"
                                        className="mt-1 w-32 text-right bg-white border border-amber-200 rounded-lg px-2 py-1 font-bold text-amber-700"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Total a Pagar</p>
                                    <p className="text-3xl font-black text-blue-600 mt-1">{getEffectiveTotal().toFixed(2)}€</p>
                                </div>
                                <button
                                    onClick={handleCreateInvoice}
                                    className="bg-slate-900 hover:bg-black text-white px-6 py-3 rounded-lg font-bold text-xs uppercase transition flex items-center gap-2 self-end shadow-lg"
                                >
                                    <DollarSign size={16} /> Registrar Factura
                                </button>
                            </div>
                        </div>
                    </div>
                ) : selectedDoctorId && !isLoading && (
                    <div className="text-center p-12 text-slate-400">
                        <Calendar size={32} className="mx-auto mb-2 opacity-50" />
                        <p className="font-bold">No hay liquidaciones para {liquidations?.period || 'este período'}</p>
                    </div>
                )}

                {isLoading && (
                    <div className="text-center p-12">
                        <div className="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
                        <p className="mt-4 text-slate-500 font-bold">Cargando liquidaciones...</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Payroll;
