import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Download, Filter, RefreshCw, TrendingUp, Users, Wallet, ChevronDown, Percent, Check, Pencil, X, Building2, AlertTriangle } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useAppContext } from '../context/AppContext';

interface Doctor {
    id: string;
    name: string;
    specialization?: string;
}

interface LiquidationRecord {
    id: string;
    fecha: string;
    concepto: string;
    importeCobrado: number;
    baseAmount?: number;
    nombrePaciente: string;
    numeroHistoria: string;
    doctorId: string;
    referralCommission?: number;
    referralEntityName?: string;
    isODA?: boolean;
}

export const Liquidations: React.FC = () => {
    const { api } = useAppContext();
    
    // State
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
    const [isDoctorDropdownOpen, setIsDoctorDropdownOpen] = useState(false);
    const doctorDropdownRef = useRef<HTMLDivElement>(null);
    const [dateFrom, setDateFrom] = useState<string>('');
    const [dateTo, setDateTo] = useState<string>('');
    const [records, setRecords] = useState<LiquidationRecord[]>([]);
    const [dailyGroups, setDailyGroups] = useState<Array<{ date: string; records: LiquidationRecord[]; dayTotal: number }>>([]);
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [commissionRate, setCommissionRate] = useState<number>(40);
    const [labCosts, setLabCosts] = useState<Record<string, number>>({});
    const [editingRow, setEditingRow] = useState<{ id: string; concepto: string; doctorId: string; importe: number } | null>(null);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [groupByDay, setGroupByDay] = useState<boolean>(false);
    const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

    // Reconciliation tab
    const [activeTab, setActiveTab] = useState<'liquidaciones' | 'reconciliacion'>('liquidaciones');
    const [recoGaps, setRecoGaps] = useState<Array<{ appointmentId: string; date: string; amount: number; treatmentName: string; doctorId: string; doctorName: string; patientName: string; historyNumber: string }>>([]);
    const [recoLoading, setRecoLoading] = useState(false);
    const [recoError, setRecoError] = useState<string | null>(null);
    const [fixingId, setFixingId] = useState<string | null>(null);
    const [recoMonth, setRecoMonth] = useState<string>(() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    });

    // Load doctors on mount
    useEffect(() => {
        loadDoctors();
        // Set default date range (current month)
        const now = new Date();
        setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
        setDateTo(now.toISOString().split('T')[0]);
        // Auto-load reconciliation gaps on mount so the badge count shows immediately
        loadReconciliation();
    }, []);

    // Close doctor dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (doctorDropdownRef.current && !doctorDropdownRef.current.contains(e.target as Node)) {
                setIsDoctorDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadDoctors = async () => {
        try {
            const response = await fetch('/api/doctors');
            const data = await response.json();
            setDoctors(data || []);
        } catch (err) {
            console.error('Error loading doctors:', err);
        }
    };

    const loadReconciliation = useCallback(async () => {
        setRecoLoading(true);
        setRecoError(null);
        try {
            const [y, m] = recoMonth.split('-');
            const data = await api.liquidations.getReconciliation({ month: parseInt(m), year: parseInt(y) });
            setRecoGaps(data.gaps || []);
        } catch (err: any) {
            setRecoError(err.message || 'Error al cargar la reconciliación');
        } finally {
            setRecoLoading(false);
        }
    }, [recoMonth, api]);

    const handleFixLiquidation = async (appointmentId: string) => {
        setFixingId(appointmentId);
        try {
            await api.liquidations.fixMissingLiquidation(appointmentId);
            setRecoGaps(prev => prev.filter(g => g.appointmentId !== appointmentId));
        } catch (err: any) {
            alert('❌ ' + (err.message || 'Error al crear la liquidación'));
        } finally {
            setFixingId(null);
        }
    };

    const handleSearch = async () => {
        if (!selectedDoctorId) {
            setError('Selecciona un doctor');
            return;
        }
        if (!dateFrom || !dateTo) {
            setError('Selecciona un rango de fechas');
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const url = `/api/liquidations/summary?doctorId=${selectedDoctorId}&dateFrom=${dateFrom}&dateTo=${dateTo}${groupByDay ? '&groupByDay=true' : ''}`;
            const response = await fetch(url);
            const data = await response.json();
            setRecords(data.records || []);
            setDailyGroups(data.dailyGroups || []);
            setExpandedDays(new Set((data.dailyGroups || []).map((g: any) => g.date)));
        } catch (err) {
            console.error('Error fetching liquidations:', err);
            setError('Error al cargar las liquidaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = () => {
        if (records.length === 0) {
            setError('No hay datos para exportar');
            return;
        }

        setExporting(true);
        try {
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
            const doctorName = selectedDoctor ? selectedDoctor.name : selectedDoctorId;

            // Header
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.text('Liquidación Doctor', 14, 20);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Doctor: ${doctorName}`, 14, 28);
            doc.text(`Período: ${dateFrom}  –  ${dateTo}`, 14, 34);
            doc.text(`Comisión: ${commissionRate}%`, 14, 40);

            // Summary box
            doc.setFillColor(240, 253, 244);
            doc.rect(180, 18, 100, 26, 'F');
            doc.setDrawColor(187, 247, 208);
            doc.rect(180, 18, 100, 26, 'S');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(30, 41, 59);
            doc.text(`Total Cobrado: ${totalImporte.toFixed(2)} €`, 184, 25);
            doc.text(`Coste Laboratorio: ${totalLabCosts.toFixed(2)} €`, 184, 31);
            doc.text(`Neto: ${netAfterLab.toFixed(2)} €`, 184, 37);
            doc.setTextColor(37, 99, 235);
            doc.text(`Comisión Doctor (${commissionRate}%): ${commissionAmount.toFixed(2)} €`, 184, 43);

            // Table header
            const colX = [14, 44, 110, 160, 200, 228, 253, 275];
            const headerY = 52;
            doc.setFillColor(226, 232, 240);
            doc.rect(14, headerY - 5, 269, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.setTextColor(30, 41, 59);
            doc.text('FECHA', colX[0], headerY);
            doc.text('CONCEPTO', colX[1], headerY);
            doc.text('PACIENTE', colX[2], headerY);
            doc.text('NUM', colX[3], headerY);
            doc.text('IMPORTE', colX[4], headerY);
            doc.text('BASE DOC', colX[5], headerY);
            doc.text('LAB', colX[6], headerY);
            doc.text('NETO', colX[7], headerY);

            // Table rows
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            let y = headerY + 8;
            records.forEach((r, i) => {
                if (y > 185) { doc.addPage(); y = 20; }
                if (i % 2 === 0) {
                    doc.setFillColor(248, 250, 252);
                    doc.rect(14, y - 4, 269, 7, 'F');
                }
                doc.setTextColor(30, 41, 59);
                const fecha = r.fecha ? r.fecha.substring(0, 10) : '-';
                const lab = labCosts[r.id] || 0;
                const net = r.importeCobrado - lab;
                const hasDeduction = r.baseAmount !== undefined && Math.abs(r.baseAmount - r.importeCobrado) > 0.01;
                doc.text(fecha, colX[0], y);
                doc.text(doc.splitTextToSize(r.concepto || '-', 64)[0], colX[1], y);
                doc.text(doc.splitTextToSize(r.nombrePaciente || '-', 48)[0], colX[2], y);
                doc.text(r.numeroHistoria || '-', colX[3], y);
                doc.text(`${r.importeCobrado.toFixed(2)} €`, colX[4], y);
                if (hasDeduction) {
                    doc.setTextColor(37, 99, 235);
                    doc.text(`${r.baseAmount!.toFixed(2)} €`, colX[5], y);
                    doc.setTextColor(30, 41, 59);
                } else {
                    doc.text('-', colX[5], y);
                }
                doc.text(lab > 0 ? `${lab.toFixed(2)} €` : '-', colX[6], y);
                doc.text(`${net.toFixed(2)} €`, colX[7], y);
                y += 7;
            });

            // Totals section
            y += 2;
            doc.setFillColor(209, 250, 229);
            doc.rect(14, y - 4, 269, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(4, 120, 87);
            doc.text('TOTALES', colX[3], y);
            doc.text(`${totalImporte.toFixed(2)} €`, colX[4], y);
            doc.text(`${totalLabCosts.toFixed(2)} €`, colX[6], y);
            doc.text(`${netAfterLab.toFixed(2)} €`, colX[7], y);

            // Commission row
            y += 9;
            doc.setFillColor(219, 234, 254);
            doc.rect(14, y - 4, 269, 8, 'F');
            doc.setTextColor(37, 99, 235);
            doc.text(`COMISIÓN DOCTOR (${commissionRate}%)`, colX[3], y);
            doc.text(`${commissionAmount.toFixed(2)} €`, colX[7], y);

            // Referral commission row (only if applicable)
            if (totalReferralCommission > 0) {
                y += 9;
                doc.setFillColor(254, 243, 199);
                doc.rect(14, y - 4, 269, 8, 'F');
                doc.setTextColor(180, 83, 9);
                doc.text('COMISIÓN CLÍNICA EXTERNA (10%)', colX[3], y);
                doc.text(`${totalReferralCommission.toFixed(2)} €`, colX[7], y);
            }

            // Footer
            y += 14;
            doc.setFontSize(7);
            doc.setTextColor(148, 163, 184);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generado el ${new Date().toLocaleDateString('es-ES')} a las ${new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`, 14, y);

            doc.save(`liquidacion-${doctorName}-${dateFrom}-${dateTo}.pdf`);
        } catch (err) {
            console.error('Error generating PDF:', err);
            setError('Error al generar el PDF');
        } finally {
            setExporting(false);
        }
    };

    // Calculations
    const totalImporte = useMemo(
        () => records.reduce((sum, r) => sum + r.importeCobrado, 0),
        [records]
    );

    const totalLabCosts = useMemo(
        () => records.reduce((sum, r) => sum + (labCosts[r.id] || 0), 0),
        [records, labCosts]
    );

    const netAfterLab = totalImporte - totalLabCosts;
    const commissionAmount = netAfterLab * (commissionRate / 100);
    const totalReferralCommission = useMemo(
        () => records.reduce((sum, r) => sum + (r.referralCommission || 0), 0),
        [records]
    );

    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

    return (
        <div className="min-h-screen bg-white p-8">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* Header */}
                <div>
                    <div className="flex items-start justify-between gap-4 mb-6">
                        <div>
                            <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3 mb-2">
                                <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-3 rounded-2xl">
                                    <TrendingUp size={32} className="text-white" />
                                </div>
                                Liquidaciones Doctores
                            </h1>
                            <p className="text-slate-500 text-sm font-semibold">Reportes de productividad y cobros por médico</p>
                        </div>
                        <div className="text-right">
                            <div className="text-3xl font-black text-emerald-600">{records.length}</div>
                            <div className="text-xs text-slate-500 font-bold uppercase">Registros</div>
                        </div>
                    </div>

                    {/* Summary Stats */}
                    {records.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Cobrado</div>
                                <div className="text-2xl font-black text-emerald-600">{totalImporte.toFixed(2)}€</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Coste Laboratorio</div>
                                <div className="text-2xl font-black text-rose-500">{totalLabCosts.toFixed(2)}€</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Neto (sin lab)</div>
                                <div className="text-2xl font-black text-slate-900">{netAfterLab.toFixed(2)}€</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Comisión ({commissionRate}%)</div>
                                <div className="text-2xl font-black text-blue-600">{commissionAmount.toFixed(2)}€</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Doctor</div>
                                <div className="text-sm font-black text-slate-900">
                                    {selectedDoctor ? selectedDoctor.name : 'Seleccionar'}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">{dateFrom} a {dateTo}</div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Tab switcher */}
                <div className="flex gap-2 border-b border-slate-200 pb-0">
                    <button
                        onClick={() => setActiveTab('liquidaciones')}
                        className={`px-5 py-3 font-black text-sm rounded-t-xl border-b-2 transition-colors ${activeTab === 'liquidaciones' ? 'border-emerald-500 text-emerald-600 bg-emerald-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        Liquidaciones
                    </button>
                    <button
                        onClick={() => { setActiveTab('reconciliacion'); loadReconciliation(); }}
                        className={`px-5 py-3 font-black text-sm rounded-t-xl border-b-2 transition-colors flex items-center gap-2 ${activeTab === 'reconciliacion' ? 'border-amber-500 text-amber-600 bg-amber-50' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                    >
                        <AlertTriangle size={15} />
                        Reconciliación
                        {recoGaps.length > 0 && (
                            <span className="bg-amber-500 text-white text-xs font-black rounded-full px-2 py-0.5">{recoGaps.length}</span>
                        )}
                    </button>
                </div>

                {/* ── RECONCILIATION PANEL ─────────────────────────────── */}
                {activeTab === 'reconciliacion' && (
                    <div className="space-y-6">
                        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                            <div className="flex items-center gap-3 mb-1">
                                <AlertTriangle size={20} className="text-amber-600" />
                                <h2 className="text-lg font-black text-amber-800">Citas cobradas sin liquidación</h2>
                            </div>
                            <p className="text-sm text-amber-700">Estas citas están marcadas como pagadas pero no tienen registro de liquidación. Créalas aquí con un clic antes de generar los informes mensuales.</p>
                        </div>

                        {/* Month picker + refresh */}
                        <div className="flex items-center gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-1 block">Mes</label>
                                <input
                                    type="month"
                                    value={recoMonth}
                                    onChange={e => setRecoMonth(e.target.value)}
                                    className="bg-white border border-slate-300 text-slate-900 px-4 py-2 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-amber-400"
                                />
                            </div>
                            <button
                                onClick={loadReconciliation}
                                disabled={recoLoading}
                                className="mt-5 flex items-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2 rounded-lg font-black text-sm transition-colors"
                            >
                                <RefreshCw size={14} className={recoLoading ? 'animate-spin' : ''} />
                                {recoLoading ? 'Cargando...' : 'Buscar huecos'}
                            </button>
                        </div>

                        {recoError && (
                            <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm font-semibold">
                                ⚠️ {recoError}
                            </div>
                        )}

                        {!recoLoading && recoGaps.length === 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-6 rounded-2xl text-center font-black">
                                ✅ Todo cuadra — no hay citas sin liquidación para este mes
                            </div>
                        )}

                        {recoGaps.length > 0 && (
                            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200">
                                        <tr>
                                            <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">Fecha</th>
                                            <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">Paciente</th>
                                            <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">HC</th>
                                            <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">Doctor</th>
                                            <th className="text-left px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">Concepto</th>
                                            <th className="text-right px-4 py-3 font-black text-slate-600 text-xs uppercase tracking-wider">Importe</th>
                                            <th className="px-4 py-3"></th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {recoGaps.map(gap => (
                                            <tr key={gap.appointmentId} className="hover:bg-amber-50 transition-colors">
                                                <td className="px-4 py-3 font-semibold text-slate-700">
                                                    {new Date(gap.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                                </td>
                                                <td className="px-4 py-3 font-bold text-slate-900">{gap.patientName}</td>
                                                <td className="px-4 py-3 text-slate-500 font-semibold">{gap.historyNumber}</td>
                                                <td className="px-4 py-3 text-slate-700 font-semibold">{gap.doctorName}</td>
                                                <td className="px-4 py-3 text-slate-600 font-medium max-w-[200px] truncate" title={gap.treatmentName}>{gap.treatmentName}</td>
                                                <td className="px-4 py-3 text-right font-black text-emerald-600">{gap.amount.toFixed(2)}€</td>
                                                <td className="px-4 py-3 text-right">
                                                    <button
                                                        onClick={() => handleFixLiquidation(gap.appointmentId)}
                                                        disabled={fixingId === gap.appointmentId}
                                                        className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-black text-xs flex items-center gap-1 ml-auto transition-colors"
                                                    >
                                                        {fixingId === gap.appointmentId ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                                        Crear liquidación
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50 border-t border-slate-200">
                                        <tr>
                                            <td colSpan={5} className="px-4 py-3 font-black text-slate-600 text-xs uppercase">{recoGaps.length} citas sin liquidación</td>
                                            <td className="px-4 py-3 text-right font-black text-slate-900">
                                                {recoGaps.reduce((s, g) => s + g.amount, 0).toFixed(2)}€
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* ── LIQUIDACIONES PANEL (existing content) ───────────── */}
                {activeTab === 'liquidaciones' && <>

                {/* Filters */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter size={20} className="text-slate-500" />
                        <h2 className="text-lg font-black text-slate-900">Filtros</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* Doctor Selector - custom dropdown to avoid OS dark-mode overrides */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 block">Doctor</label>
                            <div ref={doctorDropdownRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsDoctorDropdownOpen(o => !o)}
                                    className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-lg px-4 py-3 font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 hover:border-slate-400 transition-colors"
                                    style={{ color: selectedDoctorId ? '#111827' : '#6b7280' }}
                                >
                                    <span className="truncate">
                                        {selectedDoctorId
                                            ? (() => { const d = doctors.find(x => x.id === selectedDoctorId); return d ? d.name : '-- Seleccionar Doctor --'; })()
                                            : '-- Seleccionar Doctor --'
                                        }
                                    </span>
                                    <ChevronDown size={16} className={`flex-shrink-0 ml-2 transition-transform ${isDoctorDropdownOpen ? 'rotate-180' : ''}`} style={{ color: '#6b7280' }} />
                                </button>
                                {isDoctorDropdownOpen && (
                                    <div className="absolute top-full left-0 right-0 mt-1 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto" style={{ backgroundColor: '#ffffff', border: '1px solid #d1d5db' }}>
                                        <button
                                            type="button"
                                            onClick={() => { setSelectedDoctorId(''); setIsDoctorDropdownOpen(false); }}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100"
                                            style={{ color: '#6b7280', backgroundColor: 'transparent' }}
                                        >
                                            -- Seleccionar Doctor --
                                        </button>
                                        {doctors.map(d => (
                                            <button
                                                key={d.id}
                                                type="button"
                                                onClick={() => { setSelectedDoctorId(d.id); setIsDoctorDropdownOpen(false); }}
                                                className="w-full text-left px-4 py-2.5 text-sm font-semibold hover:bg-emerald-50 border-b border-slate-100 last:border-0"
                                                style={{ color: '#111827', backgroundColor: selectedDoctorId === d.id ? '#ecfdf5' : 'transparent' }}
                                            >
                                                {d.name}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Date From */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 block">Desde</label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 px-4 py-3 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Date To */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 block">Hasta</label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full bg-white border border-slate-300 text-slate-900 px-4 py-3 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                            />
                        </div>

                        {/* Commission Rate */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2 block">Comisión Doctor (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    max="100"
                                    step="1"
                                    value={commissionRate}
                                    onChange={(e) => setCommissionRate(Math.min(100, Math.max(0, Number(e.target.value))))}
                                    className="w-full bg-white border border-slate-300 text-slate-900 px-4 py-3 rounded-lg font-bold text-sm outline-none focus:ring-2 focus:ring-emerald-500 pr-10"
                                />
                                <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            </div>
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-500/20 border border-rose-500 text-rose-200 p-3 rounded-lg text-sm font-semibold">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Search Buttons */}
                    <div className="flex gap-3 pt-4 flex-wrap">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Filter size={16} />}
                            {loading ? 'Buscando...' : 'Buscar'}
                        </button>
                        <button
                            onClick={() => setGroupByDay(v => !v)}
                            className={`px-4 py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-colors border ${groupByDay ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:border-indigo-400'}`}
                            title="Agrupar resultados por día"
                        >
                            {groupByDay ? '▦ Por día: ON' : '▦ Por día: OFF'}
                        </button>
                        {records.length > 0 && (
                            <button
                                onClick={handleExportPDF}
                                disabled={exporting}
                                className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-colors"
                            >
                                <Download size={16} />
                                {exporting ? 'Exportando...' : 'Descargar PDF'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Daily breakdown view */}
                {groupByDay && dailyGroups.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-black text-slate-900">Desglose por Día ({dailyGroups.length} días)</h3>
                        {dailyGroups.map(group => {
                            const isExpanded = expandedDays.has(group.date);
                            const toggleDay = () => setExpandedDays(prev => {
                                const next = new Set(prev);
                                isExpanded ? next.delete(group.date) : next.add(group.date);
                                return next;
                            });
                            const dayLab = group.records.reduce((s, r) => s + (labCosts[r.id] || 0), 0);
                            const dayNet = group.dayTotal - dayLab;
                            const dayCommission = dayNet * (commissionRate / 100);
                            return (
                                <div key={group.date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                                    <button
                                        onClick={toggleDay}
                                        className="w-full flex items-center justify-between px-6 py-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className="font-black text-slate-900">{new Date(group.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
                                            <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold">{group.records.length} registros</span>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-slate-500">Total: <span className="font-black text-emerald-600">{group.dayTotal.toFixed(2)}€</span></span>
                                            <span className="text-slate-500">Comisión: <span className="font-black text-blue-600">{dayCommission.toFixed(2)}€</span></span>
                                            <span className="text-slate-400">{isExpanded ? '▲' : '▼'}</span>
                                        </div>
                                    </button>
                                    {isExpanded && (
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead className="bg-white border-b border-slate-100">
                                                    <tr>
                                                        <th className="px-6 py-3 text-left text-xs font-black uppercase text-slate-400 tracking-wider">Hora</th>
                                                        <th className="px-6 py-3 text-left text-xs font-black uppercase text-slate-400 tracking-wider">Concepto</th>
                                                        <th className="px-6 py-3 text-left text-xs font-black uppercase text-slate-400 tracking-wider">Paciente</th>
                                                        <th className="px-6 py-3 text-left text-xs font-black uppercase text-slate-400 tracking-wider">NUM</th>
                                                        <th className="px-6 py-3 text-right text-xs font-black uppercase text-slate-400 tracking-wider">Importe</th>
                                                        <th className="px-6 py-3 text-right text-xs font-black uppercase text-blue-400 tracking-wider">Base Doctor</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {group.records.map(r => {
                                                        const hasClinicDeduction = r.baseAmount !== undefined && Math.abs(r.baseAmount - r.importeCobrado) > 0.01;
                                                        return (
                                                            <tr key={r.id} className="hover:bg-slate-50">
                                                                <td className="px-6 py-3 text-slate-500 text-xs">{String(r.fecha).length > 10 ? String(r.fecha).substring(11, 16) : '-'}</td>
                                                                <td className="px-6 py-3 text-slate-700 text-xs font-semibold">{r.concepto}</td>
                                                                <td className="px-6 py-3 text-slate-700 font-semibold">{r.nombrePaciente}</td>
                                                                <td className="px-6 py-3 text-slate-500 text-xs">{r.numeroHistoria}</td>
                                                                <td className="px-6 py-3 text-right font-black text-emerald-600">{r.importeCobrado.toFixed(2)}€</td>
                                                                <td className="px-6 py-3 text-right">
                                                                    {hasClinicDeduction ? (
                                                                        <span className="font-black text-blue-600 flex items-center justify-end gap-1">
                                                                            {(r.baseAmount!).toFixed(2)}€
                                                                            <span title="OPG / servicios clínica excluidos" className="text-amber-500"><Building2 size={11} /></span>
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-slate-400 text-xs">—</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                                <tfoot className="bg-emerald-50 border-t border-emerald-200">
                                                    <tr>
                                                        <td colSpan={4} className="px-6 py-3 text-xs font-black text-emerald-700 uppercase">Subtotal día</td>
                                                        <td className="px-6 py-3 text-right font-black text-emerald-700">{group.dayTotal.toFixed(2)}€</td>
                                                        <td className="px-6 py-3 text-right font-black text-blue-700">
                                                            {group.records.some(r => r.baseAmount !== undefined && Math.abs(r.baseAmount - r.importeCobrado) > 0.01)
                                                                ? group.records.reduce((sum, r) => sum + (r.baseAmount ?? r.importeCobrado), 0).toFixed(2) + '€'
                                                                : '—'}
                                                        </td>
                                                    </tr>
                                                </tfoot>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Results Table */}
                {records.length > 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="w-10 px-3 py-4"></th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Fecha</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Concepto</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Paciente</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">NUM</th>
                                        <th className="px-4 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Doctor</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Importe</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-blue-500 tracking-wider">Base Doctor</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Coste Lab</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Neto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {records.map((record) => {
                                        const lab = labCosts[record.id] || 0;
                                        const isEditing = editingRow?.id === record.id;
                                        const isSaving = savingId === record.id;
                                        const net = (isEditing ? editingRow!.importe : record.importeCobrado) - lab;
                                        return (
                                        <tr key={record.id} className={`transition-colors ${isEditing ? 'bg-amber-50 border-l-4 border-l-amber-400' : 'hover:bg-blue-50/30'}`}>
                                            {/* Pencil / Save+Cancel column */}
                                            <td className="px-3 py-2 text-center">
                                                {isEditing ? (
                                                    <div className="flex flex-col gap-1 items-center">
                                                        <button
                                                            onClick={async () => {
                                                                if (!editingRow) return;
                                                                setSavingId(record.id);
                                                                try {
                                                                    const doctorChanged = editingRow.doctorId !== record.doctorId;
                                                                    await api.liquidations.update(record.id, {
                                                                        treatmentName: editingRow.concepto,
                                                                        doctorId: editingRow.doctorId,
                                                                        grossAmount: editingRow.importe,
                                                                    });
                                                                    if (doctorChanged) {
                                                                        setRecords(prev => prev.filter(r => r.id !== record.id));
                                                                    } else {
                                                                        setRecords(prev => prev.map(r => r.id === record.id
                                                                            ? { ...r, concepto: editingRow.concepto, doctorId: editingRow.doctorId, importeCobrado: editingRow.importe }
                                                                            : r
                                                                        ));
                                                                    }
                                                                    setEditingRow(null);
                                                                } catch (err) {
                                                                    console.error('Error saving row:', err);
                                                                    setError('Error al guardar los cambios');
                                                                } finally {
                                                                    setSavingId(null);
                                                                }
                                                            }}
                                                            disabled={isSaving}
                                                            className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white transition-colors"
                                                            title="Guardar cambios"
                                                        >
                                                            {isSaving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
                                                        </button>
                                                        <button
                                                            onClick={() => setEditingRow(null)}
                                                            disabled={isSaving}
                                                            className="p-1.5 rounded-md bg-slate-200 hover:bg-slate-300 disabled:opacity-40 text-slate-600 transition-colors"
                                                            title="Cancelar"
                                                        >
                                                            <X size={13} />
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button
                                                        onClick={() => setEditingRow({ id: record.id, concepto: record.concepto, doctorId: record.doctorId ?? '', importe: record.importeCobrado })}
                                                        className="p-1.5 rounded-md text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                                                        title="Editar fila"
                                                    >
                                                        <Pencil size={14} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.fecha}</td>
                                            {/* Concepto */}
                                            <td className="px-3 py-2">
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editingRow!.concepto}
                                                        onChange={(e) => setEditingRow(prev => prev ? { ...prev, concepto: e.target.value } : prev)}
                                                        disabled={isSaving}
                                                        autoFocus
                                                        className="bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-amber-400 w-44"
                                                    />
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-700">{record.concepto}</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 font-semibold">
                                                <div className="flex items-center gap-2">
                                                    {record.isODA && (
                                                        <span className="text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md whitespace-nowrap">ODA</span>
                                                    )}
                                                    {record.nombrePaciente}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-bold">{record.numeroHistoria}</td>
                                            {/* Doctor */}
                                            <td className="px-4 py-2">
                                                {isEditing ? (
                                                    <select
                                                        value={editingRow!.doctorId}
                                                        onChange={(e) => setEditingRow(prev => prev ? { ...prev, doctorId: e.target.value } : prev)}
                                                        disabled={isSaving}
                                                        className="bg-white border border-amber-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-amber-400 max-w-[160px]"
                                                    >
                                                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                    </select>
                                                ) : (
                                                    <span className="text-xs font-semibold text-slate-700">{doctors.find(d => d.id === record.doctorId)?.name ?? record.doctorId}</span>
                                                )}
                                            </td>
                                            {/* Importe */}
                                            <td className="px-6 py-4 text-right">
                                                {isEditing ? (
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={editingRow!.importe}
                                                        onChange={(e) => setEditingRow(prev => prev ? { ...prev, importe: Number(e.target.value) || 0 } : prev)}
                                                        disabled={isSaving}
                                                        className="w-24 text-right bg-white border border-amber-300 rounded-md px-2 py-1 text-sm font-black text-emerald-600 outline-none focus:ring-1 focus:ring-amber-400"
                                                    />
                                                ) : (
                                                    <span className="font-black text-emerald-600">{record.importeCobrado.toFixed(2)}€</span>
                                                )}
                                            </td>
                                            {/* Base Doctor */}
                                            <td className="px-6 py-4 text-right">
                                                {record.baseAmount !== undefined && Math.abs(record.baseAmount - record.importeCobrado) > 0.01 ? (
                                                    <span className="font-black text-blue-600 flex items-center justify-end gap-1">
                                                        {record.baseAmount.toFixed(2)}€
                                                        <span title="OPG / servicios clínica excluidos"><Building2 size={11} className="text-amber-500" /></span>
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-xs">—</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-2 text-right">
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={lab || ''}
                                                    placeholder="0.00"
                                                    onChange={(e) => setLabCosts(prev => ({ ...prev, [record.id]: Number(e.target.value) || 0 }))}
                                                    className="w-24 text-right bg-rose-50 border border-rose-200 rounded-lg px-2 py-1.5 text-sm font-bold text-rose-600 outline-none focus:ring-2 focus:ring-rose-400"
                                                />
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-slate-800">{net.toFixed(2)}€</td>
                                        </tr>
                                        );
                                    })}
                                    {/* Total Row */}
                                    <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                                        <td colSpan={7} className="px-6 py-4 text-right font-black uppercase text-emerald-700 text-sm">
                                            TOTALES
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-700 text-lg">{totalImporte.toFixed(2)}€</td>
                                        <td className="px-6 py-4 text-right font-black text-rose-600">{totalLabCosts.toFixed(2)}€</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-lg">{netAfterLab.toFixed(2)}€</td>
                                    </tr>
                                    {/* Commission Row */}
                                    <tr className="bg-blue-50 border-t border-blue-200">
                                        <td colSpan={9} className="px-6 py-3 text-right font-black uppercase text-blue-700 text-sm">
                                            COMISIÓN DOCTOR ({commissionRate}%)
                                        </td>
                                        <td className="px-6 py-3 text-right font-black text-blue-700 text-lg">{commissionAmount.toFixed(2)}€</td>
                                    </tr>
                                    {/* Referral Commission Row — only shown when ODA patients exist */}
                                    {totalReferralCommission > 0 && (
                                        <tr className="bg-amber-50 border-t border-amber-200">
                                            <td colSpan={9} className="px-6 py-3 text-right font-black uppercase text-amber-700 text-sm">
                                                COMISIÓN CLÍNICA EXTERNA (10%)
                                            </td>
                                            <td className="px-6 py-3 text-right font-black text-amber-700 text-lg">{totalReferralCommission.toFixed(2)}€</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
                        <Wallet size={48} className="mx-auto text-slate-400 mb-4 opacity-50" />
                        <p className="text-slate-500 font-semibold">
                            {loading ? 'Cargando liquidaciones...' : 'Selecciona filtros y busca para ver liquidaciones'}
                        </p>
                    </div>
                )}
                </> /* end liquidaciones tab */}
            </div>
        </div>
    );
};
