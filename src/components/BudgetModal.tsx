import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, Search, DollarSign, CheckSquare, Square, Percent, Calculator, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../services/api';

interface BudgetModalProps {
    isOpen: boolean;
    onClose: () => void;
    patientId: string;
    onSave: () => void;
    initialBudget?: any;
    doctors?: { id: string; name: string }[];
}

export const BudgetModal: React.FC<BudgetModalProps> = ({ isOpen, onClose, patientId, onSave, initialBudget, doctors = [] }) => {
    const [title, setTitle] = useState('');
    const [items, setItems] = useState<any[]>([]);
    const [availableServices, setAvailableServices] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [patientTreatments, setPatientTreatments] = useState<any[]>([]);

    // Loading state
    const [isLoadingServices, setIsLoadingServices] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialBudget) {
                setTitle(initialBudget.title || '');
                setItems(initialBudget.items ? initialBudget.items.map((i: any) => ({
                    ...i,
                    quantity: i.quantity || 1,
                    tooth: i.tooth || ''
                })) : []);
            } else {
                setTitle('');
                setItems([]);
            }

            setIsLoadingServices(true);
            api.services.getAll()
                .then(fetched => {
                    const packs = [
                        { id: 'pack-1', name: 'Pack: 1ª Visita + OPG', price: 60, isPack: true },
                        { id: 'pack-2', name: 'Pack: 1ª Visita + OPG + Tartrectomía', price: 60, isPack: true }
                    ];
                    setAvailableServices([...packs, ...fetched]);
                })
                .catch(console.error)
                .finally(() => setIsLoadingServices(false));

            // Fetch patient's existing treatments
            if (patientId) {
                api.treatments.getByPatient(patientId)
                    .then(setPatientTreatments)
                    .catch(console.error);
            }
        }
    }, [isOpen, initialBudget, patientId]);

    const filteredServices = availableServices.filter(s =>
        s.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAddItem = (service: any) => {
        if (service.isPack) {
            if (service.id === 'pack-1') {
                setItems(prev => [
                    ...prev,
                    { serviceId: 'srv-11', name: 'Primera visita', price: 0, quantity: 1, tooth: '' },
                    { serviceId: 'srv-12', name: 'OPG', price: 60, quantity: 1, tooth: '' }
                ]);
            } else if (service.id === 'pack-2') {
                setItems(prev => [
                    ...prev,
                    { serviceId: 'srv-11', name: 'Primera visita', price: 0, quantity: 1, tooth: '' },
                    { serviceId: 'srv-12', name: 'OPG', price: 15, quantity: 1, tooth: '' },
                    { serviceId: 'srv-13', name: 'Tartrectomía', price: 45, quantity: 1, tooth: '' }
                ]);
            }
            setSearchQuery('');
            return;
        }

        setItems(prev => [...prev, {
            serviceId: service.id, // Keep reference if needed
            name: service.name,
            price: service.price || service.final_price || 0,
            quantity: 1,
            tooth: '',
            doctorId: ''
        }]);
        setSearchQuery(''); // Reset search
    };

    const handleRemoveItem = (index: number) => {
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleUpdateItem = (index: number, field: string, value: any) => {
        setItems(prev => prev.map((item, i) => {
            if (i !== index) return item;
            // Manual price edit clears stored discount
            if (field === 'price') return { ...item, price: value, discount: 0, originalPrice: undefined };
            return { ...item, [field]: value };
        }));
    };

    const toggleSelection = (index: number) => {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedIndices.size === items.length) {
            setSelectedIndices(new Set());
        } else {
            setSelectedIndices(new Set(items.keys()));
        }
    };

    const applyBulkDiscount = (type: 'percent' | 'fixed') => {
        const val = prompt(type === 'percent' ? "Porcentaje de descuento (ej: 10):" : "Importe de descuento fijo (ej: 50):");
        if (!val) return;
        const num = parseFloat(val);
        if (isNaN(num) || num < 0) return;

        setItems(prev => prev.map((item, idx) => {
            if (!selectedIndices.has(idx)) return item;
            // Use originalPrice as base so repeated discounts don't compound
            const base = Number(item.originalPrice ?? item.price);
            let newPrice: number;
            let discountPct: number;
            if (type === 'percent') {
                newPrice = base * (1 - num / 100);
                discountPct = num;
            } else {
                newPrice = base - num;
                discountPct = base > 0 ? parseFloat(((num / base) * 100).toFixed(2)) : 0;
            }
            return {
                ...item,
                originalPrice: base,
                discount: discountPct,
                price: Math.max(0, newPrice).toFixed(2)
            };
        }));
    };

    const applyBulkIVA = (ivaPercent: number) => {
        setItems(prev => prev.map((item, idx) => {
            if (!selectedIndices.has(idx)) return item;
            let currentPrice = Number(item.price);
            let basePrice = currentPrice;
            
            // If we are "applying" 21% to something that might have it, or removing it.
            // Simple logic: we assume price is base price.
            if (ivaPercent === 21) basePrice = currentPrice * 1.21;
            else if (ivaPercent === 0) basePrice = currentPrice / 1.21; // Attempt to "una-apply" if it was 21%
            
            return { ...item, price: basePrice.toFixed(2) };
        }));
    };

    const removeBulk = () => {
        if (!confirm(`¿Eliminar ${selectedIndices.size} items?`)) return;
        setItems(prev => prev.filter((_, idx) => !selectedIndices.has(idx)));
        setSelectedIndices(new Set());
    };

    const totalAmount = items.reduce((acc, item) => acc + (Number(item.price) * (Number(item.quantity) || 1)), 0);

    const handleSafeSave = async () => {
        if (!title.trim()) return toast.error("Por favor indica un título para el presupuesto");
        if (items.length === 0) return toast.error("Añade al menos un tratamiento al presupuesto");
        if (isSubmitting) return;

        // Sanitize: ensure all items have a valid numeric price and name
        const sanitizedItems = items
            .filter(item => item.name && item.name.trim() !== '')
            .map(item => ({
                ...item,
                price: isNaN(Number(item.price)) || item.price === '' ? 0 : Number(item.price),
                quantity: Math.max(1, Number(item.quantity) || 1),
                discount: Number(item.discount) || 0,
                originalPrice: item.originalPrice != null ? Number(item.originalPrice) : undefined
            }));

        if (sanitizedItems.length === 0) return toast.error("Todos los items están incompletos. Añade al menos un tratamiento con nombre.");

        setIsSubmitting(true);
        try {
            if (initialBudget && initialBudget.id) {
                await api.budget.update(initialBudget.id, sanitizedItems, title);
                toast.success("✅ Presupuesto actualizado correctamente");
            } else {
                await api.budget.create(patientId, sanitizedItems, title);
                toast.success("✅ Presupuesto creado correctamente");
            }
            onSave();
            onClose();
        } catch (e: any) {
            const message = e?.message || "Error desconocido al guardar el presupuesto";
            toast.error(`Error al guardar: ${message}`, { duration: 6000 });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
            <div className="bg-white max-w-2xl w-full rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                    <div>
                        <h3 className="text-2xl font-black text-slate-900">{initialBudget ? 'Editar Presupuesto' : 'Nuevo Presupuesto'}</h3>
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

                    {/* Patient Existing Treatments */}
                    {patientTreatments.length > 0 && (
                        <div>
                            <label className="text-[10px] font-black uppercase text-slate-400 mb-2 block">Tratamientos del Paciente</label>
                            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                                {patientTreatments
                                    .filter(t => t.status !== 'PRESUPUESTADO')
                                    .map(t => (
                                        <button
                                            key={t.id}
                                            onClick={() => {
                                                setItems(prev => [...prev, {
                                                    serviceId: t.serviceId || null,
                                                    treatmentId: t.id,
                                                    name: t.serviceName || t.name || 'Tratamiento',
                                                    price: t.price || t.customPrice || 0,
                                                    quantity: 1,
                                                    tooth: t.toothId ? String(t.toothId) : ''
                                                }]);
                                            }}
                                            className="w-full text-left p-2 hover:bg-amber-100 rounded-lg flex justify-between items-center text-sm font-medium transition-colors"
                                        >
                                            <span className="font-bold text-amber-800">{t.serviceName || t.name}</span>
                                            <span className="text-amber-600 text-xs">{t.price || t.customPrice || 0}€ · {t.status}</span>
                                        </button>
                                    ))}
                                {patientTreatments.filter(t => t.status !== 'PRESUPUESTADO').length === 0 && (
                                    <div className="text-xs text-amber-500 text-center py-2">Todos los tratamientos ya están presupuestados</div>
                                )}
                            </div>
                        </div>
                    )}

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
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black uppercase text-slate-400 block">Items del Presupuesto</label>
                            {items.length > 0 && (
                                <button 
                                    onClick={toggleSelectAll}
                                    className="text-[10px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                                >
                                    {selectedIndices.size === items.length ? <CheckSquare size={12} /> : <Square size={12} />}
                                    {selectedIndices.size === items.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                                </button>
                            )}
                        </div>
                        {items.length === 0 ? (
                            <div className="p-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center text-slate-400 text-sm">
                                No hay items añadidos
                            </div>
                        ) : (
                            items.map((item, idx) => (
                                <div key={idx} className={`bg-white border ${selectedIndices.has(idx) ? 'border-blue-500 ring-2 ring-blue-500/10' : 'border-slate-200'} p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4 items-start md:items-center animate-in slide-in-from-left-2 transition-all`}>
                                    
                                    {/* Selection Checkbox */}
                                    <button 
                                        onClick={() => toggleSelection(idx)}
                                        className={`transition-colors ${selectedIndices.has(idx) ? 'text-blue-600' : 'text-slate-300 hover:text-slate-400'}`}
                                    >
                                        {selectedIndices.has(idx) ? <CheckSquare size={20} /> : <Square size={20} />}
                                    </button>

                                    <div className="flex-1">
                                        <input
                                            value={item.name}
                                            onChange={(e) => handleUpdateItem(idx, 'name', e.target.value)}
                                            className="font-bold text-slate-900 text-sm bg-transparent outline-none w-full"
                                            placeholder="Nombre del tratamiento"
                                        />
                                    </div>

                                    <div className="flex gap-2 items-center">
                                        <div className="w-20">
                                            <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Diente</label>
                                            <input
                                                value={item.tooth}
                                                onChange={(e) => handleUpdateItem(idx, 'tooth', e.target.value)}
                                                className="w-full bg-slate-50 rounded-lg p-2 text-xs font-bold text-center outline-none"
                                                placeholder="-"
                                            />
                                        </div>
                                        <div className="w-20">
                                            <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Cant.</label>
                                            <input
                                                type="number"
                                                min="1"
                                                value={item.quantity}
                                                onChange={(e) => handleUpdateItem(idx, 'quantity', Number(e.target.value))}
                                                className="w-full bg-slate-50 rounded-lg p-2 text-xs font-bold text-center outline-none"
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
                                            {item.discount > 0 && (
                                                <div className="mt-1 text-center">
                                                    <span className="text-[9px] font-black text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                                        -{item.discount}% dto.
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        {doctors.length > 0 && (
                                            <div className="w-28">
                                                <label className="text-[8px] font-black uppercase text-slate-400 block mb-1">Doctor</label>
                                                <select
                                                    value={item.doctorId || ''}
                                                    onChange={(e) => handleUpdateItem(idx, 'doctorId', e.target.value || null)}
                                                    className="w-full bg-slate-50 rounded-lg p-2 text-xs font-bold outline-none"
                                                >
                                                    <option value="">Sin asignar</option>
                                                    {doctors.map(d => (
                                                        <option key={d.id} value={d.id}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
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

                    {/* Bulk Action Toolbar */}
                    {selectedIndices.size > 0 && (
                        <div className="sticky bottom-0 bg-blue-600 text-white p-4 rounded-2xl shadow-2xl flex items-center justify-between animate-in slide-in-from-bottom-4 z-[60]">
                            <div className="flex items-center gap-3">
                                <span className="bg-blue-800 px-3 py-1 rounded-full text-[10px] font-black uppercase">{selectedIndices.size} seleccionados</span>
                                <div className="h-6 w-px bg-blue-500 mx-2" />
                                <div className="flex gap-1">
                                    <button onClick={() => applyBulkDiscount('percent')} className="flex items-center gap-1 px-3 py-2 hover:bg-blue-700 rounded-lg transition-colors text-xs font-bold">
                                        <Percent size={14} /> Dto %
                                    </button>
                                    <button onClick={() => applyBulkDiscount('fixed')} className="flex items-center gap-1 px-3 py-2 hover:bg-blue-700 rounded-lg transition-colors text-xs font-bold">
                                        <DollarSign size={14} /> Dto €
                                    </button>
                                    <div className="h-6 w-px bg-blue-500 mx-1" />
                                    <button onClick={() => applyBulkIVA(21)} className="flex items-center gap-1 px-3 py-2 hover:bg-blue-700 rounded-lg transition-colors text-xs font-bold">
                                        <Calculator size={14} /> IVA 21%
                                    </button>
                                    <button onClick={() => applyBulkIVA(0)} className="flex items-center gap-1 px-3 py-2 hover:bg-blue-700 rounded-lg transition-colors text-xs font-bold">
                                        <Calculator size={14} /> IVA 0%
                                    </button>
                                </div>
                            </div>
                            <button onClick={removeBulk} className="p-2 hover:bg-blue-700 rounded-lg transition-colors text-white/80 hover:text-white">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}

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
                            disabled={isSubmitting}
                            className="bg-slate-900 text-white px-8 py-3 rounded-xl font-bold uppercase shadow-lg hover:shadow-xl hover:scale-105 transition-all flex items-center gap-2 disabled:opacity-50 disabled:scale-100"
                        >
                            {isSubmitting ? <><Loader2 className="animate-spin w-4 h-4" /> Guardando...</> : <><DollarSign size={18} /> {initialBudget ? 'Guardar Cambios' : 'Crear Presupuesto'}</>}
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
