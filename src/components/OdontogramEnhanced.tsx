import React, { useState, useEffect } from 'react';
import { Baby, DollarSign, Plus, Save, Trash2, User, X } from 'lucide-react';
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
// Per-tooth-type dimensions: w=crown width, ch=crown height, rh=root height
const CROWN_DIMS: Record<number, { w: number; ch: number; rh: number }> = {
  1: { w: 22, ch: 36, rh: 50 }, // central incisor
  2: { w: 20, ch: 33, rh: 46 }, // lateral incisor
  3: { w: 23, ch: 40, rh: 60 }, // canine
  4: { w: 27, ch: 32, rh: 44 }, // 1st premolar
  5: { w: 25, ch: 30, rh: 40 }, // 2nd premolar
  6: { w: 40, ch: 36, rh: 40 }, // 1st molar
  7: { w: 38, ch: 34, rh: 38 }, // 2nd molar
  8: { w: 32, ch: 30, rh: 32 }, // wisdom
  0: { w: 28, ch: 32, rh: 38 }, // default
};
const CHILD_SCALE = 0.80;

// Arch curvature: degrees of rotation from midline outward
const ARCH_ROT_MAP: Record<number, number> = {
  1: 0, 2: 2, 3: 5, 4: 8, 5: 11, 6: 14, 7: 17, 8: 19, 0: 0,
};

function getToothDims(id: number) {
  const digit = id % 10;
  const d = CROWN_DIMS[digit] ?? CROWN_DIMS[0];
  const s = id >= 50 ? CHILD_SCALE : 1;
  return {
    w:  Math.round(d.w  * s),
    ch: Math.round(d.ch * s),
    rh: Math.round(d.rh * s),
    totalH: Math.round((d.ch + d.rh) * s),
  };
}

