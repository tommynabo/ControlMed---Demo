import React, { useState, useEffect } from 'react';
import { DollarSign, Download, Calendar, Pencil, RefreshCw, Building2, ShieldCheck, AlertTriangle, Scissors } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Expense, Doctor, Specialization } from '../../types';
import { LiquidationEditModal } from '../components/LiquidationEditModal';

const Payroll: React.FC = () => {
    const { api, setExpenses, doctors } = useAppContext();
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
    const [liquidations, setLiquidations] = useState<any>(null);
    const [editedRecords, setEditedRecords] = useState<Record<string, { grossAmount?: number, labCost?: number, commissionRate?: number }>>({});
    const [manualAdjustment, setManualAdjustment] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [editingRow, setEditingRow] = useState<{ id: string; treatmentName: string; doctorId: string; grossAmount: number; patientName?: string; fecha?: string } | null>(null);
    const [referralData, setReferralData] = useState<any>(null);
    const [referralDateFrom, setReferralDateFrom] = useState('');
    const [referralDateTo, setReferralDateTo] = useState('');
    const [isLoadingReferral, setIsLoadingReferral] = useState(false);
    const [isReconciling, setIsReconciling] = useState(false);
    const [reconcileResult, setReconcileResult] = useState<{ created: number; skipped: number; errors: Array<{ id: string; error: string }> } | null>(null);
    const [splittingRowId, setSplittingRowId] = useState<string | null>(null);
    const [filterMode, setFilterMode] = useState<'month' | 'range'>('month');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const handleSplitRow = async (rowId: string) => {
        setSplittingRowId(rowId);
        try {
            await (api.liquidations as any).split(rowId);
            // Reload full summary to reflect the new rows
            const updated = await api.liquidations.getSummary(
                selectedDoctorId, selectedMonth, selectedYear,
                filterMode === 'range' ? dateFrom : undefined,
                filterMode === 'range' ? dateTo : undefined
            );
            setLiquidations(updated);
            setEditedRecords({});
        } catch (err: any) {
            alert(err.message || 'Error al dividir la liquidación');
        } finally {
            setSplittingRowId(null);
        }
    };

    // Fetch Liquidations when filters change
    useEffect(() => {
        const fetchLiquidations = async () => {
            if (!selectedDoctorId) return;
            if (filterMode === 'range' && (!dateFrom || !dateTo)) return;

            setIsLoading(true);
            try {
                const data = await api.liquidations.getSummary(
                    selectedDoctorId, selectedMonth, selectedYear,
                    filterMode === 'range' ? dateFrom : undefined,
                    filterMode === 'range' ? dateTo : undefined
                );
                setLiquidations(data);
            } catch (e) {
                console.error("Error fetching liquidations", e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchLiquidations();
    }, [selectedDoctorId, selectedMonth, selectedYear, filterMode, dateFrom, dateTo, api]);

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
            const period = liquidations?.period || new Date(selectedYear, selectedMonth - 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
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

    const fetchReferralCommissions = async () => {
        setIsLoadingReferral(true);
        try {
            const data = await (api as any).budget.getReferralCommissions(referralDateFrom || undefined, referralDateTo || undefined);
            setReferralData(data);
        } catch (e) {
            console.error('Error fetching referral commissions', e);
        } finally {
            setIsLoadingReferral(false);
        }
    };

    const handleRunReconciliation = async () => {
        setIsReconciling(true);
        setReconcileResult(null);
        try {
            const result = await api.liquidations.runReconciliation(180);
            setReconcileResult(result);
            // Reload liquidations to reflect any newly created rows
            if (result.created > 0 && selectedDoctorId) {
                const updated = await api.liquidations.getSummary(
                    selectedDoctorId, selectedMonth, selectedYear,
                    filterMode === 'range' ? dateFrom : undefined,
                    filterMode === 'range' ? dateTo : undefined
                );
                setLiquidations(updated);
            }
        } catch (e: any) {
            setReconcileResult({ created: -1, skipped: 0, errors: [{ id: 'general', error: e.message }] });
        } finally {
            setIsReconciling(false);
        }
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
                <td>${(r.appointment?.date || r.fecha || r.createdAt) ? new Date(r.appointment?.date || r.fecha || r.createdAt).toLocaleDateString('es-ES') : '—'}</td>
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

                    {/* Period Filter — toggle between month/year and custom date range */}
                    <div className="md:col-span-2">
                        <div className="flex items-center gap-2 mb-2">
                            <label className="text-[11px] font-bold uppercase text-slate-600">Período</label>
                            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                                <button
                                    onClick={() => setFilterMode('month')}
                                    className={`px-3 py-0.5 text-xs font-bold transition ${filterMode === 'month' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Mes
                                </button>
                                <button
                                    onClick={() => setFilterMode('range')}
                                    className={`px-3 py-0.5 text-xs font-bold transition ${filterMode === 'range' ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50'}`}
                                >
                                    Rango
                                </button>
                            </div>
                        </div>
                        {filterMode === 'month' ? (
                            <div className="grid grid-cols-2 gap-4">
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
                        ) : (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Desde</label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Hasta</label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 cursor-pointer"
                                    />
                                </div>
                            </div>
                        )}
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
                        <button
                            onClick={handleRunReconciliation}
                            disabled={isReconciling}
                            title="Detecta y crea liquidaciones que faltan en los últimos 180 días"
                            className="bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 rounded-lg font-bold text-xs uppercase transition disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap"
                        >
                            <ShieldCheck size={14} />
                            {isReconciling ? 'Verificando…' : 'Verificar integridad'}
                        </button>
                    </div>
                </div>

                {/* Reconciliation result banner */}
                {reconcileResult && (
                    <div className={`flex items-start gap-3 p-3 rounded-xl text-sm font-medium border ${reconcileResult.created === -1 ? 'bg-red-50 border-red-300 text-red-800' : reconcileResult.errors.length > 0 ? 'bg-amber-50 border-amber-300 text-amber-800' : 'bg-green-50 border-green-300 text-green-800'}`}>
                        {reconcileResult.created === -1
                            ? <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                            : <ShieldCheck size={16} className="shrink-0 mt-0.5" />}
                        <div className="flex-1">
                            {reconcileResult.created === -1
                                ? `Error en verificación: ${reconcileResult.errors[0]?.error}`
                                : <>
                                    Verificación completada — <b>{reconcileResult.created}</b> liquidación{reconcileResult.created !== 1 ? 'es' : ''} creada{reconcileResult.created !== 1 ? 's' : ''}, {reconcileResult.skipped} omitida{reconcileResult.skipped !== 1 ? 's' : ''}.
                                    {reconcileResult.errors.length > 0 && <span className="ml-1 text-amber-700">({reconcileResult.errors.length} error{reconcileResult.errors.length !== 1 ? 'es' : ''})</span>}
                                </>
                            }
                        </div>
                        <button onClick={() => setReconcileResult(null)} className="shrink-0 opacity-60 hover:opacity-100 transition" aria-label="Cerrar">
                            <X size={14} />
                        </button>
                    </div>
                )}

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
                                <p className="text-3xl font-black text-white mt-1">{getEffectiveTotal().toFixed(2)}€</p>
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
                                        <th className="w-10 px-3 py-4"></th>
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
                                                {/* Pencil column — opens modal */}
                                                <td className="px-3 py-4 text-center">
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <button
                                                            onClick={() => setEditingRow({ id: r.id, treatmentName: r.treatmentName || '', doctorId: r.doctorId || '', grossAmount: gross, patientName: r.patientName, fecha: r.appointment?.date || r.fecha || r.createdAt })}
                                                            className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                            title="Editar / Eliminar concepto"
                                                        >
                                                            <Pencil size={14} />
                                                        </button>
                                                        {/* Split button — only for unsplit rows with appointment */}
                                                        {r.itemIndex === null && r.appointmentId && (
                                                            <button
                                                                onClick={() => handleSplitRow(r.id)}
                                                                disabled={splittingRowId === r.id}
                                                                className="p-1.5 rounded-md text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                                                title="Dividir en un concepto por tratamiento"
                                                            >
                                                                {splittingRowId === r.id
                                                                    ? <RefreshCw size={13} className="animate-spin" />
                                                                    : <Scissors size={13} />}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 font-medium text-slate-700">
                                                    {r.treatmentName || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-slate-600">{(r.appointment?.date || r.fecha || r.createdAt) ? new Date(r.appointment?.date || r.fecha || r.createdAt).toLocaleDateString('es-ES') : '-'}</td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-bold">{gross.toFixed(2)}</span>€
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

                {/* ─── Referral Commissions Panel ─── */}
                <div className="mt-10 pt-10 border-t border-slate-200">
                    <div className="flex items-center gap-3 mb-6">
                        <Building2 size={22} className="text-purple-600" />
                        <div>
                            <h2 className="text-2xl font-black text-slate-900">Comisiones a Empresas Referidoras</h2>
                            <p className="text-slate-500 font-medium text-sm">Total de comisiones pendientes de pago a cada empresa que refirió pacientes</p>
                        </div>
                    </div>

                    {/* Filters */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-4 items-end mb-6">
                        <div>
                            <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">Desde</label>
                            <input
                                type="date"
                                value={referralDateFrom}
                                onChange={(e) => setReferralDateFrom(e.target.value)}
                                className="bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <div>
                            <label className="text-[11px] font-bold uppercase text-slate-600 block mb-2">Hasta</label>
                            <input
                                type="date"
                                value={referralDateTo}
                                onChange={(e) => setReferralDateTo(e.target.value)}
                                className="bg-white border-2 border-slate-300 text-slate-900 rounded-lg px-3 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                            />
                        </div>
                        <button
                            onClick={fetchReferralCommissions}
                            disabled={isLoadingReferral}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2 rounded-lg font-bold text-sm uppercase transition disabled:opacity-50 flex items-center gap-2"
                        >
                            {isLoadingReferral ? <RefreshCw size={14} className="animate-spin" /> : <Building2 size={14} />}
                            Ver comisiones
                        </button>
                    </div>

                    {/* Results */}
                    {isLoadingReferral && (
                        <div className="text-center p-10">
                            <div className="inline-block w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
                            <p className="mt-4 text-slate-500 font-bold">Calculando comisiones...</p>
                        </div>
                    )}

                    {referralData && !isLoadingReferral && (
                        <div className="space-y-4">
                            {/* Grand Total */}
                            <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white p-6 rounded-2xl shadow-lg flex items-center justify-between">
                                <div>
                                    <p className="text-purple-200 text-xs font-bold uppercase tracking-widest">Total Global a Pagar</p>
                                    <p className="text-4xl font-black mt-1">{Number(referralData.grandTotal || 0).toFixed(2)} €</p>
                                </div>
                                <Building2 size={40} className="text-purple-300 opacity-50" />
                            </div>

                            {referralData.groups?.length === 0 && (
                                <div className="text-center p-10 text-slate-400">
                                    <Building2 size={32} className="mx-auto mb-2 opacity-30" />
                                    <p className="font-bold">No hay comisiones para el período seleccionado</p>
                                </div>
                            )}

                            {referralData.groups?.map((group: any) => (
                                <div key={group.entity} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                                    <div className="bg-purple-50 border-b border-purple-100 px-6 py-4 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Building2 size={18} className="text-purple-600" />
                                            <span className="font-black text-slate-900 text-lg">{group.entity}</span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-bold uppercase text-purple-400">Total comisión</p>
                                            <p className="text-2xl font-black text-purple-700">{Number(group.totalCommission || 0).toFixed(2)} €</p>
                                        </div>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                                <tr>
                                                    <th className="px-6 py-3 text-left">Fecha</th>
                                                    <th className="px-6 py-3 text-left">Paciente</th>
                                                    <th className="px-6 py-3 text-right">Pago total</th>
                                                    <th className="px-6 py-3 text-right">Comisión referido</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100">
                                                {group.payments?.map((p: any) => (
                                                    <tr key={p.id} className="hover:bg-slate-50 transition">
                                                        <td className="px-6 py-3 text-slate-500 font-medium">{p.date ? new Date(p.date).toLocaleDateString('es-ES') : '-'}</td>
                                                        <td className="px-6 py-3 font-bold text-slate-800">{p.patientName || '-'}</td>
                                                        <td className="px-6 py-3 text-right text-slate-700 font-medium">{Number(p.amount || 0).toFixed(2)} €</td>
                                                        <td className="px-6 py-3 text-right font-black text-purple-600">{Number(p.referralCommission || 0).toFixed(2)} €</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit/Delete Modal */}
            {editingRow && (
                <LiquidationEditModal
                    isOpen={!!editingRow}
                    onClose={() => setEditingRow(null)}
                    record={{
                        id: editingRow.id,
                        concepto: editingRow.treatmentName,
                        importe: editingRow.grossAmount,
                        doctorId: editingRow.doctorId,
                        patientName: editingRow.patientName,
                        fecha: editingRow.fecha ? new Date(editingRow.fecha).toLocaleDateString('es-ES') : undefined,
                    }}
                    doctors={doctors}
                    showDoctorField={true}
                    onSave={async ({ concepto, importe, doctorId }) => {
                        await api.liquidations.update(editingRow.id, {
                            treatmentName: concepto,
                            grossAmount: importe,
                            doctorId: doctorId || undefined,
                        });
                        const refreshed = await api.liquidations.getSummary(
                            selectedDoctorId, selectedMonth, selectedYear,
                            filterMode === 'range' ? dateFrom : undefined,
                            filterMode === 'range' ? dateTo : undefined
                        );
                        setLiquidations(refreshed);
                        setEditedRecords({});
                    }}
                    onDelete={async (id) => {
                        await (api.liquidations as any).delete(id);
                        const refreshed = await api.liquidations.getSummary(
                            selectedDoctorId, selectedMonth, selectedYear,
                            filterMode === 'range' ? dateFrom : undefined,
                            filterMode === 'range' ? dateTo : undefined
                        );
                        setLiquidations(refreshed);
                        setEditedRecords({});
                    }}
                />
            )}
        </div>
    );
};

export default Payroll;
