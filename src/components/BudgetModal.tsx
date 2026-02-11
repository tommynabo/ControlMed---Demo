import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, DollarSign } from 'lucide-react';
import { api } from '../services/api';

interface BudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    onSave: () => void;
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, patientId, onSave }) => {
    const [title, setTitle] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [availableServices, setAvailableServices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Loading state
    const [isLoadingServices, setIsLoadingServices] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setIsLoadingServices(true);
            api.services.getAll()
                .then(setAvailableServices)
                .catch(console.error)
                .finally(() => setIsLoadingServices(false));
        }
    }, [isOpen]);

    const filteredServices = availableServices.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddItem = (service: any) => {
        setItems(prev => [...prev, {
            serviceId: service.id, // Keep reference if needed
            name: service.name,
            price: service.price || service.final_price || 0,
            quantity: 1,
            tooth: ''
        }]);
        setSearchQuery(''); // Reset search
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, [field]: value } : item));
    };

    const totalAmount = items.reduce((acc, item) => acc + (Number(item.price) * (item.quantity || 1)), 0);

    const handleSafeSave = async () => {
        if (!title) return alert("Por favor indica un título");
        if (items.length === 0) return alert("Añade al menos un tratamiento");

        try {
            await api.budget.create(patientId, items, title);
            alert("✅ Presupuesto creado correctamente");
            onSave();
            onClose();
        } catch (e: any) {
            alert("Error: " + e.message);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white max-w-2xl w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">Nuevo Presupuesto</h3>
                        <p className="text-sm text-slate-400 font-medium">Añade tratamientos al presupuesto</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-900 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 flex-1">

                    {/* Title Input */}
                    <div>
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Título / Concepto General</label>
                        <input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="Ej. Plan de Rehabilitación Completa"
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            autoFocus
                        />
                    </div>

                    {/* Service Selector */}
                    <div className="relative">
                        <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Añadir Tratamiento</label>
                        <div className="relative group">
                            <Search className="absolute left-4 top-4 text-slate-400" size={18} />
                            <input
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Buscar tratamiento..."
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-12 p-4 text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                            />
                        </div>

                        {/* Dropdown Results */}
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50">
                                {isLoadingServices ? (
                                    <div className="p-4 text-center text-xs text-slate-400">Cargando...</div>
                                ) : filteredServices.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-400">No se encontraron tratamientos</div>
                                ) : (
                                    filteredServices.map(service => (
                                        <button
                                            key={service.id}
                                            onClick={() => handleAddItem(service)}
                                            className="w-full text-left p-3 hover:bg-blue-50 flex justify-between items-center text-sm font-medium border-b border-slate-50 last:border-0"
                                        >
                                            <span className="font-bold text-slate-700">{service.name}</span>
                                            <span className="text-slate-500">{service.price || service.final_price}€</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        )}
                    </div>

                    {/* Selected Items List */}
                    <div className="space-y-3">
                        <label className="text-[10px] font-black uppercase text-slate-400 block">Items del Presupuesto</label>
                        {items.length === 0 ? (
                            <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                                No hay items añadidos
                            </div>
                        ) : (
                            items.map((item, idx) => (
                                <div key={idx} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center animate-in slide-in-from-left-2">
                                    <div className="flex-1">
                                        <input
                                            value={item.name}
                                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                            className="font-bold text-slate-900 text-sm bg-transparent outline-none w-full"
                                            placeholder="Nombre del tratamiento"
                                        />
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        <div className="w-24">
                                            <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Diente</label>
                                            <input
                                                value={item.tooth}
                                                onChange={(e) => handleUpdateItem(idx, 'tooth', e.target.value)}
                                                className="w-full bg-slate-50 rounded-lg p-2 text-xs font-bold text-center outline-none"
                                                placeholder="-"
                                            />
                                        </div>
                                        <div className="w-24">
                                            <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Precio</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={item.price}
                                                    onChange={(e) => handleUpdateItem(idx, 'price', e.target.value)}
                                                    className="w-full bg-slate-50 rounded-lg p-2 text-xs font-bold text-right outline-none pr-6"
                                                />
                                                <span className="absolute right-2 top-2 text-xs text-slate-400">€</span>
                                            </div>
                                        </div>
                                        <div className="h-full flex items-end pb-1">
                                            <button
                                                onClick={() => handleRemoveItem(idx)}
                                                className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                </div>

                {/* Footer */}
                <div className="p-8 border-t border-slate-100 bg-slate-50/50 rounded-b-[2rem] flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-slate-400">Total Presupuesto</span>
                        <span className="text-3xl font-black text-slate-900">{totalAmount.toFixed(2)}€</span>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-6 py-3 font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-colors">
                            Cancelar
                        </button>
                        <button
                            onClick={handleSafeSave}
                            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2"
                        >
                            <DollarSign size={18} />
                            Crear Presupuesto
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
