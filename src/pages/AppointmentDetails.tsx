import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar, User, CreditCard, FileText, Smile } from 'lucide-react';
import { Appointment, Patient, Budget, Payment } from '../../types';
import { PaymentModal } from '../components/PaymentModal';
import { Odontogram } from '../../components/Odontogram';
import { useAppContext } from '../context/AppContext';

export const AppointmentDetails: React.FC = () => {
    const { appointmentId } = useParams<{ appointmentId: string }>();
    const location = useLocation();
    const navigate = useNavigate();
    const { patients, api, refreshAppointments } = useAppContext();

    const [appointment, setAppointment] = useState<Appointment | null>(null);
    const [patient, setPatient] = useState<Patient | null>(null);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<'summary' | 'odontogram' | 'treatments' | 'documents'>('summary');
    const [toothStates, setToothStates] = useState<Record<string, string>>({});

    // Cargar datos desde location.state o API
    useEffect(() => {
        if (location.state?.appointment && location.state?.patient) {
            setAppointment(location.state.appointment);
            setPatient(location.state.patient);
            loadToothStates(location.state.patient.id);
        } else if (appointmentId) {
            // Cargar desde API
            loadAppointmentData(appointmentId);
        }
    }, [appointmentId, location.state]);

    // Cargar presupuestos del paciente
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

            const patientData = patients.find(p => p.id === appointmentData.patientId);
            setPatient(patientData || null);
            
            if (patientData) {
                loadToothStates(patientData.id);
            }
        } catch (error) {
            console.error('Error loading appointment:', error);
            alert('Error al cargar la cita');
            navigate('/agenda');
        }
    };

    const loadToothStates = async (patientId: string) => {
        try {
            const states = await api.getPatientToothStates(patientId);
            setToothStates(states || {});
        } catch (error) {
            console.warn('Could not load tooth states:', error);
        }
    };

    const handlePaymentComplete = (payment: Payment, invoice: any) => {
        console.log('Payment completed:', payment);
        console.log('Invoice generated:', invoice);

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
                return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'No Vino' };
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

    if (!appointment || !patient) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900"></div>
            </div>
        );
    }

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
                                {new Date(appointment.date).toLocaleDateString('es-ES')} - {appointment.time}
                            </p>
                        </div>
                    </div>

                    <button
                        onClick={() => setIsPaymentModalOpen(true)}
                        className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase shadow-lg hover:shadow-xl transition-all flex items-center gap-2"
                    >
                        <CreditCard size={20} />
                        Cobrar / Pagar
                    </button>
                </div>

                {/* Patient Info Card */}
                <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                    <div className="flex items-start gap-6">
                        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-lg">
                            {patient.name.charAt(0)}
                        </div>
                        <div className="flex-1">
                            <h2 className="text-2xl font-black text-slate-900">{patient.name}</h2>
                            <div className="grid grid-cols-3 gap-4 mt-4">
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">DNI</p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{patient.dni}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">Email</p>
                                    <p className="text-sm font-bold text-slate-900 mt-1">{patient.email}</p>
                                </div>
                                <div>
                                    <p className="text-xs font-black uppercase text-slate-400">Monedero</p>
                                    <p className="text-sm font-black text-green-600 mt-1">{patient.wallet || 0}€</p>
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
                    </div>

                    {/* Appointment Details */}
                    <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100">
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Fecha</p>
                            <p className="text-sm font-bold text-slate-900 mt-1">
                                {new Date(appointment.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Hora</p>
                            <p className="text-sm font-bold text-slate-900 mt-1">{appointment.time}</p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">Tratamiento</p>
                            <p className="text-sm font-bold text-slate-900 mt-1">
                                {typeof appointment.treatment === 'object' && appointment.treatment !== null
                                    ? (appointment.treatment as any).name || '-'
                                    : appointment.treatment || '-'}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs font-black uppercase text-slate-400">N° Historia</p>
                            <p className="text-sm font-bold text-blue-600 mt-1">{patient.historyNumber || '-'}</p>
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

                {/* Tabs Navigation */}
                <div className="flex gap-2 bg-white rounded-[2.5rem] p-2 border border-slate-200 shadow-sm">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'summary'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Calendar size={16} /> Resumen
                    </button>
                    <button
                        onClick={() => setActiveTab('odontogram')}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'odontogram'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Smile size={16} /> Odontograma
                    </button>
                    <button
                        onClick={() => setActiveTab('treatments')}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'treatments'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <User size={16} /> Tratamientos
                    </button>
                    <button
                        onClick={() => setActiveTab('documents')}
                        className={`flex-1 py-3 px-4 rounded-2xl font-black text-sm uppercase transition-all flex items-center justify-center gap-2 ${
                            activeTab === 'documents'
                                ? 'bg-slate-900 text-white shadow-lg'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileText size={16} /> Documentos
                    </button>
                </div>

                {/* Tab Content */}
                <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
                    {activeTab === 'summary' && (
                        <div className="p-8 min-h-[400px]">
                            <div className="animate-in fade-in slide-in-from-bottom-4">
                                <h3 className="text-2xl font-black text-slate-900 mb-6">Resumen de la Cita</h3>
                                
                                <div className="grid grid-cols-2 gap-6 mb-6">
                                    <div className="bg-blue-50 rounded-2xl p-6 border border-blue-100">
                                        <p className="text-xs font-black uppercase text-blue-600 mb-2">QUÉ SE ESTÁ HACIENDO</p>
                                        <p className="text-lg font-black text-slate-900 break-words">
                                            {typeof appointment.treatment === 'object' && appointment.treatment !== null
                                                ? (appointment.treatment as any).name || 'Consulta'
                                                : appointment.treatment || 'Consulta / Tratamiento'}
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
                                    <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
                                        <p className="text-xs font-black uppercase text-slate-600 mb-2">NOTAS / OBSERVACIONES</p>
                                        <p className="text-slate-900 font-medium">{appointment.observations}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'odontogram' && (
                        <div className="p-8 min-h-[500px] flex items-center justify-center">
                            <div className="w-full">
                                <h3 className="text-2xl font-black text-slate-900 mb-6">Odontograma del Paciente</h3>
                                <Odontogram patientId={patient.id} readOnly={false} />
                            </div>
                        </div>
                    )}

                    {activeTab === 'treatments' && (
                        <div className="p-8 min-h-[400px]">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Tratamientos del Paciente</h3>
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center text-slate-600 font-medium">
                                <p>Los tratamientos se muestran en la ficha del paciente.</p>
                                <button
                                    onClick={() => navigate(`/patients/${patient.id}`)}
                                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm uppercase"
                                >
                                    Ver Ficha Completa
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'documents' && (
                        <div className="p-8 min-h-[400px]">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Documentos del Paciente</h3>
                            <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200 text-center text-slate-600 font-medium">
                                <p>Los documentos se muestran en la ficha del paciente.</p>
                                <button
                                    onClick={() => navigate(`/patients/${patient.id}`)}
                                    className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-bold text-sm uppercase"
                                >
                                    Ver Ficha Completa
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                patient={patient}
                budgets={budgets}
                onPaymentComplete={handlePaymentComplete}
                appointment={appointment}
                defaultAmount={appointment.amount || (typeof appointment.treatment === 'object' ? (appointment.treatment as any).price : 0)}
                defaultConcept={typeof appointment.treatment === 'object' ? (appointment.treatment as any).name : appointment.treatment || 'Consulta / Tratamiento'}
            />
        </div>
    );
};

export default AppointmentDetails;
