/* ================================================================
 * COTIZADOR PRO - Módulo independiente: Dashboard
 * Métricas: Cotizaciones del mes, ticket promedio, top productos.
 * Todo prefijado con dash_ / DASH_ para no colisionar con el resto.
 * Lee del mismo localStorage 'vidrios_historial' que ya usa app.js
 * (extendido para incluir entradas de aluminio).
 * ================================================================ */
"use strict";

// =================================================================
// Constantes
// =================================================================
const DASH_HISTORIAL_KEY = 'vidrios_historial';     // misma clave que app.js
const DASH_HISTORIAL_FULL_KEY = 'cotizador_historial_full_v1'; // historial extendido sin tope

function dash_canonicalMetadata(item = {}) {
    return {
        ...(Object.prototype.hasOwnProperty.call(item, 'canonicalProductId') ? { canonicalProductId: item.canonicalProductId } : {}),
        ...(Object.prototype.hasOwnProperty.call(item, 'familyId') ? { familyId: item.familyId } : {}),
        ...(Object.prototype.hasOwnProperty.call(item, 'variantId') ? { variantId: item.variantId } : {}),
        ...(item.mappingStatus ? { mappingStatus: item.mappingStatus } : {}),
        ...(item.canonicalAttributes ? { canonicalAttributes: item.canonicalAttributes } : {})
    };
}

// =================================================================
// PERSISTENCIA EXTENDIDA
// =================================================================
// app.js ya guarda en 'vidrios_historial' pero limita a 5 entradas.
// Para el dashboard necesitamos histórico completo, así que mantenemos
// uno paralelo SIN tope (con limpieza automática a 1 año).
function dash_registrar(item) {
    // item: { producto, medidas, precio, fecha (Date), origen }
    try {
        let hist = JSON.parse(localStorage.getItem(DASH_HISTORIAL_FULL_KEY)) || [];
        const fecha = item.fecha instanceof Date ? item.fecha : new Date(item.fecha);
        hist.unshift({
            producto: item.producto,
            medidas: item.medidas || '',
            precio: Number(item.precio) || 0,
            timestamp: fecha.getTime(),
            origen: item.origen || 'principal',  // 'principal' | 'aluminio'
            ...dash_canonicalMetadata(item)
        });

        // Limpieza: descartar mayores a 1 año (manteniendo la app liviana)
        const limite = Date.now() - (365 * 24 * 60 * 60 * 1000);
        hist = hist.filter(h => h.timestamp >= limite);

        // Hard-cap defensivo: máximo 500 entradas (suficiente para un negocio activo)
        if (hist.length > 500) hist = hist.slice(0, 500);

        localStorage.setItem(DASH_HISTORIAL_FULL_KEY, JSON.stringify(hist));
    } catch(e) {
        console.warn('Dashboard: no se pudo registrar entrada', e);
    }
}

