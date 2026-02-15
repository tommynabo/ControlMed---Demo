import { createClient } from '@supabase/supabase-js';

// Obtener credenciales de variables de entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabase: any = null;
let isSupabaseConfigured = false;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
    isSupabaseConfigured = true;
  } catch (err) {
    console.error('❌ Error inicializando Supabase:', err);
    isSupabaseConfigured = false;
  }
} else {
  console.warn('⚠️  Supabase no configurado. Variables de entorno faltantes:');
  if (!supabaseUrl) console.warn('   - VITE_SUPABASE_URL');
  if (!supabaseAnonKey) console.warn('   - VITE_SUPABASE_ANON_KEY');
  console.warn('   📚 Ver .env.example para instrucciones de configuración');
}

// Crear proxy que retorna errores legibles si no está configurado
const createSafeSupabaseProxy = () => {
  return new Proxy({} as any, {
    get: (target, prop) => {
      if (prop === '__isConfigured') {
        return isSupabaseConfigured;
      }
      
      if (!isSupabaseConfigured) {
        return async () => {
          throw new Error(
            '❌ Supabase no está configurado.\n' +
            'Por favor, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en .env.local\n' +
            'Ver .env.example para más detalles.'
          );
        };
      }
      
      return supabase?.[prop as string];
    }
  });
};

export const supabase = isSupabaseConfigured ? supabase : createSafeSupabaseProxy();
export const isSupabaseConfigured_ = isSupabaseConfigured;

export default supabase;

