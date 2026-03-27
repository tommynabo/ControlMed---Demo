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
            const period = new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
            try {
                await api.expenses.create({
                    date: new Date().toISOString().split('T')[0],
                    description: `Liquidación Comisiones - ${doc.name} - ${period}`,
                    category: 'Comision',
                    amount: total,
                    paymentMethod: 'transfer'
                });

                const newExpense: Expense = {
                    id: `exp-${Date.now()}`,
                    description: `Liquidación Comisiones - ${doc.name}`,
                    category: 'Comision',
                    amount: total,
                    date: new Date().toLocaleDateString(),
                    receiver: doc.name,
                    paymentMethod: 'transfer'
                };
                setExpenses(prev => [...prev, newExpense]);
                alert(`✅ Gasto de Liquidación Registrado.\nDoctor: ${doc.name}\nPeriodo: ${period}\nImporte: ${total.toFixed(2)} €`);
            } catch (e) {
                alert("Error al registrar el gasto de liquidación.");
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

    const handleDownloadPDF = () => {
        if (!selectedDoctorId || !liquidations) return;

        const logoUrl = `${window.location.origin}/logo.jpeg`;
        const doctor = liquidations.doctor?.name || 'Doctor';
        const period = liquidations.period || `${selectedMonth}/${selectedYear}`;
        const totalGross = liquidations.totals?.totalGross || 0;
        const totalLabCost = liquidations.totals?.totalLabCost || 0;
        const totalToPay = getEffectiveTotal();

        const treatmentRows = (liquidations.treatments || []).map((r: any) => {
            const edit = editedRecords[r.id] || {};
            const gross = edit.grossAmount !== undefined ? edit.grossAmount : r.grossAmount;
            const lab = edit.labCost !== undefined ? edit.labCost : r.labCost;
            const rate = edit.commissionRate !== undefined ? edit.commissionRate : r.commissionRate;
            const net = ((+gross) - (+lab)) * ((+rate) / 100);
            return `<tr>
                <td>${r.patientName || '—'}</td>
                <td>${r.treatmentName || '—'}</td>
                <td>${r.createdAt ? new Date(r.createdAt).toLocaleDateString('es-ES') : '—'}</td>
                <td class="right">${(+gross).toFixed(2)} €</td>
                <td class="right red">-${(+lab).toFixed(2)} €</td>
                <td class="right">${rate}%</td>
                <td class="right green">${net.toFixed(2)} €</td>
            </tr>`;
        }).join('');

        const w = window.open('', '_blank');
        if (!w) return;

        const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Liquidación – ${doctor} – ${period}</title>
    <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        @page { size:A4; margin:16mm 20mm 20mm 20mm; }
        body { font-family:Arial,Helvetica,sans-serif; font-size:10pt; color:#111827; background:white; }
        .header { display:flex; justify-content:space-between; align-items:flex-end; padding-bottom:12px; border-bottom:3px solid #111827; margin-bottom:18px; }
        .header h1 { font-size:16pt; font-weight:900; text-transform:uppercase; letter-spacing:0.5px; }
        .header .subtitle { font-size:9pt; color:#6b7280; margin-top:4px; }
        .header img { height:65px; max-width:120px; object-fit:contain; }
        .meta-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:1px; background:#d1d5db; border:1px solid #d1d5db; border-radius:6px; overflow:hidden; margin-bottom:18px; }
        .meta-item { background:white; padding:10px 14px; }
        .meta-label { font-size:7pt; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#9ca3af; margin-bottom:4px; }
        .meta-value { font-size:13pt; font-weight:800; color:#111827; }
        .meta-value.blue { color:#1d4ed8; font-size:15pt; }
        table { width:100%; border-collapse:collapse; font-size:9pt; }
        thead th { background:#111827; color:white; padding:8px 10px; text-align:left; font-size:7.5pt; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; }
        thead th.right { text-align:right; }
        tbody tr:nth-child(even) { background:#f9fafb; }
        tbody td { padding:7px 10px; border-bottom:1px solid #f0f0f0; vertical-align:middle; }
        tbody td.right { text-align:right; }
        tbody td.red { color:#dc2626; }
        tbody td.green { color:#15803d; font-weight:700; }
        tfoot td { background:#111827; color:white; font-weight:700; padding:10px; font-size:10pt; }
        tfoot td.right { text-align:right; }
        .footer { margin-top:24px; padding-top:10px; border-top:1px solid #d1d5db; display:flex; justify-content:space-between; font-size:8pt; color:#9ca3af; }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <h1>CHC Clínica Dental</h1>
            <div class="subtitle">LIQUIDACIÓN MENSUAL DE PRODUCCIÓN</div>
        </div>
        <img src="${logoUrl}" onerror="this.style.display='none'" />
    </div>
    <div class="meta-grid">
        <div class="meta-item"><div class="meta-label">Doctor</div><div class="meta-value">${doctor}</div></div>
        <div class="meta-item"><div class="meta-label">Período</div><div class="meta-value">${period}</div></div>
        <div class="meta-item"><div class="meta-label">Total Bruto</div><div class="meta-value">${totalGross.toFixed(2)} €</div></div>
        <div class="meta-item"><div class="meta-label">Total a Pagar Dr.</div><div class="meta-value blue">${totalToPay.toFixed(2)} €</div></div>
    </div>
    <table>
        <thead>
            <tr>
                <th>Paciente</th><th>Tratamiento</th><th>Fecha</th>
                <th class="right">Importe Bruto</th><th class="right">Coste Lab.</th>
                <th class="right">% Comis.</th><th class="right">Neto Dr.</th>
            </tr>
        </thead>
        <tbody>
            ${treatmentRows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#9ca3af;">Sin tratamientos en este período</td></tr>'}
        </tbody>
        <tfoot>
            <tr>
                <td colspan="3">TOTALES DEL PERÍODO</td>
                <td class="right">${totalGross.toFixed(2)} €</td>
                <td class="right">-${totalLabCost.toFixed(2)} €</td>
                <td class="right">—</td>
                <td class="right">${totalToPay.toFixed(2)} €</td>
            </tr>
        </tfoot>
    </table>
    <div class="footer">
        <span>CHC Clínica Dental — Documento de uso interno confidencial</span>
        <span>Generado el ${new Date().toLocaleString('es-ES')}</span>
    </div>
    <script>window.onload=function(){setTimeout(function(){window.print();},400);};<\/script>
</body>
</html>`;

        w.document.write(html);
        w.document.close();
    };

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500 bg-white">
            <div className="max-w-7xl mx-auto space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-4xl font-black text-slate-900">Liquidaciones de Doctores</h1>
                    <p className="text-slate-500 font-bold mt-2">Reporte de producción mensual — cuánto corresponde pagar a cada doctor</p>
                </div>

                {/* Filters */}
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4">
                    {/* Doctor Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">Doctor</label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            <option value="" className="text-slate-900 bg-white">-- Selecciona Doctor --</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id} className="text-slate-900 bg-white">
                                    {d.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Month Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">Mes</label>
                        <select
                            value={selectedMonth}
                            onChange={(e) => setSelectedMonth(Number(e.target.value))}
                            className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            {[
                                'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                                'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
                            ].map((m, idx) => (
                                <option key={idx} value={idx + 1} className="text-slate-900 bg-white">{m}</option>
                            ))}
                        </select>
                    </div>

                    {/* Year Selection */}
                    <div>
                        <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">Año</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(Number(e.target.value))}
                            className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none cursor-pointer"
                        >
                            {[2024, 2025, 2026, 2027].map(y => (
                                <option key={y} value={y} className="text-slate-900 bg-white">{y}</option>
                            ))}
                        </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-end gap-2">
                        <button
                            onClick={handleDownloadPDF}
                            disabled={!selectedDoctorId || isLoading}
                            className="flex-1 bg-slate-900 border border-slate-700 text-white px-3 py-2 rounded-lg font-bold text-xs uppercase hover:bg-black transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Download size={14} /> Exportar PDF
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
