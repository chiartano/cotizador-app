/* ================================================================
 * COTIZADOR PRO v5.0 - Módulo independiente: GENERADOR VISUAL
 * Crea una tarjeta de cotización profesional (PNG) lista para WhatsApp.
 * Incluye: marca, datos cliente, sketch del producto, precio,
 *          validez y mensajería pre-llenada.
 * Todo prefijado con viz_ / VIZ_ para no colisionar.
 * ================================================================ */
"use strict";

// =================================================================
// CONFIGURACIÓN DE LA TARJETA
// =================================================================
const VIZ_W = 1080;
const VIZ_H = 1350;
const VIZ_PAD = 64;
const VIZ_COLORS = {
    bgTop: '#1e3a8a',
    bgMid: '#3b82f6',
    bgBottom: '#f8fafc',
    accent: '#fbbf24',     // dorado
    text: '#0f172a',
    textLight: '#475569',
    textOnDark: '#ffffff',
    cardBg: '#ffffff',
    cardBorder: '#e2e8f0',
    sketchFill: '#dbeafe',
    sketchHoja: '#fef3c7',
    sketchStroke: '#1e40af'
};

// =================================================================
// API PÚBLICA
// =================================================================
function viz_generarParaPrincipal() {
    if (typeof lastCalculation === 'undefined' || !lastCalculation) {
        if (typeof toast === 'function') toast('Calcula una cotización primero', 'warn');
        return;
    }
    const r = lastCalculation;
    const raw = r.raw;
    const cliente = (typeof clienteActual !== 'undefined') ? clienteActual : { nombre:'', telefono:'', obra:'' };
    // r.precio ya incluye IVA (es el precioFinal del cálculo). NO volver a aplicar IVA.
    const datos = {
        folio: (typeof folioActual === 'function') ? folioActual() : '',
        cliente: cliente,
        producto: r.producto,
        medidas: r.medidas,
        vidrio: r.vidrio,
        color: raw.color_acc,
        sandblasting: raw.sandblasting,
        led: raw.led,
        precioNeto: r.precio / (1 + ((typeof currentConfig !== 'undefined' ? currentConfig.globales.iva : 0.19) || 0.19)),
        precioFinal: r.precio,
        observaciones: raw.observaciones || '',
        modo: 'principal'
    };
    _viz_abrirModal(datos);
}

function viz_generarParaAluminio() {
    if (typeof aluLastCalc === 'undefined' || !aluLastCalc) {
        if (typeof toast === 'function') toast('Calcula una cotización primero', 'warn');
        return;
    }
    const r = aluLastCalc;
    const sysData = (typeof aluConfig !== 'undefined' && aluConfig.sistemas[r.sys]) ? aluConfig.sistemas[r.sys] : { nombre: r.sys };
    const cfgLbl = (typeof ALU_CONFIG_LABELS !== 'undefined' && ALU_CONFIG_LABELS[r.cfg]) ? ALU_CONFIG_LABELS[r.cfg].label : r.cfg;
    const vidLbl = (typeof aluConfig !== 'undefined' && aluConfig.vidrios[r.vid]) ? aluConfig.vidrios[r.vid].label : r.vid;
    const colLbl = (typeof ALU_COLOR_LABELS !== 'undefined' && ALU_COLOR_LABELS[r.col]) ? ALU_COLOR_LABELS[r.col] : r.col;

    // Tomar el SVG del preview (ya está renderizado por alu_renderPreview)
    let sketchSVG = '';
    const previewBox = document.getElementById('alu-preview-svg');
    if (previewBox && previewBox.querySelector('svg')) {
        sketchSVG = previewBox.innerHTML;
    }

    const datos = {
        folio: (typeof folioActual === 'function') ? folioActual() : '',
        cliente: { nombre:'', telefono:'', obra:'' },     // Aluminio no tiene cliente persistente
        producto: `${sysData.nombre} (${cfgLbl})`,
        medidas: `${r.w} × ${r.h} cm`,
        vidrio: vidLbl,
        color: colLbl,
        extras: [
            r.incluirMosq    ? '✓ Mosquitero'      : null,
            r.incluirAlfajia ? '✓ Alfajía/poyo'   : null,
            r.incluirCF      ? '✓ Cuerpo fijo extra' : null
        ].filter(Boolean),
        precioNeto: r.precioVenta,
        precioFinal: r.precioFinal,
        sketchSVG: sketchSVG,
        modo: 'aluminio'
    };
    _viz_abrirModal(datos);
}

