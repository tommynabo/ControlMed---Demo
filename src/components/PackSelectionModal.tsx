import React, { useState } from 'react';
import { X, Check, Building2, User, ChevronRight } from 'lucide-react';

export interface PackServiceItem {
  id: string;
  name: string;
  price: number;
  excludeFromLiquidation: boolean;
}

interface PackOption {
  id: string;
  name: string;
  description: string;
  services: PackServiceItem[];
}

interface PackSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPack: (packId: string, services: PackServiceItem[]) => void;
}

const PACK_OPTIONS: PackOption[] = [
  {
    id: 'pack-1a',
    name: '📋 Pack 1ª Visita: Consulta + OPG + Higiene',
    description: 'Completo: primera consulta, radiografía panorámica y limpieza dental',
    services: [
      { id: 'srv-11', name: 'Primera visita', price: 20, excludeFromLiquidation: false },
      { id: 'srv-12', name: 'OPG', price: 10, excludeFromLiquidation: true },
      { id: 'srv-14', name: 'Higiene', price: 30, excludeFromLiquidation: false }
    ]
  },
  {
    id: 'pack-1b',
    name: '⚡ Pack 1ª Visita: Consulta + OPG',
    description: 'Esencial: primera consulta y radiografía panorámica',
    services: [
      { id: 'srv-11', name: 'Primera visita', price: 25, excludeFromLiquidation: false },
      { id: 'srv-12', name: 'OPG', price: 20, excludeFromLiquidation: true }
    ]
  },
  {
    id: 'pack-1c',
    name: '🦷 Pack 1ª Visita: Consulta + OPG + Tartrectomía',
    description: 'Con tartrectomía: primera consulta, radiografía panorámica y tartrectomía',
    services: [
      { id: 'srv-11', name: 'Primera visita', price: 20, excludeFromLiquidation: false },
      { id: 'srv-12', name: 'OPG', price: 10, excludeFromLiquidation: true },
      { id: 'srv-13', name: 'Tartrectomía', price: 30, excludeFromLiquidation: false }
    ]
  }
];

