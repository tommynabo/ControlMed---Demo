import React, { useState } from 'react';
import { RotateCcw } from 'lucide-react';

const DemoResetButton: React.FC = () => {
  const secret = import.meta.env.VITE_DEMO_RESET_SECRET;
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  if (!secret) return null;

  const handleReset = async () => {
    if (!confirm('¿Restaurar todos los datos demo al estado original?')) return;
    setLoading(true);
    setMsg('');
    try {
      const res = await fetch('/api/demo/reset', {
        method: 'POST',
        headers: { 'x-demo-secret': secret },
      });
      const data = await res.json();
      setMsg(data.ok ? '✅ Datos restaurados' : `❌ ${data.error}`);
      if (data.ok) setTimeout(() => window.location.reload(), 1500);
    } catch {
      setMsg('❌ Error de conexión');
    } finally {
      setLoading(false);
      setTimeout(() => setMsg(''), 4000);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {msg && (
        <span className="bg-slate-900 text-white text-xs px-3 py-2 rounded-lg shadow-lg">
          {msg}
        </span>
      )}
      <button
        onClick={handleReset}
        disabled={loading}
        className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-xl shadow-lg"
      >
        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
        {loading ? 'Restaurando...' : 'Reset Demo'}
      </button>
    </div>
  );
};

export default DemoResetButton;
