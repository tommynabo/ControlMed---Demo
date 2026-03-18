import React, { useState } from 'react';
import { Clock, X, Check, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';

interface ManualClockInModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const ManualClockInModal: React.FC<ManualClockInModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const { currentUser, currentUserRole } = useAppContext();
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [startTime, setStartTime] = useState('09:00');
    const [endTime, setEndTime] = useState('14:00');
    const [breakMinutes, setBreakMinutes] = useState(0);
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (endTime <= startTime) {
            setError('La hora de fin debe ser posterior a la de inicio');
            return;
        }

        setLoading(true);
        try {
            if (!currentUser?.id) throw new Error('Usuario no identificado');
            
            await api.attendance.manual(currentUser.id, currentUserRole, {
                date,
                startTime,
                endTime,
                breakMinutes,
                notes
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Error al registrar jornada manual');
        } finally {
            setLoading(false);
        }
    };

    const maxDate = new Date().toISOString().split('T')[0];

    return (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-slate-50 px-8 py-6 flex items-center justify-between border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <Clock size={20} />
                        </div>
                        <div>
                            <h2 className="font-black text-slate-900 text-lg uppercase tracking-tight">Fichaje Manual</h2>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Registrar jornada completa</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-all">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                    {error && (
                        <div className="bg-rose-50 text-rose-600 px-4 py-3 rounded-2xl text-xs font-bold border border-rose-100 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 gap-6">
                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Día del Fichaje</label>
                            <input
                                type="date"
                                value={date}
                                max={maxDate}
                                onChange={e => setDate(e.target.value)}
                                required
                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Hora Inicio</label>
                                <input
                                    type="time"
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    required
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Hora Fin</label>
                                <input
                                    type="time"
                                    value={endTime}
                                    onChange={e => setEndTime(e.target.value)}
                                    required
                                    className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Descanso (Minutos a restar)</label>
                            <input
                                type="number"
                                value={breakMinutes}
                                onChange={e => setBreakMinutes(parseInt(e.target.value) || 0)}
                                min="0"
                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 transition-all outline-none"
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">Descripción / Motivo</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={3}
                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-3.5 text-sm font-bold text-slate-900 focus:ring-2 focus:ring-blue-100 transition-all outline-none resize-none"
                                placeholder="Indica el motivo del fichaje manual..."
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-xl shadow-slate-900/10"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                <>
                                    <Check size={16} strokeWidth={3} />
                                    Guardar Registro
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ManualClockInModal;