// =================================================================
// MODAL DE PREVIEW
// =================================================================
function _viz_abrirModal(datos) {
    const modal = document.getElementById('viz-modal');
    if (!modal) { console.warn('Modal viz no existe'); return; }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Generar y pintar. Guardamos la promesa para que descargar/compartir
    // esperen a que el sketch asíncrono esté realmente dibujado en el canvas.
    const canvas = document.getElementById('viz-canvas');
    window.__viz_ready = _viz_dibujarTarjeta(canvas, datos);

    // Guardar datos para botones de compartir/descargar
    window.__viz_datos = datos;
}

function viz_cerrarModal() {
    const modal = document.getElementById('viz-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

// =================================================================
// DIBUJO PRINCIPAL DEL CANVAS
// =================================================================
function _viz_dibujarTarjeta(canvas, d) {
    canvas.width = VIZ_W;
    canvas.height = VIZ_H;
    const ctx = canvas.getContext('2d');

    // -------- FONDO --------
    // Gradiente superior (header azul)
    const grad = ctx.createLinearGradient(0, 0, 0, 380);
    grad.addColorStop(0, VIZ_COLORS.bgTop);
    grad.addColorStop(1, VIZ_COLORS.bgMid);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIZ_W, 380);
    // Resto blanco
    ctx.fillStyle = VIZ_COLORS.bgBottom;
    ctx.fillRect(0, 380, VIZ_W, VIZ_H - 380);

    // -------- HEADER --------
    ctx.fillStyle = VIZ_COLORS.textOnDark;
    ctx.font = '700 36px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('COTIZACIÓN', VIZ_PAD, 110);

    // Línea dorada
    ctx.fillStyle = VIZ_COLORS.accent;
    ctx.fillRect(VIZ_PAD, 130, 80, 6);

    // Subtítulo
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '400 22px "Segoe UI", Roboto, sans-serif';
    const fechaTxt = _viz_fechaHoy();
    ctx.fillText(fechaTxt, VIZ_PAD, 180);

    // Validez + folio (esquina derecha)
    ctx.textAlign = 'right';
    ctx.font = '600 18px "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = VIZ_COLORS.accent;
    ctx.fillText('Válido 8 días', VIZ_W - VIZ_PAD, 110);
    if (d.folio) {
        ctx.font = '700 22px "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = VIZ_COLORS.textOnDark;
        ctx.fillText(`N° ${d.folio}`, VIZ_W - VIZ_PAD, 180);
    }
    ctx.textAlign = 'left';

    // Cliente
    if (d.cliente && (d.cliente.nombre || d.cliente.obra)) {
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.font = '600 26px "Segoe UI", Roboto, sans-serif';
        let yC = 240;
        if (d.cliente.nombre) {
            ctx.fillText(`👤 ${d.cliente.nombre}`, VIZ_PAD, yC);
            yC += 38;
        }
        if (d.cliente.obra) {
            ctx.font = '400 22px "Segoe UI", Roboto, sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.fillText(`📍 ${d.cliente.obra}`, VIZ_PAD, yC);
        }
    } else {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'italic 22px "Segoe UI", Roboto, sans-serif';
        ctx.fillText('Cotización personalizada para ti', VIZ_PAD, 240);
    }

    // -------- TARJETA BLANCA CENTRAL --------
    const cardX = VIZ_PAD;
    const cardY = 330;
    const cardW = VIZ_W - 2 * VIZ_PAD;
    const cardH = 760;
    _viz_roundRect(ctx, cardX, cardY, cardW, cardH, 24, VIZ_COLORS.cardBg, VIZ_COLORS.cardBorder, 2);

    // Sombra suave (efecto)
    ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 6;
    _viz_roundRect(ctx, cardX, cardY, cardW, cardH, 24, VIZ_COLORS.cardBg, VIZ_COLORS.cardBorder, 0);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Producto (título dentro de la tarjeta)
    ctx.fillStyle = VIZ_COLORS.text;
    ctx.font = '800 38px "Segoe UI", Roboto, sans-serif';
    const prodLines = _viz_wrapText(ctx, d.producto, cardW - 80);
    let yProd = cardY + 70;
    prodLines.forEach(line => {
        ctx.fillText(line, cardX + 40, yProd);
        yProd += 46;
    });

    // Medidas + vidrio (en chips)
    ctx.fillStyle = VIZ_COLORS.textLight;
    ctx.font = '400 24px "Segoe UI", Roboto, sans-serif';
    let yMeta = yProd + 12;
    ctx.fillText(`📏  ${d.medidas}`, cardX + 40, yMeta);
    yMeta += 38;
    ctx.fillText(`💎  ${d.vidrio}`, cardX + 40, yMeta);
    if (d.color) {
        yMeta += 38;
        ctx.fillText(`🎨  ${d.color}`, cardX + 40, yMeta);
    }
    // Sandblasting / LED para principal
    if (d.modo === 'principal') {
        if (d.sandblasting) { yMeta += 38; ctx.fillText('🌫️  Con sandblasting', cardX + 40, yMeta); }
        if (d.led)          { yMeta += 38; ctx.fillText('✨  Luz LED incluida', cardX + 40, yMeta); }
    }
    // Extras para aluminio
    if (d.modo === 'aluminio' && d.extras && d.extras.length) {
        d.extras.forEach(ex => {
            yMeta += 38;
            ctx.fillText(`➕  ${ex.replace('✓ ','')}`, cardX + 40, yMeta);
        });
    }

    // -------- SKETCH (a la derecha) --------
    const sketchX = cardX + cardW - 360;
    const sketchY = cardY + 70;
    const sketchW = 320;
    const sketchH = 260;
    let _sketchPromise = Promise.resolve();
    if (d.modo === 'aluminio' && d.sketchSVG) {
        // Dibujar el SVG del preview (asíncrono: guardamos la promesa para esperarlo)
        _sketchPromise = _viz_dibujarSVGEnCanvas(ctx, d.sketchSVG, sketchX, sketchY, sketchW, sketchH);
    } else {
        // Dibujar un sketch genérico según producto (síncrono)
        _viz_dibujarSketchPrincipal(ctx, d.producto, sketchX, sketchY, sketchW, sketchH);
    }

    // -------- PRECIO GIGANTE --------
    const precioY = cardY + cardH - 200;
    // Separador
    ctx.strokeStyle = VIZ_COLORS.cardBorder;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cardX + 40, precioY - 30);
    ctx.lineTo(cardX + cardW - 40, precioY - 30);
    ctx.stroke();

    ctx.fillStyle = VIZ_COLORS.textLight;
    ctx.font = '500 22px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('Precio final con IVA', cardX + 40, precioY + 6);

    ctx.fillStyle = VIZ_COLORS.bgTop;
    ctx.font = '900 76px "Segoe UI", Roboto, sans-serif';
    const precioTxt = _viz_fmtMoney(d.precioFinal);
    ctx.fillText(precioTxt, cardX + 40, precioY + 82);

    // -------- FOOTER --------
    // Banda dorada decorativa
    ctx.fillStyle = VIZ_COLORS.accent;
    ctx.fillRect(0, VIZ_H - 180, VIZ_W, 6);

    // Texto incluye
    ctx.fillStyle = VIZ_COLORS.text;
    ctx.font = '700 24px "Segoe UI", Roboto, sans-serif';
    ctx.fillText('✅ Incluye:', VIZ_PAD, VIZ_H - 130);
    ctx.fillStyle = VIZ_COLORS.textLight;
    ctx.font = '400 20px "Segoe UI", Roboto, sans-serif';
    const incluye = (d.modo === 'aluminio')
        ? 'Perfilería, vidrio, accesorios, herrajes, transporte e instalación. Garantía escrita 18 meses.'
        : 'Vidrio templado de seguridad, accesorios acero inox 304, transporte, instalación y garantía escrita.';
    const incluyeLines = _viz_wrapText(ctx, incluye, VIZ_W - 2 * VIZ_PAD);
    let yI = VIZ_H - 100;
    incluyeLines.forEach(l => { ctx.fillText(l, VIZ_PAD, yI); yI += 26; });

    // Marca discreta
    ctx.fillStyle = VIZ_COLORS.bgTop;
    ctx.font = '700 18px "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('COTIZADOR PRO', VIZ_W - VIZ_PAD, VIZ_H - 30);
    ctx.textAlign = 'left';

    // Promesa que se resuelve cuando el sketch (posiblemente asíncrono) ya está pintado
    return _sketchPromise;
}

