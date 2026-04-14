import React, { useState, useEffect } from 'react';
import { Search, Trash2, FileText, Plus, Save, X } from 'lucide-react';
import { PatientTreatment } from '../types';
import { useAppContext } from '../context/AppContext';

// ======================================================================
// TYPES
// ======================================================================
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
}

// ======================================================================
// SVG TOOTH PATHS  (restored from ffd0e4c — the classic aesthetic)
// ======================================================================
const PATHS = {
  incisor:  'M10,5 L20,5 L22,30 L15,45 L8,30 Z',
  canine:   'M15,2 L25,10 L22,35 L15,50 L8,35 L5,10 Z',
  premolar: 'M5,5 L25,5 L28,25 L15,40 L2,25 Z',
  molar:    'M2,5 L10,2 L20,2 L28,5 L30,20 L25,35 L15,40 L5,35 L0,20 Z',
};

const getToothShape = (id: number): string => {
  const d = id % 10;
  if (id >= 51) return d >= 1 && d <= 3 ? PATHS.incisor : PATHS.molar;
  if (d <= 2)   return PATHS.incisor;
  if (d === 3)  return PATHS.canine;
  if (d <= 5)   return PATHS.premolar;
  return PATHS.molar;
};

// Condition colour map (kept from current logic for visual feedback)
const COND_COLORS: Record<string, { fill: string; stroke: string }> = {
  healthy:  { fill: '#ffffff',  stroke: '#cbd5e1' },
  caries:   { fill: '#fecaca',  stroke: '#dc2626' },
  filled:   { fill: '#ddd6fe',  stroke: '#7c3aed' },
  crown:    { fill: '#fef08a',  stroke: '#b45309' },
  missing:  { fill: '#f1f5f9',  stroke: '#94a3b8' },
  endo:     { fill: '#fed7aa',  stroke: '#c2410c' },
  implant:  { fill: '#bbf7d0',  stroke: '#15803d' },
  fracture: { fill: '#fbcfe8',  stroke: '#be185d' },
  sealant:  { fill: '#a5f3fc',  stroke: '#0e7490' },
};

type SurfMap = Partial<Record<string, string>>;
type OdoState = Record<number, SurfMap>;

const getDominantCondition = (surf: SurfMap): string => {
  const vals = Object.values(surf).filter(Boolean) as string[];
  if (!vals.length) return 'healthy';
  if (vals.includes('missing')) return 'missing';
  const non = vals.filter(v => v !== 'healthy');
  return non.length ? non[0] : 'healthy';
};

// ======================================================================
// FDI QUADRANTS
// ======================================================================
const ADULT_Q = {
  Q1: [18, 17, 16, 15, 14, 13, 12, 11],
  Q2: [21, 22, 23, 24, 25, 26, 27, 28],
  Q3: [31, 32, 33, 34, 35, 36, 37, 38],
  Q4: [48, 47, 46, 45, 44, 43, 42, 41],
};
const CHILD_Q = {
  Q5: [55, 54, 53, 52, 51],
  Q6: [61, 62, 63, 64, 65],
  Q7: [71, 72, 73, 74, 75],
  Q8: [85, 84, 83, 82, 81],
};