// =================================================================
// CÁLCULO DE MÉTRICAS
// =================================================================
function dash_calcularMetricas(rango = 'mes') {
    // rango: 'mes' (mes actual) | 'mes_anterior' | 'todo'
    let hist = [];
    try {
        hist = JSON.parse(localStorage.getItem(DASH_HISTORIAL_FULL_KEY)) || [];
    } catch(e) {}

    const ahora = new Date();
    const inicioMesActual = new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime();
    const inicioMesAnterior = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1).getTime();
    const finMesAnterior = inicioMesActual - 1;

    let filtrado;
    if (rango === 'mes') {
        filtrado = hist.filter(h => h.timestamp >= inicioMesActual);
    } else if (rango === 'mes_anterior') {
        filtrado = hist.filter(h => h.timestamp >= inicioMesAnterior && h.timestamp <= finMesAnterior);
    } else {
        filtrado = hist;
    }

    const totalCotizaciones = filtrado.length;
    const totalFacturado = filtrado.reduce((sum, h) => sum + (h.precio || 0), 0);
    const ticketPromedio = totalCotizaciones > 0 ? totalFacturado / totalCotizaciones : 0;

    // Top productos
    const porProducto = {};
    filtrado.forEach(h => {
        const k = h.producto || 'Sin nombre';
        if (!porProducto[k]) porProducto[k] = { count: 0, total: 0 };
        porProducto[k].count += 1;
        porProducto[k].total += (h.precio || 0);
    });

    const topProductos = Object.entries(porProducto)
        .map(([nombre, datos]) => ({ nombre, count: datos.count, total: datos.total }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    return {
        totalCotizaciones,
        totalFacturado,
        ticketPromedio,
        topProductos,
        rango,
        nombreRango: rango === 'mes' ? 'Este mes' :
                     rango === 'mes_anterior' ? 'Mes pasado' :
                     'Histórico'
    };
}

// =================================================================
// UI - MODAL DEL DASHBOARD
// =================================================================
let dash_rangoActual = 'mes';

function dash_abrir() {
    const modal = document.getElementById('dash-modal');
    if (!modal) {
        console.warn('Modal del dashboard no existe en el DOM');
        return;
    }
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    dash_rangoActual = 'mes';
    dash_render();
}

function dash_cerrar() {
    const modal = document.getElementById('dash-modal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

function dash_cambiarRango(rango) {
    dash_rangoActual = rango;
    // Actualizar chips activos
    document.querySelectorAll('.dash-rango-chip').forEach(el => {
        el.classList.toggle('active', el.dataset.rango === rango);
    });
    dash_render();
}

function dash_fmt(num) {
    return "$" + Math.round(num).toLocaleString('es-CO', { maximumFractionDigits: 0 });
}

function dash_render() {
    const m = dash_calcularMetricas(dash_rangoActual);

    // Tarjetas principales
    const elCount = document.getElementById('dash-card-cotizaciones');
    if (elCount) elCount.innerText = m.totalCotizaciones;

    const elTicket = document.getElementById('dash-card-ticket');
    if (elTicket) elTicket.innerText = dash_fmt(m.ticketPromedio);

    const elTotal = document.getElementById('dash-card-total');
    if (elTotal) elTotal.innerText = dash_fmt(m.totalFacturado);

    // Top productos
    const elTop = document.getElementById('dash-top-list');
    if (elTop) {
        if (m.topProductos.length === 0) {
            elTop.innerHTML = '<div class="dash-empty">Aún no hay cotizaciones en este período</div>';
        } else {
            elTop.innerHTML = '';
            const maxCount = m.topProductos[0].count || 1;
            const medallas = ['🥇', '🥈', '🥉'];
            m.topProductos.forEach((p, i) => {
                const pct = Math.round((p.count / maxCount) * 100);
                const fila = document.createElement('div');
                fila.className = 'dash-top-row';
                fila.innerHTML = `
                    <div class="dash-top-head">
                        <span class="dash-top-medalla">${medallas[i]}</span>
                        <span class="dash-top-nombre">${p.nombre}</span>
                        <span class="dash-top-count">${p.count} ${p.count === 1 ? 'vez' : 'veces'}</span>
                    </div>
                    <div class="dash-top-bar-bg">
                        <div class="dash-top-bar-fill" style="width:${pct}%"></div>
                    </div>
                `;
                elTop.appendChild(fila);
            });
        }
    }

    // Mensaje motivacional
    const elMsg = document.getElementById('dash-mensaje');
    if (elMsg) {
        if (m.totalCotizaciones === 0) {
            elMsg.innerHTML = '📭 Sin cotizaciones aún. ¡Vamos por la primera!';
        } else if (dash_rangoActual === 'mes') {
            if (m.totalCotizaciones >= 30) {
                elMsg.innerHTML = `🔥 ¡Excelente ritmo! Ya van <b>${m.totalCotizaciones}</b> cotizaciones este mes.`;
            } else if (m.totalCotizaciones >= 10) {
                elMsg.innerHTML = `💪 Buen mes. <b>${m.totalCotizaciones}</b> cotizaciones y contando.`;
            } else {
                elMsg.innerHTML = `🌱 Mes comenzando: <b>${m.totalCotizaciones}</b> ${m.totalCotizaciones === 1 ? 'cotización' : 'cotizaciones'} hasta ahora.`;
            }
        } else {
            elMsg.innerHTML = `📊 <b>${m.totalCotizaciones}</b> cotizaciones en este período.`;
        }
    }
}

// =================================================================
// MIGRACIÓN: incorporar historial viejo al nuevo formato
// =================================================================
function dash_migrarHistorialViejo() {
    try {
        const yaMigrado = localStorage.getItem('dash_migrado_v1');
        if (yaMigrado) return;

        const viejo = JSON.parse(localStorage.getItem(DASH_HISTORIAL_KEY)) || [];
        if (viejo.length === 0) {
            localStorage.setItem('dash_migrado_v1', '1');
            return;
        }

        let nuevo = JSON.parse(localStorage.getItem(DASH_HISTORIAL_FULL_KEY)) || [];

        viejo.forEach(v => {
            const ts = v.fecha ? new Date(v.fecha).getTime() : Date.now();
            // Evitar duplicados (mismo producto + timestamp aproximado)
            const yaExiste = nuevo.some(n =>
                n.producto === v.producto &&
                Math.abs(n.timestamp - ts) < 60000
            );
            if (!yaExiste) {
                nuevo.push({
                    producto: v.producto,
                    medidas: v.medidas || '',
                    precio: v.precio || 0,
                    timestamp: ts,
                    origen: 'principal',
                    ...dash_canonicalMetadata(v)
                });
            }
        });

        nuevo.sort((a, b) => b.timestamp - a.timestamp);
        localStorage.setItem(DASH_HISTORIAL_FULL_KEY, JSON.stringify(nuevo));
        localStorage.setItem('dash_migrado_v1', '1');
    } catch(e) {
        console.warn('Error migrando historial:', e);
    }
}

// Auto-ejecutar migración al cargar el script
dash_migrarHistorialViejo();
