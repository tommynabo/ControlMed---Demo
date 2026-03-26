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
