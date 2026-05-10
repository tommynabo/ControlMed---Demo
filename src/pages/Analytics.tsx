import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
    UserPlus, FileText, CheckCircle, DollarSign,
    BarChart2, TrendingUp, Percent, Award, ChevronDown, X, Stethoscope, Calendar,
} from 'lucide-react';
import { api } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PatientListItem {
    nhc:  string;
    name: string;
}

interface PatientRow {
    nhc:          string;
    date:         string;
    name:         string;
    isFirstVisit: boolean;
    budgetRef:    string;
    budgetStatus: string;
    budgetAmount: number;
    closedAmount: number;
    topTreatment: string;
}

interface PaymentDetail {
    id:            string;
    date:          string;
    amount:        number;
    method:        string;
    concept:       string;
    patientName:   string;
    historyNumber: string;
}

interface MonthlyAnalytics {
    month:           string;
    newPatients:     number;
    budgetsCreated:  { count: number; total: number };
    budgetsAccepted: { count: number; total: number };
    realRevenue:     { count: number; total: number };
    conversionRate:  number;
    topTreatment:    string;
    newPatientList:  PatientListItem[];
    patientRows:     PatientRow[];
    paymentDetails:  PaymentDetail[];
}

interface AnnualAnalytics {
    year:             string;
    newPatients:      number;
    budgetsCreated:   { count: number; total: number };
    budgetsAccepted:  { count: number; total: number };
    realRevenue:      { count: number; total: number };
    monthlyBreakdown: { month: number; total: number }[];
    paymentDetails:   PaymentDetail[];
}

