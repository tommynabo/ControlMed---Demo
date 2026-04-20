/**
 * SCRIPT DE LIMPIEZA PARA ROLES DE RECEPCIÓN
 * 
 * Ejecuta ESTO en la consola del navegador (F12 > Console)
 * para limpiar el cache y ver datos frescos de la BD
 */

// 1. Limpiar localStorage
console.log('🗑️  Limpiando localStorage...');
localStorage.clear();
console.log('✅ localStorage limpio');

// 2. Limpiar sessionStorage
console.log('🗑️  Limpiando sessionStorage...');
sessionStorage.clear();
console.log('✅ sessionStorage limpio');

// 3. Limpiar IndexedDB (donde React Query cachea datos)
console.log('🗑️  Limpiando IndexedDB...');
const dbNames = await indexedDB.databases();
for (const db of dbNames) {
    indexedDB.deleteDatabase(db.name);
}
console.log('✅ IndexedDB limpio');

// 4. Recargar la página sin cache (hard refresh)
console.log('🔄 Recargando página...');
setTimeout(() => {
    window.location.reload(true);  // Force reload without cache
}, 500);