// =================================================================
// HELPERS DE DIBUJO
// =================================================================
function _viz_roundRect(ctx, x, y, w, h, r, fill, stroke, lw) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke && lw > 0) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); }
}

function _viz_wrapText(ctx, text, maxW) {
    const words = (text || '').split(' ');
    const lines = [];
    let line = '';
    words.forEach(w => {
        const test = line ? (line + ' ' + w) : w;
        if (ctx.measureText(test).width > maxW) {
            if (line) lines.push(line);
            line = w;
        } else {
            line = test;
        }
    });
    if (line) lines.push(line);
    return lines;
}

function _viz_fmtMoney(num) {
    return '$' + Math.round(num).toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function _viz_fechaHoy() {
    const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
    const d = new Date();
    return `${d.getDate()} ${meses[d.getMonth()]} ${d.getFullYear()}`;
}

// =================================================================
// SKETCH GENÉRICO PARA COTIZADOR PRINCIPAL
// =================================================================
function _viz_dibujarSketchPrincipal(ctx, producto, x, y, w, h) {
    // Marco
    _viz_roundRect(ctx, x, y, w, h, 12, VIZ_COLORS.sketchFill, VIZ_COLORS.sketchStroke, 3);

    const cx = x + w/2;
    const cy = y + h/2;

    ctx.strokeStyle = VIZ_COLORS.sketchStroke;
    ctx.fillStyle = '#ffffff';
    ctx.lineWidth = 3;

    const pad = 24;
    const ix = x + pad, iy = y + pad;
    const iw = w - 2*pad, ih = h - 2*pad;

    if (producto.includes('Espejo')) {
        // Espejo: marco simple con brillo
        ctx.fillStyle = '#e0f2fe';
        _viz_roundRect(ctx, ix, iy, iw, ih, 6, '#e0f2fe', VIZ_COLORS.sketchStroke, 3);
        // Brillo diagonal
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(ix + 20, iy + 10);
        ctx.lineTo(ix + iw/2 - 10, iy + 10);
        ctx.lineTo(ix + 20, iy + ih/2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = '#475569';
        ctx.font = '700 18px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('🪞 Espejo', cx, y + h + 28);
        ctx.textAlign = 'left';
    } else if (producto.includes('División de baño L')) {
        // L: dos paneles a 90°
        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(ix, iy, iw * 0.55, ih);
        ctx.fillRect(ix, iy + ih * 0.45, iw, ih * 0.55);
        ctx.strokeRect(ix, iy, iw * 0.55, ih);
        ctx.strokeRect(ix, iy + ih * 0.45, iw, ih * 0.55);
        ctx.fillStyle = '#475569';
        ctx.font = '700 18px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('📐 División en L', cx, y + h + 28);
        ctx.textAlign = 'left';
    } else if (producto.includes('Corrediza')) {
        // Corrediza: 2 paños, flecha en uno
        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(ix, iy, iw/2 - 2, ih);
        ctx.strokeRect(ix, iy, iw/2 - 2, ih);
        ctx.fillStyle = '#fef3c7';
        ctx.fillRect(ix + iw/2 + 2, iy, iw/2 - 2, ih);
        ctx.strokeRect(ix + iw/2 + 2, iy, iw/2 - 2, ih);
        // Flecha corrediza
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        const ay = iy + ih/2;
        ctx.beginPath();
        ctx.moveTo(ix + iw/2 + 20, ay);
        ctx.lineTo(ix + iw - 20, ay);
        ctx.moveTo(ix + iw - 20, ay);
        ctx.lineTo(ix + iw - 30, ay - 8);
        ctx.moveTo(ix + iw - 20, ay);
        ctx.lineTo(ix + iw - 30, ay + 8);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '700 18px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('🚿 División corrediza', cx, y + h + 28);
        ctx.textAlign = 'left';
    } else if (producto.includes('Batiente')) {
        // Batiente: 1 panel con flecha de apertura
        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(ix, iy, iw, ih);
        ctx.strokeRect(ix, iy, iw, ih);
        // Triángulo abriendo
        ctx.strokeStyle = '#d97706';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ix + 16, iy + 16);
        ctx.lineTo(ix + iw - 16, iy + ih/2);
        ctx.lineTo(ix + 16, iy + ih - 16);
        ctx.stroke();
        ctx.fillStyle = '#475569';
        ctx.font = '700 18px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('🚪 Batiente', cx, y + h + 28);
        ctx.textAlign = 'left';
    } else if (producto.includes('Cortaviento') || producto.includes('Oficina')) {
        // Mampara: 3 paneles
        const pw = (iw - 8) / 3;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = '#dbeafe';
            ctx.fillRect(ix + i*(pw+4), iy, pw, ih);
            ctx.strokeRect(ix + i*(pw+4), iy, pw, ih);
        }
        ctx.fillStyle = '#475569';
        ctx.font = '700 18px "Segoe UI"';
        ctx.textAlign = 'center';
        ctx.fillText('💼 Cortaviento / Mampara', cx, y + h + 28);
        ctx.textAlign = 'left';
    } else {
        // Genérico
        ctx.fillStyle = '#dbeafe';
        ctx.fillRect(ix, iy, iw, ih);
        ctx.strokeRect(ix, iy, iw, ih);
    }
}