// Crown outline path in (0..W, 0..CH) coords.
// y=0 is occlusal/incisal, y=CH is cervical (gum line).
function getCrownPath(digit: number, W: number, H: number): string {
  const w = W, h = H;
  switch (digit) {
    // Incisors: trapezoidal — wider at incisal, narrower at cervical, slightly convex mesial/distal
    case 1: return `M ${w*.12} ${h} C ${w*.04} ${h*.8} 0 ${h*.5} ${w*.04} ${h*.12} L ${w*.08} 0 L ${w*.92} 0 L ${w*.96} ${h*.12} C ${w} ${h*.5} ${w*.96} ${h*.8} ${w*.88} ${h} Z`;
    case 2: return `M ${w*.1}  ${h} C ${w*.04} ${h*.8} 0 ${h*.5} ${w*.04} ${h*.14} L ${w*.08} 0 L ${w*.92} 0 L ${w*.96} ${h*.14} C ${w} ${h*.5} ${w*.96} ${h*.8} ${w*.9}  ${h} Z`;
    // Canine: long crown, slightly bulging sides, clear pointed cusp
    case 3: return `M ${w*.08} ${h} C ${w*.03} ${h*.75} 0 ${h*.5} ${w*.02} ${h*.28} C ${w*.1} ${h*.06} ${w*.36} 0 ${w*.5} 0 C ${w*.64} 0 ${w*.9} ${h*.06} ${w*.98} ${h*.28} C ${w} ${h*.5} ${w*.97} ${h*.75} ${w*.92} ${h} Z`;
    // Premolars: rectangular crown with distinct cusp bumps at incisal
    case 4: return `M 0 ${h} L 0 ${h*.6} C 0 ${h*.34} ${w*.06} ${h*.14} ${w*.2} ${h*.04} C ${w*.28} ${h*.17} ${w*.36} ${h*.26} ${w*.45} ${h*.12} L ${w*.5} 0 L ${w*.55} ${h*.12} C ${w*.64} ${h*.26} ${w*.72} ${h*.17} ${w*.8} ${h*.04} C ${w*.94} ${h*.14} ${w} ${h*.34} ${w} ${h*.6} L ${w} ${h} Z`;
    case 5: return `M 0 ${h} L 0 ${h*.58} C 0 ${h*.32} ${w*.08} ${h*.14} ${w*.22} ${h*.04} C ${w*.32} ${h*.18} ${w*.43} ${h*.28} ${w*.5} ${h*.08} C ${w*.57} ${h*.28} ${w*.68} ${h*.18} ${w*.78} ${h*.04} C ${w*.92} ${h*.14} ${w} ${h*.32} ${w} ${h*.58} L ${w} ${h} Z`;
    // Molars: wide crown, two buccal cusps with central groove
    case 6: return `M 0 ${h} L 0 ${h*.56} C 0 ${h*.3} ${w*.04} ${h*.13} ${w*.18} ${h*.03} C ${w*.28} ${h*.15} ${w*.38} ${h*.23} ${w*.48} ${h*.1} L ${w*.5} 0 L ${w*.52} ${h*.1} C ${w*.62} ${h*.23} ${w*.72} ${h*.15} ${w*.82} ${h*.03} C ${w*.96} ${h*.13} ${w} ${h*.3} ${w} ${h*.56} L ${w} ${h} Z`;
    case 7: return `M 0 ${h} L 0 ${h*.54} C 0 ${h*.29} ${w*.05} ${h*.13} ${w*.19} ${h*.03} C ${w*.29} ${h*.15} ${w*.39} ${h*.24} ${w*.48} ${h*.11} L ${w*.5} 0 L ${w*.52} ${h*.11} C ${w*.61} ${h*.24} ${w*.71} ${h*.15} ${w*.81} ${h*.03} C ${w*.95} ${h*.13} ${w} ${h*.29} ${w} ${h*.54} L ${w} ${h} Z`;
    case 8: return `M 0 ${h} L 0 ${h*.56} C 0 ${h*.32} ${w*.06} ${h*.16} ${w*.2}  ${h*.05} C ${w*.29} ${h*.17} ${w*.38} ${h*.26} ${w*.46} ${h*.13} L ${w*.5} ${h*.02} L ${w*.54} ${h*.13} C ${w*.62} ${h*.26} ${w*.71} ${h*.17} ${w*.8} ${h*.05} C ${w*.94} ${h*.16} ${w} ${h*.32} ${w} ${h*.56} L ${w} ${h} Z`;
    default: return `M 0 ${h} L 0 0 L ${w} 0 L ${w} ${h} Z`;
  }
}

