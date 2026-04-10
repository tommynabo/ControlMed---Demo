import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CreditCard, Calendar, Trash2, Check, FileText } from 'lucide-react';
import { Appointment, Patient, Budget, Payment, Invoice } from '../../types';
import { PaymentModal } from '../components/PaymentModal';
import { useAppContext } from '../context/AppContext';
import { DENTAL_SERVICES, DURATION_OPTIONS } from '../constants';

export const AppointmentDetails: React.FC = () => {
    const { appointmentId } = useParams<{ appointmentId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { patients, api, refreshAppointments, refreshInvoices, doctors } = useAppContext();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [invoice, setInvoice] = useState<any>(null);

    useEffect(() => {
        if (location.state?.appointment && location.state?.patient) {
            setAppointment(location.state.appointment);
            setPatient(location.state.patient);
        } else if (appointmentId) {
            loadAppointmentData(appointmentId);
        }
    }, [appointmentId, location.state]);

    useEffect(() => {
        if (appointment?.paid && appointmentId) {
            api.invoices.getByAppointment(appointmentId)
                .then(setInvoice)
                .catch(err => console.error('Error fetching invoice:', err));
        } else {
            setInvoice(null);
        }
    }, [appointment?.paid, appointmentId]);

    useEffect(() => {
        if (patient) {
            api.budget.getByPatient(patient.id)
                .then(setBudgets)
                .catch(err => console.error('Error loading budgets:', err));
        }
    }, [patient]);

    const loadAppointmentData = async (id: string) => {
        try {
            const appointmentData = await api.appointments.getById(id);
            setAppointment(appointmentData);

            // Try to find patient locally first, then use joined data from API, then create a minimal fallback
            const patientData = patients.find(p => p.id === appointmentData.patientId)
                || (appointmentData as any).patient
                || null;
            setPatient(patientData);
        } catch (error) {
            console.error('Error loading appointment:', error);
            alert('Error al cargar la cita');
            navigate('/agenda');
        }
    };

    const handlePaymentComplete = (payment: Payment, invoiceData: any) => {
        console.log('Payment completed:', payment);

        // Mark appointment as paid locally to update UI immediately 
        setAppointment({ ...appointment, paid: true, status: 'Completed' });

        if (invoiceData?.invoice) {
            setInvoice(invoiceData.invoice);
        }

        if (payment.type === 'ADVANCE_PAYMENT' && patient) {
            const updatedPatient = {
                ...patient,
                wallet: (patient.wallet || 0) + payment.amount
            };
            setPatient(updatedPatient);
        }

        if (patient) {
            api.budget.getByPatient(patient.id).then(setBudgets);
        }

        // Refresh global state so CashRegister/Caja and Agenda reflect the payment
        refreshAppointments();
        refreshInvoices();
    };

    const getStatusStyle = (status: string) => {
        switch (status?.toLowerCase()) {
            case 'completed':
            case 'realizada':
                return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Realizada' };
            case 'canceled':
            case 'cancelled':
            case 'anulada':
                return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200', label: 'Anulada' };
            case 'noshow':
            case 'no vino':
                return { bg: 'bg-fuchsia-100', text: 'text-fuchsia-700', border: 'border-fuchsia-200', label: 'No Vino' };
            default:
                return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200', label: 'Pendiente' };
        }
    };

    const updateAppointmentStatus = async (newStatus: string) => {
        if (!appointment) return;
        try {
            await api.appointments.update(appointment.id, { status: newStatus });
            setAppointment({ ...appointment, status: newStatus });
            await refreshAppointments();
            alert(`✅ Estado actualizado a: ${newStatus}`);
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Error al actualizar el estado');
        }
    };

    const getTreatmentName = (appt: any) => {
        if (!appt) return "Tratamiento no especificado";

        // 1. Snapshot name / Manual name
        if (appt.treatmentName) return appt.treatmentName;

        // 2. Relation name
        if (typeof appt.treatment === 'object' && appt.treatment !== null) {
            return (appt.treatment as any).name;
        }

        if (typeof appt.treatment === 'string' && appt.treatment) {
            return appt.treatment;
        }

        // 3. Budget Items Fallback
        if (appt.budget?.items?.length > 0) {
            return appt.budget.items.map((i: any) => i.name).join(', ');
        }

        return "Tratamiento no especificado";
    };

    const displayConcept = getTreatmentName(appointment);

    if (!appointment) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

    // Create a safe patient object — orphan appointments still render
    const safePatient = patient || {
        id: appointment.patientId || '',
        name: '⚠️ Paciente Desconocido',
        dni: 'N/A',
        email: 'N/A',
        phone: '',
        historyNumber: '',
        wallet: 0,
        alerts: [] as string[]
    } as Patient;
    const isOrphanPatient = !patient;

    return (
        <div className="min-h-screen bg-slate-50 p-8">
            <div className="max-w-7xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate('/agenda')}
                            className="p-3 bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div>
                            <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                                Gestión de Cita
                            </h1>
                            <p className="text-sm text-slate-500 font-medium mt-1">
                                {new Date(appointment.date).toLocaleDateString('es-ES', { timeZone: 'UTC' })} - {appointment.time}
                            </p>
                        </div>
                    </div>

                    {appointment.paid ? (
                        <div className="flex gap-4">
                            <div className="bg-green-100 text-green-700 px-8 py-4 rounded-2xl text-sm font-black uppercase flex items-center gap-2 border border-green-200">
                                <Check size={20} />
                                Cobrado ✓
                            </div>
                            {invoice?.url && (
                                <button
                                    onClick={() => window.open(invoice.url, '_blank')}
                                    className="bg-white border-2 border-slate-900 text-slate-900 px-8 py-4 rounded-2xl text-sm font-black uppercase hover:bg-slate-100 transition-all flex items-center gap-2"
                                >
                                    <FileText size={20} />
                                    📄 Ver Factura
                                </button>
                            )}
                        </div>
                    ) : (
                        <button
                            onClick={() => setIsPaymentModalOpen(true)}
                            className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                        >
                            <CreditCard size={20} />
                            Cobrar / Pagar
                        </button>
                    )}
                </div>

                {/* Patient Info Card */}
                <div className={`bg-white rounded-[2.5rem] p-8 border ${isOrphanPatient ? 'border-amber-300' : 'border-slate-200'} shadow-sm`}>
                    {isOrphanPatient && (
                        <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs font-bold text-amber-700">
                            ⚠️ Dato huérfano — el paciente original no fue encontrado en el sistema
                        </div>
                    )}
                    <div className="flex items-start gap-6">
                        <div className={`w-20 h-20 ${isOrphanPatient ? 'bg-gradient-to-br from-amber-400 to-orange-400' : 'bg-gradient-to-br from-blue-500 to-indigo-500'} rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg`}>
                            {safePatient.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-slate-900">{safePatient.name}</h2>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">DNI</p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{safePatient.dni}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">Email</p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{safePatient.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">Monedero</p>
                                    <p className="text-sm font-black text-green-600 mt-1">{safePatient.wallet || 0}€</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Status & Actions Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <h3 className="text-lg font-black text-slate-900">Estado de la Cita</h3>
                            {(() => {
                                const style = getStatusStyle(appointment.status);
                                return (
                                    <span className={`px-4 py-2 rounded-xl text-sm font-black uppercase ${style.bg} ${style.text} border ${style.border}`}>
                                        {style.label}
                                    </span>
                                );
                            })()}
                        </div>

                        {!['completed', 'realizada', 'canceled', 'cancelled', 'anulada', 'noshow', 'no vino'].includes(appointment.status?.toLowerCase() || '') && (
                            <div className="flex gap-3">
                                <button
                                    onClick={() => updateAppointmentStatus('Completed')}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-lg transition-all flex items-center gap-2"
                                >
                                    ✓ Realizada
                                </button>
                                <button
                                    onClick={() => updateAppointmentStatus('Canceled')}
                                    className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-lg transition-all flex items-center gap-2"
                                >
                                    ✕ Anulada
                                </button>
                                <button
                                    onClick={() => updateAppointmentStatus('NoShow')}
                                    className="bg-amber-500 hover:bg-amber-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-lg transition-all flex items-center gap-2"
                                >
                                    ⚠ No Vino
                                </button>
                            </div>
                        )}

                        {['completed', 'realizada', 'canceled', 'cancelled', 'anulada', 'noshow', 'no vino'].includes(appointment.status?.toLowerCase() || '') && (
                            <button
                                onClick={() => updateAppointmentStatus('Scheduled')}
                                className="bg-slate-500 hover:bg-slate-600 text-white px-6 py-3 rounded-xl text-xs font-black uppercase shadow-lg transition-all"
                            >
                                ↺ Restablecer Pendiente
                            </button>
                        )}

                        <button
                            onClick={async () => {
                                if (window.confirm('¿Estás seguro de que deseas eliminar esta cita permanentemente?')) {
                                    try {
                                        await api.appointments.delete(appointment.id);
                                        await refreshAppointments();
                                        alert('✅ Cita eliminada correctamente');
                                        navigate('/agenda');
                                    } catch (error) {
                                        console.error('Error al eliminar la cita:', error);
                                        alert('Error al eliminar la cita');
                                    }
                                }
                            }}
                            className="bg-red-100 hover:bg-red-200 text-red-600 px-4 py-3 rounded-xl text-xs font-black uppercase shadow-sm transition-all flex items-center gap-2 ml-4"
                            title="Eliminar Cita"
                        >
                            <Trash2 size={18} />
                            Eliminar
                        </button>
                    </div>

                    {/* Appointment Details */}
                    <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Fecha</p>
                            <input
                                type="date"
                                value={appointment.date ? new Date(appointment.date).toISOString().split('T')[0] : ''}
                                onChange={async (e) => {
                                    const newDate = e.target.value;
                                    try {
                                        const isoDate = `${newDate}T00:00:00.000Z`;
                                        await api.appointments.update(appointment.id, { date: isoDate });
                                        setAppointment({ ...appointment, date: isoDate as any });
                                        refreshAppointments();
                                    } catch (err) { console.error('Error al actualizar fecha:', err); }
                                }}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Hora</p>
                            <input
                                type="time"
                                value={appointment.time || ''}
                                onChange={async (e) => {
                                    const newTime = e.target.value;
                                    try {
                                        await api.appointments.update(appointment.id, { time: newTime });
                                        setAppointment({ ...appointment, time: newTime });
                                        refreshAppointments();
                                    } catch (err) { console.error('Error al actualizar hora:', err); }
                                }}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                        <div className="col-span-2">
                            <p className="text-xs font-black uppercase text-slate-400">Tratamiento / Concepto</p>
                            <div className="flex gap-2">
                                <select 
                                    className="mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                    onChange={async (e) => {
                                        const svc = DENTAL_SERVICES.find(s => s.name === e.target.value);
                                        if (svc) {
                                            try {
                                                await api.appointments.update(appointment.id, { 
                                                    treatmentName: svc.name,
                                                    amount: svc.price 
                                                });
                                                setAppointment({ ...appointment, treatmentName: svc.name, amount: svc.price });
                                            } catch (err) { console.error(err); }
                                        }
                                    }}
                                >
                                    <option value="">Seleccionar...</option>
                                    {DENTAL_SERVICES.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                                <input
                                    type="text"
                                    value={appointment.treatmentName || (typeof appointment.treatment === 'object' ? (appointment.treatment as any)?.name : (appointment.treatment as string)) || ''}
                                    onChange={async (e) => {
                                        const newVal = e.target.value;
                                        setAppointment({ ...appointment, treatmentName: newVal });
                                    }}
                                    onBlur={async (e) => {
                                        try {
                                            await api.appointments.update(appointment.id, { treatmentName: e.target.value });
                                            refreshAppointments();
                                        } catch (err) { console.error(err); }
                                    }}
                                    className="flex-1 mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                />
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Doctor</p>
                            <select
                                value={appointment.doctorId || ''}
                                onChange={async (e) => {
                                    const newDocId = e.target.value;
                                    try {
                                        await api.appointments.update(appointment.id, { doctorId: newDocId });
                                        setAppointment({ ...appointment, doctorId: newDocId });
                                        refreshAppointments();
                                    } catch (err) { console.error('Error al actualizar doctor:', err); }
                                }}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">Seleccionar...</option>
                                {doctors.map(d => (
                                    <option key={d.id} value={d.id}>{d.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Duración</p>
                            <select
                                value={appointment.duration || 60}
                                onChange={async (e) => {
                                    const newDuration = parseInt(e.target.value);
                                    try {
                                        await api.appointments.update(appointment.id, { duration: newDuration });
                                        setAppointment({ ...appointment, duration: newDuration });
                                        refreshAppointments();
                                    } catch (err) { console.error('Error al actualizar duración:', err); }
                                }}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                {DURATION_OPTIONS.map(opt => (
                                    <option key={opt} value={opt}>{opt} min</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">N° Historia</p>
                            <p className="text-sm font-bold text-blue-600 mt-1">{safePatient.historyNumber || '-'}</p>
                        </div>
                        {/* Budget Selector */}
                        <div className="col-span-2">
                            <p className="text-xs font-black uppercase text-slate-400">Presupuesto Asociado</p>
                            <select
                                value={appointment.budgetId || ''}
                                onChange={async (e) => {
                                    const newBudgetId = e.target.value;
                                    try {
                                        await api.appointments.update(appointment.id, { budgetId: newBudgetId || null });
                                        setAppointment({ ...appointment, budgetId: newBudgetId || undefined });
                                    } catch (err) {
                                        alert('Error al vincular presupuesto');
                                    }
                                }}
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                <option value="">-- Sin vincular --</option>
                                {budgets.map(b => (
                                    <option key={b.id} value={b.id}>
                                        {b.title} ({b.totalPrice}€)
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Importe */}
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Importe (€)</p>
                            <input
                                type="number"
                                step="0.01"
                                value={appointment.amount || ''}
                                onChange={async (e) => {
                                    const newAmount = parseFloat(e.target.value) || null;
                                    try {
                                        await api.appointments.update(appointment.id, { amount: newAmount });
                                        setAppointment({ ...appointment, amount: newAmount || undefined });
                                    } catch (err) {
                                        console.error('Error al actualizar importe:', err);
                                    }
                                }}
                                placeholder="Importe"
                                className="w-full mt-1 bg-white border border-slate-200 rounded-xl p-2 text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>

                        {/* Estado de Pago */}
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Pagado</p>
                            <label className="flex items-center gap-2 mt-2">
                                <input
                                    type="checkbox"
                                    checked={appointment.paid || false}
                                    onChange={async (e) => {
                                        const newPaid = e.target.checked;
                                        try {
                                            await api.appointments.update(appointment.id, { paid: newPaid });
                                            setAppointment({ ...appointment, paid: newPaid });
                                        } catch (err) {
                                            console.error('Error al actualizar estado de pago:', err);
                                        }
                                    }}
                                    className="w-5 h-5 rounded border-slate-300"
                                />
                                <span className="text-sm font-bold text-slate-700">
                                    {appointment.paid ? '✓ Pagada' : 'Pendiente'}
                                </span>
                            </label>
                        </div>

                        {/* Observaciones */}
                        <div className="col-span-4">
                            <p className="text-xs font-black uppercase text-slate-400 mb-2">
                                Observaciones de la Cita
                            </p>
                            <textarea
                                value={appointment.observations || ''}
                                onChange={async (e) => {
                                    const newObservations = e.target.value;
                                    setAppointment({ ...appointment, observations: newObservations });
                                }}
                                onBlur={async (e) => {
                                    try {
                                        await api.appointments.update(appointment.id, { observations: e.target.value });
                                    } catch (err) {
                                        console.error('Error al guardar observaciones:', err);
                                    }
                                }}
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm outline-none focus:ring-2 focus:ring-blue-100"
                                rows={3}
                                placeholder="Notas internas sobre esta cita..."
                            />
                        </div>
                    </div>
                </div>

                {/* Summary Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <div className="animate-in fade-in slide-in-from-bottom-4">
                        <h3 className="text-2xl font-black text-slate-900 mb-6">Resumen de la Cita</h3>

                        <div className="grid grid-cols-2 gap-6 mb-6">
                            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                                <p className="text-xs font-black uppercase text-blue-600 mb-2">QUÉ SE ESTÁ HACIENDO</p>
                                <p className="text-lg font-black text-slate-900 break-words">
                                    {displayConcept}
                                </p>
                            </div>

                            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
                                <p className="text-xs font-black uppercase text-amber-600 mb-2">DURACIÓN</p>
                                <p className="text-lg font-black text-slate-900">
                                    {appointment.duration ? `${appointment.duration} minutos` : '60 minutos'}
                                </p>
                            </div>

                            {appointment.budgetId && (
                                <div className="bg-green-50 rounded-2xl p-6 border border-green-100">
                                    <p className="text-xs font-black uppercase text-green-600 mb-2">VINCULADO A PRESUPUESTO</p>
                                    <p className="text-sm font-black text-slate-900">✓ Presupuesto Asociado</p>
                                </div>
                            )}

                            <div className="bg-purple-50 rounded-2xl p-6 border border-purple-100">
                                <p className="text-xs font-black uppercase text-purple-600 mb-2">A COBRAR HOY</p>
                                <p className="text-lg font-black text-slate-900">
                                    {appointment.amount ? `${appointment.amount}€` : 'Por confirmar'}
                                </p>
                            </div>
                        </div>

                        {appointment.observations && (
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 mb-6">
                                <p className="text-xs font-black uppercase text-slate-600 mb-2">NOTAS / OBSERVACIONES</p>
                                <p className="text-slate-900 font-medium">{appointment.observations}</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                patient={safePatient}
                budgets={budgets}
                onPaymentComplete={handlePaymentComplete}
                appointment={appointment}
                defaultAmount={appointment.amount || (typeof appointment.treatment === 'object' ? (appointment.treatment as any).price : 0)}
                defaultConcept={displayConcept}
            />
        </div>
    );
};

export default AppointmentDetails;
