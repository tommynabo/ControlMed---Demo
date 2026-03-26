import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Filter, RefreshCw, TrendingUp, Users, Wallet, ChevronDown } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface Doctor {
    id: string;
    nombre: string;
    apellido?: string;
}

interface LiquidationRecord {
    id: string;
    fecha: string;
    concepto: string;
    importeCobrado: number;
    nombrePaciente: string;
    numeroHistoria: string;
    doctorId: string;
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
    const [loading, setLoading] = useState(false);
    const [exporting, setExporting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load doctors on mount
    useEffect(() => {
        loadDoctors();
        // Set default date range (current month)
        const now = new Date();
        setDateFrom(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`);
        setDateTo(now.toISOString().split('T')[0]);
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
            const response = await fetch(
                `/api/liquidations/summary?doctorId=${selectedDoctorId}&dateFrom=${dateFrom}&dateTo=${dateTo}`
            );
            const data = await response.json();
            setRecords(data.records || []);
        } catch (err) {
            console.error('Error fetching liquidations:', err);
            setError('Error al cargar las liquidaciones');
        } finally {
            setLoading(false);
        }
    };

    const handleExportPDF = async () => {
        if (records.length === 0) {
            setError('No hay datos para exportar');
            return;
        }

        setExporting(true);
        try {
            const response = await fetch('/api/liquidations/export-pdf', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    doctorId: selectedDoctorId,
                    dateFrom,
                    dateTo,
                    records
                })
            });

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `liquidaciones-${selectedDoctorId}-${dateFrom}-${dateTo}.pdf`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
        } catch (err) {
            console.error('Error exporting PDF:', err);
            setError('Error al exportar PDF');
        } finally {
            setExporting(false);
        }
    };

    // Calculations
    const totalImporte = useMemo(
        () => records.reduce((sum, r) => sum + r.importeCobrado, 0),
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
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Total Cobrado</div>
                                <div className="text-3xl font-black text-emerald-600">{totalImporte.toFixed(2)}€</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Período</div>
                                <div className="text-sm font-black text-slate-900">{dateFrom} a {dateTo}</div>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                                <div className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Doctor</div>
                                <div className="text-sm font-black text-slate-900">
                                    {selectedDoctor ? `${selectedDoctor.nombre} ${selectedDoctor.apellido || ''}` : 'Seleccionar'}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Filters */}
                <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
                    <div className="flex items-center gap-2 mb-4">
                        <Filter size={20} className="text-slate-500" />
                        <h2 className="text-lg font-black text-slate-900">Filtros</h2>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                                            ? (() => { const d = doctors.find(x => x.id === selectedDoctorId); return d ? `${d.nombre} ${d.apellido || ''}` : '-- Seleccionar Doctor --'; })()
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
                                                {d.nombre} {d.apellido || ''}
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
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="bg-rose-500/20 border border-rose-500 text-rose-200 p-3 rounded-lg text-sm font-semibold">
                            ⚠️ {error}
                        </div>
                    )}

                    {/* Search Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={handleSearch}
                            disabled={loading}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-6 py-3 rounded-lg font-black text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            {loading ? <RefreshCw size={16} className="animate-spin" /> : <Filter size={16} />}
                            {loading ? 'Buscando...' : 'Buscar'}
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

                {/* Results Table */}
                {records.length > 0 ? (
                    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Fecha</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Concepto</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Paciente</th>
                                        <th className="px-6 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">NUM</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Importe</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {records.map((record) => (
                                        <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.fecha}</td>
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.concepto}</td>
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.nombrePaciente}</td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-bold">{record.numeroHistoria}</td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600">{record.importeCobrado.toFixed(2)}€</td>
                                        </tr>
                                    ))}
                                    {/* Total Row */}
                                    <tr className="bg-emerald-50 border-t-2 border-emerald-200">
                                        <td colSpan={4} className="px-6 py-4 text-right font-black uppercase text-emerald-700 text-sm">
                                            TOTAL
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-700 text-lg">{totalImporte.toFixed(2)}€</td>
                                    </tr>
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
            </div>
        </div>
    );
};
