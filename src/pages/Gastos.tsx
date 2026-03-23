import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Trash2, Receipt, CreditCard, DollarSign, ArrowRightLeft, Building } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Expense } from '../../types';

const CATEGORIES = ['Material Medico', 'Oficina', 'Mantenimiento', 'Varios'] as const;
const PAYMENT_METHODS = [
    { value: 'cash', label: 'Efectivo', icon: DollarSign },
    { value: 'card', label: 'Tarjeta', icon: CreditCard },
    { value: 'transfer', label: 'Transferencia', icon: ArrowRightLeft },
    { value: 'domiciliacion', label: 'Domiciliación', icon: Building },
] as const;

const today = () => new Date().toISOString().split('T')[0];

const Gastos: React.FC = () => {
    const { expenses, setExpenses, api } = useAppContext();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [filterMonth, setFilterMonth] = useState<string>(today().slice(0, 7)); // YYYY-MM

    // Form state
    const [form, setForm] = useState({
        date: today(),
        description: '',
        category: 'Varios' as typeof CATEGORIES[number],
        amount: '',
        paymentMethod: 'cash' as typeof PAYMENT_METHODS[number]['value'],
    });

    // Load expenses from API on mount
    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.expenses.getAll();
                if (data && data.length >= 0) setExpenses(data);
            } catch (e) {
                // Fallback to context data if API not available
            }
        };
        load();
    }, []);

    const filtered = useMemo(() => {
        return expenses
            .filter(e => {
                const d = typeof e.date === 'string' ? e.date : '';
                return d.startsWith(filterMonth);
            })
            .sort((a, b) => b.date.localeCompare(a.date));
    }, [expenses, filterMonth]);

    const monthTotal = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered]);
    const cashTotal = useMemo(() => filtered.filter(e => e.paymentMethod === 'cash').reduce((s, e) => s + e.amount, 0), [filtered]);

    const resetForm = () => setForm({ date: today(), description: '', category: 'Varios', amount: '', paymentMethod: 'cash' });

    const handleSave = async () => {
        if (!form.description.trim() || !form.amount || parseFloat(form.amount) <= 0) {
            alert('Por favor completa el concepto y el importe.');
            return;
        }
        setIsLoading(true);
        try {
            const payload = {
                date: form.date,
                description: form.description.trim(),
                category: form.category,
                amount: parseFloat(form.amount),
                paymentMethod: form.paymentMethod,
            };
            const created = await api.expenses.create(payload);
            const newExpense: Expense = created || { id: `exp_${Date.now()}`, ...payload };
            setExpenses(prev => [newExpense, ...prev]);
            setIsModalOpen(false);
            resetForm();
        } catch (e: any) {
            // If API fails, save locally so the UI still works
            const localExpense: Expense = {
                id: `exp_${Date.now()}`,
                date: form.date,
                description: form.description.trim(),
                category: form.category,
                amount: parseFloat(form.amount),
                paymentMethod: form.paymentMethod,
            };
            setExpenses(prev => [localExpense, ...prev]);
            setIsModalOpen(false);
            resetForm();
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar este gasto?')) return;
        try {
            await api.expenses.delete(id);
        } catch { /* ignore if API unavailable */ }
        setExpenses(prev => prev.filter(e => e.id !== id));
    };

    const getCategoryColor = (cat: string) => {
        if (cat === 'Material Medico') return 'bg-blue-100 text-blue-700';
        if (cat === 'Oficina') return 'bg-purple-100 text-purple-700';
        if (cat === 'Mantenimiento') return 'bg-orange-100 text-orange-700';
        return 'bg-slate-100 text-slate-600';
    };

    const getMethodLabel = (method: string) => PAYMENT_METHODS.find(m => m.value === method)?.label || method;
    const getMethodColor = (method: string) => {
        if (method === 'cash') return 'bg-emerald-100 text-emerald-700';
        if (method === 'card') return 'bg-blue-100 text-blue-700';
        if (method === 'transfer') return 'bg-violet-100 text-violet-700';
        return 'bg-slate-100 text-slate-600';
    };

    return (
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-5xl mx-auto space-y-8">

                {/* Header */}
                <div className="flex items-end justify-between">
                    <div>
                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gastos de la Clínica</h2>
                        <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Control de salidas de caja</p>
                    </div>
                    <button
                        onClick={() => { resetForm(); setIsModalOpen(true); }}
                        className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase shadow-lg hover:bg-slate-700 transition-colors"
                    >
                        <Plus size={16} /> Nuevo Gasto
                    </button>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Total del Mes</p>
                        <p className="text-2xl font-black text-rose-500">-{monthTotal.toFixed(2)}€</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Pagado en Efectivo</p>
                        <p className="text-2xl font-black text-amber-600">-{cashTotal.toFixed(2)}€</p>
                        <p className="text-[10px] text-slate-400 mt-1">Impacto directo en cajón</p>
                    </div>
                    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Nº de Gastos</p>
                        <p className="text-2xl font-black text-slate-700">{filtered.length}</p>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">Mes:</label>
                    <input
                        type="month"
                        value={filterMonth}
                        onChange={e => setFilterMonth(e.target.value)}
                        className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    {filtered.length === 0 ? (
                        <div className="py-16 text-center">
                            <Receipt className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                            <p className="text-sm font-bold text-slate-400">No hay gastos registrados este mes</p>
                        </div>
                    ) : (
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 tracking-widest border-b border-slate-100">
                                <tr>
                                    <th className="p-5 pl-6">Fecha</th>
                                    <th className="p-5">Concepto</th>
                                    <th className="p-5">Categoría</th>
                                    <th className="p-5">Método</th>
                                    <th className="p-5 text-right pr-6">Importe</th>
                                    <th className="p-5"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {filtered.map(exp => (
                                    <tr key={exp.id} className="hover:bg-slate-50 transition-colors text-sm">
                                        <td className="p-5 pl-6 text-slate-500 font-mono text-xs whitespace-nowrap">
                                            {new Date(exp.date + 'T12:00:00').toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
                                        </td>
                                        <td className="p-5 font-bold text-slate-800">{exp.description}</td>
                                        <td className="p-5">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${getCategoryColor(exp.category)}`}>
                                                {exp.category}
                                            </span>
                                        </td>
                                        <td className="p-5">
                                            <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${getMethodColor(exp.paymentMethod || 'cash')}`}>
                                                {getMethodLabel(exp.paymentMethod || 'cash')}
                                            </span>
                                        </td>
                                        <td className="p-5 pr-6 text-right font-black text-rose-600">-{exp.amount.toFixed(2)}€</td>
                                        <td className="p-5 text-right">
                                            <button onClick={() => handleDelete(exp.id)} className="p-1.5 hover:bg-rose-50 text-slate-300 hover:text-rose-500 rounded-lg transition-colors">
                                                <Trash2 size={14} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                                <tr>
                                    <td colSpan={4} className="p-5 pl-6 text-xs font-black uppercase text-slate-500">Total del mes</td>
                                    <td className="p-5 pr-6 text-right font-black text-rose-600 text-base">-{monthTotal.toFixed(2)}€</td>
                                    <td />
                                </tr>
                            </tfoot>
                        </table>
                    )}
                </div>
            </div>

            {/* NEW EXPENSE MODAL */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2rem] shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="text-xl font-black text-slate-900">Registrar Gasto</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-5">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Fecha</label>
                                    <input
                                        type="date"
                                        value={form.date}
                                        onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Importe (€)</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step={0.01}
                                        value={form.amount}
                                        onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                                        placeholder="0.00"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Concepto / Descripción</label>
                                <input
                                    type="text"
                                    value={form.description}
                                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                                    placeholder="Ej: Compra de guantes, Pago limpieza..."
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1.5">Categoría</label>
                                <select
                                    value={form.category}
                                    onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                >
                                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400 block mb-2">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PAYMENT_METHODS.map(m => (
                                        <button
                                            key={m.value}
                                            onClick={() => setForm(f => ({ ...f, paymentMethod: m.value }))}
                                            className={`flex items-center gap-2 px-4 py-3 rounded-xl border-2 text-xs font-black uppercase transition-all ${form.paymentMethod === m.value
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                            }`}
                                        >
                                            <m.icon size={14} /> {m.label}
                                        </button>
                                    ))}
                                </div>
                                {form.paymentMethod === 'cash' && (
                                    <p className="text-[10px] text-amber-600 font-bold mt-2">
                                        ⚠️ Este gasto restará del efectivo teórico en el cierre de caja.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-8 pb-8 flex gap-3">
                            <button onClick={() => setIsModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl text-sm transition-colors">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={isLoading}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                            >
                                {isLoading ? 'Guardando...' : 'Guardar Gasto'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Gastos;
