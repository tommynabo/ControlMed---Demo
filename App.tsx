import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './src/context/AppContext';
import Layout from './src/layouts/Layout';
import Dashboard from './src/pages/Dashboard';
import Agenda from './src/pages/Agenda';
import Patients from './src/pages/Patients';
import Billing from './src/pages/Billing';
import Stock from './src/pages/Stock';
import AI from './src/pages/AI';
import Payroll from './src/pages/Payroll';
import CashRegister from './src/pages/CashRegister';
import Settings from './src/pages/Settings';
import Login from './src/pages/Login';
import UserManagement from './src/pages/UserManagement';
import ProtectedRoute from './src/components/ProtectedRoute';

import { AppointmentDetails } from './src/pages/AppointmentDetails';

const App: React.FC = () => {
  return (
    <AppProvider>
      <BrowserRouter>
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
          </Route>
          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
};

export default App;
