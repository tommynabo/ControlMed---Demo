import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useRef } from 'react';
import { Patient, Appointment, Invoice, InventoryItem, ClinicalRecord, Doctor, Liquidation, AIChatMessage, ToothState, DocumentTemplate, Expense, TreatmentPlan } from '../../types';
import { api } from '../services/api';
import { UserRole, canAccessPage, canAccessRoute, hasPermission } from '../config/roles';

// === TabGuard: Session Storage Keys ===
const SESSION_KEY = 'crm_session';
const HEARTBEAT_KEY = 'crm_heartbeat';
const HEARTBEAT_INTERVAL_MS = 30_000; // 30 seconds

// Helper: save session to sessionStorage
const persistSession = (user: any) => {
    try {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(user));
        sessionStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
        console.log('[TabGuard] ✅ Sesión persistida en sessionStorage');
    } catch (e) {
        console.warn('[TabGuard] Error al persistir sesión:', e);
    }
};

// Helper: restore session from sessionStorage
const restoreSession = (): any | null => {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        const user = JSON.parse(raw);
        if (user && user.role) {
            console.log('[TabGuard] ✅ Sesión restaurada desde sessionStorage:', user.name);
            return user;
        }
        return null;
    } catch (e) {
        console.warn('[TabGuard] Error al restaurar sesión:', e);
        return null;
    }
};

// Helper: clear session from sessionStorage
const clearSession = () => {
    try {
        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(HEARTBEAT_KEY);
        console.log('[TabGuard] 🔒 Sesión eliminada de sessionStorage');
    } catch (e) {
        console.warn('[TabGuard] Error al limpiar sesión:', e);
    }
};

// Define Context Shape
interface AppContextProps {
    // Auth
    currentUser: any;
    currentUserRole: UserRole;
    isAuthenticated: boolean;
    login: (user: any) => void;
    logout: () => void;

    // RBAC helpers
    canAccessPage: (pageId: string) => boolean;
    canAccessRoute: (path: string) => boolean;
    hasPermission: (permission: string) => boolean;

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
    doctors: Doctor[];
    setDoctors: React.Dispatch<React.SetStateAction<Doctor[]>>;

    // Actions
    refreshPatients: () => Promise<void>;
    refreshAppointments: () => Promise<void>;
    refreshInvoices: () => Promise<void>;
    refreshDoctors: () => Promise<void>;
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
    // === TabGuard: Restore session on initial mount ===
    const restoredUser = restoreSession();

    const [isAuthenticated, setIsAuthenticated] = useState(!!restoredUser);
    const [currentUser, setCurrentUser] = useState<any>(restoredUser);
    const [role, setRole] = useState<UserRole>(restoredUser?.role || 'ADMIN');

    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stock, setStock] = useState<InventoryItem[]>(INITIAL_STOCK);
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // === TabGuard: Heartbeat to protect against tab discard ===
    useEffect(() => {
        if (!isAuthenticated) return;

        // Initial heartbeat
        sessionStorage.setItem(HEARTBEAT_KEY, Date.now().toString());

        const heartbeatInterval = setInterval(() => {
            sessionStorage.setItem(HEARTBEAT_KEY, Date.now().toString());
        }, HEARTBEAT_INTERVAL_MS);

        console.log('[TabGuard] ✅ Protección anti-descarte activada');

        return () => {
            clearInterval(heartbeatInterval);
        };
    }, [isAuthenticated]);

    // Initial Data Load
    useEffect(() => {
        if (isAuthenticated) {
            const fetchData = async () => {
                try {
                    const [pts, appts, docs, invs] = await Promise.all([
                        api.getPatients().catch(err => { console.error("Failed to fetch patients", err); return []; }),
                        api.appointments.getAll().catch(err => { console.error("Failed to fetch appointments", err); return []; }),
                        api.getDoctors().catch(err => { console.error("Failed to fetch doctors", err); return []; }),
                        api.invoices.getAll().catch(err => { console.error("Failed to fetch invoices", err); return []; })
                    ]);
                    setPatients(pts);
                    setAppointments(appts);
                    setDoctors(docs);
                    setInvoices(invs);
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
        // === TabGuard: Persist session ===
        persistSession(user);
    };

    const logout = () => {
        setCurrentUser(null);
        setIsAuthenticated(false);
        // === TabGuard: Clear session ===
        clearSession();
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

    const refreshInvoices = async () => {
        try {
            const invs = await api.invoices.getAll();
            setInvoices(invs);
        } catch (e) {
            console.error("Error refreshing invoices", e);
        }
    };

    const addPatient = (p: Patient) => setPatients(prev => [p, ...prev]);
    const addAppointment = (a: Appointment) => setAppointments(prev => [...prev, a]);
    const addInvoice = (i: Invoice) => setInvoices(prev => [i, ...prev]);

    const refreshDoctors = async () => {
        try {
            const docs = await api.getDoctors();
            setDoctors(docs);
        } catch (e) {
            console.error("Error refreshing doctors", e);
        }
    };

    // RBAC helpers bound to current role
    const canAccessPageFn = (pageId: string) => canAccessPage(role, pageId);
    const canAccessRouteFn = (path: string) => canAccessRoute(role, path);
    const hasPermissionFn = (permission: string) => hasPermission(role, permission);

    return (
        <AppContext.Provider value={{
            currentUser, currentUserRole: role, isAuthenticated, login, logout,
            canAccessPage: canAccessPageFn, canAccessRoute: canAccessRouteFn, hasPermission: hasPermissionFn,
            patients, setPatients, appointments, setAppointments, invoices, setInvoices,
            stock, setStock, clinicalRecords, setClinicalRecords, expenses, setExpenses,
            doctors, setDoctors,
            refreshPatients, refreshAppointments, refreshInvoices, refreshDoctors, addPatient, addAppointment, addInvoice, api,
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

