import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, Wallet, X, Check, FileText } from 'lucide-react';
import { Payment, Patient, Budget } from '../../types';
import { api } from '../services/api';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient;
    budgets: Budget[];
    onPaymentComplete: (payment: Payment, invoice: any) => void;
    appointment?: Appointment; // Context for direct payment
    defaultAmount?: number;
    defaultConcept?: string;
}

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
    // Mode determination
    const isDirectPayment = !!appointment || (!!defaultAmount && defaultAmount > 0);

    const [amount, setAmount] = useState('');
    const [concept, setConcept] = useState('');
    const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'transfer' | 'wallet'>('card');
    const [notes, setNotes] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    const availableWallet = patient.wallet || 0;

    useEffect(() => {
        if (isOpen) {
            setAmount(defaultAmount ? defaultAmount.toString() : '');
            setConcept(defaultConcept || (appointment ? `Pago Cita ${appointment.date}` : 'Anticipo / Saldo de Cuenta'));
            setPaymentMethod('card');
            setNotes('');
        }
    }, [isOpen, defaultAmount, defaultConcept, appointment]);

    const handleSubmit = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            alert('Introduce un importe válido');
            return;
        }
        if (!concept) {
            alert('Introduce un concepto');
            return;
        }

        const numericAmount = parseFloat(amount);

        // Validation for wallet payment
        if (paymentMethod === 'wallet' && numericAmount > availableWallet) {
            alert(`Saldo insuficiente en monedero (${availableWallet}€ disponibles)`);
            return;
        }

        setIsProcessing(true);

        try {
            // 1. Create Invoice
            const invoiceData = {
                patientId: patient.id,
                patient: patient,
                amount: numericAmount,
                items: [{ name: concept, price: numericAmount }],
                paymentMethod,
                type: isDirectPayment ? 'INVOICE' : 'ADVANCE_PAYMENT', // Direct charge vs Top-up
                concept: concept,
                appointmentId: appointment?.id
            };

            // If paying with wallet, we might need a specific endpoint or logic
            // Assuming api.invoices.create handles 'wallet' method correctly by deducting balance

            const response = await api.invoices.create(invoiceData) as any;

            if (!response || (!response.url && !response.previewUrl)) {
                if (response.error) throw new Error(response.error);
            }

            const invoiceUrl = response.previewUrl || response.url;

            // 2. Create Payment Record
            const payment: Payment = {
                id: `pay_${Date.now()}`,
                patientId: patient.id,
                amount: numericAmount,
                method: paymentMethod,
                type: isDirectPayment ? 'DIRECT_CHARGE' : 'ADVANCE_PAYMENT',
                notes: notes || undefined,
                createdAt: new Date().toISOString(),
                budgetId: appointment?.budgetId
            };

            // 3. Mark appointment as paid if applicable
            if (appointment) {
                await api.appointments.update(appointment.id, { paid: true, status: 'COMPLETADO' });
            }

            // 4. Complete
            onPaymentComplete(payment, response);

            alert(`✅ Operación realizada con éxito.`);

            if (invoiceUrl) {
                window.open(invoiceUrl, '_blank');
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
                            Paciente: <strong>{patient.name}</strong> | Saldo Monedero: <strong>{availableWallet}€</strong>
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
                                Importe (€)
                            </label>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-xl font-bold outline-none focus:ring-2 focus:ring-blue-100"
                            />
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

                    {/* Método de Pago */}
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-3 block">
                            Método de Pago
                        </label>
                        <div className="grid grid-cols-4 gap-3">
                            <button
                                onClick={() => setPaymentMethod('cash')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${paymentMethod === 'cash'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <DollarSign className="inline mb-1" size={18} />
                                <br />Efectivo
                            </button>
                            <button
                                onClick={() => setPaymentMethod('card')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${paymentMethod === 'card'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <CreditCard className="inline mb-1" size={18} />
                                <br />Tarjeta
                            </button>
                            <button
                                onClick={() => setPaymentMethod('transfer')}
                                className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${paymentMethod === 'transfer'
                                    ? 'bg-slate-900 text-white border-slate-900'
                                    : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                                    }`}
                            >
                                <Wallet className="inline mb-1" size={18} />
                                <br />Transfer
                            </button>
                            {isDirectPayment && (
                                <button
                                    onClick={() => setPaymentMethod('wallet')}
                                    disabled={availableWallet <= 0}
                                    className={`p-4 rounded-xl border-2 text-xs font-black uppercase transition-all ${paymentMethod === 'wallet'
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
                        disabled={isProcessing || !amount}
                        className="flex-1 bg-slate-900 text-white py-4 rounded-xl text-sm font-black uppercase shadow-lg hover:bg-slate-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <>⏳ Procesando...</>
                        ) : (
                            isDirectPayment ? (
                                <>
                                    <Check size={20} />
                                    Cobrar {amount}€
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
