import React, { useState, useEffect, useRef } from 'react';
import { Baby, Plus, Save, Trash2, User, X } from 'lucide-react';
import { PatientTreatment } from '../types';
import { useAppContext } from '../context/AppContext';

// ─── Props ───────────────────────────────────────────────────────────────────
interface OdontogramProps {
    patientId: string;
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

// ─── FDI Numbering ───────────────────────────────────────────────────────────
// ADULT (Permanente) – 32 piezas
const ADULT_UPPER_LEFT  = [18, 17, 16, 15, 14, 13, 12, 11]; // Q1 left→midline
const ADULT_UPPER_RIGHT = [21, 22, 23, 24, 25, 26, 27, 28]; // Q2 midline→right
const ADULT_LOWER_LEFT  = [48, 47, 46, 45, 44, 43, 42, 41]; // Q4 left→midline
const ADULT_LOWER_RIGHT = [31, 32, 33, 34, 35, 36, 37, 38]; // Q3 midline→right

// CHILD (Temporal) – 20 piezas
const CHILD_UPPER_LEFT  = [55, 54, 53, 52, 51]; // Q5 left→midline
const CHILD_UPPER_RIGHT = [61, 62, 63, 64, 65]; // Q6 midline→right
const CHILD_LOWER_LEFT  = [85, 84, 83, 82, 81]; // Q8 left→midline
const CHILD_LOWER_RIGHT = [71, 72, 73, 74, 75]; // Q7 midline→right

// ─── Surfaces ────────────────────────────────────────────────────────────────
type ToothSurface = 'V' | 'L' | 'M' | 'D' | 'O';

const SURFACE_LABELS: Record<ToothSurface, string> = {
    V: 'Vestibular',
    L: 'Lingual / Palatino',
    M: 'Mesial',
    D: 'Distal',
    O: 'Oclusal / Incisal',
};

// ─── Condition catalogue ─────────────────────────────────────────────────────
type Condition =
    | 'healthy'
    | 'caries'
    | 'filled'
    | 'crown'
    | 'missing'
    | 'endo'
    | 'implant'
    | 'fracture'
    | 'sealant';

interface ConditionOption {
    id: Condition;
    label: string;
    color: string;
    border: string;
    badge: string;
}

const CONDITIONS: ConditionOption[] = [
    { id: 'healthy',  label: 'Sano',        color: '#f0f9ff', border: '#93c5fd', badge: 'bg-blue-100 text-blue-700' },
    { id: 'caries',   label: 'Caries',      color: '#fef2f2', border: '#f87171', badge: 'bg-red-100 text-red-700' },
    { id: 'filled',   label: 'Obturado',    color: '#faf5ff', border: '#a78bfa', badge: 'bg-violet-100 text-violet-700' },
    { id: 'crown',    label: 'Corona',      color: '#fefce8', border: '#fbbf24', badge: 'bg-yellow-100 text-yellow-700' },
    { id: 'missing',  label: 'Ausente',     color: '#f1f5f9', border: '#94a3b8', badge: 'bg-slate-100 text-slate-500' },
    { id: 'endo',     label: 'Endodoncia',  color: '#fff7ed', border: '#fb923c', badge: 'bg-orange-100 text-orange-700' },
    { id: 'implant',  label: 'Implante',    color: '#ecfdf5', border: '#34d399', badge: 'bg-emerald-100 text-emerald-700' },
    { id: 'fracture', label: 'Fractura',    color: '#fdf2f8', border: '#e879f9', badge: 'bg-fuchsia-100 text-fuchsia-700' },
    { id: 'sealant',  label: 'Sellador',    color: '#f0fdfa', border: '#2dd4bf', badge: 'bg-teal-100 text-teal-700' },
];

type SurfaceConditionMap = Partial<Record<ToothSurface, Condition>>;
type OdontogramState = Record<number, SurfaceConditionMap>;

const conditionFor = (id: Condition): ConditionOption =>
    CONDITIONS.find(c => c.id === id) ?? CONDITIONS[0];

// ─── ToothSVG ────────────────────────────────────────────────────────────────
interface ToothSVGProps {
    id: number;
    surfaceState: SurfaceConditionMap;
    activeSurface: ToothSurface | null;
    onSurfaceClick: (surface: ToothSurface) => void;
    isEditable: boolean;
    isUpper: boolean;
    isMissing: boolean;
    size?: number;
}

const ToothSVG: React.FC<ToothSVGProps> = ({
    id,
    surfaceState,
    activeSurface,
    onSurfaceClick,
    isEditable,
    isUpper,
    isMissing,
    size = 46,
}) => {
    const [hovered, setHovered] = useState<ToothSurface | null>(null);

    const quadrant = Math.floor(id / 10);
    // Q1=1x, Q4=4x, Q5=5x, Q8=8x — mesial is on the right side
    const mesialRight = quadrant === 1 || quadrant === 4 || quadrant === 5 || quadrant === 8;

    const leftSurf: ToothSurface  = mesialRight ? 'D' : 'M';
    const rightSurf: ToothSurface = mesialRight ? 'M' : 'D';
    // Upper jaw: top=Vestibular, bottom=Palatino/Lingual
    // Lower jaw: top=Lingual,    bottom=Vestibular
    const topSurf: ToothSurface    = isUpper ? 'V' : 'L';
    const bottomSurf: ToothSurface = isUpper ? 'L' : 'V';

    const getFill = (surf: ToothSurface): string => {
        if (activeSurface === surf) return '#fde68a';
        const cond = surfaceState[surf];
        if (cond) return conditionFor(cond).color;
        return '#f8fafc';
    };

    const getStroke = (surf: ToothSurface): string => {
        if (activeSurface === surf) return '#d97706';
        if (hovered === surf && isEditable) return '#6366f1';
        const cond = surfaceState[surf];
        if (cond && cond !== 'healthy') return conditionFor(cond).border;
        return '#cbd5e1';
    };

    const handleSurf = (surf: ToothSurface, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!isEditable || isMissing) return;
        onSurfaceClick(surf);
    };

