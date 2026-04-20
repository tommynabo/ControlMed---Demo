/**
 * SOLUCIÓN RÁPIDA PARA LIMPIAR DUPLICADOS
 * 
 * ⚠️ INSTRUCCIONES:
 * 1. Abre la aplicación en el navegador
 * 2. Presiona F12 (abre DevTools)
 * 3. Ve a la pestaña "Console"
 * 4. Copia TODO el código de abajo y pégalo en la consola
 * 5. Presiona ENTER
 * 6. Espera a que recargue la página automáticamente
 * 
 * ============================================================
 */

// ✅ PASO 1: Limpiar localStorage
console.log('🗑️  Limpiando localStorage...');
try {
    localStorage.clear();
    console.log('✅ localStorage limpio');
} catch (e) {
    console.warn('⚠️  No se pudo limpiar localStorage:', e.message);
}

// ✅ PASO 2: Limpiar sessionStorage
console.log('🗑️  Limpiando sessionStorage...');
try {
    sessionStorage.clear();
    console.log('✅ sessionStorage limpio');
} catch (e) {
    console.warn('⚠️  No se pudo limpiar sessionStorage:', e.message);
}

// ✅ PASO 3: Limpiar IndexedDB (donde está el caché de React Query)
console.log('🗑️  Limpiando IndexedDB...');
try {
    const deleteDatabase = (dbName) => {
        return new Promise((resolve) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => {
                console.log(`✅ Base de datos '${dbName}' eliminada`);
                resolve();
            };
            req.onerror = () => {
                console.warn(`⚠️  Error al eliminar '${dbName}'`);
                resolve();
            };
        });
    };

    // Obtener lista de bases de datos y eliminarlas
    indexedDB.databases().then(async (dbs) => {
        console.log(`📊 Encontradas ${dbs.length} bases de datos IndexedDB`);
        for (const db of dbs) {
            await deleteDatabase(db.name);
        }
        
        console.log('\n✅ LIMPIEZA COMPLETADA');
        console.log('🔄 Recargando página en 2 segundos...\n');
        
        // ✅ PASO 4: Hard reload (sin caché)
        setTimeout(() => {
            console.log('🔄 Recargando...');
            window.location.reload(true);
        }, 2000);
    });
} catch (e) {
    console.warn('⚠️  Error con IndexedDB:', e.message);
    console.log('🔄 Recargando página de todas formas...');
    setTimeout(() => {
        window.location.reload(true);
    }, 1000);
}
