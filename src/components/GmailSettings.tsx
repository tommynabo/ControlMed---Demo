import React, { useState, useEffect } from 'react';
import { Mail, CheckCircle2, RefreshCw, AlertCircle, LogOut } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';
import { useSearchParams } from 'react-router-dom';

const GmailSettings: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [status, setStatus] = useState<{ connected: boolean; email: string | null } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    const loadStatus = async () => {
        setIsLoading(true);
        try {
            const data = await api.gmail.getStatus();
            setStatus(data);
        } catch (e) {
            console.error('Error loading Gmail status:', e);
            toast.error('No se pudo verificar el estado de Gmail.');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle redirect back from Google OAuth
    useEffect(() => {
        const connected = searchParams.get('connected');
        const error = searchParams.get('error');

        if (connected === 'true') {
            toast.success('Gmail conectado correctamente.');
            setSearchParams({ tab: 'gmail' }, { replace: true });
        } else if (error) {
            const messages: Record<string, string> = {
                auth_failed: 'Error de autenticación con Google.',
                access_denied: 'Acceso denegado. Inténtalo de nuevo.',
                missing_code: 'Código de autorización no recibido.',
            };
            toast.error(messages[error] || 'Error al conectar Gmail.');
            setSearchParams({ tab: 'gmail' }, { replace: true });
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        loadStatus();
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        try {
            const { url } = await api.gmail.getAuthUrl();
            window.location.href = url;
        } catch (e) {
            console.error('Error getting auth URL:', e);
            toast.error('No se pudo generar el enlace de autorización.');
            setIsConnecting(false);
        }
    };

    const handleDisconnect = async () => {
        setIsDisconnecting(true);
        try {
            await api.gmail.disconnect();
            await loadStatus();
            toast.success('Gmail desconectado.');
        } catch (e) {
            console.error('Error disconnecting Gmail:', e);
            toast.error('Error al desconectar Gmail.');
        } finally {
            setIsDisconnecting(false);
        }
    };

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
            <div>
                <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Mail className="text-blue-500" size={32} />
                    Gmail Manager
                </h3>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">
                    Envío automático de facturas, recordatorios y consentimientos
                </p>
            </div>

            {/* Connection Card */}
            <div className="flex flex-col items-center justify-center bg-white p-12 rounded-2xl border border-slate-200 shadow-sm min-h-[400px]">
                {isLoading ? (
                    <div className="text-center">
                        <RefreshCw size={32} className="text-slate-400 mx-auto animate-spin" />
                        <p className="text-slate-500 mt-4 text-sm font-medium">Verificando conexión...</p>
                    </div>
                ) : status?.connected ? (
                    <div className="text-center animate-in zoom-in duration-300 space-y-6">
                        <CheckCircle2 size={56} className="text-green-500 mx-auto" />
                        <div>
                            <h4 className="text-2xl font-bold text-slate-900">Gmail Conectado</h4>
                            <p className="text-slate-500 mt-2">
                                Los correos se enviarán desde{' '}
                                <span className="font-bold text-slate-700">{status.email}</span>
                            </p>
                        </div>

                        {/* Automation status indicators */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2 text-left">
                            {[
                                { label: 'Facturas', desc: 'PDF adjunto al emitir' },
                                { label: 'Recordatorios de cita', desc: 'Email + WhatsApp' },
                                { label: 'Consentimientos', desc: 'Copia al firmar' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-start gap-3 bg-green-50 p-4 rounded-xl border border-green-100">
                                    <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{item.label}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-3 justify-center pt-2">
                            <button
                                onClick={loadStatus}
                                className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 text-slate-600 rounded-xl font-bold text-xs uppercase hover:bg-slate-200 transition-colors"
                            >
                                <RefreshCw size={14} />
                                Actualizar
                            </button>
                            <button
                                onClick={handleDisconnect}
                                disabled={isDisconnecting}
                                className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-xs uppercase hover:bg-red-100 transition-colors disabled:opacity-50"
                            >
                                {isDisconnecting
                                    ? <RefreshCw size={14} className="animate-spin" />
                                    : <LogOut size={14} />}
                                {isDisconnecting ? 'Desconectando...' : 'Desconectar'}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="text-center space-y-8">
                        <div>
                            <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Mail size={36} className="text-blue-400" />
                            </div>
                            <h4 className="text-2xl font-bold text-slate-900">Conectar Gmail de la Clínica</h4>
                            <p className="text-slate-500 max-w-md mx-auto mt-3 text-sm leading-relaxed">
                                Vincula la cuenta de Gmail de la clínica para enviar facturas, recordatorios
                                de citas y copias de consentimientos firmados automáticamente.
                            </p>
                        </div>

                        {/* Feature list */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
                            {[
                                { label: 'Facturas con PDF', desc: 'Al emitir un pago, el paciente recibe su factura adjunta.' },
                                { label: 'Recordatorios', desc: 'Email automático 12h antes de cada cita.' },
                                { label: 'Consentimientos', desc: 'Copia firmada al paciente en el momento de la firma.' },
                            ].map((item) => (
                                <div key={item.label} className="flex items-start gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <AlertCircle size={16} className="text-blue-400 mt-0.5 shrink-0" />
                                    <div>
                                        <p className="text-xs font-bold text-slate-800">{item.label}</p>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="flex items-center gap-2 px-10 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm uppercase tracking-widest transition-all hover:scale-105 disabled:opacity-60 disabled:scale-100 mx-auto"
                        >
                            {isConnecting
                                ? <RefreshCw size={18} className="animate-spin" />
                                : <Mail size={18} />}
                            {isConnecting ? 'Redirigiendo a Google...' : 'Iniciar sesión con Google'}
                        </button>

                        <p className="text-[10px] text-slate-400 max-w-xs mx-auto">
                            Solo se solicitará el permiso de <strong>envío de correos</strong>. No se leerán mensajes.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GmailSettings;
