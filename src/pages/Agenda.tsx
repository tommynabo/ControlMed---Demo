import React, { useState, useMemo, useEffect } from 'react';
import {
    ChevronLeft, ChevronRight, Search, Plus, Calendar, User, Clock, CheckCircle2, ExternalLink,
    Lock, Unlock, Eye, EyeOff, Save, X, AlertTriangle, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { DENTAL_SERVICES, TIME_SLOTS, DURATION_OPTIONS } from '../constants';
import { Appointment, Doctor, AgendaClosure } from '../../types';
import toast from 'react-hot-toast';

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
    morning_start: string | null;
    morning_end: string | null;
    afternoon_start: string | null;
    afternoon_end: string | null;
}

const Agenda: React.FC = () => {
    const {
        appointments, addAppointment, setAppointments, patients, currentUser, currentUserRole, api, setSelectedPatient, doctors, refreshAppointments
    } = useAppContext();
    const navigate = useNavigate();

    const [currentDate, setCurrentDate] = useState(new Date());

    const formatDateLocal = (date: Date) => {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    };

    const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('daily');
    const [selectedDoctorId, setSelectedDoctorId] = useState<string>('all');
    const [doctorSchedules, setDoctorSchedules] = useState<DoctorSchedule[]>([]);

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

    // Multi-treatment state
    const [treatmentToAdd, setTreatmentToAdd] = useState<string>('');
    const [selectedTreatmentsList, setSelectedTreatmentsList] = useState<Array<{id: string, name: string, price: number}>>([]);

    // Budget & Patient State
    const [bookingPatientId, setBookingPatientId] = useState<string>('');
    const [patientBudgets, setPatientBudgets] = useState<any[]>([]);
    const [bookingBudgetId, setBookingBudgetId] = useState<string>('');
    const [bookingBudgetItemId, setBookingBudgetItemId] = useState<string>('');
    const [selectedBudgetItems, setSelectedBudgetItems] = useState<any[]>([]);
    const [bookingDate, setBookingDate] = useState<string>(formatDateLocal(new Date()));
    const [bookingTime, setBookingTime] = useState<string>('08:00');

    // Feature 4: Agenda Closures
    const [agendaClosures, setAgendaClosures] = useState<any[]>([]);
    const [showClosureModal, setShowClosureModal] = useState(false);
    const [closureReason, setClosureReason] = useState('');
    const [closureDoctorId, setClosureDoctorId] = useState<string>('');

    // Feature 5: Doctor on-duty filter
    const [showOnDutyOnly, setShowOnDutyOnly] = useState(false);

    // Feature 6: Mini calendar
    const [showMiniCal, setShowMiniCal] = useState(false);
    const [miniCalMonth, setMiniCalMonth] = useState(new Date());

    // Feature 7: Visit details editing
    const [bookingVisitDetails, setBookingVisitDetails] = useState('');
    // Block 3: prevent double booking
    const [isBooking, setIsBooking] = useState(false);

    // Feature 8: Editable duration for existing appointments
    const [isEditingAppt, setIsEditingAppt] = useState(false);

    // Feature 9: Drag & Drop and Resizing
    const [draggingAppt, setDraggingAppt] = useState<Appointment | null>(null);
    const [resizingAppt, setResizingAppt] = useState<Appointment | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState<number>(0);
    const [initialDuration, setInitialDuration] = useState<number>(30);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [dragOverSlot, setDragOverSlot] = useState<{ time: string, drId: string, dayIdx: number } | null>(null);

    // Load Doctor Schedules from Supabase
    useEffect(() => {
        const loadSchedules = async () => {
            try {
                const schedules = await api.doctorSchedules.getAll();
                // Transform time format: "HH:MM:SS" -> "HH:MM" (preserve nulls for disabled shifts)
                const transformed = (schedules || []).map((s: any) => ({
                    ...s,
                    morning_start: s.morning_start ? s.morning_start.slice(0, 5) : null,
                    morning_end: s.morning_end ? s.morning_end.slice(0, 5) : null,
                    afternoon_start: s.afternoon_start ? s.afternoon_start.slice(0, 5) : null,
                    afternoon_end: s.afternoon_end ? s.afternoon_end.slice(0, 5) : null
                }));
                setDoctorSchedules(transformed);
            } catch (err) {
                console.error('Error loading doctor schedules:', err);
            }
        };
        loadSchedules();

        // Reload schedules every 5 seconds to catch changes from Settings
        const interval = setInterval(loadSchedules, 5000);
        return () => clearInterval(interval);
    }, [api]);

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

    // Load Agenda Closures (Feature 4)
    useEffect(() => {
        const loadClosures = async () => {
            try {
                const data = await api.agendaClosures.getAll();
                setAgendaClosures(data || []);
            } catch (err) {
                console.error('Error loading closures:', err);
            }
        };
        loadClosures();
    }, [api]);

    const isDateClosedForDoctor = (date: Date, doctorId?: string): boolean => {
        // Safe local date string format YYYY-MM-DD
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return agendaClosures.some(c => {
            const cDate = typeof c.date === 'string' ? c.date.split('T')[0] : '';
            if (cDate !== dateStr) return false;
            if (!c.doctor_id) return true; // All doctors closed
            return doctorId ? c.doctor_id === doctorId : false;
        });
    };

    const getClosureForDate = (date: Date, doctorId?: string) => {
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return agendaClosures.find(c => {
            const cDate = typeof c.date === 'string' ? c.date.split('T')[0] : '';
            if (cDate !== dateStr) return false;
            if (!c.doctor_id) return true;
            return doctorId ? c.doctor_id === doctorId : false;
        });
    };

    const handleCloseAgenda = async () => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
        try {
            await api.agendaClosures.create({
                date: dateStr,
                doctorId: closureDoctorId || undefined,
                reason: closureReason || 'Agenda cerrada'
            });
            const data = await api.agendaClosures.getAll();
            setAgendaClosures(data || []);
            setShowClosureModal(false);
            setClosureReason('');
            setClosureDoctorId('');
            alert('✅ Agenda cerrada correctamente');
        } catch (e: any) {
            alert('Error: ' + (e.message || e));
        }
    };

    const handleOpenAgenda = async (closureId: string) => {
        try {
            await api.agendaClosures.delete(closureId);
            const data = await api.agendaClosures.getAll();
            setAgendaClosures(data || []);
            alert('✅ Agenda abierta correctamente');
        } catch (e: any) {
            alert('Error: ' + (e.message || e));
        }
    };

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

    // Get available time slots based on doctor's schedule
    const getAvailableTimeSlots = (date: Date, doctorId?: string): string[] => {
        if (!doctorId || doctorId === 'all') return TIME_SLOTS;

        const doctor = doctors.find(d => d.id === doctorId);
        if (!doctor) return TIME_SLOTS;

        // 1. Diccionario exacto sugerido para mapeo local
        const dayMap: Record<number, string> = { 
            0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday', 
            4: 'thursday', 5: 'friday', 6: 'saturday' 
        };

        // 2. Extracción segura del día usando la fecha en formato LOCAL del navegador
        const dayIndex = date.getDay(); 
        const dayKey = dayMap[dayIndex] as keyof DoctorSchedule;

        const doctorNameNorm = doctor.name?.toLowerCase().trim();
        const schedules = doctorSchedules.filter(s =>
            s.doctor_id === doctorId ||
            s.doctor_name?.toLowerCase().trim() === doctorNameNorm
        );
        
        if (schedules.length === 0) return TIME_SLOTS; // Por defecto abierto si no hay horario configurado

        // 3. Filtrado de fragmentos de horario que aplican a hoy
        const activeSchedulesForDay = schedules.filter(s => !!s[dayKey]);
        if (activeSchedulesForDay.length === 0) return []; // Día completamente cerrado para este doctor

        // Filter TIME_SLOTS that fall within available hours of ANY active schedule fragment
        return TIME_SLOTS.filter(slot => {
            const [slotH, slotM] = slot.split(':').map(Number);
            const slotTime = slotH + slotM / 60;

            return activeSchedulesForDay.some(schedule => {
                let inMorning = false;
                let inAfternoon = false;

                // Check morning slot (only if morning start and end times are NOT null)
                if (schedule.morning_start !== null && schedule.morning_end !== null) {
                    const [mStartHour, mStartMin] = schedule.morning_start.split(':').map(Number);
                    const [mEndHour, mEndMin] = schedule.morning_end.split(':').map(Number);
                    const morningStartTime = mStartHour + mStartMin / 60;
                    const morningEndTime = mEndHour + mEndMin / 60;
                    if (slotTime >= morningStartTime && slotTime < morningEndTime) inMorning = true;
                }

                // Check afternoon slot (only if afternoon start and end times are NOT null)
                if (schedule.afternoon_start !== null && schedule.afternoon_end !== null) {
                    const [aStartHour, aStartMin] = schedule.afternoon_start.split(':').map(Number);
                    const [aEndHour, aEndMin] = schedule.afternoon_end.split(':').map(Number);
                    const afternoonStartTime = aStartHour + aStartMin / 60;
                    const afternoonEndTime = aEndHour + aEndMin / 60;
                    if (slotTime >= afternoonStartTime && slotTime < afternoonEndTime) inAfternoon = true;
                }

                return inMorning || inAfternoon;
            });
        });
    };

    // Feature 5: Filter doctors working today (must be AFTER getAvailableTimeSlots)
    const doctorsOnDuty = useMemo(() => {
        if (!showOnDutyOnly) return doctors;
        const dateStr = formatDateLocal(currentDate);
        return doctors.filter(doc => {
            const slots = getAvailableTimeSlots(currentDate, doc.id);
            // Always keep doctors who have appointments on this day, even if schedule is "off"
            const hasApptToday = appointments.some(a =>
                (a.date === dateStr || a.date.startsWith(dateStr)) && a.doctorId === doc.id
            );
            return (slots.length > 0 || hasApptToday) && !isDateClosedForDoctor(currentDate, doc.id);
        });
    }, [doctors, showOnDutyOnly, currentDate, doctorSchedules, agendaClosures, appointments]);


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

        // Fucsia/Morado: No vino
        if (lower === 'noshow' || lower === 'no vino') {
            return 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200';
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
        setBookingPrice((appt as any).amount || 0);
        setBookingDuration(appt.duration || 30);
        setBookingObservation(appt.observations || '');
        setBookingVisitDetails((appt as any).visitDetails || '');
        setIsEditingAppt(false);

        // Load budget items if a budget is linked
        if ((appt as any).budgetId) {
            const budget = patientBudgets.find(b => b.id === (appt as any).budgetId);
            if (budget && budget.items) {
                if ((appt as any).budgetItemId) {
                    const selectedItems = budget.items.filter((item: any) => item.id === (appt as any).budgetItemId);
                    setSelectedBudgetItems(selectedItems);
                } else {
                    setSelectedBudgetItems([]);
                }
            }
        } else {
            setSelectedBudgetItems([]);
        }

        const dateObj = new Date(appt.date);
        setBookingDate(formatDateLocal(dateObj));
        setBookingTime(appt.time);
        setActiveSlot({ time: appt.time, dayIdx: 0 }); // Visual context
        setIsAppointmentModalOpen(true);
    };

    // Reset form fields for a new appointment
    const resetAppointmentForm = () => {
        setApptSearch('');
        setBookingPatientId('');
        setBookingTreatment('');
        setBookingDoctorId('');
        setBookingBudgetId('');
        setBookingBudgetItemId('');
        setSelectedBudgetItems([]);
        setBookingObservation('');
        setBookingVisitDetails('');
        setBookingPrice(0);
        setBookingDuration(30);
        setSelectedTreatmentsList([]);
        setTreatmentToAdd('');
        setPatientBudgets([]);
        setIsEditingAppt(false);
        setIsDuplicating(false);
        setBookingDate(formatDateLocal(currentDate));
        setBookingTime('08:00');
    };

    // Multi-treatment handlers
    const handleAddTreatmentToList = () => {
        if (!treatmentToAdd) return;
        const svc = DENTAL_SERVICES.find(s => s.id === treatmentToAdd);
        if (!svc) return;

        let itemsToAdd: any[] = [];
        if (svc.id === 'pack-1') {
            itemsToAdd = [
                { id: 'srv-11', name: 'Primera visita', price: 0 },
                { id: 'srv-12', name: 'OPG', price: 45 }
            ];
        } else if (svc.id === 'pack-2') {
            itemsToAdd = [
                { id: 'srv-11', name: 'Primera visita', price: 0 },
                { id: 'srv-12', name: 'OPG', price: 15 },
                { id: 'srv-13', name: 'Tartrectomía', price: 45 }
            ];
        } else {
            itemsToAdd = [{ id: svc.id, name: svc.name, price: svc.price }];
        }

        const newList = [...selectedTreatmentsList, ...itemsToAdd];
        setSelectedTreatmentsList(newList);
        setBookingPrice(newList.reduce((sum, t) => sum + t.price, 0));
        setTreatmentToAdd('');
    };

    const handleRemoveTreatmentFromList = (idx: number) => {
        const newList = selectedTreatmentsList.filter((_, i) => i !== idx);
        setSelectedTreatmentsList(newList);
        setBookingPrice(newList.reduce((sum, t) => sum + t.price, 0));
    };

    // Handle Booking
    const handleBooking = async () => {
        if (isBooking) return;
        if (selectedAppt) {
            // Update logic here if requested...
            alert("Modo edición no implementado completamente.");
            return;
        }
        
        // Validate patient selected from dropdown
        if (!bookingPatientId) {
            alert("Por favor selecciona un paciente de la lista de sugerencias.");
            return;
        }

        // Validate date and time
        if (!bookingDate || !bookingTime) {
            alert("Por favor completa la Fecha y la Hora.");
            return;
        }

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

        // Warn if slot is outside doctor's schedule, but allow saving
        const dateToSave = new Date(`${bookingDate}T00:00:00`);

        const availableSlots = getAvailableTimeSlots(dateToSave, bookingDoctorId);
        if (!availableSlots.includes(bookingTime)) {
            const confirm = window.confirm(
                "⚠️ Este horario está fuera del horario configurado para este doctor.\n\n¿Deseas guardar la cita de todas formas?"
            );
            if (!confirm) return;
        }

        // Force date to be treated as UTC midnight of the selected day to avoid timezone shifts
        const isoDate = `${bookingDate}T00:00:00.000Z`;

        const newAppt: any = {
            date: isoDate, // Send full ISO at UTC midnight
            time: bookingTime,
            patientId: patient.id,
            doctorId: bookingDoctorId,
            treatmentId: !bookingBudgetId && selectedTreatmentsList.length > 0 ? selectedTreatmentsList[0].id : null,
            treatmentName: !bookingBudgetId && selectedTreatmentsList.length > 0
                ? selectedTreatmentsList.map(t => t.name).join(', ')
                : null,
            treatmentIds: !bookingBudgetId && selectedTreatmentsList.length > 1
                ? selectedTreatmentsList.map(t => t.id)
                : null,
            budgetId: bookingBudgetId || null,
            budgetItemId: bookingBudgetItemId || null,
            budgetItemIds: selectedBudgetItems.length > 0 ? selectedBudgetItems.map(item => item.id || item._idx) : null,
            amount: bookingPrice || null,
            observations: bookingObservation || null,
            visitDetails: bookingVisitDetails || null,
            status: 'Scheduled',
            duration: bookingDuration
        };

        try {
            setIsBooking(true);
            const createdAppt = await api.appointments.create(newAppt);
            // Refrescar datos globales
            await refreshAppointments();
            
            setIsAppointmentModalOpen(false);
            setActiveSlot(null);
            setApptSearch('');
            setBookingPatientId('');
            setBookingTreatment('');
            setBookingDoctorId('');
            setBookingBudgetId('');
            setBookingBudgetItemId('');
            setSelectedBudgetItems([]);
            setBookingObservation('');
            setBookingVisitDetails('');
            setBookingPrice(0);
            setBookingDuration(30);
            toast.success("Cita guardada correctamente.");
        } catch (e: any) {
            console.error(e);
            toast.error("Error al guardar la cita: " + (e.message || e));
        } finally {
            setIsBooking(false);
        }
    };

    // DRAG & DROP HANDLERS

    const handleDragStart = (e: React.DragEvent, appt: Appointment) => {
        if (currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') {
            e.preventDefault();
            return;
        }
        setDraggingAppt(appt);
        e.dataTransfer.setData('apptId', appt.id);
        e.dataTransfer.effectAllowed = 'move';
        
        // Hide ghost image by setting a transparent one if desired, 
        // or just let the default ghost happen.
    };

    const handleDrop = async (e: React.DragEvent, time: string, drId: string, dayIdx: number) => {
        e.preventDefault();
        if (!draggingAppt) return;

        let targetDate = currentDate;
        if (viewMode === 'weekly') {
            const dow = currentDate.getDay();
            const diff = currentDate.getDate() - dow + (dow === 0 ? -6 : 1) + dayIdx;
            targetDate = new Date(currentDate);
            targetDate.setDate(diff);
        }

        const dateStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}T00:00:00.000Z`;

        try {
            const updated = await api.appointments.update(draggingAppt.id, {
                date: dateStr,
                time: time,
                doctorId: drId || draggingAppt.doctorId
            });

            setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
        } catch (err: any) {
            alert("Error al mover la cita: " + (err.message || err));
        } finally {
            setDraggingAppt(null);
            setDragOverSlot(null);
        }
    };

    const handleDragOver = (e: React.DragEvent, time: string, drId: string, dayIdx: number) => {
        e.preventDefault();
        if (draggingAppt) {
            if (dragOverSlot?.time !== time || dragOverSlot?.drId !== drId || dragOverSlot?.dayIdx !== dayIdx) {
                setDragOverSlot({ time, drId, dayIdx });
            }
        }
    };

    // RESIZE HANDLERS
    const handleResizeStart = (e: React.MouseEvent, appt: Appointment) => {
        e.stopPropagation();
        e.preventDefault();
        if (currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') return;

        setResizingAppt(appt);
        setResizeStartPos(e.pageY);
        setInitialDuration(appt.duration || 30);

        const onMouseMove = (moveEv: MouseEvent) => {
            // Calculated in the render overlay for preview if needed, 
            // but let's just do it on end for simplicity or update live.
        };

        const onMouseUp = async (upEv: MouseEvent) => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);

            const deltaY = upEv.pageY - e.pageY;
            const SLOT_H = 16; // 5-minute slot height
            const deltaMins = Math.round(deltaY / SLOT_H) * 5;
            const newDuration = Math.max(5, (appt.duration || 30) + deltaMins);

            if (newDuration !== appt.duration) {
                try {
                    const updated = await api.appointments.update(appt.id, {
                        duration: newDuration
                    });
                    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a));
                } catch (err: any) {
                    alert("Error al cambiar la duración: " + (err.message || err));
                }
            }
            setResizingAppt(null);
        };

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    };

    const handlePackPrimeraVisita = () => {
        const pack = [
            { id: 'srv-11', name: 'Primera visita', price: 0 },
            { id: 'srv-12', name: 'OPG', price: 30 },
            { id: 'srv-13', name: 'Tartrectomía', price: 50 }
        ];
        setSelectedTreatmentsList(pack);
        setBookingPrice(80);
        setBookingDuration(60);
    };

    const handleDuplicate = () => {
        if (!selectedAppt) return;
        
        // Mantener datos pero permitir editar fecha/hora
        const patientName = patients.find(p => p.id === selectedAppt.patientId)?.name || '';
        const doctorId = selectedAppt.doctorId;
        const treatment = typeof selectedAppt.treatment === 'string' ? selectedAppt.treatment : (selectedAppt.treatment as any)?.id || '';
        const price = (selectedAppt as any).amount || 0;
        const duration = selectedAppt.duration || 30;
        const observations = selectedAppt.observations || '';
        
        const dateObj = new Date(selectedAppt.date);
        setBookingDate(formatDateLocal(dateObj));
        setBookingTime(selectedAppt.time);

        setApptSearch(patientName);
        setBookingPatientId(selectedAppt.patientId);
        setBookingDoctorId(doctorId);
        setBookingTreatment(treatment);
        setBookingPrice(price);
        setBookingDuration(duration);
        setBookingObservation(observations);
        
        setIsDuplicating(true);
        setSelectedAppt(null); // Switch to "New" mode visually
        setActiveSlot(null);
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header ... */}
            <div className="flex flex-wrap justify-between items-center gap-6 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="min-w-[200px]">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Agenda Médica</h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                        {viewMode === 'daily' ? currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : getWeekRange(currentDate)}
                    </p>
                </div>

                <div className="flex gap-4 items-center flex-wrap justify-end">
                    {/* DOCTOR SELECTOR (ADMIN / RECEPTION) */}
                    {(currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') && (
                        <div className="bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                            <select
                                value={selectedDoctorId}
                                onChange={(e) => setSelectedDoctorId(e.target.value)}
                                className="bg-white text-xs font-bold uppercase text-slate-900 outline-none px-2 py-2 cursor-pointer rounded-lg"
                                style={{ colorScheme: 'light' }}
                            >
                                <option value="all">Vista General (Todos)</option>
                                {doctors.map(doc => (
                                    <option key={doc.id} value={doc.id}>{doc.name}</option>
                                ))}
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

            {/* MINI CALENDAR WIDGET (Feature 6) */}
            {showMiniCal && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-5 animate-in slide-in-from-top-4">
                    <div className="flex items-center justify-between mb-3">
                        <button onClick={() => { const m = new Date(miniCalMonth); m.setMonth(m.getMonth() - 1); setMiniCalMonth(m); }} className="p-1 hover:bg-slate-50 rounded-lg">
                            <ChevronLeft size={16} />
                        </button>
                        <span className="text-sm font-black text-slate-700 uppercase">
                            {miniCalMonth.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
                        </span>
                        <button onClick={() => { const m = new Date(miniCalMonth); m.setMonth(m.getMonth() + 1); setMiniCalMonth(m); }} className="p-1 hover:bg-slate-50 rounded-lg">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center">
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                            <div key={d} className="text-[10px] font-bold text-slate-400 py-1">{d}</div>
                        ))}
                        {(() => {
                            const year = miniCalMonth.getFullYear();
                            const month = miniCalMonth.getMonth();
                            const firstDay = new Date(year, month, 1).getDay();
                            const daysInMonth = new Date(year, month + 1, 0).getDate();
                            const offset = firstDay === 0 ? 6 : firstDay - 1;
                            const cells = [];
                            for (let i = 0; i < offset; i++) cells.push(<div key={`e-${i}`} />);
                            const today = new Date();
                            for (let d = 1; d <= daysInMonth; d++) {
                                const cellDate = new Date(year, month, d);
                                const isToday = cellDate.toDateString() === today.toDateString();
                                const isSelected = cellDate.toDateString() === currentDate.toDateString();
                                cells.push(
                                    <button
                                        key={d}
                                        onClick={() => {
                                            setCurrentDate(cellDate);
                                            setViewMode('daily');
                                            setShowMiniCal(false);
                                        }}
                                        className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${isSelected ? 'bg-slate-900 text-white' :
                                            isToday ? 'bg-blue-100 text-blue-700' :
                                                'text-slate-600 hover:bg-slate-50'
                                            }`}
                                    >
                                        {d}
                                    </button>
                                );
                            }
                            return cells;
                        })()}
                    </div>
                </div>
            )}

            {/* CONTROLS BAR (Features 4, 5, 6) */}
            <div className="flex items-center gap-3 flex-wrap">
                {/* Mini Calendar Toggle (Feature 6) */}
                <button
                    onClick={() => { setShowMiniCal(!showMiniCal); setMiniCalMonth(new Date(currentDate)); }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${showMiniCal ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                        }`}
                >
                    <Calendar size={14} /> Calendario
                </button>

                {/* Doctor On-Duty Filter (Feature 5) */}
                {viewMode === 'daily' && (
                    <button
                        onClick={() => setShowOnDutyOnly(!showOnDutyOnly)}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all border ${showOnDutyOnly ? 'bg-emerald-50 text-emerald-700 border-emerald-200 shadow-sm' : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                            }`}
                    >
                        {showOnDutyOnly ? <Eye size={14} /> : <EyeOff size={14} />}
                        {showOnDutyOnly ? '✅ Solo doctores en turno' : 'Ver todos los doctores'}
                    </button>
                )}

                {/* Agenda Closure Controls (Feature 4) */}
                {(() => {
                    const closure = getClosureForDate(currentDate);
                    if (closure) {
                        return (
                            <button
                                onClick={() => handleOpenAgenda(closure.id)}
                                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-all"
                            >
                                <Unlock size={14} /> Abrir Agenda
                            </button>
                        );
                    }
                    return (
                        <button
                            onClick={() => setShowClosureModal(true)}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:border-red-300 hover:text-red-600 transition-all"
                        >
                            <Lock size={14} /> Cerrar Agenda
                        </button>
                    );
                })()}

                {/* Day closed banner */}
                {isDateClosedForDoctor(currentDate) && (
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200">
                        <AlertTriangle size={14} /> AGENDA CERRADA
                        {getClosureForDate(currentDate)?.reason && (
                            <span className="text-red-500"> — {getClosureForDate(currentDate)?.reason}</span>
                        )}
                    </div>
                )}
            </div>

            {/* Closure Modal (Feature 4) */}
            {showClosureModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-5">
                        <h3 className="text-xl font-black text-slate-900">Cerrar Agenda</h3>
                        <p className="text-xs text-slate-400">
                            Fecha: <strong>{currentDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</strong>
                        </p>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-2">Doctor (vacío = todos)</label>
                            <select
                                value={closureDoctorId}
                                onChange={(e) => setClosureDoctorId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                            >
                                <option value="">Todos los doctores</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-2">Motivo (opcional)</label>
                            <input
                                type="text"
                                value={closureReason}
                                onChange={(e) => setClosureReason(e.target.value)}
                                placeholder="Ej: Festivo, vacaciones..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowClosureModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500">
                                Cancelar
                            </button>
                            <button onClick={handleCloseAgenda} className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors">
                                Cerrar Agenda
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CALENDAR GRID (COLUMN BASED) */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
                <div className="overflow-x-auto pb-4">
                    <div className="flex">
                        {/* TIME COLUMN - Always visible */}
                        <div className="w-16 flex-shrink-0 pr-4 sticky left-0 bg-white z-[5] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            <div className="h-[48px] mb-4 flex items-end pb-2 ml-2 font-bold text-xs text-slate-400">Hora</div>
                            {TIME_SLOTS.map((time, idx) => {
                                const hour = parseInt(time.split(':')[0], 10);
                                // Render on the start of each hour (every 12 slots of 5 mins)
                                if (idx % 12 === 0) {
                                    return (
                                        <div key={`time-label-${time}`} className="h-[192px] relative border-t-2 border-slate-300">
                                            <span className="absolute -top-[10px] left-0 w-full text-center pr-2 text-[11px] font-black text-slate-500 bg-white">
                                                {hour}:00
                                            </span>
                                        </div>
                                    );
                                }
                                return null;
                            })}
                        </div>

                        {/* SCHEDULER GRID */}
                        <div className="flex-1 relative overflow-visible">
                            <div className="w-max min-w-full relative">
                                {/* HEADERS */}
                                <div className="flex h-[48px] mb-4 min-w-max">
                                    {viewMode === 'daily' ? (
                                        selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION') ? (
                                            doctorsOnDuty.map(doc => (
                                                <div key={doc.id} className={`min-w-[180px] flex-1 text-center pb-2 border-b-2 font-black uppercase tracking-wide text-xs flex items-center justify-center px-3 whitespace-nowrap ${isDateClosedForDoctor(currentDate, doc.id) ? 'border-red-300 text-red-400 line-through' : 'border-slate-100 text-slate-900'
                                                    }`}>
                                                    {doc.name}
                                                </div>
                                            ))
                                        ) : (
                                            <div className="flex-1 text-center pb-2 border-b-2 border-blue-500 font-black text-slate-900 uppercase flex items-center justify-center">
                                                {(selectedDoctorId && selectedDoctorId !== 'all' ? doctors.find(d => d.id === selectedDoctorId)?.name : 'Hoy')}
                                            </div>
                                        )
                                    ) : (
                                        Array.from({ length: 7 }).map((_, i) => (
                                            <div key={i} className="min-w-[140px] flex-1 text-center pb-2 border-b-2 border-slate-100 font-black text-slate-400 uppercase text-xs flex items-center justify-center">
                                                {getDayName(currentDate, i)}
                                            </div>
                                        ))
                                    )}
                                </div>

                                {/* TIME GRID BACKGROUND & EVENTS LAYER */}
                                <div className="relative">

                                    {/* ═══════ GRID RENDERING ═══════ */}
                                    {(() => {
                                        const SLOT_H = 16; // h-4 = 16px

                                        // ── CASE A: Daily + specific doctor → merged blocks ──
                                        if (viewMode === 'daily' && selectedDoctorId && selectedDoctorId !== 'all') {
                                            const availableSlots = getAvailableTimeSlots(currentDate, selectedDoctorId);

                                            // If entire day is off
                                            if (availableSlots.length === 0) {
                                                return (
                                                    <div style={{ height: `${TIME_SLOTS.length * SLOT_H}px` }}
                                                        className="flex items-center justify-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                                                        <div className="text-center">
                                                            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                                                            <p className="text-sm font-bold text-slate-400">Día libre</p>
                                                            <p className="text-xs text-slate-300 mt-1">Este doctor no trabaja hoy</p>
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // Build render plan: merge consecutive blocked slots
                                            type PlanItem = { kind: 'block'; count: number } | { kind: 'slot'; time: string };
                                            const plan: PlanItem[] = [];
                                            let blockCount = 0;

                                            for (const slot of TIME_SLOTS) {
                                                if (availableSlots.includes(slot)) {
                                                    if (blockCount > 0) {
                                                        plan.push({ kind: 'block', count: blockCount });
                                                        blockCount = 0;
                                                    }
                                                    plan.push({ kind: 'slot', time: slot });
                                                } else {
                                                    blockCount++;
                                                }
                                            }
                                            if (blockCount > 0) plan.push({ kind: 'block', count: blockCount });

                                            return plan.map((item, idx) => {
                                                if (item.kind === 'block') {
                                                    return (
                                                        <div key={`blk-${idx}`}
                                                            style={{ height: `${item.count * SLOT_H}px` }}
                                                            className="flex relative border-t border-slate-100">
                                                            <div className="flex-1 bg-slate-50/80 flex items-center justify-center">
                                                                <span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest select-none">
                                                                    Sin consulta
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                const t = item.time;
                                                const isQuarter = t.endsWith(':00') || t.endsWith(':15') || t.endsWith(':30') || t.endsWith(':45');
                                                const hourStart = t.endsWith(':00');
                                                return (
                                                    <div key={t} 
                                                        onDragOver={(e) => handleDragOver(e, t, selectedDoctorId, 0)}
                                                        onDragLeave={() => setDragOverSlot(null)}
                                                        onDrop={(e) => handleDrop(e, t, selectedDoctorId, 0)}
                                                        className={`flex h-4 relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`}>
                                                        
                                                        {dragOverSlot?.time === t && draggingAppt && (
                                                            <div 
                                                                style={{ height: `${(draggingAppt.duration / 5) * SLOT_H}px` }}
                                                                className="absolute top-0 left-0 right-0 bg-purple-500/20 border-2 border-purple-500 border-dashed rounded-lg z-10 pointer-events-none flex items-center justify-center"
                                                            >
                                                                <span className="text-[10px] font-bold text-purple-700 uppercase">Mover aquí</span>
                                                            </div>
                                                        )}

                                                        <div
                                                            className="flex-1 h-full hover:bg-purple-50/30 cursor-pointer transition-colors z-0"
                                                            onClick={() => {
                                                                if (currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') return;
                                                                if (!isDuplicating) resetAppointmentForm();
                                                                setIsDuplicating(false);
                                                                
                                                                const dayOffset = 0;
                                                                const d = new Date(currentDate);
                                                                setBookingDate(formatDateLocal(d));
                                                                setBookingTime(t);

                                                                setActiveSlot({ time: t, dayIdx: 0 });
                                                                setBookingDoctorId(selectedDoctorId);
                                                                setSelectedAppt(null);
                                                                setIsAppointmentModalOpen(true);
                                                            }}
                                                        />
                                                    </div>
                                                );
                                            });
                                        }

                                        // ── CASE B: Daily + all doctors (admin multi-column) ──
                                        if (viewMode === 'daily' && selectedDoctorId === 'all' && (currentUserRole === 'ADMIN' || currentUserRole === 'RECEPTION')) {
                                            const activeDoctors = doctorsOnDuty;
                                            return TIME_SLOTS.map(time => {
                                                const isQuarter = time.endsWith(':00') || time.endsWith(':15') || time.endsWith(':30') || time.endsWith(':45');
                                                const hourStart = time.endsWith(':00');
                                                return (
                                                    <div key={time} className={`flex h-4 relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`}>
                                                        {activeDoctors.map(doc => {
                                                            const ok = getAvailableTimeSlots(currentDate, doc.id).includes(time);
                                                            const closed = isDateClosedForDoctor(currentDate, doc.id);
                                                            return (
                                                                <div key={`${doc.id}-${time}`}
                                                                    onDragOver={(e) => handleDragOver(e, time, doc.id, 0)}
                                                                    onDragLeave={() => setDragOverSlot(null)}
                                                                    onDrop={(e) => handleDrop(e, time, doc.id, 0)}
                                                                    className={`min-w-[180px] flex-1 h-full border-r border-slate-50 transition-colors relative z-0 ${ok && !closed && currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' ? 'hover:bg-slate-50/50 cursor-pointer' : 'bg-slate-100/60'}`}
                                                                    onClick={() => {
                                                                        if (!ok || closed || currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') return;
                                                                        if (!isDuplicating) resetAppointmentForm();
                                                                        setIsDuplicating(false);
                                                                        
                                                                        setBookingDate(formatDateLocal(currentDate));
                                                                        setBookingTime(time);

                                                                        setActiveSlot({ time, dayIdx: 0 });
                                                                        setSelectedDoctorId(doc.id);
                                                                        setBookingDoctorId(doc.id);
                                                                        setSelectedAppt(null);
                                                                        setIsAppointmentModalOpen(true);
                                                                    }}
                                                                >
                                                                    {dragOverSlot?.time === time && dragOverSlot?.drId === doc.id && draggingAppt && (
                                                                        <div 
                                                                            style={{ height: `${(draggingAppt.duration / 5) * SLOT_H}px` }}
                                                                            className="absolute top-0 left-0 right-0 bg-blue-500/20 border-2 border-blue-500 border-dashed rounded-lg z-10 pointer-events-none flex items-center justify-center"
                                                                        >
                                                                            <span className="text-[10px] font-black text-blue-700 uppercase">Soltar</span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                );
                                            });
                                        }

                                        // ── CASE C: Daily + single column (no specific doctor / non-admin) ──
                                        if (viewMode === 'daily') {
                                            return TIME_SLOTS.map(time => {
                                                const isQuarter = time.endsWith(':00') || time.endsWith(':15') || time.endsWith(':30') || time.endsWith(':45');
                                                const hourStart = time.endsWith(':00');
                                                return (
                                                    <div key={time} className={`flex h-4 relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`}>
                                                        <div 
                                                            onDragOver={(e) => handleDragOver(e, time, selectedDoctorId === 'all' ? '' : selectedDoctorId, 0)}
                                                            onDragLeave={() => setDragOverSlot(null)}
                                                            onDrop={(e) => handleDrop(e, time, selectedDoctorId === 'all' ? '' : selectedDoctorId, 0)}
                                                            className={`flex-1 h-full transition-colors relative z-0 ${currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' ? 'hover:bg-slate-50/50 cursor-pointer' : ''}`}
                                                            onClick={() => {
                                                                if (currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') return;
                                                                if (!isDuplicating) resetAppointmentForm();
                                                                setIsDuplicating(false);

                                                                setBookingDate(formatDateLocal(currentDate));
                                                                setBookingTime(time);

                                                                setActiveSlot({ time, dayIdx: 0 });
                                                                setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                                setSelectedAppt(null);
                                                                setIsAppointmentModalOpen(true);
                                                            }}
                                                        >
                                                            {dragOverSlot?.time === time && draggingAppt && (
                                                                <div 
                                                                    style={{ height: `${(draggingAppt.duration / 5) * SLOT_H}px` }}
                                                                    className="absolute top-0 left-0 right-0 bg-slate-500/10 border-2 border-slate-400 border-dashed rounded-lg z-10 pointer-events-none flex items-center justify-center"
                                                                >
                                                                    <div className="bg-white/80 px-2 py-0.5 rounded shadow-sm">
                                                                        <span className="text-[10px] font-bold text-slate-600 uppercase">Cambiar a {time}</span>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            });
                                        }

                                        // ── CASE D: Weekly view ──
                                        return TIME_SLOTS.map(time => {
                                            const isQuarter = time.endsWith(':00') || time.endsWith(':15') || time.endsWith(':30') || time.endsWith(':45');
                                            const hourStart = time.endsWith(':00');
                                            return (
                                                <div key={time} className={`flex h-4 relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`}>
                                                    {Array.from({ length: 7 }).map((_, dayIdx) => {
                                                        const d = new Date(currentDate);
                                                        const dow = d.getDay();
                                                        const diff = d.getDate() - dow + (dow === 0 ? -6 : 1) + dayIdx;
                                                        d.setDate(diff);
                                                        const ds = formatDateLocal(d);
                                                        const ok = selectedDoctorId !== 'all'
                                                            ? getAvailableTimeSlots(d, selectedDoctorId).includes(time)
                                                            : true;
                                                        return (
                                                            <div key={`w-${dayIdx}-${time}`}
                                                                onDragOver={(e) => handleDragOver(e, time, selectedDoctorId === 'all' ? '' : selectedDoctorId, dayIdx)}
                                                                onDragLeave={() => setDragOverSlot(null)}
                                                                onDrop={(e) => handleDrop(e, time, selectedDoctorId === 'all' ? '' : selectedDoctorId, dayIdx)}
                                                                className={`min-w-[140px] flex-1 h-full border-r border-slate-50 transition-colors relative z-0 ${ok && currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' ? 'hover:bg-slate-50/50 cursor-pointer' : 'bg-slate-50/30'}`}
                                                                onClick={() => {
                                                                    if (!ok || currentUserRole === 'DOCTOR' || currentUserRole === 'AUXILIAR') return;
                                                                    if (!isDuplicating) resetAppointmentForm();
                                                                    setIsDuplicating(false);

                                                                    const d = new Date(currentDate);
                                                                    const dow = d.getDay();
                                                                    const diff = d.getDate() - dow + (dow === 0 ? -6 : 1) + dayIdx;
                                                                    d.setDate(diff);
                                                                    setBookingDate(formatDateLocal(d));
                                                                    setBookingTime(time);

                                                                    setActiveSlot({ time, dayIdx });
                                                                    setBookingDoctorId(selectedDoctorId === 'all' ? '' : selectedDoctorId);
                                                                    setSelectedAppt(null);
                                                                    setIsAppointmentModalOpen(true);
                                                                }}
                                                            >
                                                                {dragOverSlot?.time === time && dragOverSlot?.dayIdx === dayIdx && draggingAppt && (
                                                                    <div 
                                                                        style={{ height: `${(draggingAppt.duration / 5) * SLOT_H}px` }}
                                                                        className="absolute top-0 left-0 right-0 bg-emerald-500/20 border-2 border-emerald-500 border-dashed rounded-lg z-10 pointer-events-none flex items-center justify-center shadow-lg"
                                                                    >
                                                                        <span className="text-[10px] font-black text-emerald-700 uppercase">Reprogramar</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        });
                                    })()}

                                    {/* ═══════ APPOINTMENTS OVERLAY ═══════ */}
                                    <div className="absolute inset-0 z-10 pointer-events-none flex ml-0">
                                        {(() => {
                                            const SLOT_H = 16; // h-4 = 16px
                                            const PX_PER_MIN = SLOT_H / 5; // 3.2

                                            // Convert time → pixel top using slot index (handles the 13:45→16:00 gap correctly)
                                            const timeToTop = (t: string): number => {
                                                const idx = TIME_SLOTS.indexOf(t);
                                                if (idx >= 0) return idx * SLOT_H;
                                                // Interpolate if time is between slots
                                                const [h, m] = t.split(':').map(Number);
                                                const mins = h * 60 + m;
                                                for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
                                                    const [sh, sm] = TIME_SLOTS[i].split(':').map(Number);
                                                    const [nh, nm] = TIME_SLOTS[i + 1].split(':').map(Number);
                                                    if (mins >= sh * 60 + sm && mins < nh * 60 + nm) {
                                                        return (i + (mins - (sh * 60 + sm)) / 5) * SLOT_H;
                                                    }
                                                }
                                                return (TIME_SLOTS.length - 1) * SLOT_H;
                                            };

                                            // Build columns
                                            const columns: Appointment[][] = [];

                                            if (viewMode === 'daily') {
                                                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                                                if (selectedDoctorId === 'all') {
                                                    doctorsOnDuty.forEach(doc => {
                                                        columns.push(appointments.filter(a =>
                                                            (a.date === dateStr || a.date.startsWith(dateStr)) && a.doctorId === doc.id
                                                        ));
                                                    });
                                                } else {
                                                    columns.push(appointments.filter(a =>
                                                        (a.date === dateStr || a.date.startsWith(dateStr)) &&
                                                        (a.doctorId === selectedDoctorId || selectedDoctorId === 'all')
                                                    ));
                                                }
                                            } else {
                                                for (let i = 0; i < 7; i++) {
                                                    const d = new Date(currentDate);
                                                    const dow = d.getDay();
                                                    const diff = d.getDate() - dow + (dow === 0 ? -6 : 1) + i;
                                                    d.setDate(diff);
                                                    const ds = formatDateLocal(d);
                                                    columns.push(appointments.filter(a =>
                                                        (a.date === ds || a.date.startsWith(ds)) &&
                                                        (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
                                                    ));
                                                }
                                            }

                                            return columns.map((colAppts, colIdx) => {
                                                const sorted = [...colAppts].sort((a, b) => a.time.localeCompare(b.time));
                                                return (
                                                    <div key={colIdx} className="flex-1 relative h-full pointer-events-none border-r border-transparent">
                                                        {sorted.map(appt => {
                                                            const top = timeToTop(appt.time);
                                                            const height = (appt.duration || 30) * PX_PER_MIN;

                                                            const [ah, am] = appt.time.split(':').map(Number);
                                                            const startMin = ah * 60 + am;

                                                            const overlapping = sorted.filter(o => {
                                                                if (o.id === appt.id) return false;
                                                                const [oh, om] = o.time.split(':').map(Number);
                                                                const oStart = oh * 60 + om;
                                                                const oEnd = oStart + (o.duration || 30);
                                                                const myEnd = startMin + (appt.duration || 30);
                                                                return startMin < oEnd && myEnd > oStart;
                                                            });

                                                            let width = '100%', left = '0%';
                                                            if (overlapping.length > 0) {
                                                                const older = overlapping.find(o => o.time < appt.time || (o.time === appt.time && o.id < appt.id));
                                                                width = '50%';
                                                                left = older ? '50%' : '0%';
                                                            }

                                                            return (
                                                                <div
                                                                    key={appt.id}
                                                                    draggable={currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR'}
                                                                    onDragStart={(e) => handleDragStart(e, appt)}
                                                                    onDragEnd={() => setDraggingAppt(null)}
                                                                    onClick={(e) => handleAppointmentClick(e, appt)}
                                                                    style={{ top: `${top}px`, height: `${height}px`, left, width, position: 'absolute' }}
                                                                    className={`p-2 rounded-xl text-xs font-bold border shadow-sm cursor-pointer pointer-events-auto transition-all z-10 overflow-hidden flex flex-col justify-start group ${getAppointmentColors(appt.status, appt.paid)} ${draggingAppt?.id === appt.id ? 'opacity-40 scale-95 border-dashed grayscale shadow-none' : 'hover:scale-[1.01] hover:z-20 shadow-sm'}`}
                                                                >
                                                                    <div className="flex justify-between items-start mb-0.5">
                                                                        <div className="flex items-center gap-1 min-w-0">
                                                                            {currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' && (
                                                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                                                                                    <div className="w-1 h-3 flex flex-col gap-0.5">
                                                                                        <div className="w-full h-0.5 bg-current opacity-50 rounded-full" />
                                                                                        <div className="w-full h-0.5 bg-current opacity-50 rounded-full" />
                                                                                        <div className="w-full h-0.5 bg-current opacity-50 rounded-full" />
                                                                                    </div>
                                                                                </div>
                                                                            )}
                                                                            <span className="truncate font-black">{patients.find(p => p.id === appt.patientId)?.name || 'Paciente'}</span>
                                                                        </div>
                                                                        {appt.duration && appt.duration > 20 && <span className="text-[9px] opacity-70 ml-1 whitespace-nowrap">{appt.time}</span>}
                                                                    </div>
                                                                    {(() => {
                                                                        const treatmentText = typeof appt.treatment === 'object' && appt.treatment !== null
                                                                            ? (appt.treatment as any).name
                                                                            : appt.treatment || (appt as any).treatmentName;
                                                                        const budgetItems = (appt as any).budget?.items;
                                                                        const displayTreatment = (budgetItems && budgetItems.length > 0)
                                                                            ? budgetItems.map((item: any) => item.name).join(', ')
                                                                            : treatmentText;
                                                                        return appt.duration && appt.duration >= 15 && displayTreatment ? (
                                                                            <span className="text-[10px] opacity-80 truncate mt-0.5 italic">
                                                                                {displayTreatment}
                                                                            </span>
                                                                        ) : null;
                                                                    })()}
                                                                    {appt.duration && appt.duration >= 30 && appt.observations && (
                                                                        <p className="text-[9px] opacity-60 mt-0.5 line-clamp-2 leading-tight">
                                                                            {appt.observations}
                                                                        </p>
                                                                    )}
                                                                    {/* Feature 7: Visit Details visible on card */}
                                                                    {appt.duration && appt.duration >= 30 && (appt as any).visitDetails && (
                                                                        <p className="text-[9px] text-purple-500 opacity-80 mt-0.5 line-clamp-1 italic">
                                                                            📋 {(appt as any).visitDetails}
                                                                        </p>
                                                                    )}

                                                                    {/* RESIZE HANDLE */}
                                                                    {currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' && (
                                                                        <div 
                                                                            onMouseDown={(e) => handleResizeStart(e, appt)}
                                                                            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-black/10 transition-colors z-30"
                                                                        />
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
                                            {/* DUPLICAR button */}
                                            {currentUserRole !== 'DOCTOR' && currentUserRole !== 'AUXILIAR' && (
                                                <button
                                                    onClick={handleDuplicate}
                                                    className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 shadow-lg transition-all"
                                                >
                                                    <Plus size={16} />
                                                    <span>Duplicar</span>
                                                </button>
                                            )}
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

                            {(!selectedAppt || isDuplicating) ? (
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-400">Fecha</label>
                                        <input
                                            type="date"
                                            className="w-full bg-slate-50 p-2 rounded-xl border border-slate-200 mt-1 outline-none font-bold text-xs"
                                            value={bookingDate}
                                            onChange={(e) => setBookingDate(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase text-slate-400">Hora</label>
                                        <select
                                            className="w-full bg-slate-50 p-2 rounded-xl border border-slate-200 mt-1 outline-none font-bold text-xs"
                                            value={bookingTime}
                                            onChange={(e) => setBookingTime(e.target.value)}
                                        >
                                            {TIME_SLOTS.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                             ) : (
                                <p className="text-sm text-slate-500">
                                    {activeSlot?.time} - {viewMode === 'daily' ? currentDate.toLocaleDateString() : 'Día ' + activeSlot?.dayIdx}
                                </p>
                             )}

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
                                        disabled={false}
                                    >
                                        <option value="">-- Sin vincular --</option>
                                        {patientBudgets.map(b => (
                                            <option key={b.id} value={b.id}>
                                                #{b.id ? b.id.slice(0, 8) : ''} - {b.title || 'Presupuesto'} ({b.total}€) - {new Date(b.date).toLocaleDateString()}
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
                                                        disabled={false}
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
                                    disabled={false}
                                >
                                    <option value="">Seleccionar Doctor...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name || d.full_name} ({d.specialization || 'Odontólogo'})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Multi-Treatment Selection - Only show if NO budget is selected */}
                            {!bookingBudgetId && (
                                <div>
                                    <div className="flex justify-between items-center">
                                        <label className="text-xs font-bold uppercase text-slate-400">Tratamientos</label>
                                        <button 
                                            onClick={handlePackPrimeraVisita}
                                            className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1"
                                        >
                                            <Sparkles size={12} /> Pack Primera Visita
                                        </button>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        <select
                                            className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none font-bold text-slate-600 text-sm"
                                            value={treatmentToAdd}
                                            onChange={(e) => setTreatmentToAdd(e.target.value)}
                                        >
                                            <option value="">Añadir tratamiento...</option>
                                            {DENTAL_SERVICES.map(t => (
                                                <option key={t.id} value={t.id}>{t.name} — {t.price}€</option>
                                            ))}
                                        </select>
                                        <button
                                            onClick={handleAddTreatmentToList}
                                            disabled={!treatmentToAdd}
                                            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-black disabled:opacity-40 hover:bg-slate-700 transition-colors"
                                        >
                                            +
                                        </button>
                                    </div>
                                    {selectedTreatmentsList.length > 0 && (
                                        <div className="mt-2 space-y-1">
                                            {selectedTreatmentsList.map((t, i) => (
                                                <div key={i} className="flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
                                                    <span className="text-xs font-bold text-blue-800">{t.name}</span>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-black text-blue-600">{t.price}€</span>
                                                        <button
                                                            onClick={() => handleRemoveTreatmentFromList(i)}
                                                            className="w-5 h-5 flex items-center justify-center bg-blue-200 hover:bg-red-200 text-blue-700 hover:text-red-700 rounded-full text-xs font-black transition-colors"
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                            <div className="text-right text-xs font-black text-blue-700 pr-1 pt-1">
                                                Total: {selectedTreatmentsList.reduce((sum, t) => sum + t.price, 0).toFixed(2)}€
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Read-only simple treatment if viewing an appointment with NO budget */}
                            {selectedAppt && !bookingBudgetId && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-400">Tratamiento</label>
                                    <input
                                        className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-700"
                                        value={
                                            typeof selectedAppt.treatment === 'object' && selectedAppt.treatment !== null
                                                ? (selectedAppt.treatment as any).name
                                                : ((selectedAppt as any).treatmentName || selectedAppt.treatment || 'No especificado')
                                        }
                                        onChange={(e) => setBookingTreatment(e.target.value)}
                                    />
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
                                        disabled={false}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-400">Duración</label>
                                    <select
                                        className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600"
                                        value={bookingDuration}
                                        onChange={e => setBookingDuration(Number(e.target.value))}
                                        disabled={false}
                                    >
                                        {DURATION_OPTIONS.map(opt => (
                                            <option key={opt} value={opt}>{opt} min</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Observaciones</label>
                                <textarea
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600 h-20 resize-none"
                                    placeholder="Notas adicionales..."
                                    value={bookingObservation}
                                    onChange={e => setBookingObservation(e.target.value)}
                                    disabled={false}
                                />
                            </div>

                            {/* Feature 7: Visit Details Field */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Detalles de la Visita</label>
                                <textarea
                                    className="w-full bg-purple-50/50 p-3 rounded-xl border border-purple-200 mt-2 outline-none font-bold text-purple-700 h-16 resize-none"
                                    placeholder="Pago pendiente, alergias, indicaciones especiales..."
                                    value={bookingVisitDetails}
                                    onChange={e => setBookingVisitDetails(e.target.value)}
                                    disabled={false}
                                />
                            </div>

                        </div>{/* end scrollable area */}
                        <div className="px-8 pb-8 flex gap-4 pt-4 border-t border-slate-100">
                            <button onClick={() => { setIsAppointmentModalOpen(false); setIsEditingAppt(false); }} className="flex-1 py-3 font-bold text-slate-500">
                                {selectedAppt ? 'Cerrar' : 'Cancelar'}
                            </button>
                            {selectedAppt && (
                                <button
                                    onClick={async () => {
                                        try {
                                            // Validación: Campos requeridos
                                            if (!bookingPatientId || !bookingDoctorId || !bookingDate || !bookingTime) {
                                                alert('❌ Error: Completa todos los campos obligatorios (Paciente, Doctor, Fecha, Hora)');
                                                return;
                                            }

                                            const updatePayload = {
                                                date: `${bookingDate}T00:00:00.000Z`,
                                                time: bookingTime,
                                                patientId: bookingPatientId,
                                                doctorId: bookingDoctorId,
                                                treatmentName: bookingTreatment || null,
                                                amount: bookingPrice || null,
                                                duration: bookingDuration,
                                                observations: bookingObservation || null,
                                                visitDetails: bookingVisitDetails || null,
                                                budgetId: bookingBudgetId || null,
                                                budgetItemId: bookingBudgetItemId || null,
                                                status: (selectedAppt as any).status || 'Scheduled'
                                            };

                                            console.log('📝 Updating appointment:', updatePayload);

                                            // VALIDATION: Doctor availability
                                            const checkDate = new Date(updatePayload.date);
                                            const availSlots = getAvailableTimeSlots(checkDate, updatePayload.doctorId);
                                            if (!availSlots.includes(updatePayload.time)) {
                                                toast.error("El doctor no trabaja en este horario seleccionado.");
                                                return;
                                            }

                                            const result = await api.appointments.update(selectedAppt.id, updatePayload);
                                            
                                            // Refresh appointments via context
                                            await refreshAppointments();
                                            setIsAppointmentModalOpen(false);
                                            setIsEditingAppt(false);
                                            setSelectedAppt(null);
                                            toast.success("Cita actualizada con éxito.");
                                        } catch (e: any) {
                                            console.error('❌ Update appointment error:', e);
                                            toast.error('Error al actualizar: ' + (e.message || "Error desconocido"));
                                        }
                                    }}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                >
                                    <Save size={16} /> Guardar Cambios
                                </button>
                            )}
                            {!selectedAppt && (
                                <button onClick={handleBooking} disabled={isBooking} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg disabled:opacity-50">
                                    {isBooking ? 'Guardando...' : 'Confirmar'}
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
