import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAppContext } from '../context/AppContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    pageId: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, pageId }) => {
    const { isAuthenticated, canAccessPage } = useAppContext();

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    if (!canAccessPage(pageId)) {
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

export default ProtectedRoute;
