import React, { useState, useEffect } from 'react';
import { Info, Plus, Save, Trash2, X } from 'lucide-react';
import { PatientTreatment } from '../types';
import { useAppContext } from '../context/AppContext';

interface OdontogramProps {
    patientId:  string;
    isEditable: boolean;
    onTreatmentsChange?: (treatments: PatientTreatment[]) => void;
}

interface Service {
    id: string;
    name: string;
    final_price: number;
    specialty_name?: string;
    specialty_color?: string;
}

// Surfaces of a tooth
type ToothSurface = 'V' | 'L' | 'M' | 'D' | 'O';
const SURFACE_LABELS: Record<ToothSurface, string> = {
    V: 'Vestibular',
    L: 'Lingual/Palatino',
    M: 'Mesial',
    D: 'Distal',
    O: 'Oclusal/Incisal',
};

// Color scheme
const COLORS = {
    healthy:    '#e8f5ff',
    healthyBorder: '#b0d4f1',
    treatment:  '#a78bfa',
    treatmentBorder: '#7c3aed',
    selected:   '#fbbf24',
    selectedBorder: '#d97706',
    pending:    '#f87171',
    pendingBorder: '#dc2626',
    completed:  '#34d399',
    completedBorder: '#059669',
    hoverFill:  '#dbeafe',
};

// Quadrant definitions – FDI numbering
const QUADRANTS = {
    Q1: [18, 17, 16, 15, 14, 13, 12, 11],
    Q2: [21, 22, 23, 24, 25, 26, 27, 28],
    Q4: [48, 47, 46, 45, 44, 43, 42, 41],
    Q3: [31, 32, 33, 34, 35, 36, 37, 38],
};

