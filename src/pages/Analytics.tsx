import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UserPlus, FileText, CheckCircle, DollarSign, BarChart2, TrendingUp } from 'lucide-react';
import { api } from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthlyAnalytics {
    month: string;
    newPatients: number;
    budgetsCreated: { count: number; total: number };
    budgetsAccepted: { count: number; total: number };
    realRevenue: { count: number; total: number };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEur(value: number): string {
    return value.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
}

function toMonthInput(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${m}`;
}

function monthLabel(monthStr: string): string {
    const [y, m] = monthStr.split('-');
    const date = new Date(Number(y), Number(m) - 1, 1);
    return date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SummaryCardProps {
    label: string;
    primaryValue: string;
    secondaryValue?: string;
    icon: React.ElementType;
    colorClass: string;   // Tailwind bg color for icon container
    shadowClass: string;  // Tailwind shadow color for icon container
    loading?: boolean;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
    label, primaryValue, secondaryValue, icon: Icon,
    colorClass, shadowClass, loading,
}) => (
    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
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
                <p className="text-4xl font-black text-slate-900 mb-1">{primaryValue}</p>
                {secondaryValue && (
                    <p className="text-sm font-semibold text-slate-500">{secondaryValue}</p>
                )}
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">{label}</p>
            </>
        )}
    </div>
);

// ─── Bar Chart ────────────────────────────────────────────────────────────────

interface BarChartProps {
    budgetsTotal: number;
    acceptedTotal: number;
    revenueTotal: number;
}

const ComparisonBarChart: React.FC<BarChartProps> = ({ budgetsTotal, acceptedTotal, revenueTotal }) => {
    const max = Math.max(budgetsTotal, acceptedTotal, revenueTotal, 1);

    const bars: { label: string; value: number; color: string; bg: string }[] = [
        { label: 'Presupuestado', value: budgetsTotal,  color: 'bg-violet-500', bg: 'bg-violet-50' },
        { label: 'Aceptado',      value: acceptedTotal, color: 'bg-emerald-500', bg: 'bg-emerald-50' },
        { label: 'Cobrado',       value: revenueTotal,  color: 'bg-blue-500',    bg: 'bg-blue-50'    },
    ];

    return (
        <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" /> Comparativa del Mes
            </h3>
            <div className="space-y-5">
                {bars.map((bar) => {
                    const pct = max > 0 ? Math.round((bar.value / max) * 100) : 0;
                    return (
                        <div key={bar.label}>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{bar.label}</span>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
    const [selectedMonth, setSelectedMonth] = useState<string>(toMonthInput(new Date()));

    const { data, isLoading, isError } = useQuery<MonthlyAnalytics>({
        queryKey: ['analytics', selectedMonth],
        queryFn: () => api.analytics.getMonthly(selectedMonth),
        staleTime: 1000 * 60 * 5, // 5 minutes
    });

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-6xl mx-auto space-y-10">

                {/* Header */}
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

                    {/* Month picker */}
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

                {/* Error state */}
                {isError && (
                    <div className="bg-rose-50 text-rose-700 border border-rose-100 rounded-2xl p-6 font-medium">
                        No se pudieron cargar las métricas. Verifica la conexión con el servidor.
                    </div>
                )}

                {/* KPI Cards grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
                    <SummaryCard
                        label="Nuevos Pacientes"
                        primaryValue={isLoading ? '—' : String(data?.newPatients ?? 0)}
                        secondaryValue={isLoading ? undefined : 'primeras visitas del mes'}
                        icon={UserPlus}
                        colorClass="bg-blue-500"
                        shadowClass="shadow-lg shadow-blue-500/30"
                        loading={isLoading}
                    />
                    <SummaryCard
                        label="Presupuestos Entregados"
                        primaryValue={isLoading ? '—' : String(data?.budgetsCreated.count ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur(data?.budgetsCreated.total ?? 0)}
                        icon={FileText}
                        colorClass="bg-violet-500"
                        shadowClass="shadow-lg shadow-violet-500/30"
                        loading={isLoading}
                    />
                    <SummaryCard
                        label="Presupuestos Aceptados"
                        primaryValue={isLoading ? '—' : String(data?.budgetsAccepted.count ?? 0)}
                        secondaryValue={isLoading ? undefined : formatEur(data?.budgetsAccepted.total ?? 0)}
                        icon={CheckCircle}
                        colorClass="bg-emerald-500"
                        shadowClass="shadow-lg shadow-emerald-500/30"
                        loading={isLoading}
                    />
                    <SummaryCard
                        label="Ingresos Reales"
                        primaryValue={isLoading ? '—' : formatEur(data?.realRevenue.total ?? 0)}
                        secondaryValue={isLoading ? undefined : `${data?.realRevenue.count ?? 0} cobros registrados`}
                        icon={DollarSign}
                        colorClass="bg-teal-500"
                        shadowClass="shadow-lg shadow-teal-500/30"
                        loading={isLoading}
                    />
                </div>

                {/* Comparison bar chart */}
                {!isLoading && !isError && data && (
                    <ComparisonBarChart
                        budgetsTotal={data.budgetsCreated.total}
                        acceptedTotal={data.budgetsAccepted.total}
                        revenueTotal={data.realRevenue.total}
                    />
                )}

                {/* Loading skeleton for chart */}
                {isLoading && (
                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                        <div className="h-5 w-40 bg-slate-100 rounded-lg animate-pulse" />
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="space-y-1">
                                <div className="h-3 w-28 bg-slate-100 rounded animate-pulse" />
                                <div className="h-3 w-full bg-slate-100 rounded-full animate-pulse" />
                            </div>
                        ))}
                    </div>
                )}

            </div>
        </div>
    );
};

export default Analytics;
