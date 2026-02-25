
export enum Specialization {
  GENERAL = 'General',
  DENTIST = 'Odontología',
  ORTHODONTICS = 'Ortodoncia',
  IMPLANTOLOGY = 'Implantología',
  ESTHETICS = 'Estética',
  PERIODONTICS = 'Periodoncia'
}

export interface Patient {
  id: string;
  historyNumber?: string; // Auto-generated: HCL-0001, etc.
  name: string; // Se construye automáticamente: firstName + lastName1 + lastName2
  firstName?: string; // Nombre
  lastName1?: string; // Primer apellido
  lastName2?: string; // Segundo apellido
  dni: string;
  birthDate: string;
  email: string;
  phone?: string;
  address?: string;
  city?: string;
  zipCode?: string;
  country?: string;
  sex?: 'Masculino' | 'Femenino';
  profession?: string;
  referredBy?: string;
  hasChildren?: boolean;
  notes?: string;
  alerts?: string[];
  insurance?: string; // Mutua: 'Privado', 'Sanitas', 'Adeslas'
  assignedDoctorId?: string;
  prescriptions?: string[];
  wallet?: number; // Monedero Virtual - Pagos adelantados
  allergies?: string; // Alergias importantes
  smoker?: boolean; // Fumador
  diseases?: string | string[]; // Enfermedades (puede ser string JSON o array)
  medications?: string; // Medicación crónica o relevante
  criticalAlerts?: string | string[]; // Alertas médicas críticas (puede ser string JSON o array)
  medicalHistory?: string[]; // Historial médico (condiciones)
}


export interface Expense {
  id: string;
  description: string;
  amount: number;
  date: string;
  category: 'Comision' | 'Material' | 'General';
  receiver?: string;
  url?: string;
}

export interface ToothState {
  id: number;
  status: 'HEALTHY' | 'CARIES' | 'CROWN' | 'EXTRACTED' | 'FILLING' | 'ENDODONTICS' | 'IMPLANT' | 'BRIDGE';
  surfaces?: string[];
}

export interface ClinicalRecord {
  id: string;
  patientId: string;
  specialization: Specialization;
  date: string;
  clinicalData: {
    treatment: string;
    observation: string;
    odontogram?: ToothState[];
    signatureUrl?: string;
  };
  isEncrypted: boolean;
}

export interface Service {
  id: string;
  name: string;
  price: number;
  insurancePrice?: Record<string, number>; // Precios por mutua
}

// Tratamiento asignado a un paciente específico
export interface PatientTreatment {
  id: string;
  patientId: string;
  serviceId: string; // Referencia al catálogo de servicios
  serviceName: string; // Nombre del servicio
  toothId?: number; // Número del diente (ej: 21, 36)
  price: number; // Precio (puede ser custom)
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'PRESUPUESTADO';
  notes?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  patientId: string;
  date: string;
  items: { serviceId: string; name: string; price: number }[];
  status: 'pending' | 'accepted' | 'rejected';
  total: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  amount: number;
  tax: number;
  date: string;
  status: 'draft' | 'issued' | 'rectified';
  paymentMethod: 'cash' | 'card' | 'wallet' | 'transfer';
  chainHash?: string;
  qrUrl?: string;
  url?: string; // Direct PDF Link
  items: { serviceId: string; name: string; price: number }[];
  isRectificative?: boolean;
  rectifiesId?: string;
  concept?: string; // "Pago a Cuenta" | "Tratamiento: Endodoncia Diente 21"
  relatedPaymentId?: string;
}

export interface Payment {
  id: string;
  patientId: string;
  budgetId?: string;
  amount: number;
  method: 'cash' | 'card' | 'wallet' | 'transfer';
  type: 'DIRECT_CHARGE' | 'ADVANCE_PAYMENT';
  paymentBreakdown?: { method: string; amount: number }[];
  createdAt: string;
  invoiceId?: string;
  notes?: string;
}


export interface AIChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialization: Specialization;
  commission: number; // Ej: 0.40 para 40%
  availability: Record<number, { morning: boolean; afternoon: boolean }>;
}

export interface Appointment {
  id: string;
  doctorId: string;
  patientId: string;
  date: string;
  dayIdx?: number;
  time: string;
  duration?: number;
  observations?: string;
  visitDetails?: string; // Detalles de la visita (visible en agenda)
  status?: string;
  paid?: boolean;
  treatment?: string;
  treatmentId?: string;
  budgetId?: string;
  budgetItemId?: string;
  amount?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: 'Consumible' | 'Instrumental' | 'Maquinaria';
  quantity: number;
  minStock: number;
  unit: string;
}

export interface CashClosing {
  id: string;
  date: string;
  systemCash: number;
  systemCard: number;
  actualCash: number;
  actualCard: number;
  difference: number;
}

export type CalendarView = 'day' | 'week' | 'month';

// --- NEW MODULE TYPES ---

export interface Liquidation {
  id: string;
  doctorId: string;
  doctorName?: string;
  appointmentId: string;
  grossAmount: number;
  labCost: number;
  commissionRate: number;
  finalAmount: number;
  status: 'PENDING' | 'PAID';
  date: string;
}

export interface Installment {
  id: string;
  dueDate: string;
  amount: number;
  status: 'PENDING' | 'PAID' | 'OVERDUE';
  description: string;
}

export interface TreatmentPlan {
  id: string;
  name: string;
  totalCost: number;
  duration: number; // months
  startDate: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  installments: Installment[];
}

export interface DocumentTemplate {
  id: string;
  title: string;
  category: string;
  date: string;
  size: string;
  type: 'docx' | 'pdf';
}

// --- Clinical Treatment Plans ---
export interface ClinicalTreatmentStep {
  id: string;
  planId: string;
  stepOrder: number;
  treatmentName: string;
  toothId?: number;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO';
  notes?: string;
  completedAt?: string;
  createdAt: string;
}

export interface ClinicalTreatmentPlan {
  id: string;
  patientId: string;
  name: string;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  steps: ClinicalTreatmentStep[];
  createdAt: string;
  updatedAt: string;
}

// --- Agenda Closures ---
export interface AgendaClosure {
  id: string;
  date: string;
  doctorId?: string;
  reason?: string;
  createdBy?: string;
  createdAt: string;
}
