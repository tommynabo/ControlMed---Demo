import React, { useState, useMemo, useRef } from 'react';
import {
    Search, Plus, Filter, UserCheck, ShieldCheck, Mail, CheckCircle2, Edit, Check, Edit3, Trash2,
    ArrowUp, Activity, FileText, ClipboardCheck, Layers, DollarSign, PenTool, Smile, Calculator,
    Phone, Settings, Download, Zap, TrendingUp, CreditCard, Clock, FileText as FileTextIcon, // Alias for conflict
    QrCode, Wallet, AlertTriangle
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { Patient, ClinicalRecord, Specialization, Doctor, Invoice, Appointment, PatientTreatment } from '../../types';
import { Odontogram } from '../components/Odontogram';
import { PaymentModal } from '../components/PaymentModal';
import { TransferBalanceModal } from '../components/TransferBalanceModal';
import { TreatmentsList } from '../components/TreatmentsList';
import { PaymentsList } from '../components/PaymentsList';
import { FinanceModal } from '../../components/FinanceModal';
import { DOCTORS, DENTAL_SERVICES } from '../constants';

const Patients: React.FC = () => {
    const {
        patients, setPatients, searchQuery, setSearchQuery,
        selectedPatient, setSelectedPatient, clinicalRecords, setClinicalRecords,
        invoices, setInvoices, api
    } = useAppContext();


    // Navigation State
    const [patientTab, setPatientTab] = useState<string>('ficha');

    // Local State for Budgets
    const [budgets, setBudgets] = useState<any[]>([]);

    // Fetch budgets when patient is selected or tab changes
    React.useEffect(() => {
        if (selectedPatient && patientTab === 'budget') {
            api.budget.getByPatient(selectedPatient.id)
                .then(setBudgets)
                .catch(err => console.error("Failed to load budgets", err));
        }
    }, [selectedPatient, patientTab]);

    // Modal & Form States
    const [isNewPatientModalOpen, setIsNewPatientModalOpen] = useState(false);
    const [isEditingPatient, setIsEditingPatient] = useState(false);

    // History / Clinical Records
    const [isNewEntryModalOpen, setIsNewEntryModalOpen] = useState(false);
    const [isEditEntryModalOpen, setIsEditEntryModalOpen] = useState(false);
    const [editingRecord, setEditingRecord] = useState<ClinicalRecord | null>(null);
    const [newEntryForm, setNewEntryForm] = useState({ treatment: '', price: '', observation: '', specialization: 'General' });
    // Templates State
    const [isDocModalOpen, setIsDocModalOpen] = useState(false);
    const [selectedDocTemplate, setSelectedDocTemplate] = useState('');
    const [docContent, setDocContent] = useState('');

    // Treatments
    const [isFinanceModalOpen, setIsFinanceModalOpen] = useState(false);
    const [selectedBudgetForFinance, setSelectedBudgetForFinance] = useState<any>(null);

    const handleSaveFinancing = async (planData: any) => {
        if (!selectedBudgetForFinance) return;
        try {
            await api.budget.updateStatus(selectedBudgetForFinance.id, 'accepted');
            const result = await api.budget.createFinancing({
                patientId: selectedPatient!.id,
                name: selectedBudgetForFinance.title || `Financiación Presupuesto #${selectedBudgetForFinance.id.slice(0, 6)}`,
                budgetId: selectedBudgetForFinance.id,
                totalAmount: selectedBudgetForFinance.totalAmount || selectedBudgetForFinance.items.reduce((acc: number, item: any) => acc + (Number(item.price) * (item.quantity || 1)), 0),
                downPayment: planData.downPayment,
                installmentsCount: planData.months,
                startDateStr: new Date().toISOString()
            });

            setIsFinanceModalOpen(false);
            const updatedBudgets = await api.budget.getByPatient(selectedPatient!.id);
            setBudgets(updatedBudgets);
            setSelectedBudgetForFinance(null);

            // Open invoice PDF if available
            if (result.downPaymentInvoice?.crmInvoiceId) {
                try {
                    const downloadData = await api.invoices.getDownloadUrl(result.downPaymentInvoice.crmInvoiceId);
                    if (downloadData.url) {
                        window.open(downloadData.url, '_blank');
                    }
                } catch (e) {
                    console.log('No se pudo abrir el PDF automáticamente');
                }

                // Switch to invoices tab
                setPatientTab('invoices');
                // Refresh invoices
                if (selectedPatient) {
                    const invs = await api.invoices.getByPatient(selectedPatient.id);
                    setInvoices(invs);
                }
            }

            // Show success message
            let msg = "✅ Financiación creada correctamente.";
            if (result.downPaymentInvoice) {
                msg += `\n\n📄 Factura de entrada: ${result.downPaymentInvoice.number || 'Generada'}`;
            }
            msg += `\n\n📅 Cuotas: ${planData.months} x ${((selectedBudgetForFinance.totalAmount - planData.downPayment) / planData.months).toFixed(2)}€`;
            alert(msg);
        } catch (e: any) {
            alert("Error guardando financiación: " + e.message);
        }
    };
    const [isNewTreatmentModalOpen, setIsNewTreatmentModalOpen] = useState(false);
    const [treatmentSearch, setTreatmentSearch] = useState('');
    const [treatmentForm, setTreatmentForm] = useState({ name: '', price: '', status: 'Pendiente' });
    const [isTreatmentSearchFocused, setIsTreatmentSearchFocused] = useState(false);
    const [treatments, setTreatments] = useState<PatientTreatment[]>([]); // NEW: Source of Truth

    // Fetch Treatments when tab active
    React.useEffect(() => {
        if (selectedPatient && patientTab === 'treatments') {
            api.treatments.getByPatient(selectedPatient.id)
                .then(setTreatments)
                .catch(err => console.error("Failed to load treatments", err));
        }
    }, [selectedPatient, patientTab]);

    // Payments State (New)
    const [payments, setPayments] = useState<any[]>([]);
    React.useEffect(() => {
        if (selectedPatient && patientTab === 'billing') {
            // Refresh payments
            api.payments.getByPatient(selectedPatient.id)
                .then(setPayments)
                .catch(err => console.error("Failed to load payments", err));

            // Refresh invoices (to fix display issue after reload)
            api.invoices.getAll()
                .then(setInvoices)
                .catch(err => console.error("Failed to load invoices", err));
        }
    }, [selectedPatient, patientTab]);

    const handleDeleteTreatment = async (id: string) => {
        if (confirm("¿Seguro que quieres borrar este tratamiento?")) {
            try {
                await api.treatments.delete(id);
                setTreatments(prev => prev.filter(t => t.id !== id));
            } catch (e) {
                alert("Error borrando el tratamiento.");
                console.error(e);
            }
        }
    };

    const handleDownloadInvoice = async (invoiceId: string) => {
        try {
            const { url } = await (api.invoices as any).getDownloadUrl(invoiceId);
            if (url) window.open(url, '_blank');
            else alert("No se pudo obtener el PDF. Intente más tarde.");
        } catch (e) {
            console.error(e);
            alert("Error al descargar factura.");
        }
    };

    // Prescriptions
    const [isPrescriptionOpen, setIsPrescriptionOpen] = useState(false);
    const [prescriptionText, setPrescriptionText] = useState("");
    const prescriptionInputRef = useRef<HTMLInputElement>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Odontogram
    const [isOdontogramOpen, setIsOdontogramOpen] = useState(false);

    // Budget
    const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
    const [budgetForm, setBudgetForm] = useState({ title: '', totalPrice: '', installments: 1 });

    // Wallet / Payment Modal
    const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

    // Doctors State (for transfer modal)
    const [doctors, setDoctors] = useState<any[]>([]);
    React.useEffect(() => {
        api.doctors.getAll().then(setDoctors).catch(console.error);
    }, []);

    // New Patient Form State
    const [newPatient, setNewPatient] = useState({ name: '', dni: '', email: '', phone: '' });

    // WhatsApp Scheduling State
    const [isWhatsAppModalOpen, setIsWhatsAppModalOpen] = useState(false);
    const [whatsAppForm, setWhatsAppForm] = useState({ templateId: '', scheduledDate: '', content: '' });
    const [whatsappTemplates, setWhatsappTemplates] = useState<any[]>([]);
    const [whatsappLogs, setWhatsappLogs] = useState<any[]>([]);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false); // New AI State // New state for history

    // Fetch templates and logs when modal or tab opens
    React.useEffect(() => {
        if (patientTab === 'whatsapp' && selectedPatient) {
            // Load History
            api.whatsapp.getLogs(selectedPatient.id).then(setWhatsappLogs).catch(console.error);
        }
    }, [patientTab, selectedPatient]);

    React.useEffect(() => {
        if (isWhatsAppModalOpen) {
            api.whatsapp.getTemplates().then(setWhatsappTemplates).catch(console.error);
        }
    }, [isWhatsAppModalOpen]);

    const handleCreatePatient = async () => {
        if (!newPatient.name || !newPatient.dni) {
            alert("Por favor rellene nombre y DNI.");
            return;
        }
        try {
            const created = await api.createPatient(newPatient);
            setPatients(prev => [...prev, created]);
            setIsNewPatientModalOpen(false);
            setNewPatient({ name: '', dni: '', email: '', phone: '' });
            alert("✅ Paciente creado correctamente");
        } catch (e) {
            console.error("Error creating patient:", e);
            alert("Error al crear paciente. Revise la consola.");
        }
    };

    // FORCE DATA LOAD if patients is empty (User Feedback Fix)
    React.useEffect(() => {
        if (patients.length === 0) {
            console.log("Patients list empty, forcing refresh...");
            api.getPatients()
                .then(pts => {
                    if (Array.isArray(pts)) {
                        console.log(`Fetched ${pts.length} patients`);
                        setPatients(pts);
                    } else {
                        console.error("API Error: Expected array of patients, got:", JSON.stringify(pts, null, 2));
                    }
                })
                .catch(err => console.error("Error auto-fetching patients", err));
        }
    }, [patients.length]); // Add dep to ensure it runs if length causes issues

    // Computed
    const filteredPatients = useMemo(() => {
        return patients.filter(p =>
            p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            p.dni.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }, [patients, searchQuery]);

    // Handlers
    const handleDeleteRecord = async (id: string) => {
        if (confirm("¿Seguro que quieres borrar esta entrada?")) {
            try {
                await api.clinicalRecords.delete(id);
                setClinicalRecords(prev => prev.filter(r => r.id !== id));
            } catch (e) {
                alert("Error borrando el registro.");
                console.error(e);
            }
        }
    };

    const handleUpdateRecord = () => {
        if (!editingRecord) return;
        setClinicalRecords(prev => prev.map(r => r.id === editingRecord.id ? editingRecord : r));
        setIsEditEntryModalOpen(false);
        setEditingRecord(null);
    };

    const handleGenerateReceta = async (medication: string) => {
        if (!medication) return;
        setIsProcessing(true);
        try {
            const prompt = `Genera una receta completa para: ${medication}`;
            const generatedText = await api.ai.improveMessage(prompt, selectedPatient?.name, 'prescription');
            setPrescriptionText(generatedText);

            // Explicitly save the generated prescription to clinical history to ensure it is recorded
            if (selectedPatient && generatedText) {
                await api.clinicalRecords.create({
                    patientId: selectedPatient.id,
                    treatment: 'Receta Médica',
                    observation: generatedText, // Prescription text
                    specialization: 'General' // Default
                });

                // Refresh records
                const records = await api.clinicalRecords.getByPatient(selectedPatient.id);
                setClinicalRecords(records);
            }
        } catch (e) {
            console.error(e);
            setPrescriptionText("Error generando receta con IA.");
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAddClinicalRecord = async () => {
        if (!newEntryForm.treatment) return alert("Rellene el tratamiento");
        if (!selectedPatient?.id) return alert("Error: Paciente no seleccionado.");

        try {
            const payload = { ...newEntryForm, patientId: selectedPatient.id };
            const rec = await api.clinicalRecords.create(payload);
            setClinicalRecords(prev => [rec, ...prev]);
            setIsNewEntryModalOpen(false);
            setNewEntryForm({ treatment: '', observation: '', specialization: 'General' });
        } catch (e) {
            console.error(e);
            alert("Error al guardar: " + e.message);
        }
    };

    const handleDeleteBudget = async (id: string) => {
        if (!confirm("¿Borrar presupuesto?")) return;
        try {
            await api.budget.delete(id);
            // Refresh budgets directly
            if (selectedPatient) {
                const updated = await api.budget.getByPatient(selectedPatient.id);
                setBudgets(updated);
            }
        } catch (e) {
            console.error(e);
            alert("Error al borrar presupuesto");
        }
    };


    const handleConvertToInvoice = async (budget: any) => {
        if (!confirm("¿Convertir este presupuesto a factura?")) return;
        if (!selectedPatient) {
            alert("Error: No hay paciente seleccionado");
            return;
        }
        try {
            // 1. Create Invoice from Budget Data - Pass full patient object for Quipu
            const invoiceData = {
                patient: selectedPatient, // Required by backend for Quipu contact creation
                amount: budget.totalAmount || (budget.items && budget.items.length > 0 ? budget.items.reduce((acc: number, item: any) => acc + (Number(item.price) || 0), 0) : 0),
                items: (budget.items || []).map((item: any) => ({
                    name: item.name,
                    price: Number(item.price) || 0
                })),
                paymentMethod: 'card',
                type: 'BUDGET_INVOICE'
            };

            // Call API
            const result = await api.invoices.create(invoiceData);

            // 2. Update budget status to CONVERTED
            await api.budget.updateStatus(budget.id, 'CONVERTED');

            // 3. Notify and Switch Tab
            alert("✅ Factura generada correctamente.");

            // Open PDF using download endpoint (ephemeral URLs expire quickly)
            if (result.id) {
                try {
                    const downloadData = await api.invoices.getDownloadUrl(result.id);
                    if (downloadData.url) {
                        window.open(downloadData.url, '_blank');
                    }
                } catch (dlErr) {
                    console.log("Could not open PDF:", dlErr);
                }
            }

            // Refresh invoices
            const updatedInvoices = await api.invoices.getAll();
            setInvoices(updatedInvoices);

            // Refresh budgets
            const updatedBudgets = await api.budget.getByPatient(selectedPatient.id);
            setBudgets(updatedBudgets);

            setPatientTab('billing');

        } catch (e: any) {
            console.error(e);
            alert("Error al convertir a factura: " + (e.message || e));
        }
    };

    return (
        <div className="flex h-full gap-8 max-w-[1920px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* LEFT COLUMN: PATIENT LIST */}
            <div className={`flex flex-col gap-6 transition-all duration-500 ease-in-out ${selectedPatient ? 'w-1/3 min-w-[320px] hidden xl:flex' : 'w-full max-w-5xl mx-auto'} `}>
                {/* Same list code as before... */}
                <div className="flex items-center justify-between">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Pacientes</h2>
                    <div className="flex gap-2">
                        <button onClick={() => setIsNewPatientModalOpen(true)} className="bg-slate-900 text-white p-4 rounded-2xl hover:scale-105 transition-transform shadow-xl shadow-slate-900/20">
                            <Plus />
                        </button>
                    </div>
                </div>
                <div className="flex gap-4 mb-6">
                    <div className="relative group flex-1">
                        <Search className="absolute left-5 top-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        <input
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Buscar por nombre, DNI..."
                            className="w-full bg-white border border-slate-200 p-5 pl-14 rounded-2xl text-sm font-bold shadow-sm outline-none focus:ring-4 focus:ring-blue-500/10 transition-all"
                        />
                        <button className="absolute right-4 top-4 p-2 bg-slate-50 rounded-xl text-slate-400 hover:text-slate-900"><Filter size={16} /></button>
                    </div>

                </div>
                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
                    {filteredPatients.map(patient => (
                        <div
                            key={patient.id}
                            onClick={() => { setSelectedPatient(patient); setPatientTab('ficha'); }}
                            className={`group p-5 rounded-[1.5rem] cursor-pointer border transition-all duration-300 relative overflow-hidden
                  ${selectedPatient?.id === patient.id
                                    ? 'bg-slate-900 text-white border-slate-900 shadow-2xl scale-[1.02]'
                                    : 'bg-white text-slate-600 border-slate-100 hover:border-blue-300 hover:shadow-lg'
                                }
`}
                        >
                            <div className="flex justify-between items-start relative z-10">
                                <div className="flex gap-4 items-center">
                                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-sm transition-colors
                           ${selectedPatient?.id === patient.id ? 'bg-white text-slate-900' : 'bg-slate-100 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600'}
`}>
                                        {patient.name.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className={`text-sm font-black ${selectedPatient?.id === patient.id ? 'text-white' : 'text-slate-900'} flex items-center gap-2`}>
                                            {patient.name}
                                            {(patient.allergies || patient.medications) && (
                                                <AlertTriangle size={14} className={selectedPatient?.id === patient.id ? 'text-amber-300' : 'text-amber-500'} />
                                            )}
                                        </h4>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={`text-[10px] font-bold uppercase tracking-wider ${selectedPatient?.id === patient.id ? 'text-slate-400' : 'text-slate-400'} `}>
                                                {patient.historyNumber || `ID: ${patient.id.slice(0, 6)}...`}
                                            </span>
                                            {patient.insurance === 'Privado' && <span className="w-2 h-2 rounded-full bg-amber-400"></span>}
                                            {(patient.insurance === 'Sanitas' || patient.insurance === 'Adeslas') && <span className="w-2 h-2 rounded-full bg-blue-400"></span>}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* RIGHT COLUMN: DETAIL */}
            {selectedPatient && (
                <div className="flex-1 bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-8 duration-500 z-10 relative">

                    {/* HEADER SIDEBAR (Mobile/Desktop split logic from App.tsx simplified here) */}
                    <div className="px-8 pt-8 pb-4 border-b border-slate-100 flex items-center justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-10">
                        <div className="flex gap-1 overflow-x-auto no-scrollbar">
                            {['ficha', 'history', 'whatsapp', 'odontogram', 'treatments', 'prescriptions', 'billing', 'docs', 'budget'].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setPatientTab(tab)}
                                    className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap
                        ${patientTab === tab
                                            ? 'bg-slate-900 text-white shadow-lg'
                                            : 'text-slate-400 hover:bg-slate-50 hover:text-slate-900'
                                        }
`}
                                >
                                    {tab === 'history' ? 'Historial' : tab === 'treatments' ? 'Tratamientos' : tab === 'prescriptions' ? 'Recetas' : tab === 'billing' ? 'Pagos' : tab === 'docs' ? 'Docs' : tab === 'budget' ? 'Pptos' : tab}
                                </button>
                            ))}
                        </div>
                        <button onClick={() => setSelectedPatient(null)} className="p-3 hover:bg-slate-50 rounded-full text-slate-400 xl:hidden">
                            X
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-8 bg-slate-50/50 relative">

                        {/* FICHA TAB */}
                        {patientTab === 'ficha' && (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Ficha del Paciente</h2>
                                    <button
                                        onClick={async () => {
                                            if (isEditingPatient) {
                                                try {
                                                    // SAVE CHANGES
                                                    const updated = await api.updatePatient(selectedPatient.id, selectedPatient);
                                                    setPatients(prev => prev.map(p => p.id === updated.id ? updated : p));
                                                    setSelectedPatient(updated);
                                                    alert("✅ Cambios guardados correctamente");
                                                } catch (e) {
                                                    console.error(e);
                                                    alert("Error al guardar cambios");
                                                }
                                            }
                                            setIsEditingPatient(!isEditingPatient);
                                        }}
                                        className={`px-6 py-2 rounded-xl text-xs font-bold uppercase flex items-center gap-2 transition-all ${isEditingPatient ? 'bg-emerald-50 text-emerald-600' : 'bg-white border border-slate-200'} `}
                                    >
                                        {isEditingPatient ? <><Check size={16} /> Guardar</> : <><Edit size={16} /> Modificar</>}
                                    </button>
                                </div>

                                {/* MEDICAL ALERTS BANNER (FRANKEN LOGIC) */}
                                {(selectedPatient.allergies || selectedPatient.medications || (selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0)) && (
                                    <div className="bg-red-50 border border-red-200 p-6 rounded-[2rem] flex gap-4 items-start animate-in slide-in-from-top-4 shadow-sm mb-6">
                                        <div className="bg-red-100 text-red-600 p-3 rounded-xl shrink-0 animate-pulse">
                                            <AlertTriangle size={32} />
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-red-900 font-black text-xl mb-2">¡ALERTA MÉDICA IMPORTANTE!</h4>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedPatient.allergies && (
                                                    <div className="bg-white/60 p-3 rounded-xl border border-red-100">
                                                        <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Alergias</p>
                                                        <p className="text-red-900 font-bold text-sm">{selectedPatient.allergies}</p>
                                                    </div>
                                                )}
                                                {selectedPatient.medications && (
                                                    <div className="bg-white/60 p-3 rounded-xl border border-red-100">
                                                        <p className="text-[10px] font-bold uppercase text-red-400 mb-1">Medicación</p>
                                                        <p className="text-red-900 font-bold text-sm">{selectedPatient.medications}</p>
                                                    </div>
                                                )}
                                            </div>
                                            {selectedPatient.medicalHistory && selectedPatient.medicalHistory.length > 0 && (
                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {selectedPatient.medicalHistory.map((cond, i) => (
                                                        <span key={i} className="px-3 py-1 bg-red-600 text-white rounded-lg text-xs font-black uppercase tracking-wider shadow-sm">
                                                            {cond}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm grid grid-cols-2 gap-8">
                                    {/* History Number Badge */}
                                    {selectedPatient.historyNumber && (
                                        <div className="col-span-2 flex items-center gap-3 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100">
                                            <div className="w-10 h-10 bg-blue-500 text-white rounded-xl flex items-center justify-center font-black text-sm">#</div>
                                            <div>
                                                <p className="text-[10px] font-bold uppercase text-blue-400">Número de Historia</p>
                                                <p className="text-lg font-black text-blue-900">{selectedPatient.historyNumber}</p>
                                            </div>
                                        </div>
                                    )}
                                    <div className="col-span-2">
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Nombre</label>
                                        <input disabled={!isEditingPatient} value={selectedPatient.name} onChange={(e) => setSelectedPatient({ ...selectedPatient, name: e.target.value })} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">DNI</label>
                                        <input disabled={!isEditingPatient} value={selectedPatient.dni} onChange={(e) => setSelectedPatient({ ...selectedPatient, dni: e.target.value })} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Email</label>
                                        <input disabled={!isEditingPatient} value={selectedPatient.email} onChange={(e) => setSelectedPatient({ ...selectedPatient, email: e.target.value })} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-slate-400 ml-2 mb-1 block">Teléfono</label>
                                        <input disabled={!isEditingPatient} value={selectedPatient.phone || ''} onChange={(e) => setSelectedPatient({ ...selectedPatient, phone: e.target.value })} className="w-full bg-slate-50 rounded-2xl p-4 text-sm font-bold" placeholder="+34 600 000 000" />
                                    </div>

                                    {/* MEDICAL CONDITIONS EDITOR */}
                                    <div className="col-span-2 border-t border-slate-100 pt-6 mt-2">
                                        <h4 className="text-sm font-black uppercase text-slate-900 mb-4 flex items-center gap-2">
                                            <Activity size={18} className="text-indigo-500" /> Historial y Condiciones
                                        </h4>

                                        {isEditingPatient ? (
                                            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Condiciones Comunes (Click para añadir)</label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {["Hipertensión", "Diabetes", "Asma", "Epilepsia", "Problemas Cardíacos", "Alergia Penicilina", "Alergia AINES", "Embarazo", "Hepatitis", "VIH", "Sintrom"].map(cond => (
                                                            <button
                                                                key={cond}
                                                                onClick={() => {
                                                                    const current = selectedPatient.medicalHistory || [];
                                                                    if (!current.includes(cond)) {
                                                                        setSelectedPatient({ ...selectedPatient, medicalHistory: [...current, cond] });
                                                                    }
                                                                }}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${selectedPatient.medicalHistory?.includes(cond) ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                                                            >
                                                                {cond}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div>
                                                    <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Condiciones Seleccionadas</label>
                                                    <div className="flex flex-wrap gap-2 min-h-[40px] p-2 bg-white rounded-xl border border-slate-200">
                                                        {(selectedPatient.medicalHistory || []).map((cond, idx) => (
                                                            <span key={idx} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-2">
                                                                {cond}
                                                                <button onClick={() => {
                                                                    const newHistory = selectedPatient.medicalHistory?.filter((_, i) => i !== idx);
                                                                    setSelectedPatient({ ...selectedPatient, medicalHistory: newHistory });
                                                                }} className="hover:text-red-500"><Trash2 size={12} /></button>
                                                            </span>
                                                        ))}
                                                        {(selectedPatient.medicalHistory || []).length === 0 && <span className="text-slate-300 text-xs italic p-1">Sin condiciones registradas</span>}
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-4 pt-2">
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-amber-500/70 ml-2 mb-1 block">Alergias (Texto)</label>
                                                        <textarea
                                                            value={selectedPatient.allergies || ''}
                                                            onChange={(e) => setSelectedPatient({ ...selectedPatient, allergies: e.target.value })}
                                                            className="w-full bg-white border border-amber-100 rounded-xl p-3 text-sm font-medium text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-200 h-24"
                                                            placeholder="Describa alergias específicas..."
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase text-amber-500/70 ml-2 mb-1 block">Medicación (Texto)</label>
                                                        <textarea
                                                            value={selectedPatient.medications || ''}
                                                            onChange={(e) => setSelectedPatient({ ...selectedPatient, medications: e.target.value })}
                                                            className="w-full bg-white border border-amber-100 rounded-xl p-3 text-sm font-medium text-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-200 h-24"
                                                            placeholder="Lista de medicación actual..."
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="flex flex-wrap gap-2">
                                                    {(selectedPatient.medicalHistory || []).map((cond, idx) => (
                                                        <span key={idx} className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">
                                                            {cond}
                                                        </span>
                                                    ))}
                                                    {(!selectedPatient.medicalHistory || selectedPatient.medicalHistory.length === 0) && <span className="text-slate-400 text-xs italic">No hay condiciones registradas</span>}
                                                </div>
                                                <div className="grid grid-cols-2 gap-4 text-sm">
                                                    {selectedPatient.allergies && <p><strong className="text-amber-600 block text-xs uppercase mb-1">Alergias</strong> {selectedPatient.allergies}</p>}
                                                    {selectedPatient.medications && <p><strong className="text-amber-600 block text-xs uppercase mb-1">Medicación</strong> {selectedPatient.medications}</p>}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* HISTORY TAB */}
                        {patientTab === 'history' && (
                            <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Evolución Clínica</h3>
                                    <button className="text-xs font-bold text-blue-600 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl" onClick={() => setIsNewEntryModalOpen(true)}>
                                        <Plus size={16} /> Nueva Entrada
                                    </button>
                                </div>
                                <div className="space-y-4">
                                    {clinicalRecords.filter(r => r.patientId === selectedPatient.id).length === 0 ? (
                                        <div className="text-center p-8 opacity-50"><p className="text-xs font-bold uppercase">No hay historial clínico registrado</p></div>
                                    ) : (
                                        clinicalRecords.filter(r => r.patientId === selectedPatient.id).map(r => (
                                            <div key={r.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                                <div className="flex justify-between mb-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-xs">EV</div>
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900">Dr. {DOCTORS.find(d => d.specialization === r.specialization)?.name || 'General'}</p>
                                                            <p className="text-[10px] text-slate-400 font-bold uppercase">{r.specialization}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <p className="text-[10px] font-bold text-slate-400">{new Date(r.date).toLocaleDateString()}</p>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => { setEditingRecord(r); setIsEditEntryModalOpen(true); }} className="text-slate-400 hover:text-blue-500 transition-colors"><Edit3 size={16} /></button>
                                                            <button onClick={() => handleDeleteRecord(r.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-sm font-medium text-slate-600 leading-relaxed">
                                                    <p className="text-xs font-black uppercase text-slate-800 mb-1">{r.clinicalData.treatment}</p>
                                                    {r.clinicalData.observation}
                                                </div>
                                            </div>
                                        )))}
                                </div>
                            </div>
                        )}

                        {/* TREATMENTS TAB */}
                        {patientTab === 'treatments' && (
                            <div className="space-y-6 animate-in fade-in max-w-4xl mx-auto">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-3xl font-bold text-slate-900 tracking-tight">Plan de Tratamiento</h3>
                                    <button onClick={() => setIsNewTreatmentModalOpen(true)} className="text-xs font-bold text-blue-600 flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-xl hover:bg-blue-100 transition-colors">
                                        <Plus size={16} /> Nuevo Tratamiento
                                    </button>
                                </div>
                                <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
                                    <div className="grid grid-cols-12 gap-4 pb-4 border-b border-slate-100 text-slate-400 text-[10px] font-bold uppercase tracking-widest text-left">
                                        <div className="col-span-1 text-center">Pieza(s)</div>
                                        <div className="col-span-4">Tratamiento</div>
                                        <div className="col-span-3">Estado</div>
                                        <div className="col-span-3">Precio (Total)</div>
                                        <div className="col-span-1 text-right">Acciones</div>
                                    </div>
                                    <TreatmentsList patientId={selectedPatient.id} />
                                </div>
                            </div>
                        )}

                        {/* PRESCRIPTIONS TAB */}
                        {patientTab === 'prescriptions' && (
                            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recetas</h2>
                                    <button onClick={() => setIsPrescriptionOpen(true)} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg"><Plus size={16} /> Nueva Receta</button>
                                </div>
                                {isPrescriptionOpen && (
                                    <div className="bg-slate-50 p-6 rounded-[2rem] border border-slate-200">
                                        <div className="flex gap-2 mb-4">
                                            <input ref={prescriptionInputRef} className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none" placeholder="Medicamento..." onKeyDown={e => { if (e.key === 'Enter') handleGenerateReceta((e.target as HTMLInputElement).value); }} />
                                            <button onClick={() => handleGenerateReceta(prescriptionInputRef.current?.value || '')} className="bg-slate-900 text-white p-3 rounded-xl hover:bg-slate-800 transition-colors"><Zap size={16} /></button>
                                        </div>
                                        {isProcessing && <div className="text-center p-4 text-xs font-bold text-blue-500">Generando...</div>}
                                        {prescriptionText && (
                                            <div className="bg-white p-6 rounded-2xl text-xs font-mono mb-4 whitespace-pre-wrap">{prescriptionText}</div>
                                        )}
                                    </div>
                                )}
                                <div className="space-y-4">
                                    {(selectedPatient.prescriptions || []).map((receta, idx) => (
                                        <div key={idx} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex justify-between items-center">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center"><FileTextIcon size={24} /></div>
                                                <div><p className="font-bold text-slate-900 text-sm line-clamp-1">{receta}</p></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ODONTOGRAM TAB */}
                        {patientTab === 'odontogram' && (
                            <div className="h-full flex flex-col items-center justify-center py-12">
                                <div className="bg-gradient-to-br from-violet-50 via-white to-blue-50 p-12 rounded-[3rem] border border-slate-200 shadow-xl text-center max-w-lg">
                                    <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-purple-600 text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-violet-200">
                                        <span className="text-3xl">🦷</span>
                                    </div>
                                    <h3 className="text-2xl font-black text-slate-900 mb-3">Odontograma Visual</h3>
                                    <p className="text-sm text-slate-500 mb-8 max-w-sm mx-auto">
                                        Abre el odontograma en pantalla completa para una mejor visualización y gestión de tratamientos.
                                    </p>
                                    <button
                                        onClick={() => setIsOdontogramOpen(true)}
                                        className="bg-gradient-to-r from-violet-600 to-purple-600 text-white px-10 py-4 rounded-2xl text-sm font-black uppercase tracking-wider shadow-xl shadow-violet-200 hover:shadow-2xl hover:scale-[1.02] transition-all flex items-center gap-3 mx-auto"
                                    >
                                        <span>Abrir Odontograma</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1" /></svg>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* BILLING TAB */}
                        {patientTab === 'billing' && (
                            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                                <h3 className="text-3xl font-black text-slate-900 tracking-tight">Caja y Facturación</h3>

                                {/* Wallet Card */}
                                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-8 rounded-[2rem] shadow-xl text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                                    <div className="relative z-10 flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-1">Saldo en Monedero</p>
                                            <h4 className="text-5xl font-black">{selectedPatient.wallet || 0}€</h4>
                                            <p className="text-xs text-slate-400 mt-2 font-medium max-w-md">
                                                Saldo disponible para futuros tratamientos. Los anticipos generan factura simplificada automáticamente.
                                            </p>
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => setIsPaymentModalOpen(true)}
                                                className="bg-white text-slate-900 px-6 py-4 rounded-xl font-black uppercase shadow-lg hover:bg-blue-50 transition-all flex items-center gap-2 text-sm"
                                            >
                                                <Plus size={18} />
                                                Añadir Saldo
                                            </button>
                                            <button
                                                onClick={() => setIsTransferModalOpen(true)}
                                                className="bg-emerald-500 text-white px-6 py-4 rounded-xl font-black uppercase shadow-lg hover:bg-emerald-600 transition-all flex items-center gap-2 text-sm"
                                            >
                                                <ArrowUp className="rotate-90" size={18} />
                                                Asignar a Tratamiento
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Invoices List */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                        <h4 className="text-lg font-black text-slate-900 mb-6">Historial de Facturas</h4>
                                        <div className="space-y-2">
                                            {/* Filter out invoices from 'Advance Payments' (Saldo) as user requested to see them in Payments instead */}
                                            {invoices.filter(i =>
                                                i.patientId === selectedPatient.id &&
                                                // Exclude Advance/Saldo invoices (case insensitive check)
                                                !((i.concept || '').toLowerCase().includes('saldo') || (i.concept || '').toLowerCase().includes('anticipo / saldo'))
                                            ).length === 0 ? (
                                                <p className="text-xs text-slate-500 font-bold opacity-50">No hay facturas emitidas.</p>
                                            ) : (
                                                invoices.filter(i =>
                                                    i.patientId === selectedPatient.id &&
                                                    !((i.concept || '').toLowerCase().includes('saldo') || (i.concept || '').toLowerCase().includes('anticipo / saldo'))
                                                ).map(inv => (
                                                    <div key={inv.id} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl">
                                                        <div>
                                                            <p className="text-sm font-black text-slate-900">{inv.invoiceNumber}</p>
                                                            <p className="text-[10px] font-bold text-slate-400">{new Date(inv.date).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <p className="text-sm font-black text-slate-900">{inv.amount}€</p>
                                                            <div className="flex gap-2">
                                                                <a
                                                                    href={inv.url || '#'}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        handleDownloadInvoice(inv.id);
                                                                    }}
                                                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors cursor-pointer"
                                                                    title="Descargar Factura (PDF Fresco)"
                                                                >
                                                                    <Download size={14} />
                                                                </a >
                                                                <button
                                                                    onClick={() => {
                                                                        alert(`📧 Factura ${inv.invoiceNumber} enviada a ${selectedPatient.email || 'correo del paciente'}.`);
                                                                    }}
                                                                    className="p-2 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                                                                    title="Enviar por Email al Paciente"
                                                                >
                                                                    <Mail size={14} />
                                                                </button>
                                                                {
                                                                    inv.qrUrl && (
                                                                        <a
                                                                            href={inv.qrUrl}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors"
                                                                            title="Ver/Descargar código QR Veri*Factu"
                                                                        >
                                                                            <QrCode size={14} />
                                                                        </a>
                                                                    )
                                                                }
                                                            </div >
                                                        </div >
                                                    </div >
                                                ))
                                            )}
                                        </div >
                                    </div >

                                    {/* Payments History (New) */}
                                    <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm">
                                        <h4 className="text-lg font-black text-slate-900 mb-6 flex items-center gap-2"><CreditCard size={20} /> Historial de Pagos</h4>
                                        <div className="space-y-2 h-[500px] overflow-y-auto">
                                            <PaymentsList patientId={selectedPatient.id} invoices={invoices} />
                                        </div>
                                    </div>
                                </div>
                            </div >
                        )}

                        {/* DOCS TAB (TEMPLATES) */}
                        {
                            patientTab === 'docs' && (
                                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                                    <h3 className="text-3xl font-black text-slate-900 tracking-tight">Documentos y Plantillas</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[
                                            { title: 'Consentimiento Informado', icon: <FileText size={24} />, text: 'YO, {{PACIENTE}}, CON DNI {{DNI}}, DOY MI CONSENTIMIENTO PARA EL TRATAMIENTO DE ...' },
                                            { title: 'Justificante Asistencia', icon: <Clock size={24} />, text: 'HAGO CONSTAR QUE EL PACIENTE {{PACIENTE}} HA ACUDIDO A SU CITA EL DÍA {{FECHA}} A LAS {{HORA}}...' },
                                            { title: 'Presupuesto Formal', icon: <DollarSign size={24} />, text: 'PRESUPUESTO PARA {{PACIENTE}}\n\nCONCEPTOS:\n...' }
                                        ].map((doc, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    setSelectedDocTemplate(doc.title);
                                                    // Pre-fill content with patient data
                                                    let content = doc.text
                                                        .replace('{{PACIENTE}}', selectedPatient?.name || '')
                                                        .replace('{{PATIENT_NAME}}', selectedPatient?.name || '') // Legacy
                                                        .replace('{{DOCTOR}}', 'Dr. General') // Placeholder
                                                        .replace('{{DOCTOR_NAME}}', 'Dr. General') // Legacy
                                                        .replace('{{DNI}}', selectedPatient?.dni || '')
                                                        .replace('{{FECHA}}', new Date().toLocaleDateString('es-ES'))
                                                        .replace('{{DATE}}', new Date().toLocaleDateString('es-ES')) // Legacy
                                                        .replace('{{HORA}}', new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }))
                                                        .replace('{{TIME}}', new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })); // Legacy
                                                    setDocContent(content);
                                                    setIsDocModalOpen(true);
                                                }}
                                                className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left group"
                                            >
                                                <div className="w-12 h-12 bg-slate-50 text-slate-400 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                    {doc.icon}
                                                </div>
                                                <h4 className="font-bold text-slate-900 text-sm">{doc.title}</h4>
                                                <p className="text-[10px] text-slate-400 mt-2 font-medium">Click para generar y editar</p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )
                        }

                        {/* BUDGET TAB OVERRIDE if 'budget' */}
                        {
                            patientTab === 'budget' && (
                                <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                                    <div className="flex justify-between items-center">
                                        <h2 className="text-3xl font-black text-slate-900 tracking-tight">Presupuestos</h2>
                                        <button onClick={() => setIsBudgetModalOpen(true)} className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-lg"><Plus size={16} /> Nuevo Presupuesto</button>
                                    </div>
                                    <div className="space-y-4">
                                        {budgets.length === 0 ? (
                                            <div className="p-10 text-center opacity-50 font-bold uppercase">No hay presupuestos registrados</div>
                                        ) : (
                                            budgets.map((budget: any) => (
                                                <div key={budget.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
                                                    {/* Budget Header */}
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div>
                                                            <h4 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                                                                {budget.title || `Presupuesto #${budget.id.substring(0, 6)}`}
                                                            </h4>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{new Date(budget.createdAt).toLocaleDateString()}</p>
                                                        </div>
                                                        <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider ${budget.status === 'ACCEPTED' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                                            {budget.status || 'DRAFT'}
                                                        </div>
                                                    </div>

                                                    {/* Items List - Gray Container */}
                                                    <div className="bg-slate-50 rounded-xl p-4 space-y-3 mb-6">
                                                        {budget.items?.map((item: any, idx: number) => (
                                                            <div key={idx} className="flex justify-between items-center text-sm font-bold text-slate-700">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-xs font-black text-slate-400 border border-slate-100 shadow-sm">
                                                                        x{item.quantity || 1}
                                                                    </div>
                                                                    <div className="flex flex-col">
                                                                        <span>{item.name}</span>
                                                                        {item.tooth && <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">Diente(s): {item.tooth}</span>}
                                                                    </div>
                                                                </div>
                                                                <span className="font-black text-slate-900">{item.price}€</span>
                                                                {(!budget.status || budget.status === 'DRAFT') && (
                                                                    <button onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        if (!confirm("¿Borrar item?")) return;
                                                                        try {
                                                                            await api.budget.deleteItem(item.id);
                                                                            const updated = await api.budget.getByPatient(selectedPatient!.id);
                                                                            setBudgets(updated);
                                                                        } catch (e: any) { alert(e.message); }
                                                                    }} className="ml-2 text-slate-400 hover:text-red-500 p-1"><Trash2 size={14} /></button>
                                                                )}
                                                            </div>
                                                        ))}
                                                        {(!budget.items || budget.items.length === 0) && (
                                                            <div className="text-center text-xs text-slate-400 italic py-2">Sin conceptos</div>
                                                        )}
                                                    </div>

                                                    {/* Footer Actions */}
                                                    <div className="flex justify-between items-center gap-3 pt-2 border-t border-slate-50">
                                                        {/* Status Badge */}
                                                        <div className="flex-shrink-0">
                                                            {budget.status === 'accepted' && (
                                                                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase">
                                                                    ✅ Financiado
                                                                </span>
                                                            )}
                                                            {budget.status === 'CONVERTED' && (
                                                                <span className="px-3 py-1 rounded-full bg-purple-50 text-purple-600 text-[10px] font-bold uppercase">
                                                                    📄 Facturado
                                                                </span>
                                                            )}
                                                        </div>

                                                        {/* Actions - Only show for DRAFT/pending budgets */}
                                                        <div className="flex gap-3">
                                                            <button
                                                                onClick={() => handleDeleteBudget(budget.id)}
                                                                className="px-4 py-2 rounded-xl bg-red-50 text-red-500 text-xs font-bold uppercase hover:bg-red-100 transition-colors flex items-center gap-2"
                                                            >
                                                                <Trash2 size={14} /> Borrar
                                                            </button>

                                                            {/* Only show Financiar if not already financed or converted */}
                                                            {budget.status !== 'accepted' && budget.status !== 'CONVERTED' && (
                                                                <button
                                                                    onClick={() => {
                                                                        setSelectedBudgetForFinance(budget);
                                                                        setIsFinanceModalOpen(true);
                                                                    }}
                                                                    className="px-6 py-2 rounded-xl bg-slate-900 text-white text-xs font-black uppercase hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-lg shadow-slate-200"
                                                                >
                                                                    Financiar
                                                                </button>
                                                            )}

                                                            {/* Only show Convert to Invoice if NOT financed and NOT already converted */}
                                                            {budget.status !== 'accepted' && budget.status !== 'CONVERTED' && (
                                                                <button
                                                                    onClick={() => handleConvertToInvoice(budget)}
                                                                    className="px-6 py-2 rounded-xl bg-purple-50 text-purple-600 text-xs font-black uppercase hover:bg-purple-100 transition-colors flex items-center gap-2"
                                                                >
                                                                    Convertir a Factura
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )
                        }
                        {/* WHATSAPP TAB */}
                        {patientTab === 'whatsapp' && (
                            <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-3xl font-black text-slate-900 tracking-tight">Recordatorios WhatsApp</h2>
                                    <button onClick={() => setIsWhatsAppModalOpen(true)} className="bg-emerald-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-2 hover:bg-emerald-600 transition-colors shadow-lg">
                                        <Plus size={16} /> Programar Mensaje
                                    </button>
                                </div>
                                <div className="bg-slate-50 p-12 rounded-[2rem] text-center border-2 border-dashed border-slate-200">
                                    <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Phone size={32} />
                                    </div>
                                    <h3 className="text-xl font-bold text-slate-900 mb-2">Programar Recordatorios y Revisiones</h3>
                                    <p className="text-sm text-slate-500 max-w-md mx-auto">
                                        Utiliza este apartado para programar mensajes automáticos (ej. revisión en 6 meses).
                                        El sistema enviará el mensaje automáticamente en la fecha seleccionada.
                                    </p>
                                </div>

                                {/* HISTORY SECTION */}
                                <div className="mt-8">
                                    <h3 className="text-xl font-bold text-slate-900 mb-4 px-2">Historial de Comunicaciones</h3>
                                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                                        {whatsappLogs.length === 0 ? (
                                            <div className="p-8 text-center text-slate-400 text-sm">
                                                No hay mensajes registrados para este paciente.
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-slate-100">
                                                {whatsappLogs.map(log => (
                                                    <div key={log.id} className="p-4 hover:bg-slate-50 transition-colors flex gap-4">
                                                        <div className={`w-2 h-2 rounded-full mt-2 shrink-0 ${log.status === 'SENT' ? 'bg-emerald-500' :
                                                            log.status === 'PENDING' ? 'bg-amber-400' : 'bg-rose-500'
                                                            }`} />
                                                        <div className="flex-1">
                                                            <div className="flex justify-between items-center mb-1">
                                                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${log.type === 'APPOINTMENT_REMINDER' ? 'bg-blue-50 text-blue-600' :
                                                                    log.type === 'TREATMENT_FOLLOWUP' ? 'bg-purple-50 text-purple-600' : 'bg-slate-100 text-slate-500'
                                                                    }`}>
                                                                    {log.type === 'APPOINTMENT_REMINDER' ? 'Recordatorio' : 'Seguimiento'}
                                                                </span>
                                                                <span className="text-[10px] text-slate-400 font-bold">
                                                                    {log.scheduledFor ? (
                                                                        <>Programado: {new Date(log.scheduledFor).toLocaleString()}</>
                                                                    ) : (
                                                                        new Date(log.sentAt).toLocaleString()
                                                                    )}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-wrap">{log.content}</p>
                                                            {log.error && <p className="text-xs text-rose-500 mt-1 font-medium">{log.error}</p>}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div >
                </div >
            )}

            {/* WHATSAPP TAB MODAL & CONTENT */}




            {/* NEW PATIENT MODAL */}
            {
                isNewPatientModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                        <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Nuevo Paciente</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Nombre Completo</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Juan Pérez"
                                        value={newPatient.name}
                                        onChange={e => setNewPatient({ ...newPatient, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">DNI / NIE</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="12345678X"
                                        value={newPatient.dni}
                                        onChange={e => setNewPatient({ ...newPatient, dni: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="juan@email.com"
                                        value={newPatient.email}
                                        onChange={e => setNewPatient({ ...newPatient, email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Teléfono</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="+34 600 000 000"
                                        value={newPatient.phone || ''}
                                        onChange={e => setNewPatient({ ...newPatient, phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setIsNewPatientModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button onClick={handleCreatePatient} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg">Guardar</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* NEW CLINICAL RECORD MODAL */}
            {
                isNewEntryModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                        <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Nueva Entrada Historial</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Tratamiento / Título</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Revisión General"
                                        value={newEntryForm.treatment}
                                        onChange={e => setNewEntryForm({ ...newEntryForm, treatment: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-black uppercase text-slate-400 flex justify-between items-center mb-2">
                                        <span>Detalles</span>
                                        <button
                                            onClick={async () => {
                                                if (!newEntryForm.observation) return alert("Escribe algo primero...");
                                                setIsProcessing(true);
                                                try {
                                                    const improved = await api.ai.improveMessage(newEntryForm.observation, selectedPatient?.name, 'clinical_note');
                                                    if (improved) {
                                                        setNewEntryForm(prev => ({ ...prev, observation: improved }));
                                                    } else {
                                                        alert("La IA no devolvió respuesta.");
                                                    }
                                                } catch (e) { console.error(e); alert("Error conectando con IA."); }
                                                setIsProcessing(false);
                                            }}
                                            className="text-xs bg-indigo-600 text-white px-4 py-2 rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-lg shadow-indigo-200"
                                        >
                                            ✨ Mejorar redacción (AI)
                                        </button>
                                    </label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium h-32 resize-none"
                                        placeholder="Detalles de la sesión..."
                                        value={newEntryForm.observation}
                                        onChange={e => setNewEntryForm({ ...newEntryForm, observation: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setIsNewEntryModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button onClick={handleAddClinicalRecord} className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg">Guardar Entrada</button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* DOCUMENT TEMPLATE MODAL */}
            {
                isDocModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                        <div className="bg-white max-w-2xl w-full rounded-[2rem] p-8 shadow-2xl h-[80vh] flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-2xl font-black text-slate-900">{selectedDocTemplate}</h3>
                                <button onClick={() => setIsDocModalOpen(false)} className="text-slate-400 hover:text-slate-600">✕</button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col gap-4">
                                <div className="bg-blue-50 p-4 rounded-xl text-xs text-blue-700 font-bold flex gap-2 items-center">
                                    ℹ️ Puedes editar el contenido antes de descargar.
                                </div>
                                <textarea
                                    className="flex-1 w-full bg-slate-50 border border-slate-200 p-6 rounded-xl font-mono text-sm leading-relaxed outline-none resize-none focus:ring-2 focus:ring-blue-100"
                                    value={docContent}
                                    onChange={(e) => setDocContent(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-4 mt-6 pt-6 border-t border-slate-100">
                                <button onClick={() => setIsDocModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button
                                    onClick={() => {
                                        // Simulated Download
                                        const element = document.createElement("a");
                                        const file = new Blob([docContent], { type: 'text/plain' });
                                        element.href = URL.createObjectURL(file);
                                        element.download = `${selectedDocTemplate.replace(/\s+/g, '_')}_${selectedPatient?.name}.txt`;
                                        document.body.appendChild(element); // Required for this to work in FireFox
                                        element.click();
                                        alert("✅ Documento descargado (Simulación PDF)");
                                        setIsDocModalOpen(false);
                                    }}
                                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg flex items-center justify-center gap-2"
                                >
                                    <Download size={18} /> Descargar PDF
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* NEW TREATMENT MODAL */}
            {
                isNewTreatmentModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                        <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Nuevo Tratamiento</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Tratamiento</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="Ej. Implante Muela"
                                        value={treatmentForm.name}
                                        onChange={e => setTreatmentForm({ ...treatmentForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Precio Estimado (€)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold"
                                        placeholder="0.00"
                                        value={treatmentForm.price}
                                        onChange={e => setTreatmentForm({ ...treatmentForm, price: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setIsNewTreatmentModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500">Cancelar</button>
                                <button
                                    onClick={async () => {
                                        if (!treatmentForm.name) return alert("Nombre requerido");
                                        try {
                                            // Save as Clinical Record primarily (as requested for history)
                                            const rec = await api.clinicalRecords.create({
                                                patientId: selectedPatient?.id,
                                                treatment: treatmentForm.name,
                                                observation: `Precio Estimado: ${treatmentForm.price}€`,
                                                specialization: 'Odontología',
                                                price: Number(treatmentForm.price)
                                            });
                                            setClinicalRecords(prev => [rec, ...prev]);
                                            setIsNewTreatmentModalOpen(false);
                                            setTreatmentForm({ name: '', price: '', status: 'Pendiente' });
                                            alert("Tratamiento guardado en historial");
                                        } catch (e) { alert("Error: " + e.message); }
                                    }}
                                    className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg"
                                >
                                    Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {/* BUDGET MODAL */}
            {
                isBudgetModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
                        <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Nuevo Presupuesto</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Concepto / Título</label>
                                    <input
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="Ej. Implante completo"
                                        value={budgetForm.title}
                                        onChange={e => setBudgetForm({ ...budgetForm, title: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase text-slate-400">Importe Total (€)</label>
                                    <input
                                        type="number"
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-100"
                                        placeholder="0.00"
                                        value={budgetForm.totalPrice}
                                        onChange={e => setBudgetForm({ ...budgetForm, totalPrice: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-4 mt-8">
                                    <button onClick={() => setIsBudgetModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors">Cancelar</button>
                                    <button
                                        onClick={async () => {
                                            if (!budgetForm.title || !budgetForm.totalPrice) return alert("Indique título e importe");
                                            try {
                                                // Create items array from single price
                                                const items = [{
                                                    name: budgetForm.title,
                                                    price: parseFloat(budgetForm.totalPrice)
                                                }];

                                                // Note: Installments info is currently just for calculation, 
                                                // unless we append it to description or backend supports it.
                                                // For now, we save the simple budget.

                                                await api.budget.create(
                                                    selectedPatient?.id,
                                                    items
                                                );

                                                alert("✅ Presupuesto Creado Correctamente");
                                                setIsBudgetModalOpen(false);
                                                // Refresh Budgets List
                                                const updatedBudgets = await api.budget.getByPatient(selectedPatient?.id);
                                                setBudgets(updatedBudgets);
                                                setPatientTab('budget');
                                            } catch (e) { alert("Error al crear: " + e.message); }
                                        }}
                                        className="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold uppercase shadow-lg hover:bg-black transition-all transform active:scale-95"
                                    >
                                        Crear Presupuesto
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            }
            {/* Payment Modal */}
            <PaymentModal
                isOpen={isPaymentModalOpen}
                onClose={() => setIsPaymentModalOpen(false)}
                patient={selectedPatient || { id: '', name: '', wallet: 0 }}
                budgets={budgets}
                onPaymentComplete={(payment, invoice) => {
                    if (selectedPatient) {
                        // 1. Immediate Update (Optimistic/Server-Confirmed)
                        if (invoice && typeof invoice.newWalletBalance === 'number') {
                            setSelectedPatient(prev => ({ ...prev, wallet: invoice.newWalletBalance }));
                        }

                        // 2. Background Refresh (Safety)
                        api.getPatients().then(newPatients => {
                            setPatients(newPatients);
                            // Only update if we didn't just do it, or to sync other fields
                            const updated = newPatients.find(p => p.id === selectedPatient.id);
                            if (updated && !invoice?.newWalletBalance) setSelectedPatient(updated);
                        });

                        if (invoice) {
                            api.invoices.getAll().then(setInvoices);
                            setPatientTab('billing');
                        }
                    }
                    setIsPaymentModalOpen(false);
                }}
            />

            {/* Transfer Balance Modal */}
            {selectedPatient && (
                <TransferBalanceModal
                    isOpen={isTransferModalOpen}
                    onClose={() => setIsTransferModalOpen(false)}
                    patient={selectedPatient}
                    treatments={treatments}
                    doctors={doctors}
                    onTransferComplete={() => {
                        // Refresh patient data and payments
                        api.getPatients().then(newPatients => {
                            setPatients(newPatients);
                            const updated = newPatients.find(p => p.id === selectedPatient.id);
                            if (updated) setSelectedPatient(updated);
                        });
                        api.payments.getByPatient(selectedPatient.id).then(setPayments);
                    }}
                />
            )}

            {/* WHATSAPP SCHEDULE MODAL - MOVED TO ROOT LEVEL TO ENSURE VISIBILITY */}
            {
                isWhatsAppModalOpen && (
                    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6">
                        <div className="bg-white max-w-lg w-full rounded-[2rem] p-8 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-2xl font-black text-slate-900 mb-6">Programar WhatsApp</h3>

                            <div>
                                <label className="text-[10px] font-black uppercase text-slate-400">Fecha de Envío</label>
                                <input
                                    type="datetime-local"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold outline-none"
                                    onChange={e => setWhatsAppForm({ ...whatsAppForm, scheduledDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <div className="flex justify-between items-center mb-1">
                                    <label className="text-[10px] font-black uppercase text-slate-400">Contenido</label>
                                    <button
                                        onClick={async () => {
                                            if (!whatsAppForm.content) return alert("Escribe algo primero (ej: 'recordatorio revisión').");
                                            setIsGeneratingAI(true);
                                            try {
                                                const improved = await api.ai.improveMessage(whatsAppForm.content, selectedPatient?.name, 'whatsapp');
                                                setWhatsAppForm(prev => ({ ...prev, content: improved }));
                                            } catch (e: any) {
                                                alert("Error AI: " + e.message);
                                            } finally {
                                                setIsGeneratingAI(false);
                                            }
                                        }}
                                        disabled={isGeneratingAI}
                                        className="text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded-lg font-bold hover:bg-indigo-100 transition-colors flex items-center gap-1"
                                    >
                                        {isGeneratingAI ? '✨ Escribiendo...' : '✨ Mejorar con IA'}
                                    </button>
                                </div>
                                <textarea
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-bold h-32 resize-none focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all"
                                    value={whatsAppForm.content}
                                    placeholder="Escribe tu mensaje aquí o selecciona una plantilla..."
                                    onChange={e => setWhatsAppForm({ ...whatsAppForm, content: e.target.value })}
                                />
                            </div>
                            <div className="flex gap-4 mt-6">
                                <button onClick={() => setIsWhatsAppModalOpen(false)} className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl">Cancelar</button>
                                <button
                                    onClick={async () => {
                                        if (!whatsAppForm.scheduledDate || !whatsAppForm.content) return alert("Falta fecha o contenido.");
                                        try {
                                            await api.whatsapp.scheduleMessage({
                                                patientId: selectedPatient!.id,
                                                scheduledDate: whatsAppForm.scheduledDate,
                                                content: whatsAppForm.content
                                            });
                                            alert('✅ Mensaje programado correctamente');
                                            setIsWhatsAppModalOpen(false);
                                            // Refresh logs
                                            const logs = await api.whatsapp.getLogs(selectedPatient!.id);
                                            setWhatsappLogs(logs);
                                        } catch (e: any) { alert('Error: ' + e.message); }
                                    }}
                                    className="flex-1 bg-emerald-500 text-white py-3 rounded-xl font-bold uppercase shadow-lg hover:bg-emerald-600 transition-colors"
                                >
                                    Programar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }

            {isOdontogramOpen && selectedPatient && (
                <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[150] flex flex-col animate-in fade-in duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between px-8 py-4 bg-white/5 border-b border-white/10">
                        <div className="flex items-center gap-4">
                            <span className="text-3xl">🦷</span>
                            <div>
                                <h2 className="text-xl font-black text-white">Odontograma</h2>
                                <p className="text-sm text-white/50 font-medium">{selectedPatient.name}</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOdontogramOpen(false)}
                            className="bg-white/10 hover:bg-white/20 text-white p-3 rounded-xl transition-colors flex items-center gap-2 font-bold"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            Cerrar
                        </button>
                    </div>

                    {/* Odontogram Container - Scrollable */}
                    <div className="flex-1 overflow-y-auto p-6 md:p-10">
                        <div className="max-w-7xl mx-auto">
                            <Odontogram
                                patientId={selectedPatient.id}
                                isEditable={true}
                                onTreatmentsChange={(treatments) => console.log('Treatments updated:', treatments)}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Finance Modal */}
            {isFinanceModalOpen && selectedBudgetForFinance && (
                <FinanceModal
                    budget={selectedBudgetForFinance}
                    onClose={() => setIsFinanceModalOpen(false)}
                    onSave={handleSaveFinancing}
                />
            )}
        </div>
    );
};

export default Patients;
