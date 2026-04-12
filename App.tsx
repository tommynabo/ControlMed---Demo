import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AppProvider } from './src/context/AppContext';
import Layout from './src/layouts/Layout';
import { ErrorBoundary } from './src/components/ErrorBoundary';

// Eagerly loaded
import Login from './src/pages/Login';
import Dashboard from './src/pages/Dashboard';
import ProtectedRoute from './src/components/ProtectedRoute';

// Lazily loaded
const Agenda = lazy(() => import('./src/pages/Agenda'));
const Patients = lazy(() => import('./src/pages/Patients'));
const Billing = lazy(() => import('./src/pages/Billing'));
const Stock = lazy(() => import('./src/pages/Stock'));
const AI = lazy(() => import('./src/pages/AI'));
const Payroll = lazy(() => import('./src/pages/Payroll'));
const CashRegister = lazy(() => import('./src/pages/CashRegister'));
const Settings = lazy(() => import('./src/pages/Settings'));
const Attendance = lazy(() => import('./src/pages/Attendance'));
const UserManagement = lazy(() => import('./src/pages/UserManagement'));
const Gastos = lazy(() => import('./src/pages/Gastos'));
const Liquidations = lazy(() => import('./src/pages/Liquidations').then(m => ({ default: m.Liquidations })));
const AppointmentDetails = lazy(() => import('./src/pages/AppointmentDetails').then(m => ({ default: m.AppointmentDetails })));

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,     // 5 min before data is considered stale
      gcTime: 1000 * 60 * 30,        // 30 min cache retention
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
    <AppProvider>
      <Toaster position="top-right" reverseOrder={false} />
      <BrowserRouter>
        <ErrorBoundary>
          <Suspense fallback={
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            </div>
          }>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<ProtectedRoute pageId="dashboard"><Dashboard /></ProtectedRoute>} />
                <Route path="agenda" element={<ProtectedRoute pageId="agenda"><Agenda /></ProtectedRoute>} />
                <Route path="appointment/:appointmentId" element={<ProtectedRoute pageId="agenda"><AppointmentDetails /></ProtectedRoute>} />
                <Route path="pacientes" element={<ProtectedRoute pageId="patients"><Patients /></ProtectedRoute>} />
                <Route path="caja" element={<ProtectedRoute pageId="caja"><CashRegister /></ProtectedRoute>} />
                <Route path="billing" element={<ProtectedRoute pageId="billing"><Billing /></ProtectedRoute>} />
                <Route path="stock" element={<ProtectedRoute pageId="stock"><Stock /></ProtectedRoute>} />
                <Route path="ai" element={<ProtectedRoute pageId="ai"><AI /></ProtectedRoute>} />
                <Route path="payroll" element={<ProtectedRoute pageId="payroll"><Payroll /></ProtectedRoute>} />
                <Route path="settings" element={<ProtectedRoute pageId="settings"><Settings /></ProtectedRoute>} />
                <Route path="users" element={<ProtectedRoute pageId="users"><UserManagement /></ProtectedRoute>} />
                <Route path="jornada" element={<ProtectedRoute pageId="attendance"><Attendance /></ProtectedRoute>} />
                <Route path="gastos" element={<ProtectedRoute pageId="gastos"><Gastos /></ProtectedRoute>} />
                <Route path="liquidaciones" element={<ProtectedRoute pageId="liquidaciones"><Liquidations /></ProtectedRoute>} />
              </Route>
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </BrowserRouter>
    </AppProvider>
    </QueryClientProvider>
  );
};

export default App;
