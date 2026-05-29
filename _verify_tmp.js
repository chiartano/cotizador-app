/* ================================================================
 * COTIZADOR PRO - Lógica del cotizador principal
 * Maneja: divisiones, espejos, cortavientos, config, carrito, historial
 * Para el módulo de aluminio ver: aluminio.js
 * ================================================================ */
"use strict";

// ============================================================
// TOAST NOTIFICATIONS — Reemplazo elegante para alert()
// ============================================================
// Uso: toast('Mensaje'), toast('Éxito', 'success'), toast('Error', 'error', 4000)
function toast(mensaje, tipo = 'info', duracion = 3000) {
    const cont = document.getElementById('toast-container');
    if (!cont) return;
    const el = document.createElement('div');
    el.className = 'toast ' + tipo;
    const icons = { success:'✓', error:'⚠️', warn:'⚠️', info:'ℹ️' };
    el.innerHTML = `<span class="toast-icon">${icons[tipo] || 'ℹ️'}</span><span class="toast-text">${mensaje}</span>`;
    cont.appendChild(el);
    // La animación CSS lo saca tras 2.5s; lo removemos del DOM tras 3s
    setTimeout(() => {
        if (el.parentNode) el.parentNode.removeChild(el);
    }, duracion);
}


        const APP_VERSION = "5.0"; // v5.0: Inteligencia (restricciones, recomendaciones, upsells) + Generador visual

        function checkVersion() {
            const savedVersion = localStorage.getItem('app_version');
            
            // Si la versión guardada es diferente a la actual
            if (savedVersion !== APP_VERSION) {
                console.log("Nueva versión detectada. Actualizando configuración...");

                // 1. Cargar config vieja
                let oldConfig = JSON.parse(localStorage.getItem('vidrios_config')) || {};

                // 2. Guardar nueva versión ANTES de avisar (evita loops de recarga)
                localStorage.setItem('app_version', APP_VERSION);

                // 3. Aviso NO bloqueante (sin alert ni reload, que causaban loop en móviles)
                if (oldConfig.globales) {
                    if (typeof toast === 'function') {
                        setTimeout(() => toast(`App actualizada a la versión ${APP_VERSION}. Revise la configuración.`, 'info', 4000), 800);
                    } else {
                        console.log(`App actualizada a la versión ${APP_VERSION}. Revise la configuración.`);
                    }
                }
            }
        }


        // (La lógica de aluminio/ventanas se movió al módulo independiente al final del script)

        // ==========================================
        // 1. CONFIGURACIÓN Y DATOS (LÓGICA PYTHON TRADUCIDA)
        // ==========================================

        const DEFAULT_CONFIG = {
            globales: {
                precio_vidrio_6mm: 106000.0,
                precio_vidrio_8mm: 135000.0,
                precio_vidrio_10mm: 170000.0,
                colchon_vidrio: 1.05,
                instalacion_base: 70000.0,
                instalacion_L: 100000.0,
                transporte: 70000.0,
                insumos: 15000.0,
                iva: 0.19,
                est_controlada: 100000.0,
                est_empresa: 130000.0,
                util_controlada: 0.15,
                util_empresa: 0.20,
                meta_mensual: 4500000.0,
                desmonte: 20000.0,
                extra_color_negro: 50000.0,
                extra_color_dorado: 200000.0,
                extra_sandblasting_porc: 0.30,
                // Variables ESPEJO
                precio_espejo_m2: 100000.0,
                extra_espejo_led: 50000.0,
                instalacion_espejo: 50000.0,
                transporte_espejo: 40000.0,
                util_espejo: 0.20,
                est_espejo: 40000.0 // Aporte estructura específico para espejos
            },
            productos: {
                "División Batiente (Tradicional)": 135000.0,
                "División Corrediza Clásica": 120000.0,
                "División Corrediza Premium": 220000.0,
                "División de baño L - Corrediza": 235000.0,
                "División de baño L - Batiente": 335000.0,
                "Cortaviento / Oficina": 90000.0,
                "Espejo Flotante": 30000.0
            }
        };

        const LOGICA_ACCESORIOS = {
            "División Batiente (Tradicional)": "FIJO",
            "División Corrediza Clásica": "FIJO",
            "División Corrediza Premium": "FIJO",
            "División de baño L - Corrediza": "FIJO",
            "División de baño L - Batiente": "FIJO",
            "Cortaviento / Oficina": "ANCHO",
            "Espejo Flotante": "FIJO",
        };

        // Variables para cotización múltiple
        // === Persistencia automática del carrito y datos del cliente ===
        const CARRITO_STORAGE_KEY = 'cotizador_carrito_v1';
        const CLIENTE_STORAGE_KEY = 'cotizador_cliente_v1';

        // ============================================================
        // FOLIO / NUMERACIÓN PROFESIONAL DE COTIZACIONES
        // ============================================================
        // Formato: COT-AAAA-NNNN  (ej: COT-2026-0042)
        // - Consecutivo de 4 dígitos que se reinicia cada año.
        // - El número se RESERVA al ver el carrito (solo para mostrar) y solo
        //   se CONSUME (avanza el contador) al pulsar "ENVIAR AL CLIENTE".
        //   Así no se gastan números en cotizaciones que nunca se envían.
        const FOLIO_PREFIX = 'COT';
        const FOLIO_COUNTER_KEY = 'cotizador_folio_counter_v1'; // { "2026": 42, ... }
        const FOLIO_ACTUAL_KEY  = 'cotizador_folio_actual_v1';  // folio reservado del carrito vigente

        function _folioCounters() {
            try { return JSON.parse(localStorage.getItem(FOLIO_COUNTER_KEY)) || {}; }
            catch(e) { return {}; }
        }

        function _folioFormat(anio, n) {
            return `${FOLIO_PREFIX}-${anio}-${String(n).padStart(4, '0')}`;
        }

        // Devuelve el folio que tomaría la PRÓXIMA cotización (sin consumirlo).
        function folioPreview() {
            const anio = new Date().getFullYear();
            const counters = _folioCounters();
            const siguiente = (counters[anio] || 0) + 1;
            return _folioFormat(anio, siguiente);
        }

        // Folio asignado al carrito vigente. Si no hay uno reservado, reserva
        // el siguiente (sin consumir el contador todavía) y lo guarda.
        function folioActual() {
            let actual = '';
            try { actual = localStorage.getItem(FOLIO_ACTUAL_KEY) || ''; } catch(e) {}
            // Si el folio reservado es de un año anterior, lo descartamos.
            const anio = String(new Date().getFullYear());
            if (actual && actual.indexOf(`${FOLIO_PREFIX}-${anio}-`) !== 0) actual = '';
            if (!actual) {
                actual = folioPreview();
                try { localStorage.setItem(FOLIO_ACTUAL_KEY, actual); } catch(e) {}
            }
            return actual;
        }

        // Consume definitivamente el folio actual: avanza el contador del año
        // y libera la reserva para que el siguiente carrito tome un número nuevo.
        function folioConsumir() {
            const folio = folioActual();
            const anio = new Date().getFullYear();
            const counters = _folioCounters();
            counters[anio] = (counters[anio] || 0) + 1;
            try {
                localStorage.setItem(FOLIO_COUNTER_KEY, JSON.stringify(counters));
                localStorage.removeItem(FOLIO_ACTUAL_KEY);
            } catch(e) {}
            return folio;
        }

        // Libera la reserva sin consumir (al vaciar el carrito).
        function folioLiberar() {
            try { localStorage.removeItem(FOLIO_ACTUAL_KEY); } catch(e) {}
        }

        // Cargar carrito guardado al iniciar
        let quoteItems = [];
        try {
            const saved = localStorage.getItem(CARRITO_STORAGE_KEY);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) quoteItems = parsed;
            }
        } catch(e) { console.warn('No se pudo cargar carrito previo:', e); }

        // Guardar carrito automáticamente cada vez que cambie
        function persistirCarrito() {
            try {
                localStorage.setItem(CARRITO_STORAGE_KEY, JSON.stringify(quoteItems));
            } catch(e) { console.warn('No se pudo guardar carrito:', e); }
        }

        // Cliente actual (en memoria + storage)
        let clienteActual = { nombre:'', telefono:'', obra:'', direccion:'' };
        try {
            const savedCli = localStorage.getItem(CLIENTE_STORAGE_KEY);
            if (savedCli) clienteActual = Object.assign(clienteActual, JSON.parse(savedCli));
        } catch(e) {}

        function onClienteChange() {
            clienteActual.nombre    = document.getElementById('cliente-nombre').value.trim();
            clienteActual.telefono  = document.getElementById('cliente-telefono').value.trim();
            clienteActual.obra      = document.getElementById('cliente-obra').value.trim();
            clienteActual.direccion = document.getElementById('cliente-direccion').value.trim();
            try { localStorage.setItem(CLIENTE_STORAGE_KEY, JSON.stringify(clienteActual)); } catch(e){}
            actualizarResumenCliente();
        }

        function actualizarResumenCliente() {
            const sum = document.getElementById('client-summary');
            if (!sum) return;
            const c = clienteActual;
            if (c.nombre || c.obra) {
                let txt = '👤 ' + (c.nombre || 'Sin nombre');
                if (c.obra) txt += ' · ' + c.obra;
                sum.innerText = txt;
                sum.style.color = '#0369a1';
            } else {
                sum.innerText = 'Datos del cliente (opcional)';
            }
        }

        function toggleClienteForm() {
            const f = document.getElementById('client-form');
            const a = document.getElementById('client-arrow');
            const open = f.style.display === 'none' || !f.style.display;
            f.style.display = open ? 'block' : 'none';
            a.style.transform = open ? 'rotate(180deg)' : 'rotate(0deg)';
        }

        function restaurarClienteEnUI() {
            const f = (id) => document.getElementById(id);
            if (!f('cliente-nombre')) return;
            f('cliente-nombre').value    = clienteActual.nombre || '';
            f('cliente-telefono').value  = clienteActual.telefono || '';
            f('cliente-obra').value      = clienteActual.obra || '';
            f('cliente-direccion').value = clienteActual.direccion || '';
            actualizarResumenCliente();
        }

        function limpiarCliente() {
            clienteActual = { nombre:'', telefono:'', obra:'', direccion:'' };
            try { localStorage.removeItem(CLIENTE_STORAGE_KEY); } catch(e){}
            restaurarClienteEnUI();
        }

        // ============================================================
        // LIBRETA DE CLIENTES FRECUENTES
        // ============================================================
        // Guarda clientes recurrentes (nombre, teléfono, obra, dirección) en
        // localStorage. El vendedor los guarda manualmente con un botón y luego
        // los selecciona de un desplegable para no reescribir los datos.
        const CLIENTES_LIBRETA_KEY = 'cotizador_clientes_libreta_v1';

        function _leerLibreta() {
            try {
                const arr = JSON.parse(localStorage.getItem(CLIENTES_LIBRETA_KEY)) || [];
                return Array.isArray(arr) ? arr : [];
            } catch(e) { return []; }
        }

        function _guardarLibreta(arr) {
            try { localStorage.setItem(CLIENTES_LIBRETA_KEY, JSON.stringify(arr)); } catch(e){}
        }

        // Clave de identidad: teléfono normalizado, o nombre en minúsculas si no hay teléfono.
        function _claveCliente(c) {
            const tel = (c.telefono || '').replace(/\D/g, '');
            return tel || ('nombre:' + (c.nombre || '').trim().toLowerCase());
        }

        // Guarda el cliente actual en la libreta (botón "💾 Guardar cliente").
        // Si ya existe (misma clave), actualiza sus datos en lugar de duplicar.
        function guardarClienteEnLibreta() {
            onClienteChange(); // asegura que clienteActual tenga lo último del form
            const c = clienteActual;
            if (!c.nombre && !c.telefono) {
                toast('Escribe al menos nombre o teléfono', 'warn');
                return;
            }
            const libreta = _leerLibreta();
            const clave = _claveCliente(c);
            const nuevo = {
                nombre: c.nombre || '',
                telefono: c.telefono || '',
                obra: c.obra || '',
                direccion: c.direccion || ''
            };
            const idx = libreta.findIndex(x => _claveCliente(x) === clave);
            if (idx >= 0) {
                libreta[idx] = nuevo;
                toast('Cliente actualizado en la libreta', 'success');
            } else {
                libreta.unshift(nuevo);
                toast('Cliente guardado en la libreta', 'success');
            }
            _guardarLibreta(libreta);
            renderLibretaSelect();
        }

        // Carga un cliente de la libreta (por índice) en el formulario actual.
        function seleccionarClienteLibreta(valor) {
            if (valor === '' || valor === null) return;
            const libreta = _leerLibreta();
            const c = libreta[parseInt(valor, 10)];
            if (!c) return;
            clienteActual = {
                nombre: c.nombre || '',
                telefono: c.telefono || '',
                obra: c.obra || '',
                direccion: c.direccion || ''
            };
            try { localStorage.setItem(CLIENTE_STORAGE_KEY, JSON.stringify(clienteActual)); } catch(e){}
            restaurarClienteEnUI();
            // Reset del selector a su placeholder
            const sel = document.getElementById('cliente-libreta-select');
            if (sel) sel.value = '';
            toast(`Cliente cargado: ${c.nombre || c.telefono}`, 'info', 2000);
        }

        // Borra un cliente de la libreta desde el modal de gestión.
        function borrarClienteLibreta(index) {
            const libreta = _leerLibreta();
            if (index < 0 || index >= libreta.length) return;
            const nombre = libreta[index].nombre || libreta[index].telefono || 'cliente';
            libreta.splice(index, 1);
            _guardarLibreta(libreta);
            renderLibretaSelect();
            renderLibretaModal();
            toast(`Eliminado: ${nombre}`, 'info', 2000);
        }

        // Rellena el <select> de clientes frecuentes.
        function renderLibretaSelect() {
            const sel = document.getElementById('cliente-libreta-select');
            if (!sel) return;
            const libreta = _leerLibreta();
            if (libreta.length === 0) {
                sel.innerHTML = '<option value="">— Aún no hay clientes guardados —</option>';
                sel.disabled = true;
                return;
            }
            sel.disabled = false;
            let html = '<option value="">👥 Elegir cliente guardado…</option>';
            libreta.forEach((c, i) => {
                const label = (c.nombre || 'Sin nombre') +
                    (c.obra ? ' · ' + c.obra : '') +
                    (c.telefono ? ' (' + c.telefono + ')' : '');
                html += `<option value="${i}">${label}</option>`;
            });
            sel.innerHTML = html;
        }

        // Modal de gestión (listar/borrar) de clientes guardados.
        function abrirLibretaClientes() {
            renderLibretaModal();
            const m = document.getElementById('modal-libreta');
            if (m) m.style.display = 'block';
        }
        function cerrarLibretaClientes() {
            const m = document.getElementById('modal-libreta');
            if (m) m.style.display = 'none';
        }
        function renderLibretaModal() {
            const cont = document.getElementById('libreta-list');
            if (!cont) return;
            const libreta = _leerLibreta();
            if (libreta.length === 0) {
                cont.innerHTML = '<div style="color:#999; text-align:center; padding:20px;">No hay clientes guardados todavía.</div>';
                return;
            }
            cont.innerHTML = '';
            libreta.forEach((c, i) => {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.style.cssText = 'align-items:center; padding:10px 4px;';
                row.innerHTML = `
                    <div style="font-size:0.9rem; color:#333;">
                        <b>${c.nombre || 'Sin nombre'}</b>
                        ${c.obra ? '<br><span style="color:#666; font-size:0.8rem;">🏠 ' + c.obra + '</span>' : ''}
                        ${c.telefono ? '<br><span style="color:#666; font-size:0.8rem;">📞 ' + c.telefono + '</span>' : ''}
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button onclick="seleccionarClienteLibreta('${i}'); cerrarLibretaClientes();"
                            style="background:none; border:none; cursor:pointer; color:#0891b2; font-size:0.85rem;">📥 Usar</button>
                        <button onclick="borrarClienteLibreta(${i})"
                            style="background:none; border:none; cursor:pointer; color:#c62828; font-size:0.85rem;">🗑️ Borrar</button>
                    </div>
                `;
                cont.appendChild(row);
            });
        }
        let lastCalculation = null;

        // Cargar config del localStorage o usar default
        let currentConfig = JSON.parse(localStorage.getItem('vidrios_config')) || DEFAULT_CONFIG;

        // LIMPIEZA: Eliminar productos obsoletos si existen
        if (currentConfig.productos["División Corrediza (Acero)"]) {
            delete currentConfig.productos["División Corrediza (Acero)"];
        }
        if (currentConfig.productos["Ventanería (Aprox m2)"]) {
            delete currentConfig.productos["Ventanería (Aprox m2)"];
        }
        if (currentConfig.productos["Ventanería (Aluminio)"]) {
            delete currentConfig.productos["Ventanería (Aluminio)"];
        }
        if (currentConfig.productos["División en L (Esquinera)"]) {
            delete currentConfig.productos["División en L (Esquinera)"];
        }
        // v3.0+: Ventanas y puertas se cotizan ahora en el módulo separado de Aluminio.
        // Limpiamos cualquier referencia antigua del listado del cotizador principal.
        [
            "Ventana 5020 (Corrediza Liviana)",
            "Ventana 744 (Corrediza Pesada)",
            "Ventana 744 (Corrediza Tradicional)",
            "Ventana Batiente (Aluminio)",
            "Ventana 3831 (Abatible / Proyectante)",
            "Ventana 3831 (Fija / Cuerpo Fijo)",
            "Puerta 8025 (Corrediza Aluminio)",
            "Ventana Abatible VC3831",
            "Ventana Fija VC3831 (Cuerpo Fijo)",
            "Ventana Corrediza VC5020 (Liviana)",
            "Ventana Corrediza PC744 (Tradicional)",
            "Puerta Corrediza VC8025 (Pesada)"
        ].forEach(k => { if (currentConfig.productos[k] !== undefined) delete currentConfig.productos[k]; });

        // Migración rápida: Si el espejo costaba 20k (valor viejo), actualizar a 30k
        if (currentConfig.productos["Espejo Flotante"] === 20000) {
            currentConfig.productos["Espejo Flotante"] = 30000;
        }
        // Corrección: Si la instalación base aparece en 80000 (posible error de caché), restaurar a 70000
        if (currentConfig.globales && currentConfig.globales.instalacion_base === 80000) {
            currentConfig.globales.instalacion_base = 70000;
        }

        // Sincronizar y REORDENAR productos según DEFAULT_CONFIG
        // Esto asegura que Económica y Premium queden en la posición correcta (2da y 3ra)
        const newProductosOrder = {};
        Object.keys(DEFAULT_CONFIG.productos).forEach(k => {
            newProductosOrder[k] = (currentConfig.productos[k] !== undefined) ? currentConfig.productos[k] : DEFAULT_CONFIG.productos[k];
        });
        currentConfig.productos = newProductosOrder;

        Object.keys(DEFAULT_CONFIG.globales).forEach(k => {
            if (currentConfig.globales[k] === undefined) currentConfig.globales[k] = DEFAULT_CONFIG.globales[k];
        });

        // ==========================================
        // 2. INICIALIZACIÓN UI
        // ==========================================
        function init() {
            checkVersion();
            // Llenar select de productos
            const selProd = document.getElementById('producto');
            Object.keys(currentConfig.productos).forEach(p => {
                let opt = document.createElement('option');
                opt.value = p;
                opt.text = p;
                selProd.appendChild(opt);
            });

            document.getElementById('lbl-desmonte-val').innerText = fmtMoney(currentConfig.globales.desmonte);
            document.getElementById('lbl-led-val').innerText = fmtMoney(currentConfig.globales.extra_espejo_led);
            renderConfigForm();
            renderHistorial();
            verificarProducto();

            // Restaurar UI del cliente y renderizar carrito guardado
            restaurarClienteEnUI();
            renderLibretaSelect();
            if (quoteItems.length > 0) renderQuote();
        }

        function verificarProducto() {
            const prod = document.getElementById('producto').value;
            const esEspejo = prod.includes("Espejo");
            const esLEspecial = prod.includes("División de baño L -");

            // Mostrar/Ocultar opción LED y Espesor según el producto
            document.getElementById('group-espejo-led').style.display = esEspejo ? 'flex' : 'none';
            document.getElementById('group-espesor').style.display = esEspejo ? 'none' : 'block';
            document.getElementById('group-color-acc').style.display = esEspejo ? 'none' : 'block';

            document.getElementById('col-ancho2').style.display = esLEspecial ? 'block' : 'none';
            document.getElementById('lbl-ancho').innerText = esLEspecial ? "Lado 1 (cm)" : "Ancho (cm)";

            // Si el producto NO es tipo L, limpiar ancho2 para que no quede un valor
            // residual oculto (p.ej. 90) que contamine cálculos posteriores.
            if (!esLEspecial) document.getElementById('ancho2').value = '';

            // Si es espejo, desmarcar sandblasting visualmente (opcional)
            if (esEspejo) document.getElementById('check-sandblasting').checked = false;
        }

        // Generar formulario de configuración dinámico
        function renderConfigForm() {
            const div = document.getElementById('config-form');
            div.innerHTML = `
                <div class="tab-container" style="overflow-x: auto; white-space: nowrap; gap: 5px; padding-bottom: 5px;">
                    <button class="tab-btn active" onclick="switchTab('general')">General</button>
                    <button class="tab-btn" onclick="switchTab('divisiones')">Divisiones</button>
                    <button class="tab-btn" onclick="switchTab('espejos')">Espejos</button>
                </div>
                <div id="tab-general" class="tab-content active"></div>
                <div id="tab-divisiones" class="tab-content"></div>
                <div id="tab-espejos" class="tab-content"></div>
            `;

            // Helpers para filtrar productos (las ventanas/puertas ya no aparecen aquí)
            const isEspejo = (k) => k.includes('Espejo');
            const isDivision = (k) => !isEspejo(k);

            // --- TAB 1: GENERAL ---
            const tGen = document.getElementById('tab-general');
            addHeader(tGen, "Vidrios Templados (m²)");
            ['precio_vidrio_6mm', 'precio_vidrio_8mm', 'precio_vidrio_10mm', 'colchon_vidrio'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            addHeader(tGen, "Mano de Obra y Logística");
            ['instalacion_base', 'instalacion_L', 'transporte', 'insumos', 'desmonte'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            addHeader(tGen, "Negocio y Metas");
            ['iva', 'est_controlada', 'est_empresa', 'util_controlada', 'util_empresa', 'meta_mensual'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            // --- TAB 2: DIVISIONES ---
            const tDiv = document.getElementById('tab-divisiones');
            addHeader(tDiv, "Precios Base Productos");
            Object.keys(currentConfig.productos).filter(isDivision).forEach(k => addInputConfig(tDiv, k, currentConfig.productos[k], 'productos'));

            addHeader(tDiv, "Extras y Acabados");
            ['extra_color_negro', 'extra_color_dorado', 'extra_sandblasting_porc'].forEach(k => addInputConfig(tDiv, k, currentConfig.globales[k], 'globales'));

            // --- TAB 3: ESPEJOS ---
            const tEsp = document.getElementById('tab-espejos');
            addHeader(tEsp, "Precios Base Productos");
            Object.keys(currentConfig.productos).filter(isEspejo).forEach(k => addInputConfig(tEsp, k, currentConfig.productos[k], 'productos'));

            addHeader(tEsp, "Costos y Variables");
            ['precio_espejo_m2', 'extra_espejo_led', 'instalacion_espejo', 'transporte_espejo', 'est_espejo', 'util_espejo'].forEach(k => addInputConfig(tEsp, k, currentConfig.globales[k], 'globales'));
        }

        function addHeader(parent, text) {
            let h = document.createElement('div');
            h.className = 'card-title';
            h.innerText = text;
            h.style.marginTop = '20px';
            parent.appendChild(h);
        }

        function addInputConfig(parent, key, val, section) {
            let group = document.createElement('div');
            group.className = 'form-group';

            let label = document.createElement('label');
            // Limpiar nombres de variables para que se vean bonitos
            label.innerText = key.replace(/_/g, ' ').toUpperCase();

            let inp = document.createElement('input');
            inp.type = 'number';
            inp.value = val;
            inp.id = `cfg_${section}_${key}`;

            group.appendChild(label);
            group.appendChild(inp);
            parent.appendChild(group);
        }

        function switchTab(tabName) {
            document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
            document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

            document.getElementById(`tab-${tabName}`).classList.add('active');

            // Activar botón correspondiente
            const btns = document.querySelectorAll('.tab-btn');
            btns.forEach(btn => {
                if (btn.getAttribute('onclick').includes(tabName)) btn.classList.add('active');
            });
        }

        // ==========================================
        // 3. LÓGICA DE NEGOCIO (EL CEREBRO)
        // ==========================================
        function calcular() {
            // Inputs
            let ancho = parseFloat(document.getElementById('ancho').value);
            let ancho2 = parseFloat(document.getElementById('ancho2').value) || 0;
            let alto = parseFloat(document.getElementById('alto').value);

            if (!ancho || !alto) {
                toast('Falta ingresar Ancho y Alto', 'warn'); return;
            }

            // Validación: Si escriben valores muy pequeños (ej: 1.2), probablemente pensaron en metros
            if (ancho < 10 || alto < 10) {
                if (!confirm(`Las dimensiones ingresadas (${ancho}cm x ${alto}cm) parecen muy pequeñas. ¿Estás seguro que son CENTÍMETROS y no metros?`)) return;
            }

            // Convertir CM a Metros para el cálculo interno
            ancho = ancho / 100;
            ancho2 = ancho2 / 100;
            alto = alto / 100;

            const prodNombre = document.getElementById('producto').value;
            const espesor = document.getElementById('espesor').value;
            const linea = document.getElementById('linea').value; // controlada / empresa
            const mercado = parseFloat(document.getElementById('mercado').value) || 0;
            const colorAcc = document.getElementById('color_acc').value;
            const tieneDesmonte = document.getElementById('check-desmonte').checked;
            const tieneSandblasting = document.getElementById('check-sandblasting').checked;
            const tieneLed = document.getElementById('check-espejo-led').checked;
            const recargoTransporte = parseFloat(document.getElementById('recargo_transporte').value) || 0;
            const extraAcc = parseFloat(document.getElementById('extra_acc').value) || 0;
            const descuentoAdicional = parseFloat(document.getElementById('descuento_adicional').value) || 0;
            const observaciones = document.getElementById('observaciones').value;

            const cfg = currentConfig.globales;
            
            const esLEspecial = prodNombre.includes("División de baño L -");
            let anchoCalculo = ancho;
            if (esLEspecial) anchoCalculo += ancho2;

            const area = anchoCalculo * alto;
            const esEspejo = prodNombre.includes("Espejo");

            // 1. Costo Vidrio
            let costoVidrioBase = 0;

            if (esEspejo) {
                // Lógica ESPEJO
                costoVidrioBase = cfg.precio_espejo_m2;
            } else {
                // Lógica VIDRIO TEMPLADO
                if (espesor === '6mm') costoVidrioBase = cfg.precio_vidrio_6mm;
                else if (espesor === '10mm') costoVidrioBase = cfg.precio_vidrio_10mm;
                else costoVidrioBase = cfg.precio_vidrio_8mm; // 8mm default

                // Aumento por Sandblasting (Porcentaje sobre el costo del vidrio)
                if (tieneSandblasting) {
                    costoVidrioBase = costoVidrioBase * (1 + cfg.extra_sandblasting_porc);
                }
            }

            // Aplica desperdicio (colchon) tanto a vidrio como a espejo
            const costoVidrioTotal = area * costoVidrioBase * cfg.colchon_vidrio;

            // 2. Accesorios
            let costoAluminio = 0;
            let costoLed = 0;
            let baseAcc = currentConfig.productos[prodNombre];

            // Ajuste por Color
            if (!esEspejo) {
                if (colorAcc === 'negro') baseAcc += cfg.extra_color_negro;
                if (colorAcc === 'dorado') baseAcc += cfg.extra_color_dorado;
            }

            const logica = LOGICA_ACCESORIOS[prodNombre] || "FIJO";
            let costoAcc = baseAcc;

            if (logica === "ANCHO") costoAcc = baseAcc * ancho;
            if (logica === "AREA") costoAcc = baseAcc * area;

            // Recargo Accesorios por medida grande (>150cm) SOLO CORREDIZAS
            const esCorrediza = prodNombre.toLowerCase().includes('corrediza');
            if (esCorrediza && ancho > 1.5) {
                costoAcc += 50000.0;
            }

            // Extra LED para Espejo
            if (esEspejo && tieneLed) {
                costoLed = cfg.extra_espejo_led;
            }

            // Sumar extras manuales (bisagras, soportes, etc)
            costoAcc += extraAcc;

            // 3. Otros Costos Directos
            const costoDesmonte = tieneDesmonte ? cfg.desmonte : 0;

            let costoInstalacion = 0;
            let costoTransporte = 0;

            if (esEspejo) {
                costoInstalacion = cfg.instalacion_espejo;
                costoTransporte = cfg.transporte_espejo;
            } else if (esLEspecial) {
                costoInstalacion = cfg.instalacion_L;
                costoTransporte = cfg.transporte;
            } else {
                costoInstalacion = cfg.instalacion_base;
                costoTransporte = cfg.transporte;
                // Ajuste: Si el ancho es mayor a 150cm (1.5m), la instalación sube a 100.000
                if (ancho > 1.5) {
                    costoInstalacion = Math.max(costoInstalacion, 100000.0);
                }
            }

            const costoInsumos = cfg.insumos;
            const otros = costoInstalacion + costoTransporte + costoInsumos + costoDesmonte;
            const costoDirecto = costoVidrioTotal + costoAcc + costoAluminio + costoLed + otros;

            // 4. Estructura y Utilidad
            let est = 0;
            let utilPorcentaje = 0;

            if (esEspejo) {
                // Espejo tiene su propia utilidad y usa estructura empresa (o la que definas)
                est = cfg.est_espejo;
                utilPorcentaje = cfg.util_espejo;
            } else if (linea === 'controlada') {
                est = cfg.est_controlada;
                utilPorcentaje = cfg.util_controlada;
            } else {
                est = cfg.est_empresa;
                utilPorcentaje = cfg.util_empresa;
            }

            const totalCostos = costoDirecto + est;

            // FÓRMULA CLAVE: Margen sobre Venta
            let precioSinIva = totalCostos / (1 - utilPorcentaje);
            let precioFinal = precioSinIva * (1 + cfg.iva);

            // Aumento general del 5% sobre el precio final (IVA incluido)
            precioFinal *= 1.05;
            precioSinIva = precioFinal / (1 + cfg.iva);

            // Descuento Adicional
            if (descuentoAdicional > 0) {
                precioFinal -= descuentoAdicional;
                precioSinIva = precioFinal / (1 + cfg.iva);
            }

            const ganancia = precioSinIva - totalCostos;

            // Margen Real
            const margen = (ganancia / precioSinIva) * 100;

            const medidasStr = esLEspecial ? 
                `L(${Math.round(ancho * 100)}+${Math.round(ancho2 * 100)})x${Math.round(alto * 100)}` : 
                `${Math.round(ancho * 100)}x${Math.round(alto * 100)}`;

            // Guardar cálculo actual para agregar a lista
            lastCalculation = {
                producto: prodNombre,
                medidas: medidasStr,
                vidrio: esEspejo ? 'Espejo' : espesor,
                sandblasting: tieneSandblasting,
                color: colorAcc,
                precio: precioFinal, // Precio final con IVA incluido (el que se cobra al cliente)
                observaciones: observaciones,
                // Datos crudos para edición
                raw: {
                    ancho: Math.round(ancho * 100),
                    ancho2: Math.round(ancho2 * 100),
                    alto: Math.round(alto * 100),
                    producto: prodNombre,
                    espesor: espesor,
                    linea: linea,
                    mercado: mercado,
                    color_acc: colorAcc,
                    desmonte: tieneDesmonte,
                    led: tieneLed,
                    sandblasting: tieneSandblasting,
                    recargo: recargoTransporte,
                    extra: extraAcc,
                    descuento: descuentoAdicional,
                    observaciones: observaciones
                }
            };

            // Guardar en Historial
            guardarHistorial({
                producto: prodNombre,
                medidas: medidasStr,
                precio: precioFinal,
                fecha: new Date()
            });

            // Registrar también en el historial del dashboard (no rompe nada si no está cargado)
            if (typeof dash_registrar === 'function') {
                dash_registrar({
                    producto: prodNombre,
                    medidas: medidasStr,
                    precio: precioFinal,
                    fecha: new Date(),
                    origen: 'principal'
                });
            }

            const detalles = {
                vidrio: costoVidrioTotal,
                aluminio: costoAluminio,
                accesorios: costoAcc,
                led: costoLed,
                instalacion: costoInstalacion,
                transporte: costoTransporte,
                insumos: costoInsumos,
                desmonte: costoDesmonte,
                estructura: est,
                ganancia: ganancia,
                descuento: descuentoAdicional,
                espesorLabel: esEspejo ? 'Espejo' : espesor
            };

            mostrarResultados(precioFinal, precioSinIva, detalles, margen, mercado);

            // IQ v5.0: análisis inteligente post-cálculo (no rompe nada si iq.js no carga)
            if (typeof iq_analizarPrincipal === 'function') iq_analizarPrincipal();
        }

        function mostrarResultados(final, neto, d, mar, mercado) {
            document.getElementById('res-precio-neto').innerText = fmtMoney(neto);
            document.getElementById('res-precio-final').innerText = "Total con IVA: " + fmtMoney(final);

            // Resetear vista a oculto por privacidad cada vez que se calcula
            document.getElementById('financial-details').style.display = 'none';
            document.getElementById('res-margen-container').style.display = 'none';
            document.getElementById('btn-toggle-desglose').innerText = '🙈';

            const lista = document.getElementById('desglose-lista');
            lista.innerHTML = '';

            const addRow = (label, val, isBold = false) => {
                if (val <= 0) return;
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span>${label}</span> <span class="detail-val" style="${isBold ? 'font-weight:bold' : ''}">${fmtMoney(val)}</span>`;
                lista.appendChild(row);
            };

            addRow(`Material: ${d.espesorLabel}`, d.vidrio);
            if (d.aluminio > 0) addRow("Perfilería Aluminio", d.aluminio);
            if (d.accesorios > 0) addRow("Accesorios / Kit", d.accesorios);
            if (d.led > 0) addRow("Sistema LED", d.led);

            addRow("Instalación", d.instalacion);
            addRow("Transporte", d.transporte);
            if (d.desmonte > 0) addRow("Desmonte", d.desmonte);
            addRow("Insumos (Silicona/Tornillos)", d.insumos);

            addRow("Aporte Estructura (Fijo)", d.estructura);

            if (d.descuento > 0) {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span style="color:#c62828;">Descuento Adicional</span> <span class="detail-val" style="color:#c62828;">-${fmtMoney(d.descuento)}</span>`;
                lista.appendChild(row);
            }

            document.getElementById('res-ganancia').innerText = fmtMoney(d.ganancia);
            document.getElementById('res-margen').innerText = mar.toFixed(1) + "%";

            // Lógica de Comparación con Competencia
            const divComp = document.getElementById('res-comparacion');
            if (mercado > 0) {
                const diff = final - mercado;
                const diffPorc = (diff / mercado) * 100;
                let msg = "", color = "";

                if (diff > 0) {
                    msg = `⚠️ $${diff.toLocaleString('es-CO', { maximumFractionDigits: 0 })} (+${diffPorc.toFixed(1)}%) vs Mercado`;
                    color = "#c62828"; // Rojo
                } else {
                    msg = `✅ Ahorro: $${Math.abs(diff).toLocaleString('es-CO', { maximumFractionDigits: 0 })} (-${Math.abs(diffPorc).toFixed(1)}%) vs Mercado`;
                    color = "#2e7d32"; // Verde
                }
                divComp.innerHTML = `<span style="color:${color}; font-weight:700;">${msg}</span>`;
                divComp.style.display = 'block';
            } else {
                divComp.style.display = 'none';
            }

            // Semáforo
            const badge = document.getElementById('res-badge');
            badge.className = 'metric-badge';
            if (mar >= 18) {
                badge.innerText = "RENTABLE";
                badge.classList.add('bg-ok');
            } else if (mar >= 12) {
                badge.innerText = "ACEPTABLE";
                badge.classList.add('bg-warn');
            } else {
                badge.innerText = "RIESGO";
                badge.classList.add('bg-bad');
            }

            const panel = document.getElementById('resultado-panel');

            // Reiniciar animación para que se ejecute siempre
            panel.classList.remove('animate-result');
            void panel.offsetWidth; // Forzar reflow del navegador
            panel.classList.add('animate-result');

            panel.style.display = 'block';
            // Scroll suave al resultado
            panel.scrollIntoView({ behavior: 'smooth' });
        }

        function compartir() {
            const prod = document.getElementById('producto').value;
            const ancho = document.getElementById('ancho').value;
            const ancho2 = document.getElementById('ancho2').value;
            const alto = document.getElementById('alto').value;
            const esp = document.getElementById('espesor').value;
            const color = document.getElementById('color_acc').value;
            const tieneSandblasting = document.getElementById('check-sandblasting').checked;
            const tieneLed = document.getElementById('check-espejo-led').checked;
            const neto = document.getElementById('res-precio-neto').innerText;
            const total = document.getElementById('res-precio-final').innerText.replace('Total con IVA: ', '');

            // Lógica de Garantía (12 meses para clásica, 18 para el resto)
            const esClasica = prod.toLowerCase().includes('clásica') || prod.toLowerCase().includes('clasica');
            const garantia = esClasica ? "12 meses" : "18 meses";

            let txtVidrio = esp;
            if (prod.includes("Espejo")) {
                txtVidrio = "Espejo 4mm/5mm";
                if (tieneLed) txtVidrio += " + LUZ LED ✨";
            } else if (tieneSandblasting) {
                txtVidrio += " + SANDBLASTING";
            }

            let medidasTxt = `${ancho} x ${alto} cm`;
            if (prod.includes("División de baño L -")) {
                medidasTxt = `L(${ancho} + ${ancho2}) x ${alto} cm`;
            }

            // Usamos códigos Unicode para los emojis para evitar errores de codificación (rombos negros)
            let texto = `*COTIZACIÓN* \uD83D\uDCC4
----------------------------
\uD83D\uDD39 *Sistema:* ${prod}
\uD83D\uDD39 *Medidas:* ${medidasTxt}
\uD83D\uDD39 *Vidrio:* ${txtVidrio}`;

            if (!prod.includes("Espejo")) {
                texto += `\n\uD83D\uDD39 *Acabado:* ${color.toUpperCase()}`;
            }

            texto += `\n\n\u2705 *INCLUYE:*
Accesorios en acero inoxidable 304, vidrio templado de seguridad certificado, transporte, instalación y garantía escrita por ${garantia}.

\uD83D\uDCB0 *Precio:* ${total} (IVA incluido)
----------------------------`;

            // IQ v5.0: a\u00F1adir las sugerencias opcionales que el vendedor haya marcado
            if (typeof iq_getSugerenciasWAText === 'function') {
                texto += iq_getSugerenciasWAText('main');
            }

            // Copiar al portapapeles y abrir WhatsApp
            navigator.clipboard.writeText(texto).then(() => toast('Texto copiado al portapapeles', 'info', 2000)).catch(err => console.error('Error al copiar', err));
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
        }

        function fmtMoney(num) {
            return "$" + num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
        }

        // ==========================================
        // 4. FUNCIONES DEL SISTEMA
        // ==========================================
        // Pizarra limpia para el SIGUIENTE ítem: borra solo medidas y datos
        // puntuales de esta cotización, pero CONSERVA producto, espesor, color,
        // línea y extras (checkboxes). La usa agregarItem() para cotizar varias
        // piezas iguales sin reseleccionar todo cada vez.
        function limpiarMedidas() {
            lastCalculation = null;
            document.getElementById('ancho').value = '';
            document.getElementById('ancho2').value = '';
            document.getElementById('alto').value = '';
            document.getElementById('mercado').value = '';
            document.getElementById('recargo_transporte').value = '';
            document.getElementById('extra_acc').value = '';
            document.getElementById('descuento_adicional').value = '';
            document.getElementById('observaciones').value = '';
            if (document.getElementById('cantidad-item')) document.getElementById('cantidad-item').value = '1';
            // Se conservan: producto, espesor, color_acc, linea y checkboxes (extras).
            document.getElementById('resultado-panel').style.display = 'none';

            document.getElementById('estrategia-content').style.display = 'none';
            document.getElementById('arrow-estrategia').style.transform = 'rotate(0deg)';

            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        // Reset COMPLETO del formulario (botón manual "LIMPIAR"): vuelve todo a
        // sus valores por defecto, incluyendo producto, espesor, color, línea y extras.
        function limpiarTodo() {
            limpiarMedidas();
            document.getElementById('producto').selectedIndex = 0;
            document.getElementById('espesor').selectedIndex = 0;
            document.getElementById('color_acc').selectedIndex = 0;
            document.getElementById('linea').selectedIndex = 0;
            document.getElementById('check-desmonte').checked = false;
            document.getElementById('check-sandblasting').checked = false;
            document.getElementById('check-espejo-led').checked = false;
            verificarProducto();
        }

        // Alias retrocompatible: cualquier llamada antigua a limpiar() = reset completo.
        function limpiar() { limpiarTodo(); }

        function guardarHistorial(item) {
            let historial = JSON.parse(localStorage.getItem('vidrios_historial')) || [];

            // Formato de fecha corto
            const fechaStr = item.fecha.toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
            item.fechaStr = fechaStr;

            // Agregar al inicio
            historial.unshift(item);

            // Mantener solo 5
            if (historial.length > 5) historial.pop();

            localStorage.setItem('vidrios_historial', JSON.stringify(historial));
            renderHistorial();
        }

        function renderHistorial() {
            const list = document.getElementById('historial-list');
            const historial = JSON.parse(localStorage.getItem('vidrios_historial')) || [];

            list.innerHTML = historial.length ? '' : '<div style="color:#999; font-size:0.9rem; text-align:center; padding:10px;">Sin historial reciente</div>';

            historial.forEach(h => {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `
                    <div style="font-size:0.85rem; color:#333;"><b>${h.producto}</b><br><span style="color:#666; font-size:0.75rem;">${h.medidas} cm | ${h.fechaStr}</span></div>
                    <div style="font-weight:bold; color:var(--accent-blue);">${fmtMoney(h.precio)}</div>
                `;
                list.appendChild(row);
            });
        }

        function abrirConfig() { document.getElementById('modal-config').style.display = 'block'; }
        function cerrarConfig() { document.getElementById('modal-config').style.display = 'none'; }

        function guardarConfig() {
            // Leer inputs y actualizar currentConfig
            for (const [key] of Object.entries(currentConfig.globales)) {
                let val = parseFloat(document.getElementById(`cfg_globales_${key}`).value);
                if (!isNaN(val)) currentConfig.globales[key] = val;
            }
            for (const [key] of Object.entries(currentConfig.productos)) {
                let val = parseFloat(document.getElementById(`cfg_productos_${key}`).value);
                if (!isNaN(val)) currentConfig.productos[key] = val;
            }

            localStorage.setItem('vidrios_config', JSON.stringify(currentConfig));
            toast('Configuración guardada', 'success');
            cerrarConfig();
            document.getElementById('lbl-desmonte-val').innerText = fmtMoney(currentConfig.globales.desmonte);
            // Recargar para aplicar cambios en selects si hubo cambios
            location.reload();
        }

        function toggleEstrategia() {
            const content = document.getElementById('estrategia-content');
            const arrow = document.getElementById('arrow-estrategia');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                arrow.style.transform = 'rotate(180deg)';
            } else {
                content.style.display = 'none';
                arrow.style.transform = 'rotate(0deg)';
            }
        }

        function toggleDesglose(btn) {
            const details = document.getElementById('financial-details');
            const margin = document.getElementById('res-margen-container');
            if (details.style.display === 'none') {
                details.style.display = 'block';
                margin.style.display = 'block';
                btn.innerText = '👁️';
            } else {
                details.style.display = 'none';
                margin.style.display = 'none';
                btn.innerText = '🙈';
            }
        }

        function restaurarFabrica() {
            if (confirm('¿Estás seguro de restaurar TODOS los valores a la configuración original de fábrica? Se perderán tus precios personalizados.')) {
                localStorage.removeItem('vidrios_config');
                toast('Configuración restaurada — recarga la app', 'success', 4000);
                location.reload();
            }
        }

        // ==========================================
        // 5. FUNCIONES DE COTIZACIÓN MÚLTIPLE
        // ==========================================
        function agregarItem() {
            if (!lastCalculation) return;

            const qty = parseInt(document.getElementById('cantidad-item').value) || 1;
            let itemToAdd = { ...lastCalculation };
            itemToAdd.cantidad = qty;
            itemToAdd.precioUnitario = itemToAdd.precio;
            itemToAdd.precio = itemToAdd.precio * qty;

            quoteItems.push(itemToAdd);
            persistirCarrito();
            renderQuote();
            toast(`Agregado: ${itemToAdd.producto}`, 'success');

            // Pizarra limpia de medidas para el siguiente item, conservando
            // producto, espesor, color, línea y extras.
            limpiarMedidas();
        }

        function renderQuote() {
            const container = document.getElementById('quote-summary');
            const list = document.getElementById('quote-items-list');
            const count = document.getElementById('quote-count');
            const totalLbl = document.getElementById('quote-total');

            if (quoteItems.length === 0) {
                container.style.display = 'none';
                document.getElementById('quote-discount').value = '';
                return;
            }

            container.style.display = 'block';
            // Mostrar el folio reservado para este carrito
            const folioEl = document.getElementById('quote-folio');
            if (folioEl) folioEl.innerText = '#' + folioActual();
            list.innerHTML = '';

            quoteItems.forEach((item, index) => {
                const row = document.createElement('div');
                row.className = 'quote-card-item';

                let qtyBadge = item.cantidad > 1 ? `<span style="background:#e3f2fd; color:#1565c0; padding:2px 6px; border-radius:4px; font-size:0.8em; margin-left:5px;">x${item.cantidad}</span>` : '';
                let obsHtml = item.observaciones ? `<div style="color:#d32f2f; font-style:italic; margin-top:4px;">📝 ${item.observaciones}</div>` : '';
                let ledHtml = (item.raw && item.raw.led) ? `<span style="color:#fbc02d; font-weight:bold; margin-left:5px;">+ LED ✨</span>` : '';
                let aluBadge = item.esAluminio ? `<span style="background:#fef3c7; color:#92400e; padding:2px 6px; border-radius:4px; font-size:0.7em; margin-left:5px; font-weight:700;">🪟 ALU</span>` : '';

                // Línea de detalles distinta según el tipo de producto
                let detallesLinea;
                if (item.esAluminio) {
                    const colorLbl = (item.raw && item.raw.color)
                        ? (ALU_COLOR_LABELS[item.raw.color] || item.raw.color)
                        : 'Natural';
                    detallesLinea = `📏 ${item.medidas} cm | 💎 ${item.vidrio} | 🎨 Aluminio ${colorLbl}`;
                } else {
                    const colorTxt = item.color || '';
                    detallesLinea = `📏 ${item.medidas} cm | 💎 ${item.vidrio} ${item.sandblasting ? '+ Sand' : ''} ${ledHtml} | 🎨 ${colorTxt}`;
                }

                row.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div class="quote-prod-name">${index + 1}. ${item.producto} ${qtyBadge} ${aluBadge}</div>
                        <div style="font-weight:bold; color:var(--accent-blue); font-size:1.1rem;">${fmtMoney(item.precio)}</div>
                    </div>
                    <div class="quote-details">
                        ${detallesLinea}
                        ${obsHtml}
                    </div>
                    <div style="text-align:right; margin-top:8px; padding-top:8px; border-top:1px dashed #eee;">
                        <button onclick="editarItem(${index})" style="background:none; border:none; cursor:pointer; margin-right:12px; color:#666; font-size:0.88rem;">
                            ✏️ Editar
                        </button>
                        <button onclick="duplicarItem(${index})" style="background:none; border:none; cursor:pointer; margin-right:12px; color:#0891b2; font-size:0.88rem;">
                            📎 Duplicar
                        </button>
                        <button onclick="borrarItem(${index})" style="background:none; border:none; cursor:pointer; color:#c62828; font-size:0.88rem;">
                            🗑️ Borrar
                        </button>
                    </div>
                `;
                list.appendChild(row);
            });

            count.innerText = quoteItems.length;
            actualizarTotalCotizacion();
        }

        function actualizarTotalCotizacion() {
            let total = quoteItems.reduce((sum, item) => sum + item.precio, 0);
            let discount = parseFloat(document.getElementById('quote-discount').value) || 0;
            let final = total - discount;
            document.getElementById('quote-total').innerText = fmtMoney(final);
        }

        // borrarItem(index)            → borrado del usuario, muestra "Deshacer" 5s
        // borrarItem(index, true)      → borrado interno (editar/mover), sin toast
        function borrarItem(index, silencioso = false) {
            const eliminado = quoteItems[index];
            quoteItems.splice(index, 1);
            persistirCarrito();
            renderQuote();
            if (silencioso || !eliminado) return;
            _mostrarUndoBorrado(eliminado, index);
        }

        // Toast con botón "Deshacer" (5 seg). Evita borrados accidentales en móvil.
        function _mostrarUndoBorrado(item, index) {
            const cont = document.getElementById('toast-container');
            if (!cont) { return; }
            const el = document.createElement('div');
            el.className = 'toast info';
            // Sin toastOut automático: lo controlamos manualmente a los 5s.
            el.style.animation = 'toastIn 0.25s ease-out';
            el.innerHTML = `<span class="toast-icon">🗑️</span><span class="toast-text">Ítem eliminado</span>`;

            const btn = document.createElement('button');
            btn.type = 'button';
         