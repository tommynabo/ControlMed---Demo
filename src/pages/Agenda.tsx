import React, { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Plus, Calendar, User, Clock, CheckCircle2, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { DENTAL_SERVICES, DOCTORS } from '../constants';
import { Appointment, Doctor } from '../../types';

// Temporary constant move (should be in a constants file)
const TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "16:00", "17:00", "18:00"];

const Agenda: React.FC = () => {
    const {
        appointments, addAppointment, patients, currentUser, currentUserRole, api
    } = useAppContext();
    const navigate = useNavigate();

    const [currentDate, setCurrentDate] = useState(new Date());
    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');

    const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
    const [activeSlot, setActiveSlot] = useState<{ time: string, dayIdx: number } | null>(null);
    const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);

    // Search States
    const [apptSearch, setApptSearch] = useState('');
    const [bookingTreatment, setBookingTreatment] = useState(''); // Stores Treatment ID
    const [bookingDoctorId, setBookingDoctorId] = useState(''); // Local state for modal
    const [apptTreatmentSearch, setApptTreatmentSearch] = useState('');
    const [bookingObservation, setBookingObservation] = useState('');
    const [bookingPrice, setBookingPrice] = useState<number>(0);
    const [bookingDuration, setBookingDuration] = useState<number>(30);

    // Helpers
    const getWeekRange = (d: Date) => {
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(d);
        start.setDate(diff);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    };

    const getDayName = (date: Date, offset: number) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1) + offset;
        d.setDate(diff);
        return d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
    };

    const handlePrev = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'daily') newDate.setDate(newDate.getDate() - 1);
        else newDate.setDate(newDate.getDate() - 7);
        setCurrentDate(newDate);
    };

    const handleNext = () => {
        const newDate = new Date(currentDate);
        if (viewMode === 'daily') newDate.setDate(newDate.getDate() + 1);
        else newDate.setDate(newDate.getDate() + 7);
        setCurrentDate(newDate);
    };

    const filteredAppointments = useMemo(() => {
        return appointments.filter(a => {
            // Filter by Doctor if not 'all'
            if (selectedDoctorId !== 'all' && a.doctorId !== selectedDoctorId) return false;
            return filteredDateMatch(a, currentDate, viewMode);
        });
    }, [appointments, selectedDoctorId, currentDate, viewMode]);

    // Helper para filtrar por fecha visual
    function filteredDateMatch(a: Appointment, date: Date, mode: 'daily' | 'weekly') {
        // Simple logic: we are filtering mainly in the render loop for slots, 
        // global filter here might be redundant if we just map active slots.
        // But let's keep it simple.
        return true;
    }

    // Helper to get appointment color classes based on status
    const getAppointmentColors = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'realizada':
                return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'canceled':
            case 'cancelled':
            case 'anulada':
                return 'bg-red-100 text-red-700 border-red-200';
            case 'noshow':
            case 'no vino':
                return 'bg-amber-100 text-amber-700 border-amber-200';
            default: // Scheduled, Pendiente
                return 'bg-blue-100 text-blue-700 border-blue-200';
        }
    };

    // Handle Click on Existing Appointment
    const handleAppointmentClick = (e: React.MouseEvent, appt: Appointment) => {
        e.stopPropagation();
        setSelectedAppt(appt);

        // Pre-fill modal for viewing details
        const patientName = patients.find(p => p.id === appt.patientId)?.name || '';
        setApptSearch(patientName);
        setBookingDoctorId(appt.doctorId);
        setBookingTreatment(typeof appt.treatment === 'string' ? appt.treatment : (appt.treatment as any)?.id || '');
        // Other fields would need to be in Appointment type to prefill correctly (price, duration, obs etc.)
        // Assuming default for now if missing

        setActiveSlot({ time: appt.time, dayIdx: 0 }); // Visual context
        setIsAppointmentModalOpen(true);
    };

    // Handle Booking
    const handleBooking = async () => {
        if (selectedAppt) {
            // Update logic here if requested, currently user only asked for "Ver Cita" button
            alert("Modo edición no implementado completamente. Solo visualización.");
            return;
        }

        if (!activeSlot || !apptSearch) return;

        // Find Patient
        const patient = patients.find(p => p.name.toLowerCase() === apptSearch.toLowerCase());
        if (!patient) {
            alert("Paciente no encontrado. Cree la ficha primero.");
            return;
        }

        // Validate doctor selection
        if (!bookingDoctorId) {
            alert("Por favor selecciona un doctor");
            return;
        }

        // Calculate Date
        let dateToSave = currentDate;
        if (viewMode === 'weekly') {
            const currentDay = currentDate.getDay(); // 0-6
            const diff = currentDate.getDate() - currentDay + (currentDay === 0 ? -6 : 1) + activeSlot.dayIdx;
            dateToSave = new Date(currentDate); // Copy
            dateToSave.setDate(diff);
        }

        const newAppt: any = {
            date: dateToSave.toISOString().split('T')[0],
            time: activeSlot.time,
            patientId: patient.id,
            doctorId: bookingDoctorId,
            treatmentId: bookingTreatment || null,
            status: 'Scheduled'
        };

        try {
            await api.appointments.create(newAppt);
            addAppointment(newAppt);
            setIsAppointmentModalOpen(false);
            setActiveSlot(null);
            setApptSearch('');
            setBookingTreatment('');
            setBookingObservation('');
            setBookingPrice(0);
            setBookingDuration(30);
            alert("✅ Cita guardada correctamente.");
        } catch (e) {
            console.error(e);
            alert("Error al guardar la cita: " + (e.message || e));
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header ... */}
            <div className="flex flex-col xl:flex-row justify-between items-end xl:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Agenda Médica</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                        {viewMode === 'daily' ? currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : getWeekRange(currentDate)}
                    </p>
                </div>

                <div className="flex gap-4 items-center flex-wrap justify-end">
                    {/* DOCTOR SELECTOR (ADMIN ONLY) */}
                    {(currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') && (
                        <div className="bg-slate-50 p-1 rounded-xl border border-slate-200">
                            <select
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="bg-transparent text-xs font-bold uppercase text-slate-600 outline-none px-2 py-2 cursor-pointer"
                            >
                                <option value="all">Vista General (Todos)</option>
                                <option value="dr-1">Dr. Martin (General)</option>
                                <option value="dr-2">Dra. Garcia (Orto)</option>
                                <option value="dr-3">Dr. Fernandez (Implantes)</option>
                            </select>
                        </div>
                    )}

                    <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-200">
                        <div className="flex bg-white rounded-xl shadow-sm p-1">
                            <button onClick={() => setViewMode('daily')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'daily' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}>Día</button>
                            <button onClick={() => setViewMode('weekly')} className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${viewMode === 'weekly' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400 hover:text-slate-900'}`}>Semana</button>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center">
                        <button onClick={handlePrev} className="p-3 bg-white rounded-xl text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all border border-slate-200"><ChevronLeft size={18} /></button>
                        <button onClick={() => setCurrentDate(new Date())} className="px-6 py-3 bg-white rounded-xl text-slate-900 font-black text-xs uppercase hover:shadow-md transition-all border border-slate-200 min-w-[120px]">
                            {viewMode === 'daily' ? currentDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : getWeekRange(currentDate)}
                        </button>
                        <button onClick={handleNext} className="p-3 bg-white rounded-xl text-slate-400 hover:text-blue-600 hover:shadow-lg transition-all border border-slate-200"><ChevronRight size={18} /></button>
                    </div>
                </div>
            </div>

            {/* CALENDAR GRID */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[1000px]">
                        {/* Header Row */}
                        <div className={`grid gap-4 mb-6 ${viewMode === 'daily' && selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? '' : 'grid-cols-8'}`}
                            style={viewMode === 'daily' && selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? { gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' } : {}}
                        >
                            <div className="col-span-1 text-[10px] font-black uppercase text-slate-300 tracking-widest text-center self-end pb-2">Hora</div>

                            {/* DAY VIEW HEADERS */}
                            {viewMode === 'daily' && (
                                <>
                                    {/* If All Doctors: Show Doctor Columns */}
                                    {selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? (
                                        DOCTORS.map(doc => {
                                            const colorMap: Record<string, string> = {
                                                'dr-1': 'blue', 'dr-2': 'purple', 'dr-3': 'emerald', 'dr-4': 'rose', 'dr-5': 'amber'
                                            };
                                            const color = colorMap[doc.id] || 'slate';
                                            return (
                                                <div key={doc.id} className={`col-span-3 text-center pb-2 border-b-2 border-${color}-500`}>
                                                    <span className="text-sm font-black text-slate-900 uppercase">{doc.name}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="col-span-7 text-center pb-2 border-b-2 border-blue-500">
                                            <span className="text-sm font-black text-slate-900 uppercase">Hoy</span>
                                        </div>
                                    )}
                                </>
                            )}

                            {/* WEEKLY VIEW HEADERS */}
                            {viewMode === 'weekly' && (
                                Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="col-span-1 text-center pb-2 border-b-2 border-slate-100">
                                        <span className="text-xs font-black text-slate-400 uppercase">{getDayName(currentDate, i)}</span>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Time Slots */}
                        {TIME_SLOTS.map((time) => (
                            <div key={time} className={`grid gap-4 mb-4 group ${viewMode === 'daily' && selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? '' : 'grid-cols-8'}`}
                                style={viewMode === 'daily' && selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? { gridTemplateColumns: 'repeat(16, minmax(0, 1fr))' } : {}}
                            >
                                <div className="col-span-1 text-right pr-6 py-4">
                                    <span className="text-xs font-black text-slate-400 group-hover:text-blue-500 transition-colors">{time}</span>
                                </div>

                                {/* DAILY VIEW SLOTS */}
                                {viewMode === 'daily' && (
                                    <>
                                        {selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? (
                                            DOCTORS.map((doc, idx) => (
                                                <div key={doc.id} className="col-span-3 relative h-24 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all cursor-pointer"
                                                    onClick={() => {
                                                        setActiveSlot({ time, dayIdx: 0 });
                                                        setSelectedDoctorId(doc.id);
                                                        setBookingDoctorId(doc.id);
                                                        setSelectedAppt(null); // Clear selection
                                                        setIsAppointmentModalOpen(true);
                                                    }}
                                                >
                                                    {appointments.filter(a => a.time === time && a.date === currentDate.toISOString().split('T')[0] && a.doctorId === doc.id).map(a => (
                                                        <div
                                                            key={a.id}
                                                            onClick={(e) => handleAppointmentClick(e, a)}
                                                            className={`absolute inset-2 ${getAppointmentColors(a.status)} p-2 rounded-xl text-[10px] font-bold border overflow-hidden leading-tight hover:scale-[1.02] transition-transform cursor-pointer shadow-sm hover:shadow-md`}
                                                        >
                                                            {patients.find(p => p.id === a.patientId)?.name || 'Paciente'}
                                                        </div>
                                                    ))}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="col-span-7 relative h-24 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-300 transition-all group-hover:shadow-lg group-hover:shadow-blue-500/5 flex items-center justify-center cursor-pointer"
                                                onClick={() => {
                                                    setActiveSlot({ time, dayIdx: 0 });
                                                    setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                    setSelectedAppt(null); // Clear selection
                                                    setIsAppointmentModalOpen(true);
                                                }}
                                            >
                                                {/* Show existing appointments */}
                                                {appointments.filter(a => a.time === time && a.date === currentDate.toISOString().split('T')[0] && (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)).map(a => (
                                                    <div
                                                        key={a.id}
                                                        onClick={(e) => handleAppointmentClick(e, a)}
                                                        className={`absolute inset-2 ${getAppointmentColors(a.status)} p-2 rounded-xl text-xs font-bold border flex flex-col justify-center hover:scale-[1.02] transition-transform cursor-pointer shadow-sm hover:shadow-md`}
                                                    >
                                                        <span>{patients.find(p => p.id === a.patientId)?.name || 'Paciente'}</span>
                                                        <span className="text-[10px] opacity-70">
                                                            {typeof a.treatment === 'object' && a.treatment !== null
                                                                ? (a.treatment as any).name || 'Tratamiento'
                                                                : a.treatment || '-'}
                                                        </span>
                                                    </div>
                                                ))}
                                                {/* Empty State Plus */}
                                                {appointments.filter(a => a.time === time && a.date === currentDate.toISOString().split('T')[0] && (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)).length === 0 && (
                                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-blue-500 font-bold text-xs uppercase tracking-wide">
                                                        <Plus size={16} />
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </>
                                )}

                                {/* WEEKLY VIEW SLOTS */}
                                {viewMode === 'weekly' && (
                                    Array.from({ length: 7 }).map((_, i) => {
                                        // Calculate exact date for this cell
                                        const d = new Date(currentDate);
                                        const day = d.getDay();
                                        const diff = d.getDate() - day + (day === 0 ? -6 : 1) + i;
                                        d.setDate(diff);
                                        const dateStr = d.toISOString().split('T')[0];

                                        const cellAppts = appointments.filter(a => a.time === time && a.date === dateStr && (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId));

                                        return (
                                            <div key={i} className="col-span-1 h-24 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 hover:bg-white hover:border-solid hover:border-blue-400 transition-all cursor-pointer relative"
                                                onClick={() => {
                                                    setActiveSlot({ time, dayIdx: i });
                                                    setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                    setSelectedAppt(null); // Clear selection
                                                    setIsAppointmentModalOpen(true);
                                                }}
                                            >
                                                {cellAppts.map(a => (
                                                    <div
                                                        key={a.id}
                                                        onClick={(e) => handleAppointmentClick(e, a)}
                                                        className={`absolute inset-1 ${getAppointmentColors(a.status)} p-1 rounded-lg text-[9px] font-bold border overflow-hidden leading-tight hover:scale-105 transition-transform shadow-sm`}
                                                    >
                                                        {patients.find(p => p.id === a.patientId)?.name?.split(' ')[0] || 'Pct'}
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* APPOINTMENT MODAL */}
            {isAppointmentModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-2xl font-black text-slate-900">{selectedAppt ? 'Detalles Cita' : 'Nueva Cita'}</h3>
                            {selectedAppt && (() => {
                                const patient = patients.find(p => p.id === selectedAppt.patientId);
                                return (
                                    <div className="flex gap-2">
                                        {/* IR A FICHA button */}
                                        <button
                                            onClick={() => {
                                                setIsAppointmentModalOpen(false);
                                                navigate(`/patients`);
                                                // Also set selected patient in context if possible
                                                // For now, just navigate to patients page
                                            }}
                                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-lg transition-all"
                                        >
                                            <User size={16} />
                                            <span>Ir a Ficha</span>
                                        </button>
                                        {/* VER CITA button */}
                                        <button
                                            onClick={() => navigate(`/appointment/${selectedAppt.id}`, {
                                                state: { appointment: selectedAppt, patient }
                                            })}
                                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-lg transition-all"
                                        >
                                            <ExternalLink size={16} />
                                            <span>Ver Cita</span>
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        <p className="text-sm text-slate-500">
                            {activeSlot?.time} - {viewMode === 'daily' ? currentDate.toLocaleDateString() : 'Día ' + activeSlot?.dayIdx}
                        </p>

                        {/* Patient Search in Modal */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400">Paciente</label>
                            <input
                                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold"
                                placeholder="Buscar paciente (Nombre)"
                                value={apptSearch}
                                onChange={(e) => setApptSearch(e.target.value)}
                                disabled={!!selectedAppt} // Readonly if viewing
                            />
                            {/* Suggestions - Solo mostrar si NO hay coincidencia exacta y NO estamos en modo ver */}
                            {!selectedAppt && apptSearch.length > 0 && !patients.find(p => p.name === apptSearch) && (
                                <div className="mt-2 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                    {patients
                                        .filter(p => (p.name?.toLowerCase() || '').includes(apptSearch.toLowerCase()) || (p.dni || '').includes(apptSearch))
                                        .slice(0, 5)
                                        .map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => setApptSearch(p.name)}
                                                className="p-3 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-600 border-b border-slate-50 last:border-0"
                                            >
                                                {p.name}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* Doctor Selection */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400">Doctor</label>
                            <select
                                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                value={bookingDoctorId}
                                onChange={(e) => {
                                    setBookingDoctorId(e.target.value);
                                    setBookingTreatment(''); // Reset treatment when doctor changes
                                }}
                                disabled={!!selectedAppt}
                            >
                                <option value="">Seleccionar Doctor...</option>
                                {DOCTORS.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                                ))}
                            </select>
                        </div>

                        {/* Treatment Selection */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400">Tratamiento</label>
                            <select
                                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                value={bookingTreatment}
                                onChange={(e) => setBookingTreatment(e.target.value)}
                                disabled={!bookingDoctorId || !!selectedAppt}
                            >
                                <option value="">Seleccionar Tratamiento...</option>
                                {DENTAL_SERVICES
                                    .filter(t => {
                                        if (!bookingDoctorId) return true;
                                        const doc = DOCTORS.find(d => d.id === bookingDoctorId);
                                        // Allow General doctors to see General treatments
                                        // Allow Specialists to see ONLY their specialty (or maybe General too? strict: only theirs)
                                        // Let's go strict as requested.
                                        // If Doctor is General, show General.
                                        if (!doc) return true;
                                        return t.specialization === doc.specialization;
                                    })
                                    .map(t => (
                                        <option key={t.id} value={t.id}>{t.name} ({t.price}€)</option>
                                    ))
                                }
                            </select>
                        </div>

                        {/* Additional Details: Price, Duration, Observation */}
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Precio (€)</label>
                                <input
                                    type="number"
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                    value={bookingPrice}
                                    onChange={e => setBookingPrice(Number(e.target.value))}
                                    disabled={!!selectedAppt}
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Duración</label>
                                <select
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                    value={bookingDuration}
                                    onChange={e => setBookingDuration(Number(e.target.value))}
                                    disabled={!!selectedAppt}
                                >
                                    <option value={15}>15 Min</option>
                                    <option value={30}>30 Min</option>
                                    <option value={45}>45 Min</option>
                                    <option value={60}>1 Hora</option>
                                    <option value={90}>1.5 Horas</option>
                                    <option value={120}>2 Horas</option>
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400">Observaciones</label>
                            <textarea
                                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600 h-24 resize-none"
                                placeholder="Notas adicionales..."
                                value={bookingObservation}
                                onChange={e => setBookingObservation(e.target.value)}
                                disabled={!!selectedAppt}
                            />
                        </div>

                        <div className="flex gap-4 pt-4">
                            <button onClick={() => setIsAppointmentModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500">
                                {selectedAppt ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {!selectedAppt && (
                                <button onClick={handleBooking} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg">
                                    Confirmar
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )
            }
        </div >
    );
};

export default Agenda;