interface DoctorStat {
    doctorId:         string;
    doctorName:       string;
    specialization:   string | null;
    appointmentCount: number;
    totalBilled:      number;
    totalLabCost:     number;
    totalCommission:  number;
    treatments:       string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function formatEur(value: number): string {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function buildMonthKey(monthNum: number, year: number): string {
    return `${year}-${String(monthNum).padStart(2, '0')}`;
}

function periodLabel(viewMode: 'monthly' | 'annual', monthNum: number, year: number): string {
    if (viewMode === 'annual') return String(year);
    return new Date(year, monthNum - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

const METHOD_LABELS: Record<string, string> = {
    cash: 'Efectivo', card: 'Tarjeta', transfer: 'Transferencia',
    CASH: 'Efectivo', CARD: 'Tarjeta', TRANSFER: 'Transferencia', mixed: 'Mixto',
};

// ─── Patient List Modal ───────────────────────────────────────────────────────

interface PatientModalProps {
    title:    string;
    patients: PatientListItem[];
    onClose:  () => void;
}

const PatientModal: React.FC<PatientModalProps> = ({ title, patients, onClose }) => {
    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            aria-modal="true"
            role="dialog"
        >
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                onClick={onClose}
            />
            {/* Panel */}
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-md flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 shrink-0">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">
                            {patients.length} registro{patients.length !== 1 ? 's' : ''}
                        </p>
                        <h3 className="text-xl font-black text-slate-900">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>
                {/* List */}
                <ul className="overflow-y-auto divide-y divide-slate-50 px-6 py-2">
                    {patients.map((p, i) => (
                        <li key={i} className="py-3 flex items-center gap-4">
                            <span className="font-mono text-xs font-bold text-slate-400 w-16 shrink-0">
                                {p.nhc}
                            </span>
                            <span className="text-base font-semibold text-slate-800 leading-snug">
                                {p.name}
                            </span>
                        </li>
                    ))}
                </ul>
                {/* Footer padding */}
                <div className="h-4 shrink-0" />
            </div>
        </div>,
        document.body,
    );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

// ─── Payment List Modal ──────────────────────────────────────────────────────

interface PaymentModalProps {
    title:    string;
    payments: PaymentDetail[];
    onClose:  () => void;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ title, payments, onClose }) => {
    const total = payments.reduce((s, p) => s + p.amount, 0);
    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" aria-modal="true" role="dialog">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
            <div className="relative bg-white rounded-[2rem] shadow-2xl w-full max-w-2xl flex flex-col max-h-[85vh]">
                <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-slate-100 shrink-0">
                    <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-0.5">
                            {payments.length} cobro{payments.length !== 1 ? 's' : ''} — Total: {formatEur(total)}
                        </p>
                        <h3 className="text-xl font-black text-slate-900">{title}</h3>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors" aria-label="Cerrar">
                        <X size={20} />
                    </button>
                </div>
                <div className="overflow-y-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest sticky top-0">
                            <tr>
                                <th className="px-6 py-3 text-left">Fecha</th>
                                <th className="px-6 py-3 text-left">Paciente</th>
                                <th className="px-6 py-3 text-left">Concepto</th>
                                <th className="px-6 py-3 text-center">Método</th>
                                <th className="px-6 py-3 text-right">Importe</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {payments.map(p => (
                                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-3 font-mono text-xs text-slate-500">{formatDate(p.date)}</td>
                                    <td className="px-6 py-3">
                                        <span className="font-bold text-slate-800">{p.patientName}</span>
                                        <span className="block text-[10px] text-slate-400">{p.historyNumber}</span>
                                    </td>
                                    <td className="px-6 py-3 text-slate-600">{p.concept}</td>
                                    <td className="px-6 py-3 text-center">
                                        <span className="bg-slate-100 px-3 py-1 rounded-lg text-[10px] font-bold uppercase">
                                            {METHOD_LABELS[p.method] ?? p.method}
                                        </span>
                                    </td>
                                    <td className="px-6 py-3 text-right font-black text-emerald-600">{formatEur(p.amount)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="px-8 py-4 border-t border-slate-100 shrink-0 flex justify-between items-center">
                    <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Total cobrado</span>
                    <span className="text-xl font-black text-emerald-600">{formatEur(total)}</span>
                </div>
            </div>
        </div>,
        document.body,
    );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────

interface SummaryCardProps {
    label:           string;
    primaryValue:    string;
    secondaryValue?: string;
    icon:            React.ElementType;
    colorClass:      string;
    shadowClass:     string;
    featured?:       boolean;
    loading?:        boolean;
    patientList?:    PatientListItem[];
    onCardClick?:    () => void;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
    label, primaryValue, secondaryValue,
    icon: Icon, colorClass, shadowClass, featured, loading, patientList, onCardClick,
}) => {
    const [open, setOpen] = useState(false);
    const hasList = patientList && patientList.length > 0;
    const isClickable = hasList || !!onCardClick;

    return (
        <>
            <div
                className={`bg-white rounded-[2rem] border transition-shadow relative
                    ${featured
                        ? 'border-indigo-100 shadow-md hover:shadow-lg ring-2 ring-indigo-100'
                        : 'border-slate-100 shadow-sm hover:shadow-md'
                    }`}
            >
                <div className="p-8">
                    <div className="flex justify-between items-start mb-5">
                        <div className={`p-4 rounded-2xl ${colorClass} text-white ${shadowClass}`}>
                            <Icon size={24} />
                        </div>
                    </div>
                    {loading ? (
                        <>
                            <div className="h-10 w-3/4 bg-slate-100 rounded-xl animate-pulse mb-2" />
                            <div className="h-4 w-1/2 bg-slate-100 rounded-lg animate-pulse" />
                        </>
                    ) : (
                        <>
                            <button
                                onClick={() => { if (onCardClick) onCardClick(); else if (hasList) setOpen(true); }}
                                className={`flex items-center gap-2 group text-left w-full ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <p className={`font-black text-slate-900 ${featured ? 'text-5xl' : 'text-4xl'}`}>
                                    {primaryValue}
                                </p>
                                {isClickable && (
                                    <span className="text-slate-300 group-hover:text-slate-500 transition-colors mt-2">
                                        <ChevronDown size={18} />
                                    </span>
                                )}
                            </button>
                            {secondaryValue && (
                                <p className="text-sm font-semibold text-slate-500 mt-1">{secondaryValue}</p>
                            )}
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
                        </>
                    )}
                </div>
            </div>

            {open && hasList && (
                <PatientModal
                    title={label}
                    patients={patientList!}
                    onClose={() => setOpen(false)}
                />
            )}
        </>
    );
};

// ─── Bar Chart ────────────────────────────────────────────────────────────────

const ComparisonBarChart: React.FC<{
    budgetsTotal: number;
    acceptedTotal: number;
    revenueTotal: number;
}> = ({ budgetsTotal, acceptedTotal, revenueTotal }) => {
    const max = Math.max(budgetsTotal, acceptedTotal, revenueTotal, 1);
    const bars = [
        { label: 'Presupuestado', value: budgetsTotal,  color: 'bg-violet-500', bg: 'bg-violet-50' },
        { label: 'Aceptado',      value: acceptedTotal, color: 'bg-emerald-500', bg: 'bg-emerald-50' },
        { label: 'Cobrado',       value: revenueTotal,  color: 'bg-blue-500',    bg: 'bg-blue-50'   },
    ];
    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" /> Comparativa del Mes
            </h3>
            <div className="space-y-5">
                {bars.map((bar) => {
                    const pct = Math.round((bar.value / max) * 100);
                    return (
                        <div key={bar.label}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    {bar.label}
                                </span>
                                <span className="text-sm font-black text-slate-900">{formatEur(bar.value)}</span>
                            </div>
                            <div className={`w-full h-3 rounded-full ${bar.bg}`}>
                                <div
                                    className={`h-3 rounded-full ${bar.color} transition-all duration-700`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
            {max === 1 && (
                <p className="text-xs text-slate-400 text-center mt-4">Sin datos para este mes</p>
            )}
        </div>
    );
};

// ─── Status Badge ─────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
    const map: Record<string, { label: string; className: string }> = {
        ACCEPTED: { label: 'ACEPTADO',  className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        DRAFT:    { label: 'BORRADOR',  className: 'bg-slate-50   text-slate-500   border-slate-200'   },
        REJECTED: { label: 'RECHAZADO', className: 'bg-rose-50    text-rose-700    border-rose-200'    },
        PENDING:  { label: 'PENDIENTE', className: 'bg-amber-50   text-amber-700   border-amber-200'   },
    };
    const config = map[status] ?? { label: status, className: 'bg-blue-50 text-blue-700 border-blue-200' };
    return (
        <span className={`inline-block px-2 py-0.5 rounded-lg text-[11px] font-black uppercase border ${config.className}`}>
            {config.label}
        </span>
    );
};

// ─── Patient Table ────────────────────────────────────────────────────────────

const PatientTable: React.FC<{ rows: PatientRow[] }> = ({ rows }) => {
    if (rows.length === 0) {
        return (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center">
                <p className="text-slate-400 font-medium">No hay presupuestos registrados en este mes.</p>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <div className="px-8 pt-7 pb-4 flex items-center gap-2">
                <FileText size={18} className="text-violet-500" />
                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                    Detalle de Pacientes — {rows.length} registro{rows.length !== 1 ? 's' : ''}
                </h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="bg-slate-50 border-y border-slate-100">
                            {['NHC', 'Fecha', 'Nombre y Apellido', '1ª Visita',
                              'Presupuesto', 'Estado', 'Importe Pres.', 'Importe Cerrado', 'Tratamiento'
                            ].map(col => (
                                <th key={col} className="px-5 py-3 text-left text-[11px] font-black text-slate-400 uppercase tracking-wider whitespace-nowrap">
                                    {col}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {rows.map((row, i) => (
                            <tr key={i} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-500 whitespace-nowrap">
                                    {row.nhc}
                                </td>
                                <td className="px-5 py-3.5 text-slate-600 whitespace-nowrap tabular-nums">
                                    {formatDate(row.date)}
                                </td>
                                <td className="px-5 py-3.5 font-semibold text-slate-900 whitespace-nowrap">
                                    {row.name}
                                </td>
                                <td className="px-5 py-3.5 text-center">
                                    {row.isFirstVisit ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            ✅ Sí
                                        </span>
                                    ) : (
                                        <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-black bg-slate-50 text-slate-400 border border-slate-200">
                                            No
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-3.5 text-slate-500 whitespace-nowrap text-xs">
                                    {row.budgetRef}
                                </td>
                                <td className="px-5 py-3.5">
                                    <StatusBadge status={row.budgetStatus} />
                                </td>
                                <td className="px-5 py-3.5 tabular-nums font-semibold text-slate-700 whitespace-nowrap text-right">
                                    {formatEur(row.budgetAmount)}
                                </td>
                                <td className="px-5 py-3.5 tabular-nums font-bold whitespace-nowrap text-right">
                                    <span className={row.closedAmount > 0 ? 'text-emerald-600' : 'text-slate-300'}>
                                        {row.closedAmount > 0 ? formatEur(row.closedAmount) : '—'}
                                    </span>
                                </td>
                                <td className="px-5 py-3.5">
                                    {row.topTreatment !== '—' ? (
                                        <span className="inline-block px-2 py-0.5 rounded-lg text-[11px] font-black bg-violet-50 text-violet-700 border border-violet-200 uppercase">
                                            {row.topTreatment}
                                        </span>
                                    ) : (
                                        <span className="text-slate-300 font-bold">—</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
    const now = new Date();
    const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
    const [selectedMonthNum, setSelectedMonthNum] = useState<number>(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const openPaymentModal = useCallback(() => setPaymentModalOpen(true), []);

    const selectedMonthKey = buildMonthKey(selectedMonthNum, selectedYear);

    // Available years: 5 years back to current
    const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 5 + i).filter(y => y <= now.getFullYear());
    // Block future month+year combos
    const isFutureMonth = selectedYear === now.getFullYear() && selectedMonthNum > now.getMonth() + 1;

    const { data: monthlyData, isLoading: monthlyLoading, isError: monthlyError } = useQuery<MonthlyAnalytics>({
        queryKey: ['analytics', 'monthly', selectedMonthKey],
        queryFn:  () => (api.analytics as any).getMonthly(selectedMonthKey),
        staleTime: 1000 * 60 * 5,
        enabled: viewMode === 'monthly' && !isFutureMonth,
    });

    const { data: annualData, isLoading: annualLoading, isError: annualError } = useQuery<AnnualAnalytics>({
        queryKey: ['analytics', 'annual', selectedYear],
        queryFn:  () => (api.analytics as any).getAnnual(selectedYear),
        staleTime: 1000 * 60 * 5,
        enabled: viewMode === 'annual',
    });

    const { data: doctorData, isLoading: doctorLoading } = useQuery<{ period: string; doctors: DoctorStat[] }>({
        queryKey: ['analytics', 'doctors', viewMode === 'annual' ? String(selectedYear) : selectedMonthKey],
        queryFn:  () => viewMode === 'annual'
            ? (api.analytics as any).getDoctors({ year: selectedYear })
            : (api.analytics as any).getDoctors({ month: selectedMonthKey }),
        staleTime: 1000 * 60 * 5,
    });

    const data       = viewMode === 'monthly' ? monthlyData       : undefined;
    const isLoading  = viewMode === 'monthly' ? monthlyLoading     : annualLoading;
    const isError    = viewMode === 'monthly' ? monthlyError       : annualError;
    const annualView = viewMode === 'annual'  ? annualData         : undefined;

    // Unified realRevenue from either source
    const realRevenue = viewMode === 'annual'
        ? annualView?.realRevenue
        : data?.realRevenue;
    const paymentDetails: PaymentDetail[] = viewMode === 'annual'
        ? (annualView?.paymentDetails ?? [])
        : (data?.paymentDetails ?? []);

    const budgetCreatedList: PatientListItem[] = data?.patientRows.map(r => ({ nhc: r.nhc, name: r.name })) ?? [];
    const budgetAcceptedList: PatientListItem[] = data?.patientRows
        .filter(r => r.budgetStatus === 'ACCEPTED')
        .map(r => ({ nhc: r.nhc, name: r.name })) ?? [];

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-7xl mx-auto space-y-8">

                {/* ── Header ──────────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                    <div>
                        <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-3">
                            <BarChart2 size={36} className="text-blue-500" />
                            Analítica
                        </h2>
                        <p className="text-slate-500 font-medium capitalize">
                            {periodLabel(viewMode, selectedMonthNum, selectedYear)}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Vista toggle */}
                        <div className="flex rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                                    viewMode === 'monthly' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <Calendar size={13} className="inline mr-1" />Mes
                            </button>
                            <button
                                onClick={() => setViewMode('annual')}
                                className={`px-4 py-2 text-xs font-black uppercase tracking-widest transition-colors ${
                                    viewMode === 'annual' ? 'bg-blue-600 text-white' : 'bg-white text-slate-400 hover:text-slate-700'
                                }`}
                            >
                                <BarChart2 size={13} className="inline mr-1" />Año
                            </button>
                        </div>

                        {/* Month selector (hidden in annual view) */}
                        {viewMode === 'monthly' && (
                            <select
                                value={selectedMonthNum}
                                onChange={e => setSelectedMonthNum(Number(e.target.value))}
                                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-800 font-semibold text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
                            >
                                {MONTH_NAMES.map((name, idx) => (
                                    <option key={idx + 1} value={idx + 1}>{name}</option>
                                ))}
                            </select>
                        )}

                        {/* Year selector */}
                        <select
                            value={selectedYear}
                            onChange={e => setSelectedYear(Number(e.target.value))}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-800 font-semibold text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none cursor-pointer"
                        >
                            {yearOptions.map(y => (
                                <option key={y} value={y}>{y}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* ── Error ───────────────────────────────────────────────── */}
                {isError && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl p-6 font-medium">
                        No se pudieron cargar las métricas. Verifica la conexión con el servidor.
                    </div>
                )}

                {/* ── KPI Cards ────────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
                    <SummaryCard
                        label={viewMode === 'annual' ? 'Nuevos Pacientes (año)' : 'Nuevos Pacientes'}
                        primaryValue={isLoading ? '—' : String((viewMode === 'annual' ? annualView?.newPatients : data?.newPatients) ?? 0)}
                        secondaryValue={viewMode === 'monthly' ? 'primeras visitas del mes' : 'primeras visitas del año'}
                        icon={UserPlus}
                        colorClass="bg-blue-500"
                        shadowClass="shadow-lg shadow-blue-500/30"
                        loading={isLoading}
                        patientList={viewMode === 'monthly' ? data?.newPatientList : undefined}
                    />
                    <SummaryCard
                        label="Presupuestos Entregados"
                        primaryValue={isLoading ? '—' : String((viewMode === 'annual' ? annualView?.budgetsCreated.count : data?.budgetsCreated.count) ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur((viewMode === 'annual' ? annualView?.budgetsCreated.total : data?.budgetsCreated.total) ?? 0)}
                        icon={FileText}
                        colorClass="bg-violet-500"
                        shadowClass="shadow-lg shadow-violet-500/30"
                        loading={isLoading}
                        patientList={viewMode === 'monthly' ? budgetCreatedList : undefined}
                    />
                    <SummaryCard
                        label="Presupuestos Aceptados"
                        primaryValue={isLoading ? '—' : String((viewMode === 'annual' ? annualView?.budgetsAccepted.count : data?.budgetsAccepted.count) ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur((viewMode === 'annual' ? annualView?.budgetsAccepted.total : data?.budgetsAccepted.total) ?? 0)}
                        icon={CheckCircle}
                        colorClass="bg-emerald-500"
                        shadowClass="shadow-lg shadow-emerald-500/30"
                        loading={isLoading}
                        patientList={viewMode === 'monthly' ? budgetAcceptedList : undefined}
                    />
                    <SummaryCard
                        label="Ingresos Reales"
                        primaryValue={isLoading ? '—' : formatEur(realRevenue?.total ?? 0)}
                        secondaryValue={isLoading ? undefined : `${realRevenue?.count ?? 0} cobros — clic para ver detalle`}
                        icon={DollarSign}
                        colorClass="bg-teal-500"
                        shadowClass="shadow-lg shadow-teal-500/30"
                        loading={isLoading}
                        onCardClick={paymentDetails.length > 0 ? openPaymentModal : undefined}
                    />
                    {viewMode === 'monthly' && (
                        <SummaryCard
                            label="% Conversión"
                            primaryValue={isLoading ? '—' : `${data?.conversionRate ?? 0}%`}
                            secondaryValue="nuevos que aceptaron y pagaron"
                            icon={Percent}
                            colorClass="bg-indigo-500"
                            shadowClass="shadow-lg shadow-indigo-500/30"
                            featured
                            loading={isLoading}
                        />
                    )}
                    {viewMode === 'annual' && (
                        <SummaryCard
                            label="Facturación Anual"
                            primaryValue={isLoading ? '—' : formatEur(realRevenue?.total ?? 0)}
                            secondaryValue={`Año ${selectedYear}`}
                            icon={Award}
                            colorClass="bg-amber-500"
                            shadowClass="shadow-lg shadow-amber-500/30"
                            featured
                            loading={isLoading}
                        />
                    )}
                </div>

                {/* ── Top Treatment + Chart (monthly only) ─────────────── */}
                {viewMode === 'monthly' && !isLoading && !isError && data && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm flex flex-col justify-between">
                            <div className="flex items-center gap-2 mb-4">
                                <Award size={18} className="text-amber-500" />
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                                    Tratamiento del Mes
                                </h3>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-slate-900 mb-1">{data.topTreatment}</p>
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                                    Tratamiento más demandado
                                </p>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <ComparisonBarChart
                                budgetsTotal={data.budgetsCreated.total}
                                acceptedTotal={data.budgetsAccepted.total}
                                revenueTotal={data.realRevenue.total}
                            />
                        </div>
                    </div>
                )}

                {/* ── Annual monthly breakdown ─────────────────────────────── */}
                {viewMode === 'annual' && !annualLoading && annualView && annualView.monthlyBreakdown && (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
                        <div className="flex items-center gap-2 mb-6">
                            <TrendingUp size={18} className="text-blue-500" />
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                                Ingresos por mes — {selectedYear}
                            </h3>
                        </div>
                        <div className="grid grid-cols-6 md:grid-cols-12 gap-3">
                            {annualView.monthlyBreakdown.map((mb) => {
                                const maxTotal = Math.max(...annualView.monthlyBreakdown.map(x => x.total), 1);
                                const pct = Math.round((mb.total / maxTotal) * 100);
                                return (
                                    <div key={mb.month} className="flex flex-col items-center gap-1">
                                        <span className="text-[10px] font-black text-slate-400">{formatEur(mb.total).replace(' €','')}</span>
                                        <div className="w-full bg-slate-100 rounded-lg overflow-hidden h-20 flex items-end">
                                            <div
                                                className="w-full bg-blue-500 rounded-lg transition-all duration-500"
                                                style={{ height: `${pct}%`, minHeight: mb.total > 0 ? '4px' : '0' }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                            {MONTH_NAMES[mb.month - 1]?.slice(0, 3)}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {isLoading && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                        {[1, 2].map((i) => (
                            <div key={i} className={`bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4 ${i === 2 ? 'lg:col-span-2' : ''}`}>
                                <div className="h-5 w-40 bg-slate-100 rounded-lg animate-pulse" />
                                {[1, 2, 3].map((j) => (
                                    <div key={j} className="space-y-1">
                                        <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                                        <div className="h-3 w-full bg-slate-100 rounded-full animate-pulse" />
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Patient Detail Table (monthly only) ─────────────────── */}
                {viewMode === 'monthly' && !isLoading && !isError && data && <PatientTable rows={data.patientRows} />}

                {viewMode === 'monthly' && isLoading && (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-3">
                        <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse" />
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 w-full bg-slate-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

                {/* ── Doctor Performance ────────────────────────────────────── */}
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <div className="px-8 py-6 border-b border-slate-100 flex items-center gap-3">
                        <Stethoscope size={20} className="text-violet-500" />
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">
                                Rendimiento por Doctor
                            </h3>
                            <p className="text-xs text-slate-400 font-medium mt-0.5">
                                {periodLabel(viewMode, selectedMonthNum, selectedYear)}
                            </p>
                        </div>
                    </div>
                    {doctorLoading ? (
                        <div className="p-8 space-y-3">
                            {[1,2,3].map(i => <div key={i} className="h-12 w-full bg-slate-50 rounded-xl animate-pulse" />)}
                        </div>
                    ) : !doctorData || doctorData.doctors.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 font-medium text-sm">
                            Sin datos de liquidaciones para este período
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                    <tr>
                                        <th className="px-6 py-3 text-left">Doctor</th>
                                        <th className="px-6 py-3 text-left">Especialidad</th>
                                        <th className="px-6 py-3 text-center">Citas</th>
                                        <th className="px-6 py-3 text-right">Facturado</th>
                                        <th className="px-6 py-3 text-right">Lab / Mat.</th>
                                        <th className="px-6 py-3 text-right">Comisión</th>
                                        <th className="px-6 py-3 text-left">Tratamientos</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {doctorData.doctors.map(doc => (
                                        <tr key={doc.doctorId} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-6 py-4 font-black text-slate-900 whitespace-nowrap">
                                                {doc.doctorName}
                                            </td>
                                            <td className="px-6 py-4 text-slate-500 text-xs">
                                                {doc.specialization ?? '—'}
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-slate-700">
                                                {doc.appointmentCount}
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600 whitespace-nowrap">
                                                {formatEur(doc.totalBilled)}
                                            </td>
                                            <td className="px-6 py-4 text-right text-slate-500 whitespace-nowrap">
                                                {doc.totalLabCost > 0 ? formatEur(doc.totalLabCost) : '—'}
                                            </td>
                                            <td className="px-6 py-4 text-right font-bold text-violet-600 whitespace-nowrap">
                                                {doc.totalCommission > 0 ? formatEur(doc.totalCommission) : '—'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1">
                                                    {doc.treatments.slice(0, 4).map((t, i) => (
                                                        <span key={i} className="bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold uppercase px-2 py-0.5 rounded-lg">
                                                            {t}
                                                        </span>
                                                    ))}
                                                    {doc.treatments.length > 4 && (
                                                        <span className="text-[10px] text-slate-400 font-bold self-center">
                                                            +{doc.treatments.length - 4}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-100">
                                    <tr>
                                        <td colSpan={3} className="px-6 py-3 text-xs font-black uppercase text-slate-400 tracking-widest">Total</td>
                                        <td className="px-6 py-3 text-right font-black text-emerald-600 whitespace-nowrap">
                                            {formatEur(doctorData.doctors.reduce((s, d) => s + d.totalBilled, 0))}
                                        </td>
                                        <td className="px-6 py-3 text-right text-slate-500 whitespace-nowrap">
                                            {formatEur(doctorData.doctors.reduce((s, d) => s + d.totalLabCost, 0))}
                                        </td>
                                        <td className="px-6 py-3 text-right font-bold text-violet-600 whitespace-nowrap">
                                            {formatEur(doctorData.doctors.reduce((s, d) => s + d.totalCommission, 0))}
                                        </td>
                                        <td />
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

                {/* ── Payment detail modal ─────────────────────────────────── */}
                {paymentModalOpen && paymentDetails.length > 0 && (
                    <PaymentModal
                        title={`Ingresos Reales — ${periodLabel(viewMode, selectedMonthNum, selectedYear)}`}
                        payments={paymentDetails}
                        onClose={() => setPaymentModalOpen(false)}
                    />
                )}

            </div>
        </div>
    );
};

export default Analytics;
