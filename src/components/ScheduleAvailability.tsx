import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, X, Trash2, Save, AlertCircle, Edit3, Search } from 'lucide-react';
import { api } from '../services/api';

interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

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
  notes?: string;
  is_active?: boolean;
}

interface ServiceDuration {
  id?: string;
  specialty: string;
  duration_min: number;
}

const ScheduleAvailability: React.FC = () => {
  const [systemDoctors, setSystemDoctors] = useState<SystemUser[]>([]);
  const [doctors, setDoctors] = useState<DoctorSchedule[]>([]);
  const [serviceDurations, setServiceDurations] = useState<ServiceDuration[]>([]);
  const [isLoadingDoctors, setIsLoadingDoctors] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'doctors' | 'durations'>('doctors');

  // Modal states
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<DoctorSchedule | null>(null);
  const [doctorSearchInput, setDoctorSearchInput] = useState('');
  const [showDoctorDropdown, setShowDoctorDropdown] = useState(false);

  const [doctorForm, setDoctorForm] = useState<DoctorSchedule & { morning_active: boolean, afternoon_active: boolean }>({
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
    afternoon_end: '20:00',
    morning_active: true,
    afternoon_active: true
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
      // Load system users - Include inactive for search, allow assigning schedules to any role (Admins can be doctors too)
      const systemUsersData = await api.systemUsers.getAllIncludeInactive();
      setSystemDoctors(systemUsersData);

      // Load configured doctor schedules
      const doctorsData = await api.doctorSchedules.getAll();

      // Transform time format: "HH:MM:SS" -> "HH:MM"
      const transformedDoctors = (doctorsData || []).map((doc: any) => ({
        ...doc,
        morning_start: doc.morning_start?.slice(0, 5) || '09:00',
        morning_end: doc.morning_end?.slice(0, 5) || '13:00',
        afternoon_start: doc.afternoon_start?.slice(0, 5) || '16:00',
        afternoon_end: doc.afternoon_end?.slice(0, 5) || '20:00'
      }));

      setDoctors(transformedDoctors);

      // Load service durations
      const durationsData = await api.schedule.getServiceDurations();
      setServiceDurations(durationsData || []);
    } catch (e) {
      console.error('Error loading schedule data:', e);
    } finally {
      setIsLoadingDoctors(false);
    }
  };

  // Filter doctors based on search input
  const filteredDoctors = systemDoctors.filter(doc =>
    (doc.full_name || '').toLowerCase().includes(doctorSearchInput.toLowerCase()) ||
    (doc.email || '').toLowerCase().includes(doctorSearchInput.toLowerCase())
  );

  const handleSelectDoctor = (doctor: SystemUser) => {
    // Check if this doctor already has a schedule
    const existingSchedule = doctors.find(d => d.doctor_id === doctor.id);

    if (existingSchedule) {
      setEditingDoctor(existingSchedule);
      // Make sure times are in HH:MM format
      setDoctorForm({
        ...existingSchedule,
        morning_start: existingSchedule.morning_start?.slice(0, 5) || '09:00',
        morning_end: existingSchedule.morning_end?.slice(0, 5) || '13:00',
        afternoon_start: existingSchedule.afternoon_start?.slice(0, 5) || '16:00',
        afternoon_end: existingSchedule.afternoon_end?.slice(0, 5) || '20:00',
        morning_active: !!(existingSchedule.morning_start && existingSchedule.morning_end),
        afternoon_active: !!(existingSchedule.afternoon_start && existingSchedule.afternoon_end),
        is_active: existingSchedule.is_active !== false
      });
    } else {
      setEditingDoctor(null);
      setDoctorForm({
        doctor_id: doctor.id,
        doctor_name: doctor.full_name,
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
        afternoon_end: '20:00',
        morning_active: true,
        afternoon_active: true,
        is_active: true
      });
    }

    setDoctorSearchInput('');
    setShowDoctorDropdown(false);
    setShowDoctorModal(true);
  };

  const handleResetDoctorForm = () => {
    setDoctorSearchInput('');
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
      afternoon_end: '20:00',
      morning_active: true,
      afternoon_active: true,
      is_active: true
    });
    setEditingDoctor(null);
  };

  const handleAddDoctor = () => {
    handleResetDoctorForm();
    setShowDoctorDropdown(true);
  };

  const handleEditDoctor = (doctor: DoctorSchedule) => {
    setEditingDoctor(doctor);
    setDoctorForm({
      ...doctor,
      morning_active: !!(doctor.morning_start && doctor.morning_end),
      afternoon_active: !!(doctor.afternoon_start && doctor.afternoon_end),
      morning_start: doctor.morning_start || '09:00',
      morning_end: doctor.morning_end || '13:00',
      afternoon_start: doctor.afternoon_start || '16:00',
      afternoon_end: doctor.afternoon_end || '20:00',
    });
    setShowDoctorModal(true);
  };

  const handleSaveDoctor = async () => {
    if (!doctorForm.doctor_id) {
      alert('Por favor selecciona un doctor');
      return;
    }

    if (!doctorForm.morning_active && !doctorForm.afternoon_active) {
      alert('Debes habilitar al menos un turno (mañana o tarde) o marcarlo como inactivo totalmente.');
      return;
    }

    setIsSaving(true);
    try {
      const scheduleData = {
        doctor_id: doctorForm.doctor_id,
        doctor_name: doctorForm.doctor_name,
        monday: doctorForm.monday,
        tuesday: doctorForm.tuesday,
        wednesday: doctorForm.wednesday,
        thursday: doctorForm.thursday,
        friday: doctorForm.friday,
        saturday: doctorForm.saturday,
        sunday: doctorForm.sunday,
        morning_start: doctorForm.morning_active ? doctorForm.morning_start + ':00' : null,
        morning_end: doctorForm.morning_active ? doctorForm.morning_end + ':00' : null,
        afternoon_start: doctorForm.afternoon_active ? doctorForm.afternoon_start + ':00' : null,
        afternoon_end: doctorForm.afternoon_active ? doctorForm.afternoon_end + ':00' : null,
        is_active: true
      };

      if (editingDoctor?.id) {
        await api.doctorSchedules.update(editingDoctor.id, scheduleData);
      } else {
        await api.doctorSchedules.create(scheduleData);
      }

      setShowDoctorModal(false);
      setShowDoctorDropdown(false);
      loadScheduleData();
      setSuccessMessage('Horario guardado correctamente ✓');
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
      // Soft delete by marking as inactive in Supabase
      await api.doctorSchedules.update(id, { is_active: false });
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
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'doctors' ? 'bg-slate-900 text-white' : 'text-slate-500'
            }`}
        >
          Horarios de Doctores
        </button>
        <button
          onClick={() => setActiveTab('durations')}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${activeTab === 'durations' ? 'bg-slate-900 text-white' : 'text-slate-500'
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

          {/* Doctor Search (Show when adding new) */}
          {showDoctorDropdown && !editingDoctor && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 mb-6 relative z-50">
              <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Selecciona un Doctor</label>
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-4 top-3 text-slate-400" size={18} />
                  <input
                    type="text"
                    value={doctorSearchInput}
                    onChange={(e) => setDoctorSearchInput(e.target.value)}
                    onFocus={() => setShowDoctorDropdown(true)}
                    placeholder="Escribe el nombre o email del doctor..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 pr-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-purple-200"
                  />
                </div>

                {/* Dropdown list */}
                {showDoctorDropdown && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto z-50">
                    {filteredDoctors.length > 0 ? (
                      filteredDoctors.map(doctor => (
                        <button
                          key={doctor.id}
                          onClick={() => handleSelectDoctor(doctor)}
                          className="w-full px-4 py-3 text-left hover:bg-purple-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          <p className="text-sm font-bold text-slate-900">{doctor.full_name}</p>
                          <p className="text-xs text-slate-500">{doctor.email}</p>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-center text-xs text-slate-500">
                        No se encontraron doctores
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {doctors.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No hay horarios configurados</p>
            </div>
          ) : (
            <div className="space-y-6">
              {(Object.entries(
                doctors.reduce((acc, doc) => {
                  if (!acc[doc.doctor_name]) acc[doc.doctor_name] = [];
                  acc[doc.doctor_name].push(doc);
                  return acc;
                }, {} as Record<string, DoctorSchedule[]>)
              ) as [string, DoctorSchedule[]][]).map(([doctorName, schedules]) => (
                <div key={doctorName} className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-4">
                    <h5 className="text-lg font-bold text-slate-900">{doctorName}</h5>
                    <button
                      onClick={() => {
                        handleResetDoctorForm();
                        setDoctorForm(prev => ({ ...prev, doctor_name: doctorName, doctor_id: schedules[0].doctor_id }));
                        setShowDoctorModal(true);
                      }}
                      className="bg-purple-100 text-purple-700 hover:bg-purple-200 px-3 py-1.5 rounded-lg text-xs font-bold uppercase gap-2 flex items-center transition-colors"
                    >
                      <Plus size={14} /> Añadir Fragmento
                    </button>
                  </div>

                  <div className="space-y-4">
                    {schedules.map((doctor, idx) => (
                      <div key={doctor.id || idx} className="bg-slate-50 border border-slate-100 rounded-xl p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div className="flex-1">
                            <h6 className="text-xs font-black uppercase text-slate-500 mb-1">Franja #{idx + 1}</h6>
                            <p className="text-sm font-bold text-slate-700 flex flex-wrap gap-x-4 gap-y-1">
                              {doctor.morning_start && doctor.morning_end ? (
                                <span>Mañana: <span className="text-purple-600">{doctor.morning_start} - {doctor.morning_end}</span></span>
                              ) : null}
                              {doctor.afternoon_start && doctor.afternoon_end ? (
                                <span>Tarde: <span className="text-purple-600">{doctor.afternoon_start} - {doctor.afternoon_end}</span></span>
                              ) : null}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditDoctor(doctor)}
                              className="p-2 bg-white border border-slate-200 hover:bg-purple-50 rounded-lg text-slate-400 hover:text-purple-600 transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteDoctor(doctor.id, doctor.doctor_name)}
                              className="p-2 bg-white border border-slate-200 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Days Grid */}
                        <div className="grid grid-cols-7 gap-2">
                          {daysOfWeek.map(day => (
                            <div
                              key={day.key}
                              className={`py-1.5 rounded-md text-center text-[10px] font-black uppercase cursor-default ${doctor[day.key as keyof DoctorSchedule]
                                ? 'bg-purple-200 text-purple-800'
                                : 'bg-slate-200 text-slate-400 opacity-50'
                                }`}
                            >
                              {day.label.slice(0, 3)}
                            </div>
                          ))}
                        </div>
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
                onClick={() => {
                  setShowDoctorModal(false);
                  setShowDoctorDropdown(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-purple-50 rounded-xl border border-purple-200">
                <p className="text-xs font-black uppercase text-purple-700 mb-1">Doctor</p>
                <p className="text-sm font-bold text-slate-900">{doctorForm.doctor_name}</p>
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
                      className={`p-3 rounded-lg text-xs font-bold uppercase transition-all ${doctorForm[day.key as keyof DoctorSchedule]
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
                onClick={() => {
                  setShowDoctorModal(false);
                  setShowDoctorDropdown(false);
                }}
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
