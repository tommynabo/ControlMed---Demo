import React, { useState, useEffect, useMemo } from 'react';
import { 
    Clock, 
    Play, 
    Square, 
    History, 
    Calendar as CalendarIcon,
    User,
    ArrowRight,
    ArrowLeft,
    Plus,
    Info
} from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import ManualClockInModal from '../components/ManualClockInModal';

interface WorkShift {
    id: string;
    userId: string;
    clockIn: string;
    clockOut: string | null;
    date: string;
    breakMinutes?: number;
    notes?: string;
    isManual?: boolean;
    user?: { name: string };
}

const Attendance: React.FC = () => {
    const { currentUser, currentUserRole } = useAppContext();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [history, setHistory] = useState<WorkShift[]>([]);
    const [activeShift, setActiveShift] = useState<WorkShift | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);

    // Update digital clock every second
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchHistory = async () => {
        if (!currentUser?.id) return;
        try {
            const { api } = await import('../services/api');
            const data = await api.attendance.getHistory(currentUser.id, currentUserRole);
            
            if (Array.isArray(data)) {
                setHistory(data);
                // Find active shift (clockOut is null)
                const open = data.find((s: WorkShift) => s.userId === currentUser.id && !s.clockOut);
                setActiveShift(open || null);
            } else {
                console.error('Invalid history data format:', data);
                setHistory([]);
            }
        } catch (error) {
            console.error('Error fetching attendance history:', error);
            setHistory([]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchHistory();
        }
    }, [currentUser]);

    const handleClockIn = async () => {
        if (!currentUser?.id) return;
        try {
            const { api } = await import('../services/api');
            await api.attendance.clockIn(currentUser.id, currentUserRole);
            await fetchHistory();
        } catch (error: any) {
            alert(error.message || 'Error al iniciar jornada');
        }
    };

    const handleClockOut = async () => {
        if (!currentUser?.id) return;
        try {
            const { api } = await import('../services/api');
            await api.attendance.clockOut(currentUser.id, currentUserRole);
            await fetchHistory();
        } catch (error: any) {
            alert(error.message || 'Error al finalizar jornada');
        }
    };

    const calculateDuration = (start: string, end: string | null, breakMins: number = 0) => {
        if (!end) return '-';
        const startTime = new Date(start).getTime();
        const endTime = new Date(end).getTime();
        const diffMs = (endTime - startTime) - (breakMins * 60 * 1000);
        
        if (diffMs < 0) return '0h 0m';

        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        return `${diffHrs}h ${diffMins}m`;
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header with Digital Clock */}
            <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="text-center md:text-left">
                    <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 justify-center md:justify-start">
                        <Clock className="text-blue-600" size={32} />
                        Control de Jornada
                    </h2>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-2 px-1">
                        Sesión de {currentUser?.name || 'Usuario'}
                    </p>
                </div>

                <div className="flex flex-col items-center md:items-end">
                    <div className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">
                        {currentTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mt-1">
                        {currentTime.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                </div>
            </div>

            {/* Principal Action Buttons */}
            <div className="flex flex-col items-center gap-6 py-6">
                <div className="flex justify-center">
                    {!activeShift ? (
                        <button
                            onClick={handleClockIn}
                            className="group relative flex flex-col items-center gap-4 transition-all hover:scale-105"
                        >
                            <div className="w-32 h-32 bg-emerald-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-emerald-500/20 group-hover:shadow-emerald-500/40 transition-all border-8 border-emerald-100 flex-shrink-0">
                                <Play size={40} fill="currentColor" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-emerald-600">Empezar Jornada</span>
                        </button>
                    ) : (
                        <button
                            onClick={handleClockOut}
                            className="group relative flex flex-col items-center gap-4 transition-all hover:scale-105"
                        >
                            <div className="w-32 h-32 bg-rose-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-rose-500/20 group-hover:shadow-rose-500/40 transition-all border-8 border-rose-100 flex-shrink-0">
                                <Square size={40} fill="currentColor" />
                            </div>
                            <span className="text-sm font-black uppercase tracking-widest text-rose-600">Finalizar Jornada</span>
                        </button>
                    )}
                </div>

                <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-3 border-2 border-slate-200 rounded-2xl text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-50 hover:border-slate-300 transition-all"
                >
                    <Plus size={16} strokeWidth={3} />
                    Fichaje Manual
                </button>
            </div>

            {/* History Table */}
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-50 flex items-center justify-between bg-slate-50/50">
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                        <History size={16} className="text-slate-400" />
                        Historial de Registros
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 text-[10px] font-black uppercase tracking-widest text-slate-400">
                                <th className="px-8 py-4">Día</th>
                                {currentUserRole === 'ADMIN' && <th className="px-8 py-4">Empleado</th>}
                                <th className="px-8 py-4">Entrada</th>
                                <th className="px-8 py-4">Salida</th>
                                <th className="px-8 py-4 text-right">Total</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold animate-pulse">
                                        Cargando historial...
                                    </td>
                                </tr>
                            ) : history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-12 text-center text-slate-400 font-bold">
                                        No hay registros de jornada todavía.
                                    </td>
                                </tr>
                            ) : (
                                history.map((shift) => (
                                    <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors group">
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                    <CalendarIcon size={14} />
                                                </div>
                                                <span className="text-xs font-bold text-slate-900 uppercase">
                                                    {new Date(shift.date).toLocaleDateString('es-ES', {
                                                        day: '2-digit',
                                                        month: 'short'
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                        {currentUserRole === 'ADMIN' && (
                                            <td className="px-8 py-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-500">
                                                        {shift.user?.name?.[0] || 'U'}
                                                    </div>
                                                    <span className="text-xs font-bold text-slate-600">{shift.user?.name || 'Usuario'}</span>
                                                </div>
                                            </td>
                                        )}
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-2 text-emerald-600">
                                                <ArrowRight size={14} />
                                                <span className="text-xs font-black tabular-nums">
                                                    {new Date(shift.clockIn).toLocaleTimeString('es-ES', {
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    })}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            {shift.clockOut ? (
                                                <div className="flex items-center gap-2 text-rose-600">
                                                    <ArrowLeft size={14} />
                                                    <span className="text-xs font-black tabular-nums">
                                                        {new Date(shift.clockOut).toLocaleTimeString('es-ES', {
                                                            hour: '2-digit',
                                                            minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-[10px] font-black text-rose-500 bg-rose-50 px-2 py-1 rounded-full uppercase">En curso</span>
                                            )}
                                        </td>
                                        <td className="px-8 py-4 text-right">
                                            <div className="flex flex-col items-end gap-1">
                                                <span className="text-xs font-black text-slate-900 tabular-nums">
                                                    {calculateDuration(shift.clockIn, shift.clockOut, shift.breakMinutes)}
                                                </span>
                                                {shift.isManual && (
                                                    <span className="text-[8px] font-black bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded uppercase tracking-tighter">Manual</span>
                                                )}
                                                {shift.breakMinutes ? (
                                                    <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400">
                                                        <Info size={8} />  -{shift.breakMinutes}m desc.
                                                    </div>
                                                ) : null}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <ManualClockInModal 
                isOpen={isManualModalOpen} 
                onClose={() => setIsManualModalOpen(false)}
                onSuccess={() => {
                    fetchHistory();
                    // Optional: Show toast or feedback
                }}
            />
        </div>
    );
};

export default Attendance;
