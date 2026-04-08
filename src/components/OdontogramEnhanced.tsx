import React, { useState, useEffect } from 'react';
import { Baby, Plus, Save, Trash2, User, X } from 'lucide-react';
import { PatientTreatment } from '../types';
import { useAppContext } from '../context/AppContext';

// ══════════════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════════════
interface OdontogramProps {
  patientId: string;
  isEditable: boolean;
  onTreatmentsChange?: (treatments: PatientTreatment[]) => void;
}

interface Service {
  id: string;
  name: string;
  final_price: number;
}

// ── FDI Numbering ──────────────────────────────────────────────────────
// Each array is ordered from OUTERMOST → INNERMOST (toward midline)
const ADULT = {
  upperLeft:  [18, 17, 16, 15, 14, 13, 12, 11], // Q1
  upperRight: [21, 22, 23, 24, 25, 26, 27, 28], // Q2
  lowerLeft:  [48, 47, 46, 45, 44, 43, 42, 41], // Q4
  lowerRight: [31, 32, 33, 34, 35, 36, 37, 38], // Q3
};
const CHILD = {
  upperLeft:  [55, 54, 53, 52, 51], // Q5
  upperRight: [61, 62, 63, 64, 65], // Q6
  lowerLeft:  [85, 84, 83, 82, 81], // Q8
  lowerRight: [71, 72, 73, 74, 75], // Q7
};

// ── Tooth visual configuration ─────────────────────────────────────────
// Width in px per tooth type (last FDI digit). Height is fixed at 54px.
const TOOTH_W_MAP: Record<number, number> = {
  1: 26, // central incisor
  2: 24, // lateral incisor
  3: 26, // canine
  4: 32, // 1st premolar
  5: 32, // 2nd premolar
  6: 42, // 1st molar
  7: 40, // 2nd molar
  8: 36, // 3rd molar / wisdom
  0: 32, // default
};
const TOOTH_H = 54;
const CHILD_SCALE = 0.82;

// Arch curvature: degrees of rotation from midline outward
const ARCH_ROT_MAP: Record<number, number> = {
  1: 0, 2: 4, 3: 9, 4: 14, 5: 18, 6: 22, 7: 25, 8: 27, 0: 0,
};

const getToothW = (id: number): number => {
  const digit = id % 10;
  const w = TOOTH_W_MAP[digit] ?? TOOTH_W_MAP[0];
  return id >= 50 ? Math.round(w * CHILD_SCALE) : w;
};
const getToothH = (id: number): number =>
  id >= 50 ? Math.round(TOOTH_H * CHILD_SCALE) : TOOTH_H;

const getArchRot = (id: number): number => {
  const digit = id % 10;
  const q = Math.floor(id / 10);
  const angle = ARCH_ROT_MAP[digit] ?? 0;
  // Q1, Q4, Q5, Q8 are left quadrants → negative rotation
  const isLeft = q === 1 || q === 4 || q === 5 || q === 8;
  return isLeft ? -angle : angle;
};

// ── Surfaces ────────────────────────────────────────────────────────────
type Surf = 'V' | 'L' | 'M' | 'D' | 'O';

const SURF_NAME: Record<Surf, string> = {
  V: 'Vestibular',
  L: 'Lingual / Palatino',
  M: 'Mesial',
  D: 'Distal',
  O: 'Oclusal / Incisal',
};

// ── Conditions ──────────────────────────────────────────────────────────
type Cond =
  | 'healthy' | 'caries' | 'filled' | 'crown' | 'missing'
  | 'endo' | 'implant' | 'fracture' | 'sealant';

interface CondDef {
  id: Cond;
  label: string;
  fill: string;
  stroke: string;
}

const CONDS: CondDef[] = [
  { id: 'healthy',  label: 'Sano',        fill: '#f8fafc', stroke: '#94a3b8' },
  { id: 'caries',   label: 'Caries',      fill: '#fecaca', stroke: '#dc2626' },
  { id: 'filled',   label: 'Obturado',    fill: '#ddd6fe', stroke: '#7c3aed' },
  { id: 'crown',    label: 'Corona',      fill: '#fef08a', stroke: '#b45309' },
  { id: 'missing',  label: 'Ausente',     fill: '#f1f5f9', stroke: '#94a3b8' },
  { id: 'endo',     label: 'Endodoncia',  fill: '#fed7aa', stroke: '#c2410c' },
  { id: 'implant',  label: 'Implante',    fill: '#bbf7d0', stroke: '#15803d' },
  { id: 'fracture', label: 'Fractura',    fill: '#fbcfe8', stroke: '#be185d' },
  { id: 'sealant',  label: 'Sellador',    fill: '#a5f3fc', stroke: '#0e7490' },
];

