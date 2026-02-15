import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Clock, Save, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { isSupabaseConfigured_ } from '../services/supabase';

interface ClinicData {
  id?: string;
  name: string;
  email: string;
  phone: string;
  web_url: string;
  country: string;
  opening_time: string;
  closing_time: string;
}

const ClinicInfo: React.FC = () => {
  const [clinicData, setClinicData] = useState<ClinicData>({
    name: 'CHC Clinica Dental',
    email: 'Admin@chcclinicadental.com',
    phone: '615049704',
    web_url: 'www.chcclinicadental.com',
    country: 'España',
    opening_time: '09:00',
    closing_time: '20:00'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured_) {
      setError('❌ Supabase no está configurado. Ver .env.example para instrucciones.');
      setIsLoading(false);
      return;
    }
    loadClinicInfo();
  }, []);

  const loadClinicInfo = async () => {
    setIsLoading(true);
    try {
      const data = await api.clinic.getInfo();
      if (data) {
        setClinicData({
          id: data.id,
          name: data.name || '',
          email: data.email || '',
          phone: data.phone || '',
          web_url: data.web_url || '',
          country: data.country || 'España',
          opening_time: data.opening_time ? data.opening_time.substring(0, 5) : '09:00',
          closing_time: data.closing_time ? data.closing_time.substring(0, 5) : '20:00'
        });
      }
    } catch (e: any) {
      console.error('Error loading clinic info:', e);
      setError(`Error loading data: ${e.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!isSupabaseConfigured_) {
      alert('❌ Supabase no está configurado');
      return;
    }

    setIsSaving(true);
    try {
      const timeData = {
        ...clinicData,
        opening_time: clinicData.opening_time.includes(':') 
          ? `${clinicData.opening_time}:00` 
          : `${clinicData.opening_time}:00`,
        closing_time: clinicData.closing_time.includes(':')
          ? `${clinicData.closing_time}:00`
          : `${clinicData.closing_time}:00`
      };

      if (clinicData.id) {
        await api.clinic.update(clinicData.id, timeData);
      } else {
        await api.clinic.create(timeData);
      }
      setSuccessMessage('✓ Información de clínica actualizada');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error: any) {
      console.error('Error saving clinic info:', error);
      setError(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClinicData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="bg-red-50 border border-red-200 rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="text-red-600 mx-auto mb-4" size={48} />
          <h3 className="text-red-900 font-bold text-lg mb-2">Error de Configuración</h3>
          <p className="text-red-700 text-sm mb-4">{error}</p>
          <div className="bg-red-100 rounded-lg p-4 text-left text-xs font-mono text-red-900">
            <p className="font-bold mb-2">📋 Para configurar:</p>
            <p>1. Copia .env.example a .env.local</p>
            <p>2. Añade tus credenciales de Supabase</p>
            <p>3. Reinicia: npm run dev</p>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
          <p className="text-slate-500 font-semibold">Cargando información...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h3 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <Building2 className="text-blue-500" size={32} />
            Información de la Clínica
          </h3>
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Datos básicos, dirección y horarios</p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-3 rounded-xl text-sm font-bold uppercase tracking-widest hover:scale-105 transition-transform flex items-center gap-2 shadow-lg hover:shadow-blue-200 disabled:opacity-50"
        >
          <Save size={16} /> {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>

      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3 animate-pulse">
          <AlertCircle className="text-green-600" size={20} />
          <p className="text-sm font-bold text-green-700">{successMessage}</p>
        </div>
      )}

      {/* INFORMACIÓN GENERAL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
          Información General
        </h4>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Nombre de la Clínica</label>
            <input
              type="text"
              name="name"
              value={clinicData.name}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              placeholder="CHC Clinica Dental"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Website</label>
            <input
              type="text"
              name="web_url"
              value={clinicData.web_url}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              placeholder="www.chcclinicadental.com"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block flex items-center gap-2">
              <Mail size={14} className="text-blue-500" /> Email Principal
            </label>
            <input
              type="email"
              name="email"
              value={clinicData.email}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              placeholder="Admin@chcclinicadental.com"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block flex items-center gap-2">
              <Phone size={14} className="text-blue-500" /> Teléfono Principal
            </label>
            <input
              type="tel"
              name="phone"
              value={clinicData.phone}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
              placeholder="+34 615049704"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">País</label>
            <select
              name="country"
              value={clinicData.country}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            >
              <option value="España">España</option>
              <option value="México">México</option>
              <option value="Colombia">Colombia</option>
              <option value="Argentina">Argentina</option>
              <option value="Chile">Chile</option>
              <option value="Perú">Perú</option>
            </select>
          </div>
        </div>
      </div>

      {/* DIRECCIÓN REGISTRADA */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <MapPin className="text-blue-500" size={20} />
          Dirección Principal
        </h4>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <p className="text-sm font-semibold text-slate-900">
            📍 <strong>Carrer De La Foneria, 24</strong><br />
            08038 Barcelona, España
          </p>
        </div>
      </div>

      {/* HORARIOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="text-blue-500" size={20} />
          Horario de Operación
        </h4>

        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Apertura</label>
            <input
              type="time"
              name="opening_time"
              value={clinicData.opening_time}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-3 block">Cierre</label>
            <input
              type="time"
              name="closing_time"
              value={clinicData.closing_time}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-xl border border-green-200">
          <p className="text-sm font-bold text-green-900">
            🕒 Operativa: <span className="text-green-700">{clinicData.opening_time} a {clinicData.closing_time}</span>
          </p>
          <p className="text-xs text-green-600 mt-1">De lunes a viernes, con horarios especiales por doctor</p>
        </div>
      </div>

      {/* INFORMACIÓN DE FACTURACIÓN */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 hover:shadow-md transition-shadow">
        <h4 className="text-lg font-bold text-slate-900 mb-6">💼 Información de Facturación</h4>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-black uppercase text-slate-400 mb-2">Razón Social</p>
            <p className="font-semibold text-slate-900">CHCMEDIC SL</p>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-slate-400 mb-2">CIF</p>
            <p className="font-semibold text-slate-900">B75759746</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-black uppercase text-slate-400 mb-2">IBAN</p>
            <p className="font-semibold text-slate-900 font-mono">ES21 0030 1472 2201 0235 55</p>
          </div>
          <div className="col-span-2">
            <p className="text-xs font-black uppercase text-slate-400 mb-2">Responsable</p>
            <p className="font-semibold text-slate-900">Kevin Chrabieh</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClinicInfo;
