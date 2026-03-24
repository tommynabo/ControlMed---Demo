
import { Liquidation, TreatmentPlan } from '../types';

const API_URL = '/api';

// Helper to get headers (Mock Auth)
const getHeaders = () => {
    const role = localStorage.getItem('user_role') || 'DOCTOR';
    return {
        'Content-Type': 'application/json',
        'x-user-role': role,
        'x-user-id': 'mock-current-user-id'
    };
};

export const api = {
    // Budget & Finance
    budget: {
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, { headers: getHeaders() });
            return res.json();
        },
        create: async (patientId: string, items: any[], title?: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ items, title })
            });
            return res.json();
        },
        update: async (budgetId: string, items: any[], title?: string) => {
            const res = await fetch(`${API_URL}/budgets/${budgetId}`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ items, title })
            });
            return res.json();
        },
        addItemToDraft: async (patientId: string, item: any) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/budgets/draft/items`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(item)
            });
            return res.json();
        },
        updateStatus: async (budgetId: string, status: string) => {
            const res = await fetch(`${API_URL}/budgets/${budgetId}/status`, {
                method: 'PUT',
                headers: getHeaders(),
                body: JSON.stringify({ status })
            });
            return res.json();
        },
        deleteItem: async (itemId: string) => {
            const res = await fetch(`${API_URL}/budgets/items/${itemId}`, { 
                method: 'DELETE', 
                headers: getHeaders() 
            });
            return res.json();
        },
        convertToInvoice: async (budgetId: string) => {
            const res = await fetch(`${API_URL}/budgets/${budgetId}/convert`, {
                method: 'POST',
                headers: getHeaders()
            });
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/budgets/${id}`, { method: 'DELETE', headers: getHeaders() });
            if (!res.ok) throw new Error('Failed to delete budget');
        },
        createFinancing: async (data: any) => {
            const res = await fetch(`${API_URL}/finance/financing`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(data)
            });
            return res.json();
        }
    },
    // Auth
    login: async (email, password) => {
        try {
            const res = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const contentType = res.headers.get("content-type");
            if (contentType && contentType.indexOf("application/json") !== -1) {
                const data = await res.json();
                if (res.status === 401) throw new Error("Credenciales inválidas (Usuario o contraseña incorrectos)");
                // Combine error title with message/details/code/stack if available to give full context
                if (!res.ok) {
                    const details = data.details || data.message || data.stack || '';
                    const errorMsg = data.error || "Error de conexión con el servidor";
                    throw new Error(`${errorMsg}${details ? `: ${details}` : ''}`);
                }
                return data;
            } else {
                const text = await res.text();
                console.error("Non-JSON Response from Server:", text);
                throw new Error("El servidor devolvió una respuesta inesperada (posible error 500 o 404). Revisa la consola.");
            }
        } catch (e) {
            console.error("Login Error:", e);
            throw e;
        }
    },

    // Core: Patients
    getPatients: async () => {
        const res = await fetch(`${API_URL}/patients`, { headers: getHeaders() });
        return res.json();
    },
    createPatient: async (patientData: any) => {
        const res = await fetch(`${API_URL}/patients`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(patientData)
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || 'Error creando paciente en el servidor');
        }
        return res.json();
    },

    // Core: Appointments
    appointments: {
        create: async (appointment: any) => {
            const res = await fetch(`${API_URL}/appointments`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(appointment)
            });
            if (!res.ok) throw new Error('Error creating appointment');
            return res.json();
        },
        getAll: async () => {
            const res = await fetch(`${API_URL}/appointments`, { headers: getHeaders() });
            if (!res.ok) throw new Error('Error fetching appointments');
            return res.json();
        }
    },

    // Odontogram
    getOdontogram: async (patientId: string) => {
        const res = await fetch(`${API_URL}/patients/${patientId}/odontogram`, { headers: getHeaders() });
        return res.json();
    },
    saveOdontogram: async (patientId: string, teethState: string) => {
        const res = await fetch(`${API_URL}/patients/${patientId}/odontogram`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ teethState })
        });
        return res.json();
    },
    saveSnapshot: async (patientId: string, imageUrl: string, description: string) => {
        const res = await fetch(`${API_URL}/patients/${patientId}/snapshots`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ imageUrl, description })
        });
        return res.json();
    },
    getSnapshots: async (patientId: string) => {
        const res = await fetch(`${API_URL}/patients/${patientId}/snapshots`, { headers: getHeaders() });
        return res.json();
    },
    updateSnapshot: async (id: string, description: string) => {
        const res = await fetch(`${API_URL}/snapshots/${id}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify({ description })
        });
        return res.json();
    },

    // Clinical Records
    clinicalRecords: {
        create: async (record: any) => {
            const res = await fetch(`${API_URL}/clinical-records`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify(record)
            });
            if (!res.ok) throw new Error("Error creating record");
            return res.json();
        },
        getByPatient: async (patientId: string) => {
            const res = await fetch(`${API_URL}/patients/${patientId}/clinical-records`, { headers: getHeaders() });
            return res.json();
        },
        delete: async (id: string) => {
            const res = await fetch(`${API_URL}/clinical-records/${id}`, { method: 'DELETE', headers: getHeaders() });
            if (!res.ok) throw new Error('Failed to delete clinical record');
        }
    },

    // Module 1: Finance
    getLiquidations: async (doctorId?: string, month?: string): Promise<{ records: Liquidation[], totalToPay: number }> => {
        const params = new URLSearchParams();
        if (doctorId) params.append('doctorId', doctorId);
        if (month) params.append('month', month);

        const res = await fetch(`${API_URL}/liquidations?${params}`, { headers: getHeaders() });
        if (!res.ok) throw new Error('Failed to fetch liquidations');
        return res.json();
    },

    completeTreatment: async (appointmentId: string) => {
        const res = await fetch(`${API_URL}/treatments/${appointmentId}/complete`, {
            method: 'POST',
            headers: getHeaders()
        });
        return res.json();
    },

    // Module 2: Ortho
    createPlan: async (planData: Partial<TreatmentPlan> & { patientId: string }) => {
        const res = await fetch(`${API_URL}/plans`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(planData)
        });
        return res.json();
    },

    getPatientAlerts: async (patientId: string) => {
        const res = await fetch(`${API_URL}/patients/${patientId}/alerts`, { headers: getHeaders() });
        return res.json();
    },

    // Module 4: AI
    ai: {
        query: async (prompt: string, patientId?: string) => {
            const res = await fetch(`${API_URL}/ai/query`, {
                method: 'POST',
                headers: getHeaders(),
                body: JSON.stringify({ message: prompt, context: { patientId } })
            });
            return res.json();
        }
    },

    // Module 5: Inventory
    checkStock: async (currentStock: any[]) => {
        const res = await fetch(`${API_URL}/inventory/check`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ currentStock })
        });
        return res.json();
    },

    // Module 6: Invoicing (FacturaDirecta Integration)
    generateInvoice: async (data: { patient: any, items: any[], paymentMethod: 'cash' | 'card', type?: 'ordinary' | 'rectificative' }) => {
        const res = await fetch(`${API_URL}/finance/invoice`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(data)
        });
        return res.json();
    },

    getInvoices: async () => {
        const res = await fetch(`${API_URL}/finance/invoices`, { headers: getHeaders() });
        return res.json();
    },

    downloadBatchZip: async (invoices: any[], date: string) => {
        const res = await fetch(`${API_URL}/finance/invoices/export/batch`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ invoices, date })
        });
        if (!res.ok) throw new Error("Error downloading ZIP");
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Facturas_${date}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }
};