    const V = 40;

    if (isMissing) {
        return (
            <svg width={size} height={size} viewBox={`0 0 ${V} ${V}`} className="opacity-35">
                <rect x="2" y="2" width={V - 4} height={V - 4} rx="4"
                    fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4 2" />
                <line x1="9" y1="9" x2={V - 9} y2={V - 9} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
                <line x1={V - 9} y1="9" x2="9" y2={V - 9} stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
        );
    }

    return (
        <svg
            width={size} height={size} viewBox={`0 0 ${V} ${V}`}
            className={`transition-transform ${isEditable ? 'hover:scale-105' : ''}`}
        >
            {/* TOP trapezoid */}
            <polygon
                points={`0,0 ${V},0 ${V * 0.7},${V * 0.3} ${V * 0.3},${V * 0.3}`}
                fill={getFill(topSurf)} stroke={getStroke(topSurf)} strokeWidth="1.2"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHovered(topSurf)} onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleSurf(topSurf, e)}
            />
            {/* RIGHT trapezoid */}
            <polygon
                points={`${V},0 ${V},${V} ${V * 0.7},${V * 0.7} ${V * 0.7},${V * 0.3}`}
                fill={getFill(rightSurf)} stroke={getStroke(rightSurf)} strokeWidth="1.2"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHovered(rightSurf)} onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleSurf(rightSurf, e)}
            />
            {/* BOTTOM trapezoid */}
            <polygon
                points={`${V},${V} 0,${V} ${V * 0.3},${V * 0.7} ${V * 0.7},${V * 0.7}`}
                fill={getFill(bottomSurf)} stroke={getStroke(bottomSurf)} strokeWidth="1.2"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHovered(bottomSurf)} onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleSurf(bottomSurf, e)}
            />
            {/* LEFT trapezoid */}
            <polygon
                points={`0,${V} 0,0 ${V * 0.3},${V * 0.3} ${V * 0.3},${V * 0.7}`}
                fill={getFill(leftSurf)} stroke={getStroke(leftSurf)} strokeWidth="1.2"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHovered(leftSurf)} onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleSurf(leftSurf, e)}
            />
            {/* CENTER — Oclusal/Incisal */}
            <rect
                x={V * 0.3} y={V * 0.3} width={V * 0.4} height={V * 0.4}
                fill={getFill('O')} stroke={getStroke('O')} strokeWidth="1.2"
                className="cursor-pointer transition-colors"
                onMouseEnter={() => setHovered('O')} onMouseLeave={() => setHovered(null)}
                onClick={(e) => handleSurf('O', e)}
            />
            {/* Surface labels */}
            <text x={V / 2}  y={V * 0.165} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700" pointerEvents="none">{topSurf}</text>
            <text x={V / 2}  y={V * 0.895} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700" pointerEvents="none">{bottomSurf}</text>
            <text x={V * 0.07} y={V * 0.555} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700" pointerEvents="none">{leftSurf}</text>
            <text x={V * 0.93} y={V * 0.555} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700" pointerEvents="none">{rightSurf}</text>
            <text x={V / 2}  y={V * 0.565} textAnchor="middle" fontSize="5.5" fill="#64748b" fontWeight="700" pointerEvents="none">O</text>
        </svg>
    );
};