// ======================================================================
// <Tooth /> — simple SVG shield shape (ffd0e4c aesthetic)
// ======================================================================
const Tooth: React.FC<{
  id: number;
  treatments: PatientTreatment[];
  condition: string;
  isSelected: boolean;
  isChild?: boolean;
  isEditable: boolean;
  onClick: (e: React.MouseEvent) => void;
}> = ({ id, treatments, condition, isSelected, isChild, isEditable, onClick }) => {
  const hasTreatment = treatments.length > 0;
  const hasCondition = condition !== 'healthy';
  const cond = COND_COLORS[condition] ?? COND_COLORS.healthy;
  const svgW = isChild ? 36 : 44;
  const svgH = isChild ? 50 : 60;

  return (
    <div
      className={`relative flex flex-col items-center group ${isEditable ? 'cursor-pointer' : 'cursor-default'} ${isChild ? 'w-[36px] md:w-[44px]' : 'w-[40px] md:w-[52px]'}`}
      onClick={isEditable ? onClick : undefined}
    >
      <div className={`relative transition-all duration-200 ${isSelected ? 'scale-110 -translate-y-1' : isEditable ? 'hover:scale-105' : ''}`}>
        <svg
          width={svgW}
          height={svgH}
          viewBox="0 0 30 50"
          className="overflow-visible drop-shadow-sm"
        >
          <defs>
            <linearGradient id={`tg-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={isSelected ? '#ede9fe' : hasCondition ? cond.fill : '#ffffff'} />
              <stop offset="100%" stopColor={isSelected ? '#ddd6fe' : hasCondition ? cond.fill : '#f1f5f9'} />
            </linearGradient>
          </defs>
          <path
            d={getToothShape(id)}
            fill={`url(#tg-${id})`}
            stroke={isSelected ? '#8b5cf6' : hasCondition ? cond.stroke : hasTreatment ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={isSelected ? 2.5 : 1.5}
            className="transition-all duration-200"
          />
        </svg>
        {hasTreatment && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-white shadow-sm animate-pulse" />
        )}
      </div>
      <span className={`mt-0.5 text-[9px] font-black transition-colors ${isSelected ? 'text-violet-700' : 'text-slate-400'}`}>
        {id}
      </span>
    </div>
  );
};

// ======================================================================
// MAIN COMPONENT
// ======================================================================
export const Odontogram: React.FC<OdontogramProps> = ({
  patientId, isEditable, onTreatmentsChange,
}) => {
  const { api } = useAppContext();

  const [selectedTeeth, setSelectedTeeth]         = useState<number[]>([]);
  const [odoState, setOdoState]                   = useState<OdoState>({});
  const [treatments, setTreatments]               = useState<PatientTreatment[]>([]);
  const [services, setServices]                   = useState<Service[]>([]);
  const [searchTerm, setSearchTerm]               = useState('');
  const [selectedForBudget, setSelectedForBudget] = useState<string[]>([]);
  const [isSaving, setIsSaving]                   = useState(false);
  const [isSavingBudget, setIsSavingBudget]       = useState(false);

  // Load services
  useEffect(() => {
    if (!api?.services?.getAll) return;
    api.services.getAll()
      .then((d: Service[]) => setServices(d || []))
      .catch((e: unknown) => console.error('services:', e));
  }, [api]);

  // Load persisted tooth conditions (current logic kept)
  useEffect(() => {
    if (!patientId || !api?.odontogram?.get) return;
    api.odontogram.get(patientId)
      .then((data: any) => {
        if (data?.teethState) {
          try {
            const parsed: OdoState =
              typeof data.teethState === 'string'
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

  // Load treatments
  useEffect(() => {
    if (!patientId || !api?.treatments?.getByPatient) return;
    api.treatments.getByPatient(patientId)
      .then((data: PatientTreatment[]) => {
        const list = data || [];
        setTreatments(list);
        onTreatmentsChange?.(list);
      })
      .catch((e: unknown) => console.error('treatments:', e));
  }, [patientId, api]);

  const handleToothClick = (toothId: number) => {
    if (!isEditable) return;
    setSelectedTeeth(prev =>
      prev.includes(toothId) ? prev.filter(id => id !== toothId) : [...prev, toothId],
    );
  };

  const handleAddTreatment = (service: Service) => {
    if (!selectedTeeth.length) { alert('Selecciona al menos un diente'); return; }
    const newTs: PatientTreatment[] = selectedTeeth.map(toothId => ({
      id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      patientId,
      serviceId: service.id,
      serviceName: service.name,
      toothId,
      price: service.final_price,
      status: 'PENDIENTE',
      createdAt: new Date().toISOString(),
    }));
    const updated = [...treatments, ...newTs];
    setTreatments(updated);
    onTreatmentsChange?.(updated);
    setSelectedTeeth([]);
    setSearchTerm('');
  };

  const handleDeleteTreatment = async (treatmentId: string) => {
    if (treatmentId.startsWith('temp-')) {
      const updated = treatments.filter(t => t.id !== treatmentId);
      setTreatments(updated); onTreatmentsChange?.(updated); return;
    }
    try {
      await api.treatments.delete(treatmentId);
      const updated = treatments.filter(t => t.id !== treatmentId);
      setTreatments(updated); onTreatmentsChange?.(updated);
    } catch (e) { console.error(e); }
  };

  // Save treatments — current logic preserved
  const handleSaveTreatments = async () => {
    const pending = treatments.filter(t => t.id.startsWith('temp-'));
    if (!pending.length) return;
    try {
      setIsSaving(true);
      await api.treatments.createBatch(patientId, pending);
      const data = await api.treatments.getByPatient(patientId);
      setTreatments(data || []);
      onTreatmentsChange?.(data || []);
    } catch (e: unknown) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  // Save budget — current logic preserved
  const handleSaveBudget = async () => {
    if (!treatments.length) return;
    try {
      setIsSavingBudget(true);
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
      setIsSavingBudget(false);
    }
  };

  const getToothTreatments = (id: number) => treatments.filter(t => t.toothId === id);
  const filteredServices    = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()),
  );
  const tempCount  = treatments.filter(t => t.id.startsWith('temp-')).length;
  const totalPrice = treatments.reduce((sum, t) => sum + (t.price ?? 0), 0);

  const toothEl = (id: number, isChild = false) => (
    <Tooth
      key={id}
      id={id}
      treatments={getToothTreatments(id)}
      condition={getDominantCondition(odoState[id] ?? {})}
      isSelected={selectedTeeth.includes(id)}
      isChild={isChild}
      isEditable={isEditable}
      onClick={() => handleToothClick(id)}
    />
  );

  return (
    <div className="w-full space-y-6">

      {/* ODONTOGRAM BOARD */}
      <div className="bg-gradient-to-br from-slate-50 via-white to-blue-50/30 rounded-[2rem] p-8 border border-slate-200/80 shadow-xl relative overflow-hidden">

        <div className="absolute inset-0 opacity-[0.015] pointer-events-none">
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '40px 40px' }} />
        </div>

        {/* Header */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h3 className="text-xl font-black text-slate-900">Odontograma</h3>
            <p className="text-xs text-slate-400 font-semibold mt-1">Dentición permanente + temporal · FDI</p>
          </div>
          {isEditable && tempCount > 0 && (
            <button
              onClick={handleSaveTreatments}
              disabled={isSaving}
              className="bg-gradient-to-r from-slate-800 to-slate-900 text-white px-6 py-3 rounded-xl text-sm font-black uppercase flex items-center gap-2 shadow-xl hover:shadow-2xl hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              <Save size={18} />
              {isSaving ? 'Guardando…' : `Guardar (${tempCount})`}
            </button>
          )}
        </div>

        {/* Teeth grid */}
        <div className="relative z-10 bg-white/70 backdrop-blur-sm rounded-3xl p-6 border border-slate-100 shadow-inner overflow-x-auto">
          <div className="flex flex-col items-center gap-2 min-w-max mx-auto">

            {/* Row 1 - Adult upper: Q1 + Q2 */}
            <div className="flex items-end justify-center gap-6">
              <div className="flex items-end gap-0.5">{ADULT_Q.Q1.map(id => toothEl(id))}</div>
              <div className="flex items-end gap-0.5">{ADULT_Q.Q2.map(id => toothEl(id))}</div>
            </div>

            {/* Row 2 - Child upper: Q5 + Q6 */}
            <div className="flex items-end justify-center gap-6 px-16">
              <div className="flex items-end gap-0.5">{CHILD_Q.Q5.map(id => toothEl(id, true))}</div>
              <div className="flex items-end gap-0.5">{CHILD_Q.Q6.map(id => toothEl(id, true))}</div>
            </div>

            {/* Midline */}
            <div className="w-full max-w-xl h-px bg-slate-200 my-1" />

            {/* Row 3 - Child lower: Q8 + Q7 */}
            <div className="flex items-start justify-center gap-6 px-16">
              <div className="flex items-start gap-0.5">{CHILD_Q.Q8.map(id => toothEl(id, true))}</div>
              <div className="flex items-start gap-0.5">{CHILD_Q.Q7.map(id => toothEl(id, true))}</div>
            </div>

            {/* Row 4 - Adult lower: Q4 + Q3 */}
            <div className="flex items-start justify-center gap-6">
              <div className="flex items-start gap-0.5">{ADULT_Q.Q4.map(id => toothEl(id))}</div>
              <div className="flex items-start gap-0.5">{ADULT_Q.Q3.map(id => toothEl(id))}</div>
            </div>

          </div>
        </div>

        {/* Selected teeth banner */}
        {selectedTeeth.length > 0 && (
          <div className="relative z-10 mt-6 mx-auto max-w-2xl p-4 bg-gradient-to-r from-violet-50 to-purple-50 rounded-2xl border-2 border-violet-200 shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-black text-violet-900">
                Seleccionados:&nbsp;<span className="text-violet-600">{selectedTeeth.join(', ')}</span>
              </p>
              <button
                onClick={() => setSelectedTeeth([])}
                className="text-xs font-bold text-violet-600 hover:text-violet-800 flex items-center gap-1"
              >
                <X size={14} /> Limpiar
              </button>
            </div>
            <p className="text-xs text-violet-700">👇 Busca un tratamiento abajo para asignarlo</p>
          </div>
        )}

        {/* Search treatment */}
        {isEditable && (
          <div className="relative z-10 mt-8 pt-6 border-t border-slate-200/50">
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">🔍 Buscar Tratamiento</label>
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Ej: Limpieza, Extracción, Corona…"
                className="w-full bg-white border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300 transition-all"
              />
            </div>
            {searchTerm.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredServices.length === 0 ? (
                  <div className="col-span-full text-center p-6 text-slate-400 text-sm">Sin resultados</div>
                ) : (
                  filteredServices.map(s => (
                    <button
                      key={s.id}
                      onClick={() => handleAddTreatment(s)}
                      disabled={selectedTeeth.length === 0}
                      className="group p-4 bg-white border-2 border-slate-200 rounded-xl hover:border-violet-400 hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-left"
                    >
                      <p className="text-sm font-black text-slate-900 mb-1">{s.name}</p>
                      <p className="text-xs font-bold text-violet-600">{s.final_price}€</p>
                      <div className="mt-2 flex items-center gap-1 text-xs text-slate-500 group-hover:text-violet-600">
                        <Plus size={12} /><span>Añadir</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* TREATMENTS TABLE */}
      {treatments.length > 0 && (
        <div className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg">
          <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
            <h4 className="text-lg font-black text-slate-900">📋 Tratamientos ({treatments.length})</h4>
            {isEditable && (
              <div className="flex gap-3 flex-wrap">
                {tempCount > 0 && (
                  <button
                    onClick={handleSaveTreatments}
                    disabled={isSaving}
                    className="bg-gradient-to-r from-green-600 to-green-700 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    <Save size={14} />
                    {isSaving ? 'Guardando…' : `Guardar (${tempCount})`}
                  </button>
                )}
                <button
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget}
                  className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-5 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 hover:shadow-xl transition-all disabled:opacity-50"
                >
                  <FileText size={14} />
                  {isSavingBudget ? 'Guardando…' : 'Guardar Presupuesto'}
                </button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 text-[10px] font-black uppercase text-slate-400">
            <div className="col-span-1">
              <input type="checkbox"
                checked={selectedForBudget.length === treatments.length && treatments.length > 0}
                onChange={e => e.target.checked ? setSelectedForBudget(treatments.map(t => t.id)) : setSelectedForBudget([])}
                className="w-4 h-4 rounded cursor-pointer"
              />
            </div>
            <div className="col-span-1">Diente</div>
            <div className="col-span-5">Tratamiento</div>
            <div className="col-span-2">Precio</div>
            <div className="col-span-2">Estado</div>
            <div className="col-span-1 text-right">–</div>
          </div>

          <div className="space-y-2 mt-4">
            {treatments.map(t => (
              <div key={t.id} className="grid grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl text-sm border border-slate-100 hover:border-violet-200 transition-colors">
                <div className="col-span-1">
                  <input type="checkbox"
                    checked={selectedForBudget.includes(t.id)}
                    onChange={e => e.target.checked
                      ? setSelectedForBudget(prev => [...prev, t.id])
                      : setSelectedForBudget(prev => prev.filter(id => id !== t.id))}
                    className="w-4 h-4 rounded cursor-pointer"
                  />
                </div>
                <div className="col-span-1 font-black text-violet-600 text-center text-lg">{t.toothId ?? '–'}</div>
                <div className="col-span-5 font-bold text-slate-900">
                  {t.serviceName}
                  {t.id.startsWith('temp-') && (
                    <span className="ml-2 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Sin guardar</span>
                  )}
                </div>
                <div className="col-span-2 font-black text-slate-900">{(t.price ?? 0).toFixed(2)}€</div>
                <div className="col-span-2">
                  <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${t.status === 'COMPLETADO' ? 'bg-green-100 text-green-700' : t.status === 'EN_PROCESO' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                    {t.status}
                  </span>
                </div>
                <div className="col-span-1 flex justify-end">
                  {isEditable && (
                    <button onClick={() => handleDeleteTreatment(t.id)} className="text-red-400 hover:text-red-600 p-2 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 flex justify-between items-center">
            <p className="text-sm font-bold text-slate-600">Total:</p>
            <p className="text-2xl font-black text-slate-900">{totalPrice.toFixed(2)}€</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Odontogram;
