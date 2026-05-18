import React, { useState, useEffect, useRef } from 'react';
import { X, Pencil, Trash2, Check, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Doctor {
    id: string;
    name: string;
}

interface LiquidationEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    record: {
        id: string;
        concepto: string;
        importe: number;
        doctorId?: string;
        patientName?: string;
        fecha?: string;
    };
    doctors?: Doctor[];
    showDoctorField?: boolean;
    onSave: (data: { concepto: string; importe: number; doctorId?: string }) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
}

type Phase = 'edit' | 'confirm-save' | 'confirm-delete';

export const LiquidationEditModal: React.FC<LiquidationEditModalProps> = ({
    isOpen,
    onClose,
    record,
    doctors = [],
    showDoctorField = false,
    onSave,
    onDelete,
}) => {
    const [phase, setPhase] = useState<Phase>('edit');
    const [concepto, setConcepto] = useState('');
    const [importe, setImporte] = useState(0);
    const [doctorId, setDoctorId] = useState('');
    const [loading, setLoading] = useState(false);
    const conceptoRef = useRef<HTMLInputElement>(null);

    // Sync form when record changes or modal opens
    useEffect(() => {
        if (isOpen) {
            setConcepto(record.concepto ?? '');
            setImporte(record.importe ?? 0);
            setDoctorId(record.doctorId ?? '');
            setPhase('edit');
        }
    }, [isOpen, record.id]);

    // Auto-focus the concept input when modal opens
    useEffect(() => {
        if (isOpen && phase === 'edit') {
            setTimeout(() => conceptoRef.current?.focus(), 50);
        }
    }, [isOpen, phase]);

    if (!isOpen) return null;

    const hasChanges =
        concepto.trim() !== (record.concepto ?? '').trim() ||
        Math.abs(importe - record.importe) > 0.001 ||
        (showDoctorField && doctorId !== (record.doctorId ?? ''));

    const originalDoctorName = doctors.find(d => d.id === record.doctorId)?.name ?? record.doctorId ?? '—';
    const newDoctorName = doctors.find(d => d.id === doctorId)?.name ?? doctorId ?? '—';

    const handleSaveClick = () => {
        if (!concepto.trim()) return;
        setPhase('confirm-save');
    };

    const handleDeleteClick = () => {
        setPhase('confirm-delete');
    };

    const handleConfirmSave = async () => {
        setLoading(true);
        try {
            await onSave({
                concepto: concepto.trim(),
                importe,
                ...(showDoctorField ? { doctorId } : {}),
            });
            onClose();
        } catch {
            // error handled by parent
        } finally {
            setLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        setLoading(true);
        try {
            await onDelete(record.id);
            onClose();
        } catch {
            // error handled by parent
        } finally {
            setLoading(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(15, 23, 42, 0.55)' }}
            onClick={(e) => { if (e.target === e.currentTarget && !loading) onClose(); }}
        >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">

                {/* ── Header ── */}
                <div className={`flex items-center justify-between px-6 py-4 border-b ${phase === 'confirm-delete' ? 'border-red-100 bg-red-50' : 'border-slate-100 bg-slate-50'}`}>
                    <div className="flex items-center gap-2">
                        {phase === 'edit' && <Pencil size={16} className="text-amber-500" />}
                        {phase === 'confirm-save' && <Check size={16} className="text-emerald-600" />}
                        {phase === 'confirm-delete' && <AlertTriangle size={16} className="text-red-500" />}
                        <span className="font-black text-slate-800 text-sm uppercase tracking-wide">
                            {phase === 'edit' && 'Editar concepto'}
                            {phase === 'confirm-save' && 'Confirmar cambios'}
                            {phase === 'confirm-delete' && 'Eliminar concepto'}
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={loading}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* ── Patient / date info ── */}
                {(record.patientName || record.fecha) && (
                    <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3 text-xs text-slate-500">
                        {record.patientName && <span className="font-semibold text-slate-700">{record.patientName}</span>}
                        {record.fecha && <span>{record.fecha}</span>}
                    </div>
                )}

                {/* ── PHASE: edit ── */}
                {phase === 'edit' && (
                    <div className="px-6 py-5 space-y-4">
                        {/* Concepto */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">
                                Concepto del tratamiento
                            </label>
                            <input
                                ref={conceptoRef}
                                type="text"
                                value={concepto}
                                onChange={(e) => setConcepto(e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                placeholder="Nombre del tratamiento..."
                            />
                        </div>

                        {/* Importe */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">
                                Precio (€)
                            </label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    value={importe}
                                    onChange={(e) => setImporte(Number(e.target.value) || 0)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 pr-8 text-sm font-black text-emerald-700 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">€</span>
                            </div>
                        </div>

                        {/* Doctor (optional) */}
                        {showDoctorField && doctors.length > 0 && (
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-1.5">
                                    Doctor
                                </label>
                                <select
                                    value={doctorId}
                                    onChange={(e) => setDoctorId(e.target.value)}
                                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400 transition-all bg-white"
                                >
                                    <option value="">— Sin doctor —</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleSaveClick}
                                disabled={!concepto.trim() || !hasChanges}
                                className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
                            >
                                <Check size={15} /> Guardar cambios
                            </button>
                            <button
                                onClick={handleDeleteClick}
                                className="flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg px-4 py-2.5 text-sm transition-colors border border-red-200"
                            >
                                <Trash2 size={15} /> Eliminar
                            </button>
                            <button
                                onClick={onClose}
                                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-lg px-3 py-2.5 text-sm transition-colors"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PHASE: confirm-save ── */}
                {phase === 'confirm-save' && (
                    <div className="px-6 py-5 space-y-4">
                        <p className="text-sm text-slate-600">
                            Revisa los cambios antes de confirmar:
                        </p>
                        <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
                            <div className="grid grid-cols-3 bg-slate-100 px-4 py-2 font-black text-xs uppercase tracking-wide text-slate-500">
                                <span>Campo</span>
                                <span>Antes</span>
                                <span>Después</span>
                            </div>
                            {concepto.trim() !== (record.concepto ?? '').trim() && (
                                <div className="grid grid-cols-3 px-4 py-2.5 border-t border-slate-100">
                                    <span className="font-semibold text-slate-500 text-xs">Concepto</span>
                                    <span className="text-slate-500 line-through text-xs truncate">{record.concepto || '—'}</span>
                                    <span className="font-bold text-slate-800 text-xs truncate">{concepto}</span>
                                </div>
                            )}
                            {Math.abs(importe - record.importe) > 0.001 && (
                                <div className="grid grid-cols-3 px-4 py-2.5 border-t border-slate-100">
                                    <span className="font-semibold text-slate-500 text-xs">Precio</span>
                                    <span className="text-slate-500 line-through text-xs">{record.importe?.toFixed(2)} €</span>
                                    <span className="font-black text-emerald-700 text-xs">{importe.toFixed(2)} €</span>
                                </div>
                            )}
                            {showDoctorField && doctorId !== (record.doctorId ?? '') && (
                                <div className="grid grid-cols-3 px-4 py-2.5 border-t border-slate-100">
                                    <span className="font-semibold text-slate-500 text-xs">Doctor</span>
                                    <span className="text-slate-500 line-through text-xs truncate">{originalDoctorName}</span>
                                    <span className="font-bold text-slate-800 text-xs truncate">{newDoctorName}</span>
                                </div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleConfirmSave}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
                            >
                                {loading
                                    ? <><RefreshCw size={14} className="animate-spin" /> Guardando...</>
                                    : <><Check size={14} /> Confirmar cambios</>}
                            </button>
                            <button
                                onClick={() => setPhase('edit')}
                                disabled={loading}
                                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
                            >
                                <ArrowLeft size={14} /> Volver
                            </button>
                        </div>
                    </div>
                )}

                {/* ── PHASE: confirm-delete ── */}
                {phase === 'confirm-delete' && (
                    <div className="px-6 py-5 space-y-4">
                        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
                            <AlertTriangle size={18} className="text-red-500 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-black text-red-700 text-sm">¿Eliminar este concepto?</p>
                                <p className="text-red-600 text-xs mt-1">
                                    Esta acción no se puede deshacer.
                                </p>
                            </div>
                        </div>
                        <div className="rounded-xl border border-red-100 bg-red-50/50 px-4 py-3 space-y-1">
                            <p className="text-xs font-black text-slate-500 uppercase tracking-wide">Concepto a eliminar</p>
                            <p className="font-bold text-slate-800 text-sm">{record.concepto || '—'}</p>
                            <p className="font-black text-red-600 text-sm">{record.importe?.toFixed(2)} €</p>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                            <button
                                onClick={handleConfirmDelete}
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
                            >
                                {loading
                                    ? <><RefreshCw size={14} className="animate-spin" /> Eliminando...</>
                                    : <><Trash2 size={14} /> Sí, eliminar</>}
                            </button>
                            <button
                                onClick={() => setPhase('edit')}
                                disabled={loading}
                                className="flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-600 font-bold rounded-lg px-4 py-2.5 text-sm transition-colors"
                            >
                                <ArrowLeft size={14} /> Volver
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
};

export default LiquidationEditModal;
