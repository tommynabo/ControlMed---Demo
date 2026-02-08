import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { Patient, Appointment, Invoice, InventoryItem, ClinicalRecord, Doctor, Liquidation, AIChatMessage, ToothState, DocumentTemplate, Expense, TreatmentPlan } from '../../types';
import { api } from '../services/api';

// Define Context Shape
interface AppContextProps {
    // Auth
    currentUser: any;
    currentUserRole: 'ADMIN' | 'RECEPTION' | 'DOCTOR';
    isAuthenticated: boolean;
    login: (user: any) => void;
    logout: () => void;

    // Data
    patients: Patient[];
    setPatients: React.Dispatch<React.SetStateAction<Patient[]>>;
    appointments: Appointment[];
    setAppointments: React.Dispatch<React.SetStateAction<Appointment[]>>;
    invoices: Invoice[];
    setInvoices: React.Dispatch<React.SetStateAction<Invoice[]>>;
    stock: InventoryItem[];
    setStock: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
    clinicalRecords: ClinicalRecord[];
    setClinicalRecords: React.Dispatch<React.SetStateAction<ClinicalRecord[]>>;
    expenses: Expense[];
    setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;

    // Actions
    refreshPatients: () => Promise<void>;
    refreshAppointments: () => Promise<void>;
    addPatient: (p: Patient) => void;
    addAppointment: (a: Appointment) => void;
    addInvoice: (i: Invoice) => void;
    api: typeof api;

    // Search State
    searchQuery: string;
    setSearchQuery: (s: string) => void;

    // Selection State
    selectedPatient: Patient | null;
    setSelectedPatient: (p: Patient | null) => void;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

// Moved Constants (Temporary until full refactor)
export const INITIAL_STOCK: InventoryItem[] = [
    { id: 'i1', name: 'Guantes de Látex (M)', category: 'Consumible', quantity: 15, minStock: 10, unit: 'Cajas' },
    { id: 'i2', name: 'Implante Titanio 4mm', category: 'Instrumental', quantity: 5, minStock: 2, unit: 'Unidades' }
];

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [role, setRole] = useState<'ADMIN' | 'RECEPTION' | 'DOCTOR'>('ADMIN');

    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stock, setStock] = useState<InventoryItem[]>(INITIAL_STOCK);
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // Initial Data Load
    useEffect(() => {
        if (isAuthenticated) {
            const fetchData = async () => {
                try {
                    const [pts, appts] = await Promise.all([
                        api.getPatients().catch(err => { console.error("Failed to fetch patients", err); return []; }),
                        api.appointments.getAll().catch(err => { console.error("Failed to fetch appointments", err); return []; })
                    ]);
                    setPatients(pts);
                    setAppointments(appts);
                    // Stock and others can be added here
                } catch (e) {
                    console.error("Error loading initial data", e);
                }
            };
            fetchData();
        }
    }, [isAuthenticated]);

    const login = (user: any) => {
        setCurrentUser(user);
        setRole(user.role);
        setIsAuthenticated(true);
    };

    const logout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
    };

    const refreshPatients = async () => {
        try {
            const pts = await api.getPatients();
            setPatients(pts);
        } catch (e) {
            console.error("Error refreshing patients", e);
        }
    };

    const refreshAppointments = async () => {
        try {
            const appts = await api.appointments.getAll();
            setAppointments(appts);
        } catch (e) {
            console.error("Error refreshing appointments", e);
        }
    };

    const addPatient = (p: Patient) => setPatients(prev => [p, ...prev]);
    const addAppointment = (a: Appointment) => setAppointments(prev => [...prev, a]);
    const addInvoice = (i: Invoice) => setInvoices(prev => [i, ...prev]);

    return (
        <AppContext.Provider value={{
            currentUser, currentUserRole: role, isAuthenticated, login, logout,
            patients, setPatients, appointments, setAppointments, invoices, setInvoices,
            stock, setStock, clinicalRecords, setClinicalRecords, expenses, setExpenses,
            refreshPatients, refreshAppointments, addPatient, addAppointment, addInvoice, api,
            searchQuery, setSearchQuery, selectedPatient, setSelectedPatient
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useAppContext = () => {
    const context = useContext(AppContext);
    if (!context) throw new Error("useAppContext must be used within AppProvider");
    return context;
};