// Root SVG paths. y=0 is cervical, y=RH is root apex.
// Returns array of { d: path, bg?: bool (lighter «palatal» root drawn behind) }
function getRootPaths(digit: number, quadrant: number, W: number, RH: number): Array<{ d: string; bg?: boolean }> {
  const w = W, r = RH;
  const isUpper = quadrant <= 2 || quadrant === 5 || quadrant === 6;
  // Single straight tapered root from cervical (y=0) to apex (y=r)
  const tapRoot = (x1: number, x2: number, ax: number) =>
    `M ${w*x1} 0 C ${w*x1} ${r*.5} ${w*(ax-.08)} ${r*.9} ${w*ax} ${r} C ${w*(ax+.08)} ${r*.9} ${w*x2} ${r*.5} ${w*x2} 0 Z`;
  switch (digit) {
    case 1: return [{ d: tapRoot(.18, .82, .5) }];
    case 2: return [{ d: tapRoot(.2, .8, .49) }];
    // Canine: long single root, slightly bulging
    case 3: return [{ d: `M ${w*.16} 0 C ${w*.1} ${r*.45} ${w*.18} ${r*.9} ${w*.45} ${r} C ${w*.72} ${r} ${w*.9} ${r*.9} ${w*.84} ${r*.45} ${w*.84} 0 Z` }];
    case 4: // 1st premolar
      if (isUpper) return [ // bifurcated — buccal + palatal roots
        { d: `M ${w*.1} 0 C ${w*.06} ${r*.5} ${w*.08} ${r*.88} ${w*.25} ${r} C ${w*.36} ${r*.88} ${w*.37} ${r*.5} ${w*.34} 0 Z` },
        { d: `M ${w*.66} 0 C ${w*.63} ${r*.5} ${w*.64} ${r*.88} ${w*.75} ${r} C ${w*.92} ${r*.88} ${w*.94} ${r*.5} ${w*.9} 0 Z` },
      ];
      return [{ d: tapRoot(.15, .85, .5) }];
    case 5: return [{ d: tapRoot(.18, .82, .5) }];
    case 6: // 1st molar
    case 7: // 2nd molar
      if (isUpper) return [ // 3 roots: mesiobuccal, palatal (bg), distobuccal
        { d: `M ${w*.04} 0 C 0 ${r*.52} ${w*.04} ${r*.9} ${w*.2} ${r} C ${w*.3} ${r*.9} ${w*.31} ${r*.52} ${w*.29} 0 Z` },
        { d: `M ${w*.38} 0 C ${w*.34} ${r*.38} ${w*.41} ${r*.7} ${w*.5} ${r*.76} C ${w*.59} ${r*.7} ${w*.66} ${r*.38} ${w*.62} 0 Z`, bg: true },
        { d: `M ${w*.71} 0 C ${w*.69} ${r*.52} ${w*.7} ${r*.9} ${w*.8} ${r} C ${w*.96} ${r*.9} ${w} ${r*.52} ${w*.96} 0 Z` },
      ];
      return [ // 2 roots: mesial + distal, clearly separated
        { d: `M ${w*.06} 0 C ${w*.02} ${r*.52} ${w*.06} ${r*.9} ${w*.23} ${r} C ${w*.35} ${r*.9} ${w*.36} ${r*.52} ${w*.33} 0 Z` },
        { d: `M ${w*.67} 0 C ${w*.64} ${r*.52} ${w*.65} ${r*.9} ${w*.77} ${r} C ${w*.94} ${r*.9} ${w*.98} ${r*.52} ${w*.94} 0 Z` },
      ];
    case 8: // Wisdom
      if (isUpper) return [
        { d: `M ${w*.1} 0 C ${w*.06} ${r*.5} ${w*.1} ${r*.88} ${w*.28} ${r} C ${w*.4} ${r*.88} ${w*.42} ${r*.5} ${w*.38} 0 Z` },
        { d: `M ${w*.62} 0 C ${w*.58} ${r*.5} ${w*.6} ${r*.88} ${w*.72} ${r} C ${w*.9} ${r*.88} ${w*.94} ${r*.5} ${w*.9} 0 Z` },
      ];
      return [
        { d: `M ${w*.12} 0 C ${w*.08} ${r*.5} ${w*.12} ${r*.88} ${w*.3} ${r} C ${w*.42} ${r*.88} ${w*.44} ${r*.5} ${w*.4} 0 Z` },
        { d: `M ${w*.6} 0 C ${w*.56} ${r*.5} ${w*.58} ${r*.88} ${w*.7} ${r} C ${w*.88} ${r*.88} ${w*.92} ${r*.5} ${w*.88} 0 Z` },
      ];
    default: return [{ d: tapRoot(.2, .8, .5) }];
  }
}

