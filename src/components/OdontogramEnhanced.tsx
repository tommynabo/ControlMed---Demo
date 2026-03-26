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

// Colores profesionales basados en la imagen de referencia
const TOOTH_COLORS = {
    HEALTHY: '#e8f5ff',     // Azul claro suave
    ISSUE: '#ffd966',        // Amarillo cálido
    TREATMENT: '#d878e6',    // Púrpura/Magenta
    IMPLANT: '#b3b3b3',      // Gris metalizado
    EXTRACTION: '#2d2d2d',   // Negro oscuro
    SELECTED: '#6366f1',     // Índigo para selección
};

const TOOTH_BORDER_COLORS = {
    HEALTHY: '#1e3a5f',
    ISSUE: '#d4a600',
    TREATMENT: '#a00099',
    IMPLANT: '#696969',
    EXTRACTION: '#000000',
    SELECTED: '#4f46e5',
};

const POSITIONS = {
    ADULT_UPPER: { Q1: [18, 17, 16, 15, 14, 13, 12, 11], Q2: [21, 22, 23, 24, 25, 26, 27, 28] },
    ADULT_LOWER: { Q3: [31, 32, 33, 34, 35, 36, 37, 38], Q4: [48, 47, 46, 45, 44, 43, 42, 41] },
};

