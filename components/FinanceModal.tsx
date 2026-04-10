import React, { useState } from 'react';
import { Budget } from '../types';
import { Loader2 } from 'lucide-react';

interface FinanceModalProps {
    budget: Budget;
    onClose: () => void;
    onSave: (plan: any) => void;
}

export const FinanceModal: React.FC<FinanceModalProps> = ({ budget, onClose, onSave }) => {
    const [downPayment, setDownPayment] = useState<number>(0);
    const [months, setMonths] = useState<number>(3);

    const totalAmount = budget.totalAmount || budget.total || 0;
    const financedAmount = Math.max(0, totalAmount - downPayment);
    const monthlyFee = months > 0 ? financedAmount / months : 0;

    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onSave({
                total: totalAmount,
                downPayment,
                months,
                monthlyFee
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-3xl w-full max-w-md shadow-2xl">
                <h3 className="text-2xl font-bold mb-2">Configurar Financiación</h3>
                <p className="text-slate-500 mb-6">Total a financiar: <span className="font-bold text-slate-900">{totalAmount.toFixed(2)}€</span></p>

                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Entrada Inicial (€)</label>
                        <input
                            type="number"
                            value={downPayment}
                            onChange={(e) => setDownPayment(Number(e.target.value))}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none text-lg font-mono"
                            placeholder="0.00"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Plazo (Meses)</label>
                        <div className="flex gap-2">
                            {[3, 6, 12, 18, 24].map(m => (
                                <button
                                    key={m}
                                    onClick={() => setMonths(m)}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold border ${months === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {m}m
                                </button>
                            ))}
                        </div>
                        <input
                            type="range"
                            min="1" max="36"
                            value={months}
                            onChange={(e) => setMonths(Number(e.target.value))}
                            className="w-full mt-4 accent-blue-600"
                        />
                        <div className="text-center text-sm font-bold text-slate-500 mt-1">{months} Meses</div>
                    </div>

                    <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-600">Entrada</span>
                            <span className="font-bold">{downPayment.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-slate-600">Importe a financiar</span>
                            <span className="font-bold">{financedAmount.toFixed(2)}€</span>
                        </div>
                        <div className="h-px bg-blue-200 my-3"></div>
                        <div className="flex justify-between items-center">
                            <span className="font-bold text-blue-900">Cuota Mensual</span>
                            <span className="text-2xl font-black text-blue-600">{monthlyFee.toFixed(2)}€</span>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <button onClick={onClose} className="flex-1 py-3 text-slate-600 font-bold hover:bg-slate-100 rounded-xl">Cancelar</button>
                        <button onClick={handleConfirm} disabled={isSubmitting} className="flex-1 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center justify-center gap-2">
                            {isSubmitting ? <><Loader2 className="animate-spin w-4 h-4" /> Guardando...</> : 'Confirmar Plan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
