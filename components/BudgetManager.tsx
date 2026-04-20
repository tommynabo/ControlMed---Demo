import React, { useState, useEffect } from 'react';
import { Budget, TreatmentPlan, Installment } from '../types';
import { Plus, Check, X, CreditCard, FileText, Loader2, Trash2, Edit } from 'lucide-react';
import { FinanceModal } from './FinanceModal';
import { api } from '../services/api';
import { BudgetModal } from '../src/components/BudgetModal';

interface BudgetManagerProps {
    patientId: string;
}

export const BudgetManager: React.FC<BudgetManagerProps> = ({ patientId }) => {
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [selectedBudget, setSelectedBudget] = useState<Budget | null>(null);
    const [showFinanceModal, setShowFinanceModal] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);

    const normalize = (data: any[]) =>
        data.map((b: any) => ({ ...b, status: b.status?.toLowerCase() }));

    const loadBudgets = async () => {
        setLoading(true);
        try {
            const data = await api.budget.getByPatient(patientId);
            setBudgets(normalize(Array.isArray(data) ? data : []));
        } catch (e) {
            console.error("Failed to load budgets", e);
        } finally {
            setLoading(false);
        }
    };

    const refreshBudgets = async () => {
        try {
            const data = await api.budget.getByPatient(patientId);
            setBudgets(normalize(Array.isArray(data) ? data : []));
        } catch (e) {
            console.error("Failed to refresh budgets", e);
        }
    };

    useEffect(() => {
        loadBudgets();
    }, [patientId]);

    const handleAccept = (budget: Budget) => {
        // Just select it to show options
        setSelectedBudget(budget);
    };

    const handleReject = async (budget: Budget) => {
        if (!confirm("¿Rechazar este presupuesto?")) return;
        try {
            await api.budget.updateStatus(budget.id, 'rejected');
            await loadBudgets();
        } catch (e) {
            alert("Error: " + (e as Error).message);
        }
    };

    const handleFinance = () => {
        setShowFinanceModal(true);
    };

    const handleConvertToInvoice = async () => {
        if (!selectedBudget) return;
        try {
            if (!confirm("¿Convertir a Factura y finalizar?")) return;

            // 1. Mark accepted
            await api.budget.updateStatus(selectedBudget.id, 'accepted');
            // 2. Convert
            await api.budget.convertToInvoice(selectedBudget.id);

            alert("✅ Presupuesto aceptado y factura generada exitosamente.");
            await loadBudgets();
            setSelectedBudget(null);
        } catch (e) {
            alert("Error: " + (e as Error).message);
        }
    };

    const handleSaveFinancing = async (planData: any) => {
        if (!selectedBudget) return;
        try {
            // 1. Mark accepted
            await api.budget.updateStatus(selectedBudget.id, 'accepted');

            // 2. Create Financing Plan
            await api.budget.createFinancing({
                patientId,
                budgetId: selectedBudget.id,
                totalAmount: selectedBudget.total,
                downPayment: planData.downPayment,
                installmentsCount: planData.months,
                startDateStr: new Date().toISOString()
            });

            alert("✅ Financiación creada correctamente.");
            setShowFinanceModal(false);
            await loadBudgets();
            setSelectedBudget(null);
        } catch (e) {
            alert("Error guardando financiación: " + (e as Error).message);
        }
    };

    return (
        <div className="flex flex-col gap-6">
            <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold">Presupuestos</h3>
                <button
                    onClick={() => {
                        setEditingBudget(null);
                        setShowBudgetModal(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                    <Plus size={18} /> Nuevo Presupuesto
                </button>
            </div>

            {loading && <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-600" /></div>}

            <div className="grid gap-4">
                {!Array.isArray(budgets) || (budgets.length === 0 && !loading) ? (
                    <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl border-slate-300">
                        {loading ? 'Cargando...' : 'No hay presupuestos registrados.'}
                    </div>
                ) : (
                    budgets.map(bg => (
                        <div key={bg.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 transition-all hover:shadow-md">
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h4 className="font-bold text-lg flex items-center gap-2">
                                        Presupuesto #{bg.id.slice(0, 8)} 
                                        {(bg.status === 'pending' || bg.status === 'draft' || bg.status === 'accepted') && (
                                            <button onClick={() => {
                                                setSelectedBudget(null);
                                                setEditingBudget(bg);
                                                setShowBudgetModal(true);
                                            }} className="text-blue-600 hover:text-blue-800 transition-colors ml-2" title="Editar Presupuesto">
                                                <Edit size={16} />
                                            </button>
                                        )}
                                    </h4>
                                    <p className="text-sm font-bold text-slate-800">{bg.title || "Sin título"}</p>
                                    <p className="text-xs text-slate-500">{new Date(bg.date).toLocaleDateString()}</p>
                                    {(bg as any).updated_by_name && (
                                        <p className="text-[10px] text-slate-400 mt-0.5">✎ {(bg as any).updated_by_name}</p>
                                    )}
                                </div>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold 
                                    ${bg.status === 'accepted' ? 'bg-green-100 text-green-700' :
                                        bg.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                            bg.status === 'converted' ? 'bg-blue-100 text-blue-700' :
                                                'bg-yellow-100 text-yellow-700'}`}>
                                    {bg.status === 'draft' ? 'BORRADOR' : bg.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="space-y-2 mb-6">
                                {bg.items && bg.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between text-sm py-2 border-b border-slate-50 last:border-0 items-center">
                                        <div className="flex gap-2 items-center">
                                            <span className="font-bold text-slate-400">#{item.tooth || '-'}</span>
                                            <span>{item.name}</span>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <span className="font-mono font-bold">{item.price}€</span>
                                                {item.discount > 0 && (
                                                    <div>
                                                        <span className="text-[10px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                                            -{item.discount}% dto.
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                            {item.quantity > 1 && <span className="text-slate-400 text-xs text-right">x{item.quantity}</span>}
                                            {(bg.status === 'pending' || bg.status === 'draft') && (
                                                <button onClick={async () => {
                                                    if (confirm("¿Borrar item?")) {
                                                        await api.budget.deleteItem(item.id);
                                                        loadBudgets();
                                                    }
                                                }} className="text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                <div className="flex justify-between pt-2 font-black text-lg border-t border-slate-200 mt-2">
                                    <span>Total</span>
                                    <span>{bg.totalAmount}€</span>
                                </div>
                            </div>

                            {/* Actions for Draft/Pending */}
                            {(bg.status === 'pending' || bg.status === 'draft') && (
                                <div className="space-y-4">
                                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mt-4">
                                        <h5 className="text-xs font-bold text-slate-500 uppercase mb-3">Añadir Concepto Manual</h5>
                                        <div className="flex gap-2">
                                            <input
                                                id={`item-name-${bg.id}`}
                                                placeholder="Tratamiento / Concepto"
                                                className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <input
                                                id={`item-price-${bg.id}`}
                                                type="number"
                                                placeholder="Precio €"
                                                className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-2 text-xs font-bold outline-none"
                                            />
                                            <button
                                                onClick={async () => {
                                                    const nameInput = document.getElementById(`item-name-${bg.id}`) as HTMLInputElement;
                                                    const priceInput = document.getElementById(`item-price-${bg.id}`) as HTMLInputElement;
                                                    if (!nameInput.value || !priceInput.value) return alert("Rellena concepto y precio");

                                                    try {
                                                        await api.budget.addItemToDraft(patientId, {
                                                            tooth: '-',
                                                            name: nameInput.value,
                                                            price: Number(priceInput.value),
                                                            quantity: 1
                                                        });
                                                        alert("✅ Concepto añadido");
                                                        nameInput.value = '';
                                                        priceInput.value = '';
                                                        loadBudgets();
                                                    } catch (e) {
                                                        alert("Error: " + (e as Error).message);
                                                    }
                                                }}
                                                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-700"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
                                        <button onClick={() => {
                                            setSelectedBudget(null);
                                            setEditingBudget(bg);
                                            setShowBudgetModal(true);
                                        }} className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-bold">
                                            <Edit size={16} /> Editar
                                        </button>
                                        <button onClick={() => handleReject(bg)} className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm font-bold">
                                            <X size={16} /> Rechazar
                                        </button>
                                        <button onClick={() => handleAccept(bg)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 text-sm font-bold">
                                            <Check size={16} /> Aceptar / Procesar
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Actions for Accepted */}
                            {bg.status === 'accepted' && selectedBudget?.id !== bg.id && (
                                <div className="flex gap-2 justify-end pt-2 border-t border-slate-50">
                                    <button onClick={() => {
                                        setSelectedBudget(null);
                                        setEditingBudget(bg);
                                        setShowBudgetModal(true);
                                    }} className="flex items-center gap-2 px-4 py-2 text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-bold">
                                        <Edit size={16} /> Editar
                                    </button>
                                    <button onClick={() => handleAccept(bg)} className="flex items-center gap-2 bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 text-sm font-bold">
                                        <Check size={16} /> Procesar Pago
                                    </button>
                                </div>
                            )}

                            {/* If just clicked accept, show options */}
                            {selectedBudget?.id === bg.id && (bg.status === 'pending' || bg.status === 'draft' || bg.status === 'accepted') && (
                                <div className="mt-4 p-4 bg-slate-50 rounded-xl flex gap-4 animate-in slide-in-from-top-2">
                                    <button onClick={() => {
                                        setSelectedBudget(null);
                                        setEditingBudget(bg);
                                        setShowBudgetModal(true);
                                    }} className="flex-1 flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-green-500 transition-colors group">
                                        <div className="p-3 bg-green-50 rounded-full text-green-600 group-hover:bg-green-600 group-hover:text-white transition-colors"><Edit size={20} /></div>
                                        <span className="font-bold text-sm">Editar</span>
                                        <span className="text-xs text-slate-500">Modificar presupuesto</span>
                                    </button>
                                    <button onClick={handleConvertToInvoice} className="flex-1 flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-blue-500 transition-colors group">
                                        <div className="p-3 bg-blue-50 rounded-full text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><FileText size={20} /></div>
                                        <span className="font-bold text-sm">Pago Único</span>
                                        <span className="text-xs text-slate-500">Convertir a Factura</span>
                                    </button>
                                    <button onClick={handleFinance} className="flex-1 flex flex-col items-center gap-2 p-4 bg-white border border-slate-200 rounded-xl hover:border-purple-500 transition-colors group">
                                        <div className="p-3 bg-purple-50 rounded-full text-purple-600 group-hover:bg-purple-600 group-hover:text-white transition-colors"><CreditCard size={20} /></div>
                                        <span className="font-bold text-sm">Financiar</span>
                                        <span className="text-xs text-slate-500">Pagos a plazos</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {showFinanceModal && selectedBudget && (
                <FinanceModal
                    budget={selectedBudget}
                    onClose={() => setShowFinanceModal(false)}
                    onSave={handleSaveFinancing}
                />
            )}

            <BudgetModal
                isOpen={showBudgetModal}
                onClose={() => {
                    setShowBudgetModal(false);
                    setEditingBudget(null);
                }}
                patientId={patientId}
                onSave={refreshBudgets}
                initialBudget={editingBudget}
            />
        </div>
    );
};
