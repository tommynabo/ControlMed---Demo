import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import toast from 'react-hot-toast';
import { Patient } from '../../types';

interface NewPatientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPatientCreated?: (patient: Patient) => void;
}

const emptyPatient = {
    name: '',
    firstName: '',
    lastName1: '',
    lastName2: '',
    dni: '',
    email: '',
    phone: '',
    birthDate: '',
    smoker: false,
    diseases: '',
    allergies: '',
    medications: '',
    criticalAlerts: '',
    historyNumber: '',
};

const NewPatientModal: React.FC<NewPatientModalProps> = ({ isOpen, onClose, onPatientCreated }) => {
    const { api, addPatient } = useAppContext();
    const [newPatient, setNewPatient] = useState({ ...emptyPatient });
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleCreate = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const created = await api.createPatient(newPatient);
            addPatient(created);
            setNewPatient({ ...emptyPatient });
            toast.success('Paciente creado correctamente');
            onPatientCreated?.(created);
            onClose();
        } catch (e: any) {
            console.error('Error creating patient:', e);
            toast.error(e.message || 'Error al crear paciente');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
            <div className="bg-white max-w-lg w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-8 pb-0 overflow-y-auto flex-1">
                    <h3 className="text-2xl font-black text-slate-900 mb-6">Nuevo Paciente</h3>
                    <div className="space-y-4">
                        <div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Nombre</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Juan"
                                        value={newPatient.firstName}
                                        onChange={e => setNewPatient({ ...newPatient, firstName: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">1er Apellido</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Pérez"
                                        value={newPatient.lastName1}
                                        onChange={e => setNewPatient({ ...newPatient, lastName1: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">2do Apellido</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. García"
                                        value={newPatient.lastName2}
                                        onChange={e => setNewPatient({ ...newPatient, lastName2: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Fecha Nacimiento</label>
                                    <input
                                        type="date"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        value={newPatient.birthDate}
                                        onChange={e => setNewPatient({ ...newPatient, birthDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3 mb-4">
                                <input
                                    type="checkbox"
                                    checked={newPatient.smoker}
                                    onChange={e => setNewPatient({ ...newPatient, smoker: e.target.checked })}
                                    className="w-5 h-5 rounded hover:cursor-pointer"
                                />
                                <label className="text-xs font-bold uppercase text-slate-600">Es Fumador</label>
                            </div>
                        </div>

                        {/* Medical History Section */}
                        <div className="border-t border-slate-100 pt-4">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-3">Historial Médico</p>
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Alergias</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Penicilina, Latex, Anestesia..."
                                        value={newPatient.allergies}
                                        onChange={e => setNewPatient({ ...newPatient, allergies: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Enfermedades</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Diabetes, Hipertensión, Cardiopatía..."
                                        value={newPatient.diseases}
                                        onChange={e => setNewPatient({ ...newPatient, diseases: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Medicación Habitual</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Sintrom, Metformina, Enalapril..."
                                        value={newPatient.medications}
                                        onChange={e => setNewPatient({ ...newPatient, medications: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Alertas Médicas Críticas</label>
                                    <input
                                        className="w-full bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm font-bold text-rose-700"
                                        placeholder="Ej. Anticoagulante, Prótesis valvular, Bisfosfonatos..."
                                        value={newPatient.criticalAlerts}
                                        onChange={e => setNewPatient({ ...newPatient, criticalAlerts: e.target.value })}
                                    />
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">DNI / NIE</label>
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                placeholder="12345678X"
                                value={newPatient.dni}
                                onChange={e => setNewPatient({ ...newPatient, dni: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                placeholder="juan@email.com"
                                value={newPatient.email}
                                onChange={e => setNewPatient({ ...newPatient, email: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Teléfono</label>
                            <input
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                placeholder="+34 600 000 000"
                                value={newPatient.phone || ''}
                                onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400">Nº Historia (Autogenerado)</label>
                            <input
                                disabled
                                className="w-full bg-slate-100 border border-slate-200 rounded-xl p-3 text-sm font-bold opacity-75 cursor-not-allowed"
                                placeholder="Se generará automáticamente al guardar"
                                value={newPatient.historyNumber || ''}
                                onChange={e => setNewPatient({ ...newPatient, historyNumber: e.target.value })}
                            />
                        </div>
                    </div>
                </div>
                <div className="px-8 pb-8 flex gap-4 pt-4 border-t border-slate-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 font-bold text-slate-500"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleCreate}
                        disabled={isSubmitting}
                        className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg disabled:opacity-50"
                    >
                        {isSubmitting ? 'Guardando...' : 'Guardar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewPatientModal;
