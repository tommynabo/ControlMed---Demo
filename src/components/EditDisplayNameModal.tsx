import React, { useState, useEffect, useRef } from 'react';
import { User, X, Check, AlertCircle } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

interface EditDisplayNameModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const EditDisplayNameModal: React.FC<EditDisplayNameModalProps> = ({ isOpen, onClose }) => {
    const { currentUser, updateDisplayName } = useAppContext();
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const [loading, setLoading] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Sync input with current name whenever modal opens
    useEffect(() => {
        if (isOpen) {
            setName(currentUser?.name || '');
            setError('');
            setSuccess(false);
            setTimeout(() => inputRef.current?.focus(), 50);
        }
    }, [isOpen, currentUser?.name]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const trimmed = name.trim();
        if (!trimmed) {
            setError('El nombre no puede estar vacío');
            return;
        }
        if (trimmed === currentUser?.name) {
            onClose();
            return;
        }
        if (trimmed.length > 100) {
            setError('El nombre no puede superar los 100 caracteres');
            return;
        }

        setLoading(true);
        try {
            await updateDisplayName(trimmed);
            setSuccess(true);
            setTimeout(() => {
                setSuccess(false);
                onClose();
            }, 1500);
        } catch (err: any) {
            setError(err.message || 'Error al actualizar el nombre');
            setName(currentUser?.name || '');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <User size={20} />
                        <h2 className="font-bold text-lg">Editar nombre visible</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-white transition-colors"
                        aria-label="Cerrar"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {success && (
                        <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium border border-green-200 flex items-center gap-2">
                            <Check size={16} /> Nombre actualizado correctamente
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-100 flex items-start gap-2">
                            <AlertCircle size={16} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-600 uppercase tracking-wide mb-2">
                            Nombre visible
                        </label>
                        <input
                            ref={inputRef}
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            onKeyDown={handleKeyDown}
                            maxLength={100}
                            placeholder="Tu nombre visible"
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                            disabled={loading || success}
                        />
                        <p className="mt-1.5 text-[11px] text-slate-400">
                            Este nombre aparecerá en la barra superior y en el menú lateral.
                        </p>
                    </div>

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || success}
                            className="flex-1 px-4 py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <Check size={16} />
                            )}
                            {loading ? 'Guardando...' : 'Guardar cambios'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditDisplayNameModal;
