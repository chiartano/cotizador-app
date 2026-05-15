/* ================================================================
 * COTIZADOR PRO - Módulo independiente: Comparador lado a lado
 * Permite cotizar el mismo vano con 2 sistemas distintos para que
 * el cliente decida (ej: VC5020 económica vs PC744 tradicional).
 * Todo prefijado con cmp_ / CMP_ para no colisionar con el resto.
 * ================================================================ */
"use strict";

// =================================================================
// ESTADO
// =================================================================
let cmp_contexto = null;     // 'principal' | 'aluminio'
let cmp_baseSnapshot = null; // datos de entrada congelados al abrir
let cmp_resultadoA = null;
let cmp_resultadoB = null;

// =================================================================
// UI - APERTURA DEL MODAL
// =================================================================
function cmp_abrirDesdeMain() {
    // Llamado por el botón "🔀 Comparar" del cotizador principal
    if (typeof lastCalculation === 'undefined' || !lastCalculation) {
        toast('Calcula una cotización primero', 'warn');
        return;
    }
    cmp_contexto = 'principal';
    cmp_baseSnapshot = JSON.parse(JSON.stringify(lastCalculation.raw));
    cmp_baseSnapshot.precioActual = lastCalculation.precio;
    cmp_abrirModal();
}

function cmp_abrirDesdeAluminio() {
    // Llamado por el botón "🔀 Comparar" del cotizador de aluminio
    if (typeof aluLastCalc === 'undefined' || !aluLastCalc) {
        toast('Calcula una cotización primero', 'warn');
        return;
    }
    cmp_contexto = 'aluminio';
    cmp_baseSnapshot = {
        sys: aluLastCalc.sys,
        cfg: aluLastCalc.cfg,
        vid: aluLastCalc.vid,
        col: aluLastCalc.col,
        tipoInst: aluLastCalc.tipoInst,
        w: aluLastCalc.w,
        h: aluLastCalc.h,
        precioActual: aluLastCalc.precioFinal
    };
    cmp_abrirModal();
}

function cmp_abrirModal() {
    const modal = document.getElementById('cmp-modal');
    if (!modal) { console.warn('Modal de comparación no existe'); return; }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Llenar selectores de alternativas según contexto
    cmp_poblarSelectores();
    cmp_recalcularAmbos();
}

