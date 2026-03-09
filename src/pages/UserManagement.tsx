import React, { useState, useEffect } from 'react';
import { UserCog, Plus, Edit2, Trash2, Save, X, Shield, Mail, Eye, EyeOff } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import { UserRole, ROLE_LABELS, ROLE_ALLOWED_PAGES } from '../config/roles';

interface SystemUser {
    id: string;
    email: string;
    gmail?: string;
    name: string;
    password?: string;
    role: UserRole;
    doctorId?: string;
    createdAt?: string;
}

const EMPTY_USER: Omit<SystemUser, 'id'> = {
    email: '',
    gmail: '',
    name: '',
    password: '',
    role: 'DOCTOR',
    doctorId: '',
};

const UserManagement: React.FC = () => {
    const { api, doctors, currentUserRole } = useAppContext();
    const [users, setUsers] = useState<SystemUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingUser, setEditingUser] = useState<SystemUser | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [formData, setFormData] = useState<Omit<SystemUser, 'id'>>(EMPTY_USER);
    const [showPassword, setShowPassword] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Only ADMIN can access this page
    if (currentUserRole !== 'ADMIN') {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center">
                    <Shield size={48} className="mx-auto text-red-400 mb-4" />
                    <h2 className="text-xl font-bold text-slate-800">Acceso Denegado</h2>
                    <p className="text-slate-500 mt-2">Solo el administrador puede gestionar usuarios.</p>
                </div>
            </div>
        );
    }

    useEffect(() => {
        loadUsers();
    }, []);

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${getApiUrl()}/auth/users`);
            if (!res.ok) throw new Error('Error cargando usuarios');
            const data = await res.json();
            setUsers(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setIsCreating(true);
        setEditingUser(null);
        setFormData({ ...EMPTY_USER });
        setShowPassword(false);
        setError('');
    };

    const handleEdit = (user: SystemUser) => {
        setEditingUser(user);
        setIsCreating(false);
        setFormData({
            email: user.email,
            gmail: user.gmail || '',
            name: user.name,
            password: '',
            role: user.role,
            doctorId: user.doctorId || '',
        });
        setShowPassword(false);
        setError('');
    };

    const handleCancel = () => {
        setEditingUser(null);
        setIsCreating(false);
        setFormData({ ...EMPTY_USER });
        setError('');
    };

    const handleSave = async () => {
        if (!formData.email || !formData.name || !formData.role) {
            setError('Email, nombre y rol son obligatorios');
            return;
        }
        if (isCreating && !formData.password) {
            setError('La contraseña es obligatoria para nuevos usuarios');
            return;
        }

        setSaving(true);
        setError('');
        try {
            const payload: any = {
                email: formData.email,
                gmail: formData.gmail || null,
                name: formData.name,
                role: formData.role,
                doctorId: formData.doctorId || null,
            };
            if (formData.password) {
                payload.password = formData.password;
            }

            let res;
            if (isCreating) {
                res = await fetch(`${getApiUrl()}/auth/users`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            } else if (editingUser) {
                res = await fetch(`${getApiUrl()}/auth/users/${editingUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                });
            }

            if (!res?.ok) {
                const errData = await res?.json();
                throw new Error(errData?.error || 'Error al guardar');
            }

            setSuccess(isCreating ? 'Usuario creado correctamente' : 'Usuario actualizado correctamente');
            setTimeout(() => setSuccess(''), 3000);
            handleCancel();
            loadUsers();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (user: SystemUser) => {
        if (!window.confirm(`¿Eliminar al usuario "${user.name}"? Esta acción no se puede deshacer.`)) return;

        try {
            const res = await fetch(`${getApiUrl()}/auth/users/${user.id}`, { method: 'DELETE' });
            if (!res.ok) throw new Error('Error al eliminar');
            setSuccess('Usuario eliminado');
            setTimeout(() => setSuccess(''), 3000);
            loadUsers();
        } catch (err: any) {
            setError(err.message);
        }
    };

    const getRoleBadgeColor = (role: UserRole) => {
        switch (role) {
            case 'ADMIN': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'RECEPTION': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'AUXILIAR': return 'bg-green-100 text-green-700 border-green-200';
            case 'DOCTOR': return 'bg-amber-100 text-amber-700 border-amber-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                        <UserCog size={28} /> Gestión de Usuarios
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">
                        Administra los usuarios del sistema, sus roles y permisos
                    </p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors shadow-lg shadow-blue-600/20"
                >
                    <Plus size={18} /> Nuevo Usuario
                </button>
            </div>

            {/* Messages */}
            {success && (
                <div className="bg-green-50 text-green-700 px-4 py-3 rounded-xl text-sm font-medium border border-green-200">
                    ✓ {success}
                </div>
            )}

            {/* Role Legend */}
            <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <h3 className="text-sm font-bold text-slate-700 mb-3">Permisos por Rol</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map(role => (
                        <div key={role} className={`p-3 rounded-xl border ${getRoleBadgeColor(role)}`}>
                            <p className="font-bold text-sm">{ROLE_LABELS[role]}</p>
                            <ul className="text-xs mt-1 space-y-0.5 opacity-80">
                                {role === 'ADMIN' && <li>• Acceso total al CRM</li>}
                                {role === 'RECEPTION' && (
                                    <>
                                        <li>• Cuentas, facturación, agendas</li>
                                        <li>• Stock, caja, pacientes</li>
                                    </>
                                )}
                                {role === 'AUXILIAR' && (
                                    <>
                                        <li>• Agendas (ver y editar)</li>
                                        <li>• Historias clínicas</li>
                                    </>
                                )}
                                {role === 'DOCTOR' && (
                                    <>
                                        <li>• Agendas (ver y editar)</li>
                                        <li>• Historias clínicas (solo ver)</li>
                                    </>
                                )}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* Create/Edit Form */}
            {(isCreating || editingUser) && (
                <div className="bg-white rounded-2xl p-6 border border-blue-200 shadow-lg">
                    <h3 className="text-lg font-bold text-slate-900 mb-4">
                        {isCreating ? '➕ Crear Nuevo Usuario' : `✏️ Editar: ${editingUser?.name}`}
                    </h3>

                    {error && (
                        <div className="mb-4 bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm font-medium border border-red-200">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nombre Completo *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                placeholder="Dr. Juan García"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email (Login) *</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData(p => ({ ...p, email: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                placeholder="usuario@clinica.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                <Mail size={12} className="inline mr-1" />
                                Gmail Asociado
                            </label>
                            <input
                                type="email"
                                value={formData.gmail || ''}
                                onChange={e => setFormData(p => ({ ...p, gmail: e.target.value }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                placeholder="usuario@gmail.com"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                                Contraseña {isCreating ? '*' : '(dejar vacío para no cambiar)'}
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={formData.password || ''}
                                    onChange={e => setFormData(p => ({ ...p, password: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
                                    placeholder="••••••••"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Rol *</label>
                            <select
                                value={formData.role}
                                onChange={e => setFormData(p => ({ ...p, role: e.target.value as UserRole }))}
                                className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-white"
                            >
                                {(Object.keys(ROLE_LABELS) as UserRole[]).map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                                ))}
                            </select>
                        </div>

                        {formData.role === 'DOCTOR' && (
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Doctor Asociado</label>
                                <select
                                    value={formData.doctorId || ''}
                                    onChange={e => setFormData(p => ({ ...p, doctorId: e.target.value }))}
                                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none bg-white"
                                >
                                    <option value="">— Sin asociar —</option>
                                    {doctors.map(d => (
                                        <option key={d.id} value={d.id}>{d.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-3 mt-5">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            <Save size={16} /> {saving ? 'Guardando...' : 'Guardar'}
                        </button>
                        <button
                            onClick={handleCancel}
                            className="flex items-center gap-2 bg-slate-100 text-slate-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-slate-200 transition-colors"
                        >
                            <X size={16} /> Cancelar
                        </button>
                    </div>
                </div>
            )}

            {/* Users Table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center text-slate-400">
                        <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-3"></div>
                        Cargando usuarios...
                    </div>
                ) : users.length === 0 ? (
                    <div className="p-8 text-center text-slate-400">
                        <UserCog size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No hay usuarios registrados</p>
                        <p className="text-sm">Crea el primer usuario con el botón de arriba</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Nombre</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Email</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Gmail</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Rol</th>
                                <th className="text-left px-5 py-3 text-xs font-bold text-slate-500 uppercase">Doctor</th>
                                <th className="text-right px-5 py-3 text-xs font-bold text-slate-500 uppercase">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-5 py-3">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs">
                                                {user.name?.[0] || '?'}
                                            </div>
                                            <span className="font-medium text-sm text-slate-900">{user.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-5 py-3 text-sm text-slate-600">{user.email}</td>
                                    <td className="px-5 py-3 text-sm text-slate-600">{user.gmail || '—'}</td>
                                    <td className="px-5 py-3">
                                        <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold border ${getRoleBadgeColor(user.role)}`}>
                                            {ROLE_LABELS[user.role] || user.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-sm text-slate-600">
                                        {user.doctorId ? doctors.find(d => d.id === user.doctorId)?.name || user.doctorId : '—'}
                                    </td>
                                    <td className="px-5 py-3 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleEdit(user)}
                                                className="p-2 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(user)}
                                                className="p-2 rounded-lg hover:bg-red-50 text-red-500 transition-colors"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

// Reuse the same API URL logic as api.ts
function getApiUrl() {
    if (typeof window !== 'undefined') {
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'http://localhost:3001/api';
        }
    }
    return '/api';
}

export default UserManagement;
