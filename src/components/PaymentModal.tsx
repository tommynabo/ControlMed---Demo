import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Wallet, X, Check, FileText, ArrowRightLeft, Lock, AlertTriangle } from 'lucide-react';
import { Payment, Patient, Budget } from '../../types';
import { api } from '../services/api';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient;
    budgets: Budget[];
    onPaymentComplete: (payment: Payment, invoice: any) => void;
    appointment?: any;
    defaultAmount?: number;
    defaultConcept?: string;
}

interface PaymentSplit {
    method: 'cash' | 'card' | 'transfer' | 'wallet';
    amount: number;
}

const METHOD_LABELS: Record<string, string> = {
    cash: 'Efectivo',
    card: 'Tarjeta',
    transfer: 'Transferencia',
    wallet: 'Monedero'
};

export const PaymentModal: React.FC<PaymentModalProps> = ({
    isOpen,
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

    // PIN authorization state
    const [pinStep, setPinStep] = useState(false);
    const [pinInput, setPinInput] = useState('');
    const [pinAttempts, setPinAttempts] = useState(0);
    const [pinBlocked, setPinBlocked] = useState(false);
    const [pinError, setPinError] = useState('');

    const availableWallet = patient.wallet || 0;

    // ── Shared treatment split detection ─────────────────────────────────────
    // If the appointment has budget items with different doctors, compute splits
    const doctorSplits: Array<{ doctorId: string; amount: number; treatmentName: string }> = (() => {
        const items: any[] = (appointment as any)?.budget?.items;
        if (!items || items.length === 0) return [];
        const itemsWithDoctor = items.filter((i: any) => i.doctorId);
        if (itemsWithDoctor.length === 0) return [];
        const uniqueDoctors = new Set(itemsWithDoctor.map((i: any) => i.doctorId));
        if (uniqueDoctors.size < 2) return []; // only split when 2+ doctors
        const byDoctor: Record<string, { doctorId: string; amount: number; names: string[] }> = {};
        for (const item of itemsWithDoctor) {
            if (!byDoctor[item.doctorId]) byDoctor[item.doctorId] = { doctorId: item.doctorId, amount: 0, names: [] };
            const discountedPrice = Number(item.price) * (1 - (Number(item.discount) || 0) / 100) * (Number(item.quantity) || 1);
            byDoctor[item.doctorId].amount += discountedPrice;
            if (item.name) byDoctor[item.doctorId].names.push(item.name);
        }
        return Object.values(byDoctor).map(s => ({ doctorId: s.doctorId, amount: s.amount, treatmentName: s.names.join(', ') }));
    })();
    const isSplitPayment = doctorSplits.length >= 2;

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
            // Reset PIN state on open
            setPinStep(false);
            setPinInput('');
            setPinAttempts(0);
            setPinBlocked(false);
            setPinError('');

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

        // If payment includes card or transfer, require PIN authorization
        const needsPin = breakdown.some(b => b.method === 'card' || b.method === 'transfer');
        if (needsPin) {
            try {
                const pinHash = await api.clinicSettings.getPaymentPinHash();
                if (pinHash !== null) {
                    setPinStep(true);
                    return;
                }
            } catch {
                // If we can't reach Supabase, proceed without PIN (degraded mode)
            }
        }

        await processPayment();
    };

    const handlePinConfirm = async () => {
        if (pinBlocked) return;
        const { sha256 } = await import('../services/api');
        const enteredHash = await sha256(pinInput);
        const storedHash = await api.clinicSettings.getPaymentPinHash();

        if (enteredHash === storedHash) {
            setPinStep(false);
            setPinInput('');
            setPinAttempts(0);
            setPinError('');
            await processPayment();
        } else {
            const newAttempts = pinAttempts + 1;
            setPinAttempts(newAttempts);
            setPinInput('');
            if (newAttempts >= 3) {
                setPinBlocked(true);
                setPinError('Demasiados intentos fallidos. El cobro ha sido bloqueado.');
            } else {
                setPinError(`PIN incorrecto. Intentos restantes: ${3 - newAttempts}`);
            }
        }
    };

    const processPayment = async () => {
        const numericAmount = parseFloat(totalAmount);
        const breakdown = getPaymentBreakdown();

        setIsProcessing(true);

        try {
            // Determine primary method for invoice
            const mainMethod = breakdown.length === 1 ? breakdown[0].method :
                breakdown.sort((a, b) => b.amount - a.amount)[0].method;

            const isPartialPayment = isDirectPayment && originalAmount > 0 && numericAmount < originalAmount;

            let response: any;

            if (isSplitPayment && !isPartialPayment) {
                // Proportionally scale split amounts to the actual payment amount
                const splitTotal = doctorSplits.reduce((s, x) => s + x.amount, 0);
                const scaledSplits = doctorSplits.map(s => ({
                    ...s,
                    amount: splitTotal > 0 ? parseFloat(((s.amount / splitTotal) * numericAmount).toFixed(2)) : s.amount
                }));
                // Absorb rounding difference in the last split
                const scaledSum = scaledSplits.reduce((s, x) => s + x.amount, 0);
                if (scaledSplits.length > 0) scaledSplits[scaledSplits.length - 1].amount += parseFloat((numericAmount - scaledSum).toFixed(2));

                response = await api.payments.createSplit({
                    patientId: patient.id,
                    totalAmount: numericAmount,
                    method: mainMethod,
                    appointmentId: appointment?.id,
                    budgetId: (appointment as any)?.budgetId || undefined,
                    concept,
                    notes: notes || undefined,
                    splits: scaledSplits
                });
            } else {
                const paymentData = {
                    patientId: patient.id,
                    amount: numericAmount,
                    method: mainMethod,
                    type: isDirectPayment ? ('DIRECT_CHARGE' as const) : ('ADVANCE_PAYMENT' as const),
                    appointmentId: appointment?.id,
                    budgetId: selectedBudgetId || (appointment as any)?.budgetId || undefined,
                    doctorId: appointment?.doctorId || selectedDoctorId,
                    treatmentName: concept,
                    notes: notes || undefined,
                    isPartial: isPartialPayment,
                    originalAmount: isPartialPayment ? originalAmount : undefined,
                };
                response = await api.payments.create(paymentData);
            }

            if (!response) {
                throw new Error("No se recibió respuesta del servidor");
            }

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

            onPaymentComplete(payment, response);

        alert(`✅ Operación realizada con éxito.${breakdown.length > 1 ? `\n\nDesglose:\n${breakdown.map(b => `  ${METHOD_LABELS[b.method]}: ${b.amount.toFixed(2)}€`).join('\n')}` : ''}`);

            // Usar la URL efímera pública de Quipu si viene en la respuesta,
            // si no, pedirla al endpoint de descarga local
            const ephemeralUrl = response?.previewUrl;
            const invoiceId = response?.invoice?.id;

            if (ephemeralUrl) {
                window.open(ephemeralUrl, '_blank');
            } else if (invoiceId) {
                try {
                    const downloadData = await api.invoices.getDownloadUrl(invoiceId);
                    if (downloadData?.url) window.open(downloadData.url, '_blank');
                } catch {
                    // Si falla la descarga no bloqueamos el flujo
                }
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
            <div className="bg-white max-w-2xl w-full rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500 relative">

                {/* PIN Authorization Overlay */}
                {pinStep && (
                    <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-10 flex flex-col items-center justify-center rounded-[2.5rem] p-10 space-y-6">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center ${pinBlocked ? 'bg-red-100' : 'bg-slate-100'}`}>
                            {pinBlocked
                                ? <AlertTriangle size={32} className="text-red-500" />
                                : <Lock size={32} className="text-slate-700" />}
                        </div>
                        <div className="text-center">
                            <h3 className="text-xl font-black text-slate-900">
                                {pinBlocked ? 'Cobro Bloqueado' : 'Se requiere autorización'}
                            </h3>
                            <p className="text-sm text-slate-500 mt-1">
                                {pinBlocked
                                    ? 'Se han agotado los intentos. Cierra y vuelve a intentarlo.'
                                    : 'Introduce el PIN de autorización para confirmar el cobro por TPV.'}
                            </p>
                        </div>

                        {!pinBlocked && (
                            <div className="w-full max-w-xs space-y-3">
                                <input
                                    type="password"
                                    value={pinInput}
                                    onChange={e => setPinInput(e.target.value.replace(/\D/g, '').slice(0, 8))}
                                    onKeyDown={e => e.key === 'Enter' && handlePinConfirm()}
                                    placeholder="PIN de autorización"
                                    autoFocus
                                    maxLength={8}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center text-2xl font-black tracking-[0.5em] outline-none focus:ring-2 focus:ring-slate-400"
                                />
                                {pinAttempts > 0 && (
                                    <p className="text-xs font-bold text-center text-amber-600">
                                        Intentos restantes: {3 - pinAttempts}
                                    </p>
                                )}
                            </div>
                        )}

                        {pinError && (
                            <p className="text-xs font-black text-red-600 flex items-center gap-1">
                                <AlertTriangle size={13} /> {pinError}
                            </p>
                        )}

                        <div className="flex gap-3 w-full max-w-xs">
                            <button
                                onClick={() => { setPinStep(false); setPinInput(''); setPinError(''); }}
                                className="flex-1 py-3 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                            >
                                Cancelar
                            </button>
                            {!pinBlocked && (
                                <button
                                    onClick={handlePinConfirm}
                                    disabled={pinInput.length < 4}
                                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl text-sm font-black uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
                                >
                                    Confirmar
                                </button>
                            )}
                        </div>
                    </div>
                )}

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
                                                {(Number(item.discount) || 0) > 0 ? (
                                                    <p className="text-[10px] font-black uppercase flex items-center gap-1">
                                                        <span className="line-through text-slate-300">{Number(item.price).toFixed(2)}€</span>
                                                        <span className="text-green-600">{(Number(item.price) * (1 - Number(item.discount) / 100)).toFixed(2)}€</span>
                                                        <span className="text-red-500">(-{item.discount}%)</span>
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] font-black text-slate-400 uppercase">{Number(item.price).toFixed(2)}€</p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const curAmt = parseFloat(totalAmount) || 0;
                                                    const discountedLineTotal = Number(item.price) * (1 - (Number(item.discount) || 0) / 100) * (Number(item.quantity) || 1);
                                                    setTotalAmount((curAmt + discountedLineTotal).toFixed(2));
                                                    setConcept(prev => prev ? `${prev}, ${item.name}` : item.name);
                                                    setOriginalAmount(prev => prev + discountedLineTotal);
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

                    {/* ── Shared treatment split summary ── */}
                    {isSplitPayment && (
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] font-black uppercase text-violet-600 tracking-wide">Tratamiento Compartido — desglose por doctor</p>
                            {doctorSplits.map((s, i) => (
                                <div key={i} className="flex justify-between items-center bg-white rounded-lg px-3 py-2 border border-violet-100">
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{s.treatmentName}</p>
                                    </div>
                                    <span className="text-xs font-black text-violet-700">{s.amount.toFixed(2)}€</span>
                                </div>
                            ))}
                            <p className="text-[10px] text-violet-500 font-medium pt-1">Se crearán liquidaciones separadas por doctor automáticamente.</p>
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
