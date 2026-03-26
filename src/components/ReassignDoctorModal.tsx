import React, { useState, useEffect } from 'react';
import { User, X, Check, AlertCircle, Users } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { api } from '../services/api';

interface ReassignDoctorModalProps {
    isOpen: boolean;
    onClose: () => void;
    recordId: string;
    patientName: string;
    currentDoctorId: string | null;
    dateText: string;
    onSuccess?: () => void;
}

const ReassignDoctorModal: React.FC<ReassignDoctorModalProps> = ({
    isOpen,
    onClose,
    recordId,
    patientName,
    currentDoctorId,
    dateText,
    onSuccess
}) => {
    const { doctors } = useAppContext();
    const [selectedDoctorId, setSelectedDoctorId] = useState(currentDoctorId || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    const currentDoctorName = doctors.find(d => d.id === currentDoctorId)?.name || 'Sin asignar';

    if (!isOpen) return null;

    const handleSubmit = async () => {
        if (!selectedDoctorId) {
            setError('Selecciona un doctor');
            return;
        }

        setLoading(true);
        setError('');

        try {
            await api.clinicalRecords.reassignDoctor(recordId, selectedDoctorId);
            setSuccess(true);
            
            setTimeout(() => {
                setSuccess(false);
                onSuccess?.();
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Error al reasignar doctor');
        } finally {
            setLoading(false);
        }
    };

    const selectedDoctor = doctors.find(d => d.id === selectedDoctorId);

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-6 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
                            <Users size={20} />
                        </div>
                        <div>
                            <h2 className="font-bold text-lg">Reasignar Doctor</h2>
                            <p className="text-sm text-purple-100">Cambiar responsable de la entrada</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white transition-colors p-1">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6">
                    {success && (
                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold border border-green-200 flex items-center gap-2 animate-in slide-in-from-top-2">
                            <Check size={16} /> ¡Doctor actualizado correctamente!
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Current Doctor Info */}
                    <div className="bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-4 rounded-xl border border-slate-200 space-y-3">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wide">Información Actual</p>
                        <div className="space-y- 2">
                            <div className="flex justify-between items-start">
                                <span className="text-slate-600 font-semibold text-sm">Paciente:</span>
                                <span className="text-slate-900 font-black text-sm">{patientName}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-slate-600 font-semibold text-sm">Fecha:</span>
                                <span className="text-slate-900 font-black text-sm">{dateText}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-slate-600 font-semibold text-sm">Doctor Actual:</span>
                                <span className="text-slate-900 font-black text-sm">Dr. {currentDoctorName}</span>
                            </div>
                        </div>
                    </div>

                    {/* Doctor Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase text-purple-600 mb-3 block tracking-wide flex items-center gap-2">
                            <Users size={14} /> Nuevo Doctor Responsable
                        </label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full bg-white border-2 border-slate-200 rounded-lg p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-400 focus:border-purple-400 transition-all"
                        >
                            <option value="">-- Selecciona un doctor --</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name} — {d.specialization}
                                </option>
                            ))}
                        </select>

                        {selectedDoctor && selectedDoctorId !== currentDoctorId && (
                            <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                                <p className="text-xs font-semibold text-indigo-700">
                                    <strong>{selectedDoctor.name}</strong> ({selectedDoctor.specialization}) será asignado como responsable.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-3 pt-4 border-t border-slate-100">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 font-bold rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 text-sm"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !selectedDoctorId || selectedDoctorId === currentDoctorId}
                            className="flex-1 py-2 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-sm disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <Check size={16} />
                                    Reasignar
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ReassignDoctorModal;
