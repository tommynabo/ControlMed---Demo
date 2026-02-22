import { Patient, Appointment, Invoice, ClinicalRecord, InventoryItem, Doctor } from '../types';
import { supabase } from './supabase';

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

const headers = {
    'Content-Type': 'application/json',
    // 'x-user-role': 'DOCTOR' // Default role for now
};

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

    // Payments (New)
    payments: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/payments`, { headers });
            if (!res.ok) throw new Error('Failed to fetch payments');
            return res.json();
        },
        create: async (paymentData: {
            patientId: string;
            amount: number;
            method: 'cash' | 'card' | 'transfer';
            type: 'ADVANCE_PAYMENT' | 'DIRECT_CHARGE';
            budgetId?: string;
            notes?: string;
        }) => {
            const res = await fetch(`${API_URL}/payments/create`, {
                method: 'POST',
                headers,
                body: JSON.stringify(paymentData)
            });
            if (!res.ok) throw new Error('Failed to create payment');
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
        }) => {
            const res = await fetch(`${API_URL}/payments/transfer`, {
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
        }
    },

    // Patients
    getPatients: async (): Promise<Patient[]> => {
        const res = await fetch(`${API_URL}/patients`, { headers });
        if (!res.ok) throw new Error('Failed to fetch patients');
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
        // Client-side ID generation fallback (Robust)
        if (!patient.id) {
            patient.id = self.crypto?.randomUUID ? self.crypto.randomUUID() : `pat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        }
        const res = await fetch(`${API_URL}/patients`, {
            method: 'POST',
            headers,
            body: JSON.stringify(patient)
        });
        if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            throw new Error(errData.error || `Failed to create patient: ${res.statusText}`);
        }
        return res.json();
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
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to create appointment');
            }
            return res.json();
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
            return res.json();
        },
        delete: async (id: string): Promise<void> => {
            const res = await fetch(`${API_URL}/appointments/${id}`, {
                method: 'DELETE',
                headers
            });
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || 'Failed to delete appointment');
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
        create: async (data: { patientId: string, treatment: string, observation: string, specialization: string }): Promise<ClinicalRecord> => {
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
        create: async (patientId: string, items: any[], title?: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, {
                method: 'POST',
                headers,
                body: JSON.stringify({ items, title })
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Failed to create budget');
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

    // Doctor Schedules (Supabase Direct)
    doctorSchedules: {
        getAll: async () => {
            try {
                const { data, error } = await supabase
                    .from('doctor_schedules')
                    .select('*')
                    .eq('is_active', true);

                if (error) throw error;
                return data || [];
            } catch (error) {
                console.error('Error fetching doctor schedules:', error);
                return [];
            }
        },

        getByDoctor: async (doctorId: string) => {
            try {
                const { data, error } = await supabase
                    .from('doctor_schedules')
                    .select('*')
                    .eq('doctor_id', doctorId)
                    .single();

                if (error && error.code !== 'PGRST116') throw error;
                return data || null;
            } catch (error) {
                console.error('Error fetching doctor schedule:', error);
                return null;
            }
        },

        create: async (scheduleData: any) => {
            try {
                const { data, error } = await supabase
                    .from('doctor_schedules')
                    .insert([scheduleData])
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error creating doctor schedule:', error);
                throw error;
            }
        },

        update: async (id: string, scheduleData: any) => {
            try {
                const { data, error } = await supabase
                    .from('doctor_schedules')
                    .update(scheduleData)
                    .eq('id', id)
                    .select()
                    .single();

                if (error) throw error;
                return data;
            } catch (error) {
                console.error('Error updating doctor schedule:', error);
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
    }
};


