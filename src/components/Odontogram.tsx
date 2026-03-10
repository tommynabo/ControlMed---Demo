import React, { useState, useEffect } from 'react';
import { Search, Trash2, FileText, Plus, X, Save, Users, Baby } from 'lucide-react';
import { PatientTreatment } from '../../types';
import { useAppContext } from '../context/AppContext';

interface OdontogramProps {
    patientId: string;
    isEditable: boolean;
    onTreatmentsChange?: (treatments: PatientTreatment[]) => void;
}

// SVG PATHS para dientes
const PATHS = {
    incisor: "M10,5 L20,5 L22,30 L15,45 L8,30 Z",
    canine: "M15,2 L25,10 L22,35 L15,50 L8,35 L5,10 Z",
    premolar: "M5,5 L25,5 L28,25 L15,40 L2,25 Z",
    molar: "M2,5 L10,2 L20,2 L28,5 L30,20 L25,35 L15,40 L5,35 L0,20 Z"
};

const getToothShape = (id: number): string => {
    if (id >= 51) {
        const lastDigit = id % 10;
        if (lastDigit >= 1 && lastDigit <= 3) return PATHS.incisor;
        return PATHS.molar;
    }
    const lastDigit = id % 10;
    if (lastDigit >= 1 && lastDigit <= 2) return PATHS.incisor;
    if (lastDigit === 3) return PATHS.canine;
    if (lastDigit === 4 || lastDigit === 5) return PATHS.premolar;
    return PATHS.molar;
};

interface Service {
    id: string;
    name: string;
    final_price: number;
    specialty_name?: string;
    specialty_color?: string;
}

// Quadrants
const ADULT_QUADRANTS = {
    Q1: [18, 17, 16, 15, 14, 13, 12, 11],
    Q2: [21, 22, 23, 24, 25, 26, 27, 28],
    Q3: [31, 32, 33, 34, 35, 36, 37, 38],
    Q4: [48, 47, 46, 45, 44, 43, 42, 41],
};

const CHILD_QUADRANTS = {
    Q5: [55, 54, 53, 52, 51],
    Q6: [61, 62, 63, 64, 65],
    Q7: [71, 72, 73, 74, 75],
    Q8: [85, 84, 83, 82, 81]
};

type DentitionMode = 'adult' | 'child';

