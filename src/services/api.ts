import { Patient, Appointment, Invoice, ClinicalRecord, InventoryItem, Doctor } from '../types';
import { supabase } from './supabase';
import { queryClient } from '../../App';

// Use relative path in production (Vercel), localhost in dev
// @ts-ignore - Vite env
// Robust API URL detection
const getApiUrl = () => {
    // Check if running in browser
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        // If running locally (dev or local build), point to Backend Port 3001
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        }
    }
    // Production / Vercel: Use relative path
    return '/api';
};

const API_URL = getApiUrl();

// Mutable headers object — Authorization token is injected at login via setApiAuthToken()
export const apiHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
};

/** Call after login to attach the JWT to all subsequent API requests. */
export const setApiAuthToken = (token: string | null) => {
    if (token) {
        apiHeaders['Authorization'] = `Bearer ${token}`;
    } else {
        delete apiHeaders['Authorization'];
    }
};

// Internal alias used by all fetch calls below
const headers = apiHeaders;

export const api = {
    // Auth
    login: async (email: string, password: string) => {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ email, password })
        });

        // Handle non-JSON responses (e.g. 500 error page)
        const contentType = res.headers.get("content-type");
        let data;
        if (contentType && contentType.includes("application/json")) {
            data = await res.json();
        } else {
            const text = await res.text();
            console.error("Non-JSON login response:", text);
            throw new Error("Server error (non-JSON response). Check console.");
        }

        if (!res.ok) {
            throw new Error(data.error || 'Error al iniciar sesión');
        }

        return data;
    },

    updateDisplayName: async (userId: string, name: string): Promise<{ name: string }> => {
        const res = await fetch(`${API_URL}/auth/users/${userId}/display-name`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({ name })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Error al actualizar el nombre');
        return data;
    },

    // Invoices (Moved to top for visibility/debugging)
    invoices: {
        getAll: async (): Promise<Invoice[]> => {
            const res = await fetch(`${API_URL}/finance/invoices`, { headers });
            if (!res.ok) throw new Error('Failed to fetch invoices');
            const data = await res.json();
            // Normalize backend data to match frontend properties
            return data.map((inv: any) => ({
                ...inv,
                id: inv.id || inv._id,
                invoiceNumber: inv.invoiceNumber || inv.invoice_number,
                url: inv.url || inv.pdf_url,
                qrUrl: inv.qrUrl || inv.qr_url,
                patientId: inv.patientId || inv.patient_id,
                amount: Number(inv.amount),
                paymentMethod: inv.paymentMethod || inv.payment_method,
                concept: inv.concept // Added for filtering
            }));
        },
        create: async (invoiceData: any): Promise<Invoice> => {
            const res = await fetch(`${API_URL}/finance/invoice`, {
                method: 'POST',
                headers,
                body: JSON.stringify(invoiceData)
            });
            if (!res.ok) throw new Error('Failed to create invoice');
            const data = await res.json();
            // Normalize response
            return {
                ...data,
                invoiceNumber: data.invoiceNumber || data.invoice_number,
                url: data.url || data.pdf_url,
                qrUrl: data.qrUrl || data.qr_url,
            };
        },
        getDownloadUrl: async (id: string) => {
            const res = await fetch(`${API_URL}/finance/invoices/${id}/download`, {
                method: 'GET',
                headers
            });
            if (!res.ok) throw new Error('Failed to get download URL');
            return res.json();
        },
        getByPatient: async (patientId: string): Promise<Invoice[]> => {
            const all = await api.invoices.getAll();
            return all.filter((inv: any) => inv.patientId === patientId);
        },
        getByAppointment: async (appointmentId: string): Promise<any | null> => {
            const res = await fetch(`${API_URL}/finance/invoices/appointment/${appointmentId}`, { headers });
            if (res.status === 404) return null;
            if (!res.ok) throw new Error('Failed to fetch invoice for appointment');
            return res.json();
        },
        update: async (id: string, data: { date: string }) => {
            const res = await fetch(`${API_URL}/finance/invoices/${id}`, {
                method: 'PUT', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al actualizar factura');
            return res.json();
        }
    },

    doctors: {
        getAll: async (): Promise<Doctor[]> => {
            const res = await fetch(`${API_URL}/doctors`, { headers });
            if (!res.ok) throw new Error('Failed to fetch doctors');
            return res.json();
        }
    },

    // Liquidations / Payroll
    getLiquidations: async (doctorId?: string, month?: string) => {
        const params = new URLSearchParams();
        if (doctorId) params.append('doctorId', doctorId);
        if (month) params.append('month', month);
        const res = await fetch(`${API_URL}/liquidations?${params.toString()}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch liquidations');
        return res.json();
    },

    // Attendance (Control de Jornada)
    attendance: {
        getHistory: async (userId: string, role: string) => {
            const res = await fetch(`${API_URL}/jornada/history`, { headers });
            if (!res.ok) throw new Error('Failed to fetch attendance history');
            return res.json();
        },
        clockIn: async (userId: string, role: string) => {
            const res = await fetch(`${API_URL}/jornada/clock-in`, { 
                method: 'POST', 
                headers,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to clock in');
            }
            return res.json();
        },
        clockOut: async (userId: string, role: string) => {
            const res = await fetch(`${API_URL}/jornada/clock-out`, { 
                method: 'PUT', 
                headers,
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to clock out');
            }
            return res.json();
        },
        manual: async (userId: string, role: string, data: { date: string, startTime: string, endTime: string, breakMinutes: number, notes: string }) => {
            const res = await fetch(`${API_URL}/jornada/manual`, { 
                method: 'POST', 
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to register manual shift');
            }
            return res.json();
        }
    },

    // Payments (New)
    payments: {
        getAll: async () => {
            const res = await fetch(`${API_URL}/finance/payments`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/payments`, { headers });
            if (!res.ok) throw new Error('Failed to fetch payments');
            return res.json();
        },
        create: async (paymentData: {
            patientId: string;
            amount: number;
            method: 'cash' | 'card' | 'transfer' | 'wallet';
            type: 'ADVANCE_PAYMENT' | 'DIRECT_CHARGE';
            budgetId?: string;
            appointmentId?: string;
            doctorId?: string;
            treatmentName?: string;
            notes?: string;
        }) => {
            const res = await fetch(`${API_URL}/finance/payments/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify(paymentData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create payment');
            }
            return res.json();
        },
        transfer: async (transferData: {
            patientId: string;
            sourcePaymentId: string;
            amount: number;
            treatmentId?: string;
            treatmentName?: string;
            doctorId: string;
            notes?: string;
            budgetId?: string;
        }) => {
            const res = await fetch(`${API_URL}/finance/payments/transfer`, {
                method: 'POST',
                headers,
                body: JSON.stringify(transferData)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to transfer payment');
            }
            return res.json();
        },
        getAdvanceBalance: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/advance-balance`, { headers });
            if (!res.ok) throw new Error('Failed to fetch advance balance');
            return res.json();
        },
        update: async (id: string, data: { amount?: number; createdAt?: string; method?: string; notes?: string; doctorId?: string }) => {
            const res = await fetch(`${API_URL}/finance/payments/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update payment');
            }
            return res.json();
        },
        createSplit: async (data: {
            patientId: string;
            totalAmount: number;
            method: 'cash' | 'card' | 'transfer' | 'wallet';
            appointmentId?: string;
            budgetId?: string;
            concept?: string;
            notes?: string;
            splits: Array<{ doctorId: string; amount: number; treatmentName: string; labCost?: number }>;
        }) => {
            const res = await fetch(`${API_URL}/finance/payments/create-split`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create split payment');
            }
            return res.json();
        }
    },

    caja: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/finance/caja/${patientId}`, { headers });
            if (!res.ok) throw new Error('Failed to fetch caja data');
            return res.json();
        }
    },

    prescriptions: {
        create: async (data: any) => {
            const patientId = data.patientId;
            if (!patientId) throw new Error('patientId es requerido para crear una receta');
            const res = await fetch(`${API_URL}/patients/${patientId}/prescriptions`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create prescription');
            return res.json();
        },
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/prescriptions`, { headers });
            if (!res.ok) throw new Error('Failed to fetch prescriptions');
            return res.json();
        },
        delete: async (id: string, patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/prescriptions/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete prescription');
        },
        update: async (id: string, data: any) => {
            const patientId = data.patientId;
            if (!patientId) throw new Error('patientId es requerido para actualizar una receta');
            const res = await fetch(`${API_URL}/patients/${patientId}/prescriptions/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update prescription');
            return res.json();
        }
    },

    // Patients
    getPatients: async (): Promise<Patient[]> => {
        const res = await fetch(`${API_URL}/patients?_t=${Date.now()}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch patients');
        return res.json();
    },

    getPatientsPage: async (page: number, limit: number, search?: string, searchBy?: string): Promise<{ data: Patient[]; total: number }> => {
        const params = new URLSearchParams({ page: String(page), limit: String(limit) });
        if (search) params.set('search', search);
        if (searchBy) params.set('searchBy', searchBy);
        const res = await fetch(`${API_URL}/patients?${params}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch patients page');
        return res.json();
    },

    getPatientById: async (id: string): Promise<Patient> => {
        const res = await fetch(`${API_URL}/patients/${encodeURIComponent(id)}`, { headers });
        if (!res.ok) throw new Error('Failed to fetch patient');
        return res.json();
    },

    // Doctors
    getDoctors: async (): Promise<Doctor[]> => {
        try {
            const res = await fetch(`${API_URL}/doctors`, { headers });
            if (!res.ok) throw new Error('Failed to fetch doctors');
            return res.json();
        } catch (error) {
            console.error('Error fetching doctors:', error);
            return [];
        }
    },
    createPatient: async (patient: Partial<Patient>): Promise<Patient> => {
        // Let the server generate the UUID — don't send a client-side ID
        delete patient.id;
        try {
            const res = await fetch(`${API_URL}/patients`, {
                method: 'POST',
                headers,
                body: JSON.stringify(patient)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Failed to create patient: ${res.statusText}`);
            }
            return await res.json();
        } finally {
            // Invalidate patients list so Agenda and other views pick up the new patient immediately
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        }
    },

    updatePatient: async (id: string, updates: Partial<Patient>): Promise<Patient> => {
        const res = await fetch(`${API_URL}/patients/${id}`, {
            method: 'PUT',
            headers,
            body: JSON.stringify(updates)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to update patient: ${res.statusText}`);
        }
        return res.json();
    },

    // Appointments
    appointments: {
        getAll: async (): Promise<Appointment[]> => {
            const res = await fetch(`${API_URL}/appointments`, { headers });
            if (!res.ok) throw new Error('Failed to fetch appointments');
            return res.json();
        },
        getByPatient: async (patientId: string): Promise<Appointment[]> => {
            const res = await fetch(`${API_URL}/patients/${patientId}/appointments`, { headers });
            if (!res.ok) {
                // Fallback to filtering from getAll
                const all = await fetch(`${API_URL}/appointments`, { headers }).then(r => r.json());
                return all.filter((a: Appointment) => a.patientId === patientId);
            }
            return res.json();
        },
        getById: async (id: string): Promise<Appointment> => {
            console.log(`fetching appointment: ${API_URL}/appointments/${id}`);
            const res = await fetch(`${API_URL}/appointments/${id}`, { headers });
            if (!res.ok) {
                const text = await res.text();
                console.error(`Fetch failed ${res.status}: ${text}`);
                throw new Error(`Failed to fetch appointment: ${res.status} ${text}`);
            }
            return res.json();
        },
        create: async (appointment: Partial<Appointment>): Promise<Appointment> => {
            const res = await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers,
                body: JSON.stringify(appointment)
            });
            try {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to create appointment');
                }
                return await res.json();
            } finally {
                // REQUIRED: Invalidate both global Agenda and Patient-specific caches
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                if (appointment.patientId) {
                    queryClient.invalidateQueries({ queryKey: ['patient-appointments', appointment.patientId] });
                }
            }
        },
        update: async (id: string, updates: Partial<Appointment>): Promise<Appointment> => {
            const res = await fetch(`${API_URL}/appointments/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updates)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to update appointment');
            }
            const data = await res.json();
            // Invalidate cache after successful update so Agenda colors refresh
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
            queryClient.invalidateQueries({ queryKey: ['calendar'] });
            return data;
        },
        delete: async (id: string): Promise<void> => {
            const res = await fetch(`${API_URL}/appointments/${id}`, {
                method: 'DELETE',
                headers
            });
            try {
                if (!res.ok) {
                    const errData = await res.json().catch(() => ({}));
                    throw new Error(errData.error || 'Failed to delete appointment');
                }
            } finally {
                queryClient.invalidateQueries({ queryKey: ['appointments'] });
                // Note: We don't have patientId here, but invalidateQueries with partial match or a full refresh would be safer
                // However, since we don't know the patientId, we just invalidate the global one.
                // If needed, we could fetch before delete, but for now we follow the instruction.
            }
        }
    },

    // Clinical Records
    clinicalRecords: {
        getByPatient: async (patientId: string): Promise<ClinicalRecord[]> => {
            const res = await fetch(`${API_URL}/patients/${patientId}/clinical-records`, { headers });
            if (!res.ok) throw new Error('Failed to fetch clinical records');
            return res.json();
        },
        create: async (data: { patientId: string, treatment: string, observation: string, specialization: string, doctorId: string }): Promise<ClinicalRecord> => {
            const res = await fetch(`${API_URL}/clinical-records`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create clinical record');
            return res.json();
        },
        delete: async (id: string): Promise<void> => {
            const res = await fetch(`${API_URL}/clinical-records/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete clinical record');
        },
        update: async (id: string, data: { treatment?: string, observation?: string, specialization?: string, doctorId?: string, date?: string }): Promise<ClinicalRecord> => {
            const res = await fetch(`${API_URL}/clinical-records/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to update clinical record');
            }
            return res.json();
        },
        reassignDoctor: async (recordId: string, doctorId: string): Promise<any> => {
            const res = await fetch(`${API_URL}/clinical-records/${recordId}/reassign-doctor`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ doctorId })
            });
            if (!res.ok) throw new Error('Failed to reassign doctor');
            return res.json();
        }
    },

    // Treatments
    treatments: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/treatments`, { headers });
            if (!res.ok) throw new Error('Failed to fetch treatments');
            return res.json();
        },
        createBatch: async (patientId: string, treatments: any[]) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/treatments/batch`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ treatments })
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create treatments');
            }
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/treatments/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete treatment');
        }
    },

    // Budgets
    budget: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, { headers });
            if (!res.ok) throw new Error('Failed to load budgets');
            return res.json();
        },
        getAll: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, { headers });
            if (!res.ok) throw new Error('Failed to load budgets');
            return res.json();
        },
        create: async (patientId: string, items: any[], title?: string, discountPercent: number = 0, commissionPercent: number = 0, referralEntityName: string = '') => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ items, title, discountPercent, commissionPercent, referralEntityName: referralEntityName || null })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create budget');
            }
            return res.json();
        },
        update: async (budgetId: string, items: any[], title?: string, discountPercent: number = 0, commissionPercent: number = 0, referralEntityName: string = '') => {
            const res = await fetch(`${API_URL}/budgets/${budgetId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ items, title, discountPercent, commissionPercent, referralEntityName: referralEntityName || null })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update budget');
            }
            return res.json();
        },
        addItemToDraft: async (patientId: string, item: any) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets/draft/items`, {
                method: 'POST',
                headers,
                body: JSON.stringify(item)
            });
            if (!res.ok) throw new Error('Failed to add item to draft');
            return res.json();
        },
        deleteItem: async (itemId: string) => {
            const res = await fetch(`${API_URL}/budgets/items/${itemId}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete item');
            return res.json();
        },
        updateStatus: async (id: string, status: string) => {
            const res = await fetch(`${API_URL}/budgets/${id}/status`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ status })
            });
            if (!res.ok) throw new Error('Failed to update budget status');
            return res.json();
        },
        applyDiscount: async (id: string, discountPercent: number) => {
            const res = await fetch(`${API_URL}/budgets/${id}/discount`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ discountPercent })
            });
            if (!res.ok) throw new Error('Failed to apply discount');
            return res.json();
        },
        applyCommission: async (id: string, commissionPercent: number) => {
            const res = await fetch(`${API_URL}/budgets/${id}/commission`, {
                method: 'PUT',
                headers,
                body: JSON.stringify({ commissionPercent })
            });
            if (!res.ok) throw new Error('Failed to apply commission');
            return res.json();
        },
        getReferralCommissions: async (dateFrom?: string, dateTo?: string) => {
            const params = new URLSearchParams();
            if (dateFrom) params.set('dateFrom', dateFrom);
            if (dateTo) params.set('dateTo', dateTo);
            const res = await fetch(`${API_URL}/referral-commissions?${params}`, { headers });
            if (!res.ok) throw new Error('Failed to load referral commissions');
            return res.json();
        },
        convert: async (id: string) => {
            const res = await fetch(`${API_URL}/budgets/${id}/convert`, {
                method: 'POST',
                headers
            });
            if (!res.ok) throw new Error('Failed to convert budget');
            return res.json();
        },
        convertToInvoice: async (id: string) => {
            const res = await fetch(`${API_URL}/budgets/${id}/convert`, {
                method: 'POST',
                headers
            });
            if (!res.ok) throw new Error('Failed to convert budget');
            return res.json();
        },
        createFinancing: async (data: any) => {
            const res = await fetch(`${API_URL}/finance/financing`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create financing plan');
            return res.json();
        },
        getInstallments: async (planId: string) => {
            const res = await fetch(`${API_URL}/finance/installments/${planId}`, { headers });
            if (!res.ok) throw new Error('Failed to get installments');
            return res.json();
        },
        markInstallmentPaid: async (installmentId: string) => {
            const res = await fetch(`${API_URL}/finance/installments/${installmentId}/pay`, {
                method: 'POST',
                headers
            });
            if (!res.ok) throw new Error('Failed to mark installment paid');
            return res.json();
        },
        getPatientPlans: async (patientId: string) => {
            const res = await fetch(`${API_URL}/finance/plans/${patientId}`, { headers });
            if (!res.ok) throw new Error('Failed to get financing plans');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/budgets/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete budget');
        }
    },

    downloadBatchZip: async (invoices: any[], date: string) => {
        const res = await fetch(`${API_URL}/finance/invoices/export/batch`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ invoices, date })
        });
        if (!res.ok) throw new Error('Failed to download ZIP');

        // Trigger download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `facturas_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    },



    // AI Agent
    ai: {
        query: async (message: string, patientId?: string, context?: any) => {
            const res = await fetch(`${API_URL}/ai/query`, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    message,
                    context: { patientId, ...context } // Pass patientId in context for the agent
                })
            });
            if (!res.ok) throw new Error('AI query failed');
            return res.json();
        },

        improveMessage: async (text: string, patientName?: string, type: 'whatsapp' | 'clinical_note' | 'prescription' = 'whatsapp') => {
            const res = await fetch(`${API_URL}/ai/improve`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ text, patientName, type })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                console.error("AI Service Error:", errData);
                throw new Error(errData.error || `Error ${res.status}: Failed to improve text`);
            }

            const data = await res.json();
            return data.text;
        }
    },

    // Services Catalog
    services: {
        getAll: async (filters?: { specialty?: string; search?: string }) => {
            let url = `${API_URL}/services`;
            if (filters) {
                const params = new URLSearchParams();
                if (filters.specialty) params.set('specialty', filters.specialty);
                if (filters.search) params.set('search', filters.search);
                if (params.toString()) url += `?${params}`;
            }
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to fetch services');
            return res.json();
        },
        getSpecialties: async () => {
            const res = await fetch(`${API_URL}/services/specialties`, { headers });
            if (!res.ok) throw new Error('Failed to fetch specialties');
            return res.json();
        },
        create: async (serviceData: any) => {
            const res = await fetch(`${API_URL}/services`, {
                method: 'POST',
                headers,
                body: JSON.stringify(serviceData)
            });
            if (!res.ok) throw new Error('Failed to create service');
            return res.json();
        },
        update: async (id: string, updates: any) => {
            const res = await fetch(`${API_URL}/services/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(updates)
            });
            if (!res.ok) throw new Error('Failed to update service');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/services/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete service');
            return res.json();
        }
    },

    // Odontogram
    odontogram: {
        get: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/odontogram`, { headers });
            if (!res.ok) return { teethState: "{}" };
            return res.json();
        },
        save: async (patientId: string, teethState: any) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/odontogram`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ teethState })
            });
            if (!res.ok) throw new Error('Failed to save odontogram');
            return res.json();
        }
    },

    // Snapshots
    snapshots: {
        save: async (patientId: string, imageUrl: string, description: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/snapshots`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ imageUrl, description })
            });
            if (!res.ok) throw new Error('Failed to save snapshot');
            return res.json();
        },
        list: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/snapshots`, { headers });
            if (!res.ok) return [];
            return res.json();
        }
    },

    // WhatsApp
    whatsapp: {
        getStatus: async () => {
            const res = await fetch(`${API_URL}/whatsapp/status`, { headers });
            if (!res.ok) throw new Error('Failed to fetch status');
            return res.json();
        },
        getQr: async () => {
            const res = await fetch(`${API_URL}/whatsapp/qr`, { headers });
            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || 'Failed to fetch QR');
            }
            return res.json();
        },
        logout: async () => {
            const res = await fetch(`${API_URL}/whatsapp/logout`, { method: 'POST', headers });
            if (!res.ok) throw new Error('Failed to logout');
            return res.json();
        },
        getLogs: async (patientId?: string) => {
            const url = patientId ? `${API_URL}/whatsapp/logs?patientId=${patientId}` : `${API_URL}/whatsapp/logs`;
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Failed to fetch logs');
            return res.json();
        },
        getTemplates: async () => {
            const res = await fetch(`${API_URL}/whatsapp/templates`, { headers });
            if (!res.ok) throw new Error('Failed to fetch templates');
            return res.json();
        },
        createTemplate: async (data: any) => {
            const res = await fetch(`${API_URL}/whatsapp/templates`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create template');
            return res.json();
        },
        deleteTemplate: async (id: string) => {
            const res = await fetch(`${API_URL}/whatsapp/templates/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete template');
            return res.json();
        },
        scheduleMessage: async (data: { patientId: string, templateId?: string, scheduledDate: string, content: string }) => {
            const res = await fetch(`${API_URL}/whatsapp/schedule`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to schedule message');
            return res.json();
        }
    },

    // Schedule & Availability
    schedule: {
        getDoctors: async () => {
            const res = await fetch(`${API_URL}/schedule/doctors`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        createDoctor: async (data: any) => {
            const res = await fetch(`${API_URL}/schedule/doctors`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create doctor schedule');
            return res.json();
        },
        updateDoctor: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/schedule/doctors/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update doctor schedule');
            return res.json();
        },
        deleteDoctor: async (id: string) => {
            const res = await fetch(`${API_URL}/schedule/doctors/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete doctor schedule');
        },
        getServiceDurations: async () => {
            const res = await fetch(`${API_URL}/schedule/durations`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        createDuration: async (data: any) => {
            const res = await fetch(`${API_URL}/schedule/durations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create duration');
            return res.json();
        },
        updateDuration: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/schedule/durations/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update duration');
            return res.json();
        },
        deleteDuration: async (id: string) => {
            const res = await fetch(`${API_URL}/schedule/durations/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete duration');
        }
    },

    // Vacations
    vacations: {
        getAll: async () => {
            const res = await fetch(`${API_URL}/vacations`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_URL}/vacations`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create vacation');
            return res.json();
        },
        update: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/vacations/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update vacation');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/vacations/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete vacation');
        }
    },

    // Users
    users: {
        getAll: async () => {
            const res = await fetch(`${API_URL}/users`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (data: any) => {
            const res = await fetch(`${API_URL}/users`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create user');
            }
            return res.json();
        },
        update: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/users/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to update user');
            }
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/users/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete user');
        }
    },

    // Gmail OAuth Integration
    gmail: {
        getStatus: async (): Promise<{ connected: boolean; email: string | null }> => {
            const res = await fetch(`${API_URL}/gmail/status`, { headers });
            if (!res.ok) throw new Error('Failed to fetch Gmail status');
            return res.json();
        },
        getAuthUrl: async (): Promise<{ url: string }> => {
            const res = await fetch(`${API_URL}/gmail/auth-url`, { headers });
            if (!res.ok) throw new Error('Failed to get Gmail auth URL');
            return res.json();
        },
        disconnect: async (): Promise<{ success: boolean }> => {
            const res = await fetch(`${API_URL}/gmail/disconnect`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to disconnect Gmail');
            return res.json();
        },
    },

    // Clinic Info (Supabase Direct)
    clinic: {
        getInfo: async () => {
            try {
                const { data, error } = await supabase
                    .from('clinic_info')
                    .select('*')
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                return data || null;
            } catch (error) {
                console.error('Error fetching clinic info:', error);
                return null;
            }
        },

        getAddresses: async () => {
            try {
                const { data, error } = await supabase
                    .from('clinic_addresses')
                    .select('*');

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('Error fetching clinic addresses:', error);
                return [];
            }
        },

        getBillingInfo: async () => {
            try {
                const { data, error } = await supabase
                    .from('clinic_billing_info')
                    .select('*')
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                return data || null;
            } catch (error) {
                console.error('Error fetching billing info:', error);
                return null;
            }
        },

        create: async (clinicData: any) => {
            try {
                const { data, error } = await supabase
                    .from('clinic_info')
                    .insert([clinicData])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error creating clinic info:', error);
                throw error;
            }
        },

        update: async (id: string, clinicData: any) => {
            try {
                const { data, error } = await supabase
                    .from('clinic_info')
                    .update(clinicData)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error updating clinic info:', error);
                throw error;
            }
        }
    },

    // Doctor Schedules
    doctorSchedules: {
        getAll: async () => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules`, { headers });
                if (!res.ok) throw new Error('Failed to fetch doctor schedules');
                return await res.json();
            } catch (error) {
                console.error('Error fetching doctor schedules:', error);
                return [];
            }
        },

        getByDoctor: async (doctorId: string): Promise<any[]> => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules/doctor/${doctorId}`, { headers });
                if (!res.ok) throw new Error('Failed to fetch doctor schedule');
                return await res.json(); // Returns array now
            } catch (error) {
                console.error('Error fetching doctor schedule:', error);
                return []; // Return an empty array on error
            }
        },

        create: async (scheduleData: any) => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(scheduleData)
                });
                if (!res.ok) throw new Error('Failed to create doctor schedule');
                return await res.json();
            } catch (error) {
                console.error('Error creating doctor schedule:', error);
                throw error;
            }
        },

        update: async (id: string, scheduleData: any) => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules/${id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(scheduleData)
                });
                if (!res.ok) throw new Error('Failed to update doctor schedule');
                return await res.json();
            } catch (error) {
                console.error('Error updating doctor schedule:', error);
                throw error;
            }
        },

        getOverrides: async (params?: { doctorId?: string; dateFrom?: string; dateTo?: string }) => {
            try {
                const query = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v)).join('&') : '';
                const res = await fetch(`${API_URL}/doctor-schedules/overrides${query}`, { headers });
                if (!res.ok) throw new Error('Failed to fetch schedule overrides');
                return await res.json();
            } catch (error) {
                console.error('Error fetching schedule overrides:', error);
                return [];
            }
        },

        createOverride: async (data: { doctorId: string; date: string; startTime: string; endTime: string; notes?: string | null }) => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules/overrides`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(data)
                });
                if (!res.ok) throw new Error('Failed to create schedule override');
                return await res.json();
            } catch (error) {
                console.error('Error creating schedule override:', error);
                throw error;
            }
        },

        deleteOverride: async (id: string) => {
            try {
                const res = await fetch(`${API_URL}/doctor-schedules/overrides/${id}`, {
                    method: 'DELETE',
                    headers
                });
                if (!res.ok) throw new Error('Failed to delete schedule override');
                return await res.json();
            } catch (error) {
                console.error('Error deleting schedule override:', error);
                throw error;
            }
        }
    },

    // System Users
    systemUsers: {
        getAll: async () => {
            try {
                const res = await fetch(`${API_URL}/system-users`, { headers });
                if (!res.ok) throw new Error('Failed to fetch users');
                return await res.json();
            } catch (error) {
                console.error('Error fetching system users:', error);
                return [];
            }
        },

        getAllIncludeInactive: async () => {
            try {
                const res = await fetch(`${API_URL}/system-users/all`, { headers });
                if (!res.ok) throw new Error('Failed to fetch all users');
                return await res.json();
            } catch (error) {
                console.error('Error fetching all system users:', error);
                return [];
            }
        },

        getById: async (id: string) => {
            try {
                const res = await fetch(`${API_URL}/system-users/${id}`, { headers });
                if (!res.ok) throw new Error('Failed to fetch user');
                return await res.json();
            } catch (error) {
                console.error('Error fetching system user:', error);
                return null;
            }
        },

        create: async (userData: any) => {
            try {
                const res = await fetch(`${API_URL}/system-users`, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(userData)
                });
                if (!res.ok) throw new Error('Failed to create user');
                return await res.json();
            } catch (error) {
                console.error('Error creating system user:', error);
                throw error;
            }
        },

        update: async (id: string, userData: any) => {
            try {
                const res = await fetch(`${API_URL}/system-users/${id}`, {
                    method: 'PUT',
                    headers,
                    body: JSON.stringify(userData)
                });
                if (!res.ok) throw new Error('Failed to update user');
                return await res.json();
            } catch (error) {
                console.error('Error updating system user:', error);
                throw error;
            }
        },

        delete: async (id: string) => {
            try {
                const res = await fetch(`${API_URL}/system-users/${id}`, {
                    method: 'DELETE',
                    headers
                });
                if (!res.ok) throw new Error('Failed to delete user');
            } catch (error) {
                console.error('Error deleting system user:', error);
                throw error;
            }
        }
    },

    // Clinical Treatment Plans (Feature 1)
    clinicalPlans: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/clinical-plans/${patientId}`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (data: { patientId: string; name?: string; notes?: string; steps?: any[] }) => {
            const res = await fetch(`${API_URL}/clinical-plans`, {
                method: 'POST', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to create clinical plan');
            return res.json();
        },
        update: async (id: string, data: { name?: string; status?: string; notes?: string }) => {
            const res = await fetch(`${API_URL}/clinical-plans/${id}`, {
                method: 'PUT', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update clinical plan');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/clinical-plans/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete clinical plan');
        },
        addStep: async (data: { planId: string; treatmentName: string; toothId?: number; notes?: string }) => {
            const res = await fetch(`${API_URL}/clinical-plan-steps`, {
                method: 'POST', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to add step');
            return res.json();
        },
        updateStep: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/clinical-plan-steps/${id}`, {
                method: 'PUT', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Failed to update step');
            return res.json();
        },
        deleteStep: async (id: string) => {
            const res = await fetch(`${API_URL}/clinical-plan-steps/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete step');
        }
    },

    // Expenses (Gastos de la Clínica)
    expenses: {
        getAll: async () => {
            try {
                const res = await fetch(`${API_URL}/expenses`, { headers });
                if (!res.ok) return [];
                return res.json();
            } catch { return []; }
        },
        create: async (data: any) => {
            const res = await fetch(`${API_URL}/expenses`, {
                method: 'POST', headers, body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error al crear gasto');
            }
            return res.json();
        },
        update: async (id: string, data: any) => {
            const res = await fetch(`${API_URL}/expenses/${id}`, {
                method: 'PUT', headers, body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error('Error al actualizar gasto');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/expenses/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Error al eliminar gasto');
        }
    },

    // Agenda Closures (Feature 4)
    agendaClosures: {
        getAll: async (date?: string) => {
            const url = date ? `${API_URL}/agenda-closures?date=${date}` : `${API_URL}/agenda-closures`;
            const res = await fetch(url, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (data: { date: string; doctorId?: string; reason?: string }) => {
            const res = await fetch(`${API_URL}/agenda-closures`, {
                method: 'POST', headers, body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create closure');
            }
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/agenda-closures/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete closure');
        }
    },

    // Liquidations (BLOQUE 2.1)
    liquidations: {
        getSummary: async (doctorId: string, month: number, year: number) => {
            const res = await fetch(
                `${API_URL}/liquidations/summary?doctorId=${doctorId}&month=${month}&year=${year}`,
                { headers }
            );
            if (!res.ok) throw new Error('Failed to fetch liquidation summary');
            return res.json();
        },
        update: async (id: string, data: { treatmentName?: string; doctorId?: string; grossAmount?: number; labCost?: number; commissionRate?: number }) => {
            const res = await fetch(`${API_URL}/finance/liquidations/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to update liquidation');
            }
            return res.json();
        }
    },

    // Consents (BLOQUE 4.1)
    consents: {
        getAll: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/consents`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (patientId: string, templateId: string, isSigned: boolean = false) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/consents`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ templateId, isSigned })
            });
            if (!res.ok) throw new Error('Failed to create consent');
            return res.json();
        },
        update: async (patientId: string, consentId: string, isSigned: boolean) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/consents/${consentId}`, {
                method: 'PATCH',
                headers,
                body: JSON.stringify({ isSigned })
            });
            if (!res.ok) throw new Error('Failed to update consent');
            return res.json();
        },
        delete: async (patientId: string, consentId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/consents/${consentId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Failed to delete consent');
        }
    },

    // Documents (BLOQUE 4.2)
    documents: {
        getAll: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/documents`, { headers });
            if (!res.ok) return [];
            return res.json();
        },
        create: async (patientId: string, fileName: string, documentType: string, description?: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/documents`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ fileName, documentType, description })
            });
            if (!res.ok) throw new Error('Failed to upload document');
            return res.json();
        },
        delete: async (patientId: string, documentId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/documents/${documentId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error('Failed to delete document');
        },
        download: async (patientId: string, documentId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/documents/${documentId}/download`, { headers });
            if (!res.ok) throw new Error('Failed to download document');
            return res.json();
        }
    },

    // Document Templates (Gestor de Plantillas – Settings)
    templates: {
        getAll: async () => {
            const res = await fetch(`${API_URL}/templates`, { headers });
            if (!res.ok) throw new Error('Failed to fetch templates');
            return res.json();
        },
        upload: async (file: File, title: string, category: string): Promise<any> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const base64 = (e.target?.result as string).split(',')[1];
                        const type = file.name.endsWith('.pdf') ? 'pdf' : 'docx';
                        const res = await fetch(`${API_URL}/templates`, {
                            method: 'POST',
                            headers,
                            body: JSON.stringify({ title, category, type, contentBase64: base64 })
                        });
                        if (!res.ok) {
                            const err = await res.json().catch(() => ({}));
                            reject(new Error(err.error || 'Failed to upload template'));
                        } else {
                            resolve(await res.json());
                        }
                    } catch (err) { reject(err); }
                };
                reader.onerror = () => reject(new Error('Failed to read file'));
                reader.readAsDataURL(file);
            });
        },
        update: async (id: string, data: { title?: string; category?: string; content?: string }) => {
            const res = await fetch(`${API_URL}/templates/${id}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error('Failed to update template');
            return res.json();
        },
        create: async (data: { title: string; category: string; content: string }) => {
            const res = await fetch(`${API_URL}/templates`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ ...data, type: 'html' }),
            });
            if (!res.ok) throw new Error('Failed to create template');
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/templates/${id}`, { method: 'DELETE', headers });
            if (!res.ok) throw new Error('Failed to delete template');
            return res.json();
        },
        getDownloadUrl: (filename: string) => `${API_URL}/templates/file/${filename}`,
    },

    // Cash Register Closing
    cashRegister: {
        getToday: async () => {
            try {
                const res = await fetch(`${API_URL}/finance/cash-register/today`, { headers });
                if (!res.ok) return null;
                const data = await res.json();
                return data || null;
            } catch { return null; }
        },
        getByDate: async (date: string) => {
            try {
                const res = await fetch(`${API_URL}/finance/cash-register/by-date/${date}`, { headers });
                if (!res.ok) return null;
                const data = await res.json();
                return data || null;
            } catch { return null; }
        },
        getLastClosing: async () => {
            try {
                const res = await fetch(`${API_URL}/finance/cash-register/last-closing`, { headers });
                if (!res.ok) return null;
                const data = await res.json();
                return data || null;
            } catch { return null; }
        },
        close: async (payload: {
            totalIncome: number; totalExpense: number; balance: number;
            cashIncome: number; cardIncome: number; transferIncome: number;
            cashExpenses: number; netCash: number; physicalCash: number;
            cashDiff: number; invoiceCount: number; completedAppointments: number;
            openingCash: number;
            closedBy?: string;
        }) => {
            const res = await fetch(`${API_URL}/finance/cash-register/close`, {
                method: 'POST', headers, body: JSON.stringify(payload)
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error al cerrar la caja');
            }
            return res.json();
        }
    },

    audit: {
        getLogs: async (params?: {
            resource_type?: string;
            user_id?: string;
            action?: string;
            date_from?: string;
            date_to?: string;
            limit?: number;
            offset?: number;
        }): Promise<{ data: any[]; total: number; limit: number; offset: number }> => {
            const qs = new URLSearchParams();
            if (params?.resource_type) qs.set('resource_type', params.resource_type);
            if (params?.user_id)       qs.set('user_id',       params.user_id);
            if (params?.action)        qs.set('action',        params.action);
            if (params?.date_from)     qs.set('date_from',     params.date_from);
            if (params?.date_to)       qs.set('date_to',       params.date_to);
            if (params?.limit  != null) qs.set('limit',  String(params.limit));
            if (params?.offset != null) qs.set('offset', String(params.offset));
            const url = `${API_URL}/audit/logs${qs.toString() ? '?' + qs.toString() : ''}`;
            const res = await fetch(url, { headers });
            if (!res.ok) throw new Error('Error al cargar el log de auditoría');
            return res.json();
        },
    },

    clinicSettings: {
        async getPaymentPinHash(): Promise<string | null> {
            const { data, error } = await supabase
                .from('clinic_settings')
                .select('value')
                .eq('key', 'payment_auth_pin_hash')
                .maybeSingle();
            if (error) throw error;
            return data?.value ?? null;
        },

        async setPaymentPin(pin: string): Promise<void> {
            const hash = await sha256(pin);
            const { error } = await supabase
                .from('clinic_settings')
                .upsert({ key: 'payment_auth_pin_hash', value: hash, updated_at: new Date().toISOString() }, { onConflict: 'key' });
            if (error) throw error;
        },

        async hasPaymentPin(): Promise<boolean> {
            const hash = await api.clinicSettings.getPaymentPinHash();
            return hash !== null;
        },
    },

    reminders: {
        create: async (data: {
            patientId: string;
            description: string;
            dueDate: string;
            priority: 'LOW' | 'MEDIUM' | 'HIGH';
            notificationMethod: 'IN_APP' | 'WHATSAPP' | 'EMAIL' | 'BOTH';
            notes?: string;
        }) => {
            const res = await fetch(`${API_URL}/reminders`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },

        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/reminders?patientId=${patientId}`, { headers });
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            // Normalize snake_case fields returned by the DB to camelCase
            return (Array.isArray(data) ? data : []).map((r: any) => ({
                ...r,
                dueDate: r.dueDate ?? r.due_date,
                patientId: r.patientId ?? r.patient_id,
                notificationMethod: r.notificationMethod ?? r.notification_method,
                createdAt: r.createdAt ?? r.created_at,
                completedAt: r.completedAt ?? r.completed_at,
                updatedAt: r.updatedAt ?? r.updated_at,
            }));
        },

        getById: async (reminderId: string) => {
            const res = await fetch(`${API_URL}/reminders/${reminderId}`, { headers });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },

        update: async (reminderId: string, data: Partial<{
            description: string;
            dueDate: string;
            priority: 'LOW' | 'MEDIUM' | 'HIGH';
            status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
            notes: string;
        }>) => {
            const res = await fetch(`${API_URL}/reminders/${reminderId}`, {
                method: 'PUT',
                headers,
                body: JSON.stringify(data)
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },

        delete: async (reminderId: string) => {
            const res = await fetch(`${API_URL}/reminders/${reminderId}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },

        getPendingDue: async () => {
            const res = await fetch(`${API_URL}/reminders/pending/due`, { headers });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        }
    },
};

/** SHA-256 hash using built-in Web Crypto API */
async function sha256(text: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export { sha256 };



