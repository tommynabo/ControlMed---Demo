import React, { useState, useEffect } from 'react';
import { Wallet, X, Check, FileText, User, Coins } from 'lucide-react';
import { Patient, Doctor } from '../../types';
import { api } from '../services/api';

interface PayWithWalletModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient;
    treatments: any[]; // Selected treatments to pay
    onPaymentComplete: () => void;
}

export const PayWithWalletModal: React.FC<PayWithWalletModalProps> = ({ isOpen, onClose, patient, treatments, onPaymentComplete }) => {
    const [doctors, setDoctors] = useState<Doctor[]>([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');
    const [budgets, setBudgets] = useState<any[]>([]);
    const [selectedBudgetId, setSelectedBudgetId] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);

    // Calculate total. Treatments might be grouped, so check if they have 'count'.
    // Logic in TreatmentsList groups them, but here we might receive raw treatments OR grouped.
    // If we passed grouped objs, we must handle count. 
    // Assuming we pass the grouped objects from TreatmentsList OR a list of items.
    // Let's assume we pass what TreatmentsList has: grouped objects with `count`.
    const totalAmount = treatments.reduce((sum, t) => sum + (t.price * (t.count || 1)), 0);

    useEffect(() => {
        if (isOpen) {
            api.doctors.getAll().then(setDoctors).catch(console.error);
            api.budget.getByPatient(patient.id).then(setBudgets).catch(console.error);
            setSelectedDoctorId('');
            setSelectedBudgetId('');
        }
    }, [isOpen, patient.id]);

    const handlePay = async () => {
        if (!selectedDoctorId) {
            alert("Selecciona un doctor para asignar la comisión.");
            return;
        }

        if ((patient.wallet || 0) < totalAmount) {
            alert(`Saldo insuficiente. El paciente tiene ${patient.wallet}€ y el total es ${totalAmount}€.`);
            return;
        }

        if (!confirm(`¿Confirmar pago de ${totalAmount}€ con saldo del monedero?`)) return;

        setIsProcessing(true);
        try {
            // Extract all IDs from grouped treatments
            // A grouped treatment usually has `totalId` (array) or just `id` (single).
            const allIds = treatments.flatMap(t => t.totalId || [t.id]);

            // We can use the helper in api logic or fetch direct if not added to api wrapper yet (I didn't add the method to api wrapper)
            // I'll call fetch directly for now or add to api wrapper.
            // Adding to api wrapper is cleaner but direct fetch is faster.
            // I will use direct fetch to avoid editing api.ts again, as I just edited it. 
            // Wait, I updated api.ts twice. One more time is fine? No, stick to direct for custom endpoint if simple.
            // Or better: Use api wrapper if I can.

            // Let's use direct fetch matching api.ts pattern
            const API_URL = 'http://localhost:3001/api'; // Or retrieve from window
            // Actually, `api.ts` handles URL logic. If I bypass it I might break prod.
            // But I am in `src/services/api.ts`'s consumer. 
            // I'll assume I can use `api` if I added it. But I DID NOT add `payWithWallet` to `api.ts`.
            // I only added `doctors`.
            // So I MUST use `fetch`.

            // Get URL from api.ts logic? I can't export `API_URL` easily.
            // I'll assume standard URL or relative.
            const url = window.location.hostname === 'localhost' ? 'http://localhost:3001/api/finance/pay-with-wallet' : '/api/finance/pay-with-wallet';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    patientId: patient.id,
                    amount: totalAmount,
                    treatmentIds: allIds,
                    doctorId: selectedDoctorId,
                    budgetId: selectedBudgetId || undefined
                })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Error en el pago");
            }

            // Success
            const data = await res.json();
            alert(`✅ Pago realizado con éxito. Nuevo saldo: ${data.newBalance}€`);
            onPaymentComplete(); // Check if this refreshes data
            onClose();
        } catch (e: any) {
            console.error(e);
            alert("Error al pagar: " + e.message);
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-lg w-full rounded-[2.5rem] p-8 shadow-2xl animate-in slide-in-from-bottom-8">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                        <Wallet className="text-emerald-500" /> Pagar con Saldo
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors"><X size={20} /></button>
                </div>

                <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white p-6 rounded-2xl mb-6 shadow-lg shadow-emerald-500/20">
                    <p className="text-xs font-bold uppercase opacity-80 mb-1">Saldo Disponible</p>
                    <p className="text-4xl font-black tracking-tight">{patient.wallet || 0}€</p>
                </div>

                <div className="bg-slate-50 p-6 rounded-[2rem] mb-6 border border-slate-100">
                    <h3 className="font-bold text-xs uppercase text-slate-400 mb-4 tracking-wider">Conceptos a Pagar</h3>
                    <div className="space-y-3">
                        {treatments.map((t, i) => (
                            <div key={i} className="flex justify-between text-sm items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                                <div className="font-medium text-slate-700">{t.serviceName} {t.count > 1 && <span className="bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold">x{t.count}</span>}</div>
                                <div className="font-black text-slate-900">{t.price * (t.count || 1)}€</div>
                            </div>
                        ))}
                    </div>
                    <div className="border-t-2 border-slate-200 dashed mt-4 pt-4 flex justify-between items-center">
                        <span className="font-bold text-slate-500 text-xs uppercase">Total a Descontar</span>
                        <span className="font-black text-2xl text-slate-900">{totalAmount}€</span>
                    </div>
                </div>

                <div className="mb-8">
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-2 ml-2">Asignar Comisión a Doctor (Requerido)</label>
                    <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <select
                            className="w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-xl font-bold text-sm text-slate-900 focus:border-slate-900 outline-none appearance-none cursor-pointer"
                            value={selectedDoctorId}
                            onChange={e => setSelectedDoctorId(e.target.value)}
                        >
                            <option value="">Selecciona un doctor...</option>
                            {doctors.map(doc => (
                                <option key={doc.id} value={doc.id}>{doc.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mb-8">
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 ml-2 block">
                        Asociar a Presupuesto (Opcional)
                    </label>
                    <select
                        value={selectedBudgetId}
                        onChange={(e) => setSelectedBudgetId(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none"
                    >
                        <option value="">-- Seleccionar Presupuesto --</option>
                        {budgets.filter(b => b.status === 'APPROVED' || b.status === 'ACCEPTED' || b.status === 'PENDING').map(b => (
                            <option key={b.id} value={b.id}>
                                {b.title || 'Presupuesto'} ({b.totalAmount}€)
                            </option>
                        ))}
                    </select>
                </div>

                <button
                    onClick={handlePay}
                    disabled={isProcessing}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/10 flex items-center justify-center gap-2 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isProcessing ? (
                        <>⏳ Procesando...</>
                    ) : (
                        <>
                            <Coins size={20} />
                            Confirmar Pago
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};
