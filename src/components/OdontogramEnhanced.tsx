import React, { useState, useEffect } from 'react';
import { Baby, Plus, Save, User, X } from 'lucide-react';
import { supabase } from '../services/supabase';
import { PostgrestError } from '@supabase/supabase-js';

export type Surf = 'O' | 'V' | 'L' | 'M' | 'D';
export type Cond = 'healthy' | 'caries' | 'filled' | 'crown' | 'missing' | 'extracted' | 'implants' | 'endodontics' | 'sealant' | 'fracture' | 'filter_other';

interface CondDef { id: Cond; label: string; fill: string; stroke: string; }

const CONDS: CondDef[] = [
  { id: 'healthy',     label: 'Sano',         fill: '#ffffff', stroke: '#cbd5e1' },
  { id: 'caries',      label: 'Caries',       fill: '#ef4444', stroke: '#b91c1c' },
  { id: 'filled',      label: 'Obturación',   fill: '#3b82f6', stroke: '#1d4ed8' },
  { id: 'crown',       label: 'Corona',       fill: '#f59e0b', stroke: '#b45309' },
  { id: 'missing',     label: 'Ausente',      fill: '#f1f5f9', stroke: '#94a3b8' },
  { id: 'extracted',   label: 'Extracción',   fill: '#64748b', stroke: '#334155' },
  { id: 'implants',    label: 'Implante',     fill: '#8b5cf6', stroke: '#4338ca' },
  { id: 'endodontics', label: 'Endodoncia',   fill: '#ec4899', stroke: '#be185d' },
  { id: 'sealant',     label: 'Sellador',     fill: '#10b981', stroke: '#047857' },
  { id: 'fracture',    label: 'Fractura',     fill: '#f97316', stroke: '#c2410c' },
  { id: 'filter_other',label: 'Otro',         fill: '#a8a29e', stroke: '#475569' }
];

const getCond = (id: Cond): CondDef => CONDS.find(c => c.id === id) ?? CONDS[0];

type SurfMap = Partial<Record<Surf, Cond>>;
type OdoState = Record<number, SurfMap>;

const ADULT = {
  upperLeft:  [18, 17, 16, 15, 14, 13, 12, 11], 
  upperRight: [21, 22, 23, 24, 25, 26, 27, 28], 
  lowerLeft:  [48, 47, 46, 45, 44, 43, 42, 41], 
  lowerRight: [31, 32, 33, 34, 35, 36, 37, 38], 
};
const CHILD = {
  upperLeft:  [55, 54, 53, 52, 51],
  upperRight: [61, 62, 63, 64, 65],
  lowerLeft:  [85, 84, 83, 82, 81],
  lowerRight: [71, 72, 73, 74, 75],
};

const ToothSVG = ({ id, surfMap, activeSurf, isEditable, isUpper, onSurf }: any) => {
  const sz = 26; 
  const innerOffset = 6; 
  const rootH = 14; 
  const totalH = sz + rootH;
  const q = Math.floor(id/10); 
  const digit = id%10;
  
  const isRightQuad = (q===2||q===3||q===6||q===7);
  
  const topS = isUpper ? 'V' : 'L'; 
  const botS = isUpper ? 'L' : 'V';
  const leftS = isRightQuad ? 'M' : 'D'; 
  const rightS = isRightQuad ? 'D' : 'M';
  
  const hasCond = Object.values(surfMap).length > 0;
  const isMissing = surfMap?.['O'] === 'missing' || surfMap?.['O'] === 'extracted';
  
  const fillOf = (s: string) => {
    if(activeSurf === s && isEditable) return '#fde68a';
    if(surfMap[s] && surfMap[s] !== 'healthy') return getCond(surfMap[s]).fill;
    return '#ffffff';
  };
  const strokeOf = (s: string) => {
    if(activeSurf === s && isEditable) return '#d97706';
    if(surfMap[s] && surfMap[s] !== 'healthy') return getCond(surfMap[s]).stroke;
    return '#94a3b8';
  };

  const ptsTop = `0,0 ${sz},0 ${sz-innerOffset},${innerOffset} ${innerOffset},${innerOffset}`;
  const ptsBot = `${innerOffset},${sz-innerOffset} ${sz-innerOffset},${sz-innerOffset} ${sz},${sz} 0,${sz}`;
  const ptsL = `0,0 ${innerOffset},${innerOffset} ${innerOffset},${sz-innerOffset} 0,${sz}`;
  const ptsR = `${sz},0 ${sz},${sz} ${sz-innerOffset},${sz-innerOffset} ${sz-innerOffset},${innerOffset}`;
  const ptsC = `${innerOffset},${innerOffset} ${sz-innerOffset},${innerOffset} ${sz-innerOffset},${sz-innerOffset} ${innerOffset},${sz-innerOffset}`;

  const bind = (s: string) => isEditable ? { onClick: (e:any) => { e.stopPropagation(); onSurf(s); }, cursor: 'pointer' } : {};
  
  let rNum = 1; 
  if(digit>=6) rNum = isUpper?3:2;
  const rY1 = isUpper?rootH:sz; 
  const rY2 = isUpper?2:sz+rootH-2;
  const cy = isUpper?rootH:0;

  return (
    <svg width={sz} height={totalH} style={{ display: 'block', overflow: 'visible', opacity: isMissing? 0.4: 1 }}>
      <g stroke={hasCond ? '#475569' : '#cbd5e1'} strokeWidth={1}>
        {rNum===1 && <line x1={sz/2} y1={rY1} x2={sz/2} y2={rY2} />}
        {rNum===2 && <><line x1={sz*0.3} y1={rY1} x2={sz*0.2} y2={rY2} /><line x1={sz*0.7} y1={rY1} x2={sz*0.8} y2={rY2} /></>}
        {rNum===3 && <><line x1={sz*0.2} y1={rY1} x2={sz*0.1} y2={rY2} /><line x1={sz*0.5} y1={rY1} x2={sz*0.5} y2={rY2} /><line x1={sz*0.8} y1={rY1} x2={sz*0.9} y2={rY2} /></>}
      </g>
      <g transform={`translate(0,${cy})`}>
        <polygon points={ptsTop} fill={fillOf(topS)} stroke={strokeOf(topS)} {...bind(topS)} />
        <polygon points={ptsBot} fill={fillOf(botS)} stroke={strokeOf(botS)} {...bind(botS)} />
        <polygon points={ptsL} fill={fillOf(leftS)} stroke={strokeOf(leftS)} {...bind(leftS)} />
        <polygon points={ptsR} fill={fillOf(rightS)} stroke={strokeOf(rightS)} {...bind(rightS)} />
        <polygon points={ptsC} fill={fillOf('O')} stroke={strokeOf('O')} {...bind('O')} />
      </g>
      {isMissing && <><line x1={0} y1={cy} x2={sz} y2={cy+sz} stroke="#ef4444" strokeWidth="3"/><line x1={sz} y1={cy} x2={0} y2={cy+sz} stroke="#ef4444" strokeWidth="3"/></>}
    </svg>
  );
};