const Tooth: React.FC<{
    id: number;
    isSelected: boolean;
    status: string;
    onClick: () => void;
    isEditable: boolean;
}> = ({ id, isSelected, status, onClick, isEditable }) => {
    let color =TOOTH_COLORS.HEALTHY;
    let borderColor = TOOTH_BORDER_COLORS.HEALTHY;

    if (isSelected) {
        color = TOOTH_COLORS.SELECTED;
        borderColor = TOOTH_BORDER_COLORS.SELECTED;
    } else if (status === 'TREATMENT') {
        color = TOOTH_COLORS.TREATMENT;
        borderColor = TOOTH_BORDER_COLORS.TREATMENT;
    } else if (status === 'ISSUE') {
        color = TOOTH_COLORS.ISSUE;
        borderColor = TOOTH_BORDER_COLORS.ISSUE;
    } else if (status === 'IMPLANT') {
        color = TOOTH_COLORS.IMPLANT;
        borderColor = TOOTH_BORDER_COLORS.IMPLANT;
    }

    return (
        <div
            onClick={onClick}
            className={`relative cursor-pointer transition-all transform hover:scale-110 ${isEditable ? 'hover:shadow-lg' : ''} group`}
        >
            <svg width="50" height="60" viewBox="0 0 50 60" className={`drop-shadow-md`}>
                {/* Diente - Forma realista */}
                <g>
                    {/* Corona */}
                    <ellipse cx="25" cy="15" rx="18" ry="14" fill={color} stroke={borderColor} strokeWidth="2" />
                    {/* Raíz */}
                    <path
                        d="M 20 28 Q 18 40 16 56 Q 25 56 34 56 Q 32 40 30 28"
                        fill={color}
                        stroke={borderColor}
                        strokeWidth="2"
                        opacity="0.85"
                    />
                </g>
            </svg>
            {/* Número del diente */}
            <div className="absolute inset-0 flex items-center justify-center text-[10px] font-black text-slate-900">
                {id}
            </div>
            {/* Tooltip on hover */}
            {isEditable && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                    Clic para {isSelected ? 'desseleccionar' : 'seleccionar'}
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
    const [treatments, setTreatments] = useState<PatientTreatment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [toothStatus, setToothStatus] = useState<Record<number, string>>({});
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

                    // Build tooth status map
                    const statusMap: Record<number, string> = {};
                    data.forEach(t => {
                        if (t.toothId) {
                            statusMap[t.toothId] = 'TREATMENT';
                        }
                    });
                    setToothStatus(statusMap);
                })
                .catch(err => console.error("Error loading treatments:", err));
        }
    }, [patientId, api]);

    const handleToothClick = (toothId: number) => {
        if (!isEditable) return;
        setSelectedTeeth(prev =>
            prev.includes(toothId)
                ? prev.filter(t => t !== toothId)
                : [...prev, toothId]
        );
    };

    const handleAddTreatment = (service: Service) => {
        if (selectedTeeth.length === 0) {
            alert('Selecciona al menos un diente');
            return;
        }

        const newTreatments = selectedTeeth.map(toothId => ({
            id: `temp-${Date.now()}-${toothId}`,
            patientId,
            serviceId: service.id,
            serviceName: service.name,
            toothId,
            price: service.final_price,
            status: 'PENDIENTE' as const
        }));

        setTreatments([...treatments, ...newTreatments]);
        onTreatmentsChange?.([...treatments, ...newTreatments]);
        setSelectedTeeth([]);
    };

    const handleDeleteTreatment = (id: string) => {
        const updated = treatments.filter(t => t.id !== id);
        setTreatments(updated);
        onTreatmentsChange?.(updated);
    };

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const allTeeth = [...POSITIONS.ADULT_UPPER.Q1, ...POSITIONS.ADULT_UPPER.Q2, ...POSITIONS.ADULT_LOWER.Q3, ...POSITIONS.ADULT_LOWER.Q4];

   const tempTreatmentsCount = treatments.filter(t => t.id.startsWith('temp-')).length;
    const totalPrice = treatments.reduce((sum, t) => sum + (t.price || 0), 0);

    return (
        <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 space-y-6 overflow-auto">

            {/* Header */}
            <div className="flex flex-wrap justify-between items-start gap-4">
                <div>
                    <h2 className="text-3xl font-black text-white mb-1">🦷 Odontograma</h2>
                    <p className="text-sm text-slate-300">Gestión visual de tratamientos dentales</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowInfo(!showInfo)}
                        className="p-3 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition-colors"
                        title="Información"
                    >
                        <Info size={20} />
                    </button>
                    {tempTreatmentsCount > 0 && (
                        <button
                            onClick={() => {
                                // Save logic here
                                alert(`Guardando ${tempTreatmentsCount} tratamientos...`);
                                setIsSaving(false);
                            }}
                            disabled={isSaving}
                            className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-green-600 text-white font-black rounded-xl hover:shadow-lg shadow-green-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            <Save size={18} /> Guardar ({tempTreatmentsCount})
                        </button>
                    )}
                </div>
            </div>

            {/* Info Panel */}
            {showInfo && (
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-xl p-4 text-sm text-blue-100 space-y-2">
                    <p className="font-bold">📋 Cómo usar:</p>
                    <ul className="space-y-1 text-xs">
                        <li>• Haz clic en los dientes para seleccionarlos (aparecerán en índigo)</li>
                        <li>• Busca un tratamiento en la barra de búsqueda</li>
                        <li>• Haz clic en el tratamiento para asignarlo a los dientes seleccionados</li>
                        <li>• Los dientes púrpura tienen tratamientos activos</li>
                    </ul>
                </div>
            )}

            {/* Odontogram Visual */}
            <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 space-y-8">

                {/* Upper Teeth */}
                <div className="space-y-4">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Arcada Superior</p>
                    <div className="flex justify-center gap-6">
                        {/* Q1 */}
                        <div className="flex gap-1 items-center">
                            {POSITIONS.ADULT_UPPER.Q1.map(toothId => (
                                <Tooth
                                    key={toothId}
                                    id={toothId}
                                    isSelected={selectedTeeth.includes(toothId)}
                                    status={toothStatus[toothId] || 'HEALTHY'}
                                    onClick={() => handleToothClick(toothId)}
                                    isEditable={isEditable}
                                />
                            ))}
                        </div>
                        {/* Q2 */}
                        <div className="flex gap-1 items-center">
                            {POSITIONS.ADULT_UPPER.Q2.map(toothId => (
                                <Tooth
                                    key={toothId}
                                    id={toothId}
                                    isSelected={selectedTeeth.includes(toothId)}
                                    status={toothStatus[toothId] || 'HEALTHY'}
                                    onClick={() => handleToothClick(toothId)}
                                    isEditable={isEditable}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Separator */}
                <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>

                {/* Lower Teeth */}
                <div className="space-y-4">
                    <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Arcada Inferior</p>
                    <div className="flex justify-center gap-6">
                        {/* Q4 */}
                        <div className="flex gap-1 items-center">
                            {POSITIONS.ADULT_LOWER.Q4.map(toothId => (
                                <Tooth
                                    key={toothId}
                                    id={toothId}
                                    isSelected={selectedTeeth.includes(toothId)}
                                    status={toothStatus[toothId] || 'HEALTHY'}
                                    onClick={() => handleToothClick(toothId)}
                                    isEditable={isEditable}
                                />
                            ))}
                        </div>
                        {/* Q3 */}
                        <div className="flex gap-1 items-center">
                            {POSITIONS.ADULT_LOWER.Q3.map(toothId => (
                                <Tooth
                                    key={toothId}
                                    id={toothId}
                                    isSelected={selectedTeeth.includes(toothId)}
                                    status={toothStatus[toothId] || 'HEALTHY'}
                                    onClick={() => handleToothClick(toothId)}
                                    isEditable={isEditable}
                                />
                            ))}
                        </div>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex flex-wrap gap-4 pt-4 justify-center text-xs">
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: TOOTH_COLORS.HEALTHY, border: `1px solid ${TOOTH_BORDER_COLORS.HEALTHY}` }}></div>
                        <span className="text-slate-300">Sano</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: TOOTH_COLORS.TREATMENT, border: `1px solid ${TOOTH_BORDER_COLORS.TREATMENT}` }}></div>
                        <span className="text-slate-300">En Tratamiento</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: TOOTH_COLORS.IMPLANT, border: `1px solid ${TOOTH_BORDER_COLORS.IMPLANT}` }}></div>
                        <span className="text-slate-300">Implante/Corona</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded" style={{ backgroundColor: TOOTH_COLORS.SELECTED, border: `1px solid ${TOOTH_BORDER_COLORS.SELECTED}` }}></div>
                        <span className="text-slate-300">Seleccionado</span>
                    </div>
                </div>
            </div>

            {/* Treatment Selection */}
            <div className="space-y-4">
                <div>
                    <p className="text-xs font-black uppercase text-slate-400 mb-3 tracking-wider">Buscar Tratamiento</p>
                    <input
                        type="text"
                        placeholder="Escribe el nombre del tratamiento..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-700 border border-slate-600 text-white placeholder:text-slate-400 px-4 py-3 rounded-lg text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                </div>

                {isEditable && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredServices.map(service => (
                            <button
                                key={service.id}
                                onClick={() => handleAddTreatment(service)}
                                disabled={selectedTeeth.length === 0}
                                className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg font-bold text-sm flex items-center justify-between transition-all group"
                            >
                                <span className="text-left">
                                    {service.name}
                                    <br />
                                    <span className="text-xs text-slate-300">{service.final_price}€</span>
                                </span>
                                <Plus size={16} className="group-hover:scale-110 transition-transform" />
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Treatments List */}
            {treatments.length > 0 && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-xs font-black uppercase text-slate-400 tracking-wider">Tratamientos Asignados</p>
                        <p className="text-lg font-black text-emerald-400">${totalPrice.toFixed(2)}</p>
                    </div>
                    <div className="max-h-[200px] overflow-y-auto space-y-2">
                        {treatments.map((t, idx) => (
                            <div key={t.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded-lg textsm text-slate-200">
                                <span>
                                    <strong>Pieza {t.toothId}:</strong> {t.serviceName} ({t.price}€)
                                    {t.id.startsWith('temp-') && <span className="ml-2 text-[10px] bg-amber-500/30 text-amber-200 px-2 py-1 rounded">Pendiente de guardar</span>}
                                </span>
                                <button
                                    onClick={() => handleDeleteTreatment(t.id)}
                                    className="text-red-400 hover:text-red-300 transition-colors p-1"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