export const PackSelectionModal: React.FC<PackSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectPack
}) => {
  const [step, setStep] = useState<'select' | 'customize'>('select');
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const [editableServices, setEditableServices] = useState<PackServiceItem[]>([]);

  if (!isOpen) return null;

  const handleSelectPack = (packId: string) => {
    const pack = PACK_OPTIONS.find(p => p.id === packId);
    if (!pack) return;
    setSelectedPackId(packId);
    setEditableServices(pack.services.map(s => ({ ...s })));
    setStep('customize');
  };

  const handlePriceChange = (serviceId: string, newPrice: string) => {
    const parsed = parseFloat(newPrice);
    setEditableServices(prev =>
      prev.map(s => s.id === serviceId ? { ...s, price: isNaN(parsed) ? 0 : parsed } : s)
    );
  };

  const handleConfirm = () => {
    if (!selectedPackId) return;
    onSelectPack(selectedPackId, editableServices);
    onClose();
    setStep('select');
    setSelectedPackId(null);
    setEditableServices([]);
  };

  const handleBack = () => {
    setStep('select');
    setSelectedPackId(null);
    setEditableServices([]);
  };

  const handleClose = () => {
    setStep('select');
    setSelectedPackId(null);
    setEditableServices([]);
    onClose();
  };

  const selectedPack = PACK_OPTIONS.find(p => p.id === selectedPackId);
  const doctorTotal = editableServices.filter(s => !s.excludeFromLiquidation).reduce((sum, s) => sum + s.price, 0);
  const clinicTotal = editableServices.filter(s => s.excludeFromLiquidation).reduce((sum, s) => sum + s.price, 0);
  const grandTotal = doctorTotal + clinicTotal;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[150] animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 animate-in zoom-in-95 duration-300">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            {step === 'select' ? '✨ Selecciona un Pack' : `✏️ Ajustar precios — ${selectedPack?.name}`}
          </h2>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* ── STEP 1: Pack selection ── */}
        {step === 'select' && (
          <div className="p-6 space-y-4">
            {PACK_OPTIONS.map((pack) => (
              <button
                key={pack.id}
                onClick={() => handleSelectPack(pack.id)}
                className="w-full text-left p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-900 text-lg">{pack.name}</h3>
                    <p className="text-sm text-slate-600 mt-1">{pack.description}</p>

                    {/* Services preview */}
                    <div className="mt-3 space-y-2">
                      {pack.services.map((service) => (
                        <div key={service.id} className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-2 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                            <span className="text-slate-700">{service.name}</span>
                            {service.excludeFromLiquidation && (
                              <span className="flex items-center gap-0.5 text-[10px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-200">
                                <Building2 size={9} />
                                Clínica
                              </span>
                            )}
                          </div>
                          <span className="font-semibold text-slate-900">{service.price}€</span>
                        </div>
                      ))}
                    </div>

                    {/* Total */}
                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                      <span className="font-bold text-slate-900">Total:</span>
                      <span className="text-2xl font-black text-blue-600">
                        {pack.services.reduce((sum, s) => sum + s.price, 0)}€
                      </span>
                    </div>
                  </div>
                  <div className="ml-4 flex-shrink-0 self-center">
                    <ChevronRight size={20} className="text-slate-400" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* ── STEP 2: Customize prices ── */}
        {step === 'customize' && (
          <div className="p-6 space-y-4">
            <p className="text-sm text-slate-500">
              Ajusta el importe de cada concepto. Los marcados como
              <span className="inline-flex items-center gap-0.5 mx-1 text-amber-700 font-semibold">
                <Building2 size={12} />Clínica
              </span>
              no se incluyen en la liquidación del doctor.
            </p>

            <div className="space-y-3">
              {editableServices.map((service) => (
                <div
                  key={service.id}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 ${
                    service.excludeFromLiquidation
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-blue-100 bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      service.excludeFromLiquidation ? 'bg-amber-100' : 'bg-blue-100'
                    }`}>
                      {service.excludeFromLiquidation
                        ? <Building2 size={15} className="text-amber-600" />
                        : <User size={15} className="text-blue-600" />
                      }
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{service.name}</p>
                      <p className={`text-xs font-medium ${
                        service.excludeFromLiquidation ? 'text-amber-600' : 'text-blue-600'
                      }`}>
                        {service.excludeFromLiquidation ? '🏥 Va a la clínica (no al doctor)' : '👨‍⚕️ Va al doctor'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={service.price}
                      onChange={(e) => handlePriceChange(service.id, e.target.value)}
                      className="w-24 text-right font-bold text-lg border-2 border-slate-300 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-400 bg-white"
                    />
                    <span className="font-bold text-slate-600 text-lg">€</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-2 flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 text-blue-700 font-medium">
                  <User size={13} /> Base liquidación doctor
                </span>
                <span className="font-bold text-blue-700">{doctorTotal.toFixed(2)}€</span>
              </div>
              {clinicTotal > 0 && (
                <div className="bg-amber-50 px-4 py-2 flex items-center justify-between text-sm border-t border-slate-200">
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <Building2 size={13} /> Va a la clínica
                  </span>
                  <span className="font-bold text-amber-700">{clinicTotal.toFixed(2)}€</span>
                </div>
              )}
              <div className="bg-slate-100 px-4 py-2.5 flex items-center justify-between border-t border-slate-200">
                <span className="font-bold text-slate-800">Total cobrado al paciente</span>
                <span className="text-xl font-black text-slate-900">{grandTotal.toFixed(2)}€</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          {step === 'select' ? (
            <button
              onClick={handleClose}
              className="flex-1 px-4 py-2 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
          ) : (
            <>
              <button
                onClick={handleBack}
                className="px-4 py-2 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
              >
                ← Atrás
              </button>
              <button
                onClick={handleConfirm}
                className="flex-1 px-4 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-700 shadow-md transition-all"
              >
                <span className="flex items-center justify-center gap-2">
                  <Check size={16} />
                  Confirmar Pack — {grandTotal.toFixed(2)}€
                </span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PackSelectionModal;
