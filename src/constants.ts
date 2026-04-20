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
  { id: 'srv-10', name: 'Curetaje por Cuadrante', price: 70, specialization: Specialization.PERIODONTICS },
  { id: 'srv-11', name: 'Primera visita', price: 20, specialization: Specialization.GENERAL },
  { id: 'srv-12', name: 'OPG', price: 10, specialization: Specialization.GENERAL },
  { id: 'srv-13', name: 'Tartrectomía', price: 0, specialization: Specialization.GENERAL },
  { id: 'srv-14', name: 'Higiene', price: 30, specialization: Specialization.GENERAL },
  { id: 'pack-1a', name: 'Pack 1ª Visita: 1ª Consulta + OPG + Higiene', price: 60, specialization: Specialization.GENERAL, isPack: true, components: ['srv-11', 'srv-12', 'srv-14'] },
  { id: 'pack-1b', name: 'Pack 1ª Visita: 1ª Consulta + OPG', price: 45, specialization: Specialization.GENERAL, isPack: true, components: ['srv-11-alt', 'srv-12-alt'] },
  { id: 'pack-2', name: 'Pack: 1ª Visita + OPG + Tartrectomía', price: 60, specialization: Specialization.GENERAL, isPack: true }
];

// Bloques de tiempo para la agenda (cada 5 minutos para mayor precisión)
export const TIME_SLOTS = [
  "08:00", "08:05", "08:10", "08:15", "08:20", "08:25", "08:30", "08:35", "08:40", "08:45", "08:50", "08:55",
  "09:00", "09:05", "09:10", "09:15", "09:20", "09:25", "09:30", "09:35", "09:40", "09:45", "09:50", "09:55",
  "10:00", "10:05", "10:10", "10:15", "10:20", "10:25", "10:30", "10:35", "10:40", "10:45", "10:50", "10:55",
  "11:00", "11:05", "11:10", "11:15", "11:20", "11:25", "11:30", "11:35", "11:40", "11:45", "11:50", "11:55",
  "12:00", "12:05", "12:10", "12:15", "12:20", "12:25", "12:30", "12:35", "12:40", "12:45", "12:50", "12:55",
  "13:00", "13:05", "13:10", "13:15", "13:20", "13:25", "13:30", "13:35", "13:40", "13:45", "13:50", "13:55",
  "14:00", "14:05", "14:10", "14:15", "14:20", "14:25", "14:30", "14:35", "14:40", "14:45", "14:50", "14:55",
  "15:00", "15:05", "15:10", "15:15", "15:20", "15:25", "15:30", "15:35", "15:40", "15:45", "15:50", "15:55",
  "16:00", "16:05", "16:10", "16:15", "16:20", "16:25", "16:30", "16:35", "16:40", "16:45", "16:50", "16:55",
  "17:00", "17:05", "17:10", "17:15", "17:20", "17:25", "17:30", "17:35", "17:40", "17:45", "17:50", "17:55",
  "18:00", "18:05", "18:10", "18:15", "18:20", "18:25", "18:30", "18:35", "18:40", "18:45", "18:50", "18:55",
  "19:00", "19:05", "19:10", "19:15", "19:20", "19:25", "19:30", "19:35", "19:40", "19:45", "19:50", "19:55",
  "20:00", "20:05", "20:10", "20:15", "20:20", "20:25", "20:30", "20:35", "20:40", "20:45", "20:50", "20:55",
  "21:00", "21:05", "21:10", "21:15", "21:20", "21:25", "21:30", "21:35", "21:40", "21:45", "21:50", "21:55"
];

// Opciones de duración para las citas (en minutos)
export const DURATION_OPTIONS = [5, 10, 15, 30, 45, 60, 90, 120];
