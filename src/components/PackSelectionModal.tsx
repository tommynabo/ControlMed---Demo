import React, { useState } from 'react';
import { X, Check } from 'lucide-react';

interface PackOption {
  id: string;
  name: string;
  description: string;
  price: number;
  services: Array<{ id: string; name: string; price: number }>;
}

interface PackSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPack: (packId: string, services: Array<{ id: string; name: string; price: number }>) => void;
}

const PACK_OPTIONS: PackOption[] = [
  {
    id: 'pack-1a',
    name: '📋 Pack 1ª Visita: Consulta + OPG + Higiene',
    description: 'Completo: primera consulta, radiografía panorámica y limpieza dental',
    price: 60,
    services: [
      { id: 'srv-11', name: 'Primera visita', price: 20 },
      { id: 'srv-12', name: 'OPG', price: 10 },
      { id: 'srv-14', name: 'Higiene', price: 30 }
    ]
  },
  {
    id: 'pack-1b',
    name: '⚡ Pack 1ª Visita: Consulta + OPG',
    description: 'Esencial: primera consulta y radiografía panorámica',
    price: 45,
    services: [
      { id: 'srv-11', name: 'Primera visita', price: 25 },
      { id: 'srv-12', name: 'OPG', price: 20 }
    ]
  }
];

export const PackSelectionModal: React.FC<PackSelectionModalProps> = ({
  isOpen,
  onClose,
  onSelectPack
}) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSelect = (packId: string) => {
    const pack = PACK_OPTIONS.find(p => p.id === packId);
    if (pack) {
      onSelectPack(pack.id, pack.services);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            ✨ Selecciona un Pack
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-600" />
          </button>
        </div>

        {/* Packs Grid */}
        <div className="p-6 space-y-4">
          {PACK_OPTIONS.map((pack) => (
            <button
              key={pack.id}
              onClick={() => handleSelect(pack.id)}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
                selectedId === pack.id
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="font-bold text-slate-900 text-lg">{pack.name}</h3>
                  <p className="text-sm text-slate-600 mt-1">{pack.description}</p>

                  {/* Services List */}
                  <div className="mt-3 space-y-2">
                    {pack.services.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-center justify-between text-sm bg-slate-50 rounded-lg p-2 px-3"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                          <span className="text-slate-700">{service.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{service.price}€</span>
                      </div>
                    ))}
                  </div>

                  {/* Total */}
                  <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="font-bold text-slate-900">Total:</span>
                    <span className="text-2xl font-black text-blue-600">{pack.price}€</span>
                  </div>
                </div>

                {/* Selection Indicator */}
                <div className="ml-4 flex-shrink-0">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                      selectedId === pack.id
                        ? 'border-blue-500 bg-blue-500'
                        : 'border-slate-300 bg-white'
                    }`}
                  >
                    {selectedId === pack.id && <Check size={16} className="text-white" />}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-slate-200 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={() => selectedId && handleSelect(selectedId)}
            disabled={!selectedId}
            className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-all ${
              selectedId
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-md'
                : 'bg-slate-300 text-slate-500 cursor-not-allowed'
            }`}
          >
            Confirmar Pack
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackSelectionModal;
