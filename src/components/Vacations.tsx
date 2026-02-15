import React, { useState, useEffect } from 'react';
import { Calendar, Plus, X, Trash2, Save, AlertCircle, Edit3 } from 'lucide-react';
import { api } from '../services/api';

interface Vacation {
  id?: string;
  doctor_id: string;
  doctor_name: string;
  start_date: string;
  end_date: string;
  reason?: string;
  is_approved: boolean;
}

const Vacations: React.FC = () => {
  const [vacations, setVacations] = useState<Vacation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVacation, setEditingVacation] = useState<Vacation | null>(null);
  const [vacationForm, setVacationForm] = useState<Vacation>({
    doctor_id: '',
    doctor_name: '',
    start_date: '',
    end_date: '',
    reason: '',
    is_approved: false
  });

  const [doctors, setDoctors] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    loadVacations();
    loadDoctors();
  }, []);

  const loadVacations = async () => {
    setIsLoading(true);
    try {
      const data = await api.vacations.getAll();
      setVacations(data || []);
    } catch (e) {
      console.error('Error loading vacations:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const loadDoctors = async () => {
    try {
      const data = await api.doctors.getAll();
      setDoctors(data || []);
    } catch (e) {
      console.error('Error loading doctors:', e);
    }
  };

  const handleResetForm = () => {
    setVacationForm({
      doctor_id: '',
      doctor_name: '',
      start_date: '',
      end_date: '',
      reason: '',
      is_approved: false
    });
    setEditingVacation(null);
  };

  const handleAddVacation = () => {
    handleResetForm();
    setShowModal(true);
  };

  const handleEditVacation = (vacation: Vacation) => {
    setEditingVacation(vacation);
    setVacationForm(vacation);
    setShowModal(true);
  };

  const handleSaveVacation = async () => {
    if (!vacationForm.doctor_id || !vacationForm.start_date || !vacationForm.end_date) {
      alert('Debe completar todos los campos obligatorios');
      return;
    }

    if (new Date(vacationForm.start_date) > new Date(vacationForm.end_date)) {
      alert('La fecha de inicio no puede ser posterior a la fecha de fin');
      return;
    }

    setIsSaving(true);
    try {
      if (editingVacation?.id) {
        await api.vacations.update(editingVacation.id, vacationForm);
      } else {
        await api.vacations.create(vacationForm);
      }
      setShowModal(false);
      loadVacations();
      setSuccessMessage('Vacaciones guardadas correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving vacation:', error);
      alert('Error al guardar las vacaciones');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteVacation = async (id: string | undefined, doctorName: string) => {
    if (!id) return;
    if (!confirm(`¿Eliminar vacaciones de ${doctorName}?`)) return;

    try {
      await api.vacations.delete(id);
      loadVacations();
      setSuccessMessage('Vacaciones eliminadas');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting vacation:', error);
      alert('Error al eliminar las vacaciones');
    }
  };

  const calculateDays = (start: string, end: string) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)) + 1;
  };

  const getStatusColor = (startDate: string) => {
    const today = new Date();
    const vacationStart = new Date(startDate);
    const daysUntil = Math.ceil((vacationStart.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (daysUntil < 0) return 'text-red-600 bg-red-50';
    if (daysUntil <= 7) return 'text-orange-600 bg-orange-50';
    return 'text-blue-600 bg-blue-50';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-orange-200 border-t-orange-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-orange-500" size={32} />
            Gestión de Vacaciones
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Períodos de descanso y disponibilidad</p>
        </div>
        <button
          onClick={handleAddVacation}
          className="bg-gradient-to-r from-orange-600 to-orange-700 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg hover:shadow-orange-200"
        >
          <Plus size={16} /> Nueva Vacación
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-green-600" size={20} />
          <p className="text-sm font-bold text-green-700">{successMessage}</p>
        </div>
      )}

      {/* VACATIONS LIST */}
      {vacations.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">No hay vacaciones registradas</p>
        </div>
      ) : (
        <div className="space-y-4">
          {vacations.map(vacation => (
            <div
              key={vacation.id}
              className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow group"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    <h5 className="text-sm font-bold text-slate-900">{vacation.doctor_name}</h5>
                    <span
                      className={`text-[10px] font-bold uppercase px-2 py-1 rounded-full ${
                        vacation.is_approved
                          ? 'bg-green-100 text-green-700'
                          : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {vacation.is_approved ? '✓ Aprobado' : '⏳ Pendiente'}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="text-xs text-slate-600">
                      <span className="font-bold">Desde:</span> {new Date(vacation.start_date).toLocaleDateString()}
                    </div>
                    <div className="text-xs text-slate-600">
                      <span className="font-bold">Hasta:</span> {new Date(vacation.end_date).toLocaleDateString()}
                    </div>
                    <div className={`text-xs font-bold ${getStatusColor(vacation.start_date)} px-3 py-1 rounded-full`}>
                      {calculateDays(vacation.start_date, vacation.end_date)} días
                    </div>
                  </div>

                  {vacation.reason && (
                    <p className="text-xs text-slate-500 mt-3">
                      <span className="font-bold">Razón:</span> {vacation.reason}
                    </p>
                  )}
                </div>

                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity ml-4">
                  <button
                    onClick={() => handleEditVacation(vacation)}
                    className="p-2 hover:bg-orange-50 rounded-lg text-slate-400 hover:text-orange-600 transition-colors"
                  >
                    <Edit3 size={16} />
                  </button>
                  <button
                    onClick={() => handleDeleteVacation(vacation.id, vacation.doctor_name)}
                    className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* VACATION MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">
                {editingVacation ? '✏️ Editar Vacación' : '➕ Nueva Vacación'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Doctor *</label>
                <select
                  value={vacationForm.doctor_id}
                  onChange={(e) => {
                    const selected = doctors.find(d => d.id === e.target.value);
                    setVacationForm({
                      ...vacationForm,
                      doctor_id: e.target.value,
                      doctor_name: selected?.name || ''
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                >
                  <option value="">Seleccionar doctor...</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Fecha Inicio *</label>
                  <input
                    type="date"
                    value={vacationForm.start_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, start_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>

                <div>
                  <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Fecha Fin *</label>
                  <input
                    type="date"
                    value={vacationForm.end_date}
                    onChange={(e) => setVacationForm({ ...vacationForm, end_date: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                  />
                </div>
              </div>

              {vacationForm.start_date && vacationForm.end_date && (
                <div className="p-3 bg-orange-50 rounded-xl border border-orange-200">
                  <p className="text-xs font-bold text-orange-700">
                    Duración: {calculateDays(vacationForm.start_date, vacationForm.end_date)} días
                  </p>
                </div>
              )}

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Razón (Opcional)</label>
                <textarea
                  value={vacationForm.reason || ''}
                  onChange={(e) => setVacationForm({ ...vacationForm, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200 resize-none"
                  rows={3}
                  placeholder="Ej: Vacaciones anuales, permiso personal, etc."
                />
              </div>

              <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl">
                <input
                  type="checkbox"
                  checked={vacationForm.is_approved}
                  onChange={(e) => setVacationForm({ ...vacationForm, is_approved: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-orange-600 cursor-pointer"
                />
                <label className="text-xs font-bold text-slate-700 cursor-pointer">Marcar como aprobado</label>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveVacation}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-orange-600 to-orange-700 text-white py-3 rounded-xl font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vacations;
