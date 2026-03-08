import { Doctor, Specialization } from '../types';

export const DOCTORS: Doctor[] = [
  { id: 'dr-1', name: 'Dr. Martin', specialization: Specialization.GENERAL, commission: 0.4, availability: { 1: { morning: true, afternoon: true }, 2: { morning: true, afternoon: true }, 3: { morning: true, afternoon: true } } },
  { id: 'dr-2', name: 'Dra. Elena', specialization: Specialization.ORTHODONTICS, commission: 0.35, availability: { 2: { morning: true, afternoon: true } } },
  { id: 'dr-3', name: 'Dr. Fernando', specialization: Specialization.IMPLANTOLOGY, commission: 0.45, availability: { 3: { morning: true, afternoon: true } } },
  { id: 'dr-4', name: 'Dra. Ana', specialization: Specialization.ESTHETICS, commission: 0.4, availability: { 4: { morning: true, afternoon: true } } },
  { id: 'dr-5', name: 'Dr. Carlos', specialization: Specialization.PERIODONTICS, commission: 0.4, availability: { 5: { morning: true, afternoon: true } } }
];

export const DENTAL_SERVICES = [
  { id: 'srv-1', name: 'Limpieza Dental', price: 50, insurancePrice: { 'Sanitas': 0, 'Adeslas': 10 }, specialization: Specialization.GENERAL },
  { id: 'srv-2', name: 'Obturación Simple', price: 60, insurancePrice: { 'Sanitas': 40, 'Adeslas': 45 }, specialization: Specialization.GENERAL },
  { id: 'srv-3', name: 'Endodoncia Unirradicular', price: 120, insurancePrice: { 'Sanitas': 90, 'Adeslas': 100 }, specialization: Specialization.GENERAL }, // Technically ENDO but usually General can do? Or separate? Let's use General for simplicity or add ENDO if type exists
  { id: 'srv-4', name: 'Implantes Trauma', price: 900, specialization: Specialization.IMPLANTOLOGY },
  { id: 'srv-5', name: 'Ortodoncia Brackets (Mensual)', price: 100, specialization: Specialization.ORTHODONTICS },
  { id: 'srv-6', name: 'Invisalign Full', price: 3500, specialization: Specialization.ORTHODONTICS },
  { id: 'srv-7', name: 'Blanqueamiento Zoom', price: 300, specialization: Specialization.ESTHETICS },
  { id: 'srv-8', name: 'Corona Zirconio', price: 350, specialization: Specialization.ESTHETICS }, // Prosthodontics/Esthetics
  { id: 'srv-9', name: 'Extracción Simple', price: 40, specialization: Specialization.GENERAL },
  { id: 'srv-10', name: 'Curetaje por Cuadrante', price: 70, specialization: Specialization.PERIODONTICS }
];

// Bloques de tiempo para la agenda (cada 15 minutos)
// Rango amplio 08:00–21:00 para cubrir cualquier configuración de horario.
// Los slots fuera del horario de cada doctor se marcan como no disponibles en Agenda.tsx.
export const TIME_SLOTS = [
  "08:00", "08:15", "08:30", "08:45",
  "09:00", "09:15", "09:30", "09:45",
  "10:00", "10:15", "10:30", "10:45",
  "11:00", "11:15", "11:30", "11:45",
  "12:00", "12:15", "12:30", "12:45",
  "13:00", "13:15", "13:30", "13:45",
  "14:00", "14:15", "14:30", "14:45",
  "15:00", "15:15", "15:30", "15:45",
  "16:00", "16:15", "16:30", "16:45",
  "17:00", "17:15", "17:30", "17:45",
  "18:00", "18:15", "18:30", "18:45",
  "19:00", "19:15", "19:30", "19:45",
  "20:00", "20:15", "20:30", "20:45"
];

// Opciones de duración para las citas (en minutos)
export const DURATION_OPTIONS = [15, 30, 45, 60, 90, 120];