const getCond = (id: Cond): CondDef => CONDS.find(c => c.id === id) ?? CONDS[0];

type SurfMap = Partial<Record<Surf, Cond>>;
type OdoState = Record<number, SurfMap>;

// ══════════════════════════════════════════════════════════════════════
// <ToothSVG />  — Variable-width tooth with 5 interactive surfaces
// Each tooth has an anatomical rounded-rectangle outline clipped via SVG
// clipPath. Width varies by tooth type (incisors narrow, molars wide).
// ══════════════════════════════════════════════════════════════════════
interface ToothSVGProps {
  id: number;
  surfMap: SurfMap;
  activeSurf: Surf | null;
  isEditable: boolean;
  isUpper: boolean;
  onSurf: (s: Surf) => void;
}

const ToothSVG: React.FC<ToothSVGProps> = ({
  id, surfMap, activeSurf, isEditable, isUpper, onSurf,
}) => {
  const [hov, setHov] = useState<Surf | null>(null);

  const W = getToothW(id);
  const H = getToothH(id);
  // Inner zone insets: proportional to tooth size
  const inX = Math.max(6, Math.round(W * 0.27));
  const inY = Math.max(9, Math.round(H * 0.22));

  const q = Math.floor(id / 10);
  const leftIsDistal = q === 1 || q === 4 || q === 5 || q === 8;

  const topSurf:    Surf = isUpper ? 'V' : 'L';
  const bottomSurf: Surf = isUpper ? 'L' : 'V';
  const leftSurf:   Surf = leftIsDistal ? 'D' : 'M';
  const rightSurf:  Surf = leftIsDistal ? 'M' : 'D';

  const isMissing = Object.values(surfMap).some(c => c === 'missing');

  const fillOf = (s: Surf): string => {
    if (activeSurf === s) return '#fde68a';
    if (hov === s && isEditable && !isMissing) return '#e0e7ff';
    const c = surfMap[s];
    if (c && c !== 'healthy') return getCond(c).fill;
    return '#ffffff';
  };

  const strokeOf = (s: Surf): string => {
    if (activeSurf === s) return '#d97706';
    const c = surfMap[s];
    if (c && c !== 'healthy') return getCond(c).stroke;
    return '#c8d4de';
  };

  const bind = (s: Surf) =>
    isEditable && !isMissing
      ? {
          onClick: (e: React.MouseEvent) => { e.stopPropagation(); onSurf(s); },
          onMouseEnter: () => setHov(s),
          onMouseLeave: () => setHov(null),
          style: { cursor: 'pointer' } as React.CSSProperties,
        }
      : {};

  const clipId = `tc-${id}`;

  // ── Missing tooth ────────────────────────────────────────────────
  if (isMissing) {
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible', opacity: 0.45 }}>
        <rect x="1" y="1" width={W - 2} height={H - 2} rx="6"
          fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="4,3" />
        <line x1="8" y1="8" x2={W - 8} y2={H - 8}
          stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
        <line x1={W - 8} y1="8" x2="8" y2={H - 8}
          stroke="#94a3b8" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  // Polygon coordinates for the 5 surface zones
  const topPts    = `0,0 ${W},0 ${W - inX},${inY} ${inX},${inY}`;
  const botPts    = `${inX},${H - inY} ${W - inX},${H - inY} ${W},${H} 0,${H}`;
  const leftPts   = `0,0 ${inX},${inY} ${inX},${H - inY} 0,${H}`;
  const rightPts  = `${W},0 ${W},${H} ${W - inX},${H - inY} ${W - inX},${inY}`;

  // ── Normal tooth: 5 interactive zones clipped to tooth shape ────
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}
      style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        {/* Clip to rounded-rectangle tooth outline */}
        <clipPath id={clipId}>
          <rect x="0" y="0" width={W} height={H} rx="6" ry="5" />
        </clipPath>
      </defs>

      <g clipPath={`url(#${clipId})`}>
        {/* TOP (Vestibular / Lingual) */}
        <polygon points={topPts}
          fill={fillOf(topSurf)} stroke={strokeOf(topSurf)}
          strokeWidth="0.8" strokeLinejoin="round"
          {...bind(topSurf)} />

        {/* BOTTOM (Lingual / Vestibular) */}
        <polygon points={botPts}
          fill={fillOf(bottomSurf)} stroke={strokeOf(bottomSurf)}
          strokeWidth="0.8" strokeLinejoin="round"
          {...bind(bottomSurf)} />

        {/* LEFT (Distal / Mesial) */}
        <polygon points={leftPts}
          fill={fillOf(leftSurf)} stroke={strokeOf(leftSurf)}
          strokeWidth="0.8" strokeLinejoin="round"
          {...bind(leftSurf)} />

        {/* RIGHT (Mesial / Distal) */}
        <polygon points={rightPts}
          fill={fillOf(rightSurf)} stroke={strokeOf(rightSurf)}
          strokeWidth="0.8" strokeLinejoin="round"
          {...bind(rightSurf)} />

        {/* CENTER — Oclusal / Incisal */}
        <rect x={inX} y={inY} width={W - 2 * inX} height={H - 2 * inY}
          fill={fillOf('O')} stroke={strokeOf('O')}
          strokeWidth="0.8"
          {...bind('O')} />
      </g>

      {/* Surface labels (decorative, always on top) */}
      <text x={W / 2} y={inY / 2 + 3} textAnchor="middle" fontSize="6" fontWeight="800" fill="#94a3b8" pointerEvents="none">{topSurf}</text>
      <text x={W / 2} y={H - inY / 2 + 3} textAnchor="middle" fontSize="6" fontWeight="800" fill="#94a3b8" pointerEvents="none">{bottomSurf}</text>
      <text x={inX / 2} y={H / 2 + 2} textAnchor="middle" fontSize="6" fontWeight="800" fill="#94a3b8" pointerEvents="none">{leftSurf}</text>
      <text x={W - inX / 2} y={H / 2 + 2} textAnchor="middle" fontSize="6" fontWeight="800" fill="#94a3b8" pointerEvents="none">{rightSurf}</text>
      <text x={W / 2} y={H / 2 + 2} textAnchor="middle" fontSize="7" fontWeight="900" fill="#64748b" pointerEvents="none">O</text>

      {/* Outer tooth border (drawn above clip so it's always visible) */}
      <rect x="0.5" y="0.5" width={W - 1} height={H - 1} rx="6" ry="5"
        fill="none" stroke="#94a3b8" strokeWidth="1.2" />
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════════
// <ToothCell /> — FDI number label + SVG tooth + selection ring + arch rotation
// ══════════════════════════════════════════════════════════════════════
interface ToothCellProps {
  id: number;
  isUpper: boolean;
  isEditable: boolean;
  surfMap: SurfMap;
  activeTooth: number | null;
  activeSurf: Surf | null;
  onSurf: (toothId: number, s: Surf) => void;
}

const ToothCell: React.FC<ToothCellProps> = ({
  id, isUpper, isEditable, surfMap, activeTooth, activeSurf, onSurf,
}) => {
  const isActive     = activeTooth === id;
  const hasCondition = Object.values(surfMap).some(c => c && c !== 'healthy');
  const toothW       = getToothW(id);
  const rot          = getArchRot(id);

  const numStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 800,
    lineHeight: '1',
    color: hasCondition ? '#5b21b6' : '#94a3b8',
    minWidth: toothW,
    textAlign: 'center',
    userSelect: 'none',
    display: 'block',
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        flexShrink: 0,
        // Arch curvature: pivot point is well below/above the tooth
        transform: `rotate(${rot}deg)`,
        transformOrigin: isUpper ? 'center 200%' : 'center -100%',
      }}
    >
      {/* FDI number — ABOVE the tooth for the upper jaw */}
      {isUpper && <span style={numStyle}>{id}</span>}

      {/* SVG with selection ring */}
      <div
        style={{
          borderRadius: 7,
          outline: isActive ? '2.5px solid #f59e0b' : '2px solid transparent',
          outlineOffset: 3,
          boxShadow: isActive ? '0 0 0 5px rgba(245,158,11,0.15)' : 'none',
          transition: 'all 0.12s',
        }}
      >
        <ToothSVG
          id={id}
          surfMap={surfMap}
          activeSurf={isActive ? activeSurf : null}
          isEditable={isEditable}
          isUpper={isUpper}
          onSurf={(s) => onSurf(id, s)}
        />
      </div>

      {/* FDI number — BELOW the tooth for the lower jaw */}
      {!isUpper && <span style={numStyle}>{id}</span>}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════
