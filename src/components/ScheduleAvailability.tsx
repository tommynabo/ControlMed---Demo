import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, X, Trash2, Save, AlertCircle, Edit3 } from 'lucide-react';
import { api } from '../services/api';

interface DoctorSchedule {
  id?: string;
  doctor_id: string;
  doctor_name: string;
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
  morning_start: string;
  morning_end: string;
  afternoon_start: string;
  afternoon_end: string;
}

interface ServiceDuration {
  id?: string;
  specialty: string;
  duration_min: number;
}

const ScheduleAvailability: React.FC = () => {
  const [doctors, setDoctors] = useState<DoctorSchedule[]>([]);
  const [serviceDurations, setServiceDurations] = useState<ServiceDuration[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'doctors' | 'durations'>('doctors');

  // Modal states
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorSchedule | null>(null);
  const [doctorForm, setDoctorForm] = useState<DoctorSchedule>({
    doctor_id: '',
    doctor_name: '',
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: false,
    sunday: false,
    morning_start: '09:00',
    morning_end: '13:00',
    afternoon_start: '16:00',
    afternoon_end: '20:00'
  });

  const [showDurationModal, setShowDurationModal] = useState(false);
  const [editingDuration, setEditingDuration] = useState<ServiceDuration | null>(null);
  const [durationForm, setDurationForm] = useState<ServiceDuration>({
    specialty: '',
    duration_min: 30
  });

  useEffect(() => {
    loadScheduleData();
  }, []);

  const loadScheduleData = async () => {
    setIsLoadingDoctors(true);
    try {
      const doctorsData = await api.doctorSchedules.getAll();
      const durationsData = await api.schedule.getServiceDurations();
      setDoctors(doctorsData || []);
      setServiceDurations(durationsData || []);
    } catch (e) {
      console.error('Error loading schedule data:', e);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  const handleResetDoctorForm = () => {
    setDoctorForm({
      doctor_id: '',
      doctor_name: '',
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false,
      morning_start: '09:00',
      morning_end: '13:00',
      afternoon_start: '16:00',
      afternoon_end: '20:00'
    });
    setEditingDoctor(null);
  };

  const handleAddDoctor = () => {
    handleResetDoctorForm();
    setShowDoctorModal(true);
  };

  const handleEditDoctor = (doctor: DoctorSchedule) => {
    setEditingDoctor(doctor);
    setDoctorForm(doctor);
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async () => {
    if (!doctorForm.doctor_name) {
      alert('El nombre del doctor es obligatorio');
      return;
    }

    setIsSaving(true);
    try {
      if (editingDoctor?.id) {
        await api.schedule.updateDoctor(editingDoctor.id, doctorForm);
      } else {
        await api.schedule.createDoctor(doctorForm);
      }
      setShowDoctorModal(false);
      loadScheduleData();
      setSuccessMessage('Horario guardado correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving doctor schedule:', error);
      alert('Error al guardar el horario del doctor');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDoctor = async (id: string | undefined, name: string) => {
    if (!id) return;
    if (!confirm(`¿Eliminar horario de ${name}?`)) return;

    try {
      await api.schedule.deleteDoctor(id);
      loadScheduleData();
      setSuccessMessage('Horario eliminado');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting doctor schedule:', error);
      alert('Error al eliminar el horario');
    }
  };

  const handleAddDuration = () => {
    setDurationForm({ specialty: '', duration_min: 30 });
    setEditingDuration(null);
    setShowDurationModal(true);
  };

  const handleEditDuration = (duration: ServiceDuration) => {
    setEditingDuration(duration);
    setDurationForm(duration);
    setShowDurationModal(true);
  };

  const handleSaveDuration = async () => {
    if (!durationForm.specialty) {
      alert('La especialidad es obligatoria');
      return;
    }

    setIsSaving(true);
    try {
      if (editingDuration?.id) {
        await api.schedule.updateDuration(editingDuration.id, durationForm);
      } else {
        await api.schedule.createDuration(durationForm);
      }
      setShowDurationModal(false);
      loadScheduleData();
      setSuccessMessage('Duración guardada correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving duration:', error);
      alert('Error al guardar la duración');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteDuration = async (id: string | undefined, specialty: string) => {
    if (!id) return;
    if (!confirm(`¿Eliminar duración de ${specialty}?`)) return;

    try {
      await api.schedule.deleteDuration(id);
      loadScheduleData();
      setSuccessMessage('Duración eliminada');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting duration:', error);
      alert('Error al eliminar la duración');
    }
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Lunes' },
    { key: 'tuesday', label: 'Martes' },
    { key: 'wednesday', label: 'Miércoles' },
    { key: 'thursday', label: 'Jueves' },
    { key: 'friday', label: 'Viernes' },
    { key: 'saturday', label: 'Sábado' },
    { key: 'sunday', label: 'Domingo' }
  ];

  if (isLoadingDoctors) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Calendar className="text-purple-500" size={32} />
            Horarios y Disponibilidad
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Turnos, días laborales y duraciones</p>
        </div>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-green-600" size={20} />
          <p className="text-sm font-bold text-green-700">{successMessage}</p>
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-2 bg-white border border-slate-200 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('doctors')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
            activeTab === 'doctors' ? 'bg-slate-900 text-white' : 'text-slate-500'
          }`}
        >
          Horarios de Doctores
        </button>
        <button
          onClick={() => setActiveTab('durations')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${
            activeTab === 'durations' ? 'bg-slate-900 text-white' : 'text-slate-500'
          }`}
        >
          Duraciones Estándar
        </button>
      </div>

      {/* DOCTORS SECTION */}
      {activeTab === 'doctors' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-slate-900">Horarios Médicos</h4>
            <button
              onClick={handleAddDoctor}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase gap-2 flex items-center hover:scale-105 transition-transform"
            >
              <Plus size={16} /> Nuevo Horario
            </button>
          </div>

          {doctors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No hay horarios configurados</p>
            </div>
          ) : (
            <div className="space-y-4">
              {doctors.map(doctor => (
                <div key={doctor.id} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-slate-900">{doctor.doctor_name}</h5>
                      <p className="text-xs text-slate-400 mt-1">
                        Turno mañana: {doctor.morning_start} - {doctor.morning_end} | Turno tarde: {doctor.afternoon_start} - {doctor.afternoon_end}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditDoctor(doctor)}
                        className="p-2 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDoctor(doctor.id, doctor.doctor_name)}
                        className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Days Grid */}
                  <div className="grid grid-cols-7 gap-2">
                    {daysOfWeek.map(day => (
                      <div
                        key={day.key}
                        className={`p-2 rounded-lg text-center text-xs font-bold uppercase cursor-default ${
                          doctor[day.key as keyof DoctorSchedule]
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {day.label[0]}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DURATIONS SECTION */}
      {activeTab === 'durations' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h4 className="text-lg font-bold text-slate-900">Duración Estándar por Especialidad</h4>
            <button
              onClick={handleAddDuration}
              className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase gap-2 flex items-center hover:scale-105 transition-transform"
            >
              <Plus size={16} /> Nueva Duración
            </button>
          </div>

          {serviceDurations.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Clock className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No hay duraciones configuradas</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {serviceDurations.map(duration => (
                <div key={duration.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-slate-900">{duration.specialty}</h5>
                      <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                        <Clock size={14} /> {duration.duration_min} minutos
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEditDuration(duration)}
                        className="p-2 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        onClick={() => handleDeleteDuration(duration.id, duration.specialty)}
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
        </div>
      )}

      {/* DOCTOR SCHEDULE MODAL */}
      {showDoctorModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">
                {editingDoctor ? '✏️ Editar Horario' : '➕ Nuevo Horario'}
              </h3>
              <button
                onClick={() => setShowDoctorModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Nombre del Doctor</label>
                <input
                  type="text"
                  value={doctorForm.doctor_name}
                  onChange={(e) => setDoctorForm({ ...doctorForm, doctor_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                  placeholder="Ej: Dr. Juan Pérez"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Días Laborales</label>
                <div className="grid grid-cols-7 gap-2">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.key}
                      onClick={() =>
                        setDoctorForm({
                          ...doctorForm,
                          [day.key]: !doctorForm[day.key as keyof DoctorSchedule]
                        })
                      }
                      className={`p-3 rounded-lg text-xs font-bold uppercase transition-all ${
                        doctorForm[day.key as keyof DoctorSchedule]
                          ? 'bg-purple-100 text-purple-700 border-2 border-purple-300'
                          : 'bg-slate-100 text-slate-400 border-2 border-slate-200'
                      }`}
                    >
                      {day.label[0]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-t border-slate-200 pt-6">
                <h5 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-purple-500" />
                  Turno Mañana
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Inicio</label>
                    <input
                      type="time"
                      value={doctorForm.morning_start}
                      onChange={(e) => setDoctorForm({ ...doctorForm, morning_start: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Fin</label>
                    <input
                      type="time"
                      value={doctorForm.morning_end}
                      onChange={(e) => setDoctorForm({ ...doctorForm, morning_end: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                </div>
              </div>

              <div>
                <h5 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Clock size={16} className="text-orange-500" />
                  Turno Tarde
                </h5>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Inicio</label>
                    <input
                      type="time"
                      value={doctorForm.afternoon_start}
                      onChange={(e) => setDoctorForm({ ...doctorForm, afternoon_start: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Fin</label>
                    <input
                      type="time"
                      value={doctorForm.afternoon_end}
                      onChange={(e) => setDoctorForm({ ...doctorForm, afternoon_end: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowDoctorModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDoctor}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-xl font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DURATION MODAL */}
      {showDurationModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900">
                {editingDuration ? '✏️ Editar Duración' : '➕ Nueva Duración'}
              </h3>
              <button
                onClick={() => setShowDurationModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Especialidad</label>
                <input
                  type="text"
                  value={durationForm.specialty}
                  onChange={(e) => setDurationForm({ ...durationForm, specialty: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                  placeholder="Ej: Odontología"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Duración (minutos)</label>
                <input
                  type="number"
                  value={durationForm.duration_min}
                  onChange={(e) => setDurationForm({ ...durationForm, duration_min: parseInt(e.target.value) })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                  min="5"
                  step="5"
                />
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowDurationModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveDuration}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-purple-600 to-purple-700 text-white py-3 rounded-xl font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
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

export default ScheduleAvailability;
