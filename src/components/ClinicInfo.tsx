import React, { useState, useEffect } from 'react';
import { Building2, MapPin, Phone, Mail, Clock, Save, AlertCircle } from 'lucide-react';
import { api } from '../services/api';

interface ClinicData {
  id?: string;
  name: string;
  street: string;
  street_number: string;
  city: string;
  postal_code: string;
  country: string;
  phone: string;
  email: string;
  opening_time: string;
  closing_time: string;
}

const ClinicInfo: React.FC = () => {
  const [clinicData, setClinicData] = useState<ClinicData>({
    name: '',
    street: '',
    street_number: '',
    city: '',
    postal_code: '',
    country: 'España',
    phone: '',
    email: '',
    opening_time: '08:00',
    closing_time: '20:00'
  });

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadClinicInfo();
  }, []);

  const loadClinicInfo = async () => {
    setIsLoading(true);
    try {
      // Intentar cargar del backend
      const data = await api.clinic.getInfo();
      if (data) {
        setClinicData(data);
      }
    } catch (e) {
      console.error('Error loading clinic info:', e);
      // Usar datos por defecto si no existe
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (clinicData.id) {
        await api.clinic.update(clinicData.id, clinicData);
      } else {
        await api.clinic.create(clinicData);
      }
      setSuccessMessage('Información de clínica guardada correctamente');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Error saving clinic info:', error);
      alert('Error al guardar la información de la clínica');
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setClinicData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full"></div>
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
          <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Datos básicos y horarios</p>
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
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-3">
          <AlertCircle className="text-green-600" size={20} />
          <p className="text-sm font-bold text-green-700">{successMessage}</p>
        </div>
      )}

      {/* DATOS BÁSICOS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
          Datos Básicos
        </h4>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Nombre de la Clínica</label>
            <input
              type="text"
              name="name"
              value={clinicData.name}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: Clínica Dental Sonrisas"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">País</label>
            <select
              name="country"
              value={clinicData.country}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
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

        {/* DIRECCIÓN */}
        <h4 className="text-sm font-bold text-slate-700 mt-8 mb-4 flex items-center gap-2">
          <MapPin size={16} className="text-blue-500" />
          Dirección
        </h4>

        <div className="grid grid-cols-3 gap-6 mb-6">
          <div className="col-span-2">
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Calle</label>
            <input
              type="text"
              name="street"
              value={clinicData.street}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: Calle Principal"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Número</label>
            <input
              type="text"
              name="street_number"
              value={clinicData.street_number}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: 123"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Ciudad</label>
            <input
              type="text"
              name="city"
              value={clinicData.city}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: Madrid"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Código Postal</label>
            <input
              type="text"
              name="postal_code"
              value={clinicData.postal_code}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Ej: 28001"
            />
          </div>
        </div>
      </div>

      {/* CONTACTO */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <span className="w-2 h-2 bg-blue-600 rounded-full"></span>
          Contacto
        </h4>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block flex items-center gap-2">
              <Phone size={14} /> Teléfono Principal
            </label>
            <input
              type="tel"
              name="phone"
              value={clinicData.phone}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="+34 912 34 56 78"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block flex items-center gap-2">
              <Mail size={14} /> Email Principal
            </label>
            <input
              type="email"
              name="email"
              value={clinicData.email}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="info@clinica.es"
            />
          </div>
        </div>
      </div>

      {/* HORARIOS PRINCIPALES */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
        <h4 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
          <Clock className="text-blue-500" size={20} />
          Horario de Operación
        </h4>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Hora de Apertura</label>
            <input
              type="time"
              name="opening_time"
              value={clinicData.opening_time}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>

          <div>
            <label className="text-xs font-black uppercase text-slate-400 mb-2 block">Hora de Cierre</label>
            <input
              type="time"
              name="closing_time"
              value={clinicData.closing_time}
              onChange={handleInputChange}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-200"
            />
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
          <p className="text-sm font-bold text-blue-700">
            Horario: <span className="text-blue-900">{clinicData.opening_time} - {clinicData.closing_time}</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ClinicInfo;
