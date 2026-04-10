import React from 'react';
import { X, User, Calendar, Clock, FileText, Eye, Loader2 } from 'lucide-react';
import { Appointment, Patient } from '../../types';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { toast } from 'react-hot-toast';

interface AppointmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    appointment: Appointment | null;
    patient: Patient | null;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
    isOpen,
    onClose,
    appointment,
    patient
}) => {
    const navigate = useNavigate();
    const { api, refreshAppointments } = useAppContext();
    const [time, setTime] = React.useState(appointment?.time || '10:00');

    React.useEffect(() => {
        if (appointment) {
            setTime(appointment.time);
        }
    }, [appointment]);

    const [isSavingTime, setIsSavingTime] = React.useState(false);

    const handleTimeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const newTime = e.target.value;
        setTime(newTime);
        if (appointment) {
            setIsSavingTime(true);
            try {
                await api.appointments.update(appointment.id, { time: newTime });
                await refreshAppointments();
                toast.success('Hora actualizada');
            } catch (error) {
                toast.error('Error al actualizar hora');
                setTime(appointment.time); // revert to original
            } finally {
                setIsSavingTime(false);
            }
        }
    };

    if (!isOpen || !appointment || !patient) return null;

    const handleViewAppointment = () => {
        // Navegar a la pantalla de gestión de cita
        navigate(`/appointment/${appointment.id}`, {
            state: { appointment, patient }
        });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
            <div className="bg-white max-w-lg w-full rounded-[2.5rem] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-8 duration-500">

                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-black text-white tracking-tight">Resumen de Cita</h2>
                        <p className="text-sm text-blue-100 mt-1">Información básica del paciente</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-white/80 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">

                    {/* Paciente */}
                    <div className="flex items-start gap-4">
                        <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-lg">
                            {patient.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h3 className="text-xl font-black text-slate-900">{patient.name}</h3>
                            <div className="space-y-1 mt-2">
                                <p className="text-sm text-slate-600 font-medium">
                                    <strong>NHC:</strong> {patient.historyNumber || <span className="text-slate-400 italic">Sin asignar</span>}
                                </p>
                                <p className="text-sm text-slate-600 font-medium">
                                    <strong>DNI:</strong> {patient.dni}
                                </p>
                                <p className="text-sm text-slate-600 font-medium">
                                    <strong>Email:</strong> {patient.email}
                                </p>
                                {patient.phone && (
                                    <p className="text-sm text-slate-600 font-medium">
                                        <strong>Teléfono:</strong> {patient.phone}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Detalles de la Cita */}
                    <div className="bg-slate-50 rounded-2xl p-6 space-y-4">
                        <h4 className="text-xs font-black uppercase text-slate-400 mb-3">Detalles de la Cita</h4>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                                <Calendar size={20} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-slate-400 uppercase">Fecha</p>
                                <p className="text-sm font-black text-slate-900">
                                    {new Date(appointment.date).toLocaleDateString('es-ES', {
                                        weekday: 'long',
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        timeZone: 'UTC'
                                    })}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center">
                                <Clock size={20} />
                            </div>
                            <div className="flex-1 flex items-center gap-2">
                                <div className="flex-1">
                                    <p className="text-xs font-bold text-slate-400 uppercase">Hora</p>
                                    <input 
                                        type="time" 
                                        value={time} 
                                        onChange={handleTimeChange}
                                        disabled={isSavingTime}
                                        className="text-sm font-black text-slate-900 bg-transparent border-b border-slate-300 focus:outline-none focus:border-purple-500 w-full disabled:opacity-50"
                                    />
                                </div>
                                {isSavingTime && <Loader2 className="animate-spin text-purple-600 w-4 h-4 mt-4" />}
                            </div>
                        </div>

                        {appointment.treatment && (
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-green-100 text-green-600 rounded-xl flex items-center justify-center">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-slate-400 uppercase">Tratamiento</p>
                                    <p className="text-sm font-black text-slate-900">{appointment.treatment}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Información adicional */}
                    {patient.alerts && patient.alerts.length > 0 && (
                        <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-4">
                            <p className="text-xs font-black uppercase text-amber-700 mb-2">⚠️ Alertas</p>
                            <ul className="space-y-1">
                                {patient.alerts.map((alert, idx) => (
                                    <li key={idx} className="text-sm text-amber-900 font-medium">• {alert}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-8 pt-0 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                        Cerrar
                    </button>
                    <button
                        onClick={handleViewAppointment}
                        className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-4 rounded-xl text-sm font-black uppercase shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
                    >
                        <Eye size={20} />
                        Ver Cita
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AppointmentModal;
