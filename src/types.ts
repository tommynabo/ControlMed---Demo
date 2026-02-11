export interface Patient {
    id: string;
    historyNumber?: string; // Auto-generated: HCL-0001, etc.
    name: string;
    firstName?: string; // New
    lastName1?: string; // New
    lastName2?: string; // New
    dni: string;
    email: string;
    phone?: string;
    birthDate?: string;
    insurance?: string;
    assignedDoctorId?: string;
    clinicalHistory?: ClinicalRecord[];
    prescriptions?: string[];

    // Medical Info
    smoker?: boolean; // New
    allergies?: string;
    medications?: string;
    medicalHistory?: string[];
}

export interface ClinicalRecord {
    id: string;
    patientId: string;
    date: string;
    specialization: string;
    clinicalData: {
        treatment: string;
        observation: string;
    };
    authorId?: string;
}

export interface Appointment {
    id: string;
    patientId: string;
    doctorId: string;
    date: string; // ISO string
    time: string;
    duration?: number; // Minutes
    treatment: string;
    budgetId?: string;
    status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'PRESUPUESTADO' | 'Scheduled';
}

export interface Invoice {
    id: string;
    patientId: string;
    invoiceNumber: string;
    amount: number;
    date: string;
    status: 'issued' | 'pending' | 'paid';
    url?: string;
    items?: InvoiceItem[];
}

export interface InvoiceItem {
    name: string;
    price: number;
    serviceId?: string;
}

export interface InventoryItem {
    id: string;
    name: string;
    category: string;
    quantity: number;
    minStock: number;
    unit: string;
}

export interface Doctor {
    id: string;
    name: string;
    specialization: string;
    commissionPercentage?: number;
}

export interface Liquidation {
    id: string;
    doctorId: string;
    month: string;
    totalAmount: number;
    details?: any;
}

export interface AIChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface ToothState {
    [key: number]: {
        status: 'healthy' | 'caries' | 'filled' | 'missing' | 'crown' | 'endo';
        notes?: string;
    };
}

export interface DocumentTemplate {
    id: string;
    name: string;
    content: string;
}

export interface Expense {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
}

export interface TreatmentPlan {
    id: string;
    patientId: string;
    items: {
        treatment: string;
        price: number;
        tooth?: number;
    }[];
    total: number;
    status: 'DRAFT' | 'ACCEPTED';
}

export type Specialization = 'General' | 'Odontología' | 'Ortodoncia' | 'Implantología';

export interface PatientTreatment {
    id: string;
    patientId: string;
    serviceId?: string;
    serviceName: string;
    toothId?: number;
    price: number;
    customPrice?: number;
    status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'PRESUPUESTADO';
    notes?: string;
    createdAt: string;
}

export interface Payment {
    id: string;
    patientId: string;
    amount: number;
    method: 'card' | 'cash' | 'transfer' | 'other';
    type: 'INVOICE' | 'ADVANCE_PAYMENT' | 'PAGO_A_CUENTA' | 'OTHER';
    invoiceId?: string;
    createdAt: string;
    notes?: string;
}