// =================================================================
// DIBUJAR SVG EN CANVAS (para reutilizar el preview de aluminio)
// =================================================================
// Devuelve una Promesa que se resuelve cuando el SVG terminó de pintarse
// en el canvas (o falló). Así quien exporte el PNG puede esperar a que el
// sketch esté realmente dibujado y no obtener un recuadro vacío.
function _viz_dibujarSVGEnCanvas(ctx, svgString, x, y, w, h) {
    // Dibujamos un marco de fondo claro mientras carga
    _viz_roundRect(ctx, x, y, w, h, 12, '#f1f5f9', VIZ_COLORS.sketchStroke, 2);

    return new Promise((resolve) => {
        try {
            const svgBlob = new Blob([svgString], { type:'image/svg+xml;charset=utf-8' });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = function() {
                ctx.drawImage(img, x + 10, y + 10, w - 20, h - 20);
                URL.revokeObjectURL(url);
                resolve();
            };
            img.onerror = function() {
                // Fallback: solo texto
                ctx.fillStyle = '#64748b';
                ctx.font = '700 18px "Segoe UI"';
                ctx.textAlign = 'center';
                ctx.fillText('Vista previa', x + w/2, y + h/2);
                ctx.textAlign = 'left';
                URL.revokeObjectURL(url);
                resolve();
            };
            img.src = url;
        } catch(e) {
            console.warn('No pude dibujar SVG:', e);
            resolve();
        }
    });
}

