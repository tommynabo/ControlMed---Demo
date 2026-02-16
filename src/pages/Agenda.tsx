import React, { useState, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Plus, Calendar, User, Clock, CheckCircle2, ExternalLink
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { DENTAL_SERVICES, DOCTORS, TIME_SLOTS, DURATION_OPTIONS } from '../constants';
import { Appointment, Doctor } from '../../types';

const Agenda: React.FC = () => {
    const {
        appointments, addAppointment, patients, currentUser, currentUserRole, api, setSelectedPatient
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

    // Budget & Patient State
    const [bookingPatientId, setBookingPatientId] = useState<string>('');
    const [patientBudgets, setPatientBudgets] = useState<any[]>([]);
    const [bookingBudgetId, setBookingBudgetId] = useState<string>('');
    const [bookingBudgetItemId, setBookingBudgetItemId] = useState<string>('');
    const [selectedBudgetItems, setSelectedBudgetItems] = useState<any[]>([]);

    // Fetch Budgets
    React.useEffect(() => {
        if (bookingPatientId) {
            api.budget.getByPatient(bookingPatientId)
                .then(setPatientBudgets)
                .catch(err => console.error(err));
        } else {
            setPatientBudgets([]);
        }
    }, [bookingPatientId]);

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

    // Helper to get appointment color classes based on status and payment
    const getAppointmentColors = (status: string, paid: boolean = false) => {
        const lower = status?.toLowerCase();

        // 🟢 Verde: Realizada y pagada
        if ((lower === 'completed' || lower === 'realizada') && paid) {
            return 'bg-green-100 text-green-700 border-green-200';
        }

        // 🟠 Naranja: Realizada pero no pagada
        if (lower === 'completed' || lower === 'realizada') {
            return 'bg-orange-100 text-orange-700 border-orange-200';
        }

        // 🔴 Rojo tachado: Anulada
        if (lower === 'canceled' || lower === 'cancelled' || lower === 'anulada') {
            return 'bg-red-100 text-red-700 border-red-200 line-through';
        }

        // Amarillo: No vino
        if (lower === 'noshow' || lower === 'no vino') {
            return 'bg-amber-100 text-amber-700 border-amber-200';
        }

        // ⚪ Blanco: Pendiente (Scheduled)
        return 'bg-white text-slate-700 border-slate-200';
    };

    // Handle Click on Existing Appointment
    const handleAppointmentClick = (e: React.MouseEvent, appt: Appointment) => {
        e.stopPropagation();
        setSelectedAppt(appt);

        // Pre-fill modal for viewing details
        const patientName = patients.find(p => p.id === appt.patientId)?.name || '';
        setApptSearch(patientName);
        setBookingPatientId(appt.patientId); // Set Patient ID for budgets
        setBookingDoctorId(appt.doctorId);
        setBookingTreatment(typeof appt.treatment === 'string' ? appt.treatment : (appt.treatment as any)?.id || '');
        setBookingBudgetId((appt as any).budgetId || ''); // Set Budget ID

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

        if (!activeSlot || !bookingPatientId) return;

        // Find Patient using stored bookingPatientId for reliability
        const patient = patients.find(p => p.id === bookingPatientId);
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
            treatmentId: null, // Don't send fake srv-X IDs - backend validates UUID
            budgetId: bookingBudgetId || null,
            budgetItemId: bookingBudgetItemId || null,
            amount: bookingPrice || null,
            observations: bookingObservation || null,
            status: 'Scheduled',
            duration: bookingDuration
        };

        try {
            const createdAppt = await api.appointments.create(newAppt);
            addAppointment(createdAppt);
            setIsAppointmentModalOpen(false);
            setActiveSlot(null);
            setApptSearch('');
            setBookingPatientId('');
            setBookingTreatment('');
            setBookingBudgetId('');
            setBookingBudgetItemId('');
            setSelectedBudgetItems([]);
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

            {/* CALENDAR GRID (COLUMN BASED) */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                <div className="overflow-x-auto pb-4">
                    <div className="min-w-[1000px] relative">
                        {/* HEADERS */}
                        <div className="flex ml-14 mb-4">
                            {viewMode === 'daily' ? (
                                selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? (
                                    DOCTORS.map(doc => (
                                        <div key={doc.id} className="flex-1 text-center pb-2 border-b-2 border-slate-100 font-black text-slate-900 uppercase tracking-wide">
                                            {doc.name}
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex-1 text-center pb-2 border-b-2 border-blue-500 font-black text-slate-900 uppercase">
                                        Hoy
                                    </div>
                                )
                            ) : (
                                Array.from({ length: 7 }).map((_, i) => (
                                    <div key={i} className="flex-1 text-center pb-2 border-b-2 border-slate-100 font-black text-slate-400 uppercase text-xs">
                                        {getDayName(currentDate, i)}
                                    </div>
                                ))
                            )}
                        </div>

                        {/* TIME GRID BACKGROUND & EVENTS LAYER */}
                        <div className="relative">

                            {/* 1. Background Grid (Lines & Times) */}
                            {TIME_SLOTS.map((time, idx) => {
                                const isHourStart = time.endsWith(':00');
                                return (
                                <div key={time} className={`flex h-12 relative group ${isHourStart ? 'border-t-2 border-slate-300' : 'border-t border-slate-200'}`}>
                                    {/* Time Label - only show on hour marks */}
                                    {isHourStart && (
                                    <div className="absolute -left-14 -top-3 w-10 text-right text-xs font-bold text-slate-400 group-hover:text-blue-500 transition-colors">
                                        {time}
                                    </div>
                                    )}

                                    {/* Clickable Slots for New Appt (Invisible overlay) */}
                                    {viewMode === 'daily' ? (
                                        selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? (
                                            DOCTORS.map(doc => (
                                                <div
                                                    key={`${doc.id}-${time}`}
                                                    className="flex-1 h-full border-r border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer z-0"
                                                    onClick={() => {
                                                        setActiveSlot({ time, dayIdx: 0 });
                                                        setSelectedDoctorId(doc.id);
                                                        setBookingDoctorId(doc.id);
                                                        setSelectedAppt(null);
                                                        setIsAppointmentModalOpen(true);
                                                    }}
                                                />
                                            ))
                                        ) : (
                                            <div
                                                className="flex-1 h-full hover:bg-slate-50/50 transition-colors cursor-pointer z-0"
                                                onClick={() => {
                                                    setActiveSlot({ time, dayIdx: 0 });
                                                    setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                    setSelectedAppt(null);
                                                    setIsAppointmentModalOpen(true);
                                                }}
                                            />
                                        )
                                    ) : (
                                        Array.from({ length: 7 }).map((_, dayIdx) => (
                                            <div
                                                key={`day-${dayIdx}-${time}`}
                                                className="flex-1 h-full border-r border-slate-50 hover:bg-slate-50/50 transition-colors cursor-pointer z-0"
                                                onClick={() => {
                                                    setActiveSlot({ time, dayIdx });
                                                    setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                    setSelectedAppt(null);
                                                    setIsAppointmentModalOpen(true);
                                                }}
                                            />
                                        ))
                                    )}
                                </div>
                                );
                            })}

                            {/* 2. Appointments Overlay */}
                            <div className="absolute inset-0 z-10 pointer-events-none flex ml-0">
                                {(() => {
                                    // Each TIME_SLOT = 15 min, rendered as h-12 (3rem = 48px)
                                    const PIXELS_PER_MINUTE = 48 / 15; // 48px per 15-min slot = 3.2 px/min

                                    // Build columns for overlay positioning
                                    const columns = [];

                                    if (viewMode === 'daily') {
                                        if (selectedDoctorId === 'all') {
                                            DOCTORS.forEach(doc => {
                                                const docAppts = appointments.filter(a =>
                                                    (a.date === currentDate.toISOString().split('T')[0] || a.date.startsWith(currentDate.toISOString().split('T')[0])) &&
                                                    a.doctorId === doc.id
                                                );
                                                columns.push(docAppts);
                                            });
                                        } else {
                                            const docAppts = appointments.filter(a =>
                                                (a.date === currentDate.toISOString().split('T')[0] || a.date.startsWith(currentDate.toISOString().split('T')[0])) &&
                                                (a.doctorId === selectedDoctorId || selectedDoctorId === 'all')
                                            );
                                            columns.push(docAppts);
                                        }
                                    } else {
                                        // Weekly
                                        for (let i = 0; i < 7; i++) {
                                            const d = new Date(currentDate);
                                            const day = d.getDay();
                                            const diff = d.getDate() - day + (day === 0 ? -6 : 1) + i;
                                            d.setDate(diff);
                                            const dateStr = d.toISOString().split('T')[0];

                                            const dayAppts = appointments.filter(a =>
                                                (a.date === dateStr || a.date.startsWith(dateStr)) &&
                                                (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
                                            );
                                            columns.push(dayAppts);
                                        }
                                    }

                                    return columns.map((colAppts, colIdx) => {
                                        // Layout Algorithm for Overlaps
                                        // 1. Sort by time
                                        const sorted = [...colAppts].sort((a, b) => a.time.localeCompare(b.time));

                                        // 2. Simple overlap detection
                                        // We will group intersecting events
                                        // This is a simplified version. For robust full calendar, use a library or proper graph coloring.
                                        // Here: simple horizontal stacking.

                                        return (
                                            <div key={colIdx} className="flex-1 relative h-full pointer-events-none border-r border-transparent">
                                                {sorted.map(appt => {
                                                    // Parse time
                                                    const [h, m] = appt.time.split(':').map(Number);
                                                    const startMinutes = h * 60 + m;

                                                    // Start of day (using first slot)
                                                    const [startH, startM] = TIME_SLOTS[0].split(':').map(Number);
                                                    const dayStartMinutes = startH * 60 + startM;

                                                    const offsetMinutes = startMinutes - dayStartMinutes;
                                                    const top = offsetMinutes * PIXELS_PER_MINUTE; // 96px per 60min
                                                    const height = (appt.duration || 30) * PIXELS_PER_MINUTE;

                                                    // Determine width/left based on simplistic overlap
                                                    // Check if it overlaps with ANY previous in this column that hasn't ended
                                                    // Just simple strict offset for now if overlap

                                                    // Actually, let's just render them full width but semi-transparent if simplified,
                                                    // or use z-index.
                                                    // User asked for "side-by-side".

                                                    // Quick Overlap Check
                                                    const overlapping = sorted.filter(a => {
                                                        if (a.id === appt.id) return false;
                                                        const [ah, am] = a.time.split(':').map(Number);
                                                        const aStart = ah * 60 + am;
                                                        const aEnd = aStart + (a.duration || 30);
                                                        const myEnd = startMinutes + (appt.duration || 30);
                                                        return (startMinutes < aEnd && myEnd > aStart);
                                                    });

                                                    let width = '100%';
                                                    let left = '0%';

                                                    if (overlapping.length > 0) {
                                                        // Simple logic: if I overlap, I take half width.
                                                        // If I am later than the one I overlap with, I go right.
                                                        const olderSibling = overlapping.find(o => o.time < appt.time || (o.time === appt.time && o.id < appt.id));
                                                        if (olderSibling) {
                                                            width = '50%';
                                                            left = '50%'; // Shift right
                                                        } else {
                                                            width = overlapping.length > 0 ? '50%' : '100%';
                                                            left = '0%';
                                                        }
                                                    }

                                                    return (
                                                        <div
                                                            key={appt.id}
                                                            onClick={(e) => {
                                                                // Allow clicking
                                                                handleAppointmentClick(e, appt);
                                                            }}
                                                            style={{
                                                                top: `${top}px`,
                                                                height: `${height}px`,
                                                                left,
                                                                width,
                                                                position: 'absolute'
                                                            }}
                                                            className={`
                                                                p-2 rounded-xl text-xs font-bold border shadow-sm cursor-pointer pointer-events-auto transition-all hover:scale-[1.02] hover:z-20 z-10 overflow-hidden flex flex-col justify-start
                                                                ${getAppointmentColors(appt.status, false)}
                                                            `}
                                                        >
                                                            <div className="flex justify-between items-start">
                                                                <span className="truncate">{patients.find(p => p.id === appt.patientId)?.name || 'Paciente'}</span>
                                                                {appt.duration && appt.duration > 45 && <span className="text-[9px] opacity-70 ml-1">{appt.time}</span>}
                                                            </div>
                                                            {appt.duration && appt.duration >= 30 && (
                                                                <span className="text-[10px] opacity-80 truncate mt-1">
                                                                    {typeof appt.treatment === 'object' && appt.treatment !== null
                                                                        ? (appt.treatment as any).name || 'Tratamiento'
                                                                        : appt.treatment || '-'}
                                                                </span>
                                                            )}
                                                            {/* Observations (if tall enough) */}
                                                            {appt.duration && appt.duration >= 60 && (appt as any).observation && (
                                                                <p className="text-[9px] opacity-60 mt-1 line-clamp-2 italic leading-tight">
                                                                    "{(appt as any).observation}"
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            {/* APPOINTMENT MODAL */}
            {isAppointmentModalOpen && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6 animate-in fade-in">
                    <div className="bg-white max-w-lg w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">
                      <div className="p-8 space-y-6 overflow-y-auto flex-1">
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
                                                if (selectedAppt) {
                                                    const patient = patients.find(p => p.id === selectedAppt.patientId);
                                                    if (patient) setSelectedPatient(patient);
                                                }
                                                navigate(`/pacientes`);
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
                                onChange={(e) => {
                                    setApptSearch(e.target.value);
                                    if (bookingPatientId) {
                                        setBookingPatientId('');
                                        setPatientBudgets([]);
                                    }
                                }}
                                disabled={!!selectedAppt} // Readonly if viewing
                            />
                            {/* Suggestions - Solo mostrar si NO hay paciente seleccionado */}
                            {!selectedAppt && apptSearch.length > 0 && !bookingPatientId && (
                                <div className="mt-2 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                                    {patients
                                        .filter(p => (p.name?.toLowerCase() || '').includes(apptSearch.toLowerCase()) || (p.dni || '').includes(apptSearch))
                                        .slice(0, 5)
                                        .map(p => (
                                            <div
                                                key={p.id}
                                                onClick={() => {
                                                    setApptSearch(p.name);
                                                    setBookingPatientId(p.id);
                                                }}
                                                className="p-3 hover:bg-slate-50 cursor-pointer text-xs font-bold text-slate-600 border-b border-slate-50 last:border-0"
                                            >
                                                {p.name}
                                            </div>
                                        ))
                                    }
                                </div>
                            )}
                        </div>

                        {/* Budget Selection (Optional) */}
                        {patientBudgets.length > 0 && (
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Vincular a Presupuesto (Opcional)</label>
                                <select
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                    value={bookingBudgetId}
                                    onChange={(e) => {
                                        const bId = e.target.value;
                                        setBookingBudgetId(bId);
                                        setBookingTreatment('');
                                        setSelectedBudgetItems([]);
                                        setBookingBudgetItemId('');
                                        setBookingPrice(0);
                                    }}
                                    disabled={!!selectedAppt}
                                >
                                    <option value="">-- Sin vincular --</option>
                                    {patientBudgets.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.title || 'Presupuesto'} ({b.total}€) - {new Date(b.date).toLocaleDateString()}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Budget Item Selection (If Budget Selected) - Multi-select */}
                        {bookingBudgetId && (
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Conceptos del Presupuesto</label>
                                <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                                    {patientBudgets.find(b => b.id === bookingBudgetId)?.items.map((item: any, idx: number) => {
                                        const isChecked = selectedBudgetItems.some((si: any) => (si.id || idx.toString()) === (item.id || idx.toString()));
                                        return (
                                            <label key={idx} className="flex items-center gap-2 cursor-pointer hover:bg-white rounded-lg p-1 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded"
                                                    checked={isChecked}
                                                    disabled={!!selectedAppt}
                                                    onChange={() => {
                                                        let newSelected;
                                                        if (isChecked) {
                                                            newSelected = selectedBudgetItems.filter((si: any) => (si.id || '') !== (item.id || idx.toString()));
                                                        } else {
                                                            newSelected = [...selectedBudgetItems, { ...item, _idx: idx }];
                                                        }
                                                        setSelectedBudgetItems(newSelected);
                                                        // Auto-fill treatment names and total price
                                                        setBookingTreatment(newSelected.map((i: any) => i.name).join(', '));
                                                        setBookingPrice(newSelected.reduce((sum: number, i: any) => sum + (i.price || 0), 0));
                                                        setBookingBudgetItemId(newSelected.length > 0 ? (newSelected[0].id || idx.toString()) : '');
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-slate-600 flex-1">{item.name}</span>
                                                <span className="text-xs font-bold text-slate-400">{item.price}€</span>
                                            </label>
                                        );
                                    })}
                                </div>
                                {selectedBudgetItems.length > 0 && (
                                    <div className="mt-2 text-right text-xs font-black text-blue-600">
                                        Total: {selectedBudgetItems.reduce((sum: number, i: any) => sum + (i.price || 0), 0).toFixed(2)}€
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Doctor Selection */}
                        <div>
                            <label className="text-xs font-bold uppercase text-slate-400">Doctor</label>
                            <select
                                className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                value={bookingDoctorId}
                                onChange={(e) => {
                                    setBookingDoctorId(e.target.value);
                                }}
                                disabled={!!selectedAppt}
                            >
                                <option value="">Seleccionar Doctor...</option>
                                {DOCTORS.map(d => (
                                    <option key={d.id} value={d.id}>{d.name} ({d.specialization})</option>
                                ))}
                            </select>
                        </div>

                        {/* Treatment Selection - Only show if NO budget is selected */}
                        {!bookingBudgetId && (
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Tratamiento</label>
                                <select
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                    value={bookingTreatment}
                                    onChange={(e) => {
                                        const tId = e.target.value;
                                        setBookingTreatment(tId);
                                        if (tId) {
                                            const t = DENTAL_SERVICES.find(s => s.id === tId);
                                            if (t) setBookingPrice(t.price);
                                        }
                                    }}
                                    disabled={!!selectedAppt}
                                >
                                    <option value="">Seleccionar Tratamiento...</option>
                                    {DENTAL_SERVICES
                                        .map(t => (
                                            <option key={t.id} value={t.id}>{t.name} ({t.price}€)</option>
                                        ))
                                    }
                                </select>
                            </div>
                        )}

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

                      </div>{/* end scrollable area */}
                      <div className="px-8 pb-8 flex gap-4 pt-4 border-t border-slate-100">
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
