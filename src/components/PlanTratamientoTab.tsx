import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Check, Clock, ChevronDown, ChevronUp, ClipboardList, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Patient, ClinicalTreatmentPlan, ClinicalTreatmentStep } from '../../types';

interface PlanTratamientoTabProps {
    patient: Patient;
    api: any;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
    'PENDIENTE': { label: 'Pendiente', color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200', icon: <Clock size={14} /> },
    'EN_PROCESO': { label: 'En Proceso', color: 'text-blue-600', bg: 'bg-blue-50 border-blue-200', icon: <AlertCircle size={14} /> },
    'COMPLETADO': { label: 'Completado', color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200', icon: <Check size={14} /> },
};

const nextStatus = (current: string) => {
    if (current === 'PENDIENTE') return 'EN_PROCESO';
    if (current === 'EN_PROCESO') return 'COMPLETADO';
    return 'PENDIENTE';
};

export const PlanTratamientoTab: React.FC<PlanTratamientoTabProps> = ({ patient, api }) => {
    const [plans, setPlans] = useState<ClinicalTreatmentPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
    const [showCompleted, setShowCompleted] = useState(false);
    const [showDoneStepsPerPlan, setShowDoneStepsPerPlan] = useState<Set<string>>(new Set());
    const [showNewPlan, setShowNewPlan] = useState(false);
    const [newPlanName, setNewPlanName] = useState('');
    const [newStepName, setNewStepName] = useState('');
    const [newStepTooth, setNewStepTooth] = useState('');
    const [addingStepToPlan, setAddingStepToPlan] = useState<string | null>(null);
    const [dbServices, setDbServices] = useState<{ id: string; name: string; specialty_name: string }[]>([]);
    const [updatingStepId, setUpdatingStepId] = useState<string | null>(null);

    const fetchPlans = async () => {
        try {
            setLoading(true);
            const data = await api.clinicalPlans.getByPatient(patient.id);
            // Normalize DB column names to camelCase
            const normalized = (data || []).map((p: any) => ({
                id: p.id,
                patientId: p.patient_id || p.patientId,
                name: p.name,
                status: p.status,
                notes: p.notes,
                createdAt: p.created_at || p.createdAt,
                updatedAt: p.updated_at || p.updatedAt,
                steps: (p.steps || []).map((s: any) => ({
                    id: s.id,
                    planId: s.plan_id || s.planId,
                    stepOrder: s.step_order ?? s.stepOrder ?? 0,
                    treatmentName: s.treatment_name || s.treatmentName,
                    toothId: s.tooth_id ?? s.toothId,
                    status: s.status,
                    notes: s.notes,
                    completedAt: s.completed_at || s.completedAt,
                    createdAt: s.created_at || s.createdAt
                })).sort((a: any, b: any) => a.stepOrder - b.stepOrder)
            }));
            setPlans(normalized);
            if (normalized.length > 0 && !expandedPlan) {
                setExpandedPlan(normalized[0].id);
            }
        } catch (e) {
            console.error('Error fetching plans:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchPlans(); }, [patient.id]);

    useEffect(() => {
        api.services.getAll().then((data: any[]) => setDbServices(data || [])).catch(() => {});
    }, []);

    const handleCreatePlan = async () => {
        if (!newPlanName.trim()) return;
        try {
            await api.clinicalPlans.create({
                patientId: patient.id,
                name: newPlanName.trim()
            });
            setNewPlanName('');
            setShowNewPlan(false);
            fetchPlans();
        } catch (e) {
            alert('Error al crear plan: ' + (e as Error).message);
        }
    };

    const handleDeletePlan = async (planId: string) => {
        if (!confirm('¿Eliminar este plan y todos sus pasos?')) return;
        try {
            await api.clinicalPlans.delete(planId);
            fetchPlans();
        } catch (e) {
            alert('Error al eliminar: ' + (e as Error).message);
        }
    };

    const handleToggleStepStatus = async (step: ClinicalTreatmentStep) => {
        if (updatingStepId === step.id) return;
        const newSt = nextStatus(step.status);
        // Optimistic update — change UI immediately before the server responds
        setPlans(prev => prev.map(plan => ({
            ...plan,
            steps: plan.steps.map(s => s.id === step.id ? { ...s, status: newSt } : s)
        })));
        setUpdatingStepId(step.id);
        try {
            await api.clinicalPlans.updateStep(step.id, { status: newSt });
            await fetchPlans();
        } catch (e) {
            // Revert optimistic update on failure
            setPlans(prev => prev.map(plan => ({
                ...plan,
                steps: plan.steps.map(s => s.id === step.id ? { ...s, status: step.status } : s)
            })));
            toast.error('Error al guardar el estado del tratamiento');
        } finally {
            setUpdatingStepId(null);
        }
    };

    const handleAddStep = async (planId: string) => {
        if (!newStepName.trim()) return;
        try {
            await api.clinicalPlans.addStep({
                planId,
                treatmentName: newStepName.trim(),
                toothId: newStepTooth ? parseInt(newStepTooth) : undefined
            });
            setNewStepName('');
            setNewStepTooth('');
            setAddingStepToPlan(null);
            fetchPlans();
        } catch (e) {
            alert('Error al añadir paso: ' + (e as Error).message);
        }
    };

    const handleDeleteStep = async (stepId: string) => {
        try {
            await api.clinicalPlans.deleteStep(stepId);
            fetchPlans();
        } catch (e) {
            console.error('Error deleting step:', e);
        }
    };

    const handleUpdatePlanStatus = async (planId: string, status: string) => {
        try {
            await api.clinicalPlans.update(planId, { status });
            fetchPlans();
        } catch (e) {
            console.error('Error updating plan:', e);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-40 text-slate-400">
                <div className="animate-spin w-8 h-8 border-4 border-slate-200 border-t-slate-600 rounded-full"></div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-black text-slate-900 tracking-tight">Plan de Tratamiento</h2>
                    <p className="text-xs text-slate-400 mt-1">Checklist clínico de tratamientos ordenados</p>
                </div>
                <button
                    onClick={() => setShowNewPlan(true)}
                    className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg"
                >
                    <Plus size={16} /> Nuevo Plan
                </button>
            </div>

            {/* New Plan Form */}
            {showNewPlan && (
                <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-lg animate-in slide-in-from-top-4">
                    <h3 className="text-sm font-black text-slate-700 mb-4">Crear Nuevo Plan</h3>
                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={newPlanName}
                            onChange={(e) => setNewPlanName(e.target.value)}
                            placeholder="Nombre del plan (ej: Rehabilitación sector 2)"
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-blue-100"
                            onKeyDown={(e) => e.key === 'Enter' && handleCreatePlan()}
                        />
                        <button
                            onClick={handleCreatePlan}
                            className="bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-bold hover:bg-emerald-700 transition-colors"
                        >
                            Crear
                        </button>
                        <button
                            onClick={() => { setShowNewPlan(false); setNewPlanName(''); }}
                            className="px-4 py-3 text-xs font-bold text-slate-400 hover:text-slate-600"
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Plans List */}
            {plans.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center">
                    <ClipboardList className="mx-auto text-slate-300 mb-4" size={48} />
                    <p className="text-sm font-bold text-slate-400">No hay planes de tratamiento</p>
                    <p className="text-xs text-slate-300 mt-1">Crea un plan para organizar los tratamientos del paciente</p>
                </div>
            ) : (
                <>
                {(() => {
                    const activePlans = plans.filter(p => p.status !== 'COMPLETED' && p.status !== 'CANCELLED');
                    const completedPlans = plans.filter(p => p.status === 'COMPLETED' || p.status === 'CANCELLED');
                    const visiblePlans = [...activePlans, ...(showCompleted ? completedPlans : [])];
                    return (
                        <>
                        {completedPlans.length > 0 && (
                            <div className="flex justify-end">
                                <button
                                    onClick={() => setShowCompleted(v => !v)}
                                    className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                                >
                                    {showCompleted ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    {showCompleted ? 'Ocultar completados' : `Mostrar completados (${completedPlans.length})`}
                                </button>
                            </div>
                        )}
                        {visiblePlans.map(plan => {
                            const isExpanded = expandedPlan === plan.id;
                            const completedSteps = plan.steps.filter(s => s.status === 'COMPLETADO').length;
                            const totalSteps = plan.steps.length;
                            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

                            return (
                                <div key={plan.id} className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">
                            {/* Plan Header */}
                            <div
                                className="p-6 flex items-center gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                                onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                            >
                                <div className="flex-1">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-black text-slate-900">{plan.name}</h3>
                                        <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${plan.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                                plan.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                                    'bg-red-50 text-red-600 border-red-200'
                                            }`}>
                                            {plan.status === 'ACTIVE' ? 'Activo' : plan.status === 'COMPLETED' ? 'Completado' : 'Cancelado'}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <p className="text-xs text-slate-400">{completedSteps}/{totalSteps} pasos completados</p>
                                        <div className="flex-1 max-w-48 bg-slate-100 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                                style={{ width: `${progress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-slate-500">{progress}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    {plan.status === 'ACTIVE' && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleUpdatePlanStatus(plan.id, 'COMPLETED'); }}
                                            className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                                            title="Marcar como completado"
                                        >
                                            <Check size={18} />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDeletePlan(plan.id); }}
                                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                        title="Eliminar plan"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    {isExpanded ? <ChevronUp size={20} className="text-slate-400" /> : <ChevronDown size={20} className="text-slate-400" />}
                                </div>
                            </div>

                            {/* Steps List */}
                            {isExpanded && (
                                <div className="border-t border-slate-100">
                                    {plan.steps.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-slate-400">
                                            No hay pasos aún. Añade el primer paso.
                                        </div>
                                    ) : (
                                        <>
                                            <div className="divide-y divide-slate-50">
                                                {(showDoneStepsPerPlan.has(plan.id) ? plan.steps : plan.steps.filter(s => s.status !== 'COMPLETADO')).map((step, idx) => {
                                                    const cfg = STATUS_CONFIG[step.status] || STATUS_CONFIG['PENDIENTE'];
                                                    return (
                                                        <div key={step.id} className="px-6 py-4 flex items-center gap-4 hover:bg-slate-50/50 transition-colors group">
                                                            <span className="text-xs font-black text-slate-300 w-6 text-center">{idx + 1}</span>
                                                            <button
                                                                onClick={() => handleToggleStepStatus(step)}
                                                                disabled={updatingStepId === step.id}
                                                                className={`w-8 h-8 rounded-lg border-2 flex items-center justify-center transition-all ${cfg.bg} ${cfg.color} ${updatingStepId === step.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                                title={`Click para cambiar a: ${STATUS_CONFIG[nextStatus(step.status)].label}`}
                                                            >
                                                                {cfg.icon}
                                                            </button>
                                                            <div className="flex-1">
                                                                <p className={`text-sm font-bold ${step.status === 'COMPLETADO' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                                                                    {step.treatmentName}
                                                                </p>
                                                                {step.toothId && (
                                                                    <span className="text-[10px] font-bold text-slate-400">Diente #{step.toothId}</span>
                                                                )}
                                                            </div>
                                                            <span className={`text-[10px] font-black uppercase ${cfg.color}`}>{cfg.label}</span>
                                                            <button
                                                                onClick={() => handleDeleteStep(step.id)}
                                                                className="opacity-0 group-hover:opacity-100 p-1 text-red-300 hover:text-red-500 transition-all"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                            {plan.steps.filter(s => s.status === 'COMPLETADO').length > 0 && (
                                                <div className="px-6 pb-2">
                                                    <button
                                                        onClick={() => setShowDoneStepsPerPlan(prev => {
                                                            const next = new Set(prev);
                                                            if (next.has(plan.id)) next.delete(plan.id); else next.add(plan.id);
                                                            return next;
                                                        })}
                                                        className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1.5 py-1.5 transition-colors"
                                                    >
                                                        {showDoneStepsPerPlan.has(plan.id) ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                                        {showDoneStepsPerPlan.has(plan.id) ? 'Ocultar realizados' : `Realizados (${plan.steps.filter(s => s.status === 'COMPLETADO').length})`}
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* Add Step */}
                                    {addingStepToPlan === plan.id ? (
                                        <div className="p-6 bg-slate-50/80 border-t border-slate-100">
                                            <div className="flex gap-3">
                                                <select
                                                    value={newStepName}
                                                    onChange={(e) => setNewStepName(e.target.value)}
                                                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                                                >
                                                    <option value="">Seleccionar tratamiento...</option>
                                                    {(Object.entries(
                                                        dbServices.reduce((acc: Record<string, Array<{ id: string; name: string; specialty_name: string }>>, s) => {
                                                            const spec = s.specialty_name || 'Otros';
                                                            if (!acc[spec]) acc[spec] = [];
                                                            acc[spec].push(s);
                                                            return acc;
                                                        }, {})
                                                    ) as [string, Array<{ id: string; name: string; specialty_name: string }>][]).sort().map(([spec, items]) => (
                                                        <optgroup key={spec} label={spec}>
                                                            {items.map(s => (
                                                                <option key={s.id} value={s.name}>{s.name}</option>
                                                            ))}
                                                        </optgroup>
                                                    ))}
                                                    <option value="__custom">✏️ Escribir manualmente...</option>
                                                </select>
                                                {newStepName === '__custom' && (
                                                    <input
                                                        type="text"
                                                        placeholder="Nombre del tratamiento"
                                                        className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium outline-none"
                                                        onChange={(e) => setNewStepName(e.target.value)}
                                                    />
                                                )}
                                                <input
                                                    type="number"
                                                    value={newStepTooth}
                                                    onChange={(e) => setNewStepTooth(e.target.value)}
                                                    placeholder="Diente"
                                                    className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-3 text-sm font-medium outline-none text-center"
                                                />
                                                <button
                                                    onClick={() => handleAddStep(plan.id)}
                                                    className="bg-slate-900 text-white px-5 py-3 rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors"
                                                >
                                                    Añadir
                                                </button>
                                                <button
                                                    onClick={() => { setAddingStepToPlan(null); setNewStepName(''); setNewStepTooth(''); }}
                                                    className="px-3 text-xs text-slate-400 hover:text-slate-600"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-4 border-t border-slate-100">
                                            <button
                                                onClick={() => setAddingStepToPlan(plan.id)}
                                                className="w-full py-3 text-xs font-bold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                                            >
                                                <Plus size={14} /> Añadir paso al plan
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                            );
                        })}
                        </>
                    );
                })()}
                </>
            )}
        </div>
    );
};

export default PlanTratamientoTab;