// Classic 5‑surface SVG tooth (40×40 viewBox)
// Top=V, Bottom=L, Left & Right=M/D depending on quadrant
const ToothDiagram: React.FC<{
    id: number;
    surfaceColors: Record<ToothSurface, string>;
    selectedSurfaces: ToothSurface[];
    onSurfaceClick: (surface: ToothSurface) => void;
    onWholeToothClick: () => void;
    isEditable: boolean;
    isUpper: boolean;
    isSelected: boolean;
}> = ({ id, surfaceColors, selectedSurfaces, onSurfaceClick, onWholeToothClick, isEditable, isUpper, isSelected }) => {
    const [hoveredSurface, setHoveredSurface] = useState<ToothSurface | null>(null);

    // Determine mesial/distal sides based on quadrant
    // Q1 (18‑11) & Q4 (48‑41): mesial is right (toward center), distal is left
    // Q2 (21‑28) & Q3 (31‑38): mesial is left (toward center), distal is right
    const quadrant = Math.floor(id / 10);
    const mesialIsRight = quadrant === 1 || quadrant === 4;

    const leftSurface: ToothSurface = mesialIsRight ? 'D' : 'M';
    const rightSurface: ToothSurface = mesialIsRight ? 'M' : 'D';
    const topSurface: ToothSurface = 'V';
    const bottomSurface: ToothSurface = 'L';

    const getFill = (surface: ToothSurface) => {
        if (selectedSurfaces.includes(surface)) return COLORS.selected;
        if (hoveredSurface === surface && isEditable) return COLORS.hoverFill;
        return surfaceColors[surface];
    };

    const getStroke = (surface: ToothSurface) => {
        if (selectedSurfaces.includes(surface)) return COLORS.selectedBorder;
        return '#64748b';
    };

    const handleClick = (surface: ToothSurface, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isEditable) return;
        onSurfaceClick(surface);
    };

    return (
        <div className={`flex flex-col items-center ${isEditable ? 'cursor-pointer' : ''}`}>
            {/* Tooth number - on top for upper teeth */}
            {isUpper && (
                <span className={`text-[10px] font-black mb-0.5 transition-colors ${isSelected ? 'text-amber-600' : 'text-slate-500'}`}>
                    {id}
                </span>
            )}

            <svg
                width="38" height="38" viewBox="0 0 40 40"
                className={`drop-shadow-sm transition-transform ${isSelected ? 'scale-110' : isEditable ? 'hover:scale-105' : ''}`}
                onClick={(e) => { e.stopPropagation(); if (isEditable) onWholeToothClick(); }}
            >
                {/* Top trapezoid (Vestibular) */}
                <polygon
                    points="0,0 40,0 28,12 12,12"
                    fill={getFill(topSurface)}
                    stroke={getStroke(topSurface)}
                    strokeWidth="1.2"
                    className="transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredSurface(topSurface)}
                    onMouseLeave={() => setHoveredSurface(null)}
                    onClick={(e) => handleClick(topSurface, e)}
                />
                {/* Right trapezoid */}
                <polygon
                    points="40,0 40,40 28,28 28,12"
                    fill={getFill(rightSurface)}
                    stroke={getStroke(rightSurface)}
                    strokeWidth="1.2"
                    className="transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredSurface(rightSurface)}
                    onMouseLeave={() => setHoveredSurface(null)}
                    onClick={(e) => handleClick(rightSurface, e)}
                />
                {/* Bottom trapezoid (Lingual/Palatino) */}
                <polygon
                    points="40,40 0,40 12,28 28,28"
                    fill={getFill(bottomSurface)}
                    stroke={getStroke(bottomSurface)}
                    strokeWidth="1.2"
                    className="transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredSurface(bottomSurface)}
                    onMouseLeave={() => setHoveredSurface(null)}
                    onClick={(e) => handleClick(bottomSurface, e)}
                />
                {/* Left trapezoid */}
                <polygon
                    points="0,40 0,0 12,12 12,28"
                    fill={getFill(leftSurface)}
                    stroke={getStroke(leftSurface)}
                    strokeWidth="1.2"
                    className="transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredSurface(leftSurface)}
                    onMouseLeave={() => setHoveredSurface(null)}
                    onClick={(e) => handleClick(leftSurface, e)}
                />
                {/* Center square (Oclusal/Incisal) */}
                <rect
                    x="12" y="12" width="16" height="16"
                    fill={getFill('O')}
                    stroke={getStroke('O')}
                    strokeWidth="1.2"
                    className="transition-colors cursor-pointer"
                    onMouseEnter={() => setHoveredSurface('O')}
                    onMouseLeave={() => setHoveredSurface(null)}
                    onClick={(e) => handleClick('O', e)}
                />
                {/* Surface labels inside */}
                <text x="20" y="8" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="bold" pointerEvents="none">V</text>
                <text x="20" y="36" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="bold" pointerEvents="none">L</text>
                <text x="6" y="22" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="bold" pointerEvents="none">{mesialIsRight ? 'D' : 'M'}</text>
                <text x="34" y="22" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="bold" pointerEvents="none">{mesialIsRight ? 'M' : 'D'}</text>
                <text x="20" y="23" textAnchor="middle" fontSize="6" fill="#475569" fontWeight="bold" pointerEvents="none">O</text>
            </svg>

            {/* Tooth number - on bottom for lower teeth */}
            {!isUpper && (
                <span className={`text-[10px] font-black mt-0.5 transition-colors ${isSelected ? 'text-amber-600' : 'text-slate-500'}`}>
                    {id}
                </span>
            )}

            {/* Hover tooltip */}
            {hoveredSurface && isEditable && (
                <div className="absolute -top-6 bg-slate-800 text-white text-[9px] px-2 py-0.5 rounded whitespace-nowrap z-30 pointer-events-none">
                    {id} – {SURFACE_LABELS[hoveredSurface]}
                </div>
            )}
        </div>
    );
};

