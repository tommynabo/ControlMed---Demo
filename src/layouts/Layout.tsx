import React, { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom';
import {
    Users, Activity, Calendar, Settings,
    PieChart, Brain, Package, LogOut, Search, Bell, Menu, ChevronRight,
    Stethoscope, DollarSign, UserCog, KeyRound, Clock, TrendingDown
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { ROLE_LABELS } from '../config/roles';
import ChangePasswordModal from '../components/ChangePasswordModal';
import EditDisplayNameModal from '../components/EditDisplayNameModal';

const Layout: React.FC = () => {
    const { currentUser, isAuthenticated, currentUserRole: role, logout, canAccessPage } = useAppContext();
    const location = useLocation();
    const navigate = useNavigate();
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [showChangePassword, setShowChangePassword] = useState(false);
    const [showEditName, setShowEditName] = useState(false);

    // === TabGuard: Route protection — redirect to login if session not found ===
    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: PieChart, path: '/dashboard' },
        { id: 'patients', label: 'Pacientes', icon: Users, path: '/pacientes' },
        { id: 'agenda', label: 'Agenda', icon: Calendar, path: '/agenda' },
        { id: 'caja', label: 'Caja', icon: DollarSign, path: '/caja' },
        { id: 'gastos', label: 'Gastos', icon: TrendingDown, path: '/gastos' },
        { id: 'billing', label: 'Facturación', icon: Activity, path: '/billing' },
        { id: 'stock', label: 'Stock', icon: Package, path: '/stock' },
        { id: 'ai', label: 'Asistente IA', icon: Brain, path: '/ai' },
        { id: 'payroll', label: 'Nóminas', icon: Users, path: '/payroll' },
        { id: 'users', label: 'Usuarios', icon: UserCog, path: '/users' },
        { id: 'attendance', label: 'Control de Jornada', icon: Clock, path: '/jornada' },
        { id: 'settings', label: 'Configuración', icon: Settings, path: '/settings' },
    ];

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <aside
                className={`${isSidebarOpen ? 'w-64' : 'w-20'} 
        bg-slate-900 text-slate-300 transition-all duration-300 ease-in-out relative z-20 flex flex-col border-r border-slate-800`}
            >
                {/* Logo Section - Always centered icon if collapsed */}
                <div className={`p-6 flex items-center ${isSidebarOpen ? 'justify-between' : 'justify-center'} h-20`}>
                    <div className="flex items-center gap-3 overflow-hidden">
                        <div className="w-8 h-8 bg-blue-600 rounded-xl flex-shrink-0 flex items-center justify-center text-white shadow-lg shadow-blue-900/50">
                            <Activity size={20} strokeWidth={3} />
                        </div>
                        {isSidebarOpen && (
                            <h1 className="text-lg font-black tracking-tighter text-white whitespace-nowrap animate-in fade-in duration-300">ControlMed</h1>
                        )}
                    </div>
                    {isSidebarOpen && (
                        <button onClick={() => setIsSidebarOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                            <Menu size={18} />
                        </button>
                    )}
                </div>

                {/* Collapse Toggle when closed - floating or part of header? User asked for logo on top.
                    If closed, we show logo centered. The toggle button can be at the bottom or separate.
                    Let's allow toggling back open via a button at the top if closed.
                 */}
                {!isSidebarOpen && (
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="absolute top-6 right-[-12px] w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center z-50 shadow-lg hover:scale-110 transition-transform"
                    >
                        <ChevronRight size={14} />
                    </button>
                )}


                <nav className="flex-1 px-4 space-y-2 mt-4 overflow-y-auto custom-scrollbar">
                    {navItems.map((item) => {
                        // RBAC: filter nav items by role
                        if (!canAccessPage(item.id)) return null;

                        return (
                            <NavLink
                                key={item.id}
                                to={item.path}
                                className={({ isActive }) => `
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative
                  ${isActive
                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20'
                                        : 'hover:bg-slate-800 hover:text-white'
                                    }
                  ${!isSidebarOpen && 'justify-center'}
                `}
                            >
                                <item.icon size={20} className={`transition-transform ${isSidebarOpen ? 'group-hover:scale-110' : ''}`} />
                                {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wide">{item.label}</span>}

                                {/* Tooltip for collapsed state */}
                                {!isSidebarOpen && (
                                    <div className="absolute left-full ml-4 bg-slate-900 text-white text-xs font-bold px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-xl">
                                        {item.label}
                                    </div>
                                )}
                            </NavLink>
                        );
                    })}
                </nav>

                <div className="p-4 border-t border-slate-800 space-y-1">
                    <button
                        onClick={() => setShowEditName(true)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-700 hover:text-white transition-all w-full ${!isSidebarOpen && 'justify-center'}`}
                    >
                        <span className="w-5 h-5 flex items-center justify-center text-base leading-none">👤</span>
                        {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wide">Mi Nombre</span>}
                    </button>
                    <button
                        onClick={() => setShowChangePassword(true)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-blue-500/10 hover:text-blue-400 transition-all w-full ${!isSidebarOpen && 'justify-center'}`}
                    >
                        <KeyRound size={20} />
                        {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wide">Cambiar Contraseña</span>}
                    </button>
                    <button
                        onClick={handleLogout}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-500 transition-all w-full ${!isSidebarOpen && 'justify-center'}`}
                    >
                        <LogOut size={20} />
                        {isSidebarOpen && <span className="text-xs font-bold uppercase tracking-wide">Cerrar Sesión</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden bg-slate-50 relative">
                {/* Top Header */}
                <header className="h-16 bg-white/50 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between px-8 z-10 sticky top-0">
                    <h2 className="text-base font-black text-slate-900 tracking-tight uppercase">
                        {navItems.find(n => n.path === location.pathname)?.label || 'Panel'}
                    </h2>

                    <div className="flex items-center gap-6">
                        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm">
                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs ring-2 ring-white shadow-lg">
                                {currentUser?.name?.[0] || 'U'}
                            </div>
                            <div className="text-right hidden sm:block">
                                <p className="text-xs font-bold text-slate-900">{currentUser?.name || 'Usuario'}</p>
                                <p className="text-[10px] text-slate-400 font-semibold">{ROLE_LABELS[role] || role}</p>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <main className="flex-1 overflow-auto p-8 relative scrollbar-hide">
                    <Outlet />
                </main>
            </div>

            {/* Change Password Modal */}
            <ChangePasswordModal isOpen={showChangePassword} onClose={() => setShowChangePassword(false)} />

            {/* Edit Display Name Modal */}
            <EditDisplayNameModal isOpen={showEditName} onClose={() => setShowEditName(false)} />
        </div>
    );
};

export default Layout;
