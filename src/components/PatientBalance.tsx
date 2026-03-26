import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Send } from 'lucide-react';

interface PatientBalanceProps {
    patientId: string;
    onAddBalance?: () => void;
    onUseBalance?: () => void;
}

export const PatientBalance: React.FC<PatientBalanceProps> = ({
    patientId,
    onAddBalance,
    onUseBalance
}) => {
    const [balance, setBalance] = useState<number>(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadBalance = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api/patients/${patientId}/balance`);
            const data = await response.json();
            setBalance(data.balance || 0);
            setError(null);
        } catch (err) {
            console.error('Error loading balance:', err);
            setError('Error al cargar saldo');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadBalance();
    }, [patientId]);

    if (loading) {
        return (
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 animate-pulse">
                <div className="h-6 bg-emerald-200 rounded w-1/3 mb-4"></div>
                <div className="h-10 bg-emerald-200 rounded w-1/2"></div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-6">
                <p className="text-red-600 font-semibold text-sm">{error}</p>
            </div>
        );
    }

    if (balance <= 0) {
        return (
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-300 rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-slate-300 rounded-lg flex items-center justify-center">
                        <Wallet size={20} className="text-slate-400" />
                    </div>
                    <div>
                        <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Saldo a Favor</p>
                        <p className="text-sm text-slate-600 font-semibold">Sin saldo disponible</p>
                    </div>
                </div>
                <button
                    onClick={onAddBalance}
                    className="w-full bg-white border border-slate-300 text-slate-600 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-50 transition-colors"
                >
                    <Plus size={14} className="inline mr-2" />
                    Añadir Saldo
                </button>
            </div>
        );
    }

    return (
        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-300 rounded-2xl p-6 mb-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                    <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/30">
                        <Wallet size={24} className="text-white" />
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase text-emerald-600 tracking-wider mb-1">Saldo a Favor</p>
                        <p className="text-4xl font-black text-emerald-700">{balance.toFixed(2)}€</p>
                        <p className="text-xs text-emerald-600 mt-2 font-semibold">Disponible para usar en próximas citas</p>
                    </div>
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        onClick={onUseBalance}
                        className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors shadow-md shadow-emerald-500/20"
                    >
                        <Send size={14} />
                        Usar Saldo
                    </button>
                    <button
                        onClick={onAddBalance}
                        className="bg-white hover:bg-emerald-50 text-emerald-600 border border-emerald-300 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors"
                    >
                        <Plus size={14} />
                        Añadir Saldo
                    </button>
                </div>
            </div>
        </div>
    );
};
    onClose,
    patient,
    budgets,
    onPaymentComplete,
    appointment,
    defaultAmount,
    defaultConcept
}) => {
    const isDirectPayment = !!appointment || (!!defaultAmount && defaultAmount > 0);

    const [totalAmount, setTotalAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [originalAmount, setOriginalAmount] = useState(0); // Locked original treatment cost
    const [selectedBudgetId, setSelectedBudgetId] = useState<string>('');
    const [doctors, setDoctors] = useState<any[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

    // Combined payment state
    const [useCombinedPayment, setUseCombinedPayment] = useState(false);
    const [primaryMethod, setPrimaryMethod] = useState<'cash' | 'card' | 'transfer' | 'wallet'>('card');
    const [splits, setSplits] = useState<PaymentSplit[]>([]);
    const [walletAmount, setWalletAmount] = useState('');

    const availableWallet = patient.wallet || 0;

    useEffect(() => {
        if (isOpen) {
            const amt = defaultAmount ? defaultAmount.toString() : '';
            setTotalAmount(amt);
            setOriginalAmount(defaultAmount || 0);
            setConcept(defaultConcept || (appointment ? `Pago Cita ${appointment.date}` : 'Anticipo / Saldo de Cuenta'));
            setPrimaryMethod('card');
            setNotes('');
            setUseCombinedPayment(false);
            setSplits([]);
            setWalletAmount('');
            setSelectedBudgetId('');
            setSelectedDoctorId('');

            // Fetch doctors if no appointment is linked to allow attribution
            if (!appointment) {
                api.getDoctors().then(setDoctors).catch(console.error);
            }
        }
    }, [isOpen, defaultAmount, defaultConcept, appointment]);

    // Auto-suggest wallet split when patient has balance and it's a direct payment
    useEffect(() => {
        if (useCombinedPayment && availableWallet > 0 && isDirectPayment) {
            const total = parseFloat(totalAmount) || 0;
            const walletUse = Math.min(availableWallet, total);
            setWalletAmount(walletUse.toString());
        }
    }, [useCombinedPayment]);

    const getPaymentBreakdown = (): PaymentSplit[] => {
        if (!useCombinedPayment) {
            return [{ method: primaryMethod, amount: parseFloat(totalAmount) || 0 }];
        }
        const walletAmt = parseFloat(walletAmount) || 0;
        const total = parseFloat(totalAmount) || 0;
        const remaining = total - walletAmt;

        const breakdown: PaymentSplit[] = [];
        if (walletAmt > 0) breakdown.push({ method: 'wallet', amount: walletAmt });
        if (remaining > 0) breakdown.push({ method: primaryMethod === 'wallet' ? 'card' : primaryMethod, amount: remaining });
        return breakdown;
    };

    const handleSubmit = async () => {
        const numericAmount = parseFloat(totalAmount);
        if (!numericAmount || numericAmount <= 0) {
            alert('Introduce un importe válido');
            return;
        }
        if (!concept) {
            alert('Introduce un concepto');
            return;
        }

        if (isDirectPayment && !appointment && !selectedDoctorId) {
            alert('Por favor, selecciona el doctor responsable para registrar la comisión correctamente.');
            return;
        }

        const breakdown = getPaymentBreakdown();
        const walletUsed = breakdown.find(b => b.method === 'wallet');
        if (walletUsed && walletUsed.amount > availableWallet) {
            alert(`Saldo insuficiente en monedero (${availableWallet.toFixed(2)}€ disponibles)`);
            return;
        }

        // Check total matches
        const breakdownTotal = breakdown.reduce((sum, b) => sum + b.amount, 0);
        if (Math.abs(breakdownTotal - numericAmount) > 0.01) {
            alert('El desglose no coincide con el total');
            return;
        }

        setIsProcessing(true);

        try {
            // Determine primary method for invoice
            const mainMethod = breakdown.length === 1 ? breakdown[0].method :
                breakdown.sort((a, b) => b.amount - a.amount)[0].method;

            const isPartialPayment = isDirectPayment && originalAmount > 0 && numericAmount < originalAmount;

            const paymentData = {
                patientId: patient.id,
                amount: numericAmount,
                method: mainMethod,
                type: isDirectPayment ? ('DIRECT_CHARGE' as const) : ('ADVANCE_PAYMENT' as const),
                appointmentId: appointment?.id,
                doctorId: appointment?.doctorId || selectedDoctorId,
                treatmentName: concept,
                notes: notes || undefined,
                isPartial: isPartialPayment,
                originalAmount: isPartialPayment ? originalAmount : undefined,
            };

            const response = await api.payments.create(paymentData) as any;

            if (!response) {
                throw new Error("No se recibió respuesta del servidor");
            }

            const pdfUrl = response?.pdfUrl || response?.invoice?.url;

            const payment: Payment = {
                id: `pay_${Date.now()}`,
                patientId: patient.id,
                amount: numericAmount,
                method: mainMethod,
                type: isDirectPayment ? 'DIRECT_CHARGE' : 'ADVANCE_PAYMENT',
                paymentBreakdown: breakdown,
                notes: notes || undefined,
                createdAt: new Date().toISOString(),
                budgetId: appointment?.budgetId
            };

            if (appointment) {
                await api.appointments.update(appointment.id, {
                    paid: !isPartialPayment,
                    status: isPartialPayment ? 'EN_PROCESO' : 'COMPLETADO'
                });
            }

            onPaymentComplete(payment, response);

            alert(`✅ Operación realizada con éxito.${breakdown.length > 1 ? `\n\nDesglose:\n${breakdown.map(b => `  ${METHOD_LABELS[b.method]}: ${b.amount.toFixed(2)}€`).join('\n')}` : ''}`);

            if (pdfUrl) {
                window.open(pdfUrl, '_blank');
            }

            onClose();
        } catch (error: any) {
            console.error('Error al procesar:', error);
            alert('❌ Error: ' + (error.message || 'Error desconocido'));
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    // Guard: If appointment is already paid, show a message instead of the form
    if (appointment?.paid) {
        return (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
                <div className="bg-white max-w-md w-full rounded-[2.5rem] shadow-2xl p-10 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                        <Check size={40} className="text-green-600" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-900">Ya Cobrado</h3>
                    <p className="text-sm text-slate-500">Esta cita ya ha sido cobrada. No se puede volver a procesar el pago.</p>
                    <button onClick={onClose} className="w-full bg-slate-900 text-white py-4 rounded-xl text-sm font-black uppercase">
                        Cerrar
                    </button>
                </div>
            </div>
        );
    }

    const numericTotal = parseFloat(totalAmount) || 0;
    const walletAmt = parseFloat(walletAmount) || 0;
    const remainingAfterWallet = numericTotal - walletAmt;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">

                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-700 p-8 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">
                            {isDirectPayment ? 'Cobrar / Pagar' : 'Añadir Saldo a Cuenta'}
                        </h2>
                        <p className="text-sm text-slate-300 mt-1">
                            Paciente: <strong>{patient.name}</strong> | Saldo Monedero: <strong>{availableWallet.toFixed(2)}€</strong>
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    {/* Budget Selection */}
                    {budgets && budgets.length > 0 && (
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                                Cargar desde Presupuesto
                            </label>
                            <select
                                value={selectedBudgetId}
                                onChange={(e) => setSelectedBudgetId(e.target.value)}
                                className="w-full bg-white border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                            >
                                <option value="">-- Seleccionar presupuesto --</option>
                                {budgets.filter(b => b.status === 'APPROVED' || b.status === 'ACCEPTED' || b.status === 'PENDING').map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.title || 'Presupuesto'} ({b.totalAmount}€)
                                    </option>
                                ))}
                            </select>

                            {selectedBudgetId && (
                                <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2">
                                    {budgets.find(b => b.id === selectedBudgetId)?.items.map((item, idx) => (
                                        <div key={item.id || idx} className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                                            <div>
                                                <p className="text-xs font-bold text-slate-800">{item.name}</p>
                                                <p className="text-[10px] font-black text-slate-400 uppercase">{item.price.toFixed(2)}€</p>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const curAmt = parseFloat(totalAmount) || 0;
                                                    setTotalAmount((curAmt + item.price).toFixed(2));
                                                    setConcept(prev => prev ? `${prev}, ${item.name}` : item.name);
                                                    setOriginalAmount(prev => prev + item.price);
                                                }}
                                                className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg text-xs font-black uppercase hover:bg-blue-600 hover:text-white transition-all"
                                            >
                                                + Añadir
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {!isDirectPayment && (
                        <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 font-bold flex gap-2 items-start mb-4">
                            <FileText size={18} className="flex-shrink-0 mt-0.5" />
                            <div>
                                Este proceso emitirá una factura de anticipo y sumará el saldo al paciente.
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                                Importe a Cobrar (€)
                            </label>
                            <input
                                type="number"
                                value={totalAmount}
                                onChange={(e) => setTotalAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            />
                            {/* Partial payment indicator */}
                            {isDirectPayment && originalAmount > 0 && parseFloat(totalAmount) > 0 && parseFloat(totalAmount) < originalAmount && (
                                <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                                    <p className="text-[10px] font-black text-amber-700 uppercase">Importe Original: {originalAmount.toFixed(2)}€</p>
                                    <p className="text-xs font-black text-red-600 mt-0.5">
                                        Pendiente tras este cobro: {(originalAmount - (parseFloat(totalAmount) || 0)).toFixed(2)}€
                                    </p>
                                    <p className="text-[10px] text-amber-600 mt-0.5 font-medium">La visita quedará en estado "Pago Parcial"</p>
                                </div>
                            )}
                            {isDirectPayment && originalAmount > 0 && parseFloat(totalAmount) >= originalAmount && originalAmount > 0 && (
                                <p className="text-[10px] text-emerald-600 font-black uppercase mt-1">✓ Cobro total del tratamiento</p>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                                Concepto Factura
                            </label>
                            <input
                                type="text"
                                value={concept}
                                onChange={(e) => setConcept(e.target.value)}
                                placeholder="Concepto del cobro"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    {/* Doctor Selection (Only for direct payments with no appointment linked) */}
                    {isDirectPayment && !appointment && doctors.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                                Doctor Responsable (para comisiones)
                            </label>
                            <select
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                            >
                                <option value="">-- Seleccionar Doctor --</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.specialization || d.specialty?.name})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Combined Payment Toggle */}
                    {isDirectPayment && availableWallet > 0 && (
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setUseCombinedPayment(!useCombinedPayment)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border-2 ${useCombinedPayment
                                    ? 'bg-purple-50 text-purple-700 border-purple-300'
                                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <ArrowRightLeft size={14} />
                                Pago Combinado (Monedero + Otro)
                            </button>
                            {useCombinedPayment && (
                                <span className="text-[10px] text-slate-400">
                                    Disponible: {availableWallet.toFixed(2)}€
                                </span>
                            )}
                        </div>
                    )}

                    {/* Combined Payment: Wallet split */}
                    {useCombinedPayment && (
                        <div className="bg-gradient-to-r from-emerald-50 to-green-50 rounded-xl p-5 border border-emerald-200 space-y-4">
                            <h4 className="text-xs font-black text-emerald-700 uppercase tracking-wide flex items-center gap-2">
                                <Wallet size={14} /> Desglose de Pago
                            </h4>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-[10px] font-bold text-emerald-600 mb-1 block">Del Monedero</label>
                                    <input
                                        type="number"
                                        value={walletAmount}
                                        onChange={(e) => {
                                            const val = Math.min(parseFloat(e.target.value) || 0, availableWallet, numericTotal);
                                            setWalletAmount(val.toString());
                                        }}
                                        max={Math.min(availableWallet, numericTotal)}
                                        className="w-full bg-white border border-emerald-200 rounded-xl p-3 text-lg font-bold text-emerald-700 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-bold text-slate-500 mb-1 block">
                                        Restante ({METHOD_LABELS[primaryMethod === 'wallet' ? 'card' : primaryMethod]})
                                    </label>
                                    <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-lg font-bold text-slate-600">
                                        {(remainingAfterWallet > 0 ? remainingAfterWallet : 0).toFixed(2)}€
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Payment Method Selection */}
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block">
                            {useCombinedPayment ? 'Método para el Restante' : 'Método de Pago'}
                        </label>
                        <div className={`grid gap-3 ${useCombinedPayment ? 'grid-cols-3' : 'grid-cols-4'}`}>
                            <button
                                onClick={() => setPrimaryMethod('cash')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${primaryMethod === 'cash'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <DollarSign className="inline mb-1" size={18} />
                                <br />Efectivo
                            </button>
                            <button
                                onClick={() => setPrimaryMethod('card')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${primaryMethod === 'card'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <CreditCard className="inline mb-1" size={18} />
                                <br />Tarjeta
                            </button>
                            <button
                                onClick={() => setPrimaryMethod('transfer')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${primaryMethod === 'transfer'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <ArrowRightLeft className="inline mb-1" size={18} />
                                <br />Transfer
                            </button>
                            {!useCombinedPayment && isDirectPayment && (
                                <button
                                    onClick={() => setPrimaryMethod('wallet')}
                                    disabled={availableWallet <= 0}
                                    className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${primaryMethod === 'wallet'
                                        ? 'bg-emerald-600 text-white border-emerald-600'
                                        : availableWallet > 0 ? 'bg-white text-emerald-600 border-emerald-200 hover:border-emerald-400' : 'bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed'
                                        }`}
                                >
                                    <Wallet className="inline mb-1" size={18} />
                                    <br />Monedero
                                </button>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">
                            Notas Privadas (Opcional)
                        </label>
                        <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Notas internas..."
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium outline-none"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 pt-0 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isProcessing || !totalAmount}
                        className="flex-1 bg-slate-900 text-white py-4 rounded-xl text-sm font-black uppercase shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>⏳ Procesando...</>
                        ) : (
                            isDirectPayment ? (
                                <>
                                    <Check size={20} />
                                    {originalAmount > 0 && parseFloat(totalAmount) < originalAmount
                                        ? `Cobro Parcial ${totalAmount}€`
                                        : `Cobrar ${totalAmount}€`}
                                </>
                            ) : (
                                <>
                                    <FileText size={20} />
                                    Añadir Saldo
                                </>
                            )
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PaymentModal;
