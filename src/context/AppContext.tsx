import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
    updateDisplayName: (name: string) => Promise<void>;

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
    const queryClient = useQueryClient();

    // === TabGuard: Restore session ONCE on initial mount (useState lazy initializer) ===
    const [isAuthenticated, setIsAuthenticated] = useState(() => !!restoreSession());
    const [currentUser, setCurrentUser] = useState<any>(() => restoreSession());
    const [role, setRole] = useState<UserRole>(() => restoreSession()?.role || 'ADMIN');

    // Local state retained for backward-compat setters used by mutation callers
    const [patients, setPatients] = useState<Patient[]>([]);
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [invoices, setInvoices] = useState<Invoice[]>([]);
    const [stock, setStock] = useState<InventoryItem[]>(INITIAL_STOCK);
    const [clinicalRecords, setClinicalRecords] = useState<ClinicalRecord[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [doctors, setDoctors] = useState<Doctor[]>([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

    // === React Query: server-side caches (only fetched when authenticated) ===
    const { data: rqPatients } = useQuery({
        queryKey: ['patients'],
        queryFn: () => api.getPatients(),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 5,
    });
    const { data: rqAppointments } = useQuery({
        queryKey: ['appointments'],
        queryFn: () => api.appointments.getAll(),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 2,
    });
    const { data: rqDoctors } = useQuery({
        queryKey: ['doctors'],
        queryFn: () => api.getDoctors(),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 10,
    });
    const { data: rqInvoices } = useQuery({
        queryKey: ['invoices'],
        queryFn: () => api.invoices.getAll(),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 5,
    });
    const { data: rqExpenses } = useQuery({
        queryKey: ['expenses'],
        queryFn: () => api.expenses.getAll(),
        enabled: isAuthenticated,
        staleTime: 1000 * 60 * 5,
    });

    // Sync React Query data into context state so existing consumers keep working
    useEffect(() => { if (rqPatients) setPatients(rqPatients); }, [rqPatients]);
    useEffect(() => { if (rqAppointments) setAppointments(rqAppointments); }, [rqAppointments]);
    useEffect(() => { if (rqDoctors) setDoctors(rqDoctors); }, [rqDoctors]);
    useEffect(() => { if (rqInvoices) setInvoices(rqInvoices); }, [rqInvoices]);
    useEffect(() => { if (rqExpenses) setExpenses(rqExpenses); }, [rqExpenses]);

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
        // Invalidate all cached data on logout
        queryClient.clear();
        // === TabGuard: Clear session ===
        clearSession();
    };

    const updateDisplayName = async (name: string) => {
        if (!currentUser?.id) throw new Error('No hay sesión activa');
        const updated = await api.updateDisplayName(currentUser.id, name);
        const newUser = { ...currentUser, name: updated.name };
        setCurrentUser(newUser);
        persistSession(newUser);
    };

    // React Query-backed refresh: invalidates cache → triggers automatic re-fetch
    const refreshPatients = async () => {
        await queryClient.invalidateQueries({ queryKey: ['patients'] });
    };
    const refreshAppointments = async () => {
        await queryClient.invalidateQueries({ queryKey: ['appointments'] });
        await queryClient.invalidateQueries({ queryKey: ['calendar'] });
    };
    const refreshInvoices = async () => {
        await queryClient.invalidateQueries({ queryKey: ['invoices'] });
    };
    const refreshDoctors = async () => {
        await queryClient.invalidateQueries({ queryKey: ['doctors'] });
    };

    const addPatient = (p: Patient) => setPatients(prev => [p, ...prev]);
    const addAppointment = (a: Appointment) => setAppointments(prev => [...prev, a]);
    const addInvoice = (i: Invoice) => setInvoices(prev => [i, ...prev]);

    // RBAC helpers bound to current role
    const canAccessPageFn = (pageId: string) => canAccessPage(role, pageId);
    const canAccessRouteFn = (path: string) => canAccessRoute(role, path);
    const hasPermissionFn = (permission: string) => hasPermission(role, permission);

    return (
        <AppContext.Provider value={{
            currentUser, currentUserRole: role, isAuthenticated, login, logout, updateDisplayName,
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