function cmp_cerrarModal() {
    const modal = document.getElementById('cmp-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function cmp_fmt(num) {
    return "$" + Math.round(num).toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

// =================================================================
// POBLAR SELECTORES (las alternativas dependen del contexto)
// =================================================================
function cmp_poblarSelectores() {
    const selA = document.getElementById('cmp-select-a');
    const selB = document.getElementById('cmp-select-b');
    selA.innerHTML = '';
    selB.innerHTML = '';

    let opciones = [];
    let actual = '';

    if (cmp_contexto === 'principal') {
        // Lista de productos del cotizador principal
        opciones = Object.keys(currentConfig.productos);
        actual = cmp_baseSnapshot.producto;
    } else {
        // Sistemas de aluminio
        opciones = Object.keys(aluConfig.sistemas).map(k => ({
            id: k,
            label: aluConfig.sistemas[k].nombre
        }));
        actual = cmp_baseSnapshot.sys;
    }

    opciones.forEach(opt => {
        const id = (typeof opt === 'string') ? opt : opt.id;
        const label = (typeof opt === 'string') ? opt : opt.label;

        const o1 = document.createElement('option');
        o1.value = id; o1.textContent = label;
        selA.appendChild(o1);

        const o2 = document.createElement('option');
        o2.value = id; o2.textContent = label;
        selB.appendChild(o2);
    });

    // A = actual; B = sugerencia de alternativa (la siguiente en la lista)
    selA.value = actual;
    const idsList = (typeof opciones[0] === 'string') ? opciones : opciones.map(o => o.id);
    const idxActual = idsList.indexOf(actual);
    const idxAlt = (idxActual + 1) % idsList.length;
    selB.value = idsList[idxAlt];
}

// =================================================================
// RECÁLCULO PARA AMBAS COLUMNAS
// =================================================================
function cmp_recalcularAmbos() {
    const idA = document.getElementById('cmp-select-a').value;
    const idB = document.getElementById('cmp-select-b').value;

    if (cmp_contexto === 'principal') {
        cmp_resultadoA = cmp_calcularPrincipal(idA);
        cmp_resultadoB = cmp_calcularPrincipal(idB);
    } else {
        cmp_resultadoA = cmp_calcularAluminio(idA);
        cmp_resultadoB = cmp_calcularAluminio(idB);
    }

    cmp_renderColumna('a', cmp_resultadoA, idA);
    cmp_renderColumna('b', cmp_resultadoB, idB);
    cmp_renderResumenDiferencia();
}

// =================================================================
// MOTOR DE CÁLCULO — COTIZADOR PRINCIPAL
// Replica la lógica de app.js::calcular() pero recibiendo el producto
// como parámetro y leyendo el resto del snapshot (mismas medidas, etc).
// =================================================================
function cmp_calcularPrincipal(productoAlt) {
    const s = cmp_baseSnapshot;
    const cfg = currentConfig.globales;

    // Convertir medidas (que están en cm en el snapshot) a metros
    const ancho  = (s.ancho  || 0) / 100;
    const ancho2 = (s.ancho2 || 0) / 100;
    const alto   = (s.alto   || 0) / 100;

    const esLEspecial = productoAlt.includes("División de baño L -");
    let anchoCalculo = ancho;
    if (esLEspecial) anchoCalculo += ancho2;
    const area = anchoCalculo * alto;
    const esEspejo = productoAlt.includes("Espejo");

    const espesor = s.espesor;
    const linea = s.linea;
    const colorAcc = s.color_acc;
    const tieneDesmonte = s.desmonte;
    const tieneSandblasting = s.sandblasting;
    const tieneLed = s.led;
    const recargoTransporte = s.recargo || 0;
    const extraAcc = s.extra || 0;
    const descuentoAdicional = s.descuento || 0;

    // ---- Costo vidrio ----
    let precioVidrio;
    if (esEspejo) {
        precioVidrio = cfg.precio_espejo_m2;
    } else {
        if (espesor === '6mm') precioVidrio = cfg.precio_vidrio_6mm;
        else if (espesor === '10mm') precioVidrio = cfg.precio_vidrio_10mm;
        else precioVidrio = cfg.precio_vidrio_8mm;
    }
    let costoVidrioTotal = precioVidrio * area * cfg.colchon_vidrio;
    if (tieneSandblasting && !esEspejo) {
        costoVidrioTotal *= (1 + cfg.extra_sandblasting_porc);
    }

    // ---- Accesorios ----
    let baseAcc = currentConfig.productos[productoAlt];
    if (baseAcc === undefined) {
        // Producto no existe en la config — devolvemos un placeholder
        return { error: true, mensaje: 'Producto no disponible' };
    }
    let extraColor = 0;
    if (colorAcc === 'negro') extraColor = cfg.extra_color_negro;
    else if (colorAcc === 'dorado') extraColor = cfg.extra_color_dorado;

    const logica = LOGICA_ACCESORIOS[productoAlt] || "FIJO";
    let costoAcc;
    if (logica === "ANCHO") {
        costoAcc = baseAcc * anchoCalculo;
    } else {
        costoAcc = baseAcc;
    }
    costoAcc += extraColor + extraAcc;

    // ---- LED para espejo ----
    let costoLed = 0;
    if (esEspejo && tieneLed) costoLed = cfg.extra_espejo_led;

    // ---- Aluminio (perfilería ligera para divisiones, no es aluminio.js) ----
    let costoAluminio = 0;
    const esCorrediza = productoAlt.toLowerCase().includes('corrediza');
    if (esCorrediza && !esEspejo) {
        costoAluminio = 0; // ya está embebido en baseAcc en la mayoría de casos
    }

    // ---- Instalación / transporte / insumos ----
    let costoInstalacion = esEspejo ? cfg.instalacion_espejo :
                           (esLEspecial ? cfg.instalacion_L : cfg.instalacion_base);
    let costoTransporte = (esEspejo ? cfg.transporte_espejo : cfg.transporte) + recargoTransporte;
    let costoInsumos = cfg.insumos;
    let costoDesmonte = tieneDesmonte ? cfg.desmonte : 0;

    // ---- Estructura y utilidad ----
    let est, utilPorcentaje;
    if (esEspejo) {
        est = cfg.est_espejo;
        utilPorcentaje = cfg.util_espejo;
    } else if (linea === 'controlada') {
        est = cfg.est_controlada;
        utilPorcentaje = cfg.util_controlada;
    } else {
        est = cfg.est_empresa;
        utilPorcentaje = cfg.util_empresa;
    }

    const costoDirecto = costoVidrioTotal + costoAcc + costoLed + costoAluminio
                       + costoInstalacion + costoTransporte + costoInsumos + costoDesmonte;
    const totalCostos = costoDirecto + est;
    let precioSinIva = totalCostos / (1 - utilPorcentaje);
    let precioFinal = precioSinIva * (1 + cfg.iva);

    if (descuentoAdicional > 0) {
        precioFinal -= descuentoAdicional;
        precioSinIva = precioFinal / (1 + cfg.iva);
    }

    return {
        error: false,
        precioNeto: precioSinIva,
        precioFinal: precioFinal,
        producto: productoAlt,
        desglose: {
            vidrio: costoVidrioTotal,
            accesorios: costoAcc,
            led: costoLed,
            instalacion: costoInstalacion,
            transporte: costoTransporte,
            insumos: costoInsumos,
            desmonte: costoDesmonte,
            estructura: est
        }
    };
}

// =================================================================
// MOTOR DE CÁLCULO — ALUMINIO
// En lugar de re-implementar 300 líneas de alu_calcular, hacemos un
// truco: cambiamos aluState.sistema temporalmente, llamamos al motor,
// capturamos el resultado y restauramos. Es seguro porque alu_calcular
// es síncrona y deja aluLastCalc actualizado.
// =================================================================
function cmp_calcularAluminio(sysAlt) {
    if (!aluConfig.sistemas[sysAlt]) {
        return { error: true, mensaje: 'Sistema no disponible' };
    }

    // Guardar estado original
    const sysOriginal = aluState.sistema;
    const lastCalcOriginal = aluLastCalc;

    // Forzar el sistema alternativo (manteniendo todo lo demás del snapshot)
    aluState.sistema = sysAlt;

    // Activar modo silencioso: alu_calcular NO repintará UI ni registrará historial
    window.__cmp_silent_calc = true;

    // Restablecer inputs en el DOM al snapshot, ya que alu_calcular los lee
    // (los inputs ya están con esos valores, así que no movemos nada visible)
    try {
        // Verificar si el sistema soporta la configuración actual
        // Sistemas: 5020/744 = corredizas (2N/3N/4N/CF), 3831 = abatible (1H/2H...), 8025 = puerta
        // Si la cfg no es compatible, ajustamos a una equivalente más cercana
        const cfg = cmp_baseSnapshot.cfg;
        const esCorrediza = (sysAlt === '5020' || sysAlt === '744');
        const cfgCorrediza = ['2N','3N','4N','CF'].includes(cfg);
        const cfgAbatible = ['1H','2H','1B_CF','2B_CF','OX','OXO'].includes(cfg);

        let cfgAjustada = cfg;
        if (esCorrediza && !cfgCorrediza) cfgAjustada = '2N';
        if (sysAlt === '3831' && !cfgAbatible) cfgAjustada = '2H';
        if (sysAlt === '8025' && !cfgCorrediza) cfgAjustada = '2N';

        const cfgOriginalState = aluState.config;
        aluState.config = cfgAjustada;

        // Ejecutar el motor real (retorna el resultado en modo silencioso)
        const resultado = alu_calcular();

        // Restaurar todo
        aluState.sistema = sysOriginal;
        aluState.config = cfgOriginalState;
        aluLastCalc = lastCalcOriginal;
        window.__cmp_silent_calc = false;

        if (!resultado) return { error: true, mensaje: 'Cálculo falló' };

        return {
            error: false,
            precioNeto: resultado.precioVenta,
            precioFinal: resultado.precioFinal,
            producto: aluConfig.sistemas[sysAlt].nombre,
            cfgAjustada: cfgAjustada !== cfg ? ALU_CONFIG_LABELS[cfgAjustada].label : null,
            desglose: {
                materiales: resultado.totalAlu + resultado.totalVid,
                accesorios: resultado.totalAcc,
                manoObra: resultado.costoMO,
                instalacion: resultado.costoInst,
                transporte: resultado.transporte,
                utilidad: resultado.utilidad
            }
        };
    } catch(e) {
        // Restaurar en caso de error
        aluState.sistema = sysOriginal;
        aluLastCalc = lastCalcOriginal;
        window.__cmp_silent_calc = false;
        return { error: true, mensaje: 'Error: ' + e.message };
    }
}

// =================================================================
// RENDER DE COLUMNAS
// =================================================================
function cmp_renderColumna(letra, r, id) {
    const col = document.getElementById(`cmp-col-${letra}`);
    if (!col) return;

    if (r.error) {
        col.innerHTML = `<div class="cmp-error">⚠️ ${r.mensaje}</div>`;
        return;
    }

    let nombre = r.producto;
    // Acortar nombres largos para que entren bien
    if (nombre.length > 30) nombre = nombre.substring(0, 28) + '…';

    let avisoCfg = '';
    if (r.cfgAjustada) {
        avisoCfg = `<div class="cmp-aviso">ℹ️ Diseño ajustado: ${r.cfgAjustada}</div>`;
    }

    let desgloseHTML = '';
    if (r.desglose) {
        const items = Object.entries(r.desglose).filter(([k,v]) => v > 0);
        if (items.length > 0) {
            desgloseHTML = items.map(([k,v]) => {
                const label = cmp_labelDesglose(k);
                return `<div class="cmp-desg-row"><span>${label}</span><span>${cmp_fmt(v)}</span></div>`;
            }).join('');
        }
    }

    col.innerHTML = `
        <div class="cmp-col-header">
            <div class="cmp-col-titulo" title="${r.producto}">${nombre}</div>
            ${avisoCfg}
        </div>
        <div class="cmp-precio-grande">${cmp_fmt(r.precioFinal)}</div>
        <div class="cmp-precio-sub">Total con IVA</div>
        <div class="cmp-precio-neto">Neto: ${cmp_fmt(r.precioNeto)}</div>

        <button class="cmp-toggle-desglose" onclick="cmp_toggleDesglose('${letra}')">
            <span id="cmp-toggle-text-${letra}">Ver desglose ▾</span>
        </button>
        <div class="cmp-desglose" id="cmp-desglose-${letra}" style="display:none;">
            ${desgloseHTML || '<div class="cmp-empty">Sin desglose disponible</div>'}
        </div>

        <button class="cmp-btn-usar" onclick="cmp_usarOpcion('${letra}')">
            ✓ Usar esta
        </button>
    `;
}

function cmp_labelDesglose(key) {
    const map = {
        vidrio: '🪟 Vidrio',
        accesorios: '🔧 Accesorios',
        led: '💡 LED',
        instalacion: '🛠️ Instalación',
        transporte: '🚚 Transporte',
        insumos: '🔩 Insumos',
        desmonte: '🧰 Desmonte',
        estructura: '🏢 Estructura',
        materiales: '🪨 Materiales',
        manoObra: '👷 Mano de obra',
        utilidad: '💰 Utilidad'
    };
    return map[key] || key;
}

function cmp_toggleDesglose(letra) {
    const el = document.getElementById(`cmp-desglose-${letra}`);
    const txt = document.getElementById(`cmp-toggle-text-${letra}`);
    if (!el) return;
    if (el.style.display === 'none') {
        el.style.display = 'block';
        txt.innerText = 'Ocultar desglose ▴';
    } else {
        el.style.display = 'none';
        txt.innerText = 'Ver desglose ▾';
    }
}

// =================================================================
// RESUMEN DE DIFERENCIA
// =================================================================
function cmp_renderResumenDiferencia() {
    const el = document.getElementById('cmp-resumen-dif');
    if (!el) return;

    if (cmp_resultadoA.error || cmp_resultadoB.error) {
        el.style.display = 'none';
        return;
    }

    const a = cmp_resultadoA.precioFinal;
    const b = cmp_resultadoB.precioFinal;
    const diff = b - a;
    const pct = a > 0 ? (diff / a) * 100 : 0;

    if (Math.abs(diff) < 1) {
        el.innerHTML = `<span class="cmp-dif-equal">≈ Precios prácticamente iguales</span>`;
    } else if (diff > 0) {
        el.innerHTML = `Opción B es <b>${cmp_fmt(diff)}</b> más cara (<b>+${pct.toFixed(1)}%</b>)`;
    } else {
        el.innerHTML = `Opción B ahorra <b>${cmp_fmt(Math.abs(diff))}</b> (<b>${pct.toFixed(1)}%</b>)`;
    }
    el.style.display = 'block';
}

// =================================================================
// "USAR ESTA" — carga la opción seleccionada en el formulario base
// =================================================================
function cmp_usarOpcion(letra) {
    const r = (letra === 'a') ? cmp_resultadoA : cmp_resultadoB;
    const id = (letra === 'a')
        ? document.getElementById('cmp-select-a').value
        : document.getElementById('cmp-select-b').value;

    if (!r || r.error) {
        toast('Esa opción no se puede aplicar', 'warn');
        return;
    }

    if (cmp_contexto === 'principal') {
        // Cambiar el producto seleccionado y recalcular
        document.getElementById('producto').value = id;
        verificarProducto();
        cmp_cerrarModal();
        // Recalcular para refrescar el panel de resultado
        setTimeout(() => calcular(), 100);
        toast(`Aplicada: ${id}`, 'success');
    } else {
        // Aluminio: actualizar chips y recalcular
        aluState.sistema = id;
        if (typeof alu_renderChips === 'function') alu_renderChips();
        if (typeof alu_renderPreview === 'function') alu_renderPreview();
        cmp_cerrarModal();
        setTimeout(() => alu_calcular(), 100);
        toast(`Aplicada: ${aluConfig.sistemas[id].nombre}`, 'success');
    }
}

// =================================================================
// COMPARTIR LA COMPARACIÓN POR WHATSAPP
// =================================================================
function cmp_compartir() {
    if (!cmp_resultadoA || !cmp_resultadoB ||
        cmp_resultadoA.error || cmp_resultadoB.error) {
        toast('No hay comparación válida para compartir', 'warn');
        return;
    }

    const a = cmp_resultadoA;
    const b = cmp_resultadoB;
    const diff = Math.abs(b.precioFinal - a.precioFinal);
    const esMasCara = b.precioFinal > a.precioFinal;

    let medidasStr = '';
    if (cmp_contexto === 'principal') {
        medidasStr = `${cmp_baseSnapshot.ancho}×${cmp_baseSnapshot.alto} cm`;
    } else {
        medidasStr = `${cmp_baseSnapshot.w}×${cmp_baseSnapshot.h} cm`;
    }

    let texto = `🔀 *COMPARACIÓN DE OPCIONES*\n`;
    texto += `📐 Medidas: ${medidasStr}\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n\n`;
    texto += `*OPCIÓN A:* ${a.producto}\n`;
    texto += `💰 Total con IVA: ${cmp_fmt(a.precioFinal)}\n\n`;
    texto += `*OPCIÓN B:* ${b.producto}\n`;
    texto += `💰 Total con IVA: ${cmp_fmt(b.precioFinal)}\n\n`;
    texto += `━━━━━━━━━━━━━━━━━━━\n`;
    if (diff < 1) {
        texto += `📊 Precios prácticamente iguales\n`;
    } else {
        texto += `📊 Diferencia: ${cmp_fmt(diff)}`;
        texto += esMasCara ? ` (B es más cara)\n` : ` (B ahorra)\n`;
    }
    texto += `\n📅 Validez: 15 días.`;

    navigator.clipboard.writeText(texto)
        .then(() => toast('Texto copiado', 'info', 2000))
        .catch(() => {});
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
}