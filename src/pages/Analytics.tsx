import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
    UserPlus, FileText, CheckCircle, DollarSign,
    BarChart2, TrendingUp, Percent, Award, ChevronDown, X,
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
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function formatDate(iso: string): string {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y.slice(2)}`;
}

function toMonthInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function monthLabel(monthStr: string): string {
    const [y, m] = monthStr.split('-');
    return new Date(Number(y), Number(m) - 1, 1)
        .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

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
}

const SummaryCard: React.FC<SummaryCardProps> = ({
    label, primaryValue, secondaryValue,
    icon: Icon, colorClass, shadowClass, featured, loading, patientList,
}) => {
    const [open, setOpen] = useState(false);
    const hasList = patientList && patientList.length > 0;

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
                                onClick={() => hasList && setOpen(true)}
                                className={`flex items-center gap-2 group text-left w-full ${hasList ? 'cursor-pointer' : 'cursor-default'}`}
                            >
                                <p className={`font-black text-slate-900 ${featured ? 'text-5xl' : 'text-4xl'}`}>
                                    {primaryValue}
                                </p>
                                {hasList && (
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
    const [selectedMonth, setSelectedMonth] = useState<string>(toMonthInput(new Date()));

    const { data, isLoading, isError } = useQuery<MonthlyAnalytics>({
        queryKey: ['analytics', selectedMonth],
        queryFn:  () => api.analytics.getMonthly(selectedMonth),
        staleTime: 1000 * 60 * 5,
    });

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
                            Analítica Mensual
                        </h2>
                        <p className="text-slate-500 font-medium capitalize">
                            {monthLabel(selectedMonth)}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <label htmlFor="month-picker" className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                            Mes
                        </label>
                        <input
                            id="month-picker"
                            type="month"
                            value={selectedMonth}
                            max={toMonthInput(new Date())}
                            onChange={(e) => setSelectedMonth(e.target.value)}
                            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-800 font-semibold text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                    </div>
                </div>

                {/* ── Error ───────────────────────────────────────────────── */}
                {isError && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl p-6 font-medium">
                        No se pudieron cargar las métricas. Verifica la conexión con el servidor.
                    </div>
                )}

                {/* ── KPI Cards (5) ────────────────────────────────────────── */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
                    <SummaryCard
                        label="Nuevos Pacientes"
                        primaryValue={isLoading ? '—' : String(data?.newPatients ?? 0)}
                        secondaryValue="primeras visitas del mes"
                        icon={UserPlus}
                        colorClass="bg-blue-500"
                        shadowClass="shadow-lg shadow-blue-500/30"
                        loading={isLoading}
                        patientList={data?.newPatientList}
                    />
                    <SummaryCard
                        label="Presupuestos Entregados"
                        primaryValue={isLoading ? '—' : String(data?.budgetsCreated.count ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur(data?.budgetsCreated.total ?? 0)}
                        icon={FileText}
                        colorClass="bg-violet-500"
                        shadowClass="shadow-lg shadow-violet-500/30"
                        loading={isLoading}
                        patientList={budgetCreatedList}
                    />
                    <SummaryCard
                        label="Presupuestos Aceptados"
                        primaryValue={isLoading ? '—' : String(data?.budgetsAccepted.count ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur(data?.budgetsAccepted.total ?? 0)}
                        icon={CheckCircle}
                        colorClass="bg-emerald-500"
                        shadowClass="shadow-lg shadow-emerald-500/30"
                        loading={isLoading}
                        patientList={budgetAcceptedList}
                    />
                    <SummaryCard
                        label="Ingresos Reales"
                        primaryValue={isLoading ? '—' : formatEur(data?.realRevenue.total ?? 0)}
                        secondaryValue={isLoading ? undefined : `${data?.realRevenue.count ?? 0} cobros`}
                        icon={DollarSign}
                        colorClass="bg-teal-500"
                        shadowClass="shadow-lg shadow-teal-500/30"
                        loading={isLoading}
                    />
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
                </div>

                {/* ── Top Treatment + Chart ────────────────────────────────── */}
                {!isLoading && !isError && data && (
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

                {/* ── Patient Detail Table ─────────────────────────────────── */}
                {!isLoading && !isError && data && <PatientTable rows={data.patientRows} />}

                {isLoading && (
                    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 space-y-3">
                        <div className="h-5 w-48 bg-slate-100 rounded-lg animate-pulse" />
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-10 w-full bg-slate-50 rounded-xl animate-pulse" />
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};

export default Analytics;