// =================================================================
// DESCARGAR / COMPARTIR
// =================================================================
async function viz_descargar() {
    const canvas = document.getElementById('viz-canvas');
    if (!canvas) return;
    try {
        // Esperar a que el sketch asíncrono esté pintado antes de exportar el PNG
        if (window.__viz_ready) await window.__viz_ready;
        const link = document.createElement('a');
        const fecha = new Date().toISOString().slice(0,10);
        link.download = `cotizacion-${fecha}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
        if (typeof toast === 'function') toast('Imagen descargada', 'success', 2000);
    } catch(e) {
        console.warn('Error descargando:', e);
        if (typeof toast === 'function') toast('No pude descargar la imagen', 'warn');
    }
}

async function viz_compartirWhatsApp() {
    const canvas = document.getElementById('viz-canvas');
    if (!canvas) return;
    const d = window.__viz_datos || {};

    // Esperar a que el sketch asíncrono esté pintado antes de exportar el PNG
    if (window.__viz_ready) await window.__viz_ready;

    // Texto que acompaña la imagen
    const cliente = d.cliente && d.cliente.nombre ? d.cliente.nombre : '';
    let texto = `*COTIZACIÓN* 📋\n`;
    if (d.folio) texto += `N° ${d.folio}\n`;
    if (cliente) texto += `Cliente: ${cliente}\n`;
    texto += `Producto: ${d.producto}\n`;
    texto += `Medidas: ${d.medidas}\n`;
    texto += `Precio con IVA: ${_viz_fmtMoney(d.precioFinal)}\n`;
    texto += `\nVálido por 8 días. Ver imagen adjunta. 👆`;

    // Si está disponible Web Share API + archivos → compartir directo
    if (navigator.canShare && navigator.share) {
        try {
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const file = new File([blob], 'cotizacion.png', { type:'image/png' });
            if (navigator.canShare({ files:[file] })) {
                await navigator.share({
                    files:[file],
                    title: 'Cotización',
                    text: texto
                });
                if (typeof toast === 'function') toast('Compartido', 'success', 2000);
                return;
            }
        } catch(e) {
            console.warn('Share API falló, uso fallback:', e);
        }
    }

    // Fallback: descargar + abrir WhatsApp con el texto (usuario adjunta a mano)
    viz_descargar();
    setTimeout(() => {
        if (typeof toast === 'function') toast('Imagen descargada. Adjúntala en WhatsApp 📎', 'info', 4000);
        window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
    }, 600);
}

function viz_copiarTextoCotizacion() {
    const d = window.__viz_datos || {};
    const cliente = d.cliente && d.cliente.nombre ? d.cliente.nombre : '';
    let texto = `*COTIZACIÓN* 📋\n----------------------------\n`;
    if (d.folio) texto += `🔖 N° ${d.folio}\n`;
    if (cliente) texto += `👤 Cliente: ${cliente}\n`;
    if (d.cliente && d.cliente.obra) texto += `📍 Obra: ${d.cliente.obra}\n`;
    texto += `🪟 Producto: ${d.producto}\n`;
    texto += `📏 Medidas: ${d.medidas}\n`;
    texto += `💎 Vidrio: ${d.vidrio}\n`;
    if (d.color) texto += `🎨 Color: ${d.color}\n`;
    if (d.modo === 'aluminio' && d.extras && d.extras.length) {
        d.extras.forEach(ex => { texto += `${ex}\n`; });
    }
    if (d.modo === 'principal' && d.sandblasting) texto += `🌫️ Con sandblasting\n`;
    if (d.modo === 'principal' && d.led) texto += `✨ Luz LED incluida\n`;
    texto += `\n💰 *Precio con IVA: ${_viz_fmtMoney(d.precioFinal)}*\n`;
    texto += `\nVálido 8 días. Garantía escrita.\n----------------------------`;

    try {
        navigator.clipboard.writeText(texto);
        if (typeof toast === 'function') toast('Texto copiado', 'success', 2000);
    } catch(e) {
        console.warn('Clipboard falló:', e);
    }
}