export const Odontogram: React.FC<OdontogramProps> = ({
    patientId,
    isEditable,
    onTreatmentsChange
}) => {
    const { api } = useAppContext();

    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTreatmentsForBudget, setSelectedTreatmentsForBudget] = useState<string[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loadingServices, setLoadingServices] = useState(true);
    const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
    const [isSaving, setIsSaving] = useState(false);

    // Fetch services from API
    useEffect(() => {
        if (api?.services?.getAll) {
            setLoadingServices(true);
            api.services.getAll()
                .then((data: Service[]) => {
                    setServices(data || []);
                    setLoadingServices(false);
                })
                .catch((err: any) => {
                    console.error("Error cargando servicios:", err);
                    setLoadingServices(false);
                });
        }
    }, [api]);

    // Fetch patient treatments
    useEffect(() => {
        if (patientId && api?.treatments?.getByPatient) {
            api.treatments.getByPatient(patientId)
                .then((data: PatientTreatment[]) => {
                    const visible = (data || []).filter(t => t.status !== 'PRESUPUESTADO');
                    setTreatments(visible);
                    onTreatmentsChange?.(visible);
                })
                .catch(err => console.error("Error cargando tratamientos:", err));
        }
    }, [patientId, api]);

    const getToothTreatments = (toothId: number) => treatments.filter(t => t.toothId === toothId);

    const filteredServices = services.filter(service => {
        const matchesSearch = service.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesSpecialty = !selectedSpecialty || service.specialty_name === selectedSpecialty;
        return matchesSearch && matchesSpecialty;
    });

    const handleToothClick = (toothId: number, event: React.MouseEvent) => {
        if (!isEditable) return;
        if (event.ctrlKey || event.metaKey) {
            setSelectedTeeth(prev =>
                prev.includes(toothId) ? prev.filter(id => id !== toothId) : [...prev, toothId]
            );
        } else {
            setSelectedTeeth([toothId]);
        }
    };

    const handleAddTreatment = (service: Service) => {
        if (selectedTeeth.length === 0) { alert('Selecciona al menos un diente'); return; }
        const newTreatments: PatientTreatment[] = selectedTeeth.map(toothId => ({
            id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            patientId, serviceId: service.id, serviceName: service.name,
            toothId, price: service.final_price, status: 'PENDIENTE', createdAt: new Date().toISOString()
        }));
        const updatedTreatments = [...treatments, ...newTreatments];
        setTreatments(updatedTreatments);
        onTreatmentsChange?.(updatedTreatments);
        setSelectedTeeth([]);
        setSearchTerm('');
    };

    const handleDeleteTreatment = async (treatmentId: string) => {
        if (!confirm('¿Eliminar este tratamiento?')) return;
        if (treatmentId.startsWith('temp-')) {
            const updated = treatments.filter(t => t.id !== treatmentId);
            setTreatments(updated); onTreatmentsChange?.(updated); return;
        }
        try {
            await api.treatments.delete(treatmentId);
            const updated = treatments.filter(t => t.id !== treatmentId);
            setTreatments(updated); onTreatmentsChange?.(updated);
        } catch (error) { console.error(error); alert("Error al eliminar."); }
    };

    const handleSaveTreatments = async () => {
        setIsSaving(true);
        try {
            const newTreatments = treatments.filter(t => t.id.startsWith('temp-'));
            if (newTreatments.length === 0) { alert("No hay cambios."); setIsSaving(false); return; }
            const treatmentsPayload = newTreatments.map(({ id, ...rest }) => rest);
            await api.treatments.createBatch(patientId, treatmentsPayload);
            const reloaded = await api.treatments.getByPatient(patientId);
            setTreatments(reloaded); onTreatmentsChange?.(reloaded);
            alert("✅ Guardado.");
        } catch (error) { console.error(error); alert("Error al guardar."); }
        finally { setIsSaving(false); }
    };

    const handleCreateBudget = async () => {
        let itemsToBudget = selectedTreatmentsForBudget.length > 0
            ? treatments.filter(t => selectedTreatmentsForBudget.includes(t.id))
            : treatments.filter(t => t.status === 'PENDIENTE');
        if (itemsToBudget.length === 0 && treatments.length > 0) itemsToBudget = treatments;
        if (itemsToBudget.length === 0) { alert('No hay tratamientos.'); return; }

        if (confirm(`¿Crear presupuesto con ${itemsToBudget.length} tratamientos?`)) {
            try {
                const tempItems = itemsToBudget.filter(t => t.id.startsWith('temp-'));
                let finalItems = itemsToBudget;
                if (tempItems.length > 0) {
                    setIsSaving(true);
                    await api.treatments.createBatch(patientId, tempItems.map(({ id, ...rest }) => rest));
                    const reloaded = await api.treatments.getByPatient(patientId);
                    setTreatments(reloaded); onTreatmentsChange?.(reloaded);
                    finalItems = reloaded.filter(t => t.status === 'PENDIENTE');
                    setIsSaving(false);
                }
                if (finalItems.length === 0) { alert("Error recuperando tratamientos."); return; }
                const budgetItems = finalItems.map(t => ({
                    id: crypto.randomUUID(),
                    name: `${t.serviceName} - Diente ${t.toothId || 'General'}`,
                    price: t.price,
                    serviceId: t.serviceId,
                    treatmentId: t.id,
                    tooth: t.toothId || null
                }));
                await api.budget.create(patientId, budgetItems, "Presupuesto Odontograma - " + new Date().toLocaleDateString());
                alert(`✅ Presupuesto creado.`);
                setSelectedTreatmentsForBudget([]);
            } catch (error) { console.error(error); alert("Error: " + (error.message || error)); setIsSaving(false); }
        }
    };

    return (
        <div className="w-full space-y-6">
            <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 rounded-[2rem] p-8 border border-slate-200/80 shadow-xl relative overflow-hidden">

                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-[0.015] pointer-events-none">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
                </div>

                {/* Header with Save */}
                <div className="relative z-10 flex flex-wrap items-center justify-end gap-4 mb-8">
                    <button
                        onClick={handleSaveTreatments}
                        disabled={isSaving || !treatments.some(t => t.id.startsWith('temp-'))}
                        className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-3 rounded-xl text-sm font-black uppercase flex items-center gap-2 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                    >
                        <Save size={18} />
                        {isSaving ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>

                {/* Odontogram Visual */}
                <div className="relative z-10 bg-white/70 backdrop-blur-sm rounded-3xl p-8 border border-slate-100 shadow-inner overflow-x-auto custom-scrollbar">

                    {/* Grid Layout */}
                    <div className="flex flex-col items-center gap-2">

                        {/* 1. Adult Upper */}
                        <div className="flex items-center justify-center gap-8">
                            <div className="flex items-center gap-1">
                                {ADULT_QUADRANTS.Q1.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} />
                                ))}
                            </div>
                            <div className="flex items-center gap-1">
                                {ADULT_QUADRANTS.Q2.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} />
                                ))}
                            </div>
                        </div>

                        {/* 2. Child Upper (Centered) */}
                        <div className="flex items-center justify-center gap-8 px-12">
                            <div className="flex items-center gap-1">
                                {CHILD_QUADRANTS.Q5.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} isChild />
                                ))}
                            </div>
                            <div className="flex items-center gap-1">
                                {CHILD_QUADRANTS.Q6.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} isChild />
                                ))}
                            </div>
                        </div>

                        {/* Spacer/Center Line */}
                        <div className="w-full max-w-lg h-px bg-slate-200 my-2"></div>

                        {/* 3. Child Lower (Centered) */}
                        <div className="flex items-center justify-center gap-8 px-12">
                            <div className="flex items-center gap-1">
                                {CHILD_QUADRANTS.Q8.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} isChild />
                                ))}
                            </div>
                            <div className="flex items-center gap-1">
                                {CHILD_QUADRANTS.Q7.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} isChild />
                                ))}
                            </div>
                        </div>

                        {/* 4. Adult Lower */}
                        <div className="flex items-center justify-center gap-8">
                            <div className="flex items-center gap-1">
                                {ADULT_QUADRANTS.Q4.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} />
                                ))}
                            </div>
                            <div className="flex items-center gap-1">
                                {ADULT_QUADRANTS.Q3.map(toothId => (
                                    <Tooth key={toothId} id={toothId} treatments={getToothTreatments(toothId)} isSelected={selectedTeeth.includes(toothId)} onClick={(e) => handleToothClick(toothId, e)} />
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Selected Teeth */}
                {selectedTeeth.length > 0 && (
                    <div className="relative z-10 mt-6 mx-auto max-w-2xl p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                            <p className="text-sm font-black text-violet-900">
                                Seleccionados: <span className="text-violet-600">{selectedTeeth.join(', ')}</span>
                            </p>
                            <button onClick={() => setSelectedTeeth([])} className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1">
                                <X size={14} /> Limpiar
                            </button>
                        </div>
                        <p className="text-xs text-violet-700">👇 Busca un tratamiento abajo</p>
                    </div>
                )}

                {/* Search */}
                <div className="relative z-10 mt-8 pt-6 border-t border-slate-200/50">
                    <label className="text-xs font-black uppercase text-slate-400 mb-3 block">🔍 Buscar Tratamiento</label>
                    <div className="relative mb-4">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                        <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Ej: Limpieza, Extracción..."
                            className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all" />
                    </div>
                    {searchTerm.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {filteredServices.length === 0 ? (
                                <div className="col-span-full text-center p-6 text-slate-400 text-sm">No encontrado</div>
                            ) : (
                                filteredServices.map(service => (
                                    <button key={service.id} onClick={() => handleAddTreatment(service)} disabled={selectedTeeth.length === 0}
                                        className="group p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-violet-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left">
                                        <p className="text-sm font-black text-slate-900 mb-1">{service.name}</p>
                                        <p className="text-xs font-bold text-violet-600">{service.final_price}€</p>
                                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 group-hover:text-violet-600"><Plus size={12} /><span>Añadir</span></div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Treatments Table */}
            <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg">
                <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
                    <h4 className="text-lg font-black text-slate-900">📋 Tratamientos ({treatments.length})</h4>
                    <button onClick={handleCreateBudget} disabled={selectedTreatmentsForBudget.length === 0}
                        className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-6 py-3 rounded-xl text-xs font-black flex items-center gap-2 hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                        <FileText size={16} /> Presupuestar ({selectedTreatmentsForBudget.length})
                    </button>
                </div>
                <div className="w-full overflow-x-auto">
                    <div className="min-w-[600px] space-y-2">
                        <div className="grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
                            <div className="col-span-1"><input type="checkbox" checked={selectedTreatmentsForBudget.length === treatments.length && treatments.length > 0} onChange={(e) => { e.target.checked ? setSelectedTreatmentsForBudget(treatments.map(t => t.id)) : setSelectedTreatmentsForBudget([]); }} className="w-4 h-4 rounded cursor-pointer" /></div>
                            <div className="col-span-1">Diente</div><div className="col-span-5">Tratamiento</div><div className="col-span-2">Precio</div><div className="col-span-2">Estado</div><div className="col-span-1 text-right">-</div>
                        </div>
                        <div className="space-y-2 mt-4">
                            {treatments.length === 0 ? (
                                <div className="text-center py-12 text-slate-400"><p className="text-sm font-bold mb-2">No hay tratamientos</p><p className="text-xs">Selecciona dientes arriba</p></div>
                            ) : (
                                treatments.map((treatment) => (
                                    <div key={treatment.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl text-sm border border-slate-100 hover:border-violet-200 transition-colors">
                                        <div className="col-span-1"><input type="checkbox" checked={selectedTreatmentsForBudget.includes(treatment.id)} onChange={(e) => { e.target.checked ? setSelectedTreatmentsForBudget(prev => [...prev, treatment.id]) : setSelectedTreatmentsForBudget(prev => prev.filter(id => id !== treatment.id)); }} className="w-4 h-4 rounded cursor-pointer" /></div>
                                        <div className="col-span-1 font-black text-violet-600 text-center text-lg">{treatment.toothId}</div>
                                        <div className="col-span-5 font-bold text-slate-900">{treatment.serviceName}</div>
                                        <div className="col-span-2 font-black text-slate-900">{treatment.price}€</div>
                                        <div className="col-span-2"><span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${treatment.status === 'COMPLETADO' ? 'bg-green-100 text-green-600' : treatment.status === 'EN_PROCESO' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>{treatment.status}</span></div>
                                        <div className="col-span-1 flex justify-end"><button onClick={() => handleDeleteTreatment(treatment.id)} className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={16} /></button></div>
                                    </div>
                                ))
                            )}
                        </div>
                        {treatments.length > 0 && (
                            <div className="mt-6 pt-6 border-t border-slate-200 flex justify-between items-center">
                                <p className="text-sm font-bold text-slate-600">Total:</p>
                                <p className="text-2xl font-black text-slate-900">{treatments.reduce((sum, t) => sum + t.price, 0)}€</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// Tooth Component
const Tooth: React.FC<{
    id: number;
    treatments: PatientTreatment[];
    isSelected: boolean;
    onClick: (e: React.MouseEvent) => void;
    isChild?: boolean;
}> = ({ id, treatments, isSelected, onClick, isChild }) => {
    const shape = getToothShape(id);
    const hasTreatment = treatments.length > 0;

    return (
        <div className={`relative flex flex-col items-center group cursor-pointer ${isChild ? 'w-[36px] md:w-[48px]' : 'w-[40px] md:w-[52px]'}`} onClick={onClick}>
            <div className={`relative transition-all duration-200 ${isSelected ? 'scale-110 -translate-y-1' : 'hover:scale-105'}`}>
                <svg width={isChild ? "36" : "44"} height={isChild ? "50" : "60"} viewBox="0 0 30 50" className="overflow-visible drop-shadow-sm">
                    <defs>
                        <linearGradient id={`toothGrad-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor={isSelected ? '#ede9fe' : '#ffffff'} />
                            <stop offset="100%" stopColor={isSelected ? '#ddd6fe' : '#f1f5f9'} />
                        </linearGradient>
                    </defs>
                    <path d={shape} fill={`url(#toothGrad-${id})`} stroke={isSelected ? '#8b5cf6' : (hasTreatment ? '#f59e0b' : '#cbd5e1')} strokeWidth={isSelected ? 2.5 : 1.5} className="transition-all duration-200" />
                </svg>
                {hasTreatment && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white shadow-sm animate-pulse"></div>
                )}
            </div>
            <span className={`mt-1 text-[9px] font-black transition-colors ${isSelected ? 'text-violet-700' : 'text-slate-500'}`}>{id}</span>
        </div>
    );
};

export default Odontogram;
