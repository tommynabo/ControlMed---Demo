import React, { useState, useEffect } from 'react';
import { Wallet, Plus, Send } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

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
    const { api } = useAppContext();
    const [balance, setBalance] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadBalance();
    }, [patientId]);

    const loadBalance = async () => {
        setLoading(true);
        setError(null);
        try {
            // Fetch patient balance from API
            const response = await fetch(`/api/patients/${patientId}/balance`);
            const data = await response.json();
            setBalance(data.balance || 0);
        } catch (err) {
            console.error('Error loading balance:', err);
            setBalance(0);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 animate-pulse">
                <div className="h-8 bg-emerald-200 rounded w-48"></div>
            </div>
        );
    }

    return (
        <>
            {balance && balance > 0 ? (
                <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-300 rounded-2xl p-6 space-y-4 shadow-md">
                    {/* Balance Display */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-emerald-500 text-white p-3 rounded-xl">
                                <Wallet size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase text-emerald-600 tracking-wider">Saldo a Favor</p>
                                <p className="text-4xl font-black text-emerald-700">{balance.toFixed(2)}€</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-emerald-600 uppercase">Disponible para</p>
                            <p className="text-sm font-bold text-emerald-700">usar en tratamientos</p>
                        </div>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-emerald-600 font-semibold">
                        💡 Este es dinero anticipado que puede usarse para pagar tratamientos futuros, servicios adicionales o devolverse en efectivo.
                    </p>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={onUseBalance}
                            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors shadow-lg hover:shadow-xl"
                        >
                            <Send size={16} /> Usar Saldo
                        </button>
                        <button
                            onClick={onAddBalance}
                            className="flex-1 bg-white hover:bg-emerald-50 text-emerald-600 border-2 border-emerald-300 px-4 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors"
                        >
                            <Plus size={16} /> Añadir Saldo
                        </button>
                    </div>
                </div>
            ) : (
                <div className="bg-gradient-to-r from-slate-50 to-slate-100 border border-slate-200 rounded-2xl p-6 text-center space-y-3">
                    <Wallet size={32} className="mx-auto text-slate-300" />
                    <p className="text-sm font-bold text-slate-600">Sin saldo a favor</p>
                    <button
                        onClick={onAddBalance}
                        className="w-full bg-slate-600 hover:bg-slate-700 text-white px-4 py-2 rounded-lg font-bold text-xs transition-colors"
                    >
                        Agregar Crédito
                    </button>
                </div>
            )}
        </>
    );
};