export default function OdontogramEnhanced({ patientId, readOnly = false }: any) {
  const [state, setState] = useState<OdoState>({});
  const [isChild, setIsChild] = useState(false);
  const [actT, setActT] = useState<number|null>(null);
  const [actS, setActS] = useState<Surf|null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('odontograms').select('state,is_child').eq('patient_id', patientId).maybeSingle()
      .then(({ data }) => { if(data){ setState(data.state || {}); setIsChild(data.is_child || false); }});
  }, [patientId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await supabase.from('odontograms').upsert({ patient_id: patientId, state, is_child: isChild, updated_at: new Date().toISOString() });
      alert('¡Odontograma guardado correctamente!');
    } catch (e: any) {
      alert('Error guardando: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const arcs = isChild ? CHILD : ADULT;

  const Cell = ({ id, isUp }: any) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {isUp && <span style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginBottom: 4 }}>{id}</span>}
      <div style={{ padding: '3px 0' }}>
        <ToothSVG id={id} isUpper={isUp} isEditable={!readOnly} surfMap={state[id]||{}} activeSurf={actT===id?actS:null} onSurf={(s:any) => { setActT(id); setActS(s); }} />
      </div>
      {!isUp && <span style={{ fontSize: 11, fontWeight: 'bold', color: '#475569', marginTop: 4 }}>{id}</span>}
    </div>
  );

  const Arc = ({ L, R, sup }: any) => (
    <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 4 }}>{L.map((x:any)=><Cell key={x} id={x} isUp={sup} />)}</div>
      <div style={{ width: 1, background: '#cbd5e1', opacity: 0.5, margin: '0 4px', borderRadius: 2 }} />
      <div style={{ display: 'flex', gap: 4 }}>{R.map((x:any)=><Cell key={x} id={x} isUp={sup} />)}</div>
    </div>
  );

  return (
    <div className="bg-white border md:border-slate-200 rounded-xl overflow-hidden flex flex-col h-full">
      <div className="bg-slate-50 px-5 py-4 border-b flex flex-wrap gap-4 justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg"><User className="text-blue-600 w-5 h-5" /></div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Odontograma Interactivo</h2>
            <p className="text-sm text-slate-500">Formato Estándar Dientes Numerados</p>
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-3">
            <button onClick={() => setIsChild(!isChild)} className="px-3 py-1.5 border rounded-lg text-sm bg-white hover:bg-slate-50 flex items-center gap-2">
              <Baby size={16}/> {isChild ? 'Ver Adulto' : 'Ver Infantil'}
            </button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm flex gap-2 items-center hover:bg-blue-700">
              <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
        )}
      </div>

      <div className="p-6 bg-slate-50/50 flex-1 flex flex-col items-center overflow-auto">
        <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col gap-6 shadow-sm overflow-x-auto w-full max-w-full">
          <div style={{minWidth: '500px'}}>
             <Arc L={arcs.upperLeft} R={arcs.upperRight} sup={true} />
             <div className="h-px w-full bg-slate-200 my-4" />
             <Arc L={arcs.lowerLeft} R={arcs.lowerRight} sup={false} />
          </div>
        </div>

        {actT && actS && !readOnly && (
          <div className="mt-8 px-6 py-4 bg-white border border-blue-200 rounded-xl shadow-lg w-full max-w-2xl animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800">Selecciona condición: Diente {actT} - Superficie {actS}</h3>
              <button className="text-slate-400 hover:text-slate-600" onClick={()=>{setActT(null);setActS(null);}}><X size={18}/></button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {CONDS.map(c => {
                const sel = (state[actT]?.[actS] === c.id) || (c.id === 'healthy' && !state[actT]?.[actS]);
                return (
                  <button key={c.id} onClick={() => {
                    const nt = { ...(state[actT]||{}) };
                    if(c.id === 'healthy') delete nt[actS]; else nt[actS] = c.id;
                    setState({...state, [actT]: nt}); setActT(null); setActS(null);
                  }} className={`flex items-center gap-2 p-2 border rounded-lg transition-colors text-left ${sel ? 'bg-blue-50 border-blue-200' : 'bg-white hover:bg-slate-50'}`}>
                    <div style={{width: 14, height: 14, borderRadius: '50%', background: c.fill, border: `1px solid ${c.stroke}`}} />
                    <span className={`text-sm ${sel ? 'font-semibold text-blue-700' : 'text-slate-600'}`}>{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
