import React, { useState, useEffect } from 'react';
import { Users as UsersIcon, Plus, X, Trash2, Save, AlertCircle, Edit3, Shield, Eye, EyeOff } from 'lucide-react';
import { api } from '../services/api';
import { isSupabaseConfigured_ } from '../services/supabase';

interface User {
  id?: string;
  email: string;
  full_name: string;
  role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'ASSISTANT';
  is_active: boolean;
  created_at?: string;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [userForm, setUserForm] = useState<User & { password?: string }>({
    email: '',
    full_name: '',
    role: 'RECEPTIONIST',
    is_active: true,
    password: ''
  });

  const roles = [
    { value: 'ADMIN', label: 'Administrador', color: 'bg-red-100 text-red-700', icon: '👨‍💼' },
    { value: 'DOCTOR', label: 'Doctor', color: 'bg-blue-100 text-blue-700', icon: '👨‍⚕️' },
    { value: 'RECEPTIONIST', label: 'Recepcionista', color: 'bg-green-100 text-green-700', icon: '👩‍💼' },
    { value: 'ASSISTANT', label: 'Asistente', color: 'bg-purple-100 text-purple-700', icon: '👨‍🔧' }
  ];

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.systemUsers.getAllIncludeInactive();
      setUsers(data || []);
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetForm = () => {
    setUserForm({
      email: '',
      full_name: '',
      role: 'RECEPTIONIST',
      is_active: true,
      password: ''
    });
    setEditingUser(null);
    setShowPassword(false);
  };

  const handleAddUser = () => {
    handleResetForm();
    setShowModal(true);
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setUserForm({
      ...user,
      password: ''
    });
    setShowModal(true);
  };

  const handleSaveUser = async () => {
    if (!userForm.email || !userForm.full_name) {
      alert('Email y nombre son obligatorios');
      return;
    }

    if (!editingUser && !userForm.password) {
      alert('La contraseña es obligatoria para nuevos usuarios');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(userForm.email)) {
      alert('Email inválido');
      return;
    }

    setIsSaving(true);
    try {
      if (editingUser?.id) {
        const updateData: any = {
          email: userForm.email,
          full_name: userForm.full_name,
          role: userForm.role,
          is_active: userForm.is_active
        };
        if (userForm.password) {
          updateData.password = userForm.password;
        }
        await api.systemUsers.update(editingUser.id, updateData);
      } else {
        await api.systemUsers.create({
          email: userForm.email,
          full_name: userForm.full_name,
          role: userForm.role,
          is_active: userForm.is_active,
          password: userForm.password
        });
      }
      setShowModal(false);
      loadUsers();
      setSuccessMessage(editingUser ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving user:', error);
      alert('Error al guardar el usuario');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteUser = async (id: string | undefined, name: string) => {
    if (!id) return;
    if (!confirm(`¿Eliminar usuario ${name}? Esta acción es irreversible.`)) return;

    try {
      await api.systemUsers.delete(id);
      loadUsers();
      setSuccessMessage('Usuario eliminado');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Error al eliminar el usuario');
    }
  };

  const handleToggleActive = async (user: User) => {
    try {
      await api.systemUsers.update(user.id!, {
        ...user,
        is_active: !user.is_active
      });
      loadUsers();
    } catch (error) {
      console.error('Error updating user status:', error);
      alert('Error al actualizar el estado del usuario');
    }
  };

  const getRoleInfo = (roleValue: string) => {
    return roles.find(r => r.value === roleValue);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <UsersIcon className="text-indigo-500" size={32} />
            Usuarios del Sistema
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Gestión de acceso y permisos</p>
        </div>
        <button
          onClick={handleAddUser}
          className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg hover:shadow-indigo-200"
        >
          <Plus size={16} /> Nuevo Usuario
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-green-600" size={20} />
          <p className="text-sm font-bold text-green-700">{successMessage}</p>
        </div>
      )}

      {/* USERS TABLE */}
      {users.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <UsersIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500 font-bold">No hay usuarios registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 tracking-widest border-b border-slate-100">
              <tr>
                <th className="p-6">Nombre</th>
                <th className="p-6">Email</th>
                <th className="p-6">Rol</th>
                <th className="p-6 text-center">Estado</th>
                <th className="p-6 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {users.map(user => {
                const roleInfo = getRoleInfo(user.role);
                return (
                  <tr key={user.id} className="text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                    <td className="p-6 text-slate-900 font-bold">{user.full_name}</td>
                    <td className="p-6 text-slate-600">{user.email}</td>
                    <td className="p-6">
                      <span className={`${roleInfo?.color} px-3 py-1 rounded-full text-[10px] font-bold uppercase inline-flex items-center gap-1`}>
                        <span>{roleInfo?.icon}</span>
                        {roleInfo?.label}
                      </span>
                    </td>
                    <td className="p-6 text-center">
                      <button
                        onClick={() => handleToggleActive(user)}
                        className={`px-3 py-1 rounded-full text-[9px] font-black uppercase transition-colors ${
                          user.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}
                      >
                        {user.is_active ? '✓ Activo' : '✗ Inactivo'}
                      </button>
                    </td>
                    <td className="p-6 text-right">
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={() => handleEditUser(user)}
                          className="p-2 hover:bg-indigo-50 rounded-lg text-slate-400 hover:text-indigo-600 transition-colors"
                          title="Editar"
                        >
                          <Edit3 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeleteUser(user.id, user.full_name)}
                          className="p-2 hover:bg-red-50 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* USER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-6">
          <div className="bg-white rounded-[2rem] p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <Shield size={20} className="text-indigo-600" />
                {editingUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 p-2 hover:bg-slate-100 rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Nombre Completo *</label>
                <input
                  type="text"
                  value={userForm.full_name}
                  onChange={(e) => setUserForm({ ...userForm, full_name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Ej: Juan Pérez"
                />
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Email *</label>
                <input
                  type="email"
                  value={userForm.email}
                  onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="juan@example.com"
                  disabled={!!editingUser}
                />
                {editingUser && <p className="text-[10px] text-slate-400 mt-1">Email no se puede cambiar</p>}
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Rol *</label>
                <select
                  value={userForm.role}
                  onChange={(e) =>
                    setUserForm({ ...userForm, role: e.target.value as User['role'] })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  {roles.map(role => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-black uppercase text-slate-400 mb-2 block">
                  {editingUser ? 'Cambiar Contraseña (Opcional)' : 'Contraseña *'}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={userForm.password || ''}
                    onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Password123!'}
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Rol - Descripción</label>
                <div className="grid grid-cols-2 gap-2">
                  {roles.map(role => (
                    <div key={role.value} className={`p-3 rounded-lg ${role.color} text-[10px] font-bold`}>
                      <div>{role.label}</div>
                      <div className="text-[9px] opacity-75 mt-1">
                        {role.value === 'ADMIN' && 'Acceso total al sistema'}
                        {role.value === 'DOCTOR' && 'Gestión de pacientes'}
                        {role.value === 'RECEPTIONIST' && 'Agenda y citas'}
                        {role.value === 'ASSISTANT' && 'Asistencia general'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-4 mt-8">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-3 font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveUser}
                disabled={isSaving}
                className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-bold uppercase flex items-center justify-center gap-2 hover:shadow-lg transition-all disabled:opacity-50"
              >
                <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Users;