export const Odontogram: React.FC<OdontogramProps> = ({
    patientId,
    isEditable,
    onTreatmentsChange
}) => {
    const { api } = useAppContext();

    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
    const [selectedSurfaces, setSelectedSurfaces] = useState<Record<number, ToothSurface[]>>({});
    const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [showInfo, setShowInfo] = useState(false);

    useEffect(() => {
        if (api?.services?.getAll) {
            api.services.getAll()
                .then((data: Service[]) => setServices(data || []))
                .catch(err => console.error("Error loading services:", err));
        }
    }, [api]);

    useEffect(() => {
        if (patientId && api?.treatments?.getByPatient) {
            api.treatments.getByPatient(patientId)
                .then((data: PatientTreatment[]) => {
                    setTreatments(data || []);
                    onTreatmentsChange?.(data || []);
                })
                .catch(err => console.error("Error loading treatments:", err));
        }
    }, [patientId, api]);

    // Build surface color map from existing treatments
    const getSurfaceColors = (toothId: number): Record<ToothSurface, string> => {
        const base: Record<ToothSurface, string> = { V: COLORS.healthy, L: COLORS.healthy, M: COLORS.healthy, D: COLORS.healthy, O: COLORS.healthy };
        const toothTreatments = treatments.filter(t => t.toothId === toothId);
        if (toothTreatments.length > 0) {
            // If treatment has surface info, color only that surface; otherwise color all
            toothTreatments.forEach(t => {
                const surface = (t as any).surface as ToothSurface | undefined;
                const color = t.status === 'COMPLETADO' ? COLORS.completed
                    : t.id.startsWith('temp-') ? COLORS.pending
                    : COLORS.treatment;
                if (surface && base[surface] !== undefined) {
                    base[surface] = color;
                } else {
                    // No specific surface — mark all
                    (Object.keys(base) as ToothSurface[]).forEach(s => { base[s] = color; });
                }
            });
        }
        return base;
    };

    const handleSurfaceClick = (toothId: number, surface: ToothSurface) => {
        if (!isEditable) return;
        setSelectedSurfaces(prev => {
            const current = prev[toothId] || [];
            const updated = current.includes(surface)
                ? current.filter(s => s !== surface)
                : [...current, surface];
            const next = { ...prev, [toothId]: updated };
            // Also track the tooth as selected
            if (updated.length > 0 && !selectedTeeth.includes(toothId)) {
                setSelectedTeeth(t => [...t, toothId]);
            }
            if (updated.length === 0) {
                setSelectedTeeth(t => t.filter(id => id !== toothId));
                delete next[toothId];
            }
            return next;
        });
    };

    const handleWholeToothClick = (toothId: number) => {
        if (!isEditable) return;
        const allSurfaces: ToothSurface[] = ['V', 'L', 'M', 'D', 'O'];
        setSelectedSurfaces(prev => {
            const current = prev[toothId] || [];
            if (current.length === 5) {
                // Deselect all
                setSelectedTeeth(t => t.filter(id => id !== toothId));
                const next = { ...prev };
                delete next[toothId];
                return next;
            }
            // Select all surfaces
            if (!selectedTeeth.includes(toothId)) {
                setSelectedTeeth(t => [...t, toothId]);
            }
            return { ...prev, [toothId]: allSurfaces };
        });
    };

    const handleAddTreatment = (service: Service) => {
        if (selectedTeeth.length === 0) {
            alert('Selecciona al menos un diente o cara');
            return;
        }

        const newTreatments: PatientTreatment[] = [];
        selectedTeeth.forEach(toothId => {
            const surfaces = selectedSurfaces[toothId] || ['O'];
            surfaces.forEach(surface => {
                newTreatments.push({
                    id: `temp-${Date.now()}-${toothId}-${surface}`,
                    patientId,
                    serviceId: service.id,
                    serviceName: service.name,
                    toothId,
                    surface,
                    price: service.final_price / surfaces.length,
                    status: 'PENDIENTE' as const,
                } as any);
            });
        });

        const updated = [...treatments, ...newTreatments];
        setTreatments(updated);
        onTreatmentsChange?.(updated);
        setSelectedTeeth([]);
        setSelectedSurfaces({});
        setSearchTerm('');
    };

    const handleDeleteTreatment = (id: string) => {
        const updated = treatments.filter(t => t.id !== id);
        setTreatments(updated);
        onTreatmentsChange?.(updated);
    };

    const handleSaveTreatments = async () => {
        const pending = treatments.filter(t => t.id.startsWith('temp-'));
        if (pending.length === 0) return;
        try {
            setIsSaving(true);
            await api.treatments.create(pending);
            alert('✅ Tratamientos guardados correctamente');
            // Reload
            if (patientId && api?.treatments?.getByPatient) {
                const data = await api.treatments.getByPatient(patientId);
                setTreatments(data || []);
                onTreatmentsChange?.(data || []);
            }
        } catch (error: any) {
            console.error(error);
            alert("Error: " + (error.message || error));
        } finally {
            setIsSaving(false);
        }
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const tempCount = treatments.filter(t => t.id.startsWith('temp-')).length;
    const totalPrice = treatments.reduce((sum, t) => sum + (t.price || 0), 0);

    const renderQuadrant = (teeth: number[], label: string, isUpper: boolean) => (
        <div className="flex flex-col items-center">
            <div className={`flex gap-0.5 items-${isUpper ? 'end' : 'start'}`}>
                {teeth.map(toothId => (
                    <div key={toothId} className="relative">
                        <ToothDiagram
                            id={toothId}
                            surfaceColors={getSurfaceColors(toothId)}
                            selectedSurfaces={selectedSurfaces[toothId] || []}
                            onSurfaceClick={(s) => handleSurfaceClick(toothId, s)}
                            onWholeToothClick={() => handleWholeToothClick(toothId)}
                            isEditable={isEditable}
                            isUpper={isUpper}
                            isSelected={selectedTeeth.includes(toothId)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <div className="w-full space-y-6">
            {/* Main odontogram card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg overflow-hidden">

                {/* Header */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 py-4 flex flex-wrap justify-between items-center gap-3">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">🦷 Odontograma</h2>
                        <p className="text-xs text-slate-300 mt-0.5">Haz clic en las caras del diente para seleccionar áreas específicas</p>
                    </div>
                    <div className="flex gap-2">
                        <button onClick={() => setShowInfo(!showInfo)} className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"><Info size={18} /></button>
                        {tempCount > 0 && (
                            <button onClick={handleSaveTreatments} disabled={isSaving}
                                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-black rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2 text-sm">
                                <Save size={16} /> Guardar ({tempCount})
                            </button>
                        )}
                    </div>
                </div>

                {/* Info */}
                {showInfo && (
                    <div className="mx-6 mt-4 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 space-y-1">
                        <p className="font-bold">📋 Instrucciones:</p>
                        <ul className="text-xs space-y-1 ml-4">
                            <li>• <strong>Clic en una cara</strong> (V/L/M/D/O) para seleccionar esa superficie</li>
                            <li>• <strong>Clic en el centro del diente</strong> para seleccionar todas las caras</li>
                            <li>• Las caras seleccionadas aparecen en <span className="text-amber-600 font-bold">amarillo</span></li>
                            <li>• Busca un tratamiento abajo y haz clic para asignarlo</li>
                            <li>• <strong>V</strong>=Vestibular, <strong>L</strong>=Lingual/Palatino, <strong>M</strong>=Mesial, <strong>D</strong>=Distal, <strong>O</strong>=Oclusal</li>
                        </ul>
                        <button onClick={() => setShowInfo(false)} className="text-blue-600 hover:text-blue-800 text-xs font-bold mt-2">Cerrar</button>
                    </div>
                )}

                {/* Odontogram grid */}
                <div className="px-6 py-6 overflow-x-auto">
                    <div className="min-w-[700px] flex flex-col items-center gap-2">

                        {/* Upper jaw */}
                        <div className="flex items-end justify-center gap-4">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 mb-1">CUADRANTE 1 (Sup. Der.)</span>
                                {renderQuadrant(QUADRANTS.Q1, 'Q1', true)}
                            </div>
                            <div className="w-px h-12 bg-slate-300"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 mb-1">CUADRANTE 2 (Sup. Izq.)</span>
                                {renderQuadrant(QUADRANTS.Q2, 'Q2', true)}
                            </div>
                        </div>

                        {/* Midline */}
                        <div className="w-full max-w-3xl flex items-center gap-3 my-1">
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent"></div>
                            <span className="text-[9px] font-black text-slate-400 uppercase">Línea media</span>
                            <div className="flex-1 h-0.5 bg-gradient-to-r from-transparent via-slate-400 to-transparent"></div>
                        </div>

                        {/* Lower jaw */}
                        <div className="flex items-start justify-center gap-4">
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 mt-1 order-2">CUADRANTE 4 (Inf. Der.)</span>
                                {renderQuadrant(QUADRANTS.Q4, 'Q4', false)}
                            </div>
                            <div className="w-px h-12 bg-slate-300"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-[9px] font-black text-slate-400 mt-1 order-2">CUADRANTE 3 (Inf. Izq.)</span>
                                {renderQuadrant(QUADRANTS.Q3, 'Q3', false)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="px-6 pb-4 flex flex-wrap gap-4 justify-center text-[10px] font-bold text-slate-500">
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border" style={{ background: COLORS.healthy, borderColor: COLORS.healthyBorder }}></div> Sano</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border" style={{ background: COLORS.treatment, borderColor: COLORS.treatmentBorder }}></div> En Tratamiento</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border" style={{ background: COLORS.pending, borderColor: COLORS.pendingBorder }}></div> Pendiente guardar</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border" style={{ background: COLORS.completed, borderColor: COLORS.completedBorder }}></div> Completado</div>
                    <div className="flex items-center gap-1"><div className="w-3 h-3 rounded-sm border" style={{ background: COLORS.selected, borderColor: COLORS.selectedBorder }}></div> Seleccionado</div>
                </div>

                {/* Selected teeth info */}
                {isEditable && selectedTeeth.length > 0 && (
                    <div className="mx-6 mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-bold text-amber-900">
                                Selección: {selectedTeeth.map(t => {
                                    const surfaces = selectedSurfaces[t] || [];
                                    return `${t}(${surfaces.join(',')})`;
                                }).join(' · ')}
                            </p>
                            <button onClick={() => { setSelectedTeeth([]); setSelectedSurfaces({}); }} className="text-xs font-bold text-amber-600 hover:text-amber-800 flex items-center gap-1">
                                <X size={14} /> Limpiar
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Treatment search & services */}
            {isEditable && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4">
                    <label className="text-xs font-black uppercase text-slate-400 block">🔍 Buscar Tratamiento</label>
                    <input
                        type="text"
                        placeholder="Ej: Limpieza, Extracción, Empaste..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                    />
                    {searchTerm.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {filteredServices.length === 0 ? (
                                <div className="col-span-full text-center py-6 text-slate-400 text-sm">No se encontraron tratamientos</div>
                            ) : (
                                filteredServices.map(service => (
                                    <button key={service.id} onClick={() => handleAddTreatment(service)} disabled={selectedTeeth.length === 0}
                                        className="group p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-violet-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left">
                                        <p className="text-sm font-black text-slate-900 mb-1">{service.name}</p>
                                        <p className="text-xs font-bold text-violet-600">{service.final_price}€</p>
                                        <div className="mt-2 flex items-center gap-1 text-xs text-slate-400 group-hover:text-violet-600"><Plus size={12} /><span>Añadir</span></div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Treatments list */}
            {treatments.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <h4 className="text-lg font-black text-slate-900">📋 Tratamientos ({treatments.length})</h4>
                        <p className="text-xl font-black text-slate-900">{totalPrice.toFixed(2)}€</p>
                    </div>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {treatments.map(t => (
                            <div key={t.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm hover:border-violet-200 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-lg font-black text-violet-600 w-8 text-center">{t.toothId}</span>
                                    {(t as any).surface && <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-2 py-0.5 rounded">{(t as any).surface}</span>}
                                    <span className="font-bold text-slate-900">{t.serviceName}</span>
                                    {t.id.startsWith('temp-') && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold">Pendiente</span>}
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-black text-slate-900">{t.price}€</span>
                                    {isEditable && (
                                        <button onClick={() => handleDeleteTreatment(t.id)} className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded-lg transition-colors">
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
