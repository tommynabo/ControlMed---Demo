import React, { useState, useEffect } from 'react';
import {
    DollarSign, BarChart3, CreditCard, CheckCircle2, AlertTriangle, X, ArrowRightLeft, Pencil, ChevronLeft, ChevronRight, CalendarDays
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';

const DENOMINATIONS = [
    { value: 500, label: '500€', type: 'billete' },
    { value: 200, label: '200€', type: 'billete' },
    { value: 100, label: '100€', type: 'billete' },
    { value: 50,  label: '50€',  type: 'billete' },
    { value: 20,  label: '20€',  type: 'billete' },
    { value: 10,  label: '10€',  type: 'billete' },
    { value: 5,   label: '5€',   type: 'billete' },
    { value: 2,   label: '2€',   type: 'moneda' },
    { value: 1,   label: '1€',   type: 'moneda' },
    { value: 0.5, label: '0,50€', type: 'moneda' },
    { value: 0.2, label: '0,20€', type: 'moneda' },
    { value: 0.1, label: '0,10€', type: 'moneda' },
    { value: 0.05, label: '0,05€', type: 'moneda' },
    { value: 0.02, label: '0,02€', type: 'moneda' },
    { value: 0.01, label: '0,01€', type: 'moneda' },
];

const CashRegister: React.FC = () => {
    const { invoices, expenses, appointments, patients, doctors, api, currentUser } = useAppContext();

    // Arqueo state
    const [arqueoCompleted, setArqueoCompleted] = useState(false);
    const [physicalCashTotal, setPhysicalCashTotal] = useState(0);
    const [showArqueoModal, setShowArqueoModal] = useState(false);
    const [billCounts, setBillCounts] = useState<Record<string, number>>(
        Object.fromEntries(DENOMINATIONS.map(d => [d.value.toString(), 0]))
    );

    // Date navigation
    const todayStr = new Date().toISOString().split('T')[0];
    const [selectedDate, setSelectedDate] = useState(todayStr);
    const isToday = selectedDate === todayStr;

    const goToPrevDay = () => {
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() - 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };
    const goToNextDay = () => {
        if (isToday) return;
        const d = new Date(selectedDate + 'T12:00:00');
        d.setDate(d.getDate() + 1);
        setSelectedDate(d.toISOString().split('T')[0]);
    };

    // Cash register closing state
    const [isClosed, setIsClosed] = useState(false);
    const [closingData, setClosingData] = useState<any>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Stats for SELECTED DATE
    const [todayInvoices, setTodayInvoices] = useState<any[]>([]);
    const [todayExpenses, setTodayExpenses] = useState<any[]>([]);

    // Date edit modal
    const [editingItem, setEditingItem] = useState<{ type: 'invoice' | 'expense'; item: any } | null>(null);
    const [editDate, setEditDate] = useState('');
    const [isSavingDate, setIsSavingDate] = useState(false);

    const handleOpenEditDate = (type: 'invoice' | 'expense', item: any) => {
        const currentDate = item.date ? item.date.split('T')[0] : new Date().toISOString().split('T')[0];
        setEditDate(currentDate);
        setEditingItem({ type, item });
    };

    const handleSaveDate = async () => {
        if (!editingItem || !editDate) return;
        setIsSavingDate(true);
        try {
            if (editingItem.type === 'invoice') {
                await (api as any).invoices.update(editingItem.item.id, { date: editDate });
            } else {
                await (api as any).expenses.update(editingItem.item.id, { ...editingItem.item, date: editDate });
            }
            // Refresh context data
            await (api as any).invoices.getAll().catch(() => {});
            // Force re-filter by triggering context refresh
            const freshInvoices = await (api as any).invoices.getAll().catch(() => []);
            const freshExpenses = await (api as any).expenses.getAll().catch(() => []);
            setTodayInvoices(freshInvoices.filter((i: any) =>
                i.date && i.date.split('T')[0] === selectedDate &&
                !['rectified', 'pending', 'refunded'].includes((i.status || '').toLowerCase())
            ));
            setTodayExpenses(freshExpenses.filter((e: any) =>
                e.date && e.date.split('T')[0] === selectedDate
            ));
            setEditingItem(null);
        } catch (e: any) {
            alert('❌ Error al cambiar la fecha: ' + (e.message || e));
        } finally {
            setIsSavingDate(false);
        }
    };

    useEffect(() => {
        setTodayInvoices(invoices.filter(i =>
            i.date && i.date.split('T')[0] === selectedDate &&
            !['rectified', 'pending', 'refunded'].includes((i.status || '').toLowerCase())
        ));
        setTodayExpenses(expenses.filter(e =>
            e.date && e.date.split('T')[0] === selectedDate
        ));
    }, [invoices, expenses, selectedDate]);

    // Load closing status for selected date
    useEffect(() => {
        setIsClosed(false);
        setClosingData(null);
        const method = isToday ? 'getToday' : 'getByDate';
        const call = isToday
            ? (api as any).cashRegister.getToday()
            : (api as any).cashRegister.getByDate(selectedDate);
        call.then((data: any) => {
            if (data) {
                setIsClosed(true);
                setClosingData(data);
            }
        }).catch(() => {});
    }, [selectedDate]);

    const stats = React.useMemo(() => {
        const totalIncome = todayInvoices.reduce((acc, curr) => acc + curr.amount, 0);
        const totalExpense = todayExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        const cashIncome = todayInvoices.filter(i => i.paymentMethod === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
        const cardIncome = todayInvoices.filter(i => i.paymentMethod === 'card').reduce((acc, curr) => acc + curr.amount, 0);
        const transferIncome = todayInvoices.filter(i => i.paymentMethod === 'transfer').reduce((acc, curr) => acc + curr.amount, 0);
        const cashExpenses = todayExpenses.filter(e => e.paymentMethod === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
        const netCash = cashIncome - cashExpenses;

        return { totalIncome, totalExpense, cashIncome, cardIncome, transferIncome, cashExpenses, netCash, balance: totalIncome - totalExpense };
    }, [todayInvoices, todayExpenses]);


    const calculatedPhysicalCash = DENOMINATIONS.reduce(
        (sum, d) => sum + d.value * (billCounts[d.value.toString()] || 0), 0
    );

    const handleConfirmArqueo = () => {
        setPhysicalCashTotal(Math.round(calculatedPhysicalCash * 100) / 100);
        setArqueoCompleted(true);
        setShowArqueoModal(false);
    };

    const handleCloseCashRegister = async () => {
        if (isClosed) return;
        if (!isToday) {
            alert('⚠️ Solo se puede cerrar la caja del día actual desde la interfaz.\n\nPara cerrar días anteriores, usa el script SQL manual.');
            return;
        }
        if (!arqueoCompleted) {
            alert('⚠️ Debes realizar el Arqueo de Caja antes de cerrar.\n\nHaz clic en "Hacer Arqueo" para contabilizar el efectivo del cajón.');
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const todayAppointments = appointments.filter(a => {
            const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
            return apptDate === today;
        });

        const pendingAppts = todayAppointments.filter(a => {
            const status = a.status?.toLowerCase() || 'scheduled';
            return !['completed', 'realizada', 'canceled', 'cancelled', 'anulada', 'noshow', 'no vino'].includes(status);
        });

        if (pendingAppts.length > 0) {
            const pendingList = pendingAppts.map(a => {
                const patient = patients.find(p => p.id === a.patientId);
                return `• ${patient?.name || 'Paciente'} - ${a.time}`;
            }).join('\n');

            alert(`⚠️ No puedes cerrar la caja. Hay ${pendingAppts.length} citas pendientes:\n\n${pendingList}\n\nMarca las citas como realizadas, anuladas o no presentado antes de cerrar.`);
            return;
        }

        const completedCount = todayAppointments.filter(a => ['completed', 'realizada'].includes(a.status?.toLowerCase() || '')).length;

        const cashDiff = physicalCashTotal - stats.netCash;
        const diffLabel = cashDiff === 0
            ? '✅ Cuadra exactamente'
            : cashDiff > 0
                ? `📈 Sobrante: +${cashDiff.toFixed(2)}€`
                : `📉 Faltante: ${cashDiff.toFixed(2)}€`;

        const summary =
            `✅ CIERRE DE CAJA — ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES')}\n\n` +
            `📊 Balance del día:\n` +
            `  Ingresos totales:    ${stats.totalIncome.toFixed(2)}€\n` +
            `  Gastos:              ${stats.totalExpense.toFixed(2)}€\n` +
            `  Neto:                ${stats.balance.toFixed(2)}€\n\n` +
            `💵 Desglose por método:\n` +
            `  Efectivo ingresos:   ${stats.cashIncome.toFixed(2)}€\n` +
            (stats.cashExpenses > 0 ? `  Gastos en efectivo:  -${stats.cashExpenses.toFixed(2)}€\n` : '') +
            `  Efectivo (neto):     ${stats.netCash.toFixed(2)}€\n` +
            `  Efectivo (físico):   ${physicalCashTotal.toFixed(2)}€\n` +
            `  Diferencia:          ${diffLabel}\n` +
            `  Tarjeta:             ${stats.cardIncome.toFixed(2)}€\n` +
            `  Transferencia:       ${stats.transferIncome.toFixed(2)}€\n\n` +
            `📋 Actividad:\n` +
            `  Citas realizadas: ${completedCount}\n` +
            `  Facturas emitidas: ${todayInvoices.length}\n\n` +
            `¿Confirmar cierre de caja?`;

        if (confirm(summary)) {
            setIsClosing(true);
            try {
                const today = new Date().toISOString().split('T')[0];
                const todayAppointments = appointments.filter(a => {
                    const apptDate = typeof a.date === 'string' ? a.date.split('T')[0] : new Date(a.date).toISOString().split('T')[0];
                    return apptDate === today;
                });
                const completedCount = todayAppointments.filter(a =>
                    ['completed', 'realizada'].includes(a.status?.toLowerCase() || '')
                ).length;

                const cashDiff = physicalCashTotal - stats.netCash;
                const record = await (api as any).cashRegister.close({
                    totalIncome: stats.totalIncome,
                    totalExpense: stats.totalExpense,
                    balance: stats.balance,
                    cashIncome: stats.cashIncome,
                    cardIncome: stats.cardIncome,
                    transferIncome: stats.transferIncome,
                    cashExpenses: stats.cashExpenses,
                    netCash: stats.netCash,
                    physicalCash: physicalCashTotal,
                    cashDiff,
                    invoiceCount: todayInvoices.length,
                    completedAppointments: completedCount,
                    closedBy: (currentUser as any)?.name || null,
                });
                setIsClosed(true);
                setClosingData(record);
                alert('✅ Caja cerrada correctamente. Los datos han sido registrados.');
            } catch (e: any) {
                alert('❌ Error al cerrar la caja: ' + (e.message || e));
            } finally {
                setIsClosing(false);
            }
        }
    };

    return (
        <>
        <div className="p-10 h-full overflow-y-auto custom-scrollbar animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h3 className="text-3xl font-black text-slate-900 tracking-tight">Caja del Día</h3>
                        <p className="text-xs text-slate-500 font-black uppercase tracking-widest mt-2">
                            {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    </div>
                    {/* Date navigator */}
                    <div className="flex items-center gap-2">
                        <button onClick={goToPrevDay} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors" title="Día anterior">
                            <ChevronLeft size={18} />
                        </button>
                        <div className="relative">
                            <input
                                type="date"
                                value={selectedDate}
                                max={todayStr}
                                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 cursor-pointer"
                            />
                        </div>
                        <button
                            onClick={goToNextDay}
                            disabled={isToday}
                            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            title="Día siguiente"
                        >
                            <ChevronRight size={18} />
                        </button>
                        {!isToday && (
                            <button
                                onClick={() => setSelectedDate(todayStr)}
                                className="px-3 py-2 bg-blue-50 text-blue-600 text-xs font-bold rounded-xl hover:bg-blue-100 transition-colors"
                            >
                                Hoy
                            </button>
                        )}
                    </div>
                </div>

                {/* Past day banner */}
                {!isToday && (
                    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <CalendarDays size={16} className="text-amber-500 flex-shrink-0" />
                        <p className="text-xs font-bold text-amber-700">
                            Estás viendo la caja del {new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}.
                            Los botones de Arqueo y Cierre solo están disponibles para el día actual.
                        </p>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Main Stats Card */}
                    <div className="col-span-2 bg-white p-10 rounded-2xl border border-slate-200 shadow-sm relative">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-3 mb-8">
                            <BarChart3 className="text-blue-500" /> {isToday ? 'Movimientos de Hoy' : `Movimientos del ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                        </h4>

                        <div className="grid grid-cols-2 gap-8">
                            <div className="p-6 bg-slate-50 rounded-2xl">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Ingresos</p>
                                <p className="text-3xl font-black text-emerald-500">+{stats.totalIncome.toFixed(2)}€</p>
                            </div>
                            <div className="p-6 bg-slate-50 rounded-2xl">
                                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Gastos</p>
                                <p className="text-3xl font-black text-rose-500">-{stats.totalExpense.toFixed(2)}€</p>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-slate-100 grid grid-cols-4 gap-4">
                            <div className="text-center">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Efectivo Neto</p>
                                <p className="text-lg font-bold text-slate-700">{stats.netCash.toFixed(2)}€</p>
                                {stats.cashExpenses > 0 && (
                                    <p className="text-[9px] text-rose-400 mt-0.5">Gastos: -{stats.cashExpenses.toFixed(2)}€</p>
                                )}
                                {arqueoCompleted && (
                                    <p className="text-[9px] text-slate-400 mt-0.5">Físico: {physicalCashTotal.toFixed(2)}€</p>
                                )}
                            </div>
                            <div className="text-center border-l border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Tarjeta</p>
                                <p className="text-lg font-bold text-slate-700">{stats.cardIncome.toFixed(2)}€</p>
                            </div>
                            <div className="text-center border-l border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Transfer.</p>
                                <p className="text-lg font-bold text-slate-700">{stats.transferIncome.toFixed(2)}€</p>
                            </div>
                            <div className="text-center border-l border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase">Balance</p>
                                <p className={`text-lg font-bold ${stats.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {stats.balance > 0 ? '+' : ''}{stats.balance.toFixed(2)}€
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Actions Panel */}
                    <div className="bg-slate-900 p-10 rounded-2xl text-white shadow-2xl flex flex-col justify-between gap-4">
                        <div>
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Estado de Caja</p>
                            {isClosed ? (
                                <div className="mb-6">
                                    <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <span className="text-xl font-bold text-red-400">CERRADA</span>
                                    </div>
                                    {closingData?.closedAt && (
                                        <p className="text-[11px] text-red-400/70 mt-1">
                                            Cerrada a las {new Date(closingData.closedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                                            {closingData.closedBy ? ` · ${closingData.closedBy}` : ''}
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mb-6">
                                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                                    <span className="text-xl font-bold">ABIERTA</span>
                                </div>
                            )}
                            {arqueoCompleted ? (
                                <div className="flex items-center gap-2 p-3 bg-emerald-900/40 border border-emerald-700/50 rounded-xl mb-4">
                                    <CheckCircle2 size={14} className="text-emerald-400 flex-shrink-0" />
                                    <div>
                                        <p className="text-xs font-black text-emerald-300">Arqueo realizado</p>
                                        <p className="text-[10px] text-emerald-400 mt-0.5">Físico contado: {physicalCashTotal.toFixed(2)}€</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 p-3 bg-amber-900/30 border border-amber-700/40 rounded-xl mb-4">
                                    <AlertTriangle size={14} className="text-amber-400 flex-shrink-0" />
                                    <p className="text-xs font-bold text-amber-300">Arqueo pendiente — requerido antes del cierre</p>
                                </div>
                            )}
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => setShowArqueoModal(true)}
                                disabled={!isToday}
                                className="w-full bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                            >
                                🧮 {arqueoCompleted ? 'Repetir Arqueo' : 'Hacer Arqueo'}
                            </button>
                            <button
                                onClick={handleCloseCashRegister}
                                disabled={!isToday || !arqueoCompleted || isClosed || isClosing}
                                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 group"
                                title={!isToday ? 'Solo puedes cerrar la caja del día actual' : isClosed ? 'La caja ya fue cerrada hoy' : ''}
                            >
                                <DollarSign size={16} className="group-hover:rotate-12 transition-transform" />
                                {isClosing ? 'Guardando...' : isClosed ? 'Caja Cerrada' : 'Cerrar Caja del Día'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Today's Transactions List */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Transacciones del Día</h4>
                    </div>
                    {todayInvoices.length === 0 && todayExpenses.length === 0 ? (
                        <div className="p-12 text-center text-slate-400 font-bold uppercase text-xs">
                            No hay movimientos registrados hoy
                        </div>
                    ) : (
                        <div className="w-full overflow-x-auto">
                            <table className="w-full min-w-max text-left">
                                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-400 tracking-widest">
                                    <tr>
                                        <th className="p-6 pl-8">Hora</th>
                                        <th className="p-6">Concepto / Paciente</th>
                                        <th className="p-6">Doctor</th>
                                        <th className="p-6 text-center">Tipo</th>
                                        <th className="p-6 text-right pr-8">Importe</th>
                                        <th className="p-6 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {todayInvoices.map(inv => {
                                        const appt = appointments.find(a => a.id === inv.appointmentId);
                                        const doctor = appt ? doctors.find(d => d.id === appt.doctorId) : null;
                                        return (
                                        <tr key={inv.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6 pl-8 font-mono text-slate-500 text-xs">
                                                {inv.date ? new Date(inv.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </td>
                                            <td className="p-6 font-bold text-slate-700">
                                                Factura {inv.invoiceNumber}
                                                <span className="block text-xs font-normal text-slate-400">
                                                    {patients.find(p => p.id === inv.patientId)?.name || 'Paciente'}
                                                </span>
                                            </td>
                                            <td className="p-6">
                                                {doctor ? (
                                                    <span className="text-xs font-bold text-violet-700">{doctor.name}</span>
                                                ) : (
                                                    <span className="text-xs text-slate-300">—</span>
                                                )}
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-[10px] font-bold uppercase">
                                                    Ingreso ({inv.paymentMethod})
                                                </span>
                                            </td>
                                            <td className="p-6 text-right pr-8 font-bold text-emerald-600">
                                                +{inv.amount.toFixed(2)}€
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => handleOpenEditDate('invoice', inv)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Cambiar fecha de esta factura"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                        );
                                    })}
                                    {todayExpenses.map(exp => (
                                        <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="p-6 pl-8 font-mono text-slate-500 text-xs">--:--</td>
                                            <td className="p-6 font-bold text-slate-700">
                                                {exp.description}
                                                <span className="block text-xs font-normal text-slate-400">{exp.category}</span>
                                            </td>
                                            <td className="p-6">
                                                <span className="text-xs text-slate-300">—</span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">
                                                    Gasto
                                                </span>
                                            </td>
                                            <td className="p-6 text-right pr-8 font-bold text-rose-600">
                                                -{exp.amount.toFixed(2)}€
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => handleOpenEditDate('expense', exp)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Cambiar fecha de este gasto"
                                                >
                                                    <Pencil size={13} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>

            {/* ARQUEO MODAL */}

            {showArqueoModal && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-xl w-full rounded-[2rem] shadow-2xl max-h-[90vh] flex flex-col">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-900">Arqueo de Caja</h3>
                                <p className="text-xs text-slate-400 mt-1">Cuenta el efectivo físico del cajón</p>
                            </div>
                            <button onClick={() => setShowArqueoModal(false)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6 overflow-y-auto flex-1">
                            {/* Billetes */}
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">💵 Billetes</h4>
                                <div className="space-y-2">
                                    {DENOMINATIONS.filter(d => d.type === 'billete').map(d => (
                                        <div key={d.value} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                                            <span className="text-sm font-black text-slate-700 w-14">{d.label}</span>
                                            <span className="text-xs text-slate-400 flex-1">uds.</span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={billCounts[d.value.toString()] || 0}
                                                onChange={e => setBillCounts(prev => ({
                                                    ...prev,
                                                    [d.value.toString()]: Math.max(0, parseInt(e.target.value) || 0)
                                                }))}
                                                className="w-20 text-right bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                            <span className="text-xs font-bold text-slate-500 w-20 text-right">
                                                = {(d.value * (billCounts[d.value.toString()] || 0)).toFixed(2)}€
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Monedas */}
                            <div>
                                <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest mb-3">🪙 Monedas</h4>
                                <div className="space-y-2">
                                    {DENOMINATIONS.filter(d => d.type === 'moneda').map(d => (
                                        <div key={d.value} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3">
                                            <span className="text-sm font-black text-slate-700 w-14">{d.label}</span>
                                            <span className="text-xs text-slate-400 flex-1">uds.</span>
                                            <input
                                                type="number"
                                                min={0}
                                                value={billCounts[d.value.toString()] || 0}
                                                onChange={e => setBillCounts(prev => ({
                                                    ...prev,
                                                    [d.value.toString()]: Math.max(0, parseInt(e.target.value) || 0)
                                                }))}
                                                className="w-20 text-right bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                            />
                                            <span className="text-xs font-bold text-slate-500 w-20 text-right">
                                                = {(d.value * (billCounts[d.value.toString()] || 0)).toFixed(2)}€
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Summary comparison */}
                            <div className="bg-slate-900 rounded-2xl p-6 text-white">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Físico Contado</p>
                                        <p className="text-3xl font-black mt-1">{calculatedPhysicalCash.toFixed(2)}€</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Sistema (Efectivo Neto)</p>
                                        <p className="text-xl font-black text-slate-300 mt-1">{stats.netCash.toFixed(2)}€</p>
                                        {stats.cashExpenses > 0 && (
                                            <p className="text-[10px] text-rose-300 mt-0.5">Gastos: -{stats.cashExpenses.toFixed(2)}€</p>
                                        )}
                                        <p className={`text-xs font-bold mt-1 ${Math.abs(calculatedPhysicalCash - stats.netCash) < 0.01 ? 'text-emerald-400' : calculatedPhysicalCash > stats.netCash ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {calculatedPhysicalCash >= stats.netCash ? '+' : ''}{(calculatedPhysicalCash - stats.netCash).toFixed(2)}€ diferencia
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="px-8 pb-8 pt-4 border-t border-slate-100 flex gap-4 flex-shrink-0">
                            <button onClick={() => setShowArqueoModal(false)} className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleConfirmArqueo} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-slate-800 transition-colors">
                                ✅ Confirmar Arqueo
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* DATE EDIT MODAL */}
            {editingItem && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-sm w-full rounded-[2rem] shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Cambiar Fecha</h3>
                                <p className="text-xs text-slate-400 mt-1">
                                    {editingItem.type === 'invoice'
                                        ? `Factura ${editingItem.item.invoiceNumber}`
                                        : editingItem.item.description}
                                </p>
                            </div>
                            <button onClick={() => setEditingItem(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Nueva Fecha</label>
                                <input
                                    type="date"
                                    value={editDate}
                                    onChange={e => setEditDate(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200"
                                />
                            </div>
                            <p className="text-xs text-slate-400">
                                Al cambiar la fecha, este movimiento pasará a contabilizarse en la caja del día seleccionado.
                            </p>
                        </div>
                        <div className="px-8 pb-8 pt-0 flex gap-3">
                            <button
                                onClick={() => setEditingItem(null)}
                                className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSaveDate}
                                disabled={isSavingDate || !editDate}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-colors"
                            >
                                {isSavingDate ? 'Guardando...' : '✅ Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CashRegister;