// ─── Surface Condition Picker ─────────────────────────────────────────────────
interface PickerProps {
    toothId: number;
    surface: ToothSurface;
    current: Condition;
    onSelect: (cond: Condition) => void;
    onClose: () => void;
}

const SurfacePicker: React.FC<PickerProps> = ({ toothId, surface, current, onSelect, onClose }) => (
    <div
        className="absolute z-50 bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 w-52"
        onClick={(e) => e.stopPropagation()}
    >
        <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-black text-slate-700">
                Diente {toothId} · {SURFACE_LABELS[surface]}
            </span>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-700 p-0.5 rounded-md transition-colors">
                <X size={13} />
            </button>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
            {CONDITIONS.map(c => (
                <button
                    key={c.id}
                    onClick={() => { onSelect(c.id); onClose(); }}
                    className={`text-[10px] font-bold px-1.5 py-2 rounded-lg border-2 transition-all
                        ${current === c.id
                            ? 'scale-105 shadow-sm'
                            : 'border-slate-200 hover:border-indigo-300 text-slate-600 hover:bg-slate-50'
                        }`}
                    style={current === c.id
                        ? { borderColor: c.border, backgroundColor: c.color, color: '#374151' }
                        : undefined}
                >
                    {c.label}
                </button>
            ))}
        </div>
    </div>
);

// ─── Tooth Cell ──────────────────────────────────────────────────────────────
interface ToothCellProps {
    id: number;
    isUpper: boolean;
    isEditable: boolean;
    surfaceState: SurfaceConditionMap;
    onUpdate: (id: number, surfaces: SurfaceConditionMap) => void;
    size?: number;
}

