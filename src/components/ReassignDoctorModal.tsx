import React, { useState, useEffect } from 'react';
import { User, X, Check, AlertCircle } from 'lucide-react';
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

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in">
                {/* Header */}
                <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User size={20} />
                        <h2 className="font-bold text-lg">Reasignar Doctor</h2>
                    </div>
                    <button onClick={onClose} className="text-blue-200 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {success && (
                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-bold border border-green-200 flex items-center gap-2">
                            <Check size={16} /> Doctor actualizado correctamente
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-700 px-4 py-3 rounded-xl text-sm font-medium border border-red-200 flex items-center gap-2">
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-slate-50 px-4 py-3 rounded-lg text-sm space-y-2 border border-slate-200">
                        <p>
                            <span className="text-slate-500 font-semibold">Paciente:</span>
                            <span className="text-slate-900 ml-2">{patientName}</span>
                        </p>
                        <p>
                            <span className="text-slate-500 font-semibold">Fecha:</span>
                            <span className="text-slate-900 ml-2">{dateText}</span>
                        </p>
                        <p>
                            <span className="text-slate-500 font-semibold">Doctor Actual:</span>
                            <span className="text-slate-900 ml-2">{currentDoctorName}</span>
                        </p>
                    </div>

                    {/* Doctor Selection */}
                    <div>
                        <label className="text-xs font-bold uppercase text-slate-400 mb-2 block">
                            Nuevo Doctor
                        </label>
                        <select
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        >
                            <option value="">-- Selecciona un doctor --</option>
                            {doctors.map(d => (
                                <option key={d.id} value={d.id}>
                                    {d.name} ({d.specialization})
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-4">
                        <button
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-2 px-4 bg-slate-200 text-slate-700 font-bold rounded-lg hover:bg-slate-300 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={loading || !selectedDoctorId}
                            className="flex-1 py-2 px-4 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
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