// <ConditionPicker /> — condition selector panel
// Rendered below the board, NOT floating, so it never clips
// ══════════════════════════════════════════════════════════════════════
interface PickerProps {
  toothId: number;
  surf: Surf;
  current: Cond;
  onSelect: (c: Cond) => void;
  onClose: () => void;
}

const ConditionPicker: React.FC<PickerProps> = ({
  toothId, surf, current, onSelect, onClose,
}) => (
  <div
    style={{
      background: 'white',
      border: '1px solid #e2e8f0',
      borderRadius: 12,
      padding: '12px 14px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
      marginTop: 14,
    }}
  >
    {/* Header */}
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>
        Diente{' '}
        <strong style={{ color: '#7c3aed' }}>{toothId}</strong>
        {' · '}
        {SURF_NAME[surf]}
      </span>
      <button
        onClick={onClose}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: '#94a3b8', padding: '2px 4px', borderRadius: 4,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={14} />
      </button>
    </div>

    {/* Condition grid */}
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 6,
      }}
    >
      {CONDS.map(c => (
        <button
          key={c.id}
          onClick={() => { onSelect(c.id); onClose(); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '7px 8px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 700,
            border: `2px solid ${current === c.id ? c.stroke : '#e2e8f0'}`,
            background: current === c.id ? c.fill : '#fafafa',
            color: '#374151',
            cursor: 'pointer',
            transition: 'all 0.1s',
          }}
        >
          <span
            style={{
              width: 9,
              height: 9,
              borderRadius: 2,
              flexShrink: 0,
              background: c.fill,
              border: `1.5px solid ${c.stroke}`,
              display: 'inline-block',
            }}
          />
          {c.label}
        </button>
      ))}
    </div>
  </div>
);