const ToothCell: React.FC<ToothCellProps> = ({ id, isUpper, isEditable, surfaceState, onUpdate, size = 46 }) => {
    const [activeSurface, setActiveSurface] = useState<ToothSurface | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    const isMissing = Object.values(surfaceState).some(c => c === 'missing');
    const hasTreatment = Object.values(surfaceState).some(c => c && c !== 'healthy');

    useEffect(() => {
        if (!activeSurface) return;
        const handler = (e: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
                setActiveSurface(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [activeSurface]);

    const handleSurfaceClick = (surf: ToothSurface) => {
        if (!isEditable) return;
        setActiveSurface(prev => (prev === surf ? null : surf));
    };

    const handleConditionSelect = (cond: Condition) => {
        if (!activeSurface) return;
        if (cond === 'missing') {
            const all: SurfaceConditionMap = { V: 'missing', L: 'missing', M: 'missing', D: 'missing', O: 'missing' };
            onUpdate(id, all);
        } else {
            onUpdate(id, { ...surfaceState, [activeSurface]: cond });
        }
        setActiveSurface(null);
    };

    const numLabel = (
        <span className={`text-[11px] font-black leading-none select-none transition-colors
            ${hasTreatment ? 'text-violet-700' : 'text-slate-400'}
            ${isMissing ? 'line-through text-slate-300' : ''}
        `}>
            {id}
        </span>
    );

    return (
        <div ref={wrapperRef} className="relative flex flex-col items-center gap-0.5">
            {isUpper && numLabel}
            <ToothSVG
                id={id}
                surfaceState={surfaceState}
                activeSurface={activeSurface}
                onSurfaceClick={handleSurfaceClick}
                isEditable={isEditable}
                isUpper={isUpper}
                isMissing={isMissing}
                size={size}
            />
            {!isUpper && numLabel}

            {/* Popover */}
            {activeSurface && isEditable && (
                <div className={`absolute ${isUpper ? 'top-full mt-1' : 'bottom-full mb-1'} left-1/2 -translate-x-1/2 z-50`}>
                    <SurfacePicker
                        toothId={id}
                        surface={activeSurface}
                        current={surfaceState[activeSurface] ?? 'healthy'}
                        onSelect={handleConditionSelect}
                        onClose={() => setActiveSurface(null)}
                    />
                </div>
            )}
        </div>
    );
};

// ─── Arcade Row ──────────────────────────────────────────────────────────────
interface ArcadeRowProps {
    leftTeeth: number[];
    rightTeeth: number[];
    isUpper: boolean;
    isEditable: boolean;
    odontogramState: OdontogramState;
    onUpdate: (id: number, surfaces: SurfaceConditionMap) => void;
    toothSize?: number;
}

const ArcadeRow: React.FC<ArcadeRowProps> = ({
    leftTeeth, rightTeeth, isUpper, isEditable, odontogramState, onUpdate, toothSize = 46,
}) => (
    <div className="flex items-center justify-center gap-1 flex-wrap">
        {leftTeeth.map(id => (
            <ToothCell
                key={id} id={id} isUpper={isUpper} isEditable={isEditable}
                surfaceState={odontogramState[id] ?? {}}
                onUpdate={onUpdate} size={toothSize}
            />
        ))}
        <div className="w-px h-10 bg-slate-300 mx-1 self-center flex-shrink-0" />
        {rightTeeth.map(id => (
            <ToothCell
                key={id} id={id} isUpper={isUpper} isEditable={isEditable}
                surfaceState={odontogramState[id] ?? {}}
                onUpdate={onUpdate} size={toothSize}
            />
        ))}
    </div>
);

// ─── Legend ──────────────────────────────────────────────────────────────────
const Legend: React.FC = () => (
    <div className="flex flex-wrap gap-2 justify-center">
        {CONDITIONS.map(c => (
            <span
                key={c.id}
                className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${c.badge}`}
            >
                {c.label}
            </span>
        ))}
    </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
type DentitionMode = 'adult' | 'child';

export const Odontogram: React.FC<OdontogramProps> = ({
    patientId,
    isEditable,
    onTreatmentsChange,
}) => {
    const { api } = useAppContext();

    const [mode, setMode] = useState<DentitionMode>('adult');
    const [odontogramState, setOdontogramState] = useState<OdontogramState>({});
    const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);

    useEffect(() => {
        if (api?.services?.getAll) {
            api.services.getAll()
                .then((data: Service[]) => setServices(data || []))
                .catch((err: unknown) => console.error('Error loading services:', err));
        }
    }, [api]);

    useEffect(() => {
        if (patientId && api?.treatments?.getByPatient) {
            api.treatments.getByPatient(patientId)
                .then((data: PatientTreatment[]) => {
                    const list = data || [];
                    setTreatments(list);
                    onTreatmentsChange?.(list);
                    // Bootstrap odontogram from saved treatments
                    const initial: OdontogramState = {};
                    list.forEach(t => {
                        if (!t.toothId) return;
                        const surf = (t as any).surface as ToothSurface | undefined;
                        const cond: Condition = t.status === 'COMPLETADO' ? 'filled' : 'caries';
                        if (!initial[t.toothId]) initial[t.toothId] = {};
                        if (surf) {
                            initial[t.toothId][surf] = cond;
                        } else {
                            (['V', 'L', 'M', 'D', 'O'] as ToothSurface[]).forEach(s => {
                                initial[t.toothId!][s] = cond;
                            });
                        }
                    });
                    setOdontogramState(initial);
                })
                .catch((err: unknown) => console.error('Error loading treatments:', err));
        }
    }, [patientId, api]);

    const handleUpdate = (toothId: number, surfaces: SurfaceConditionMap) => {
        setOdontogramState(prev => ({ ...prev, [toothId]: surfaces }));
    };

    const handleAddTreatment = (service: Service) => {
        if (selectedTeeth.length === 0) { alert('Selecciona al menos un diente'); return; }
        const newTs: PatientTreatment[] = selectedTeeth.map(toothId => ({
            id: `temp-${Date.now()}-${toothId}`,
            patientId,
            serviceId: service.id,
            serviceName: service.name,
            toothId,
            price: service.final_price,
            status: 'PENDIENTE' as const,
            createdAt: new Date().toISOString(),
        }));
        const updated = [...treatments, ...newTs];
        setTreatments(updated);
        onTreatmentsChange?.(updated);
        setSelectedTeeth([]);
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
            if (patientId && api?.treatments?.getByPatient) {
                const data = await api.treatments.getByPatient(patientId);
                setTreatments(data || []);
                onTreatmentsChange?.(data || []);
            }
        } catch (err: unknown) {
            console.error(err);
            alert('Error guardando tratamientos');
        } finally {
            setIsSaving(false);
        }
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const tempCount = treatments.filter(t => t.id.startsWith('temp-')).length;
    const totalPrice = treatments.reduce((sum, t) => sum + (t.price ?? 0), 0);

    const upperLeft  = mode === 'adult' ? ADULT_UPPER_LEFT  : CHILD_UPPER_LEFT;
    const upperRight = mode === 'adult' ? ADULT_UPPER_RIGHT : CHILD_UPPER_RIGHT;
    const lowerLeft  = mode === 'adult' ? ADULT_LOWER_LEFT  : CHILD_LOWER_LEFT;
    const lowerRight = mode === 'adult' ? ADULT_LOWER_RIGHT : CHILD_LOWER_RIGHT;
    const toothSize  = mode === 'adult' ? 44 : 50;

    return (
        <div className="space-y-4">

            {/* ── Header ──────────────────────────────────────────────── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-xl font-black text-slate-900">Odontograma FDI</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                        {mode === 'adult'
                            ? '32 piezas · Dentición permanente (cuadrantes 1–4)'
                            : '20 piezas · Dentición temporal (cuadrantes 5–8)'}
                    </p>
                </div>

                {/* Dentition Toggle */}
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                        onClick={() => setMode('adult')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all
                            ${mode === 'adult'
                                ? 'bg-white text-violet-700 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <User size={14} /> Adulto
                    </button>
                    <button
                        onClick={() => setMode('child')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-bold transition-all
                            ${mode === 'child'
                                ? 'bg-white text-pink-600 shadow-sm border border-slate-200'
                                : 'text-slate-500 hover:text-slate-700'}`}
                    >
                        <Baby size={14} /> Niño
                    </button>
                </div>
            </div>

            {/* ── Odontogram Board ─────────────────────────────────────── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 overflow-x-auto">

                {/* Top quadrant labels */}
                <div className="flex justify-around mb-2 px-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        ← {mode === 'adult' ? 'Q1' : 'Q5'} (Derecho paciente)
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {mode === 'adult' ? 'Q2' : 'Q6'} (Izquierdo paciente) →
                    </span>
                </div>

                {/* SUPERIOR */}
                <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    ▲ MAXILAR SUPERIOR
                </p>
                <ArcadeRow
                    leftTeeth={upperLeft} rightTeeth={upperRight}
                    isUpper isEditable={isEditable}
                    odontogramState={odontogramState} onUpdate={handleUpdate}
                    toothSize={toothSize}
                />

                {/* Midline */}
                <div className="relative my-4">
                    <div className="border-t-2 border-dashed border-slate-300" />
                    <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-white px-3 text-[9px] text-slate-400 font-black tracking-widest uppercase">
                        Línea media
                    </span>
                </div>

                {/* INFERIOR */}
                <ArcadeRow
                    leftTeeth={lowerLeft} rightTeeth={lowerRight}
                    isUpper={false} isEditable={isEditable}
                    odontogramState={odontogramState} onUpdate={handleUpdate}
                    toothSize={toothSize}
                />
                <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">
                    ▼ MAXILAR INFERIOR
                </p>

                {/* Bottom quadrant labels */}
                <div className="flex justify-around mt-2 px-4">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        ← {mode === 'adult' ? 'Q4' : 'Q8'} (Derecho paciente)
                    </span>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        {mode === 'adult' ? 'Q3' : 'Q7'} (Izquierdo paciente) →
                    </span>
                </div>

                {/* Legend */}
                <div className="mt-5 pt-4 border-t border-slate-100">
                    <Legend />
                </div>
            </div>

            {/* ── Help tip ─────────────────────────────────────────────── */}
            {isEditable && (
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-2.5">
                    <p className="text-xs font-semibold text-violet-700">
                        💡 Haz clic en cualquiera de las 5 caras de un diente para asignar su estado (caries, obturado, corona, etc.).
                        Las caras son: <strong>V</strong>estibular · <strong>L</strong>ingual · <strong>M</strong>esial · <strong>D</strong>istal · <strong>O</strong>clusal.
                    </p>
                </div>
            )}

            {/* ── Treatments Panel ─────────────────────────────────────── */}
            {isEditable && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 space-y-4">
                    <h4 className="text-base font-black text-slate-800">Añadir Tratamiento al Plan</h4>

                    {selectedTeeth.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                            <span className="text-xs font-black text-amber-700">Dientes:</span>
                            {selectedTeeth.map(id => (
                                <span key={id} className="text-xs font-black bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full">{id}</span>
                            ))}
                            <button onClick={() => setSelectedTeeth([])} className="ml-auto text-amber-500 hover:text-amber-700 transition-colors">
                                <X size={13} />
                            </button>
                        </div>
                    )}

                    <input
                        type="text"
                        placeholder="Buscar tratamiento (limpieza, corona, endodoncia…)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
                    />

                    {searchTerm.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                            {filteredServices.length === 0 ? (
                                <div className="col-span-full text-center py-4 text-slate-400 text-sm">Sin resultados</div>
                            ) : filteredServices.map(service => (
                                <button
                                    key={service.id}
                                    onClick={() => handleAddTreatment(service)}
                                    disabled={selectedTeeth.length === 0}
                                    className="p-3 bg-white border-2 border-slate-200 rounded-xl hover:border-violet-400 hover:shadow transition-all disabled:opacity-40 disabled:cursor-not-allowed text-left"
                                >
                                    <p className="text-sm font-black text-slate-900 truncate">{service.name}</p>
                                    <p className="text-xs font-bold text-violet-600 mt-0.5">{service.final_price}€</p>
                                    <div className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                                        <Plus size={11} /><span>Añadir</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Treatments List ───────────────────────────────────────── */}
            {treatments.length > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <h4 className="text-base font-black text-slate-900">
                            Tratamientos ({treatments.length})
                        </h4>
                        <div className="flex items-center gap-3">
                            <span className="text-lg font-black text-slate-900">{totalPrice.toFixed(2)} €</span>
                            {isEditable && tempCount > 0 && (
                                <button
                                    onClick={handleSaveTreatments}
                                    disabled={isSaving}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-60 transition-colors"
                                >
                                    <Save size={14} />
                                    {isSaving ? 'Guardando…' : `Guardar (${tempCount})`}
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                        {treatments.map(t => (
                            <div
                                key={t.id}
                                className="flex items-center justify-between bg-slate-50 border border-slate-100 p-3 rounded-xl text-sm hover:border-violet-200 transition-colors"
                            >
                                <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <span className="text-base font-black text-violet-600 w-7 text-center flex-shrink-0">
                                        {t.toothId ?? '–'}
                                    </span>
                                    {(t as any).surface && (
                                        <span className="text-[10px] font-black bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded flex-shrink-0">
                                            {(t as any).surface}
                                        </span>
                                    )}
                                    <span className="font-bold text-slate-900 truncate">{t.serviceName}</span>
                                    {t.id.startsWith('temp-') && (
                                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-bold flex-shrink-0">
                                            Sin guardar
                                        </span>
                                    )}
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded flex-shrink-0
                                        ${t.status === 'COMPLETADO'
                                            ? 'bg-emerald-100 text-emerald-700'
                                            : t.status === 'EN_PROCESO'
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-slate-100 text-slate-500'}`}
                                    >
                                        {t.status}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                                    <span className="font-black text-slate-900">{(t.price ?? 0).toFixed(2)} €</span>
                                    {isEditable && (
                                        <button
                                            onClick={() => handleDeleteTreatment(t.id)}
                                            className="text-red-400 hover:text-red-600 p-1 rounded-lg hover:bg-red-50 transition-colors"
                                        >
                                            <Trash2 size={14} />
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

export default Odontogram;
