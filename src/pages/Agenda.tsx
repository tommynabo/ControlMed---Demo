import React, { useState, useMemo, useEffect, useRef } from 'react';
import { RefreshCw, Layers, Edit2, AlertCircle, FileText, Banknote, DollarSign, Euro, CreditCard, Stethoscope, Briefcase, Pill, Target, ShieldAlert, BadgeInfo, Sparkles, User, ExternalLink, Save, AlertTriangle, Edit3, Calendar, Eye, EyeOff, Lock, Unlock, CheckCircle2, X, Plus, Clock, Search, ChevronLeft, ChevronRight, Share2, Printer, AlignLeft, Calendar as CalendarIcon, Filter, Zap, Loader2, UserPlus } from 'lucide-react';
import NewPatientModal from '../components/NewPatientModal';
import PackSelectionModal, { PackServiceItem } from '../components/PackSelectionModal';
import { useNavigate } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../services/supabase';
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
    const queryClient = useQueryClient();

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

    // 🆕 Feature 1: Real DB Services search state
    const [dbServices, setDbServices] = useState<Array<{id: string, name: string, final_price: number, specialty_name?: string}>>([]);
    const [bookingServiceSearch, setBookingServiceSearch] = useState<string>('');
    const [selectedDbServices, setSelectedDbServices] = useState<PackServiceItem[]>([]);
    const [showServiceDropdown, setShowServiceDropdown] = useState(false);

    // 🆕 Feature 2: Revisión toggle state
    const [bookingIsRevision, setBookingIsRevision] = useState<boolean>(false);

    // 🆕 Pack Selection Modal State
    const [isPackSelectionModalOpen, setIsPackSelectionModalOpen] = useState<boolean>(false);

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

    // Current time indicator
    const [currentTime, setCurrentTime] = useState(new Date());

    // Feature 6: Mini calendar
    const [showMiniCal, setShowMiniCal] = useState(false);
    const [miniCalMonth, setMiniCalMonth] = useState(new Date());

    // Panel: citas anuladas / no presentadas
    const [showCancelledPanel, setShowCancelledPanel] = useState(false);

    // Sticky Header Refs
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const gridContainerRef = useRef<HTMLDivElement>(null);

    const handleGridScroll = (e: React.UIEvent<HTMLDivElement>) => {
        if (headerContainerRef.current) {
            headerContainerRef.current.scrollLeft = e.currentTarget.scrollLeft;
        }
    };

    // Feature 7: Visit details editing
    const [bookingVisitDetails, setBookingVisitDetails] = useState('');
    // Block 3: prevent double booking
    const [isBooking, setIsBooking] = useState(false);

    // Price editing for service chips
    const [editingPriceIdx, setEditingPriceIdx] = useState<number | null>(null);
    const [editingPriceValue, setEditingPriceValue] = useState<string>('');

    // Quick new patient modal
    const [isQuickNewPatientOpen, setIsQuickNewPatientOpen] = useState(false);

    // Feature 8: Editable duration for existing appointments
    const [isEditingAppt, setIsEditingAppt] = useState(false);

    // Schedule Overrides (turnos excepcionales)
    const [scheduleOverrides, setScheduleOverrides] = useState<any[]>([]);
    const [showOverrideModal, setShowOverrideModal] = useState(false);
    const [overrideDoctorId, setOverrideDoctorId] = useState<string>('');
    const [overrideDate, setOverrideDate] = useState<string>('');
    const [overrideStart, setOverrideStart] = useState<string>('09:00');
    const [overrideEnd, setOverrideEnd] = useState<string>('14:00');
    const [overrideNotes, setOverrideNotes] = useState<string>('');
    const [isSavingOverride, setIsSavingOverride] = useState(false);

    // Feature 9: Drag & Drop and Resizing
    const [draggingAppt, setDraggingAppt] = useState<Appointment | null>(null);
    const [resizingAppt, setResizingAppt] = useState<Appointment | null>(null);
    const [resizeStartPos, setResizeStartPos] = useState<number>(0);
    const [initialDuration, setInitialDuration] = useState<number>(30);
    const [isDuplicating, setIsDuplicating] = useState(false);
    const [dragOverSlot, setDragOverSlot] = useState<{ time: string, drId: string, dayIdx: number } | null>(null);

    // Responsive slot height (px per 5-min interval): scales with viewport width
    const [slotH, setSlotH] = useState(() => window.innerWidth >= 1536 ? 24 : window.innerWidth >= 1280 ? 20 : 16);
    useEffect(() => {
        const handleResize = () => setSlotH(window.innerWidth >= 1536 ? 24 : window.innerWidth >= 1280 ? 20 : 16);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

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
        
        // ✅ IMPORTANTE: Forzar refetch de appointments al abrir la página (sin caché)
        console.log('[Agenda] Forzando refetch de appointments sin caché...');
        queryClient.invalidateQueries({ queryKey: ['appointments'] });
        
        loadSchedules();

        // Reload schedules every 30 seconds to catch changes from Settings
        const interval = setInterval(() => {
            loadSchedules();
        }, 30000);

        return () => {
            clearInterval(interval);
        };
    }, []);

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

    // 🆕 Load real DB Services catalog for searchable selector
    useEffect(() => {
        api.services.getAll()
            .then((data: any[]) => setDbServices(data || []))
            .catch((err: any) => console.warn('Could not load DB services catalog:', err));
    }, [api]);

    // Update current time every minute for the live time indicator
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

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

    // Load Schedule Overrides (turnos excepcionales)
    useEffect(() => {
        api.doctorSchedules.getOverrides?.()
            .then((data: any[]) => setScheduleOverrides(data || []))
            .catch(() => {});
    }, [api]);

    // Quick status change handler for appointment modal
    const handleQuickStatusChange = async (newStatus: string) => {
        if (!selectedAppt) return;
        try {
            const updated = await api.appointments.update(selectedAppt.id, { status: newStatus });
            const enriched = { ...updated, updated_by_name: updated.updated_by_name || (currentUser as any)?.name || null };
            setAppointments(prev => prev.map(a => a.id === enriched.id ? { ...a, ...enriched } : a));
            setSelectedAppt({ ...selectedAppt, status: newStatus });
            await refreshAppointments();
            toast.success('Estado actualizado');
        } catch (e: any) {
            toast.error('Error al actualizar estado: ' + e.message);
        }
    };

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
        if (isBooking) return;
        setIsBooking(true);
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
        } finally {
            setIsBooking(false);
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

        // Check schedule overrides (turnos excepcionales) for this specific date
        const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const overridesForDay = scheduleOverrides.filter(o => {
            const oDate = typeof o.date === 'string' ? o.date.split('T')[0] : '';
            return oDate === dateStr && o.doctorId === doctorId;
        });
        if (overridesForDay.length > 0) {
            return TIME_SLOTS.filter(slot => {
                const [slotH, slotM] = slot.split(':').map(Number);
                const slotTime = slotH + slotM / 60;
                return overridesForDay.some(ov => {
                    const [sH, sM] = ov.startTime.split(':').map(Number);
                    const [eH, eM] = ov.endTime.split(':').map(Number);
                    return slotTime >= (sH + sM / 60) && slotTime < (eH + eM / 60);
                });
            });
        }

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

    // Handle saving a schedule override
    const handleSaveOverride = async () => {
        if (!overrideDoctorId || !overrideDate || !overrideStart || !overrideEnd) {
            toast.error('Completa todos los campos obligatorios');
            return;
        }
        setIsSavingOverride(true);
        try {
            const result = await api.doctorSchedules.createOverride?.({
                doctorId: overrideDoctorId,
                date: overrideDate,
                startTime: overrideStart,
                endTime: overrideEnd,
                notes: overrideNotes || null,
            });
            setScheduleOverrides(prev => [...prev, result]);
            setShowOverrideModal(false);
            setOverrideDoctorId('');
            setOverrideDate('');
            setOverrideStart('09:00');
            setOverrideEnd('14:00');
            setOverrideNotes('');
            toast.success('Turno excepcional creado');
            // Reload schedules to reflect new override
            api.doctorSchedules.getOverrides?.().then((data: any[]) => setScheduleOverrides(data || [])).catch(() => {});
        } catch (e: any) {
            toast.error('Error: ' + (e.message || e));
        } finally {
            setIsSavingOverride(false);
        }
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
        const patientName = patients.find(p => p.id === appt.patientId)?.name || (appt as any).patient?.name || '';
        setApptSearch(patientName);
        setBookingPatientId(appt.patientId || ''); // Set Patient ID for budgets
        setBookingDoctorId(appt.doctorId || '');
        // Compute the new treatment value as a local variable to avoid reading stale React state below
        const newTreatmentValue = typeof appt.treatment === 'string' ? appt.treatment : (appt.treatment as any)?.id || (appt as any).treatmentName || '';
        setBookingTreatment(newTreatmentValue);
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
                // Prefer the multi-item array (budgetItemIds), fall back to singular budgetItemId
                const storedIds: string[] = (() => {
                    try {
                        const raw = (appt as any).budgetItemIds;
                        if (raw) return JSON.parse(raw) as string[];
                    } catch (_) {}
                    return (appt as any).budgetItemId ? [(appt as any).budgetItemId as string] : [];
                })();
                const selectedItems = budget.items.filter((item: any) => storedIds.includes(item.id));
                setSelectedBudgetItems(selectedItems);
            } else {
                setSelectedBudgetItems([]);
            }
        } else {
            setSelectedBudgetItems([]);
        }

        // Extract date portion directly from ISO string to avoid UTC→local timezone shift
        const rawDate = appt.date ? String(appt.date) : formatDateLocal(new Date());
        setBookingDate(rawDate.includes('T') ? rawDate.split('T')[0] : rawDate.split(' ')[0]);
        setBookingTime(appt.time || '08:00');
        // 🆕 Populate new feature states from existing appointment
        setBookingIsRevision(!!(appt.isRevision || (appt as any).is_revision));
        
        // Populate services from DB catalogue if IDs exist
        // Prefer serviceBreakdown (has excludeFromLiquidation + custom prices) over serviceIds
        const initialServices: PackServiceItem[] = [];
        const apptBreakdown = (appt as any).serviceBreakdown || (appt as any).service_breakdown;
        const apptServiceIds = (appt as any).serviceIds || [];
        if (apptBreakdown && Array.isArray(apptBreakdown) && apptBreakdown.length > 0) {
            apptBreakdown.forEach((item: any) => {
                initialServices.push({
                    id: item.id,
                    name: item.name,
                    price: item.price ?? 0,
                    excludeFromLiquidation: item.excludeFromLiquidation ?? false
                });
            });
        } else if (apptServiceIds.length > 0) {
            apptServiceIds.forEach((sid: string) => {
                const svc = dbServices.find(s => s.id === sid);
                if (svc) initialServices.push({ id: svc.id, name: svc.name, price: svc.final_price || 0, excludeFromLiquidation: (svc as any).exclude_from_liquidation ?? false });
            });
        }
        
        // If no services were found by ID but there is a treatment name,
        // populate as custom entries so the edit modal shows the treatments.
        // IMPORTANT: use newTreatmentValue (local var) — NOT the bookingTreatment state,
        // which is stale at this point and would bleed in the previous appointment's treatment.
        if (initialServices.length === 0 && newTreatmentValue) {
            const names = newTreatmentValue.split(',').map((n: string) => n.trim()).filter(Boolean);
            names.forEach((name: string, i: number) => {
                initialServices.push({ id: `custom-existing-${i}`, name, price: 0, excludeFromLiquidation: false });
            });
        }
        
        setSelectedDbServices(initialServices);
        setBookingServiceSearch('');
        setShowServiceDropdown(false);
        setActiveSlot({ time: appt.time || '08:00', dayIdx: 0 }); // Visual context
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
        // 🆕 Reset new feature states
        setBookingIsRevision(false);
        setSelectedDbServices([]);
        setBookingServiceSearch('');
        setShowServiceDropdown(false);
    };

    // Multi-treatment handlers
    const handlePushTreatment = (svc: { id: string, name: string, price: number, excludeFromLiquidation?: boolean }) => {
        // Prevent duplicates by ID (if it has one)
        if (svc.id && !svc.id.startsWith('custom-') && selectedDbServices.some(s => s.id === svc.id)) {
            toast.error('Este servicio ya ha sido añadido');
            return;
        }
        
        const newList = [...selectedDbServices, { ...svc, excludeFromLiquidation: svc.excludeFromLiquidation ?? false }];
        setSelectedDbServices(newList);
        // If existing chips are custom placeholders (price 0 loaded from treatmentName),
        // add incrementally to preserve the manually-set total instead of overwriting it.
        const hasUnpricedCustom = selectedDbServices.some(s => s.id.startsWith('custom-') && s.price === 0);
        setBookingPrice(hasUnpricedCustom ? bookingPrice + svc.price : newList.reduce((sum, t) => sum + t.price, 0));
        setBookingTreatment(newList.map(t => t.name).join(', '));
        setBookingServiceSearch('');
        setShowServiceDropdown(false);
    };

    const handleAddTreatmentToList = () => {
        const query = bookingServiceSearch.trim();
        if (!query) return;

        // Si el texto coincide exactamente con un servicio de la DB, lo añadimos como tal
        const existingSvc = dbServices.find(s => s.name.toLowerCase() === query.toLowerCase());
        
        if (existingSvc) {
            handlePushTreatment({
                id: existingSvc.id,
                name: existingSvc.name,
                price: existingSvc.final_price || 0,
                excludeFromLiquidation: (existingSvc as any).exclude_from_liquidation ?? false
            });
        } else {
            // Concepto libre: añadir con precio 0 y activar edición de precio inmediatamente
            const newList = [...selectedDbServices, { id: `custom-${Date.now()}`, name: query, price: 0, excludeFromLiquidation: false }];
            setSelectedDbServices(newList);
            // New chip has price 0; preserve existing total — user will set price via chip editor.
            // bookingPrice is updated incrementally in handleUpdateServicePrice.
            setBookingTreatment(newList.map(t => t.name).join(', '));
            setBookingServiceSearch('');
            setShowServiceDropdown(false);
            // Abrir edición de precio en el chip recién añadido
            setEditingPriceIdx(newList.length - 1);
            setEditingPriceValue('0');
        }
    };

    const handleUpdateServicePrice = (idx: number, newPrice: number) => {
        const oldPrice = selectedDbServices[idx]?.price || 0;
        const updated = selectedDbServices.map((s, i) => i === idx ? { ...s, price: newPrice } : s);
        setSelectedDbServices(updated);
        // Incremental delta so the manually-set total is respected when chips are unpriced placeholders.
        setBookingPrice(Math.max(0, bookingPrice + (newPrice - oldPrice)));
        setEditingPriceIdx(null);
        setEditingPriceValue('');
    };

    const handleRemoveTreatmentFromList = (idx: number) => {
        const removed = selectedDbServices[idx];
        const newList = selectedDbServices.filter((_, i) => i !== idx);
        setSelectedDbServices(newList);
        // If removing a priced chip: subtract it. If removing a placeholder (price 0): preserve total.
        // If list is now empty: reset to 0.
        const newPrice = newList.length === 0
            ? 0
            : removed.price > 0
                ? Math.max(0, bookingPrice - removed.price)
                : bookingPrice;
        setBookingPrice(newPrice);
        setBookingTreatment(newList.map(t => t.name).join(', '));
    };

    const checkOverlap = (dateStr: string, timeStr: string, durationMin: number, doctorId: string, excludeApptId?: string) => {
        if (!doctorId || doctorId === 'all') return false;
        const [h2, m2] = timeStr.split(':').map(Number);
        const start2 = h2 * 60 + m2;
        const end2 = start2 + (durationMin || 30);
        const date2 = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;

        return appointments.some(a => {
            if (a.id === excludeApptId) return false;
            if (!a.time || !a.date) return false;
            if (a.status === 'Cancelled' || a.status === 'Anulada') return false;
            if (a.doctorId !== doctorId) return false;
            
            const [h1, m1] = (a.time || '00:00').split(':').map(Number);
            const start1 = h1 * 60 + m1;
            const end1 = start1 + (a.duration || 30);
            
            const rawDate1 = String(a.date);
            const date1 = rawDate1.includes('T') ? rawDate1.split('T')[0] : rawDate1.split(' ')[0];
            
            if (date1 === date2) {
                return Math.max(start1, start2) < Math.min(end1, end2);
            }
            return false;
        });
    };

    // Handle Booking
    const handleBooking = async () => {
        if (isBooking) return;
        if (selectedAppt?.id) return; // Edit mode: handled by "Guardar Cambios" button
        
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
            treatmentName: !bookingBudgetId && selectedDbServices.length > 0 
                ? selectedDbServices.map(t => t.name).join(', ')
                : (bookingTreatment || null),
            // 🆕 Real DB service IDs (filter out custom ones)
            serviceIds: selectedDbServices.length > 0 
                ? selectedDbServices.filter(s => !s.id.startsWith('custom-')).map(s => s.id) 
                : null,
            serviceBreakdown: selectedDbServices.length > 0
                ? selectedDbServices.map(s => ({
                    id: s.id,
                    name: s.name,
                    price: s.price,
                    excludeFromLiquidation: s.excludeFromLiquidation ?? false
                  }))
                : null,
            budgetId: bookingBudgetId || null,
            budgetItemId: bookingBudgetItemId || null,
            budgetItemIds: selectedBudgetItems.length > 0 ? selectedBudgetItems.map(item => item.id || item._idx) : null,
            amount: bookingPrice || null,
            observations: bookingObservation || null,
            visitDetails: bookingVisitDetails || null,
            status: 'Scheduled',
            duration: bookingDuration,
            // 🆕 Revisión tag
            isRevision: bookingIsRevision
        };

        try {
            setIsBooking(true);
            const createdAppt = await api.appointments.create(newAppt);
            // Inject updated_by_name so it shows immediately without waiting for refetch
            const enrichedAppt = { ...createdAppt, updated_by_name: (createdAppt as any).updated_by_name || currentUser?.name || null };
            addAppointment(enrichedAppt);
            // Force cache invalidation so the agenda refetches from server
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
            // 🆕 Reset new states
            setBookingIsRevision(false);
            setSelectedDbServices([]);
            setBookingServiceSearch('');
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

        const newDrId = drId || draggingAppt.doctorId;

        try {
            const updated = await api.appointments.update(draggingAppt.id, {
                date: dateStr,
                time: time,
                doctorId: newDrId
            });

            const enriched = { ...updated, updated_by_name: updated.updated_by_name || (currentUser as any)?.name || null };
            setAppointments(prev => prev.map(a => a.id === enriched.id ? enriched : a));
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
            const deltaMins = Math.round(deltaY / slotH) * 5;
            const newDuration = Math.max(5, (appt.duration || 30) + deltaMins);

            if (newDuration !== appt.duration) {
                try {
                    const updated = await api.appointments.update(appt.id, {
                        duration: newDuration
                    });
                    const enriched = { ...updated, updated_by_name: updated.updated_by_name || (currentUser as any)?.name || null };
                    setAppointments(prev => prev.map(a => a.id === enriched.id ? enriched : a));
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
        setIsPackSelectionModalOpen(true);
    };

    const handleSelectPack = (packId: string, services: PackServiceItem[]) => {
        const newList = [...selectedDbServices];
        services.forEach(s => {
            if (!newList.some(existing => existing.id === s.id)) {
                newList.push(s);
            }
        });
        
        setSelectedDbServices(newList);
        setBookingPrice(newList.reduce((sum, t) => sum + t.price, 0));
        setBookingTreatment(newList.map(t => t.name).join(', '));
        toast.success("Pack añadido correctamente");
    };

    const handleDuplicate = () => {
        if (!selectedAppt) return;
        
        // Mantener datos pero permitir editar fecha/hora
        const patientName = patients.find(p => p.id === selectedAppt.patientId)?.name || '';
        const doctorId = selectedAppt.doctorId;
        const treatmentValue = (selectedAppt as any).treatmentName || (typeof selectedAppt.treatment === 'string' ? selectedAppt.treatment : '') || '';
        const price = (selectedAppt as any).amount || 0;
        const duration = selectedAppt.duration || 30;
        const observations = selectedAppt.observations || '';
        
        // Extract date portion directly from ISO string to avoid UTC→local timezone shift
        setBookingDate(selectedAppt.date.split('T')[0]);
        setBookingTime(selectedAppt.time);

        setApptSearch(patientName);
        setBookingPatientId(selectedAppt.patientId);
        setBookingDoctorId(doctorId);
        setBookingTreatment(treatmentValue);
        setBookingPrice(price);
        setBookingDuration(duration);
        setBookingObservation(observations);

        // Rebuild selectedDbServices from the duplicated appointment's treatment name
        // to avoid bleeding stale services from a previously clicked appointment
        const dupServices: PackServiceItem[] = [];
        const dupBreakdown = (selectedAppt as any).serviceBreakdown || (selectedAppt as any).service_breakdown;
        const dupServiceIds = (selectedAppt as any).serviceIds || [];
        if (dupBreakdown && Array.isArray(dupBreakdown) && dupBreakdown.length > 0) {
            dupBreakdown.forEach((item: any) => {
                dupServices.push({ id: item.id, name: item.name, price: item.price ?? 0, excludeFromLiquidation: item.excludeFromLiquidation ?? false });
            });
        } else if (dupServiceIds.length > 0) {
            dupServiceIds.forEach((sid: string) => {
                const svc = dbServices.find(s => s.id === sid);
                if (svc) dupServices.push({ id: svc.id, name: svc.name, price: svc.final_price || 0, excludeFromLiquidation: (svc as any).exclude_from_liquidation ?? false });
            });
        }
        if (dupServices.length === 0 && treatmentValue) {
            treatmentValue.split(',').map((n: string) => n.trim()).filter(Boolean).forEach((name: string, i: number) => {
                dupServices.push({ id: `custom-existing-${i}`, name, price: 0 });
            });
        }
        setSelectedDbServices(dupServices);
        
        setIsDuplicating(true);
        setSelectedAppt(null); // Switch to "New" mode visually
        setActiveSlot(null);
    };

    // Calculate Unassigned appointments for the current view
    const apptDateStrFilter = (a: Appointment) => {
        if (!a.date) return '';
        const d = String(a.date);
        return d.includes('T') ? d.split('T')[0] : d.split(' ')[0];
    };
    const isVisibleFilter = (a: Appointment) => {
        if (!a.date) return false;
        const s = (a.status || '').toLowerCase();
        return s !== 'cancelled' && s !== 'canceled' && s !== 'anulada' && s !== 'noshow' && s !== 'no vino';
    };
    const knownDoctorIds = new Set(doctors.map(d => d.id));
    // Citas anuladas o no presentadas del día actual (para el panel separado)
    const todayDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
    const cancelledApptsToday = viewMode === 'daily' ? appointments.filter(a => {
        if (!a.date || !a.time) return false;
        const s = (a.status || '').toLowerCase();
        const isCancelledOrNoShow = s === 'cancelled' || s === 'canceled' || s === 'anulada' || s === 'noshow' || s === 'no vino';
        const matchesDoctor = selectedDoctorId === 'all' || a.doctorId === selectedDoctorId;
        return isCancelledOrNoShow && apptDateStrFilter(a) === todayDateStr && matchesDoctor;
    }) : [];
    let unassignedApptsToShow: Appointment[] = [];
    if (viewMode === 'daily') {
        const dateStr = todayDateStr;
        unassignedApptsToShow = appointments.filter(a =>
            isVisibleFilter(a) && apptDateStrFilter(a) === dateStr && (!a.doctorId || !knownDoctorIds.has(a.doctorId))
        );
    } else {
        const weekDates = Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(currentDate);
            const dow = d.getDay();
            d.setDate(d.getDate() - dow + (dow === 0 ? -6 : 1) + i);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        });
        unassignedApptsToShow = appointments.filter(a =>
            isVisibleFilter(a) && weekDates.includes(apptDateStrFilter(a)) && (!a.doctorId || !knownDoctorIds.has(a.doctorId))
        );
    }

    return (
        <>
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

                {/* Turno Excepcional button */}
                <button
                    onClick={() => {
                        setOverrideDate(formatDateLocal(currentDate));
                        setShowOverrideModal(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-500 border border-slate-200 hover:border-blue-300 hover:text-blue-600 transition-all"
                >
                    <Plus size={14} /> Turno Excepcional
                </button>

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
                                style={{ colorScheme: 'light' }}
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
                            <button onClick={handleCloseAgenda} disabled={isBooking} className="flex-1 bg-red-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                                {isBooking ? <><Loader2 className="animate-spin w-4 h-4" /> Cerrando...</> : 'Cerrar Agenda'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Override Modal (Turno Excepcional) */}
            {showOverrideModal && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[90] flex items-center justify-center p-6">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 space-y-5">
                        <h3 className="text-xl font-black text-slate-900">Turno Excepcional</h3>
                        <p className="text-xs text-slate-400">Añadir disponibilidad puntual para un doctor en una fecha concreta.</p>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-2">Doctor *</label>
                            <select
                                value={overrideDoctorId}
                                onChange={(e) => setOverrideDoctorId(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                                style={{ colorScheme: 'light' }}
                            >
                                <option value="">Seleccionar doctor...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-2">Fecha *</label>
                            <input
                                type="date"
                                value={overrideDate}
                                onChange={(e) => setOverrideDate(e.target.value)}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">Hora inicio *</label>
                                <input
                                    type="time"
                                    value={overrideStart}
                                    onChange={(e) => setOverrideStart(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-2">Hora fin *</label>
                                <input
                                    type="time"
                                    value={overrideEnd}
                                    onChange={(e) => setOverrideEnd(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-500 block mb-2">Notas (opcional)</label>
                            <input
                                type="text"
                                value={overrideNotes}
                                onChange={(e) => setOverrideNotes(e.target.value)}
                                placeholder="Ej: Guardia, sustitución..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowOverrideModal(false)} className="flex-1 py-3 text-sm font-bold text-slate-500">
                                Cancelar
                            </button>
                            <button onClick={handleSaveOverride} disabled={isSavingOverride} className="flex-1 bg-blue-600 text-white py-3 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors disabled:opacity-50 flex justify-center items-center gap-2">
                                {isSavingOverride ? <><Loader2 className="animate-spin w-4 h-4" /> Guardando...</> : 'Crear Turno'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unassigned Appointments Warning Strip */}
            {unassignedApptsToShow.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-4 overflow-x-auto shadow-sm items-center">
                    <div className="flex-shrink-0 flex items-center gap-2 text-amber-700 font-black whitespace-nowrap">
                        <AlertTriangle size={20} />
                        CITAS SIN ASIGNAR ({unassignedApptsToShow.length}):
                    </div>
                    {unassignedApptsToShow.map(a => {
                        const patient = patients.find(p => p.id === a.patientId);
                        const patName = patient
                            ? (patient.historyNumber ? `${patient.historyNumber} · ${patient.name}` : patient.name)
                            : '⚠️ Paciente Eliminado';
                        return (
                            <div key={a.id} className="bg-white border border-amber-200 p-3 rounded-xl flex-shrink-0 min-w-[200px] hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => { setSelectedAppt(a); setIsAppointmentModalOpen(true); }}
                            >
                                <div className="text-xs font-black text-slate-900 truncate">{patName}</div>
                                <div className="text-[10px] text-amber-600 font-bold mt-0.5">{apptDateStrFilter(a)} a las {a.time} - {a.duration || 30} min</div>
                                <div className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                                    <Edit3 size={10} /> Clic para asignar doctor
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* CALENDAR GRID (COLUMN BASED) */}
            <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 relative">
                
                {/* STICKY HEADER CONTAINER */}
                <div 
                    ref={headerContainerRef}
                    className="sticky top-0 z-[20] bg-white overflow-hidden mb-4 -mt-8 pt-8 border-b-[3px] border-slate-800"
                >
                    <div className="flex w-max min-w-full">
                        {/* TIME COLUMN HEADER - Empty space for layout match */}
                        <div className="w-16 flex-shrink-0 pr-4 bg-white">
                            <div className="h-[48px] flex items-end pb-3 ml-2 font-black text-xs text-slate-800">Hora</div>
                        </div>
                        
                        {/* DOCTORS / DAYS HEADER */}
                        <div className="flex-1 overflow-visible">
                            <div className="flex h-[48px] min-w-max">
                                {viewMode === 'daily' ? (
                                    selectedDoctorId === 'all' ? (
                                        doctorsOnDuty.map(doc => (
                                            <div key={doc.id} className={`min-w-[180px] flex-1 text-center pb-3 font-black uppercase tracking-wide text-xs flex items-end justify-center px-3 whitespace-nowrap ${isDateClosedForDoctor(currentDate, doc.id) ? 'text-red-400 line-through' : 'text-slate-900'
                                                }`}>
                                                {doc.name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="flex-1 min-w-[180px] text-center pb-3 font-black text-slate-900 uppercase flex items-end justify-center">
                                            {(selectedDoctorId && selectedDoctorId !== 'all' ? doctors.find(d => d.id === selectedDoctorId)?.name : 'Hoy')}
                                        </div>
                                    )
                                ) : (
                                    Array.from({ length: 7 }).map((_, i) => (
                                        <div key={i} className="min-w-[140px] flex-1 text-center pb-3 font-black text-slate-400 uppercase text-xs flex items-end justify-center">
                                            {getDayName(currentDate, i)}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div 
                    ref={gridContainerRef}
                    onScroll={handleGridScroll}
                    className="overflow-x-auto pb-4 pt-2 custom-scrollbar"
                >
                    <div className="flex">
                        {/* TIME COLUMN - Always visible */}
                        <div className="w-16 flex-shrink-0 pr-1 sticky left-0 bg-white z-[5] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                            {TIME_SLOTS.map((time) => {
                                const [, minStr] = time.split(':');
                                const min = parseInt(minStr, 10);
                                const isHour    = min === 0;
                                const isQuarter = min === 15 || min === 30 || min === 45;
                                if (isHour) {
                                    return (
                                        <div key={`tl-${time}`} className="relative border-t-2 border-slate-300" style={{ height: `${slotH}px` }}>
                                            <span className="absolute -top-[9px] left-0 w-full text-right pr-2 text-[11px] font-black text-slate-600 bg-white leading-none">
                                                {time}
                                            </span>
                                        </div>
                                    );
                                }
                                if (isQuarter) {
                                    return (
                                        <div key={`tl-${time}`} className="relative border-t border-slate-100" style={{ height: `${slotH}px` }}>
                                            <span className="absolute -top-[7px] left-0 w-full text-right pr-2 text-[9px] font-medium text-slate-400 bg-white leading-none">
                                                {time}
                                            </span>
                                        </div>
                                    );
                                }
                                return <div key={`tl-${time}`} style={{ height: `${slotH}px` }} />;
                            })}
                        </div>

                        {/* SCHEDULER GRID */}
                        <div className="flex-1 relative overflow-visible">
                            <div className="w-max min-w-full relative">
                                {/* HEADERS ARE NOW ABOVE */}

                                {/* TIME GRID BACKGROUND & EVENTS LAYER */}
                                <div className="relative">

                                    {/* ══ CURRENT TIME INDICATOR ══ */}
                                    {(() => {
                                        const todayStr = formatDateLocal(new Date());
                                        const selectedStr = formatDateLocal(currentDate);
                                        if (viewMode !== 'daily' || todayStr !== selectedStr) return null;
                                        const ctH = currentTime.getHours();
                                        const ctM = currentTime.getMinutes();
                                        const ctStr = `${String(ctH).padStart(2,'0')}:${String(ctM < 5 ? 0 : Math.floor(ctM/5)*5).padStart(2,'0')}`;
                                        const idx = TIME_SLOTS.indexOf(ctStr);
                                        if (idx < 0) return null;
                                        const top = idx * slotH + (ctM % 5) * (slotH / 5);
                                        return (
                                            <div
                                                style={{ top: `${top}px`, zIndex: 25 }}
                                                className="absolute left-0 right-0 pointer-events-none flex items-center"
                                            >
                                                <div className="w-2.5 h-2.5 rounded-full bg-red-500 flex-shrink-0 -ml-1 shadow-sm" />
                                                <div className="flex-1 border-t-2 border-red-500" />
                                            </div>
                                        );
                                    })()}

                                    {/* ═══════ GRID RENDERING ═══════ */}
                                    {(() => {
                                        // ── CASE A: Daily + specific doctor → merged blocks ──
                                        if (viewMode === 'daily' && selectedDoctorId && selectedDoctorId !== 'all') {
                                            const availableSlots = getAvailableTimeSlots(currentDate, selectedDoctorId);
                                            const isClosed = isDateClosedForDoctor(currentDate, selectedDoctorId);

                                            // If agenda is explicitly closed for this doctor/day
                                            if (isClosed) {
                                                return (
                                                    <div style={{ height: `${TIME_SLOTS.length * slotH}px` }}
                                                        className="flex items-center justify-center bg-red-50 rounded-xl border border-dashed border-red-200">
                                                        <div className="text-center">
                                                            <Lock className="w-12 h-12 text-red-300 mx-auto mb-2" />
                                                            <p className="text-sm font-bold text-red-400">Agenda cerrada</p>
                                                            {getClosureForDate(currentDate, selectedDoctorId)?.reason && (
                                                                <p className="text-xs text-red-300 mt-1">{getClosureForDate(currentDate, selectedDoctorId)?.reason}</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            }

                                            // If entire day is off
                                            if (availableSlots.length === 0) {
                                                return (
                                                    <div style={{ height: `${TIME_SLOTS.length * slotH}px` }}
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
                                                            style={{ height: `${item.count * slotH}px` }}
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
                                                        className={`flex relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`}
                                                        style={{ height: `${slotH}px` }}>
                                                        
                                                        {dragOverSlot?.time === t && draggingAppt && (
                                                            <div 
                                                                style={{ height: `${(draggingAppt.duration / 5) * slotH}px` }}
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

                                        // ── CASE B: Daily + all doctors (multi-column) ──
                                        if (viewMode === 'daily' && selectedDoctorId === 'all') {
                                            const activeDoctors = doctorsOnDuty;
                                            return TIME_SLOTS.map(time => {
                                                const isQuarter = time.endsWith(':00') || time.endsWith(':15') || time.endsWith(':30') || time.endsWith(':45');
                                                const hourStart = time.endsWith(':00');
                                                return (
                                                    <div key={time} className={`flex relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`} style={{ height: `${slotH}px` }}>
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
                                                                            style={{ height: `${(draggingAppt.duration / 5) * slotH}px` }}
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
                                                    <div key={time} className={`flex relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`} style={{ height: `${slotH}px` }}>
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
                                                                    style={{ height: `${(draggingAppt.duration / 5) * slotH}px` }}
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
                                                <div key={time} className={`flex relative group ${hourStart ? 'border-t-2 border-slate-300' : isQuarter ? 'border-t border-slate-200' : 'border-t border-slate-100/50'}`} style={{ height: `${slotH}px` }}>
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
                                                                        style={{ height: `${(draggingAppt.duration / 5) * slotH}px` }}
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
                                            const PX_PER_MIN = slotH / 5;

                                            // Convert time → pixel top using slot index (handles the 13:45→16:00 gap correctly)
                                            const timeToTop = (t: string): number => {
                                                const idx = TIME_SLOTS.indexOf(t);
                                                if (idx >= 0) return idx * slotH;
                                                // Interpolate if time is between slots
                                                const [h, m] = t.split(':').map(Number);
                                                const mins = h * 60 + m;
                                                for (let i = 0; i < TIME_SLOTS.length - 1; i++) {
                                                    const [sh, sm] = TIME_SLOTS[i].split(':').map(Number);
                                                    const [nh, nm] = TIME_SLOTS[i + 1].split(':').map(Number);
                                                    if (mins >= sh * 60 + sm && mins < nh * 60 + nm) {
                                                        return (i + (mins - (sh * 60 + sm)) / 5) * slotH;
                                                    }
                                                }
                                                return (TIME_SLOTS.length - 1) * slotH;
                                            };

                                            // Helper: extract date string safely from ISO without timezone shift
                                            // DEFENSIVE: handle null/undefined/malformed dates
                                            const apptDateStr = (a: Appointment) => {
                                                if (!a.date) return '';
                                                const d = String(a.date);
                                                return d.includes('T') ? d.split('T')[0] : d.split(' ')[0];
                                            };
                                            // Helper: show ALL appointments EXCEPT truly cancelled ones
                                            // INCLUSIVE: appointments with missing fields are still visible
                                            const isVisible = (a: Appointment) => {
                                                if (!a.date || !a.time) return false; // Cannot render without date+time
                                                const s = (a.status || '').toLowerCase();
                                                return s !== 'cancelled' && s !== 'canceled' && s !== 'anulada' && s !== 'noshow' && s !== 'no vino';
                                            };

                                            // Build columns
                                            const columns: Appointment[][] = [];
                                            let unassignedAppts: Appointment[] = [];

                                            if (viewMode === 'daily') {
                                                const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(currentDate.getDate()).padStart(2, '0')}`;
                                                if (selectedDoctorId === 'all') {
                                                    doctorsOnDuty.forEach(doc => {
                                                        columns.push(appointments.filter(a =>
                                                            isVisible(a) && apptDateStr(a) === dateStr && a.doctorId === doc.id
                                                        ));
                                                    });
                                                    // Collect orphan appointments (no valid doctorId) for the current day
                                                    const knownDoctorIds = new Set(doctors.map(d => d.id));
                                                    unassignedAppts = appointments.filter(a =>
                                                        isVisible(a) && apptDateStr(a) === dateStr && (!a.doctorId || !knownDoctorIds.has(a.doctorId))
                                                    );
                                                } else {
                                                    columns.push(appointments.filter(a =>
                                                        isVisible(a) && apptDateStr(a) === dateStr &&
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
                                                        isVisible(a) && apptDateStr(a) === ds &&
                                                        (selectedDoctorId === 'all' || a.doctorId === selectedDoctorId)
                                                    ));
                                                }
                                            }

                                            return (
                                                <>
                                                    {unassignedAppts.length > 0 && (
                                                        <div className="absolute top-2 left-2 right-2 z-50 bg-red-100 border border-red-200 text-red-700 p-2 rounded text-[10px] font-bold">
                                                            ⚠️ {unassignedAppts.length} cita(s) sin doctor asignado
                                                        </div>
                                                    )}
                                                    {columns.map((colAppts, colIdx) => {
                                                        const sorted = [...colAppts].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00'));
                                                        return (
                                                            <div key={colIdx} className="flex-1 relative h-full pointer-events-none border-r border-transparent">
                                                                {sorted.map(appt => {
                                                                    const safeTime = appt.time || '08:00';
                                                                    const top = timeToTop(safeTime);
                                                                    const height = (appt.duration || 30) * PX_PER_MIN;

                                                                    const [ah, am] = safeTime.split(':').map(Number);
                                                                    const startMin = ah * 60 + am;

                                                                    // Build the full overlap group (all appointments that overlap with this one)
                                                                    const overlapGroup = sorted.filter(o => {
                                                                        const [oh, om] = (o.time || '08:00').split(':').map(Number);
                                                                        const oStart = oh * 60 + om;
                                                                        const oEnd = oStart + (o.duration || 30);
                                                                        const myEnd = startMin + (appt.duration || 30);
                                                                        return startMin < oEnd && myEnd > oStart;
                                                                    });

                                                                    let width = '100%', left = '0%';
                                                                    if (overlapGroup.length > 1) {
                                                                        const myIdx = overlapGroup.findIndex(o => o.id === appt.id);
                                                                        const pct = 100 / overlapGroup.length;
                                                                        width = `${pct}%`;
                                                                        left = `${pct * myIdx}%`;
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
                                                                                    <span className="truncate font-black">
                                                                                        {(() => {
                                                                                            const patient = patients.find(p => p.id === appt.patientId) || (appt as any).patient;
                                                                                            if (!patient) return '⚠️ Paciente Eliminado';
                                                                                            const histNum = patient.historyNumber;
                                                                                            return histNum
                                                                                                ? `${histNum} · ${patient.name || 'Sin nombre'}`
                                                                                                : patient.name || 'Sin nombre';
                                                                                        })()}
                                                                                    </span>
                                                                                </div>
                                                                                {appt.duration && appt.duration > 20 && <span className="text-[9px] opacity-70 ml-1 whitespace-nowrap">{appt.time}</span>}
                                                                            </div>
                                                                            {/* Treatment — only the specific treatment name */}
                                                                            {(() => {
                                                                                // Priority: treatmentName (set at booking) > specific budgetItemId > nothing
                                                                                const treatmentText = (appt as any).treatmentName
                                                                                    || (typeof appt.treatment === 'object' && appt.treatment !== null ? (appt.treatment as any).name : appt.treatment as any)
                                                                                    || null;
                                                                                let displayTreatment: string | null = treatmentText;
                                                                                // If no treatmentName, try to resolve via budgetItemId (specific selected item only)
                                                                                if (!displayTreatment) {
                                                                                    const budgetItems = (appt as any).budget?.items;
                                                                                    const itemId = (appt as any).budgetItemId;
                                                                                    if (budgetItems && itemId) {
                                                                                        const matched = budgetItems.filter((item: any) => item.id === itemId);
                                                                                        if (matched.length > 0) displayTreatment = matched.map((item: any) => item.name).join(', ');
                                                                                    }
                                                                                }
                                                                                if (!displayTreatment) return null;
                                                                                return (
                                                                                    <div className="text-[10px] opacity-80 leading-tight mt-0.5 line-clamp-2 italic">
                                                                                        {displayTreatment}
                                                                                    </div>
                                                                                );
                                                                            })()}

                                                                            {/* 🆕 Feature: Revisión Badge */}
                                                                            {(appt.isRevision || (appt as any).is_revision) && (
                                                                                <div className="mt-0.5 inline-flex items-center gap-0.5 bg-cyan-500/20 border border-cyan-400/50 text-cyan-700 rounded-full px-1.5 py-0" style={{fontSize: '8px', fontWeight: 900}}>
                                                                                    ↩ REVISIÓN
                                                                                </div>
                                                                            )}

                                                                            {/* Observations & Visit Details */}
                                                                            {appt.duration && appt.duration >= 30 && (() => {
                                                                                const obs = appt.observations || (appt as any).observations;
                                                                                const visit = (appt as any).visitDetails;
                                                                                const text = [obs, visit].filter(Boolean).join(' · ');
                                                                                if (!text) return null;
                                                                                return (
                                                                                    <div className="text-[9px] opacity-70 leading-tight mt-0.5 line-clamp-2 break-words">
                                                                                        {text}
                                                                                    </div>
                                                                                );
                                                                            })()}

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
                                            })}
                                            </>
                                            );
                                        })()}
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* PANEL: ANULADAS Y NO PRESENTADOS (solo vista diaria) */}
            {viewMode === 'daily' && cancelledApptsToday.length > 0 && (
                <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                    <button
                        onClick={() => setShowCancelledPanel(p => !p)}
                        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors"
                    >
                        <div className="flex items-center gap-3">
                            <span className="text-lg">🚫</span>
                            <span className="font-black text-slate-800 text-sm uppercase tracking-wide">Anuladas / No Presentados</span>
                            <span className="bg-red-100 text-red-700 text-xs font-black px-2.5 py-0.5 rounded-full">
                                {cancelledApptsToday.length}
                            </span>
                        </div>
                        <span className="text-slate-400 text-lg">{showCancelledPanel ? '▲' : '▼'}</span>
                    </button>
                    {showCancelledPanel && (
                        <div className="px-6 pb-5 space-y-2">
                            {[...cancelledApptsToday].sort((a, b) => (a.time || '00:00').localeCompare(b.time || '00:00')).map(appt => {
                                const s = (appt.status || '').toLowerCase();
                                const isNoShow = s === 'noshow' || s === 'no vino';
                                const patientName = patients.find(p => p.id === appt.patientId)?.name || '—';
                                const docName = doctors.find(d => d.id === appt.doctorId)?.name || '';
                                return (
                                    <div
                                        key={appt.id}
                                        onClick={(e) => handleAppointmentClick(e, appt)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl cursor-pointer border transition-all hover:scale-[1.01] ${
                                            isNoShow
                                                ? 'bg-fuchsia-50 border-fuchsia-200 text-fuchsia-800'
                                                : 'bg-red-50 border-red-200 text-red-800'
                                        }`}
                                    >
                                        <span className="font-black text-sm w-12 shrink-0">{appt.time}</span>
                                        <span className="font-bold text-sm flex-1 line-through opacity-70">{patientName}</span>
                                        {docName && <span className="text-xs opacity-60 shrink-0">{docName}</span>}
                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full shrink-0 ${
                                            isNoShow
                                                ? 'bg-fuchsia-200 text-fuchsia-900'
                                                : 'bg-red-200 text-red-900'
                                        }`}>
                                            {isNoShow ? 'No vino' : 'Anulada'}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

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
                                            style={{ colorScheme: 'light' }}
                                        >
                                            {TIME_SLOTS.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                             ) : (
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
                                        <input
                                            type="time"
                                            className="w-full bg-slate-50 p-2 rounded-xl border border-slate-200 mt-1 outline-none font-bold text-xs"
                                            value={bookingTime}
                                            onChange={(e) => setBookingTime(e.target.value)}
                                            step="300"
                                        />
                                    </div>
                                </div>
                             )}

                            {/* Patient Search in Modal */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Paciente</label>
                                <div className="flex gap-2 mt-2">
                                    <input
                                        className="flex-1 bg-slate-50 p-3 rounded-xl border border-slate-200 outline-none font-bold"
                                        placeholder="Buscar paciente (Nombre o DNI)"
                                        value={apptSearch}
                                        onChange={(e) => {
                                            setApptSearch(e.target.value);
                                            if (bookingPatientId) {
                                                setBookingPatientId('');
                                                setPatientBudgets([]);
                                            }
                                        }}
                                    />
                                    <button
                                        title="Añadir nuevo paciente"
                                        onClick={() => setIsQuickNewPatientOpen(true)}
                                        className="w-11 h-11 flex-shrink-0 flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                                    >
                                        <UserPlus size={18} />
                                    </button>
                                </div>
                                {/* Suggestions - Mostrar siempre que se esté buscando y no haya paciente seleccionado */}
                                {apptSearch.length > 0 && !bookingPatientId && (
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
                                        style={{ colorScheme: 'light' }}
                                    >
                                        <option value="">-- Sin vincular --</option>
                                        {patientBudgets.map(b => (
                                            <option key={b.id} value={b.id}>
                                                {b.title || 'Presupuesto'}{b.items && b.items.length > 0 ? ` — ${b.items.map((i: any) => i.name).join(', ')}` : ''} ({b.total}€) · {new Date(b.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {/* Budget Item Selection (If Budget Selected) - Multi-select */}
                            {bookingBudgetId && (
                                <div>
                                    <label className="text-xs font-bold uppercase text-slate-400">Conceptos del Presupuesto</label>

                                    {/* Read-only summary: show items linked to THIS appointment with ✓/📅 status */}
                                    {selectedAppt && !isDuplicating && selectedBudgetItems.length > 0 && (() => {
                                        const apptStatus = (selectedAppt.status || '').toLowerCase();
                                        const isDone = selectedAppt.paid || apptStatus === 'completed' || apptStatus === 'realizada';
                                        return (
                                            <div className="mt-2 space-y-1">
                                                {selectedBudgetItems.map((item: any, idx: number) => (
                                                    <div key={idx} className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${isDone ? 'bg-emerald-50 border-emerald-200' : 'bg-blue-50 border-blue-200'}`}>
                                                        {isDone
                                                            ? <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500 shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
                                                            : <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 shrink-0"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                                                        }
                                                        <span className={`text-xs flex-1 font-bold ${isDone ? 'text-emerald-700' : 'text-blue-700'}`}>{item.name}</span>
                                                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${isDone ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {isDone ? '✓ Realizado' : 'Programado'}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()}

                                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 max-h-40 overflow-y-auto">
                                        {(() => {
                                            // Build a set of budgetLineItem IDs already used in OTHER appointments
                                            // for this same patient + budget (excluding the appointment being edited now)
                                            // Note: exclude cancelled/anulada appointments so their items are freed up
                                            const usedBudgetItemIds = new Set<string>(
                                                appointments
                                                    .filter((a: any) => {
                                                        const s = (a.status || '').toLowerCase();
                                                        const isCancelled = s === 'canceled' || s === 'cancelled' || s === 'anulada';
                                                        return (
                                                            a.patientId === bookingPatientId &&
                                                            a.budgetId === bookingBudgetId &&
                                                            a.id !== selectedAppt?.id &&
                                                            !a.deleted_at &&
                                                            !isCancelled
                                                        );
                                                    })
                                                    .flatMap((a: any) => {
                                                        try {
                                                            const multi = a.budgetItemIds ? JSON.parse(a.budgetItemIds) as string[] : [];
                                                            return multi.length > 0 ? multi : (a.budgetItemId ? [a.budgetItemId as string] : []);
                                                        } catch (_) {
                                                            return a.budgetItemId ? [a.budgetItemId as string] : [];
                                                        }
                                                    })
                                            );

                                            const availableItems = (patientBudgets.find(b => b.id === bookingBudgetId)?.items || [])
                                                .filter((item: any) => !usedBudgetItemIds.has(item.id));

                                            if (availableItems.length === 0) {
                                                return (
                                                    <p className="text-xs text-slate-400 text-center py-2">
                                                        Todos los tratamientos de este presupuesto ya han sido agendados.
                                                    </p>
                                                );
                                            }

                                            return availableItems.map((item: any, idx: number) => {
                                                const isChecked = selectedBudgetItems.some((si: any) => (si.id || idx.toString()) === (item.id || idx.toString()));
                                                return (
                                                    <label key={idx} className={`flex items-center gap-2 cursor-pointer rounded-lg p-1 transition-colors border ${isChecked ? 'bg-green-50 border-green-200' : 'hover:bg-white border-transparent'}`}>
                                                        <input
                                                            type="checkbox"
                                                            className="w-4 h-4 rounded"
                                                            checked={isChecked}
                                                            onChange={() => {
                                                                let newSelected;
                                                                if (isChecked) {
                                                                    newSelected = selectedBudgetItems.filter((si: any) => (si.id || '') !== (item.id || idx.toString()));
                                                                } else {
                                                                    newSelected = [...selectedBudgetItems, { ...item, _idx: idx }];
                                                                }
                                                                setSelectedBudgetItems(newSelected);
                                                                // Auto-fill treatment names and total price (with per-item discount applied)
                                                                setBookingTreatment(newSelected.map((i: any) => i.name).join(', '));
                                                                setBookingPrice(newSelected.reduce((sum: number, i: any) => sum + Number(i.price) * (1 - (Number(i.discount) || 0) / 100) * (Number(i.quantity) || 1), 0));
                                                                setBookingBudgetItemId(newSelected.length > 0 ? (newSelected[0].id || idx.toString()) : '');
                                                            }}
                                                        />
                                                        {isChecked && <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-green-500 shrink-0" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>}
                                                        <span className={`text-xs flex-1 ${isChecked ? 'font-black text-green-700' : 'font-bold text-slate-600'}`}>{item.name}</span>
                                                        {(Number(item.discount) || 0) > 0 ? (
                                                            <span className="text-xs font-bold flex items-center gap-1">
                                                                <span className="line-through text-slate-300">{Number(item.price).toFixed(2)}€</span>
                                                                <span className="text-green-600">{(Number(item.price) * (1 - Number(item.discount) / 100)).toFixed(2)}€</span>
                                                                <span className="text-red-500">(-{item.discount}%)</span>
                                                            </span>
                                                        ) : (
                                                            <span className="text-xs font-bold text-slate-400">{item.price}€</span>
                                                        )}
                                                    </label>
                                                );
                                            });
                                        })()}
                                    </div>
                                    {selectedBudgetItems.length > 0 && (
                                        <div className="mt-2 text-right text-xs font-black text-blue-600">
                                            Total: {selectedBudgetItems.reduce((sum: number, i: any) => sum + Number(i.price) * (1 - (Number(i.discount) || 0) / 100) * (Number(i.quantity) || 1), 0).toFixed(2)}€
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
                                    style={{ colorScheme: 'light' }}
                                >
                                    <option value="">Seleccionar Doctor...</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name || d.full_name} ({d.specialization || 'Odontólogo'})</option>
                                    ))}
                                </select>
                            </div>

                            {/* Consolidation: Treatment/Service Selection */}
                            {!bookingBudgetId && (
                                <div className="space-y-3">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs font-bold uppercase text-slate-400">Tratamientos y Servicios</label>
                                            <span className="bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full text-[10px] font-black">
                                                {selectedDbServices.length}
                                            </span>
                                        </div>
                                        <button 
                                            onClick={handlePackPrimeraVisita}
                                            className="text-[10px] font-black uppercase text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded-lg transition-colors"
                                        >
                                            <Sparkles size={12} /> Pack 1ª Visita
                                        </button>
                                    </div>

                                    {/* Selected Items Chips */}
                                    {selectedDbServices.length > 0 && (
                                        <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                                            {selectedDbServices.map((t, i) => (
                                                <div key={i} className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl pl-3 pr-1.5 py-1.5 shadow-sm group animate-in zoom-in-95 duration-200">
                                                    <span className="text-xs font-bold text-slate-700">{t.name}</span>
                                                    {editingPriceIdx === i ? (
                                                        <input
                                                            type="number"
                                                            autoFocus
                                                            min="0"
                                                            step="0.01"
                                                            className="w-16 text-xs font-black text-blue-600 bg-blue-50 border border-blue-300 rounded-lg px-1.5 py-0.5 outline-none focus:ring-2 focus:ring-blue-400"
                                                            value={editingPriceValue}
                                                            onChange={e => setEditingPriceValue(e.target.value)}
                                                            onBlur={() => handleUpdateServicePrice(i, parseFloat(editingPriceValue) || 0)}
                                                            onKeyDown={e => {
                                                                if (e.key === 'Enter') handleUpdateServicePrice(i, parseFloat(editingPriceValue) || 0);
                                                                if (e.key === 'Escape') { setEditingPriceIdx(null); setEditingPriceValue(''); }
                                                            }}
                                                        />
                                                    ) : (
                                                        <button
                                                            title="Editar precio"
                                                            onClick={() => { setEditingPriceIdx(i); setEditingPriceValue(String(t.price)); }}
                                                            className="text-xs font-black text-blue-600 hover:text-blue-800 hover:underline cursor-pointer transition-colors"
                                                        >
                                                            {t.price}€
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => handleRemoveTreatmentFromList(i)}
                                                        className="w-5 h-5 flex items-center justify-center bg-slate-100 hover:bg-red-500 text-slate-400 hover:text-white rounded-lg transition-all"
                                                    >
                                                        <Plus size={12} className="rotate-45" />
                                                    </button>
                                                </div>
                                            ))}
                                            <div className="w-full text-right text-xs font-black text-blue-600 pt-1">
                                                Subtotal: {selectedDbServices.reduce((sum, t) => sum + t.price, 0).toFixed(2)}€
                                            </div>
                                        </div>
                                    )}

                                    {/* Unified Input + Add Button */}
                                    <div className="relative group">
                                        <div className="flex gap-2">
                                            <div className="relative flex-1">
                                                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                                <input
                                                    type="text"
                                                    placeholder="Buscar servicio o escribir texto libre..."
                                                    value={bookingServiceSearch}
                                                    onChange={e => {
                                                        setBookingServiceSearch(e.target.value);
                                                        setShowServiceDropdown(true);
                                                    }}
                                                    onFocus={() => setShowServiceDropdown(true)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') {
                                                            e.preventDefault();
                                                            handleAddTreatmentToList();
                                                        }
                                                    }}
                                                    className="w-full bg-slate-50 focus:bg-white pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-bold text-slate-700 transition-all placeholder:font-medium placeholder:text-slate-400"
                                                />
                                            </div>
                                            <button
                                                onClick={handleAddTreatmentToList}
                                                disabled={!bookingServiceSearch.trim()}
                                                className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white rounded-2xl font-black text-xs uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all flex items-center gap-2"
                                            >
                                                <Plus size={18} />
                                                <span className="hidden sm:inline">Añadir</span>
                                            </button>
                                        </div>

                                        {/* Dropdown Results */}
                                        {showServiceDropdown && bookingServiceSearch.trim().length > 0 && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[1.5rem] shadow-2xl z-[120] max-h-60 overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                                {/* Custom Entry Option */}
                                                <div 
                                                    onClick={handleAddTreatmentToList}
                                                    className="flex items-center gap-3 px-5 py-3 hover:bg-blue-50 cursor-pointer border-b border-slate-100 transition-colors group"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                                        <Sparkles size={16} />
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-black text-blue-600 group-hover:text-blue-700">Añadir "{bookingServiceSearch}"</p>
                                                        <p className="text-[10px] text-slate-400 font-bold">Concepto libre a coste 0€</p>
                                                    </div>
                                                </div>

                                                {(() => {
                                                    const filtered = dbServices.filter(s =>
                                                        s.name.toLowerCase().includes(bookingServiceSearch.toLowerCase()) ||
                                                        (s.specialty_name || '').toLowerCase().includes(bookingServiceSearch.toLowerCase())
                                                    ).filter(s => !selectedDbServices.some(sel => sel.id === s.id)).slice(0, 15);

                                                    return filtered.map(svc => (
                                                        <div
                                                            key={svc.id}
                                                            onClick={() => handlePushTreatment({
                                                                id: svc.id,
                                                                name: svc.name,
                                                                price: svc.final_price || 0
                                                            })}
                                                            className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-50 last:border-0 transition-colors group"
                                                        >
                                                            <div>
                                                                <p className="text-sm font-bold text-slate-700 group-hover:text-blue-700">{svc.name}</p>
                                                                {svc.specialty_name && (
                                                                    <p className="text-[10px] text-slate-400 font-bold group-hover:text-blue-400">{svc.specialty_name}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3">
                                                                <span className="text-xs font-black text-slate-400 group-hover:text-blue-600">
                                                                    {(svc.final_price || 0) > 0 ? `${svc.final_price}€` : 'Gratis'}
                                                                </span>
                                                                <div className="w-6 h-6 rounded-lg bg-slate-100 group-hover:bg-blue-600 flex items-center justify-center transition-colors">
                                                                    <Plus size={14} className="text-slate-400 group-hover:text-white" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ));
                                                })()}
                                            </div>
                                        )}
                                        {/* Click outside to close */}
                                        {showServiceDropdown && (
                                            <div className="fixed inset-0 z-[-1]" onClick={() => setShowServiceDropdown(false)} />
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Revisión Toggle */}
                            <div className="flex items-center gap-3 py-2">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={bookingIsRevision}
                                        onChange={(e) => setBookingIsRevision(e.target.checked)}
                                        className="w-4 h-4 rounded border-slate-300 text-cyan-600 focus:ring-cyan-500"
                                    />
                                    <span className="text-xs font-bold uppercase text-slate-500">↩ Marcar como Revisión</span>
                                </label>
                                {bookingIsRevision && (
                                    <span className="bg-cyan-100 text-cyan-700 text-[10px] font-black px-2 py-0.5 rounded-full">REVISIÓN</span>
                                )}
                            </div>

                            {/* Duration Selector — free numeric input */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Duración (minutos)</label>
                                <input
                                    type="number"
                                    min={1}
                                    max={480}
                                    step={1}
                                    className="w-full bg-slate-50 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600 focus:bg-white focus:border-blue-400 transition-all"
                                    value={bookingDuration}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        if (!isNaN(val) && val > 0) setBookingDuration(val);
                                    }}
                                    placeholder="ej. 121"
                                />
                                {/* Quick-select chips */}
                                <div className="flex gap-1.5 mt-2 flex-wrap">
                                    {[15, 30, 45, 60, 90].map(min => (
                                        <button
                                            key={min}
                                            type="button"
                                            onClick={() => setBookingDuration(min)}
                                            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${bookingDuration === min ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                                        >
                                            {min} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Restored Observations Field */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Observaciones de la Cita</label>
                                <textarea
                                    className="w-full bg-slate-50/80 p-3 rounded-xl border border-slate-200 mt-2 outline-none font-bold text-slate-600 h-20 resize-none focus:bg-white focus:border-blue-400 transition-all text-sm placeholder:font-normal"
                                    placeholder="Notas adicionales sobre este tratamiento..."
                                    value={bookingObservation}
                                    onChange={e => setBookingObservation(e.target.value)}
                                />
                            </div>

                            {/* Restored Visit Details Field */}
                            <div>
                                <label className="text-xs font-bold uppercase text-slate-400">Detalles de la Visita (Alertas)</label>
                                <textarea
                                    className="w-full bg-purple-50/50 p-3 rounded-xl border border-purple-200 mt-2 outline-none font-bold text-purple-700 h-16 resize-none focus:bg-white focus:border-purple-400 transition-all text-sm placeholder:font-normal"
                                    placeholder="Pago pendiente, patologías, indicaciones especiales..."
                                    value={bookingVisitDetails}
                                    onChange={e => setBookingVisitDetails(e.target.value)}
                                />
                            </div>

                            {/* Última modificación */}
                            {selectedAppt && (selectedAppt as any).updated_by_name && (
                                <div className="text-xs text-slate-400 pt-1">
                                    <span className="font-semibold">Última modificación:</span> ✎ {(selectedAppt as any).updated_by_name}
                                </div>
                            )}

                            {/* Quick Status Buttons */}
                            {selectedAppt && !isDuplicating && (
                                <div className="pt-2">
                                    <label className="text-xs font-bold uppercase text-slate-400 block mb-2">Estado de la cita</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { status: 'Scheduled', label: 'Pendiente', color: 'bg-slate-100 text-slate-700 border-slate-300 hover:bg-slate-200' },
                                            { status: 'Completed', label: '✓ Realizada', color: 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100' },
                                            { status: 'NoShow', label: '⚠ No Vino', color: 'bg-amber-50 text-amber-700 border-amber-300 hover:bg-amber-100' },
                                            { status: 'Canceled', label: '✕ Anular', color: 'bg-red-50 text-red-700 border-red-300 hover:bg-red-100' },
                                        ].map(({ status, label, color }) => {
                                            const currentStatus = (selectedAppt.status || '').toLowerCase();
                                            const isActive = currentStatus === status.toLowerCase() ||
                                                (status === 'Scheduled' && (currentStatus === 'scheduled' || currentStatus === 'pendiente')) ||
                                                (status === 'Completed' && (currentStatus === 'completed' || currentStatus === 'realizada')) ||
                                                (status === 'NoShow' && (currentStatus === 'noshow' || currentStatus === 'no vino')) ||
                                                (status === 'Canceled' && (currentStatus === 'canceled' || currentStatus === 'cancelled' || currentStatus === 'anulada'));
                                            return (
                                                <button
                                                    key={status}
                                                    onClick={() => handleQuickStatusChange(status)}
                                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${color} ${isActive ? 'ring-2 ring-offset-1 ring-current font-black' : ''}`}
                                                >
                                                    {label}
                                            </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

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

                                            setIsBooking(true);

                                            const result = await api.appointments.update(selectedAppt.id, {
                                                date: `${bookingDate}T00:00:00.000Z`,
                                                time: bookingTime,
                                                patientId: bookingPatientId,
                                                doctorId: bookingDoctorId,
                                                treatmentName: !bookingBudgetId && selectedDbServices.length > 0 
                                                    ? selectedDbServices.map(t => t.name).join(', ')
                                                    : (bookingTreatment || null),
                                                // Send 0 explicitly only for free revisions; otherwise null if no price set.
                                                amount: bookingIsRevision ? bookingPrice : (bookingPrice > 0 ? bookingPrice : null),
                                                duration: bookingDuration,
                                                observations: bookingObservation || null,
                                                visitDetails: bookingVisitDetails || null,
                                                budgetId: bookingBudgetId || null,
                                                budgetItemId: bookingBudgetItemId || null,
                                                status: (selectedAppt as any).status || 'Scheduled',
                                                isRevision: bookingIsRevision,
                                                serviceIds: selectedDbServices.length > 0 
                                                    ? selectedDbServices.filter(s => !s.id.startsWith('custom-')).map(s => s.id) 
                                                    : undefined,
                                                serviceBreakdown: selectedDbServices.length > 0
                                                    ? selectedDbServices.map(s => ({
                                                        id: s.id,
                                                        name: s.name,
                                                        price: s.price,
                                                        excludeFromLiquidation: s.excludeFromLiquidation ?? false
                                                      }))
                                                    : undefined,
                                            });

                                            // Immediately update local state with updated_by_name from current user
                                            const enrichedResult = { ...result, updated_by_name: result.updated_by_name || (currentUser as any)?.name || null };
                                            setAppointments(prev => prev.map(a => a.id === enrichedResult.id ? { ...a, ...enrichedResult } : a));
                                            // Then also refresh from server for consistency
                                            await refreshAppointments();
                                            setIsAppointmentModalOpen(false);
                                            setIsEditingAppt(false);
                                            setSelectedAppt(null);
                                            toast.success("Cita actualizada con éxito.");
                                        } catch (e: any) {
                                            console.error('❌ Update appointment error:', e);
                                            toast.error('Error al actualizar: ' + (e.message || "Error desconocido"));
                                        } finally {
                                            setIsBooking(false);
                                        }
                                    }}
                                    disabled={isBooking}
                                    className="flex-1 bg-emerald-600 text-white py-3 rounded-xl font-bold uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                >
                                    {isBooking ? <><Loader2 className="animate-spin w-4 h-4" /> Guardando...</> : <><Save size={16} /> Guardar Cambios</>}
                                </button>
                            )}
                            {!selectedAppt && (
                                <button onClick={handleBooking} disabled={isBooking} className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg disabled:opacity-50">
                                    {isBooking ? <><Loader2 className="animate-spin w-4 h-4" /> Guardando...</> : 'Confirmar'}
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            )
            }
        </div >

            <NewPatientModal
                isOpen={isQuickNewPatientOpen}
                onClose={() => setIsQuickNewPatientOpen(false)}
                onPatientCreated={(patient) => {
                    setApptSearch(patient.name);
                    setBookingPatientId(patient.id);
                    setIsQuickNewPatientOpen(false);
                }}
            />

            <PackSelectionModal
                isOpen={isPackSelectionModalOpen}
                onClose={() => setIsPackSelectionModalOpen(false)}
                onSelectPack={handleSelectPack}
            />
        </>
    );
};

export default Agenda;
