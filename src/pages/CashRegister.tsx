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

    const recalcularArrastre = async () => {
        setIsRecalculating(true);
        setArraystreLoadError(false);
        try {
            // Refresh invoices and expenses from server for the selected day
            await refreshDayData();

            // Reload opening cash (arrastre) from the most recent prior closing
            const prev = isToday
                ? await (api as any).cashRegister.getLastClosing()
                : await (api as any).cashRegister.getLastClosingBefore(selectedDate);

            if (prev && prev.physicalCash != null) {
                setOpeningCash(prev.physicalCash);
                setArraystreLoadError(false);
            } else {
                console.warn('[Caja] recalcularArrastre: no hay cierre anterior.');
                setArraystreLoadError(true);
            }
        } catch (err: any) {
            console.error('[Caja] Error recalculando:', err);
            setArraystreLoadError(true);
        } finally {
            setIsRecalculating(false);
        }
    };

    const handleCloseRetroactive = async () => {
        if (isClosed || isToday || isClosing) return;
        const label = new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const totalCaja = (openingCash ?? 0) + stats.cashIncome - stats.cashExpenses;
        const confirmed = confirm(
            `⚠️ CIERRE RETROACTIVO — ${label}\n\n` +
            `Arrastre (caja inicial):  ${(openingCash ?? 0).toFixed(2)}€\n` +
            `+ Entradas efectivo:      ${stats.cashIncome.toFixed(2)}€\n` +
            (stats.cashExpenses > 0 ? `− Salidas efectivo:       ${stats.cashExpenses.toFixed(2)}€\n` : '') +
            `= Total caja efectivo:    ${totalCaja.toFixed(2)}€\n\n` +
            `Ingresos totales del día: ${stats.totalIncome.toFixed(2)}€\n` +
            `  · Tarjeta:   ${stats.cardIncome.toFixed(2)}€\n` +
            `  · Transfer:  ${stats.transferIncome.toFixed(2)}€\n\n` +
            `El efectivo físico se registrará como el esperado (sin arqueo posible en días pasados).\n\n` +
            `¿Confirmar cierre?`
        );
        if (!confirmed) return;
        setIsClosing(true);
        try {
            const record = await (api as any).cashRegister.close({
                date: selectedDate,
                totalIncome: stats.totalIncome,
                totalExpense: stats.totalExpense,
                balance: stats.balance,
                cashIncome: stats.cashIncome,
                cardIncome: stats.cardIncome,
                transferIncome: stats.transferIncome,
                cashExpenses: stats.cashExpenses,
                netCash: stats.netCash,
                physicalCash: totalCaja,
                cashDiff: 0,
                openingCash: openingCash ?? 0,
                invoiceCount: todayInvoices.length,
                completedAppointments: 0,
                closedBy: ((currentUser as any)?.name || 'Manual') + ' (retroactivo)',
            });
            setIsClosed(true);
            setClosingData(record);
            // Refresh arrastre on today's view if needed
            if (!isToday) recalcularArrastre();
            alert(`✅ Caja del ${label} cerrada correctamente.\nArrastre para el día siguiente: ${totalCaja.toFixed(2)}€`);
        } catch (e: any) {
            alert('❌ Error al cerrar la caja: ' + (e.message || e));
        } finally {
            setIsClosing(false);
        }
    };

    // Cash register closing state
    const [isClosed, setIsClosed] = useState(false);
    const [closingData, setClosingData] = useState<any>(null);
    const [isClosing, setIsClosing] = useState(false);

    // Opening cash (arrastre from previous day)
    const [openingCash, setOpeningCash] = useState<number | null>(null);
    const [arrastreLoadError, setArraystreLoadError] = useState(false);
    const [isRecalculating, setIsRecalculating] = useState(false);

    // Stats for SELECTED DATE
    const [todayInvoices, setTodayInvoices] = useState<any[]>([]);
    const [todayExpenses, setTodayExpenses] = useState<any[]>([]);
    // Partial payments (Payment records without an invoiceId) for the selected date
    const [todayPartialPayments, setTodayPartialPayments] = useState<any[]>([]);

    // Date edit modal
    // Invoice full edit modal (replaces separate date + method modals)
    const [editingInvoiceFull, setEditingInvoiceFull] = useState<any | null>(null);
    const [editFullDate, setEditFullDate] = useState('');
    const [editFullConcept, setEditFullConcept] = useState('');
    const [editFullPatientId, setEditFullPatientId] = useState('');
    const [editFullAmount, setEditFullAmount] = useState('');
    const [editFullMethod, setEditFullMethod] = useState('cash');
    const [isSavingFull, setIsSavingFull] = useState(false);

    // Expense full edit modal
    const [editingExpenseFull, setEditingExpenseFull] = useState<any | null>(null);
    const [editExpDate, setEditExpDate] = useState('');
    const [editExpDescription, setEditExpDescription] = useState('');
    const [editExpCategory, setEditExpCategory] = useState('');
    const [editExpAmount, setEditExpAmount] = useState('');
    const [editExpPaymentMethod, setEditExpPaymentMethod] = useState('cash');
    const [isSavingExp, setIsSavingExp] = useState(false);

    const handleOpenEditInvoice = (inv: any) => {
        setEditFullDate(inv.date ? inv.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setEditFullConcept(inv.concept || '');
        setEditFullPatientId(inv.patientId || '');
        setEditFullAmount(String(inv.amount ?? 0));
        setEditFullMethod((inv.paymentMethod || 'cash').toLowerCase());
        setEditingInvoiceFull(inv);
    };

    const handleOpenEditExpense = (exp: any) => {
        setEditExpDate(exp.date ? exp.date.split('T')[0] : new Date().toISOString().split('T')[0]);
        setEditExpDescription(exp.description || '');
        setEditExpCategory(exp.category || '');
        setEditExpAmount(String(exp.amount ?? 0));
        setEditExpPaymentMethod(exp.paymentMethod || 'cash');
        setEditingExpenseFull(exp);
    };

    const refreshDayData = async () => {
        const freshInvoices = await (api as any).invoices.getAll().catch(() => []);
        const freshExpenses = await (api as any).expenses.getAll().catch(() => []);
        setTodayInvoices(freshInvoices.filter((i: any) =>
            i.date && i.date.split('T')[0] === selectedDate &&
            !['rectified', 'pending', 'refunded'].includes((i.status || '').toLowerCase())
        ));
        setTodayExpenses(freshExpenses.filter((e: any) =>
            e.date && e.date.split('T')[0] === selectedDate
        ));
    };

    const handleSaveInvoiceEdit = async () => {
        if (!editingInvoiceFull) return;
        setIsSavingFull(true);
        try {
            await (api as any).invoices.update(editingInvoiceFull.id, {
                date: editFullDate,
                concept: editFullConcept,
                patientId: editFullPatientId || undefined,
                amount: parseFloat(editFullAmount),
                paymentMethod: editFullMethod,
            });
            await refreshDayData();
            setEditingInvoiceFull(null);
        } catch (e: any) {
            alert('❌ Error al guardar: ' + (e.message || e));
        } finally {
            setIsSavingFull(false);
        }
    };

    const handleSaveExpenseEdit = async () => {
        if (!editingExpenseFull) return;
        setIsSavingExp(true);
        try {
            await (api as any).expenses.update(editingExpenseFull.id, {
                date: editExpDate,
                description: editExpDescription,
                category: editExpCategory,
                amount: parseFloat(editExpAmount),
                paymentMethod: editExpPaymentMethod,
            });
            await refreshDayData();
            setEditingExpenseFull(null);
        } catch (e: any) {
            alert('❌ Error al guardar: ' + (e.message || e));
        } finally {
            setIsSavingExp(false);
        }
    };

    useEffect(() => {
        // Fast path: filter from context cache for instant render
        setTodayInvoices(invoices.filter(i =>
            i.date && i.date.split('T')[0] === selectedDate &&
            !['rectified', 'pending', 'refunded'].includes((i.status || '').toLowerCase())
        ));
        setTodayExpenses(expenses.filter(e =>
            e.date && e.date.split('T')[0] === selectedDate
        ));

        // Fresh API fetch — ensures backdated payments always appear, bypassing stale cache
        let cancelled = false;
        (api as any).invoices.getAll().then((freshInvoices: any[]) => {
            if (cancelled) return;
            const dayInvoices = freshInvoices.filter((i: any) =>
                i.date && i.date.split('T')[0] === selectedDate &&
                !['rectified', 'pending', 'refunded'].includes((i.status || '').toLowerCase())
            );
            setTodayInvoices(dayInvoices);

            // Exclude partial payments for appointments that already have a final invoice
            // to avoid double-counting (e.g. partial 50€ cash + invoice 150€ for same appointment)
            const apptIdsWithFinalInvoice = new Set(
                dayInvoices
                    .filter((i: any) => i.status === 'issued' && i.appointmentId)
                    .map((i: any) => i.appointmentId)
            );
            api.payments.getAll().then((allPayments: any[]) => {
                if (cancelled) return;
                const partial = allPayments.filter((p: any) =>
                    !p.invoiceId &&
                    p.createdAt && p.createdAt.split('T')[0] === selectedDate &&
                    p.type !== 'ADVANCE_PAYMENT' &&
                    !(p.appointmentId && apptIdsWithFinalInvoice.has(p.appointmentId))
                );
                setTodayPartialPayments(partial);
            }).catch(() => setTodayPartialPayments([]));
        }).catch(() => {
            // Fallback: just fetch partial payments without final-invoice filtering
            api.payments.getAll().then((allPayments: any[]) => {
                if (cancelled) return;
                const partial = allPayments.filter((p: any) =>
                    !p.invoiceId &&
                    p.createdAt && p.createdAt.split('T')[0] === selectedDate &&
                    p.type !== 'ADVANCE_PAYMENT'
                );
                setTodayPartialPayments(partial);
            }).catch(() => setTodayPartialPayments([]));
        });
        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDate]);

    // Load closing status for selected date + openingCash (arrastre)
    useEffect(() => {
        setIsClosed(false);
        setClosingData(null);
        setOpeningCash(null);
        setArraystreLoadError(false);

        const call = isToday
            ? (api as any).cashRegister.getToday()
            : (api as any).cashRegister.getByDate(selectedDate);

        call.then((data: any) => {
            if (data) {
                setIsClosed(true);
                setClosingData(data);
                // If this day is already closed, use saved openingCash
                if (data.openingCash != null) {
                    setOpeningCash(data.openingCash);
                    return;
                }
            }
            // Load previous day's physicalCash as openingCash (arrastre)
            // For past dates we look at the closing of the day before selectedDate
            if (isToday) {
                (api as any).cashRegister.getLastClosing().then((prev: any) => {
                    if (prev && prev.physicalCash != null) {
                        setOpeningCash(prev.physicalCash);
                        setArraystreLoadError(false);
                    } else {
                        console.warn('[Caja] No hay cierre anterior. El arrastre no pudo cargarse.');
                        setArraystreLoadError(true);
                    }
                }).catch((err: any) => {
                    console.error('[Caja] Error cargando arrastre (getLastClosing):', err);
                    setArraystreLoadError(true);
                });
            } else {
                // For a past date, find the most recent closing before selectedDate
                // (handles gaps: weekends, holidays, days with no activity)
                (api as any).cashRegister.getLastClosingBefore(selectedDate).then((prev: any) => {
                    if (prev && prev.physicalCash != null) {
                        setOpeningCash(prev.physicalCash);
                        setArraystreLoadError(false);
                    } else {
                        console.warn('[Caja] No hay cierre anterior a', selectedDate, '. El arrastre no pudo cargarse.');
                        setArraystreLoadError(true);
                    }
                }).catch((err: any) => {
                    console.error('[Caja] Error cargando arrastre (getLastClosingBefore):', err);
                    setArraystreLoadError(true);
                });
            }
        }).catch((err: any) => {
            console.error('[Caja] Error cargando estado del cierre:', err);
            setArraystreLoadError(true);
        });
    }, [selectedDate]);

    const stats = React.useMemo(() => {
        // Helper: extract cash/card/transfer amounts from an invoice, respecting paymentBreakdown for mixed invoices
        const invoiceMethodAmounts = (inv: any) => {
            if (inv.paymentMethod === 'mixed' && Array.isArray(inv.paymentBreakdown)) {
                return inv.paymentBreakdown as { method: string; amount: number }[];
            }
            return [{ method: inv.paymentMethod, amount: inv.amount }];
        };

        const invoiceEntries = todayInvoices.flatMap(invoiceMethodAmounts);

        const invoiceCash     = invoiceEntries.filter(e => e.method === 'cash').reduce((s, e) => s + e.amount, 0);
        const invoiceCard     = invoiceEntries.filter(e => e.method === 'card').reduce((s, e) => s + e.amount, 0);
        const invoiceTransfer = invoiceEntries.filter(e => e.method === 'transfer').reduce((s, e) => s + e.amount, 0);
        const totalInvoiceIncome = todayInvoices.reduce((acc, curr) => acc + curr.amount, 0);

        // Partial payments (no invoice yet) — each has a single method
        const partialCash     = todayPartialPayments.filter(p => p.method === 'cash').reduce((s, p) => s + Number(p.amount), 0);
        const partialCard     = todayPartialPayments.filter(p => p.method === 'card').reduce((s, p) => s + Number(p.amount), 0);
        const partialTransfer = todayPartialPayments.filter(p => p.method === 'transfer').reduce((s, p) => s + Number(p.amount), 0);
        const totalPartialIncome = todayPartialPayments.reduce((s, p) => s + Number(p.amount), 0);

        const cashIncome     = invoiceCash + partialCash;
        const cardIncome     = invoiceCard + partialCard;
        const transferIncome = invoiceTransfer + partialTransfer;
        const totalIncome    = totalInvoiceIncome + totalPartialIncome;

        const totalExpense   = todayExpenses.reduce((acc, curr) => acc + curr.amount, 0);
        // Treat null/undefined paymentMethod as 'cash' — cash withdrawals (retiradas) may lack an explicit method
        const cashExpenses   = todayExpenses.filter(e => !e.paymentMethod || e.paymentMethod === 'cash').reduce((acc, curr) => acc + curr.amount, 0);
        const netCash        = cashIncome - cashExpenses;
        // expectedCash = arrastre + solo efectivo de hoy (para arqueo físico)
        const expectedCash   = (openingCash ?? 0) + netCash;
        // totalCaja = arrastre + TODOS los ingresos del día (efectivo + tarjeta + transferencia)
        const totalCaja      = (openingCash ?? 0) + totalIncome - cashExpenses;

        return { totalIncome, totalExpense, cashIncome, cardIncome, transferIncome, cashExpenses, netCash, expectedCash, totalCaja, balance: totalIncome - totalExpense };
    }, [todayInvoices, todayPartialPayments, todayExpenses, openingCash]);


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

        const cashDiff = physicalCashTotal - stats.expectedCash;
        const diffLabel = Math.abs(cashDiff) < 0.01
            ? '✅ Cuadra exactamente'
            : cashDiff > 0
                ? `📈 Sobrante: +${cashDiff.toFixed(2)}€`
                : `📉 Faltante: ${cashDiff.toFixed(2)}€`;

        const summary =
            `✅ CIERRE DE CAJA — ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES')}\n\n` +
            `🏦 Caja efectivo:\n` +
            (openingCash != null ? `  Arrastre (caja inicial): ${openingCash.toFixed(2)}€\n` : '') +
            `  + Efectivo ingresos:     ${stats.cashIncome.toFixed(2)}€\n` +
            (stats.cashExpenses > 0 ? `  - Gastos efectivo:       ${stats.cashExpenses.toFixed(2)}€\n` : '') +
            `  = Efectivo esperado:     ${stats.expectedCash.toFixed(2)}€\n` +
            `  Físico contado:          ${physicalCashTotal.toFixed(2)}€\n` +
            `  Diferencia (cuadre):     ${diffLabel}\n\n` +
            `📊 Balance del día:\n` +
            `  Ingresos totales:   ${stats.totalIncome.toFixed(2)}€\n` +
            `  Gastos totales:     ${stats.totalExpense.toFixed(2)}€\n` +
            `  Tarjeta:            ${stats.cardIncome.toFixed(2)}€\n` +
            `  Transferencia:      ${stats.transferIncome.toFixed(2)}€\n` +
            `  Balance neto:       ${stats.balance.toFixed(2)}€\n\n` +
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

                const cashDiff = physicalCashTotal - stats.expectedCash;
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
                    openingCash: openingCash ?? 0,
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
                    <div className="col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-8 border-b border-slate-100">
                            <h4 className="text-sm font-bold uppercase tracking-widest text-slate-900 flex items-center gap-3">
                                <BarChart3 className="text-blue-500" /> {isToday ? 'Movimientos de Hoy' : `Movimientos del ${new Date(selectedDate + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`}
                            </h4>
                        </div>

                        {/* Top row: income / expenses */}
                        <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
                            <div className="p-8 border-r border-slate-100">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Ingresos del Día</p>
                                <p className="text-3xl font-black text-emerald-500">+{stats.totalIncome.toFixed(2)}€</p>
                                <div className="mt-4 space-y-1.5">
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-medium">💵 Efectivo</span>
                                        <span className="font-bold text-slate-700">{stats.cashIncome.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-medium">💳 Tarjeta</span>
                                        <span className="font-bold text-slate-700">{stats.cardIncome.toFixed(2)}€</span>
                                    </div>
                                    <div className="flex justify-between text-xs">
                                        <span className="text-slate-400 font-medium">🏦 Transferencia</span>
                                        <span className="font-bold text-slate-700">{stats.transferIncome.toFixed(2)}€</span>
                                    </div>
                                </div>
                            </div>
                            <div className="p-8">
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Gastos del Día</p>
                                <p className="text-3xl font-black text-rose-500">-{stats.totalExpense.toFixed(2)}€</p>
                                {stats.cashExpenses > 0 && (
                                    <div className="mt-4 space-y-1.5">
                                        <div className="flex justify-between text-xs">
                                            <span className="text-slate-400 font-medium">💵 Efectivo</span>
                                            <span className="font-bold text-rose-600">-{stats.cashExpenses.toFixed(2)}€</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Resumen Caja Efectivo */}
                        <div className="p-8 bg-slate-50">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-5">Resumen Caja Efectivo</p>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm text-slate-600 font-medium">Arrastre (caja inicial)</span>
                                        {!isClosed && (
                                            <button
                                                onClick={recalcularArrastre}
                                                disabled={isRecalculating}
                                                title="Recalcular arrastre y actualizar cobros del día"
                                                className={`text-[10px] underline transition-colors leading-none ${isRecalculating ? 'text-amber-500 opacity-60 cursor-wait' : 'text-slate-400 hover:text-amber-600'}`}
                                            >
                                                {isRecalculating ? '↻ actualizando...' : '↺ recalcular'}
                                            </button>
                                        )}
                                    </div>
                                    <span className="text-sm font-black text-amber-600">
                                        {openingCash != null ? `${openingCash.toFixed(2)}€` : '—'}
                                    </span>
                                </div>
                                {arrastreLoadError && (
                                    <p className="text-[10px] text-rose-500 font-bold mt-1">
                                        ⚠ No se pudo cargar el arrastre. Haz clic en &ldquo;↺ recalcular&rdquo; o verifica que el día anterior tenga cierre registrado.
                                    </p>
                                )}
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-slate-600 font-medium">+ Entradas efectivo</span>
                                    <span className="text-sm font-black text-emerald-600">+{stats.cashIncome.toFixed(2)}€</span>
                                </div>
                                {stats.cardIncome > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 font-medium">+ Ingresos tarjeta</span>
                                        <span className="text-sm font-black text-emerald-600">+{stats.cardIncome.toFixed(2)}€</span>
                                    </div>
                                )}
                                {stats.transferIncome > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 font-medium">+ Transferencias</span>
                                        <span className="text-sm font-black text-emerald-600">+{stats.transferIncome.toFixed(2)}€</span>
                                    </div>
                                )}
                                {stats.cashExpenses > 0 && (
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600 font-medium">− Salidas efectivo</span>
                                        <span className="text-sm font-black text-rose-600">-{stats.cashExpenses.toFixed(2)}€</span>
                                    </div>
                                )}
                                {arqueoCompleted && (
                                    <>
                                        <div className="border-t border-slate-200 pt-3 flex justify-between items-center">
                                            <span className="text-sm text-slate-600 font-medium">Efectivo esperado</span>
                                            <span className="text-sm font-black text-slate-800">{stats.expectedCash.toFixed(2)}€</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-slate-600 font-medium">Cuadre (físico contado)</span>
                                            <span className={`text-sm font-black ${Math.abs(physicalCashTotal - stats.expectedCash) < 0.01 ? 'text-emerald-600' : physicalCashTotal > stats.expectedCash ? 'text-amber-600' : 'text-rose-600'}`}>
                                                {physicalCashTotal > stats.expectedCash ? '+' : ''}{(physicalCashTotal - stats.expectedCash).toFixed(2)}€
                                            </span>
                                        </div>
                                    </>
                                )}
                                <div className="border-t-2 border-slate-300 pt-3 flex justify-between items-center">
                                    <span className="text-sm font-black text-slate-900 uppercase tracking-wide">Total Caja</span>
                                    <span className="text-xl font-black text-slate-900">
                                        {arqueoCompleted ? physicalCashTotal.toFixed(2) : stats.totalCaja.toFixed(2)}€
                                    </span>
                                </div>
                                {arqueoCompleted && (
                                    <p className="text-[10px] text-slate-400">* Total Caja = efectivo físico contado en el arqueo</p>
                                )}
                            </div>

                            {/* Balance neto general */}
                            <div className="mt-6 pt-5 border-t border-slate-200 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Balance Neto del Día</span>
                                <span className={`text-lg font-black ${stats.balance >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                    {stats.balance > 0 ? '+' : ''}{stats.balance.toFixed(2)}€
                                </span>
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
                            {isToday ? (
                                <button
                                    onClick={handleCloseCashRegister}
                                    disabled={!arqueoCompleted || isClosed || isClosing}
                                    className="w-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2 group"
                                >
                                    <DollarSign size={16} className="group-hover:rotate-12 transition-transform" />
                                    {isClosing ? 'Guardando...' : isClosed ? 'Caja Cerrada' : 'Cerrar Caja del Día'}
                                </button>
                            ) : !isClosed ? (
                                <button
                                    onClick={handleCloseRetroactive}
                                    disabled={isClosing}
                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:from-slate-700 disabled:to-slate-600 disabled:cursor-not-allowed text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <DollarSign size={16} />
                                    {isClosing ? 'Guardando...' : 'Cerrar Caja de Este Día'}
                                </button>
                            ) : null}
                        </div>
                    </div>
                </div>

                {/* Today's Transactions List */}
                <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="p-8 border-b border-slate-100 bg-slate-50/50">
                        <h4 className="text-sm font-bold uppercase tracking-widest text-slate-800">Transacciones del Día</h4>
                    </div>
                    {todayInvoices.length === 0 && todayExpenses.length === 0 && todayPartialPayments.length === 0 ? (
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
                                        <th className="p-6">Tratamiento</th>
                                        <th className="p-6">Doctor</th>
                                        <th className="p-6 text-center">Tipo</th>
                                        <th className="p-6 text-right pr-8">Importe</th>
                                        <th className="p-6 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 text-sm">
                                    {/* Partial payments (no invoice yet) */}
                                    {todayPartialPayments.map(p => {
                                        const pat = patients.find(pt => pt.id === p.patientId);
                                        const appt = appointments.find(a => a.id === p.appointmentId);
                                        const doc = appt ? doctors.find(d => d.id === appt.doctorId) : null;
                                        const methodLabel = p.method === 'cash' ? 'Efectivo' : p.method === 'card' ? 'Tarjeta' : p.method === 'transfer' ? 'Transferencia' : p.method;
                                        return (
                                            <tr key={p.id} className="hover:bg-amber-50/40 transition-colors bg-amber-50/20">
                                                <td className="p-6 pl-8 font-mono text-slate-500 text-xs">
                                                    {p.createdAt ? new Date(p.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                                </td>
                                                <td className="p-6 font-bold text-amber-700">
                                                    Pago Parcial
                                                    <span className="block text-xs font-normal text-slate-400">
                                                        {pat?.name || 'Paciente'}
                                                    </span>
                                                </td>
                                                <td className="p-6 max-w-[180px]">
                                                    {(p.treatmentName || appt?.treatmentName)
                                                        ? <>
                                                            <span className="text-xs font-medium text-slate-600 line-clamp-2">{p.treatmentName || appt?.treatmentName}</span>
                                                            {p.notes && p.notes.startsWith('[PDTE:') && (
                                                                <span className="block text-[10px] text-amber-600 font-medium mt-0.5 line-clamp-1">
                                                                    {p.notes.replace('[PDTE:', 'Pdte:').replace(']', '')}
                                                                </span>
                                                            )}
                                                          </>
                                                        : <span className="text-xs text-slate-300">—</span>}
                                                </td>
                                                <td className="p-6">
                                                    {doc
                                                        ? <span className="text-xs font-bold text-violet-700">{doc.name}</span>
                                                        : <span className="text-xs text-slate-300">—</span>}
                                                </td>
                                                <td className="p-6 text-center">
                                                    <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[10px] font-bold uppercase">
                                                        Parcial ({methodLabel})
                                                    </span>
                                                </td>
                                                <td className="p-6 text-right pr-8 font-bold text-amber-600">
                                                    +{Number(p.amount).toFixed(2)}€
                                                </td>
                                                <td className="p-2"></td>
                                            </tr>
                                        );
                                    })}
                                    {todayInvoices.map(inv => {
                                        const appt = appointments.find(a => a.id === inv.appointmentId);
                                        const doctor = appt ? doctors.find(d => d.id === appt.doctorId) : null;
                                        // For mixed-method consolidated invoices show each breakdown as sub-label
                                        const methodLabel = inv.paymentMethod === 'mixed' && Array.isArray(inv.paymentBreakdown)
                                            ? inv.paymentBreakdown.map((b: any) => `${Number(b.amount).toFixed(2)}€ ${b.method === 'cash' ? 'Efectivo' : b.method === 'card' ? 'Tarjeta' : b.method === 'transfer' ? 'Transferencia' : b.method}`).join(' + ')
                                            : inv.paymentMethod;
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
                                            <td className="p-6 max-w-[180px]">
                                                {(() => {
                                                    const itemNames = Array.isArray(inv.items) && inv.items.length > 0
                                                        ? inv.items.map((it: any) => it.name).filter(Boolean)
                                                        : [];
                                                    const label = itemNames.length > 0
                                                        ? itemNames.join(' · ')
                                                        : inv.concept || appt?.treatmentName || null;
                                                    return label
                                                        ? <span className="text-xs font-medium text-slate-600 leading-relaxed line-clamp-2">{label}</span>
                                                        : <span className="text-xs text-slate-300">—</span>;
                                                })()}
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
                                                    Ingreso ({methodLabel})
                                                </span>
                                            </td>
                                            <td className="p-6 text-right pr-8 font-bold text-emerald-600">
                                                +{inv.amount.toFixed(2)}€
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => handleOpenEditInvoice(inv)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar factura"
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
                                            <td className="p-6">
                                                <span className="text-xs text-slate-300">—</span>
                                            </td>
                                            <td className="p-6 text-center">
                                                <span className="px-3 py-1 bg-rose-100 text-rose-700 rounded-full text-[10px] font-bold uppercase">
                                                    {(() => {
                                                        const m = exp.paymentMethod;
                                                        const label = m === 'card' ? 'Tarjeta' : m === 'transfer' ? 'Transfer' : m === 'domiciliacion' ? 'Domicil.' : 'Efectivo';
                                                        return `Gasto (${label})`;
                                                    })()}
                                                </span>
                                            </td>
                                            <td className="p-6 text-right pr-8 font-bold text-rose-600">
                                                -{exp.amount.toFixed(2)}€
                                            </td>
                                            <td className="p-2">
                                                <button
                                                    onClick={() => handleOpenEditExpense(exp)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="Editar gasto"
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
                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Efectivo Esperado</p>
                                        <p className="text-xl font-black text-slate-300 mt-1">{stats.expectedCash.toFixed(2)}€</p>
                                        <p className="text-[10px] text-slate-500 mt-0.5">
                                            {openingCash != null ? `Arrastre ${openingCash.toFixed(2)}€` : 'Sin arrastre'}
                                            {' + '}neto {stats.netCash.toFixed(2)}€
                                        </p>
                                        <p className={`text-xs font-bold mt-1 ${Math.abs(calculatedPhysicalCash - stats.expectedCash) < 0.01 ? 'text-emerald-400' : calculatedPhysicalCash > stats.expectedCash ? 'text-amber-400' : 'text-rose-400'}`}>
                                            {calculatedPhysicalCash >= stats.expectedCash ? '+' : ''}{(calculatedPhysicalCash - stats.expectedCash).toFixed(2)}€ diferencia (cuadre)
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
            {/* INVOICE FULL EDIT MODAL */}
            {editingInvoiceFull && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-lg w-full rounded-[2rem] shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Editar Factura</h3>
                                <p className="text-xs text-slate-400 mt-1">{editingInvoiceFull.invoiceNumber}</p>
                            </div>
                            <button onClick={() => setEditingInvoiceFull(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Concepto</label>
                                <input type="text" value={editFullConcept} onChange={e => setEditFullConcept(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Paciente</label>
                                <select value={editFullPatientId} onChange={e => setEditFullPatientId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                                    style={{ colorScheme: 'light' }}>
                                    <option value="">— Sin cambio —</option>
                                    {(patients as any[]).sort((a: any, b: any) => (a.name || '').localeCompare(b.name || '')).map((p: any) => (
                                        <option key={p.id} value={p.id}>{p.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Importe (€)</label>
                                    <input type="number" step="0.01" min="0" value={editFullAmount} onChange={e => setEditFullAmount(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Fecha</label>
                                    <input type="date" value={editFullDate} onChange={e => setEditFullDate(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Método de Pago</label>
                                <div className="flex gap-2">
                                    {[{ value: 'cash', label: '💵 Efectivo' }, { value: 'card', label: '💳 Tarjeta' }, { value: 'transfer', label: '🏦 Transferencia' }].map(opt => (
                                        <button key={opt.value} onClick={() => setEditFullMethod(opt.value)}
                                            className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-colors ${editFullMethod === opt.value ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:border-slate-400'}`}>
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-8 pb-8 pt-0 flex gap-3">
                            <button onClick={() => setEditingInvoiceFull(null)} className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveInvoiceEdit} disabled={isSavingFull}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
                                {isSavingFull ? 'Guardando...' : '✅ Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* EXPENSE FULL EDIT MODAL */}
            {editingExpenseFull && (
                <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm z-[110] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-md w-full rounded-[2rem] shadow-2xl">
                        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-slate-900">Editar Gasto</h3>
                                <p className="text-xs text-slate-400 mt-1">{editingExpenseFull.description}</p>
                            </div>
                            <button onClick={() => setEditingExpenseFull(null)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Descripción</label>
                                <input type="text" value={editExpDescription} onChange={e => setEditExpDescription(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Categoría</label>
                                <input type="text" value={editExpCategory} onChange={e => setEditExpCategory(e.target.value)}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Importe (€)</label>
                                    <input type="number" step="0.01" min="0" value={editExpAmount} onChange={e => setEditExpAmount(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Fecha</label>
                                    <input type="date" value={editExpDate} onChange={e => setEditExpDate(e.target.value)}
                                        className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-200" />
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest block mb-2">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {(['cash', 'card', 'transfer', 'domiciliacion'] as const).map(m => (
                                        <button key={m} type="button"
                                            onClick={() => setEditExpPaymentMethod(m)}
                                            className={`py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wide border-2 transition-colors ${
                                                editExpPaymentMethod === m
                                                    ? 'bg-slate-900 text-white border-slate-900'
                                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                            }`}>
                                            {m === 'cash' ? '💵 Efectivo' : m === 'card' ? '💳 Tarjeta' : m === 'transfer' ? '🏦 Transfer' : '🏢 Domicil.'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                        <div className="px-8 pb-8 pt-0 flex gap-3">
                            <button onClick={() => setEditingExpenseFull(null)} className="flex-1 py-3 text-slate-500 font-bold text-sm hover:bg-slate-50 rounded-xl transition-colors">
                                Cancelar
                            </button>
                            <button onClick={handleSaveExpenseEdit} disabled={isSavingExp}
                                className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-black text-sm uppercase shadow-lg hover:bg-slate-800 disabled:opacity-50 transition-colors">
                                {isSavingExp ? 'Guardando...' : '✅ Guardar'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default CashRegister;