// ══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════════════
type Mode = 'adult' | 'child';

export const Odontogram: React.FC<OdontogramProps> = ({
  patientId, isEditable, onTreatmentsChange,
}) => {
  const { api } = useAppContext();

  const [mode, setMode]             = useState<Mode>('adult');
  const [odoState, setOdoState]     = useState<OdoState>({});
  const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
  const [services, setServices]     = useState<Service[]>([]);
  const [searchTerm, setSearch]     = useState('');
  const [isSaving, setSaving]       = useState(false);

  // Which surface on which tooth is currently selected for editing
  const [activeTooth, setActiveTooth] = useState<number | null>(null);
  const [activeSurf,  setActiveSurf]  = useState<Surf | null>(null);

  // Load services
  useEffect(() => {
    if (!api?.services?.getAll) return;
    api.services.getAll()
      .then((d: Service[]) => setServices(d || []))
      .catch((e: unknown) => console.error('services:', e));
  }, [api]);

  // Load treatments & seed odontogram state
  useEffect(() => {
    if (!patientId || !api?.treatments?.getByPatient) return;
    api.treatments.getByPatient(patientId)
      .then((data: PatientTreatment[]) => {
        const list = data || [];
        setTreatments(list);
        onTreatmentsChange?.(list);

        const init: OdoState = {};
        list.forEach(t => {
          if (!t.toothId) return;
          const s = (t as any).surface as Surf | undefined;
          const c: Cond = t.status === 'COMPLETADO' ? 'filled' : 'caries';
          if (!init[t.toothId]) init[t.toothId] = {};
          if (s) {
            init[t.toothId][s] = c;
          } else {
            (['V', 'L', 'M', 'D', 'O'] as Surf[]).forEach(x => {
              init[t.toothId!][x] = c;
            });
          }
        });
        setOdoState(init);
      })
      .catch((e: unknown) => console.error('treatments:', e));
  }, [patientId, api]);

  // ── Click a surface → toggle selection ──────────────────────────────
  const handleSurf = (toothId: number, s: Surf) => {
    if (!isEditable) return;
    if (activeTooth === toothId && activeSurf === s) {
      setActiveTooth(null);
      setActiveSurf(null);
    } else {
      setActiveTooth(toothId);
      setActiveSurf(s);
    }
  };

  // ── Select a condition from the picker ──────────────────────────────
  const handleCondSelect = (cond: Cond) => {
    if (!activeTooth || !activeSurf) return;
    setOdoState(prev => {
      const tooth = { ...(prev[activeTooth] ?? {}) };
      if (cond === 'missing') {
        return {
          ...prev,
          [activeTooth]: { V: 'missing', L: 'missing', M: 'missing', D: 'missing', O: 'missing' },
        };
      }
      return { ...prev, [activeTooth]: { ...tooth, [activeSurf]: cond } };
    });
    setActiveTooth(null);
    setActiveSurf(null);
  };

  // ── Treatment helpers ────────────────────────────────────────────────
  const handleAddTreatment = (service: Service) => {
    if (!activeTooth) {
      alert('Selecciona primero un diente en el odontograma');
      return;
    }
    const newT: PatientTreatment = {
      id: `temp-${Date.now()}-${activeTooth}`,
      patientId,
      serviceId: service.id,
      serviceName: service.name,
      toothId: activeTooth,
      price: service.final_price,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString(),
    };
    const updated = [...treatments, newT];
    setTreatments(updated);
    onTreatmentsChange?.(updated);
    setSearch('');
  };

  const handleDelete = (id: string) => {
    const updated = treatments.filter(t => t.id !== id);
    setTreatments(updated);
    onTreatmentsChange?.(updated);
  };

  const handleSave = async () => {
    const pending = treatments.filter(t => t.id.startsWith('temp-'));
    if (!pending.length) return;
    try {
      setSaving(true);
      await api.treatments.create(pending);
      const data = await api.treatments.getByPatient(patientId);
      setTreatments(data || []);
      onTreatmentsChange?.(data || []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const filtered   = services.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const tempCount  = treatments.filter(t => t.id.startsWith('temp-')).length;
  const totalPrice = treatments.reduce((sum, t) => sum + (t.price ?? 0), 0);

  const arcs = mode === 'adult' ? ADULT : CHILD;

  // ── Render helpers ────────────────────────────────────────────────────
  const renderTooth = (id: number, isUpper: boolean) => (
    <ToothCell
      key={id}
      id={id}
      isUpper={isUpper}
      isEditable={isEditable}
      surfMap={odoState[id] ?? {}}
      activeTooth={activeTooth}
      activeSurf={activeSurf}
      onSurf={handleSurf}
    />
  );

  // One complete arcade row (left quadrant + midline divider + right quadrant)
  const renderArcade = (
    left: number[],
    right: number[],
    isUpper: boolean,
  ) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'nowrap',
        gap: 2,
        overflow: 'visible',
        padding: '4px 0',
      }}
    >
      {left.map(id => renderTooth(id, isUpper))}

      {/* Vertical midline divider */}
      <div
        style={{
          width: 2,
          height: 64,
          background: 'linear-gradient(to bottom, #e2e8f0, #94a3b8, #e2e8f0)',
          margin: '0 6px',
          flexShrink: 0,
          borderRadius: 2,
          opacity: 0.8,
        }}
      />

      {right.map(id => renderTooth(id, isUpper))}
    </div>
  );

  // ── Labels ──────────────────────────────────────────────────────────
  const quarterLabel = (a: string, b: string) => (
    <div
      style={{
        display: 'flex',
        gap: 6,
        justifyContent: 'center',
        width: '100%',
      }}
    >
      {[a, b].map(txt => (
        <span
          key={txt}
          style={{
            fontSize: 9,
            fontWeight: 800,
            color: '#94a3b8',
            letterSpacing: 2,
            textTransform: 'uppercase' as const,
          }}
        >
          {txt}
        </span>
      ))}
    </div>
  );

  const jawLabel = (text: string) => (
    <p
      style={{
        fontSize: 9,
        fontWeight: 800,
        color: '#94a3b8',
        letterSpacing: 3,
        textTransform: 'uppercase',
        margin: 0,
      }}
    >
      {text}
    </p>
  );

  // ════════════════════════════════════════════════════════════════════
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── HEADER ────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ fontSize: 18, fontWeight: 900, color: '#0f172a', margin: 0 }}>
            Odontograma FDI
          </h3>
          <p style={{ fontSize: 11, color: '#94a3b8', margin: '4px 0 0' }}>
            {mode === 'adult'
              ? 'Dentición permanente · 32 piezas (cuadrantes 1–4)'
              : 'Dentición temporal · 20 piezas (cuadrantes 5–8)'}
          </p>
        </div>

        {/* ── ADULT / CHILD TOGGLE ──────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: 4,
            background: '#f1f5f9',
            borderRadius: 10,
            border: '1px solid #e2e8f0',
          }}
        >
          {(['adult', 'child'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setActiveTooth(null);
                setActiveSurf(null);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 16px',
                borderRadius: 7,
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                border: mode === m ? '1px solid #e2e8f0' : '1px solid transparent',
                background: mode === m ? 'white' : 'transparent',
                color: mode === m ? (m === 'adult' ? '#5b21b6' : '#be185d') : '#64748b',
                boxShadow: mode === m ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {m === 'adult' ? <User size={14} /> : <Baby size={14} />}
              {m === 'adult' ? 'Adulto' : 'Niño'}
            </button>
          ))}
        </div>
      </div>

      {/* ── ODONTOGRAM BOARD ──────────────────────────────────────── */}
      <div
        style={{
          background: 'white',
          border: '1px solid #e2e8f0',
          borderRadius: 16,
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
          padding: '20px 16px',
        }}
      >
        {/* Scrollable container — teeth NEVER wrap */}
        <div style={{ overflowX: 'auto' }}>
          <div
            style={{
              minWidth: 'max-content',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 0,
            }}
          >
            {/* Top quadrant labels */}
            {quarterLabel(
              `${mode === 'adult' ? 'Q1' : 'Q5'} (Derecho paciente)`,
              `(Izquierdo paciente) ${mode === 'adult' ? 'Q2' : 'Q6'}`,
            )}

            {/* SUPERIOR label */}
            <div style={{ marginTop: 6, marginBottom: 8 }}>
              {jawLabel('▲ MAXILAR SUPERIOR')}
            </div>

            {/* UPPER ARCADE */}
            {renderArcade(arcs.upperLeft, arcs.upperRight, true)}

            {/* Horizontal midline */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                margin: '12px 0',
              }}
            >
              <div style={{ borderTop: '1.5px dashed #e2e8f0' }} />
              <span
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  transform: 'translate(-50%, -50%)',
                  background: 'white',
                  padding: '0 10px',
                  fontSize: 8,
                  fontWeight: 800,
                  color: '#cbd5e1',
                  letterSpacing: 2,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                }}
              >
                LÍNEA MEDIA
              </span>
            </div>

            {/* LOWER ARCADE */}
            {renderArcade(arcs.lowerLeft, arcs.lowerRight, false)}

            {/* INFERIOR label */}
            <div style={{ marginTop: 8, marginBottom: 6 }}>
              {jawLabel('▼ MAXILAR INFERIOR')}
            </div>

            {/* Bottom quadrant labels */}
            {quarterLabel(
              `${mode === 'adult' ? 'Q4' : 'Q8'} (Derecho paciente)`,
              `(Izquierdo paciente) ${mode === 'adult' ? 'Q3' : 'Q7'}`,
            )}
          </div>
        </div>

        {/* ── CONDITION PICKER — inline below the board ─────────── */}
        {activeTooth && activeSurf && isEditable && (
          <ConditionPicker
            toothId={activeTooth}
            surf={activeSurf}
            current={odoState[activeTooth]?.[activeSurf] ?? 'healthy'}
            onSelect={handleCondSelect}
            onClose={() => {
              setActiveTooth(null);
              setActiveSurf(null);
            }}
          />
        )}

        {/* ── LEGEND ────────────────────────────────────────────── */}
        <div
          style={{
            marginTop: 16,
            paddingTop: 12,
            borderTop: '1px solid #f1f5f9',
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            justifyContent: 'center',
          }}
        >
          {CONDS.map(c => (
            <span
              key={c.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 10,
                fontWeight: 600,
                color: '#475569',
              }}
            >
              <span
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: 2,
                  flexShrink: 0,
                  background: c.fill,
                  border: `1.5px solid ${c.stroke}`,
                  display: 'inline-block',
                }}
              />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* ── HELP TIP ──────────────────────────────────────────────── */}
      {isEditable && !activeTooth && (
        <div
          style={{
            background: '#f5f3ff',
            border: '1px solid #ddd6fe',
            borderRadius: 10,
            padding: '10px 14px',
          }}
        >
          <p style={{ fontSize: 12, color: '#5b21b6', margin: 0, fontWeight: 600 }}>
            💡 Haz clic en cualquier cara del diente para asignar su estado.
            Caras disponibles:{' '}
            <strong>V</strong> Vestibular ·{' '}
            <strong>L</strong> Lingual ·{' '}
            <strong>M</strong> Mesial ·{' '}
            <strong>D</strong> Distal ·{' '}
            <strong>O</strong> Oclusal.
          </p>
        </div>
      )}

      {/* ── TREATMENT PANEL ───────────────────────────────────────── */}
      {isEditable && (
        <div
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            padding: 20,
          }}
        >
          <h4
            style={{
              fontSize: 14,
              fontWeight: 900,
              color: '#0f172a',
              margin: '0 0 4px',
            }}
          >
            Añadir Tratamiento
          </h4>
          <p
            style={{
              fontSize: 11,
              color: activeTooth ? '#5b21b6' : '#94a3b8',
              fontWeight: 600,
              margin: '0 0 12px',
            }}
          >
            {activeTooth
              ? `Diente seleccionado: ${activeTooth}`
              : 'Selecciona un diente en el odontograma y busca el tratamiento'}
          </p>

          <input
            type="text"
            placeholder="Buscar tratamiento (limpieza, corona, endodoncia…)"
            value={searchTerm}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              boxSizing: 'border-box',
              border: '1.5px solid #e2e8f0',
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
              background: '#f8fafc',
            }}
          />

          {searchTerm.length > 0 && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
                gap: 8,
                marginTop: 10,
                maxHeight: 200,
                overflowY: 'auto',
              }}
            >
              {filtered.length === 0 ? (
                <p
                  style={{
                    color: '#94a3b8',
                    fontSize: 13,
                    gridColumn: '1/-1',
                    textAlign: 'center',
                    padding: '16px 0',
                  }}
                >
                  Sin resultados
                </p>
              ) : (
                filtered.map(s => (
                  <button
                    key={s.id}
                    onClick={() => handleAddTreatment(s)}
                    disabled={!activeTooth}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: '1.5px solid #e2e8f0',
                      background: 'white',
                      textAlign: 'left',
                      cursor: activeTooth ? 'pointer' : 'not-allowed',
                      opacity: activeTooth ? 1 : 0.4,
                      transition: 'all 0.1s',
                    }}
                  >
                    <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {s.name}
                    </p>
                    <p style={{ margin: '3px 0 0', fontSize: 11, fontWeight: 700, color: '#7c3aed' }}>
                      {s.final_price}€
                    </p>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* ── TREATMENTS LIST ───────────────────────────────────────── */}
      {treatments.length > 0 && (
        <div
          style={{
            background: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: 16,
            boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
            padding: 20,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <h4
              style={{
                fontSize: 14,
                fontWeight: 900,
                color: '#0f172a',
                margin: 0,
              }}
            >
              Tratamientos ({treatments.length})
            </h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 17, fontWeight: 900, color: '#0f172a' }}>
                {totalPrice.toFixed(2)} €
              </span>
              {isEditable && tempCount > 0 && (
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: 'none',
                    background: '#7c3aed',
                    color: 'white',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    opacity: isSaving ? 0.6 : 1,
                  }}
                >
                  <Save size={13} />
                  {isSaving ? 'Guardando…' : `Guardar (${tempCount})`}
                </button>
              )}
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              maxHeight: 280,
              overflowY: 'auto',
            }}
          >
            {treatments.map(t => (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 12px',
                  borderRadius: 10,
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 900,
                      color: '#7c3aed',
                      minWidth: 24,
                      textAlign: 'center',
                    }}
                  >
                    {t.toothId ?? '–'}
                  </span>
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}
                  >
                    {t.serviceName}
                  </span>
                  {t.id.startsWith('temp-') && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        padding: '2px 7px',
                        borderRadius: 20,
                        background: '#fef9c3',
                        color: '#92400e',
                      }}
                    >
                      Sin guardar
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 700,
                      padding: '2px 7px',
                      borderRadius: 20,
                      background:
                        t.status === 'COMPLETADO' ? '#dcfce7' : '#f1f5f9',
                      color:
                        t.status === 'COMPLETADO' ? '#166534' : '#64748b',
                    }}
                  >
                    {t.status}
                  </span>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 900,
                      color: '#0f172a',
                    }}
                  >
                    {(t.price ?? 0).toFixed(2)} €
                  </span>
                  {isEditable && (
                    <button
                      onClick={() => handleDelete(t.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#f87171',
                        padding: '3px',
                        borderRadius: 6,
                        display: 'flex',
                        alignItems: 'center',
                      }}
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
