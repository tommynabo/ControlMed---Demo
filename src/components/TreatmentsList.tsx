import React, { useEffect, useState } from 'react';
import { Trash2, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { useAppContext } from '../context/AppContext';
import { PayWithWalletModal } from './PayWithWalletModal';

// Statuses that mean a treatment has been paid / completed
const DONE_STATUSES = ['COMPLETADO', 'PAGADO', 'COMPLETED'];

interface TreatmentsListProps {
    patientId: string;
    refreshTrigger?: number;
}

export const TreatmentsList: React.FC<TreatmentsListProps> = ({ patientId, refreshTrigger }) => {
    const { selectedPatient, setPatients } = useAppContext();
    const [treatments, setTreatments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCompleted, setShowCompleted] = useState(false);

    // Payment Modal State
    const [isPayModalOpen, setIsPayModalOpen] = useState(false);
    const [selectedGroupToPay, setSelectedGroupToPay] = useState<any[]>([]);

    const fetchTreatments = () => {
        setLoading(true);
        api.treatments.getByPatient(patientId)
            .then(setTreatments)
            .catch(err => console.error("Error fetching treatments:", err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        fetchTreatments();
    }, [patientId, refreshTrigger]);

    const handleDelete = async (ids: string[]) => {
        if (confirm("¿Seguro que quieres borrar estos tratamientos?")) {
            for (const id of ids) {
                await api.treatments.delete(id);
            }
            setTreatments(prev => prev.filter(t => !ids.includes(t.id)));
        }
    };

    const handleOpenPayModal = (group: any) => {
        setSelectedGroupToPay([group]);
        setIsPayModalOpen(true);
    };

    const handlePaymentComplete = async () => {
        fetchTreatments();
        if (selectedPatient) {
            try {
                const updatedList = await api.getPatients();
                setPatients(updatedList);
            } catch (e) { console.error(e); }
        }
    };

    if (loading) return <div className="text-center p-10 text-slate-400 text-xs">Cargando...</div>;

    if (treatments.length === 0) {
        return <div className="p-4 text-center text-slate-400 text-xs text-center mt-4">No hay tratamientos activos.</div>;
    }

    // Grouping Logic
    const grouped: any[] = Object.values(treatments.reduce((acc: any, t: any) => {
        const key = `${t.serviceName}-${t.status}-${t.price}`;
        if (!acc[key]) {
            acc[key] = { ...t, teeth: [t.toothId], count: 1, totalId: [t.id] };
        } else {
            acc[key].teeth.push(t.toothId);
            acc[key].count += 1;
            acc[key].totalId.push(t.id);
        }
        return acc;
    }, {}));

    const pendingGroups = grouped.filter(g => !DONE_STATUSES.includes(g.status));
    const completedGroups = grouped.filter(g => DONE_STATUSES.includes(g.status));

    const renderRow = (group: any, isDone: boolean) => (
        <div key={group.id} className={`grid grid-cols-12 gap-4 items-center p-3 rounded-xl text-[10px] font-black uppercase border transition-colors cursor-pointer text-left relative ${isDone ? 'bg-slate-50/60 border-slate-100 text-slate-400' : 'bg-slate-50 border-slate-100 text-slate-600 hover:bg-blue-50'}`}>

            {/* Teeth Column */}
            <div className="col-span-2 border-r border-slate-200 pr-2 text-center text-slate-400 relative">
                {group.count > 1 ? (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const el = document.getElementById(`teeth-popover-${group.id}`);
                            if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
                        }}
                        className="cursor-pointer bg-blue-50 text-blue-600 px-2 py-1 rounded-md text-[9px] font-bold hover:bg-blue-100 transition-colors"
                    >
                        x{group.count}
                    </button>
                ) : (
                    group.teeth[0] || '-'
                )}

                {group.count > 1 && (
                    <div
                        id={`teeth-popover-${group.id}`}
                        style={{ display: 'none' }}
                        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-800 text-white text-[10px] p-3 rounded-xl shadow-xl w-max z-50 animate-in zoom-in-95"
                    >
                        <p className="font-bold mb-1 opacity-50 uppercase tracking-wider text-[8px]">Piezas Afectadas</p>
                        <div className="font-mono text-xs text-nowrap">{group.teeth.join(', ')}</div>
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                    </div>
                )}
            </div>

            <div className={`col-span-4 line-clamp-2 flex flex-col ${isDone ? 'line-through text-slate-400' : 'text-slate-900'}`} title={group.serviceName}>
                <span>{group.serviceName}</span>
                {group.notes && <span className="text-[9px] text-slate-400 normal-case no-underline" style={{ textDecoration: 'none' }}>{group.notes}</span>}
                {group.updated_by_name && (
                    <span className="text-[8px] text-slate-400 normal-case font-normal opacity-70" title={`Última mod.: ${group.updated_by_name}`}>
                        ✎ {group.updated_by_name}
                    </span>
                )}
            </div>

            <div className={`col-span-2 font-bold ${DONE_STATUSES.includes(group.status) ? 'text-emerald-600' : 'text-amber-500'}`}>
                {group.status}
            </div>

            <div className={`col-span-3 ${isDone ? 'text-slate-400' : 'text-slate-900'}`}>
                {group.price * group.count}€ {group.count > 1 && <span className="text-slate-400 text-[9px]">({group.price}€/u)</span>}
            </div>

            <div className="col-span-1 text-right flex justify-end gap-2">
                {!isDone && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleOpenPayModal(group);
                        }}
                        className="text-slate-400 hover:text-emerald-500 transition-colors"
                        title="Pagar con Saldo"
                    >
                        <Wallet size={12} />
                    </button>
                )}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(group.totalId);
                    }}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                >
                    <Trash2 size={12} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="space-y-2 mt-4">
            {/* ── Pending / Active treatments ── */}
            {pendingGroups.length === 0 ? (
                <div className="p-4 text-center text-slate-400 text-xs mt-2">No hay tratamientos pendientes.</div>
            ) : (
                pendingGroups.map((group: any) => renderRow(group, false))
            )}

            {/* ── Completed / Paid treatments (collapsible) ── */}
            {completedGroups.length > 0 && (
                <div className="mt-4">
                    <button
                        onClick={() => setShowCompleted(v => !v)}
                        className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 transition-colors w-full text-left py-2 px-1 border-t border-slate-200"
                    >
                        {showCompleted ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        <span className="text-emerald-600">✔ Tratamientos completados / pagados</span>
                        <span className="ml-1 bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full text-[9px]">{completedGroups.length}</span>
                    </button>
                    {showCompleted && (
                        <div className="space-y-2 mt-2">
                            {completedGroups.map((group: any) => renderRow(group, true))}
                        </div>
                    )}
                </div>
            )}

            {/* Payment Modal */}
            {selectedPatient && (
                <PayWithWalletModal
                    isOpen={isPayModalOpen}
                    onClose={() => setIsPayModalOpen(false)}
                    patient={selectedPatient}
                    treatments={selectedGroupToPay}
                    onPaymentComplete={handlePaymentComplete}
                />
            )}
        </div>
    );
};