const getArchRot = (id: number): number => {
  const digit = id % 10;
  const q = Math.floor(id / 10);
  const angle = ARCH_ROT_MAP[digit] ?? 0;
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
// <ToothSVG /> — Anatomical tooth with buccal-view crown + root shapes
// isUpper=true  → SVG flipped so roots are at TOP, crown at BOTTOM
// isUpper=false → roots at BOTTOM, crown at TOP (natural buccal view)
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
  const { w, ch, rh, totalH } = getToothDims(id);
  const digit = id % 10;
  const q     = Math.floor(id / 10);

  // Surface zone insets
  const inX = Math.max(4, Math.round(w  * 0.22));
  const inY = Math.max(6, Math.round(ch * 0.24));

  // M/D assignment by quadrant
  const leftIsDistal = q === 1 || q === 4 || q === 5 || q === 8;
  const leftSurf:  Surf = leftIsDistal ? 'D' : 'M';
  const rightSurf: Surf = leftIsDistal ? 'M' : 'D';

  const isMissing = Object.values(surfMap).some(c => c === 'missing');

  const fillOf = (s: Surf) => {
    if (activeSurf === s) return '#fde68a';
    if (hov === s && isEditable && !isMissing) return '#e0e7ff';
    const c = surfMap[s];
    return c && c !== 'healthy' ? getCond(c).fill : '#ffffff';
  };
  const strokeOf = (s: Surf) => {
    if (activeSurf === s) return '#d97706';
    const c = surfMap[s];
    return c && c !== 'healthy' ? getCond(c).stroke : '#c8d4de';
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

  const clipId      = `tc-${id}`;
  const crownPathD  = getCrownPath(digit, w, ch);
  const rootDefs    = getRootPaths(digit, q, w, rh);
  // For upper teeth, flip the entire content vertically so roots appear at top
  const flip = isUpper
    ? `scale(1,-1) translate(0, ${-totalH})`
    : undefined;

  // Crown 5-surface polygons (0..w × 0..ch, y=0 is occlusal)
  const topPts   = `0,0 ${w},0 ${w-inX},${inY} ${inX},${inY}`;
  const botPts   = `${inX},${ch-inY} ${w-inX},${ch-inY} ${w},${ch} 0,${ch}`;
  const leftPts  = `0,0 ${inX},${inY} ${inX},${ch-inY} 0,${ch}`;
  const rightPts = `${w},0 ${w},${ch} ${w-inX},${ch-inY} ${w-inX},${inY}`;

  if (isMissing) {
    return (
      <svg width={w} height={totalH} style={{ display: 'block', overflow: 'visible', opacity: 0.5 }}>
        <g transform={flip}>
          <g transform={`translate(0,${ch})`}>
            {rootDefs.map((r, i) => (
              <path key={i} d={r.d} fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
            ))}
          </g>
          <path d={crownPathD} fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1.2" strokeDasharray="3,2" />
          <line x1={w*.2} y1={ch*.12} x2={w*.8} y2={ch*.88} stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
          <line x1={w*.8} y1={ch*.12} x2={w*.2} y2={ch*.88} stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }

  return (
    <svg width={w} height={totalH} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <clipPath id={clipId}>
          <path d={crownPathD} />
        </clipPath>
      </defs>

      <g transform={flip}>
        {/* ── Roots (behind crown) ───────────────────────────── */}
        <g transform={`translate(0,${ch})`}>
          {rootDefs.map((r, i) => (
            <path key={i} d={r.d}
              fill={r.bg ? '#e8e0d0' : '#f0ece4'}
              stroke={r.bg ? '#b0a080' : '#9a8868'}
              strokeWidth="1"
            />
          ))}
        </g>

        {/* ── Crown surface zones, clipped to tooth outline ─── */}
        <g clipPath={`url(#${clipId})`}>
          {/* O – Occlusal/Incisal (top) */}
          <polygon points={topPts}   fill={fillOf('O')} stroke={strokeOf('O')} strokeWidth="0.6" {...bind('O')} />
          {/* L – Lingual (bottom) */}
          <polygon points={botPts}   fill={fillOf('L')} stroke={strokeOf('L')} strokeWidth="0.6" {...bind('L')} />
          {/* LEFT surface */}
          <polygon points={leftPts}  fill={fillOf(leftSurf)}  stroke={strokeOf(leftSurf)}  strokeWidth="0.6" {...bind(leftSurf)}  />
          {/* RIGHT surface */}
          <polygon points={rightPts} fill={fillOf(rightSurf)} stroke={strokeOf(rightSurf)} strokeWidth="0.6" {...bind(rightSurf)} />
          {/* V – Vestibular (centre) */}
          <rect x={inX} y={inY} width={w-2*inX} height={ch-2*inY}
            fill={fillOf('V')} stroke={strokeOf('V')} strokeWidth="0.6" {...bind('V')} />
        </g>

        {/* ── Surface labels ─────────────────────────────────── */}
        <text x={w/2}      y={inY/2+2}      textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#94a3b8" pointerEvents="none">O</text>
        <text x={w/2}      y={ch-inY/2+2}   textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#94a3b8" pointerEvents="none">L</text>
        <text x={inX/2}    y={ch/2+2}       textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#94a3b8" pointerEvents="none">{leftSurf}</text>
        <text x={w-inX/2}  y={ch/2+2}       textAnchor="middle" fontSize="5.5" fontWeight="800" fill="#94a3b8" pointerEvents="none">{rightSurf}</text>
        <text x={w/2}      y={ch/2+2}       textAnchor="middle" fontSize="6"   fontWeight="900" fill="#64748b" pointerEvents="none">V</text>

        {/* ── Crown outline on top ───────────────────────────── */}
        <path d={crownPathD} fill="none" stroke="#5a7a94" strokeWidth="1.4" />
        {/* Cervical line */}
        <line x1={0} y1={ch} x2={w} y2={ch} stroke="#8aa0b0" strokeWidth="0.7" strokeDasharray="2,1.5" />
        {/* Internal groove lines for molars/premolars */}
        {(digit === 6 || digit === 7 || digit === 8) && (
          <path
            d={`M ${w*.5} ${ch*.1} C ${w*.49} ${ch*.35} ${w*.5} ${ch*.55} ${w*.5} ${ch*.68}`}
            fill="none" stroke="#8aaabb" strokeWidth="0.9" opacity="0.6"
            clipPath={`url(#${clipId})`}
          />
        )}
        {digit === 4 && (
          <path
            d={`M ${w*.5} ${ch*.12} C ${w*.49} ${ch*.3} ${w*.5} ${ch*.5} ${w*.5} ${ch*.62}`}
            fill="none" stroke="#8aaabb" strokeWidth="0.8" opacity="0.5"
            clipPath={`url(#${clipId})`}
          />
        )}
      </g>
    </svg>
  );
};

// ══════════════════════════════════════════════════════════════════════
// <ToothCell /> — FDI number + SVG tooth + selection ring + arch rotation
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
  const { w }        = getToothDims(id);

  const numStyle: React.CSSProperties = {
    fontSize: 9, fontWeight: 800, lineHeight: '1',
    color: hasCondition ? '#5b21b6' : '#94a3b8',
    minWidth: w, textAlign: 'center',
    userSelect: 'none', display: 'block',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 2, flexShrink: 0,
    }}>
      {isUpper && <span style={numStyle}>{id}</span>}
      <div style={{
        borderRadius: 5,
        outline: isActive ? '2.5px solid #f59e0b' : '2px solid transparent',
        outlineOffset: 2,
        boxShadow: isActive ? '0 0 0 4px rgba(245,158,11,0.15)' : 'none',
        transition: 'all 0.12s',
      }}>
        <ToothSVG
          id={id} surfMap={surfMap}
          activeSurf={isActive ? activeSurf : null}
          isEditable={isEditable} isUpper={isUpper}
          onSurf={(s) => onSurf(id, s)}
        />
      </div>
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
  const [searchTerm, setSearch]       = useState('');
  const [isSaving, setSaving]         = useState(false);
  const [isSavingBudget, setSavingBudget] = useState(false);

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

  // Load persisted odontogram state (tooth conditions) from DB
  useEffect(() => {
    if (!patientId || !api?.odontogram?.get) return;
    api.odontogram.get(patientId)
      .then((data: any) => {
        if (data?.teethState) {
          try {
            const parsed: OdoState = typeof data.teethState === 'string'
              ? JSON.parse(data.teethState)
              : data.teethState;
            setOdoState(parsed || {});
          } catch (e) {
            console.error('Error parsing odontogram state:', e);
          }
        }
      })
      .catch((e: unknown) => console.error('odontogram load:', e));
  }, [patientId, api]);

  // Load treatments & seed odontogram state (treatments complement saved conditions)
  useEffect(() => {
    if (!patientId || !api?.treatments?.getByPatient) return;
    api.treatments.getByPatient(patientId)
      .then((data: PatientTreatment[]) => {
        const list = data || [];
        setTreatments(list);
        onTreatmentsChange?.(list);

        // Seed visual state from treatments for teeth that have no manually saved condition.
        // Saved conditions (loaded via api.odontogram.get) always take priority.
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
        // Merge: persisted state (prev) wins over treatment-derived state (init)
        setOdoState(prev => {
          const merged: OdoState = { ...init };
          (Object.keys(prev) as unknown as number[]).forEach(toothKey => {
            const k = Number(toothKey);
            merged[k] = { ...(init[k] ?? {}), ...prev[k] };
          });
          return merged;
        });
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
  const handleCondSelect = async (cond: Cond) => {
    if (!activeTooth || !activeSurf) return;

    // Compute new state synchronously before any async calls
    let newOdoState: OdoState;
    if (cond === 'missing') {
      newOdoState = {
        ...odoState,
        [activeTooth]: { V: 'missing', L: 'missing', M: 'missing', D: 'missing', O: 'missing' },
      };
    } else {
      const tooth = { ...(odoState[activeTooth] ?? {}) };
      newOdoState = { ...odoState, [activeTooth]: { ...tooth, [activeSurf]: cond } };
    }

    setOdoState(newOdoState);
    setActiveTooth(null);
    setActiveSurf(null);

    // Persist tooth conditions to DB
    try {
      if (api?.odontogram?.save) {
        await api.odontogram.save(patientId, newOdoState);
      }
    } catch (e) {
      console.error('Error saving odontogram state:', e);
    }
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
      await api.treatments.createBatch(patientId, pending);
      const data = await api.treatments.getByPatient(patientId);
      setTreatments(data || []);
      onTreatmentsChange?.(data || []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBudget = async () => {
    if (!treatments.length) return;
    try {
      setSavingBudget(true);
      const items = treatments.map(t => ({
        name: t.serviceName || 'Tratamiento',
        price: t.price ?? 0,
        tooth: t.toothId ? String(t.toothId) : undefined,
        quantity: 1,
      }));
      await api.budget.create(patientId, items, 'Presupuesto Odontograma');
      alert('✅ Presupuesto guardado correctamente');
    } catch (e: unknown) {
      console.error('Error saving budget:', e);
      alert('Error al guardar el presupuesto');
    } finally {
      setSavingBudget(false);
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
        alignItems: isUpper ? 'flex-end' : 'flex-start',
        flexWrap: 'nowrap',
        gap: 1,
        overflow: 'visible',
        padding: '2px 0',
      }}
    >
      {left.map(id => renderTooth(id, isUpper))}

      {/* Vertical midline divider */}
      <div
        style={{
          width: 2,
          alignSelf: 'stretch',
          background: '#64748b',
          margin: '0 4px',
          flexShrink: 0,
          minHeight: 64,
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
                margin: '8px 0',
              }}
            >
              <div style={{ borderTop: '2px solid #64748b' }} />
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
                  color: '#64748b',
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
              {isEditable && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {tempCount > 0 && (
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '7px 14px', borderRadius: 8, border: 'none',
                        background: '#16a34a', color: 'white',
                        fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        opacity: isSaving ? 0.6 : 1,
                      }}
                    >
                      <Save size={13} />
                      {isSaving ? 'Guardando…' : `Guardar Tratamiento (${tempCount})`}
                    </button>
                  )}
                  <button
                    onClick={handleSaveBudget}
                    disabled={isSavingBudget || !treatments.length}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 14px', borderRadius: 8, border: 'none',
                      background: '#7c3aed', color: 'white',
                      fontSize: 12, fontWeight: 700, cursor: !treatments.length ? 'not-allowed' : 'pointer',
                      opacity: (isSavingBudget || !treatments.length) ? 0.5 : 1,
                    }}
                  >
                    <DollarSign size={13} />
                    {isSavingBudget ? 'Guardando…' : 'Guardar Presupuesto'}
                  </button>
                </div>
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
