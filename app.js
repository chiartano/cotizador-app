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


        const APP_VERSION = "5.1"; // v5.1: Mejoras en la interfaz y optimizaciones de rendimiento

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
                extra_color_dorado: 200000.0, // también el oro rosa (ficha, 2026-11-20)
                // B8 (2026-11-23), de las fichas:
                est_premium: 150000.0, // estructura de la premium en línea controlada (D2)
                kit_clasica_a1b: 180000.0, // kit de la clásica en 8 mm desde 120 cm y en 10 mm (A1b)
                precio_sandblasting_menor_140: 70000.0, // al cliente, IVA incluido (V9)
                precio_sandblasting_desde_140: 100000.0, // al cliente, 140 cm o más, o L (V10)
                // Variables ESPEJO
                precio_espejo_m2: 100000.0,
                extra_espejo_led: 50000.0,
                instalacion_espejo: 50000.0,
                transporte_espejo: 40000.0,
                util_espejo: 0.20,
                est_espejo: 40000.0, // Aporte estructura específico para espejos
                // Vidrios especiales: costo por m2 del proveedor, IVA incluido (Andrés, 2026-11-19)
                precio_vidrio_serigrafia_6mm: 250000.0,
                precio_vidrio_serigrafia_negra_8mm: 310000.0,
                precio_vidrio_laminado_4_4: 430000.0,
                precio_vidrio_negro_6mm: 170000.0,
                precio_vidrio_5mm: 80000.0, // templado 5 mm, para tiras
                // Accesorios: costo por unidad en acero natural
                acc_bisagra_muro: 35000.0,
                acc_bisagra_vidrio_vidrio: 70000.0,
                acc_boton: 15000.0,
                acc_tubo_terminales_carro: 120000.0, // tubo superior, 2 terminales y carro guía (negro: 140.000)
                acc_extra_negro_pieza: 5000.0, // recargo negro por pieza pequeña
                acc_extra_negro_tubo_carro: 20000.0, // recargo negro del tubo y el carro
                acc_perfil_u_6m: 20000.0, // tira de perfil U de 6 m
                // Piezas sueltas para el vidrio de reemplazo (AP2, 2026-11-23), costo en natural
                acc_mariposa: 25000.0,
                acc_manija_vertical: 40000.0, // de 2 perforaciones
                acc_deslizantes_par: 50000.0,
                acc_deslizantes_par_superior: 85000.0, // de mejor calidad
                acc_medias_lunas_par: 15000.0,
                acc_terminales_freno_par: 15000.0, // par de terminales con su freno
                acc_tubo_m: 15000.0, // tubo superior, por metro
                acc_riel_m: 15000.0, // riel inferior, por metro
                acc_guia: 10000.0, // guía inferior acrílica
                acc_burbuja: 10000.0, // de 2 m
                acc_barredor: 10000.0, // de 2 m
                acc_boquete: 15000.0,
                acc_l_fija: 30000.0,
                // Recargo por pieza suelta en dorado u oro rosa (Andrés, 2026-11-24); en negro, acc_extra_negro_pieza
                acc_extra_dorado_pieza: 22000.0,
                // Instalación sola con accesorios del cliente: precio al cliente, IVA incluido (ficha S3)
                precio_instalacion_sola: 140000.0,
                // Vidrio de reemplazo (ficha M1): sin kit ni estructura, transporte propio
                transporte_reemplazo: 50000.0,
                // Espejo que va con otro trabajo (ficha E1): sin transporte y con este aporte
                est_espejo_con_otro_trabajo: 20000.0,
                // Adicionales que van en la misma visita
                instalacion_adicional: 0, // mano de obra extra por tira; hoy cada tira paga sus insumos ($15.000)
                precio_repisa_6mm: 60000.0, // precio al cliente, IVA incluido
                // Margen propio sobre la venta sin IVA (Andrés, 2026-11-19):
                // precio = costo total x (1 + IVA) / (1 - margen)
                margen_plegable: 0.15,
                margen_panel_fijo: 0.20,
                margen_tiras: 0.30
            },
            productos: {
                "División Batiente (Tradicional)": 135000.0,
                "División Corrediza Clásica": 120000.0,
                "División Corrediza Premium": 280000.0, // Andrés, 2026-11-19 y 2026-11-21 (antes 220.000)
                "División de baño L - Corrediza": 235000.0,
                "División de baño L - Batiente": 335000.0,
                "División de baño L - Corrediza premium": 0, // ficha D13: kit premium × 1,05 (1 puerta) o 2 kits (2 puertas)
                "División neoangular": 335000.0, // ficha D11: el kit de la L batiente (B8, 2026-11-24)
                // Los siguientes calculan su kit con los accesorios de Configuración → Especiales.
                "División de baño plegable (2 hojas)": 0,
                "Panel fijo piso a techo (perfil U)": 0,
                "Vidrio de reemplazo para división": 0, // ficha M1: piezas sueltas, sin kit
                "Instalación sola de división (accesorios del cliente)": 0, // ficha S3: precio fijo
                "Cortaviento / Oficina": 90000.0,
                "Espejo Flotante": 30000.0,
                "Tiras de vidrio 5 mm (adicional)": 0,
                "Repisa de vidrio 6 mm (hasta 30 cm)": 0
            }
        };

        // Kit premium: valor de la app para todos los teléfonos (B2, 2026-11-21).
        // Cada teléfono guarda su configuración en `vidrios_config`; esto decide
        // qué pasa con el valor que ya tiene guardado. Corre una sola vez: la
        // marca `KIT_PREMIUM.marca` queda puesta cuando el teléfono ya está al día
        // o cuando alguien revisó Configuración y tocó Guardar.
        const KIT_PREMIUM = {
            producto: "División Corrediza Premium",
            viejo: 220000,
            nuevo: 280000,
            marca: 'wilan_kit_premium_280000'
        };
        function migrarKitPremium(config, storage) {
            const leer = (k) => { try { return storage.getItem(k); } catch (_) { return null; } };
            const escribir = (k, v) => { try { storage.setItem(k, v); } catch (_) { /* sin espacio: se reintenta al abrir */ } };
            if (!config || !config.productos || leer(KIT_PREMIUM.marca)) return null;
            const actual = config.productos[KIT_PREMIUM.producto];
            if (actual === undefined || actual === KIT_PREMIUM.nuevo) {
                escribir(KIT_PREMIUM.marca, 'al-dia');
                return null;
            }
            if (actual === KIT_PREMIUM.viejo) {
                config.productos[KIT_PREMIUM.producto] = KIT_PREMIUM.nuevo;
                try {
                    const guardado = JSON.parse(leer('vidrios_config') || 'null');
                    if (guardado && guardado.productos) {
                        guardado.productos[KIT_PREMIUM.producto] = KIT_PREMIUM.nuevo;
                        escribir('vidrios_config', JSON.stringify(guardado));
                    }
                } catch (_) { /* configuración ilegible: el valor nuevo vale en memoria */ }
                escribir(KIT_PREMIUM.marca, 'actualizado');
                return { tipo: 'actualizado' };
            }
            // Otro valor puesto a mano: no se pisa. Se avisa hasta que alguien
            // revise Configuración y toque Guardar.
            return { tipo: 'distinto', valor: actual };
        }
        function textoAvisoKitPremium(aviso) {
            if (!aviso || aviso.tipo !== 'distinto') return '';
            return `Kit de la corrediza premium: este teléfono tiene ${fmtMoney(aviso.valor)} puesto a mano. `
                + `El valor nuevo de la app es ${fmtMoney(KIT_PREMIUM.nuevo)}. `
                + `Revísalo en Configuración → Divisiones y toca Guardar.`;
        }

        // ==========================================
        // FICHAS DE PRODUCTO (B8, 2026-11-23)
        // ==========================================
        // Valores de Configuración que salen de una ficha confirmada por Andrés
        // (docs/catalogo-maestro/fichas/: 01-vidrios, 02-accesorios y 03-divisiones).
        // El valor está en DEFAULT_CONFIG; aquí se dice de qué fila de la ficha sale.
        // Lo que no tiene ficha confirmada (espejo, repisa, cortaviento, desmonte,
        // mano de obra de las tiras, meta) sigue como antes: solo en Configuración.
        // Repositorio público: costos sí, nombres de proveedores no (Andrés, 2026-11-23).
        const FICHAS = {
            version: '2026-11-23',
            globales: {
                precio_vidrio_6mm: 'V1', precio_vidrio_8mm: 'V2', precio_vidrio_10mm: 'V3',
                precio_vidrio_5mm: 'V4', precio_vidrio_serigrafia_6mm: 'V5',
                precio_vidrio_serigrafia_negra_8mm: 'V6', precio_vidrio_laminado_4_4: 'V7',
                precio_vidrio_negro_6mm: 'V8',
                precio_sandblasting_menor_140: 'V9', precio_sandblasting_desde_140: 'V10',
                colchon_vidrio: 'D0', instalacion_base: 'D0', instalacion_L: 'D0', transporte: 'D0',
                insumos: 'A33', iva: 'D0',
                est_controlada: 'D0', est_empresa: 'D0', est_premium: 'D2',
                util_controlada: 'D0', util_empresa: 'D0',
                extra_color_negro: 'D0', extra_color_dorado: 'D0',
                kit_clasica_a1b: 'A1b',
                acc_bisagra_muro: 'A12', acc_bisagra_vidrio_vidrio: 'A13', acc_boton: 'A14',
                acc_tubo_terminales_carro: 'A15', acc_extra_negro_pieza: 'A15', acc_extra_negro_tubo_carro: 'A15',
                acc_perfil_u_6m: 'A24',
                margen_plegable: 'D8', margen_panel_fijo: 'D7', margen_tiras: 'D12',
                // Segunda parte de B8 (2026-11-24): piezas sueltas, vidrio de reemplazo y espejo con otro trabajo.
                acc_mariposa: 'A29', acc_manija_vertical: 'A43', acc_deslizantes_par: 'A16',
                acc_deslizantes_par_superior: 'A16', acc_medias_lunas_par: 'A18', acc_terminales_freno_par: 'A19',
                acc_tubo_m: 'A17', acc_riel_m: 'A23', acc_guia: 'A22', acc_burbuja: 'A25', acc_barredor: 'A26',
                acc_boquete: 'A27', acc_l_fija: 'A28',
                transporte_reemplazo: 'M1', est_espejo_con_otro_trabajo: 'E1',
                // Confirmado en AP3 (2026-11-24)
                acc_extra_dorado_pieza: 'A§2', precio_instalacion_sola: 'S3'
            },
            // Costo del kit de cada división (02-accesorios.md).
            productos: {
                "División Batiente (Tradicional)": 'A3',
                "División Corrediza Clásica": 'A1',
                "División Corrediza Premium": 'A2',
                "División de baño L - Corrediza": 'A4',
                "División de baño L - Batiente": 'A5',
                "División neoangular": 'A5'
            },
            // Divisiones con ficha confirmada (03-divisiones.md): llevan el plazo y la garantía de la ficha.
            divisiones: [
                "División Batiente (Tradicional)", "División Corrediza Clásica", "División Corrediza Premium",
                "División de baño L - Corrediza", "División de baño L - Batiente", "División neoangular",
                "División de baño plegable (2 hojas)", "Panel fijo piso a techo (perfil U)"
            ],
            // Plazo del vidrio, en días hábiles desde el anticipo (01-vidrios.md). Es el
            // mismo texto que lleva la orden.
            plazos: {
                incoloro: '6 a 8 días hábiles después del anticipo',
                // Templado común (6 a 8) más el diseño sandblasting (1 a 2), Andrés, 2026-11-24.
                sandblasting: '7 a 10 días hábiles después del anticipo',
                // Promoción de la clásica ($650.000 / $690.000), Andrés, 2026-11-24.
                promocion: '3 días hábiles después del anticipo',
                // Vidrio de reemplazo de una clásica de 180 o 190 en 6 mm, comprado suelto (ficha M1).
                reemplazoClasica: '1 a 3 días después del anticipo',
                // Juego hecho de la clásica (ficha V20; A4, 2026-11-24): la cotización y la orden dicen lo mismo.
                juegoHecho: '3 días hábiles después del anticipo',
                // Espejo (ficha E1, AP3, 2026-11-24).
                espejo: '3 días hábiles después del anticipo',
                especial: '12 a 15 días hábiles después del anticipo',
                templado5: '12 a 15 días hábiles después del anticipo'
            },
            garantiaDivisiones: '12 meses sobre los herrajes y la instalación',
            // Instalación sola con accesorios del cliente (Andrés, 2026-11-24).
            garantiaInstalacionSola: '3 meses sobre la instalación',
            // «Incluye» que lee el cliente (03-divisiones.md, fila 3; AP3, 2026-11-24). La neoangular
            // lleva el kit de la L batiente: su texto es el de la L batiente.
            incluye: (() => {
                const final = 'transporte e instalación en el perímetro urbano de Bogotá; asesoría técnica y verificación de medidas';
                const vidrio = 'Vidrio templado incoloro cortado, perforado, pulido y brillado';
                const lBatiente = `${vidrio}; herrajes en acero inoxidable 304 (bisagras vidrio a vidrio, L fijas, boquetes y botón haladera o manija vertical); ${final}`;
                return {
                    "División Corrediza Clásica": `${vidrio}; herrajes en acero inoxidable 304 (2 deslizantes, tubo superior, botón haladera); guías acrílicas o riel inferior de aluminio, según el diseño; ${final}`,
                    "División Corrediza Premium": `${vidrio}; herrajes en acero inoxidable 304 (tubo rectangular premium, deslizantes premium con 2 perforaciones cada uno, manija de 2 perforaciones); ${final}`,
                    "División Batiente (Tradicional)": `${vidrio}; herrajes en acero inoxidable 304 (2 bisagras, boquetes y botón haladera o mariposa); ${final}`,
                    "Panel fijo piso a techo (perfil U)": `${vidrio}; soportes en acero inoxidable 304 o perfil U de aluminio, según la opción; ${final}`,
                    "División de baño plegable (2 hojas)": `${vidrio}; herrajes en acero inoxidable 304 (2 bisagras a muro, 2 bisagras vidrio a vidrio, 2 botones haladera, tubo superior con carro guía); ${final}`,
                    "División de baño L - Corrediza": `${vidrio}; herrajes en acero inoxidable 304 (deslizantes, 2 tubos con codo, botón haladera o manija, medias lunas, terminales y freno); guías acrílicas o riel inferior de aluminio, según el diseño; ${final}`,
                    "División de baño L - Batiente": lBatiente,
                    "División neoangular": lBatiente
                };
            })()
        };

        const PRODUCTO_CLASICA = "División Corrediza Clásica";
        const PRODUCTO_PREMIUM = "División Corrediza Premium";
        const PRODUCTO_NEOANGULAR = "División neoangular";
        const PRODUCTO_REEMPLAZO = "Vidrio de reemplazo para división";
        const PRODUCTO_L_PREMIUM = "División de baño L - Corrediza premium";
        const PRODUCTO_INSTALACION_SOLA = "Instalación sola de división (accesorios del cliente)";

        // Piezas sueltas con costo (02-accesorios.md §2), para el vidrio de reemplazo.
        // `nombre` es lo que lee el cliente; `costo` es la clave de Configuración.
        // Las piezas en negro o dorado todavía no tienen recargo confirmado.
        const PIEZAS_SUELTAS = [
            { clave: 'bisagra', nombre: 'Bisagra', costo: 'acc_bisagra_muro', unidad: 'u' },
            { clave: 'bisagra_vv', nombre: 'Bisagra vidrio a vidrio', costo: 'acc_bisagra_vidrio_vidrio', unidad: 'u' },
            { clave: 'boton', nombre: 'Botón haladera', costo: 'acc_boton', unidad: 'u' },
            { clave: 'mariposa', nombre: 'Mariposa', costo: 'acc_mariposa', unidad: 'u' },
            { clave: 'manija', nombre: 'Manija vertical', costo: 'acc_manija_vertical', unidad: 'u' },
            { clave: 'deslizantes', nombre: 'Par de deslizantes', costo: 'acc_deslizantes_par', unidad: 'par' },
            { clave: 'deslizantes_sup', nombre: 'Par de deslizantes de mejor calidad', costo: 'acc_deslizantes_par_superior', unidad: 'par' },
            { clave: 'medias_lunas', nombre: 'Par de medias lunas', costo: 'acc_medias_lunas_par', unidad: 'par' },
            { clave: 'terminales', nombre: 'Par de terminales con freno', costo: 'acc_terminales_freno_par', unidad: 'par' },
            { clave: 'tubo', nombre: 'Tubo superior', costo: 'acc_tubo_m', unidad: 'm' },
            { clave: 'riel', nombre: 'Riel inferior', costo: 'acc_riel_m', unidad: 'm' },
            { clave: 'guia', nombre: 'Guía inferior', costo: 'acc_guia', unidad: 'u', sinColor: true }, // acrílica
            { clave: 'burbuja', nombre: 'Burbuja', costo: 'acc_burbuja', unidad: 'u', sinColor: true }, // perfil antigolpe
            { clave: 'barredor', nombre: 'Barredor', costo: 'acc_barredor', unidad: 'u', sinColor: true },
            { clave: 'boquete', nombre: 'Boquete', costo: 'acc_boquete', unidad: 'u' },
            { clave: 'l_fija', nombre: 'L fija', costo: 'acc_l_fija', unidad: 'u' }
        ];
        function limpiarPiezas(piezas) {
            const limpias = {};
            PIEZAS_SUELTAS.forEach(p => {
                const cantidad = Number(piezas && piezas[p.clave]);
                if (cantidad > 0) limpias[p.clave] = p.unidad === 'm' ? Math.round(cantidad * 100) / 100 : Math.round(cantidad);
            });
            return limpias;
        }
        function costoPiezas(cfg, piezas) {
            const limpias = limpiarPiezas(piezas);
            return PIEZAS_SUELTAS.reduce((total, p) => total + (limpias[p.clave] || 0) * (cfg[p.costo] || 0), 0);
        }
        // Lo que lee el cliente: piezas y cantidades, sin precios.
        function textoPiezas(piezas) {
            const limpias = limpiarPiezas(piezas);
            const partes = PIEZAS_SUELTAS.filter(p => limpias[p.clave]).map(p => p.unidad === 'm'
                ? `${p.nombre}: ${String(limpias[p.clave]).replace('.', ',')} m`
                : `${p.nombre} × ${limpias[p.clave]}`);
            return partes.length ? partes.join(', ') : 'sin accesorios';
        }
        // Kit de la clásica según espesor y ancho (Andrés, 2026-11-23): el A1 en 6 mm
        // y en 8 mm de menos de 120 cm; el A1b en 8 mm desde 120 cm y en todo 10 mm.
        function usaKitA1b(producto, espesor, anchoCm) {
            if (producto !== PRODUCTO_CLASICA) return false;
            return espesor === '10mm' || (espesor === '8mm' && Number(anchoCm) >= 120);
        }
        function kitSegunFicha(cfg, producto, kitBase, espesor, anchoCm) {
            return usaKitA1b(producto, espesor, anchoCm) ? cfg.kit_clasica_a1b : kitBase;
        }
        // Estructura de $150.000 en la línea controlada (ficha §0): la premium y la L premium,
        // y toda división de más de 150 cm de ancho (AP3, 2026-11-24; el mismo límite de la
        // instalación de $100.000 y del recargo del kit, que miran el primer ancho). La línea
        // empresa sigue igual hasta que Andrés diga si también sube.
        function estructuraSegunFicha(cfg, producto, linea, est, anchoM = 0) {
            if (linea !== 'controlada') return est;
            const esPremium = producto === PRODUCTO_PREMIUM || producto === PRODUCTO_L_PREMIUM;
            const esGrande = (FICHAS.divisiones.includes(producto) || producto === PRODUCTO_L_PREMIUM) && Number(anchoM) > 1.5;
            return (esPremium || esGrande) ? cfg.est_premium : est;
        }
        // Kit de la L corrediza premium (ficha D13; Andrés, 2026-11-24): con 1 puerta (2 fijos y
        // 1 puerta), el kit premium × 1,05; con 2 puertas (2 fijos y 2 puertas), 2 kits premium.
        function kitLPremium(kitPremium, puertas) {
            return Number(puertas) === 2 ? 2 * kitPremium : kitPremium * 1.05;
        }
        // Recargo por color de las piezas sueltas (02-accesorios.md §2; Andrés, 2026-11-24):
        // negro +$5.000 y dorado u oro rosa +$22.000 por pieza. Un par son 2 piezas; el tubo
        // y el riel, una pieza cada uno.
        function recargoColorPiezas(cfg, piezas, color) {
            const porPieza = color === 'negro' ? cfg.acc_extra_negro_pieza : esColorDorado(color) ? cfg.acc_extra_dorado_pieza : 0;
            if (!porPieza) return 0;
            const limpias = limpiarPiezas(piezas);
            // La guía, la burbuja y el barredor no son de metal: no llevan color.
            const cuantas = PIEZAS_SUELTAS.reduce((n, p) => n + (!limpias[p.clave] || p.sinColor ? 0 : p.unidad === 'par' ? 2 * limpias[p.clave] : p.unidad === 'm' ? 1 : limpias[p.clave]), 0);
            return cuantas * porPieza;
        }
        // Vidrio de reemplazo (ficha M1; AP3, 2026-11-24): cuatro variantes. La puerta de
        // corrediza lleva su burbuja, incluida en el precio.
        const VARIANTES_REEMPLAZO = {
            puerta_corrediza: 'vidrio para puerta de división corrediza',
            fijo_corrediza: 'vidrio fijo de división corrediza',
            puerta_batiente: 'vidrio para puerta de división batiente',
            fijo_batiente: 'vidrio fijo de división batiente'
        };
        function varianteReemplazo(reemplazo) {
            const sistema = reemplazo && reemplazo.origen === 'batiente' ? 'batiente' : 'corrediza';
            return `${reemplazo && reemplazo.pieza === 'fijo' ? 'fijo' : 'puerta'}_${sistema}`;
        }
        function piezasConBurbuja(reemplazo) {
            const piezas = { ...(reemplazo && reemplazo.piezas) };
            if (varianteReemplazo(reemplazo) === 'puerta_corrediza') piezas.burbuja = (Number(piezas.burbuja) || 0) + 1;
            return limpiarPiezas(piezas);
        }
        // El oro rosa lleva el mismo recargo que el dorado.
        const esColorDorado = (color) => color === 'dorado' || color === 'oro_rosa';
        function etiquetaColorHerraje(color) {
            const etiquetas = { natural: 'natural', negro: 'negro', dorado: 'dorado', oro_rosa: 'oro rosa' };
            return etiquetas[color] || String(color || '');
        }
        // Diseño sandblasting: precio al cliente, IVA incluido (V9 y V10). En la L
        // se suman sus anchos.
        function precioSandblastingFicha(cfg, anchoTotalM) {
            return Math.round(anchoTotalM * 100) >= 140 ? cfg.precio_sandblasting_desde_140 : cfg.precio_sandblasting_menor_140;
        }
        // Plazo de entrega que va en la cotización. Sin ficha o sin plazo conocido
        // (espejo, repisa, cortaviento), no se dice nada, como antes.
        // Juego hecho (ficha V20; A4, 2026-11-24): clásica o L corrediza en 6 mm transparente,
        // alto de 180 o 190, hasta 160 cm de ancho (en la L, cada lado), herraje natural o negro.
        function esRutaJuegoHecho(producto, { espesor, glassFinish, colorAcc, anchoCm, ancho2Cm, altoCm } = {}) {
            const esL = producto === 'División de baño L - Corrediza';
            if (producto !== PRODUCTO_CLASICA && !esL) return false;
            if (espesor !== '6mm' || glassFinish !== 'transparent') return false;
            if (colorAcc !== 'natural' && colorAcc !== 'negro') return false;
            if (Number(altoCm) !== 180 && Number(altoCm) !== 190) return false;
            return Number(anchoCm) <= 160 && (!esL || Number(ancho2Cm) <= 160);
        }
        function plazoSegunFicha(producto, { vidrioEspecial, glassFinish, esTiras, esPromocion, espesor, reemplazoOrigen, juegoHecho } = {}) {
            if (vidrioEspecial) return FICHAS.plazos.especial;
            if (esTiras) return FICHAS.plazos.templado5;
            if (producto === 'Espejo Flotante') return FICHAS.plazos.espejo;
            // Vidrio de reemplazo (ficha M1): el de una clásica de 180 o 190 en 6 mm se compra suelto.
            if (producto === PRODUCTO_REEMPLAZO && glassFinish === 'transparent') {
                return (reemplazoOrigen === 'clasica_180_190' && espesor === '6mm') ? FICHAS.plazos.reemplazoClasica : FICHAS.plazos.incoloro;
            }
            if (producto === PRODUCTO_REEMPLAZO && glassFinish === 'sandblasted') return FICHAS.plazos.sandblasting;
            if (!FICHAS.divisiones.includes(producto)) return '';
            if (glassFinish === 'transparent') return esPromocion ? FICHAS.plazos.promocion : juegoHecho ? FICHAS.plazos.juegoHecho : FICHAS.plazos.incoloro;
            if (glassFinish === 'sandblasted') return FICHAS.plazos.sandblasting;
            return '';
        }
        function textoGarantia(producto) {
            if (producto === 'Instalación sola de división (accesorios del cliente)') return FICHAS.garantiaInstalacionSola;
            return FICHAS.divisiones.includes(producto) ? FICHAS.garantiaDivisiones : '12 meses';
        }
        // «Incluye» de la ficha; con el kit A1b, la clásica dice «accesorios de alta calidad».
        // Con un vidrio especial no se dice «incoloro»: la línea «Vidrio:» ya dice cuál es.
        function textoIncluye(producto, conKitA1b, vidrioEspecial) {
            let texto = FICHAS.incluye[producto] || '';
            if (texto && conKitA1b) texto = texto.replace('herrajes en acero inoxidable 304', 'accesorios de alta calidad en acero inoxidable 304');
            if (texto && vidrioEspecial) texto = texto.replace('Vidrio templado incoloro cortado', 'Vidrio cortado');
            return texto;
        }

        // Los valores de las fichas llegan a cada teléfono sin pisar lo puesto a mano.
        // `wilan_fichas_vistas` guarda lo que decían las fichas la última vez que se
        // abrió la app en este teléfono. Un valor guardado igual a ese sigue a la ficha
        // nueva; uno distinto lo puso alguien a mano: no se pisa y se avisa, hasta que
        // alguien toque «Guardar» en Configuración (`wilan_fichas_revisadas`).
        const FICHAS_VISTAS_KEY = 'wilan_fichas_vistas';
        const FICHAS_REVISADAS_KEY = 'wilan_fichas_revisadas';
        function valoresDeFichas(defaults) {
            const valores = { globales: {}, productos: {} };
            Object.keys(FICHAS.globales).forEach(k => { valores.globales[k] = defaults.globales[k]; });
            Object.keys(FICHAS.productos).forEach(k => { valores.productos[k] = defaults.productos[k]; });
            return valores;
        }
        function aplicarFichas(config, defaults, storage) {
            const leer = (k) => { try { return storage.getItem(k); } catch (_) { return null; } };
            const leerJson = (k) => { try { return JSON.parse(leer(k) || 'null'); } catch (_) { return null; } };
            const escribir = (k, v) => { try { storage.setItem(k, v); } catch (_) { /* sin espacio: se reintenta al abrir */ } };
            const fichas = valoresDeFichas(defaults);
            const vistas = leerJson(FICHAS_VISTAS_KEY) || {};
            const revisadas = leerJson(FICHAS_REVISADAS_KEY) || {};
            // El kit premium ya tiene su aviso de B2 mientras nadie toque Guardar.
            const marcaPremium = leer(KIT_PREMIUM.marca);
            const premiumConAvisoB2 = !marcaPremium || marcaPremium === 'revisado';
            const resultado = { actualizados: [], distintos: [] };
            if (!config) return resultado;
            ['globales', 'productos'].forEach(seccion => {
                const actual = config[seccion] || (config[seccion] = {});
                Object.keys(fichas[seccion]).forEach(clave => {
                    const ficha = fichas[seccion][clave];
                    const valor = actual[clave];
                    if (valor === undefined || valor === ficha) return;
                    // La primera vez con B8, lo que traía la app es lo mismo que la ficha.
                    const visto = vistas[seccion] && vistas[seccion][clave] !== undefined ? vistas[seccion][clave] : ficha;
                    if (valor === visto) {
                        actual[clave] = ficha;
                        resultado.actualizados.push({ seccion, clave, de: valor, a: ficha });
                        return;
                    }
                    if (seccion === 'productos' && clave === KIT_PREMIUM.producto && premiumConAvisoB2 && ficha === KIT_PREMIUM.nuevo) return;
                    if (revisadas[seccion] && revisadas[seccion][clave] === ficha) return;
                    resultado.distintos.push({ seccion, clave, valor, ficha });
                });
            });
            if (resultado.actualizados.length) {
                const guardado = leerJson('vidrios_config');
                if (guardado) {
                    resultado.actualizados.forEach(({ seccion, clave, a }) => {
                        if (guardado[seccion]) guardado[seccion][clave] = a;
                    });
                    escribir('vidrios_config', JSON.stringify(guardado));
                }
            }
            escribir(FICHAS_VISTAS_KEY, JSON.stringify(fichas));
            return resultado;
        }
        function marcarFichasRevisadas(defaults, storage) {
            try { storage.setItem(FICHAS_REVISADAS_KEY, JSON.stringify(valoresDeFichas(defaults))); } catch (_) { /* no bloquea */ }
        }
        const ETIQUETAS_CONFIG = {
            acc_boton: 'ACC BOTÓN HALADERA', // «botón haladera» en todos lados (Andrés, 2026-11-20)
            extra_color_dorado: 'EXTRA COLOR DORADO U ORO ROSA',
            est_premium: 'EST PREMIUM Y DIVISIONES DE MÁS DE 150 CM (LÍNEA CONTROLADA)',
            kit_clasica_a1b: 'KIT CLÁSICA 8 MM DESDE 120 CM Y 10 MM',
            precio_sandblasting_menor_140: 'SANDBLASTING AL CLIENTE, MENOS DE 140 CM',
            precio_sandblasting_desde_140: 'SANDBLASTING AL CLIENTE, DESDE 140 CM O L',
            acc_bisagra_muro: 'ACC BISAGRA MURO (Y DE BATIENTE)',
            acc_tubo_m: 'ACC TUBO SUPERIOR (POR METRO)',
            acc_riel_m: 'ACC RIEL INFERIOR (POR METRO)',
            transporte_reemplazo: 'TRANSPORTE VIDRIO DE REEMPLAZO',
            acc_extra_negro_pieza: 'ACC EXTRA NEGRO POR PIEZA',
            acc_extra_dorado_pieza: 'ACC EXTRA DORADO U ORO ROSA POR PIEZA',
            precio_instalacion_sola: 'INSTALACIÓN SOLA (PRECIO AL CLIENTE)',
            est_espejo_con_otro_trabajo: 'EST ESPEJO CON OTRO TRABAJO'
        };
        const etiquetaConfig = (clave) => ETIQUETAS_CONFIG[clave] || clave.replace(/_/g, ' ').toUpperCase();
        const fmtValorConfig = (v) => (Math.abs(Number(v)) < 10 ? String(v) : fmtMoney(Number(v)));
        function textoAvisoFichas(resultado) {
            const lista = (resultado && resultado.distintos) || [];
            if (!lista.length) return '';
            const detalle = lista.slice(0, 3).map(d => `${etiquetaConfig(d.clave)}: ${fmtValorConfig(d.valor)} (ficha ${fmtValorConfig(d.ficha)})`).join('; ');
            const mas = lista.length > 3 ? ` y ${lista.length - 3} más` : '';
            return `Este teléfono tiene ${lista.length === 1 ? 'un valor puesto a mano distinto' : `${lista.length} valores puestos a mano distintos`} de las fichas: ${detalle}${mas}. `
                + `No se cambiaron. Revísalos en Configuración y toca Guardar, o «Usar los valores de las fichas».`;
        }

        // Mínimo por salida de instalación (regla del 2026-11-11). Andrés, 2026-11-21:
        // por ahora solo avisa; el precio no cambia. El aviso lo ve quien cotiza
        // en la pantalla; no va en el mensaje, el presupuesto ni la imagen.
        const MINIMO_SALIDA = 350000;
        // Tiras y repisa van en la visita de otro trabajo: solas no son una salida.
        function esAdicionalDeVisita(item) {
            return !!item && (item.producto === PRODUCTOS_ESPECIALES.TIRAS || item.producto === PRODUCTOS_ESPECIALES.REPISA);
        }
        function textoAvisoMinimoSalida(items, total) {
            const lista = (items || []).filter(Boolean);
            // El vidrio de reemplazo y la instalación sola son excepción: no avisan (fichas M1 y S3).
            if (!lista.length || lista.every(i => esAdicionalDeVisita(i) || i.producto === PRODUCTO_REEMPLAZO || i.producto === PRODUCTO_INSTALACION_SOLA)) return '';
            if (!(Number(total) < MINIMO_SALIDA)) return '';
            return `⚠️ Esta salida suma ${fmtMoney(Number(total) || 0)}, menos que el mínimo de ${fmtMoney(MINIMO_SALIDA)} por salida de instalación. `
                + `El precio no cambia: decide tú si lo subes. El cliente no ve este aviso.`;
        }
        function pintarAvisoMinimoSalida(el, texto) {
            if (!el) return;
            el.innerText = texto;
            el.style.display = texto ? 'block' : 'none';
        }
        function actualizarAvisoMinimoPrincipal() {
            // Con carrito, la salida es el carrito completo: el aviso va allá.
            const cantidad = parseInt(document.getElementById('cantidad-item')?.value, 10) || 1;
            const texto = (lastCalculation && quoteItems.length === 0)
                ? textoAvisoMinimoSalida([lastCalculation], lastCalculation.precio * cantidad)
                : '';
            pintarAvisoMinimoSalida(document.getElementById('aviso-minimo-main'), texto);
        }

        // Productos nuevos del 2026-11-19 (Andrés). Su precio no usa el valor de
        // `productos`: el kit sale de los accesorios y el vidrio de su tipo.
        const PRODUCTOS_ESPECIALES = {
            PLEGABLE: "División de baño plegable (2 hojas)",
            PANEL_FIJO: "Panel fijo piso a techo (perfil U)",
            TIRAS: "Tiras de vidrio 5 mm (adicional)",
            REPISA: "Repisa de vidrio 6 mm (hasta 30 cm)",
            REEMPLAZO: "Vidrio de reemplazo para división" // B8, 2026-11-24 (ficha M1)
        };
        const esProductoEspecial = (nombre) => Object.values(PRODUCTOS_ESPECIALES).includes(nombre);

        // Vidrios especiales: van en «Acabado del vidrio». Fijan el espesor y
        // tardan 12 a 15 días hábiles en el proveedor.
        const VIDRIOS_ESPECIALES = {
            serigrafia_6mm: { label: 'Serigrafía 6 mm', espesor: '6mm', precioKey: 'precio_vidrio_serigrafia_6mm' },
            serigrafia_negra_8mm: { label: 'Serigrafía negra 8 mm', espesor: '8mm', precioKey: 'precio_vidrio_serigrafia_negra_8mm' },
            laminado_4_4: { label: 'Laminado templado 4+4', espesor: '8mm', precioKey: 'precio_vidrio_laminado_4_4' },
            negro_6mm: { label: 'Transparente negro 6 mm', espesor: '6mm', precioKey: 'precio_vidrio_negro_6mm' }
        };
        const PLAZO_VIDRIO_ESPECIAL = FICHAS.plazos.especial;

        // Kit de la plegable de 2 hojas: 2 bisagras a muro, 2 vidrio a vidrio,
        // 2 botones haladera y el juego de tubo, terminales y carro. Negro: +5.000 por
        // pieza pequeña (6) y +20.000 el tubo y el carro.
        function costoKitPlegable(cfg, color) {
            let total = 2 * cfg.acc_bisagra_muro + 2 * cfg.acc_bisagra_vidrio_vidrio
                + 2 * cfg.acc_boton + cfg.acc_tubo_terminales_carro;
            if (color === 'negro') total += 6 * cfg.acc_extra_negro_pieza + cfg.acc_extra_negro_tubo_carro;
            if (color === 'dorado' || color === 'oro_rosa') total += cfg.extra_color_dorado;
            return total;
        }

        // Panel fijo: un perfil U en cada lado del vidrio, 2 x ancho + 2 x alto
        // (ficha D7, Andrés, 2026-11-20; antes 2 x ancho + alto), en tiras
        // completas de 6 m. Medidas en metros.
        function costoPerfilU(cfg, anchoM, altoM) {
            const metros = 2 * anchoM + 2 * altoM;
            const tiras = Math.max(1, Math.ceil(metros / 6 - 1e-9));
            return tiras * cfg.acc_perfil_u_6m;
        }

        const LOGICA_ACCESORIOS = {
            "División Batiente (Tradicional)": "FIJO",
            "División Corrediza Clásica": "FIJO",
            "División Corrediza Premium": "FIJO",
            "División de baño L - Corrediza": "FIJO",
            "División de baño L - Batiente": "FIJO",
            "Cortaviento / Oficina": "ANCHO",
            "Espejo Flotante": "FIJO",
            "División de baño plegable (2 hojas)": "FIJO",
            "Panel fijo piso a techo (perfil U)": "FIJO",
            "Tiras de vidrio 5 mm (adicional)": "FIJO",
            "Repisa de vidrio 6 mm (hasta 30 cm)": "FIJO",
            "División neoangular": "FIJO",
            "Vidrio de reemplazo para división": "FIJO",
            "División de baño L - Corrediza premium": "FIJO",
            "Instalación sola de división (accesorios del cliente)": "FIJO",
        };

        const CANONICAL_PRODUCT_METADATA = {
            "División Batiente (Tradicional)": {
                canonicalProductId: "DB-BAT",
                familyId: "DB",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            "División Corrediza Clásica": {
                canonicalProductId: "DB-COR",
                familyId: "DB",
                variantId: "DB-COR-2H",
                mappingStatus: "map_with_variant"
            },
            "División Corrediza Premium": {
                canonicalProductId: "DB-COR",
                familyId: "DB",
                variantId: "DB-COR-PRE",
                mappingStatus: "map_with_variant"
            },
            "División de baño L - Corrediza": {
                canonicalProductId: "DB-ESC",
                familyId: "DB",
                variantId: "DB-ESC-COR",
                mappingStatus: "map_with_variant",
                canonicalAttributes: { dimensionSchema: "width_height_side2" }
            },
            "División de baño L - Batiente": {
                canonicalProductId: "DB-ESC",
                familyId: "DB",
                variantId: "DB-ESC-BAT",
                mappingStatus: "map_with_variant",
                canonicalAttributes: { dimensionSchema: "width_height_side2" }
            },
            "Cortaviento / Oficina": {
                canonicalProductId: null,
                familyId: null,
                variantId: null,
                mappingStatus: "split_required"
            },
            "Espejo Flotante": {
                canonicalProductId: "ESP-FLO",
                familyId: "ESP",
                variantId: "ESP-FLO-STD",
                mappingStatus: "map_with_attributes"
            },
            // Identidades que ya usa el catálogo del CRM: sin ellas la bandeja
            // rechaza la cotización completa.
            "División de baño plegable (2 hojas)": {
                canonicalProductId: "DB-PLE",
                familyId: "DB",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            "Panel fijo piso a techo (perfil U)": {
                canonicalProductId: "DB-FIJ",
                familyId: "DB",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            "Tiras de vidrio 5 mm (adicional)": {
                canonicalProductId: "VID-TEM",
                familyId: "VID",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            "Repisa de vidrio 6 mm (hasta 30 cm)": {
                canonicalProductId: "REP-REC",
                familyId: "REP",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            // B8, 2026-11-24: códigos del catálogo maestro (fichas D11 y M1). El CRM no los
            // convierte solo en una línea: quedan para agregarlos con el asistente.
            "División neoangular": {
                canonicalProductId: "DB-NEO",
                familyId: "DB",
                variantId: "DB-NEO-STD",
                mappingStatus: "map_with_variant"
            },
            "Vidrio de reemplazo para división": {
                canonicalProductId: "MAN-DB-VID",
                familyId: "MAN",
                variantId: null,
                mappingStatus: "map_with_attributes"
            },
            // Ficha D13: el catálogo maestro no tiene variante para la L premium; no se inventa.
            "División de baño L - Corrediza premium": {
                canonicalProductId: "DB-ESC",
                familyId: "DB",
                variantId: null,
                mappingStatus: "map_with_attributes",
                canonicalAttributes: { dimensionSchema: "width_height_side2" }
            },
            // Ficha S3: sin código en el catálogo maestro. Va a la bandeja para revisión manual.
            "Instalación sola de división (accesorios del cliente)": {
                canonicalProductId: null,
                familyId: null,
                variantId: null,
                mappingStatus: "review_manual",
                canonicalAttributes: {}
            }
        };

        function canonicalThicknessMm(value) {
            const match = String(value || '').match(/\d+/);
            return match ? Number(match[0]) : null;
        }

        function buildCanonicalProductMetadata(productName, context = {}) {
            const base = CANONICAL_PRODUCT_METADATA[productName];
            if (!base) return null;
            const canonicalAttributes = { ...(base.canonicalAttributes || {}) };
            const thickness = canonicalThicknessMm(context.espesor);
            if (thickness) canonicalAttributes.glassThickness = thickness;
            if (productName === "Espejo Flotante") {
                canonicalAttributes.hasLed = !!context.hasLed;
                if (context.hasLed) canonicalAttributes.addonIds = ["ACC-LED"];
            }
            if (context.hasSandblasting) canonicalAttributes.hasSandblasting = true;

            return {
                canonicalProductId: base.canonicalProductId,
                familyId: base.familyId,
                variantId: base.variantId,
                mappingStatus: base.mappingStatus,
                // B8: un producto sin atributos que los declara vacíos ({}) los manda así; la bandeja los pide.
                ...((Object.keys(canonicalAttributes).length || base.canonicalAttributes) ? { canonicalAttributes } : {})
            };
        }

        // Variables para cotización múltiple
        // === Persistencia automática del carrito y datos del cliente ===
        const CARRITO_STORAGE_KEY = 'cotizador_carrito_v1';
        const CLIENTE_STORAGE_KEY = 'cotizador_cliente_v1';

        // ============================================================
        // FOLIO / NUMERACIÓN PROFESIONAL DE COTIZACIONES
        // ============================================================
        // Formato: COT-AAAA-NNNN  (ej: COT-2026-0101)
        // - Consecutivo de 4 dígitos que se reinicia cada año.
        // - Arranca en 101 para que el primer número se vea profesional.
        // - El número se RESERVA al ver el carrito o el resultado (solo para
        //   mostrar) y se CONSUME (avanza el contador) en CUALQUIER envío:
        //   tanto "ENVIAR AL CLIENTE" (carrito) como "WHATSAPP" individual.
        const FOLIO_PREFIX = 'COT';
        const FOLIO_BASE = 100;  // el primer folio emitido será FOLIO_BASE + 1 = 101
        const FOLIO_COUNTER_KEY = 'cotizador_folio_counter_v2'; // { "2026": 142, ... }
        const FOLIO_ACTUAL_KEY  = 'cotizador_folio_actual_v2';  // folio reservado del carrito vigente

        function _folioCounters() {
            try { return JSON.parse(localStorage.getItem(FOLIO_COUNTER_KEY)) || {}; }
            catch(e) { return {}; }
        }

        // Último número emitido en el año (o la base si aún no hay ninguno).
        function _folioCount(counters, anio) {
            return (counters && counters[anio] != null) ? counters[anio] : FOLIO_BASE;
        }

        function _folioFormat(anio, n) {
            return `${FOLIO_PREFIX}-${anio}-${String(n).padStart(4, '0')}`;
        }

        // Devuelve el folio que tomaría la PRÓXIMA cotización (sin consumirlo).
        function folioPreview() {
            const anio = new Date().getFullYear();
            const counters = _folioCounters();
            const siguiente = _folioCount(counters, anio) + 1;
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
            counters[anio] = _folioCount(counters, anio) + 1;
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
        function newAgendaQuoteId() {
            const value = window.crypto?.randomUUID
                ? window.crypto.randomUUID().replace(/-/g, '')
                : `${Date.now()}${Math.random().toString(36).slice(2)}`;
            return `q_${value}`;
        }
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
                if (quoteItems.length > 0) {
                    const quoteId = quoteItems.find(item => item.quoteId)?.quoteId || newAgendaQuoteId();
                    quoteItems.forEach(item => { if (!item.quoteId) item.quoteId = quoteId; });
                }
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

        // B2 (2026-11-21): el kit premium pasa a $280.000 en todos los teléfonos.
        // Si el teléfono guardó $220.000 (el valor viejo de la app), pasa solo.
        // Si alguien puso otro valor a mano, no se pisa: se avisa.
        const avisoKitPremium = migrarKitPremium(currentConfig, localStorage);
        // B8 (2026-11-23): los valores de las fichas llegan a todos los teléfonos;
        // lo puesto a mano no se pisa: se avisa.
        const avisoFichas = aplicarFichas(currentConfig, DEFAULT_CONFIG, localStorage);

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
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.text = 'Selecciona el producto';
            placeholder.selected = true;
            selProd.appendChild(placeholder);
            Object.keys(currentConfig.productos).forEach(p => {
                let opt = document.createElement('option');
                opt.value = p;
                opt.text = p;
                selProd.appendChild(opt);
            });

            document.getElementById('lbl-desmonte-val').innerText = fmtMoney(currentConfig.globales.desmonte);
            document.getElementById('lbl-led-val').innerText = fmtMoney(currentConfig.globales.extra_espejo_led);
            renderConfigForm();
            renderPiezasReemplazo();
            renderHistorial();
            verificarProducto();

            if (avisoKitPremium && avisoKitPremium.tipo === 'distinto') {
                setTimeout(() => {
                    toast(textoAvisoKitPremium(avisoKitPremium), 'warn', 9000);
                    // Texto largo: que no se desvanezca a los 2,5 s como los demás.
                    const ultimo = document.getElementById('toast-container')?.lastElementChild;
                    if (ultimo && ultimo.style) ultimo.style.animation = 'toastIn 0.25s ease-out, toastOut 0.3s ease-in 8.5s forwards';
                }, 1200);
            } else if (avisoKitPremium && avisoKitPremium.tipo === 'actualizado') {
                setTimeout(() => toast(`Kit de la corrediza premium actualizado a ${fmtMoney(KIT_PREMIUM.nuevo)}`, 'info', 4000), 1200);
            }
            const textoFichas = textoAvisoFichas(avisoFichas);
            if (textoFichas) {
                setTimeout(() => {
                    toast(textoFichas, 'warn', 10000);
                    const ultimo = document.getElementById('toast-container')?.lastElementChild;
                    if (ultimo && ultimo.style) ultimo.style.animation = 'toastIn 0.25s ease-out, toastOut 0.3s ease-in 9.5s forwards';
                }, 2400);
            } else if (avisoFichas.actualizados.length) {
                setTimeout(() => toast(`${avisoFichas.actualizados.length === 1 ? 'Un valor actualizado' : `${avisoFichas.actualizados.length} valores actualizados`} desde las fichas`, 'info', 4000), 2400);
            }

            // Restaurar UI del cliente y renderizar carrito guardado
            restaurarClienteEnUI();
            renderLibretaSelect();
            if (quoteItems.length > 0) renderQuote();
            document.getElementById('cantidad-item')?.addEventListener('input', actualizarAvisoMinimoPrincipal);
        }

        function verificarProducto() {
            const prod = document.getElementById('producto').value;
            const esEspejo = prod.includes("Espejo");
            const esLEspecial = prod.includes("División de baño L -");
            // Tiras y repisa traen su vidrio fijo: no piden espesor, color ni acabado.
            const esAdicional = prod === PRODUCTOS_ESPECIALES.TIRAS || prod === PRODUCTOS_ESPECIALES.REPISA
                || prod === PRODUCTO_INSTALACION_SOLA; // B8: la instalación sola usa los vidrios y accesorios del cliente
            if (esAdicional) {
                document.getElementById('glass_finish').value = '';
                document.getElementById('color_acc').value = '';
            }
            // Un vidrio especial fija su espesor.
            const vidrioEspecial = VIDRIOS_ESPECIALES[document.getElementById('glass_finish').value] || null;
            if (vidrioEspecial) document.getElementById('espesor').value = vidrioEspecial.espesor;

            // B8 (2026-11-24): la neoangular pide tres anchos; el vidrio de reemplazo, sus piezas
            // (el color es opcional: solo suma si lleva piezas); la L premium, cuántas puertas.
            const esNeoangular = prod === PRODUCTO_NEOANGULAR;
            const esReemplazo = prod === PRODUCTO_REEMPLAZO;
            const esLPremium = prod === PRODUCTO_L_PREMIUM;
            if (!esEspejo) document.getElementById('check-espejo-otro').checked = false;

            // Mostrar/Ocultar opción LED y Espesor según el producto
            document.getElementById('group-espejo-led').style.display = esEspejo ? 'flex' : 'none';
            document.getElementById('group-espejo-otro').style.display = esEspejo ? 'flex' : 'none';
            document.getElementById('group-espesor').style.display = (esEspejo || esAdicional || vidrioEspecial) ? 'none' : 'block';
            document.getElementById('group-color-acc').style.display = (esEspejo || esAdicional) ? 'none' : 'block';
            document.getElementById('group-l-puertas').style.display = esLPremium ? 'block' : 'none';
            document.getElementById('group-glass-finish').style.display = (esEspejo || esAdicional) ? 'none' : 'block';
            document.getElementById('group-reemplazo').style.display = esReemplazo ? 'block' : 'none';

            document.getElementById('col-ancho2').style.display = (esLEspecial || esNeoangular) ? 'block' : 'none';
            document.getElementById('col-ancho3').style.display = esNeoangular ? 'block' : 'none';
            document.getElementById('lbl-ancho').innerText = esLEspecial ? "Lado 1 (cm)" : esNeoangular ? "Ancho 1 (cm)" : "Ancho (cm)";
            document.getElementById('lbl-ancho2').innerText = esNeoangular ? "Ancho 2 (cm)" : "Lado 2 (cm)";

            // Si el producto NO es tipo L, limpiar ancho2 para que no quede un valor
            // residual oculto (p.ej. 90) que contamine cálculos posteriores.
            if (!esLEspecial && !esNeoangular) document.getElementById('ancho2').value = '';
            if (!esNeoangular) document.getElementById('ancho3').value = '';

            if (esEspejo) document.getElementById('glass_finish').value = '';
        }

        // B8: lista de piezas sueltas del vidrio de reemplazo, con su costo a la vista.
        function renderPiezasReemplazo() {
            const cont = document.getElementById('reemplazo-piezas');
            if (!cont) return;
            cont.innerHTML = '';
            PIEZAS_SUELTAS.forEach(p => {
                const fila = document.createElement('div');
                fila.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;margin:4px 0;';
                const etiqueta = document.createElement('label');
                etiqueta.style.cssText = 'margin:0;font-size:0.85rem;';
                const unidad = p.unidad === 'm' ? 'el metro' : p.unidad === 'par' ? 'el par' : 'c/u';
                etiqueta.innerText = `${p.nombre} (${fmtMoney(currentConfig.globales[p.costo] || 0)} ${unidad})`;
                const entrada = document.createElement('input');
                entrada.type = 'number';
                entrada.min = '0';
                entrada.step = p.unidad === 'm' ? '0.1' : '1';
                entrada.placeholder = p.unidad === 'm' ? 'metros' : '0';
                entrada.id = `pieza_${p.clave}`;
                entrada.style.cssText = 'width:80px;';
                fila.appendChild(etiqueta);
                fila.appendChild(entrada);
                cont.appendChild(fila);
            });
        }
        function leerPiezasReemplazo() {
            const piezas = {};
            PIEZAS_SUELTAS.forEach(p => {
                const valor = parseFloat(document.getElementById(`pieza_${p.clave}`)?.value);
                if (valor > 0) piezas[p.clave] = valor;
            });
            return limpiarPiezas(piezas);
        }
        function ponerPiezasReemplazo(piezas) {
            const limpias = limpiarPiezas(piezas);
            PIEZAS_SUELTAS.forEach(p => {
                const el = document.getElementById(`pieza_${p.clave}`);
                if (el) el.value = limpias[p.clave] ? String(limpias[p.clave]) : '';
            });
        }

        // Generar formulario de configuración dinámico
        function renderConfigForm() {
            const div = document.getElementById('config-form');
            div.innerHTML = `
                <div class="tab-container" style="overflow-x: auto; white-space: nowrap; gap: 5px; padding-bottom: 5px;">
                    <button class="tab-btn active" onclick="switchTab('general')">General</button>
                    <button class="tab-btn" onclick="switchTab('divisiones')">Divisiones</button>
                    <button class="tab-btn" onclick="switchTab('espejos')">Espejos</button>
                    <button class="tab-btn" onclick="switchTab('especiales')">Especiales</button>
                </div>
                <div id="tab-general" class="tab-content active"></div>
                <div id="tab-divisiones" class="tab-content"></div>
                <div id="tab-espejos" class="tab-content"></div>
                <div id="tab-especiales" class="tab-content"></div>
            `;

            // Helpers para filtrar productos (las ventanas/puertas ya no aparecen aquí)
            const isEspejo = (k) => k.includes('Espejo');
            // B8: la L premium y la instalación sola no tienen precio base propio (su kit o su precio salen de otra parte).
            const isDivision = (k) => !isEspejo(k) && !esProductoEspecial(k) && k !== PRODUCTO_L_PREMIUM && k !== PRODUCTO_INSTALACION_SOLA;

            // --- TAB 1: GENERAL ---
            const tGen = document.getElementById('tab-general');
            // B8: de dónde salen los valores y qué tiene este teléfono puesto a mano.
            const notaFichas = document.createElement('div');
            notaFichas.id = 'nota-fichas';
            notaFichas.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:0.85rem;';
            notaFichas.innerText = `📋 = sale de las fichas de producto (al día con ${FICHAS.version}). `
                + `Si lo cambias aquí, cambia solo en este teléfono; cuando la ficha cambie, se te avisa.`;
            tGen.appendChild(notaFichas);
            const distintos = (avisoFichas && avisoFichas.distintos) || [];
            if (distintos.length) {
                const aviso = document.createElement('div');
                aviso.id = 'aviso-fichas';
                aviso.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:0.85rem;font-weight:600;';
                aviso.innerText = `Este teléfono tiene ${distintos.length === 1 ? 'un valor puesto a mano distinto' : `${distintos.length} valores puestos a mano distintos`} de las fichas (salen en naranja). `
                    + `Si están bien, toca Guardar. Si no, usa los de las fichas:`;
                const boton = document.createElement('button');
                boton.type = 'button';
                boton.id = 'btn-usar-fichas';
                boton.innerText = 'Usar los valores de las fichas';
                boton.style.cssText = 'display:block;margin-top:8px;border:0;border-radius:6px;padding:8px 10px;background:#9a3412;color:#fff;font-weight:700;cursor:pointer;';
                boton.onclick = usarValoresDeFichas;
                aviso.appendChild(boton);
                tGen.appendChild(aviso);
            }
            addHeader(tGen, "Vidrios Templados (m²)");
            ['precio_vidrio_6mm', 'precio_vidrio_8mm', 'precio_vidrio_10mm', 'colchon_vidrio'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            addHeader(tGen, "Mano de Obra y Logística");
            ['instalacion_base', 'instalacion_L', 'transporte', 'insumos', 'desmonte'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            addHeader(tGen, "Negocio y Metas");
            ['iva', 'est_controlada', 'est_premium', 'est_empresa', 'util_controlada', 'util_empresa', 'meta_mensual'].forEach(k => addInputConfig(tGen, k, currentConfig.globales[k], 'globales'));

            // --- TAB 2: DIVISIONES ---
            const tDiv = document.getElementById('tab-divisiones');
            addHeader(tDiv, "Precios Base Productos");
            const avisoPremium = textoAvisoKitPremium(avisoKitPremium);
            if (avisoPremium) {
                const nota = document.createElement('div');
                nota.id = 'aviso-kit-premium';
                nota.style.cssText = 'margin:8px 0;padding:10px;border-radius:8px;background:#fff7ed;color:#9a3412;font-size:0.85rem;font-weight:600;';
                nota.innerText = avisoPremium;
                tDiv.appendChild(nota);
            }
            Object.keys(currentConfig.productos).filter(isDivision).forEach(k => addInputConfig(tDiv, k, currentConfig.productos[k], 'productos'));
            addInputConfig(tDiv, 'kit_clasica_a1b', currentConfig.globales.kit_clasica_a1b, 'globales');

            addHeader(tDiv, "Extras y Acabados");
            ['extra_color_negro', 'extra_color_dorado', 'precio_sandblasting_menor_140', 'precio_sandblasting_desde_140'].forEach(k => addInputConfig(tDiv, k, currentConfig.globales[k], 'globales'));

            // --- TAB 3: ESPEJOS ---
            const tEsp = document.getElementById('tab-espejos');
            addHeader(tEsp, "Precios Base Productos");
            Object.keys(currentConfig.productos).filter(isEspejo).forEach(k => addInputConfig(tEsp, k, currentConfig.productos[k], 'productos'));

            addHeader(tEsp, "Costos y Variables");
            ['precio_espejo_m2', 'extra_espejo_led', 'instalacion_espejo', 'transporte_espejo', 'est_espejo', 'est_espejo_con_otro_trabajo', 'util_espejo'].forEach(k => addInputConfig(tEsp, k, currentConfig.globales[k], 'globales'));

            // --- TAB 4: ESPECIALES (2026-11-19) ---
            const tEspc = document.getElementById('tab-especiales');
            addHeader(tEspc, "Vidrios especiales (costo m², IVA incluido)");
            ['precio_vidrio_serigrafia_6mm', 'precio_vidrio_serigrafia_negra_8mm', 'precio_vidrio_laminado_4_4', 'precio_vidrio_negro_6mm', 'precio_vidrio_5mm'].forEach(k => addInputConfig(tEspc, k, currentConfig.globales[k], 'globales'));
            addHeader(tEspc, "Accesorios (costo por unidad, natural)");
            ['acc_bisagra_muro', 'acc_bisagra_vidrio_vidrio', 'acc_boton', 'acc_tubo_terminales_carro', 'acc_extra_negro_pieza', 'acc_extra_negro_tubo_carro', 'acc_perfil_u_6m'].forEach(k => addInputConfig(tEspc, k, currentConfig.globales[k], 'globales'));
            addHeader(tEspc, "Piezas sueltas (vidrio de reemplazo, costo natural)");
            ['acc_mariposa', 'acc_manija_vertical', 'acc_deslizantes_par', 'acc_deslizantes_par_superior', 'acc_medias_lunas_par',
                'acc_terminales_freno_par', 'acc_tubo_m', 'acc_riel_m', 'acc_guia', 'acc_burbuja', 'acc_barredor', 'acc_boquete', 'acc_l_fija',
                'acc_extra_dorado_pieza', 'transporte_reemplazo', 'precio_instalacion_sola'].forEach(k => addInputConfig(tEspc, k, currentConfig.globales[k], 'globales'));
            addHeader(tEspc, "Adicionales y márgenes propios");
            ['instalacion_adicional', 'precio_repisa_6mm', 'margen_plegable', 'margen_panel_fijo', 'margen_tiras'].forEach(k => addInputConfig(tEspc, k, currentConfig.globales[k], 'globales'));
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
            // Limpiar nombres de variables para que se vean bonitos.
            const deFicha = !!(FICHAS[section] && FICHAS[section][key]);
            label.innerText = etiquetaConfig(key);
            if (deFicha) {
                const marca = document.createElement('span');
                marca.title = 'Sale de las fichas';
                marca.innerText = ' 📋';
                label.appendChild(marca);
            }

            let inp = document.createElement('input');
            inp.type = 'number';
            inp.value = val;
            inp.id = `cfg_${section}_${key}`;

            group.appendChild(label);
            group.appendChild(inp);
            // B8: si este teléfono tiene otro valor que la ficha, se dice cuál es el de la ficha.
            const valorFicha = deFicha ? DEFAULT_CONFIG[section][key] : undefined;
            if (deFicha && val !== valorFicha) {
                inp.style.borderColor = '#ea580c';
                const nota = document.createElement('div');
                nota.className = 'nota-ficha';
                nota.style.cssText = 'font-size:0.75rem;color:#9a3412;margin-top:2px;';
                nota.innerText = `La ficha dice ${fmtValorConfig(valorFicha)}. Este teléfono tiene otro valor.`;
                group.appendChild(nota);
            }
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

        const STALE_SHARE_MESSAGE = 'Los datos cambiaron después del último cálculo. Calcula nuevamente antes de compartir.';

        function main_getShareInputSnapshot() {
            return {
                producto: document.getElementById('producto').value,
                ancho: document.getElementById('ancho').value,
                ancho2: document.getElementById('ancho2').value,
                alto: document.getElementById('alto').value,
                espesor: document.getElementById('espesor').value,
                acabado: document.getElementById('color_acc').value,
                glassFinish: document.getElementById('glass_finish').value,
                led: document.getElementById('check-espejo-led').checked,
                // B8 (2026-11-24): neoangular, espejo con otro trabajo y vidrio de reemplazo
                ancho3: document.getElementById('ancho3').value,
                espejoConOtro: document.getElementById('check-espejo-otro').checked,
                lPuertas: document.getElementById('producto').value === PRODUCTO_L_PREMIUM ? document.getElementById('l_puertas').value : '',
                reemplazo: document.getElementById('producto').value === PRODUCTO_REEMPLAZO
                    ? { pieza: document.getElementById('reemplazo_pieza').value, origen: document.getElementById('reemplazo_origen').value, piezas: leerPiezasReemplazo() }
                    : null,
                cantidad: parseInt(document.getElementById('cantidad-item').value, 10) || 1,
                descuento: parseFloat(document.getElementById('descuento_adicional').value) || 0,
                transporte: parseFloat(document.getElementById('recargo_transporte').value) || 0
            };
        }

        function main_isShareSnapshotCurrent(result) {
            return !!(result && result.shareInputSnapshot)
                && JSON.stringify(result.shareInputSnapshot) === JSON.stringify(main_getShareInputSnapshot());
        }

        function main_sharePriceLines(unitPrice, quantity) {
            const qty = Math.max(1, parseInt(quantity, 10) || 1);
            if (qty === 1) return `💰 *Precio:* ${fmtMoney(unitPrice)}, IVA incluido`;
            return `🔢 *Cantidad:* ${qty}\n`
                + `💰 *Precio unitario:* ${fmtMoney(unitPrice)}\n`
                + `💰 *Total:* ${fmtMoney(unitPrice * qty)}, IVA incluido`;
        }

        function buildMainCommercialMessage(result, folio, fechaEnvio) {
            const raw = result.raw || {};
            const qty = result.shareInputSnapshot?.cantidad || 1;
            const esEspejo = result.producto.includes('Espejo');
            const medidas = result.producto.includes('División de baño L -')
                ? `L(${raw.ancho} + ${raw.ancho2}) x ${raw.alto} cm`
                : raw.ancho3 ? `${raw.ancho} + ${raw.ancho2} + ${raw.ancho3} x ${raw.alto} cm` // neoangular (B8)
                : (raw.ancho && raw.alto ? `${raw.ancho} x ${raw.alto} cm` : `${result.medidas} cm`);
            let texto = `*COTIZACIÓN* 📄\n*N° ${folio}*  ·  ${fechaEnvio}\n----------------------------\n`;

            if (esEspejo) {
                texto += `🔹 *Producto:* Espejo Flotante\n`;
                texto += `🔹 *Medidas:* ${medidas}\n`;
                texto += `🔹 *LED:* ${raw.led ? 'incluido' : 'no incluido'}\n`;
            } else {
                texto += `🔹 *Producto:* ${result.producto}\n`;
                if (raw.reemplazo) texto += `🔹 *Se cambia:* ${raw.reemplazo.descripcion || (raw.reemplazo.pieza === 'fijo' ? 'el fijo' : 'la puerta')}\n`;
                if (raw.l_puertas) texto += `🔹 *Puertas:* ${raw.l_puertas === 2 ? '2 (2 fijos y 2 puertas)' : '1 (2 fijos y 1 puerta)'}\n`;
                texto += `🔹 *Medidas:* ${medidas}\n`;
                if (raw.vidrio_descripcion) texto += `🔹 *Vidrio:* ${raw.vidrio_descripcion}\n`;
                else if (!raw.instalacion_sola) texto += `🔹 *Espesor:* ${raw.espesor}${raw.sandblasting ? ' + sandblasting' : ''}\n`;
                if (raw.color_acc) texto += `🔹 *Acabado:* ${etiquetaColorHerraje(raw.color_acc).toUpperCase()}\n`;
                if (raw.reemplazo) texto += `🔹 *Accesorios:* ${raw.reemplazo.texto || 'sin accesorios'}\n`;
                if (raw.incluye) texto += `🔹 *Incluye:* ${raw.incluye}\n`;
            }

            texto += `🔹 *Instalación:* incluida\n`;
            if (result.services?.transportIncluded) texto += `🔹 *Transporte:* incluido\n`;
            if (raw.plazo_entrega) texto += `🔹 *Entrega:* ${raw.plazo_entrega}\n`;
            texto += `🔹 *Garantía:* ${textoGarantia(result.producto)}\n\n`;
            texto += main_sharePriceLines(result.precio, qty);

            if (!esEspejo && raw.promo_fija_corrediza_economica) {
                const promoColor = raw.promo_fija_corrediza_economica_color || 'natural';
                texto += `\n_Promoción por tiempo limitado para divisiones de hasta 130 cm de ancho, con alto de 180 cm o 190 cm, en vidrio 6 mm color ${promoColor}. Otras medidas o acabados se cotizan a la medida exacta._`;
            }
            texto += `\n📐 *Visita de medidas:* $20.000, se descuentan del total si haces el trabajo.`;
            return `${texto}\n----------------------------`;
        }

        function cartInstallationLabel(item) {
            if (item.esAluminio && item.raw) {
                const selected = String(item.raw.instalacion || '').toLowerCase();
                return ['ninguna', 'sin instalación', 'no incluida'].includes(selected) ? 'no incluida' : 'incluida';
            }
            return 'incluida';
        }

        function aluminumColorLabel(item) {
            return item?.productSpec?.attributes?.frame?.color?.value
                || ((typeof ALU_COLOR_LABELS !== 'undefined' && item?.raw?.color)
                    ? ALU_COLOR_LABELS[item.raw.color]
                    : '')
                || item?.raw?.color
                || 'Natural';
        }

        function buildCartCommercialMessage(items, options) {
            const total = items.reduce((sum, item) => sum + item.precio, 0);
            const discount = options.discount || 0;
            let texto = `*PRESUPUESTO* 📋\n*N° ${options.folio}*  ·  ${options.fecha}\n----------------------------\n`;
            const c = options.cliente || {};
            if (c.nombre) texto += `👤 *Cliente:* ${c.nombre}\n`;
            if (c.obra) texto += `🏠 *Obra:* ${c.obra}\n`;
            if (c.direccion) texto += `📍 ${c.direccion}\n`;
            if (c.telefono) texto += `📞 ${c.telefono}\n`;
            if (c.nombre || c.obra || c.direccion || c.telefono) texto += `----------------------------\n`;

            items.forEach((item, index) => {
                const qty = Math.max(1, item.cantidad || 1);
                const unit = item.precioUnitario || (item.precio / qty);
                texto += `*${index + 1}. ${item.producto}*\n`;
                texto += `   📏 Medidas: ${item.medidas} cm\n`;
                if (item.esAluminio) {
                    texto += `   💎 Vidrio: ${item.vidrio}\n`;
                    if (item.raw?.color) texto += `   🎨 Acabado: ${aluminumColorLabel(item)}\n`;
                } else if (item.producto.includes('Espejo')) {
                    texto += `   ✨ LED: ${item.raw?.led ? 'incluido' : 'no incluido'}\n`;
                } else {
                    if (item.raw?.reemplazo) texto += `   🔁 Se cambia: ${item.raw.reemplazo.descripcion || (item.raw.reemplazo.pieza === 'fijo' ? 'el fijo' : 'la puerta')}\n`;
                    if (item.raw?.l_puertas) texto += `   🚪 Puertas: ${item.raw.l_puertas === 2 ? '2 (2 fijos y 2 puertas)' : '1 (2 fijos y 1 puerta)'}\n`;
                    if (item.vidrioDescripcion) texto += `   💎 Vidrio: ${item.vidrioDescripcion}\n`;
                    else if (!item.raw?.instalacion_sola) texto += `   💎 Espesor: ${item.vidrio}${item.sandblasting ? ' + sandblasting' : ''}\n`;
                    if (item.color) texto += `   🎨 Acabado: ${etiquetaColorHerraje(item.color).toUpperCase()}\n`;
                    if (item.raw?.reemplazo) texto += `   🧩 Accesorios: ${item.raw.reemplazo.texto || 'sin accesorios'}\n`;
                    if (item.raw?.incluye) texto += `   ✅ Incluye: ${item.raw.incluye}\n`;
                    if (item.raw?.instalacion_sola) texto += `   🛡️ Garantía: 3 meses sobre la instalación\n`;
                }
                if (item.plazoEntrega) texto += `   ⏱️ Entrega: ${item.plazoEntrega}\n`;
                texto += `   🔢 Cantidad: ${qty}\n`;
                texto += `   🛠️ Instalación: ${cartInstallationLabel(item)}\n`;
                if ((item.esAluminio && item.raw?.transporte > 0) || item.services?.transportIncluded) {
                    texto += `   🚚 Transporte: incluido\n`;
                }
                texto += `   💲 Precio unitario: ${fmtMoney(unit)}\n`;
                texto += `   💲 Subtotal: ${fmtMoney(item.precio)}\n`;
                if (item.observaciones) texto += `   📝 Nota: ${item.observaciones}\n`;
                texto += `\n`;
            });

            texto += `----------------------------\n`;
            if (discount > 0) {
                texto += `💰 *Subtotal:* ${fmtMoney(total)}\n`;
                texto += `📉 *Descuento:* -${fmtMoney(discount)}\n`;
            }
            texto += `💰 *TOTAL: ${fmtMoney(total - discount)}*, IVA incluido\n`;
            // B8: con alguna división, la garantía dice qué cubre (ficha); si no, como antes.
            // La instalación sola lleva su propia garantía en su renglón; la general es la de lo demás.
            const conGarantiaGeneral = items.filter(item => !item.raw?.instalacion_sola);
            if (conGarantiaGeneral.length) {
                texto += `🛡️ *Garantía:* ${conGarantiaGeneral.some(item => !item.esAluminio && FICHAS.divisiones.includes(item.producto)) ? FICHAS.garantiaDivisiones : '12 meses'}`;
            } else {
                texto = texto.replace(/\n$/, '');
            }
            texto += `\n📐 *Visita de medidas:* $20.000, se descuentan del total si haces el trabajo.`;
            return texto;
        }

        // ==========================================
        // 3. LÓGICA DE NEGOCIO (EL CEREBRO)
        // ==========================================
        function calcular() {
            // Inputs
            let ancho = parseFloat(document.getElementById('ancho').value);
            let ancho2 = parseFloat(document.getElementById('ancho2').value) || 0;
            let alto = parseFloat(document.getElementById('alto').value);
            const anchoCmOriginal = ancho;
            const ancho2CmOriginal = ancho2;
            const altoCmOriginal = alto;

            const prodNombre = document.getElementById('producto').value;
            // Productos del 2026-11-19
            const esPlegable = prodNombre === PRODUCTOS_ESPECIALES.PLEGABLE;
            const esPanelFijo = prodNombre === PRODUCTOS_ESPECIALES.PANEL_FIJO;
            const esTiras = prodNombre === PRODUCTOS_ESPECIALES.TIRAS;
            const esRepisa = prodNombre === PRODUCTOS_ESPECIALES.REPISA;
            // B8: la instalación sola (ficha S3) tiene precio fijo y usa los vidrios y accesorios del cliente.
            const esInstalacionSola = prodNombre === PRODUCTO_INSTALACION_SOLA;
            const esAdicional = esTiras || esRepisa || esInstalacionSola; // va en la misma visita: sin transporte ni estructura
            const repisaSinMedidas = esRepisa && (!ancho || !alto);

            if ((!ancho || !alto) && !esRepisa) {
                toast('Falta ingresar Ancho y Alto', 'warn'); return;
            }

            // Validación: Si escriben valores muy pequeños (ej: 1.2), probablemente pensaron en metros
            if (!esRepisa && (ancho < 10 || alto < 10)) {
                if (!confirm(`Las dimensiones ingresadas (${ancho}cm x ${alto}cm) parecen muy pequeñas. ¿Estás seguro que son CENTÍMETROS y no metros?`)) return;
            }

            // Convertir CM a Metros para el cálculo interno
            ancho = repisaSinMedidas ? 0 : ancho / 100;
            ancho2 = ancho2 / 100;
            alto = repisaSinMedidas ? 0 : alto / 100;

            const espesorSelect = document.getElementById('espesor').value;
            const linea = document.getElementById('linea').value; // controlada / empresa
            const mercado = parseFloat(document.getElementById('mercado').value) || 0;
            const colorAcc = esAdicional ? '' : document.getElementById('color_acc').value;
            const tieneDesmonte = document.getElementById('check-desmonte').checked;
            const glassFinish = esAdicional ? '' : document.getElementById('glass_finish').value;
            const vidrioEspecial = VIDRIOS_ESPECIALES[glassFinish] || null;
            // Espesor real: tiras 5 mm, repisa 6 mm y el que fija cada vidrio especial.
            const espesor = esInstalacionSola ? '' : esTiras ? '5mm' : esRepisa ? '6mm' : (vidrioEspecial ? vidrioEspecial.espesor : espesorSelect);
            // Lo que se muestra al cliente como vidrio, y el plazo cuando no es el normal.
            const vidrioDescripcion = esTiras ? 'Templado incoloro 5 mm'
                : esRepisa ? 'Templado 6 mm'
                : (vidrioEspecial ? vidrioEspecial.label : '');
            let plazoEntrega = plazoSegunFicha(prodNombre, { vidrioEspecial, glassFinish, esTiras });
            const esEspejoSeleccionado = prodNombre.includes("Espejo");
            const pideVidrioYColor = !esEspejoSeleccionado && !esAdicional;
            // B8 (2026-11-24): neoangular (tres anchos), vidrio de reemplazo y espejo con otro trabajo.
            const esNeoangular = prodNombre === PRODUCTO_NEOANGULAR;
            const esReemplazo = prodNombre === PRODUCTO_REEMPLAZO;
            const ancho3CmOriginal = esNeoangular ? (parseFloat(document.getElementById('ancho3').value) || 0) : 0;
            const ancho3 = ancho3CmOriginal / 100;
            const espejoConOtroTrabajo = esEspejoSeleccionado && document.getElementById('check-espejo-otro').checked;
            const reemplazo = esReemplazo ? {
                pieza: document.getElementById('reemplazo_pieza').value || 'puerta',
                origen: document.getElementById('reemplazo_origen').value || 'corrediza',
                piezas: leerPiezasReemplazo()
            } : null;
            // Lo que lee el cliente: piezas y cantidades, sin precios.
            // La puerta de corrediza lleva su burbuja, incluida en el precio (AP3, 2026-11-24).
            if (reemplazo) {
                reemplazo.variante = varianteReemplazo(reemplazo);
                reemplazo.piezasPrecio = piezasConBurbuja(reemplazo);
                reemplazo.texto = textoPiezas(reemplazo.piezasPrecio);
                reemplazo.descripcion = VARIANTES_REEMPLAZO[reemplazo.variante];
            }
            const esLPremium = prodNombre === PRODUCTO_L_PREMIUM;
            const lPuertas = esLPremium ? (Number(document.getElementById('l_puertas').value) === 2 ? 2 : 1) : 0;
            const missingCritical = [
                !prodNombre ? 'producto' : '',
                esNeoangular && (!ancho2CmOriginal || !ancho3CmOriginal) ? 'los tres anchos de la neoangular' : '',
                pideVidrioYColor && !espesor ? 'espesor del vidrio' : '',
                pideVidrioYColor && !glassFinish ? 'acabado del vidrio' : '',
                pideVidrioYColor && !esReemplazo && !colorAcc ? 'color de accesorios/herrajes' : ''
            ].filter(Boolean);
            if (missingCritical.length) {
                toast(`Falta definir ${missingCritical[0]}`, 'warn', 5000);
                return;
            }
            plazoEntrega = plazoSegunFicha(prodNombre, { vidrioEspecial, glassFinish, esTiras, espesor, reemplazoOrigen: reemplazo && reemplazo.origen });
            const tieneSandblasting = glassFinish === 'sandblasted';
            const tieneLed = document.getElementById('check-espejo-led').checked;
            const recargoTransporte = parseFloat(document.getElementById('recargo_transporte').value) || 0;
            const extraAcc = parseFloat(document.getElementById('extra_acc').value) || 0;
            const descuentoAdicional = parseFloat(document.getElementById('descuento_adicional').value) || 0;
            const observaciones = document.getElementById('observaciones').value;

            const cfg = currentConfig.globales;
            const productoNormalizado = prodNombre.normalize
                ? prodNombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
                : prodNombre.toLowerCase();
            const esPromoCorredizaEconomicaNatural = productoNormalizado === 'division corrediza clasica'
                && anchoCmOriginal <= 130
                && (altoCmOriginal === 180 || altoCmOriginal === 190)
                && espesor === '6mm'
                && !vidrioEspecial // especial
                && colorAcc === 'natural';
            const esPromoCorredizaEconomicaNegra = productoNormalizado === 'division corrediza clasica'
                && anchoCmOriginal <= 130
                && (altoCmOriginal === 180 || altoCmOriginal === 190)
                && espesor === '6mm'
                && !vidrioEspecial // especial
                && colorAcc === 'negro';
            const esPromoCorredizaEconomica = esPromoCorredizaEconomicaNatural || esPromoCorredizaEconomicaNegra;
            const precioPromoCorredizaEconomica = esPromoCorredizaEconomicaNegra ? 690000 : 650000;
            
            const esLEspecial = prodNombre.includes("División de baño L -");
            let anchoCalculo = ancho;
            if (esLEspecial) anchoCalculo += ancho2;
            if (esNeoangular) anchoCalculo += ancho2 + ancho3; // ficha D11: los tres anchos sumados

            const area = anchoCalculo * alto;
            const esEspejo = esEspejoSeleccionado;

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

                // El sandblasting ya no sube el vidrio un 30 %: se cobra con el precio de la ficha (V9 y V10), más abajo. // ficha
            }
            // especial: repisa con precio fijo (sin m2), tiras de 5 mm y vidrios especiales por m2
            if (esRepisa) costoVidrioBase = 0; // especial
            else if (esTiras) costoVidrioBase = cfg.precio_vidrio_5mm; // especial
            else if (vidrioEspecial) costoVidrioBase = cfg[vidrioEspecial.precioKey]; // especial
            if (esInstalacionSola) costoVidrioBase = 0; // ficha S3: el vidrio es del cliente

            // Aplica desperdicio (colchon) tanto a vidrio como a espejo
            const costoVidrioTotal = area * costoVidrioBase * cfg.colchon_vidrio;

            // 2. Accesorios
            let costoAluminio = 0;
            let costoLed = 0;
            let baseAcc = currentConfig.productos[prodNombre];
            baseAcc = kitSegunFicha(cfg, prodNombre, baseAcc, espesor, anchoCmOriginal); // ficha
            if (esLPremium) baseAcc = kitLPremium(currentConfig.productos[PRODUCTO_PREMIUM], lPuertas); // ficha D13

            // Ajuste por Color
            if (!esEspejo) {
                if (colorAcc === 'negro') baseAcc += cfg.extra_color_negro;
                if (colorAcc === 'dorado') baseAcc += cfg.extra_color_dorado;
                if (colorAcc === 'oro_rosa') baseAcc += cfg.extra_color_dorado; // ficha
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

            // especial: el kit sale de los accesorios de Configuración → Especiales
            if (esPlegable) costoAcc = costoKitPlegable(cfg, colorAcc); // especial
            if (esPanelFijo) costoAcc = costoPerfilU(cfg, ancho, alto); // especial
            if (esAdicional) costoAcc = 0; // especial
            if (esReemplazo) costoAcc = costoPiezas(cfg, reemplazo.piezasPrecio) + recargoColorPiezas(cfg, reemplazo.piezasPrecio, colorAcc); // ficha M1: pieza por pieza, sin kit
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

            // especial: tiras y repisa van en la misma visita de otro trabajo, sin transporte propio
            if (esAdicional) { costoInstalacion = esTiras ? cfg.instalacion_adicional : 0; costoTransporte = 0; } // especial
            if (esNeoangular) costoInstalacion = cfg.instalacion_L; // ficha D11: instalación como la L
            if (esReemplazo) { costoInstalacion = cfg.instalacion_base; costoTransporte = cfg.transporte_reemplazo; } // ficha M1
            if (espejoConOtroTrabajo) costoTransporte = 0; // ficha E1: va con otro trabajo
            const costoInsumos = cfg.insumos;
            const otros = costoInstalacion + costoTransporte + recargoTransporte + costoInsumos + costoDesmonte;
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
            est = estructuraSegunFicha(cfg, prodNombre, linea, est, ancho); // ficha
            // especial: los adicionales no cargan estructura, ya la paga el trabajo principal
            if (esAdicional) est = 0; // especial
            if (esReemplazo) est = 0; // ficha M1: sin estructura
            if (espejoConOtroTrabajo) est = cfg.est_espejo_con_otro_trabajo; // ficha E1: aporte de $20.000

            const totalCostos = costoDirecto + est;

            // FÓRMULA CLAVE: Margen sobre Venta
            const AJUSTE_COMERCIAL = 1.05;
            const precioBase = esPromoCorredizaEconomica ? precioPromoCorredizaEconomica : totalCostos / (1 - utilPorcentaje);
            let precioFinal = esPromoCorredizaEconomica ? precioPromoCorredizaEconomica : precioBase * AJUSTE_COMERCIAL;
            // especial: repisa con precio fijo al cliente, IVA incluido (Configuración → Especiales)
            if (esRepisa) precioFinal = cfg.precio_repisa_6mm; // especial
            // especial: plegable, panel y tiras con margen propio sobre la venta sin IVA
            const margenEspecial = esPlegable ? cfg.margen_plegable : esPanelFijo ? cfg.margen_panel_fijo : esTiras ? cfg.margen_tiras : null; // especial
            if (margenEspecial !== null) precioFinal = totalCostos * (1 + cfg.iva) / (1 - margenEspecial); // especial
            // ficha: el diseño sandblasting se cobra al cliente con el precio de la ficha, IVA incluido (V9 y V10)
            const precioSandblasting = (tieneSandblasting && !esEspejo) ? precioSandblastingFicha(cfg, anchoCalculo) : 0; // ficha
            precioFinal += precioSandblasting; // ficha
            if (esInstalacionSola) precioFinal = cfg.precio_instalacion_sola; // ficha S3: precio fijo al cliente, IVA incluido

            // Aumento general del 5% sobre el precio final (IVA incluido)
            // Ajuste comercial aplicado arriba; no se suma IVA nuevamente al cliente.

            // Descuento Adicional
            if (!esPromoCorredizaEconomica && descuentoAdicional > 0) {
                precioFinal = Math.max(0, precioFinal - descuentoAdicional);
            }

            const precioCliente = precioFinal;
            const baseGravable = precioCliente / (1 + cfg.iva);
            const ivaADeclarar = precioCliente - baseGravable;
            const gananciaReal = baseGravable - totalCostos;
            const margenReal = baseGravable > 0 ? (gananciaReal / baseGravable) * 100 : 0;
            const ganancia = gananciaReal;

            // Margen Real
            const margen = margenReal;

            // precio final CON IVA incluido (así está estructurada la lista de
            // costos del negocio). NO se le vuelve a sumar IVA. Es el número que
            // se muestra, se guarda en el carrito y se envía por WhatsApp.

            const medidasStr = repisaSinMedidas ? 'hasta 30' : esLEspecial ?
                `L(${Math.round(ancho * 100)}+${Math.round(ancho2 * 100)})x${Math.round(alto * 100)}` :
                esNeoangular ? `${Math.round(ancho * 100)}+${Math.round(ancho2 * 100)}+${Math.round(ancho3 * 100)}x${Math.round(alto * 100)}` :
                `${Math.round(ancho * 100)}x${Math.round(alto * 100)}`;

            const incluye = textoIncluye(prodNombre, usaKitA1b(prodNombre, espesor, anchoCmOriginal), vidrioEspecial);

            // B8: la promoción de la clásica promete 3 días hábiles (Andrés, 2026-11-24).
            plazoEntrega = plazoSegunFicha(prodNombre, { vidrioEspecial, glassFinish, esTiras, esPromocion: esPromoCorredizaEconomica, espesor, reemplazoOrigen: reemplazo && reemplazo.origen,
                juegoHecho: esRutaJuegoHecho(prodNombre, { espesor, glassFinish, colorAcc, anchoCm: anchoCmOriginal, ancho2Cm: ancho2CmOriginal, altoCm: altoCmOriginal }) });

            const canonicalMetadata = buildCanonicalProductMetadata(prodNombre, {
                espesor,
                hasLed: tieneLed,
                hasSandblasting: tieneSandblasting
            });
            const productSpec = window.WilanAgenda?.productSpec?.buildMain({
                metadata: canonicalMetadata,
                productName: prodNombre,
                widthCm: anchoCmOriginal,
                secondaryWidthCm: ancho2CmOriginal,
                heightCm: altoCmOriginal,
                thickness: espesor,
                hardwareColor: colorAcc,
                glassFinish,
                hasLed: tieneLed,
                quantity: 1
            });

            // Guardar cálculo actual para agregar a lista
            lastCalculation = {
                quoteId: newAgendaQuoteId(),
                cantidad: 1,
                producto: prodNombre,
                medidas: medidasStr,
                vidrio: esEspejo ? 'Espejo' : espesor,
                // Solo en vidrios especiales, tiras y repisa: el texto dice «Vidrio: …»
                ...(vidrioDescripcion ? { vidrioDescripcion } : {}),
                ...(plazoEntrega ? { plazoEntrega } : {}),
                sandblasting: tieneSandblasting,
                color: colorAcc,
                precio: precioCliente, // Precio final con IVA incluido (el que se cobra al cliente)
                observaciones: observaciones,
                shareInputSnapshot: main_getShareInputSnapshot(),
                services: {
                    installationIncluded: true,
                    transportIncluded: (costoTransporte + recargoTransporte) > 0
                },
                ...canonicalMetadata,
                ...(productSpec ? { productSpec } : {}),
                // Datos crudos para edición
                raw: {
                    ancho: repisaSinMedidas ? undefined : anchoCmOriginal,
                    ancho2: ancho2CmOriginal,
                    alto: repisaSinMedidas ? undefined : altoCmOriginal,
                    producto: prodNombre,
                    espesor: espesor,
                    ...(vidrioDescripcion ? { vidrio_descripcion: vidrioDescripcion } : {}),
                    ...(plazoEntrega ? { plazo_entrega: plazoEntrega } : {}),
                    linea: linea,
                    mercado: mercado,
                    color_acc: colorAcc,
                    glass_finish: glassFinish,
                    desmonte: tieneDesmonte,
                    led: tieneLed,
                    sandblasting: tieneSandblasting,
                    recargo: recargoTransporte,
                    extra: extraAcc,
                    descuento: descuentoAdicional,
                    promo_fija_corrediza_economica: esPromoCorredizaEconomica,
                    promo_fija_corrediza_economica_color: esPromoCorredizaEconomicaNegra ? 'negro' : (esPromoCorredizaEconomicaNatural ? 'natural' : ''),
                    // B8 (2026-11-24)
                    ...(esNeoangular ? { ancho3: ancho3CmOriginal } : {}),
                    ...(espejoConOtroTrabajo ? { espejo_con_otro_trabajo: true } : {}),
                    ...(reemplazo ? { reemplazo } : {}),
                    ...(esLPremium ? { l_puertas: lPuertas } : {}),
                    ...(esInstalacionSola ? { instalacion_sola: true } : {}),
                    // «Incluye» de la ficha, tal como lo lee el cliente (AP3, 2026-11-24)
                    ...(incluye ? { incluye } : {}),
                    observaciones: observaciones
                }
            };

            window.dispatchEvent(new CustomEvent('wilan:quote-ready', { detail: { source: 'calculation' } }));

            // Guardar en Historial
            guardarHistorial({ ...lastCalculation, fecha: new Date() });

            // Registrar también en el historial del dashboard (no rompe nada si no está cargado)
            if (typeof dash_registrar === 'function') {
                dash_registrar({
                    producto: prodNombre,
                    medidas: medidasStr,
                    precio: precioCliente,
                    fecha: new Date(),
                    origen: 'principal',
                    ...buildCanonicalProductMetadata(prodNombre, {
                        espesor,
                        hasLed: tieneLed,
                        hasSandblasting: tieneSandblasting
                    })
                });
            }

            const detalles = {
                vidrio: costoVidrioTotal,
                aluminio: costoAluminio,
                accesorios: costoAcc,
                led: costoLed,
                instalacion: costoInstalacion,
                transporte: costoTransporte,
                recargoTransporte: recargoTransporte,
                insumos: costoInsumos,
                desmonte: costoDesmonte,
                estructura: est,
                sandblasting: precioSandblasting,
                ganancia: ganancia,
                descuento: descuentoAdicional,
                espesorLabel: esEspejo ? 'Espejo' : (vidrioDescripcion || espesor),
                baseGravable: baseGravable,
                ivaADeclarar: ivaADeclarar,
                gananciaReal: gananciaReal,
                margenReal: margenReal,
                promoFija: esPromoCorredizaEconomica,
                promoLabel: 'Promo fija Corrediza Economica <130cm',
                promoDescuentoIgnorado: esPromoCorredizaEconomica && descuentoAdicional > 0
            };

            mostrarResultados(precioCliente, precioCliente, detalles, margen, mercado);
            const productSpecSummary = window.WilanAgenda?.productSpec?.summary(productSpec);
            const productSpecBox = document.getElementById('main-product-spec-summary');
            if (productSpecBox) {
                productSpecBox.style.display = productSpecSummary ? 'block' : 'none';
                productSpecBox.innerHTML = productSpecSummary
                    ? `<b>${productSpecSummary.critical || 'Especificación pendiente'}</b>${productSpecSummary.secondary ? `<div>${productSpecSummary.secondary}</div>` : ''}${productSpecSummary.status !== 'complete' ? `<div style="color:#b45309;font-weight:700;">⚠️ ${productSpecSummary.missing.length ? `Falta definir ${productSpecSummary.missing.join(', ')}` : 'Requiere revisión canónica manual'}</div>` : ''}`
                    : '';
            }
            actualizarAvisoMinimoPrincipal();

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
            addRow("Recargo Transporte / Lejania", d.recargoTransporte);
            if (d.desmonte > 0) addRow("Desmonte", d.desmonte);
            addRow("Insumos (Silicona/Tornillos)", d.insumos);

            addRow("Aporte Estructura (Fijo)", d.estructura);
            // B8: precio al cliente de la ficha; su costo en el proveedor sigue sin dato.
            if (d.sandblasting > 0) addRow("Diseño sandblasting (precio al cliente, su costo sin dato)", d.sandblasting);

            if (d.descuento > 0 && !d.promoDescuentoIgnorado) {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span style="color:#c62828;">Descuento Adicional</span> <span class="detail-val" style="color:#c62828;">-${fmtMoney(d.descuento)}</span>`;
                lista.appendChild(row);
            } else if (d.promoDescuentoIgnorado) {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span style="color:#0369a1;">Descuento no aplicado por promo</span> <span class="detail-val">${fmtMoney(d.descuento)}</span>`;
                lista.appendChild(row);
            }

            addRow("Base gravable real", d.baseGravable);
            addRow("IVA a declarar", d.ivaADeclarar);
            if (d.gananciaReal !== undefined) {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span>Ganancia real (despues de IVA)</span> <span class="detail-val">${fmtMoney(d.gananciaReal)}</span>`;
                lista.appendChild(row);
            }
            if (d.margenReal !== undefined) {
                const row = document.createElement('div');
                row.className = 'detail-row';
                row.innerHTML = `<span>Margen real (despues de IVA)</span> <span class="detail-val">${d.margenReal.toFixed(1)}%</span>`;
                lista.appendChild(row);
            }

            document.getElementById('res-ganancia').innerText = fmtMoney(d.ganancia);
            document.getElementById('res-margen').innerText = mar.toFixed(1) + "%";

            // Lógica de Comparación con Competencia
            const divComp = document.getElementById('res-comparacion');
            if (d.promoFija) {
                const avisoDescuento = d.promoDescuentoIgnorado
                    ? `<div style="margin-top:6px; color:#b45309; font-weight:700;">Precio promocional cerrado: el descuento adicional no aplica a esta promocion.</div>`
                    : '';
                divComp.innerHTML = `<span style="color:#0369a1; font-weight:700;">${d.promoLabel}</span>${avisoDescuento}`;
                divComp.style.display = 'block';
            } else if (mercado > 0) {
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
                divComp.innerHTML = '';
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
            if (!lastCalculation) {
                toast('Calcula una cotización primero', 'warn');
                return;
            }
            if (!main_isShareSnapshotCurrent(lastCalculation)) {
                toast(STALE_SHARE_MESSAGE, 'warn', 5000);
                return;
            }

            // Folio: el envío individual también consume número (igual que el carrito).
            const folio = folioConsumir();
            const fechaEnvio = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });
            const texto = buildMainCommercialMessage(lastCalculation, folio, fechaEnvio);

            // Bandeja del CRM: queda registrada sin pedir datos y sin demorar el envío.
            window.WilanAgenda?.quoteInbox?.record(window.WilanCotizadorAgendaBridge?.getSingleQuoteContext?.(), folio);

            // Copiar al portapapeles y abrir WhatsApp
            navigator.clipboard.writeText(texto).then(() => toast(`Cotización ${folio} enviada`, 'success', 2500)).catch(err => console.error('Error al copiar', err));
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');

            // El folio se consumió: refrescar el encabezado del carrito si está visible.
            const folioEl = document.getElementById('quote-folio');
            if (folioEl) folioEl.innerText = '#' + folioActual();
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
            document.getElementById('ancho3').value = '';
            ponerPiezasReemplazo({}); // B8: las piezas son de cada vidrio
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
            document.getElementById('glass_finish').selectedIndex = 0;
            document.getElementById('linea').selectedIndex = 0;
            document.getElementById('check-desmonte').checked = false;
            document.getElementById('check-espejo-led').checked = false;
            document.getElementById('check-espejo-otro').checked = false;
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
                    <div style="text-align:right"><div style="font-weight:bold; color:var(--accent-blue);">${fmtMoney(h.precio)}</div><button type="button" class="agenda-history-quote" style="margin-top:4px;border:0;border-radius:6px;padding:5px 8px;background:#eef2ff;color:#4338ca;font-weight:700;cursor:pointer;">Agendar</button></div>
                `;
                row.querySelector('.agenda-history-quote').addEventListener('click', () => {
                    lastCalculation = { ...h, quoteId: h.quoteId || newAgendaQuoteId() };
                    window.dispatchEvent(new CustomEvent('wilan:quote-ready', { detail: { source: 'history' } }));
                    window.WilanAgenda?.ui?.openForm?.(window.WilanCotizadorAgendaBridge?.getQuoteContext?.());
                });
                list.appendChild(row);
            });
        }

        function abrirConfig() { document.getElementById('modal-config').style.display = 'block'; }
        function cerrarConfig() { document.getElementById('modal-config').style.display = 'none'; }

        function guardarConfig() {
            // Leer inputs y actualizar currentConfig
            // Solo los campos que se muestran: los productos especiales no tienen
            // precio base propio (su kit sale de los accesorios).
            for (const [key] of Object.entries(currentConfig.globales)) {
                const input = document.getElementById(`cfg_globales_${key}`);
                let val = input ? parseFloat(input.value) : NaN;
                if (!isNaN(val)) currentConfig.globales[key] = val;
            }
            for (const [key] of Object.entries(currentConfig.productos)) {
                const input = document.getElementById(`cfg_productos_${key}`);
                let val = input ? parseFloat(input.value) : NaN;
                if (!isNaN(val)) currentConfig.productos[key] = val;
            }

            localStorage.setItem('vidrios_config', JSON.stringify(currentConfig));
            // Guardar = alguien revisó los valores: el aviso del kit premium ya no sale.
            try { localStorage.setItem(KIT_PREMIUM.marca, 'revisado'); } catch (_) { /* no bloquea */ }
            // B8: lo distinto de las fichas queda revisado; se vuelve a avisar si la ficha cambia.
            marcarFichasRevisadas(DEFAULT_CONFIG, localStorage);
            toast('Configuración guardada', 'success');
            cerrarConfig();
            document.getElementById('lbl-desmonte-val').innerText = fmtMoney(currentConfig.globales.desmonte);
            // Recargar para aplicar cambios en selects si hubo cambios
            location.reload();
        }

        // B8: vuelve a las fichas solo lo que este teléfono tenía distinto; lo demás no cambia.
        function usarValoresDeFichas() {
            const distintos = (avisoFichas && avisoFichas.distintos) || [];
            if (!distintos.length) return;
            const lista = distintos.map(d => `• ${etiquetaConfig(d.clave)}: ${fmtValorConfig(d.valor)} → ${fmtValorConfig(d.ficha)}`).join('\n');
            if (!confirm(`¿Usar los valores de las fichas en este teléfono?\n\n${lista}`)) return;
            distintos.forEach(({ seccion, clave, ficha }) => { currentConfig[seccion][clave] = ficha; });
            localStorage.setItem('vidrios_config', JSON.stringify(currentConfig));
            marcarFichasRevisadas(DEFAULT_CONFIG, localStorage);
            toast('Valores de las fichas puestos en este teléfono', 'success');
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
            itemToAdd.quoteId = quoteItems[0]?.quoteId || itemToAdd.quoteId;
            itemToAdd.cantidad = qty;
            itemToAdd.precioUnitario = itemToAdd.precio;
            itemToAdd.precio = itemToAdd.precio * qty;
            if (itemToAdd.productSpec && window.WilanAgenda?.productSpec) {
                const attributes = JSON.parse(JSON.stringify(itemToAdd.productSpec.attributes));
                attributes.dimensions.quantity = window.WilanAgenda.productSpec.confirmed(qty, 'unit');
                itemToAdd.productSpec = window.WilanAgenda.productSpec.create(itemToAdd.productSpec.identity, attributes);
            }

            quoteItems.push(itemToAdd);
            persistirCarrito();
            renderQuote();
            window.dispatchEvent(new CustomEvent('wilan:quote-ready', { detail: { source: 'cart' } }));
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
                actualizarAvisoMinimoPrincipal();
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
                const specSummary = window.WilanAgenda?.productSpec?.summary(item.productSpec);
                const specHtml = specSummary
                    ? `<div style="margin-top:5px; font-weight:800; color:#111827;">${specSummary.critical || 'Especificación pendiente'}</div>
                       ${specSummary.secondary ? `<div style="font-size:0.78rem; color:#4b5563;">${specSummary.secondary}</div>` : ''}
                       ${specSummary.status !== 'complete' ? `<div style="margin-top:4px; color:#b45309; font-weight:700;">⚠️ ${specSummary.missing.length ? `Falta definir ${specSummary.missing.join(', ')}` : 'Requiere revisión canónica manual'}</div>` : ''}`
                    : '';

                // Línea de detalles distinta según el tipo de producto
                let detallesLinea;
                if (item.esAluminio) {
                    const colorLbl = aluminumColorLabel(item);
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
                        ${specHtml}
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
            pintarAvisoMinimoSalida(document.getElementById('aviso-minimo-cart'), textoAvisoMinimoSalida(quoteItems, final));
            actualizarAvisoMinimoPrincipal();
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
            btn.textContent = 'Deshacer';
            btn.style.cssText = 'background:rgba(255,255,255,0.95);color:#1565c0;border:none;border-radius:6px;padding:5px 12px;cursor:pointer;font-weight:800;flex-shrink:0;';

            let resuelto = false;
            const cerrar = () => { if (el.parentNode) el.parentNode.removeChild(el); };

            btn.onclick = () => {
                if (resuelto) return;
                resuelto = true;
                const pos = Math.min(index, quoteItems.length);
                quoteItems.splice(pos, 0, item);
                persistirCarrito();
                renderQuote();
                cerrar();
                toast('Ítem restaurado', 'success', 2000);
            };

            el.appendChild(btn);
            cont.appendChild(el);
            setTimeout(() => { if (!resuelto) cerrar(); }, 5000);
        }

        function duplicarItem(index) {
            const item = quoteItems[index];
            if (!item) return;
            // Deep clone para evitar referencias compartidas
            const copia = JSON.parse(JSON.stringify(item));
            // Insertar la copia justo después del original
            quoteItems.splice(index + 1, 0, copia);
            persistirCarrito();
            renderQuote();
            toast('Ítem duplicado', 'success');
        }

        function editarItem(index) {
            const item = quoteItems[index];
            if (!item || !item.raw) return;

            // Si es un item de ALUMINIO, abrir el módulo de aluminio con datos cargados
            if (item.esAluminio) {
                // Setear el estado del módulo aluminio según el item
                aluState.sistema     = item.raw.sistema || '5020';
                aluState.config      = item.raw.config  || '2N';
                aluState.vidrio      = item.raw.espesor || '6mm';
                aluState.color       = item.raw.color   || 'natural';
                aluState.instalacion = item.raw.instalacion || 'basica';
                aluSpecConfirmed = item.productSpec
                    ? { sistema: true, config: true, vidrio: true, color: true }
                    : { sistema: false, config: false, vidrio: false, color: false };

                // Borrar el item del carrito antes de editar (se vuelve a agregar después)
                borrarItem(index, true);

                // Abrir vista aluminio
                abrirVistaAluminio();

                // Esperar el render y poblar valores
                setTimeout(() => {
                    document.getElementById('alu-ancho').value = item.raw.ancho;
                    document.getElementById('alu-alto').value  = item.raw.alto;
                    if (item.raw.extras) {
                        document.getElementById('alu-extra-cf').checked        = !!item.raw.extras.cf;
                        document.getElementById('alu-extra-alfajia').checked   = !!item.raw.extras.alfajia;
                        document.getElementById('alu-extra-mosquitero').checked= !!item.raw.extras.mosquitero;
                        if (item.raw.extras.cf) {
                            document.getElementById('alu-cf-medidas').style.display = 'block';
                            document.getElementById('alu-cf-ancho').value = item.raw.extras.cfAncho || '';
                            document.getElementById('alu-cf-alto').value  = item.raw.extras.cfAlto  || '';
                        }
                        if (item.raw.extras.basculanteAlto) {
                            const elBasc = document.getElementById('alu-basc-alto');
                            if (elBasc) elBasc.value = item.raw.extras.basculanteAlto;
                        }
                        if (item.raw.extras.hojaBatAncho) {
                            const elHoja = document.getElementById('alu-hojabat-ancho');
                            if (elHoja) elHoja.value = item.raw.extras.hojaBatAncho;
                        }
                    }
                    if (item.raw.transporte) document.getElementById('alu-transporte').value = item.raw.transporte;
                    if (item.raw.descuento)  document.getElementById('alu-descuento').value  = item.raw.descuento;
                    if (item.cantidad)       document.getElementById('alu-cantidad').value   = item.cantidad;
                    alu_calcular();
                }, 100);
                return;
            }

            // Si es item del cotizador principal (divisiones, espejos)
            document.getElementById('producto').value = item.raw.producto;
            document.getElementById('ancho').value = item.raw.ancho;
            if (item.raw.ancho2) document.getElementById('ancho2').value = item.raw.ancho2;
            document.getElementById('alto').value = item.raw.alto;
            document.getElementById('espesor').value = item.raw.espesor;
            document.getElementById('color_acc').value = item.raw.color_acc;
            document.getElementById('glass_finish').value = item.raw.glass_finish || '';
            document.getElementById('linea').value = item.raw.linea;
            document.getElementById('mercado').value = item.raw.mercado || '';
            document.getElementById('recargo_transporte').value = item.raw.recargo || '';
            document.getElementById('extra_acc').value = item.raw.extra || '';
            document.getElementById('descuento_adicional').value = item.raw.descuento || '';
            document.getElementById('observaciones').value = item.raw.observaciones || '';
            document.getElementById('check-desmonte').checked = item.raw.desmonte;
            document.getElementById('check-espejo-led').checked = item.raw.led || false;
            // B8 (2026-11-24): neoangular, espejo con otro trabajo y vidrio de reemplazo
            document.getElementById('ancho3').value = item.raw.ancho3 || '';
            document.getElementById('check-espejo-otro').checked = !!item.raw.espejo_con_otro_trabajo;
            if (item.raw.reemplazo) {
                document.getElementById('reemplazo_pieza').value = item.raw.reemplazo.pieza || 'puerta';
                document.getElementById('reemplazo_origen').value = item.raw.reemplazo.origen || 'corrediza';
            }
            ponerPiezasReemplazo(item.raw.reemplazo ? item.raw.reemplazo.piezas : {});
            verificarProducto();

            document.getElementById('estrategia-content').style.display = 'block';
            document.getElementById('arrow-estrategia').style.transform = 'rotate(180deg)';

            // Borrar de la lista, recalcular y subir para editar
            borrarItem(index, true);
            calcular();
            if (item.cantidad) {
                document.getElementById('cantidad-item').value = item.cantidad;
            }
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }

        function limpiarCotizacion() {
            if (confirm('¿Borrar toda la lista de cotización (incluyendo datos del cliente)?')) {
                quoteItems = [];
                persistirCarrito();
                limpiarCliente();
                folioLiberar(); // el carrito vacío suelta el número reservado
                renderQuote();
            }
        }

        function compartirCompleto() {
            if (quoteItems.length === 0) return;

            let discount = parseFloat(document.getElementById('quote-discount').value) || 0;

            // Consumir el folio: este es el momento del envío, así que el número
            // queda fijado para esta cotización y el contador avanza.
            const folio = folioConsumir();
            const fechaEnvio = new Date().toLocaleDateString('es-CO', { day:'2-digit', month:'2-digit', year:'numeric' });

            const texto = buildCartCommercialMessage(quoteItems, {
                folio,
                fecha: fechaEnvio,
                cliente: clienteActual,
                discount
            });

            // Bandeja del CRM: queda registrada sin pedir datos y sin demorar el envío.
            window.WilanAgenda?.quoteInbox?.record(window.WilanCotizadorAgendaBridge?.getQuoteContext?.(), folio);

            navigator.clipboard.writeText(texto).then(() => toast(`Cotización ${folio} enviada`, 'success', 2500)).catch(err => console.error('Error al copiar', err));

            // El folio ya se consumió: refrescar el encabezado para que, si se
            // vuelve a enviar este mismo carrito, tome un número nuevo.
            const folioEl = document.getElementById('quote-folio');
            if (folioEl) folioEl.innerText = '#' + folioActual();

            // Si hay teléfono del cliente, abrir WhatsApp directo a su número
            const tel = (clienteActual.telefono || '').replace(/\D/g, '');
            if (tel.length >= 7) {
                // Asumir Colombia (+57) si son 10 dígitos sin código de país
                const numFinal = (tel.length === 10) ? '57' + tel : tel;
                window.open(`https://wa.me/${numFinal}?text=${encodeURIComponent(texto)}`, '_blank');
            } else {
                window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
            }
        }
        

        // Puente aditivo de solo lectura para Agenda. No altera cálculos,
        // carrito, folios ni datos históricos del Cotizador.
        window.WilanCotizadorAgendaBridge = Object.freeze({
            // Cotización individual (aunque haya carrito): para la bandeja del CRM.
            getSingleQuoteContext: function () {
                if (!lastCalculation) return null;
                const total = Number(lastCalculation.precio || 0);
                return JSON.parse(JSON.stringify({
                    quoteId: lastCalculation.quoteId,
                    items: [lastCalculation],
                    subtotal: total,
                    discount: 0,
                    total: total,
                    folio: '',
                    customer: {}
                }));
            },
            getQuoteContext: function () {
                const cartVisible = quoteItems.length > 0;
                const items = cartVisible ? quoteItems : (lastCalculation ? [lastCalculation] : []);
                if (!items.length) return null;
                const discountInput = document.getElementById('quote-discount');
                const requestedDiscount = cartVisible ? Math.max(0, parseFloat(discountInput && discountInput.value) || 0) : 0;
                const subtotal = items.reduce((sum, item) => sum + Number(item.precio || 0), 0);
                const total = Math.max(0, subtotal - requestedDiscount);
                const discount = subtotal - total;
                const folioText = cartVisible ? (document.getElementById('quote-folio')?.innerText || '') : '';
                return JSON.parse(JSON.stringify({
                    quoteId: cartVisible ? quoteItems[0]?.quoteId : lastCalculation?.quoteId,
                    items: items,
                    subtotal: subtotal,
                    discount: discount,
                    total: total,
                    folio: folioText.replace(/^#/, ''),
                    customer: {
                        name: clienteActual.nombre || '',
                        phone: clienteActual.telefono || '',
                        address: clienteActual.direccion || '',
                        project: clienteActual.obra || ''
                    }
                }));
            }
        });

        // Iniciar la aplicación
        init();
