import React, { useState, useEffect } from 'react';
import { X, AlertCircle, Clock, CheckCircle2, Bell } from 'lucide-react';
import { Patient } from '../../types';
import { api } from '../services/api';
import toast from 'react-hot-toast';

interface ReminderModalProps {
    isOpen: boolean;
    onClose: () => void;
    patient: Patient;
    onReminderCreated?: () => void;
}

interface ReminderForm {
    description: string;
    dueDate: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH';
    notificationMethod: 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'BOTH';
    notes: string;
}

export const ReminderModal: React.FC<ReminderModalProps> = ({
    isOpen,
    onClose,
    patient,
    onReminderCreated
}) => {
    const [form, setForm] = useState<ReminderForm>({
        description: '',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 30 days
        priority: 'MEDIUM',
        notificationMethod: 'IN_APP',
        notes: ''
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [reminders, setReminders] = useState<any[]>([]);
    const [isLoadingReminders, setIsLoadingReminders] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadReminders();
        }
    }, [isOpen]);

    const loadReminders = async () => {
        setIsLoadingReminders(true);
        try {
            const response = await api.reminders.getByPatient(patient.id);
            setReminders(response || []);
        } catch (error) {
            console.error('Error loading reminders:', error);
        } finally {
            setIsLoadingReminders(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.description.trim()) {
            toast.error('Describe el recordatorio');
            return;
        }

        if (!form.dueDate) {
            toast.error('Selecciona una fecha');
            return;
        }

        setIsSubmitting(true);
        try {
            await api.reminders.create({
                patientId: patient.id,
                description: form.description,
                dueDate: form.dueDate,
                priority: form.priority,
                notificationMethod: form.notificationMethod,
                notes: form.notes
            });

            toast.success('Recordatorio creado correctamente');
            setForm({
                description: '',
                dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                priority: 'MEDIUM',
                notificationMethod: 'IN_APP',
                notes: ''
            });
            loadReminders();
            onReminderCreated?.();
        } catch (error: any) {
            toast.error(error.message || 'Error al crear recordatorio');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCompleteReminder = async (reminderId: string) => {
        try {
            await api.reminders.update(reminderId, { status: 'COMPLETED' });
            toast.success('Recordatorio marcado como completado');
            loadReminders();
        } catch (error: any) {
            toast.error(error.message || 'Error al actualizar recordatorio');
        }
    };

    const handleDeleteReminder = async (reminderId: string) => {
        if (!window.confirm('¿Eliminar este recordatorio?')) return;
        try {
            await api.reminders.delete(reminderId);
            toast.success('Recordatorio eliminado');
            loadReminders();
        } catch (error: any) {
            toast.error(error.message || 'Error al eliminar recordatorio');
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'HIGH':
                return 'bg-red-100 text-red-700 border-red-300';
            case 'MEDIUM':
                return 'bg-amber-100 text-amber-700 border-amber-300';
            case 'LOW':
                return 'bg-green-100 text-green-700 border-green-300';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-300';
        }
    };

    const getPriorityLabel = (priority: string) => {
        const labels: Record<string, string> = {
            'HIGH': 'Urgente',
            'MEDIUM': 'Normal',
            'LOW': 'Baja'
        };
        return labels[priority] || priority;
    };

    if (!isOpen) return null;

    const pendingReminders = reminders.filter(r => r.status === 'PENDING');
    const completedReminders = reminders.filter(r => r.status === 'COMPLETED');

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 p-2 rounded-lg">
                            <Bell size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Recordatorios</h2>
                            <p className="text-xs text-slate-500 mt-0.5">{patient.name}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <X size={20} className="text-slate-600" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto">
                    {/* Form Section */}
                    <div className="p-6 border-b border-slate-200 bg-blue-50/50">
                        <h3 className="font-bold text-slate-900 mb-4">➕ Nuevo Recordatorio</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Description */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                                    Descripción *
                                </label>
                                <input
                                    type="text"
                                    placeholder="Ej: Llamar a Paki, Seguimiento blanqueamiento, etc."
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                                />
                            </div>

                            {/* Grid: Date, Priority, Notification */}
                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                                        Fecha *
                                    </label>
                                    <input
                                        type="date"
                                        value={form.dueDate}
                                        onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                                        Prioridad
                                    </label>
                                    <select
                                        value={form.priority}
                                        onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                                    >
                                        <option value="LOW">Baja</option>
                                        <option value="MEDIUM">Normal</option>
                                        <option value="HIGH">Urgente</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                                        Notificación
                                    </label>
                                    <select
                                        value={form.notificationMethod}
                                        onChange={(e) => setForm({ ...form, notificationMethod: e.target.value as any })}
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300"
                                    >
                                        <option value="IN_APP">En la app</option>
                                        <option value="WHATSAPP">WhatsApp</option>
                                        <option value="EMAIL">Email</option>
                                        <option value="BOTH">Ambas</option>
                                    </select>
                                </div>
                            </div>

                            {/* Notes */}
                            <div>
                                <label className="text-xs font-bold text-slate-700 uppercase block mb-1.5">
                                    Notas adicionales
                                </label>
                                <textarea
                                    placeholder="Información adicional sobre el recordatorio..."
                                    value={form.notes}
                                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                    rows={2}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-300 resize-none"
                                />
                            </div>

                            {/* Submit */}
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-blue-600 text-white font-bold py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isSubmitting ? 'Guardando...' : 'Crear Recordatorio'}
                            </button>
                        </form>
                    </div>

                    {/* Reminders List */}
                    <div className="p-6 space-y-4">
                        {isLoadingReminders ? (
                            <p className="text-center text-slate-500 text-sm py-4">Cargando recordatorios...</p>
                        ) : pendingReminders.length === 0 && completedReminders.length === 0 ? (
                            <div className="text-center py-8 text-slate-500">
                                <Bell size={32} className="mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No hay recordatorios</p>
                            </div>
                        ) : (
                            <>
                                {/* Pending Reminders */}
                                {pendingReminders.length > 0 && (
                                    <div>
                                        <h4 className="font-bold text-slate-900 mb-2 text-sm">
                                            ⏳ Pendientes ({pendingReminders.length})
                                        </h4>
                                        <div className="space-y-2">
                                            {pendingReminders.map((reminder) => (
                                                <div
                                                    key={reminder.id}
                                                    className={`p-3 rounded-lg border-2 ${getPriorityColor(reminder.priority)}`}
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1">
                                                            <p className="font-bold text-sm">{reminder.description}</p>
                                                            <div className="flex items-center gap-3 mt-1.5 text-xs opacity-75">
                                                                <div className="flex items-center gap-1">
                                                                    <Clock size={12} />
                                                                    {new Date(reminder.dueDate).toLocaleDateString('es-ES')}
                                                                </div>
                                                                <span>• {getPriorityLabel(reminder.priority)}</span>
                                                            </div>
                                                            {reminder.notes && (
                                                                <p className="text-xs mt-1.5 italic opacity-75">{reminder.notes}</p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-1.5 flex-shrink-0">
                                                            <button
                                                                onClick={() => handleCompleteReminder(reminder.id)}
                                                                className="p-1.5 hover:bg-white/50 rounded-lg transition-colors"
                                                                title="Completar"
                                                            >
                                                                <CheckCircle2 size={16} />
                                                            </button>
                                                            <button
                                                                onClick={() => handleDeleteReminder(reminder.id)}
                                                                className="p-1.5 hover:bg-red-200/50 rounded-lg transition-colors"
                                                                title="Eliminar"
                                                            >
                                                                <X size={16} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Completed Reminders */}
                                {completedReminders.length > 0 && (
                                    <div className="mt-4">
                                        <h4 className="font-bold text-slate-500 mb-2 text-sm text-xs uppercase">
                                            ✓ Completados ({completedReminders.length})
                                        </h4>
                                        <div className="space-y-1.5 opacity-60">
                                            {completedReminders.map((reminder) => (
                                                <div key={reminder.id} className="text-xs text-slate-600 line-through p-2 bg-slate-50 rounded">
                                                    {reminder.description}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-200 bg-slate-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 bg-slate-200 text-slate-900 font-bold rounded-lg hover:bg-slate-300 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReminderModal;
