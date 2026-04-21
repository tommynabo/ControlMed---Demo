import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Download, Filter, RefreshCw, TrendingUp, Users, Wallet, ChevronDown, Percent, Check } from 'lucide-react';
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
    const [commissionRate, setCommissionRate] = useState<number>(40);
    const [labCosts, setLabCosts] = useState<Record<string, number>>({});
    const [reassignMap, setReassignMap] = useState<Record<string, string>>({});
    const [conceptoMap, setConceptoMap] = useState<Record<string, string>>({});
    const [savingId, setSavingId] = useState<string | null>(null);

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
            const colX = [14, 44, 110, 160, 200, 235, 260];
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
            doc.text('COSTE LAB', colX[5], headerY);
            doc.text('NETO', colX[6], headerY);

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
                doc.text(fecha, colX[0], y);
                doc.text(doc.splitTextToSize(r.concepto || '-', 64)[0], colX[1], y);
                doc.text(doc.splitTextToSize(r.nombrePaciente || '-', 48)[0], colX[2], y);
                doc.text(r.numeroHistoria || '-', colX[3], y);
                doc.text(`${r.importeCobrado.toFixed(2)} €`, colX[4], y);
                doc.text(lab > 0 ? `${lab.toFixed(2)} €` : '-', colX[5], y);
                doc.text(`${net.toFixed(2)} €`, colX[6], y);
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
            doc.text(`${totalLabCosts.toFixed(2)} €`, colX[5], y);
            doc.text(`${netAfterLab.toFixed(2)} €`, colX[6], y);

            // Commission row
            y += 9;
            doc.setFillColor(219, 234, 254);
            doc.rect(14, y - 4, 269, 8, 'F');
            doc.setTextColor(37, 99, 235);
            doc.text(`COMISIÓN DOCTOR (${commissionRate}%)`, colX[3], y);
            doc.text(`${commissionAmount.toFixed(2)} €`, colX[6], y);

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
                                        <th className="px-4 py-4 text-left text-xs font-black uppercase text-slate-500 tracking-wider">Reasignar Doctor</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Importe</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Coste Lab</th>
                                        <th className="px-6 py-4 text-right text-xs font-black uppercase text-slate-500 tracking-wider">Neto</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {records.map((record) => {
                                        const lab = labCosts[record.id] || 0;
                                        const net = record.importeCobrado - lab;
                                        const isSaving = savingId === record.id;
                                        return (
                                        <tr key={record.id} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.fecha}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-1">
                                                    <input
                                                        type="text"
                                                        value={conceptoMap[record.id] ?? record.concepto}
                                                        onChange={(e) => setConceptoMap(prev => ({ ...prev, [record.id]: e.target.value }))}
                                                        disabled={isSaving}
                                                        className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-blue-400 w-40"
                                                    />
                                                    <button
                                                        onClick={async () => {
                                                            const newConcepto = conceptoMap[record.id];
                                                            if (newConcepto === undefined || newConcepto === record.concepto) return;
                                                            setSavingId(record.id);
                                                            try {
                                                                await api.payments.update(record.id, { notes: newConcepto });
                                                                setRecords(prev => prev.map(r => r.id === record.id ? { ...r, concepto: newConcepto } : r));
                                                                setConceptoMap(prev => { const n = { ...prev }; delete n[record.id]; return n; });
                                                            } catch (err) {
                                                                console.error('Error updating concepto:', err);
                                                                setError('Error al actualizar el concepto');
                                                            } finally {
                                                                setSavingId(null);
                                                            }
                                                        }}
                                                        disabled={conceptoMap[record.id] === undefined || conceptoMap[record.id] === record.concepto || isSaving}
                                                        className="p-1.5 rounded-md bg-blue-500 hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                                                        title="Guardar concepto"
                                                    >
                                                        {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-slate-700 font-semibold">{record.nombrePaciente}</td>
                                            <td className="px-6 py-4 text-slate-500 text-xs font-bold">{record.numeroHistoria}</td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center gap-1">
                                                    <select
                                                        value={reassignMap[record.id] ?? record.doctorId ?? ''}
                                                        onChange={(e) => setReassignMap(prev => ({ ...prev, [record.id]: e.target.value }))}
                                                        disabled={isSaving}
                                                        className="bg-white border border-slate-300 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 outline-none focus:ring-1 focus:ring-emerald-400 max-w-[150px]"
                                                    >
                                                        {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                                    </select>
                                                    <button
                                                        onClick={async () => {
                                                            const newDoctorId = reassignMap[record.id];
                                                            if (!newDoctorId || newDoctorId === record.doctorId) return;
                                                            setSavingId(record.id);
                                                            try {
                                                                await api.payments.update(record.id, { doctorId: newDoctorId });
                                                                setRecords(prev => prev.filter(r => r.id !== record.id));
                                                                setReassignMap(prev => { const n = { ...prev }; delete n[record.id]; return n; });
                                                            } catch (err) {
                                                                console.error('Error reassigning payment:', err);
                                                                setError('Error al reasignar el pago');
                                                            } finally {
                                                                setSavingId(null);
                                                            }
                                                        }}
                                                        disabled={!reassignMap[record.id] || reassignMap[record.id] === record.doctorId || isSaving}
                                                        className="p-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                                                        title="Guardar reasignación"
                                                    >
                                                        {isSaving ? <RefreshCw size={12} className="animate-spin" /> : <Check size={12} />}
                                                    </button>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right font-black text-emerald-600">{record.importeCobrado.toFixed(2)}€</td>
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
                                        <td colSpan={5} className="px-6 py-4 text-right font-black uppercase text-emerald-700 text-sm">
                                            TOTALES
                                        </td>
                                        <td className="px-6 py-4 text-right font-black text-emerald-700 text-lg">{totalImporte.toFixed(2)}€</td>
                                        <td className="px-6 py-4 text-right font-black text-rose-600">{totalLabCosts.toFixed(2)}€</td>
                                        <td className="px-6 py-4 text-right font-black text-slate-900 text-lg">{netAfterLab.toFixed(2)}€</td>
                                    </tr>
                                    {/* Commission Row */}
                                    <tr className="bg-blue-50 border-t border-blue-200">
                                        <td colSpan={7} className="px-6 py-3 text-right font-black uppercase text-blue-700 text-sm">
                                            COMISIÓN DOCTOR ({commissionRate}%)
                                        </td>
                                        <td className="px-6 py-3 text-right font-black text-blue-700 text-lg">{commissionAmount.toFixed(2)}€</td>
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
