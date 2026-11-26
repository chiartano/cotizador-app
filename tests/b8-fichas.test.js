// B8 «El Cotizador lee las fichas» (2026-11-23). Datos ficticios.
// - Los costos, el plazo y la garantía salen de las fichas confirmadas por Andrés.
// - Lo puesto a mano en un teléfono no se pisa sin avisar; lo que no se tocó sigue a la ficha.
// - La fórmula de los productos de siempre no cambia: se compara precio por precio con
//   la v7.32 en vivo (b3923a2). Solo cambian, a propósito, la premium en línea controlada
//   (estructura de $150.000), la clásica de 8 mm desde 120 cm y de 10 mm (kit A1b),
//   el diseño sandblasting (precio de la ficha) y el panel fijo grande (perfil U en los 4 lados).
// - Los costos siguen sin salir al cliente y el repositorio público no lleva proveedores.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const V732 = 'b3923a2';
const readAt = (rev, file) => execFileSync('git', ['show', `${rev}:${file}`], { cwd: root, encoding: 'utf8' });

function test(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

// ---------- DOM mínimo para correr app.js y visual.js de verdad ----------
function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => { data.set(k, String(v)); },
    removeItem: (k) => { data.delete(k); },
    clear: () => data.clear(),
    dump: () => Object.fromEntries(data),
  };
}

function makeHarness({ storage = {}, app = read('app.js'), visual = read('visual.js'), confirmar = true } = {}) {
  const drawn = [];
  const ctx = new Proxy({}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (prop === 'fillText' || prop === 'strokeText') return (text) => { drawn.push(String(text)); };
      if (prop === 'measureText') return (text) => ({ width: String(text).length * 9 });
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
  const elements = new Map();
  const makeEl = (id = '') => ({
    id, value: '', checked: false, style: {}, innerText: '', innerHTML: '', textContent: '',
    children: [], log: [], dataset: {}, className: '', hidden: false, parentNode: null, title: '',
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(child) { this.children.push(child); this.log.push(child); child.parentNode = this; return child; },
    removeChild(child) { this.children = this.children.filter((c) => c !== child); },
    prepend(child) { this.children.unshift(child); child.parentNode = this; },
    append(...nodes) { nodes.forEach((n) => this.appendChild(n)); },
    querySelector: () => makeEl(), querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
    remove() {}, focus() {}, scrollIntoView() {}, click() {},
    getContext: () => ctx, toDataURL: () => 'data:image/png;base64,', toBlob(cb) { cb(null); },
  });
  const document = {
    readyState: 'complete',
    body: makeEl('body'),
    getElementById(id) { if (!elements.has(id)) elements.set(id, makeEl(id)); return elements.get(id); },
    createElement: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
  };
  const opened = [];
  const timers = [];
  const confirmaciones = [];
  const localStorage = makeStorage(storage);
  const context = {
    console, Math, JSON, Date, Number, String, Object, Array, Promise, Intl, Map, Set, parseFloat, parseInt, isNaN,
    encodeURIComponent, decodeURIComponent, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document, localStorage,
    navigator: { clipboard: { writeText: () => Promise.resolve() }, onLine: true },
    location: { reload() {} },
    confirm: (texto) => { confirmaciones.push(texto); return confirmar; }, alert() {},
    setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {},
    Image: class { set src(_) { if (this.onerror) this.onerror(); } },
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    XMLSerializer: class { serializeToString() { return ''; } },
  };
  context.window = context;
  context.globalThis = context;
  context.window.open = (url) => { opened.push(decodeURIComponent(String(url).split('?text=')[1] || '')); };
  context.addEventListener = () => {};
  context.dispatchEvent = () => true;
  context.scrollTo = () => {};
  context.WilanAgenda = { quoteInbox: { record: () => true } };
  vm.createContext(context);
  vm.runInContext(app, context, { filename: 'app.js' });
  if (visual) vm.runInContext(visual, context, { filename: 'visual.js' });
  return {
    context, document, opened, drawn, localStorage, confirmaciones,
    el: (id) => document.getElementById(id),
    runTimers() { while (timers.length) timers.shift()(); },
    run: (code) => vm.runInContext(code, context),
  };
}

function fill(h, values) {
  const defaults = {
    producto: '', ancho: '', ancho2: '', alto: '', espesor: '', linea: 'controlada', mercado: '',
    color_acc: '', glass_finish: '', recargo_transporte: '', extra_acc: '', descuento_adicional: '',
    observaciones: '', 'cantidad-item': '1',
    // B8, segunda parte
    ancho3: '', reemplazo_pieza: 'puerta', reemplazo_origen: 'corrediza', l_puertas: '1',
  };
  const { piezas = {}, ...campos } = values;
  Object.entries({ ...defaults, ...campos }).forEach(([id, value]) => { h.el(id).value = String(value); });
  ['check-desmonte', 'check-espejo-led', 'check-espejo-otro', 'check-chaflan'].forEach((id) => { h.el(id).checked = !!values[id]; });
  ['bisagra', 'bisagra_vv', 'boton', 'mariposa', 'manija', 'deslizantes', 'deslizantes_sup', 'medias_lunas', 'terminales',
    'tubo', 'riel', 'guia', 'burbuja', 'barredor', 'boquete', 'l_fija'].forEach((p) => { h.el(`pieza_${p}`).value = piezas[p] ? String(piezas[p]) : ''; });
}

// Calcula y devuelve { precio, d (desglose), calc (lastCalculation) }.
function cotizar(h, values) {
  let resultado = null;
  const original = h.context.mostrarResultados;
  h.context.mostrarResultados = (final, neto, d, ...rest) => { resultado = { precio: final, d }; return original(final, neto, d, ...rest); };
  fill(h, values);
  h.run('calcular()');
  h.context.mostrarResultados = original;
  assert.ok(resultado, `calcular() no dio resultado para ${JSON.stringify(values)}`);
  return { ...resultado, calc: h.run('lastCalculation') };
}

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const COST_WORDS = /costo|margen|utilidad|ganancia|estructura|insumo|base gravable|a declarar|proveedor|desglose|m[ií]nimo|el cliente no ve/i;
const CLASICA = 'División Corrediza Clásica';
const PREMIUM = 'División Corrediza Premium';
const BATIENTE = 'División Batiente (Tradicional)';
const L_COR = 'División de baño L - Corrediza';
const L_BAT = 'División de baño L - Batiente';
const PLEGABLE = 'División de baño plegable (2 hojas)';
const PANEL = 'Panel fijo piso a techo (perfil U)';
const TIRAS = 'Tiras de vidrio 5 mm (adicional)';
const REPISA = 'Repisa de vidrio 6 mm (hasta 30 cm)';
const ESPEJO = 'Espejo Flotante';
const CORTAVIENTO = 'Cortaviento / Oficina';

// ---------- 1. La fórmula no cambia para los productos de siempre ----------
// Casos donde ninguna ficha cambia nada: deben dar exactamente el precio de la v7.32.
const SIN_CAMBIO = [
  { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
  { producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }, // promoción
  { producto: CLASICA, ancho: 140, alto: 190, espesor: '6mm', color_acc: 'negro', glass_finish: 'transparent' },
  { producto: CLASICA, ancho: 119, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
  { producto: CLASICA, ancho: 110, alto: 190, espesor: '8mm', color_acc: 'negro', glass_finish: 'serigrafia_6mm' }, // fija 6 mm
  { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', linea: 'empresa' },
  { producto: L_COR, ancho: 100, ancho2: 60, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' },
  { producto: L_BAT, ancho: 90, ancho2: 70, alto: 195, espesor: '8mm', color_acc: 'negro', glass_finish: 'laminado_4_4' },
  { producto: PLEGABLE, ancho: 109.5, alto: 193, espesor: '6mm', color_acc: 'negro', glass_finish: 'negro_6mm' }, // cliente del 19
  { producto: PANEL, ancho: 50, alto: 215, espesor: '6mm', color_acc: 'natural', glass_finish: 'serigrafia_6mm' },
  { producto: TIRAS, ancho: 10, alto: 260 },
  { producto: REPISA },
  { producto: ESPEJO, ancho: 80, alto: 100, 'check-espejo-led': true },
  { producto: CORTAVIENTO, ancho: 150, alto: 200, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
  { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent',
    extra_acc: 30000, recargo_transporte: 20000, descuento_adicional: 15000 },
];

test('1 los productos de siempre dan el mismo precio que la v7.32 en vivo', () => {
  const nuevo = makeHarness();
  const viejo = makeHarness({ app: readAt(V732, 'app.js'), visual: null });
  for (const caso of SIN_CAMBIO) {
    const a = cotizar(nuevo, caso).precio;
    const b = cotizar(viejo, caso).precio;
    assert.equal(Math.round(a * 100) / 100, Math.round(b * 100) / 100, `${caso.producto} ${JSON.stringify(caso)}`);
  }
  // Controles que ya estaban en los informes de B2 y B7.
  assert.equal(Math.round(cotizar(nuevo, { producto: PLEGABLE, ancho: 109.5, alto: 193, espesor: '6mm', color_acc: 'negro', glass_finish: 'negro_6mm' }).precio), 1459126);
});

// ---------- 2. Lo que cambia a propósito, desde las fichas ----------
test('2 kit de la clásica según espesor y ancho: A1 en 6 mm y 8 mm de menos de 120 cm; A1b en 8 mm desde 120 y en 10 mm', () => {
  const h = makeHarness();
  const kit = (espesor, ancho) => cotizar(h, { producto: CLASICA, ancho, alto: 190, espesor, color_acc: 'natural', glass_finish: 'transparent' }).d.accesorios;
  assert.equal(kit('6mm', 145), 120000);
  assert.equal(kit('8mm', 119), 120000);
  assert.equal(kit('8mm', 120), 180000);
  assert.equal(kit('8mm', 140), 180000);
  assert.equal(kit('10mm', 90), 180000);
  assert.equal(kit('10mm', 160), 230000); // + recargo de más de 150 cm, como antes
  // Negro: el recargo de siempre encima del kit A1b.
  assert.equal(cotizar(h, { producto: CLASICA, ancho: 130, alto: 190, espesor: '8mm', color_acc: 'negro', glass_finish: 'transparent' }).d.accesorios, 230000);
  // La premium y la L no usan el A1b.
  assert.equal(cotizar(h, { producto: PREMIUM, ancho: 130, alto: 190, espesor: '10mm', color_acc: 'natural', glass_finish: 'transparent' }).d.accesorios, 280000);
  assert.equal(cotizar(h, { producto: L_COR, ancho: 130, ancho2: 60, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }).d.accesorios, 235000);
  // Precio: la diferencia es solo el kit, con la misma fórmula: + 60.000 ÷ 0,85 × 1,05.
  const viejo = makeHarness({ app: readAt(V732, 'app.js'), visual: null });
  const caso = { producto: CLASICA, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' };
  const antes = cotizar(viejo, caso).precio;
  const ahora = cotizar(h, caso).precio;
  assert.equal(Math.round(antes), 862470); // control de B2
  assert.equal(Math.round(ahora - antes), Math.round(60000 / 0.85 * 1.05));
});

test('3 premium: estructura de $150.000 en línea controlada; la línea empresa no cambia', () => {
  const h = makeHarness();
  const r = cotizar(h, { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  assert.equal(r.d.estructura, 150000);
  assert.equal(Math.round(r.precio), 1121882);
  const e = cotizar(h, { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', linea: 'empresa' });
  assert.equal(e.d.estructura, 130000);
  // Las demás divisiones siguen con $100.000.
  assert.equal(cotizar(h, { producto: CLASICA, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }).d.estructura, 100000);
});

test('3b divisiones de más de 150 cm: estructura de $150.000 en línea controlada (AP3, 2026-11-24)', () => {
  const nuevo = makeHarness();
  const viejo = makeHarness({ app: readAt(V732, 'app.js'), visual: null });
  const delta = 50000 / 0.85 * 1.05;
  for (const caso of [
    { producto: BATIENTE, ancho: 160, alto: 200, espesor: '10mm', color_acc: 'negro', glass_finish: 'transparent', 'check-desmonte': true },
    { producto: CLASICA, ancho: 170, alto: 200, espesor: '6mm', color_acc: 'dorado', glass_finish: 'transparent' },
    { producto: L_COR, ancho: 160, ancho2: 60, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' },
  ]) {
    const a = cotizar(nuevo, caso);
    assert.equal(a.d.estructura, 150000, caso.producto);
    assert.equal(Math.round(a.precio - cotizar(viejo, caso).precio), Math.round(delta), caso.producto);
  }
  // Justo 150 cm no es grande; la línea empresa no cambia; lo que no es división, tampoco.
  assert.equal(cotizar(nuevo, { producto: BATIENTE, ancho: 150, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }).d.estructura, 100000);
  assert.equal(cotizar(nuevo, { producto: BATIENTE, ancho: 160, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', linea: 'empresa' }).d.estructura, 130000);
  assert.equal(cotizar(nuevo, { producto: CORTAVIENTO, ancho: 200, alto: 200, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }).d.estructura, 100000);
});

test('4 oro rosa: mismo recargo que el dorado, y el cliente lee «ORO ROSA»', () => {
  const h = makeHarness();
  const caso = { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', glass_finish: 'transparent' };
  const dorado = cotizar(h, { ...caso, color_acc: 'dorado' });
  const rosa = cotizar(h, { ...caso, color_acc: 'oro_rosa' });
  assert.equal(rosa.precio, dorado.precio);
  assert.equal(rosa.calc.raw.color_acc, 'oro_rosa');
  h.run('compartir()');
  assert.match(h.opened[0], /\*Acabado:\* ORO ROSA/);
  assert.doesNotMatch(h.opened[0], /ORO_ROSA/);
  // Plegable en oro rosa: el recargo del dorado.
  assert.equal(h.run(`costoKitPlegable(currentConfig.globales, 'oro_rosa')`), h.run(`costoKitPlegable(currentConfig.globales, 'dorado')`));
  assert.match(read('index.html'), /<option value="oro_rosa">Oro rosa<\/option>/);
});

test('5 sandblasting: $70.000 al cliente bajo 140 cm, $100.000 desde 140 cm o en L; ya no 30 % sobre el vidrio', () => {
  const h = makeHarness();
  const base = { producto: CLASICA, alto: 190, espesor: '8mm', color_acc: 'natural' };
  const par = (ancho) => [cotizar(h, { ...base, ancho, glass_finish: 'transparent' }), cotizar(h, { ...base, ancho, glass_finish: 'sandblasted' })];
  let [t, s] = par(110);
  assert.equal(Math.round(s.precio - t.precio), 70000);
  assert.equal(s.d.vidrio, t.d.vidrio, 'el vidrio ya no sube por el sandblasting');
  assert.equal(s.d.sandblasting, 70000);
  [t, s] = par(140);
  assert.equal(Math.round(s.precio - t.precio), 100000);
  const lT = cotizar(h, { producto: L_COR, ancho: 80, ancho2: 50, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' });
  const lS = cotizar(h, { producto: L_COR, ancho: 80, ancho2: 50, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'sandblasted' });
  assert.equal(Math.round(lS.precio - lT.precio), 70000); // 130 cm sumados
  const lT2 = cotizar(h, { producto: L_COR, ancho: 90, ancho2: 60, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' });
  const lS2 = cotizar(h, { producto: L_COR, ancho: 90, ancho2: 60, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'sandblasted' });
  assert.equal(Math.round(lS2.precio - lT2.precio), 100000); // 150 cm sumados
  // Se ve en el desglose de la app, no en el mensaje.
  assert.ok(h.el('desglose-lista').children.some((row) => /sandblasting/.test(row.innerHTML)));
  h.run('compartir()');
  assert.doesNotMatch(h.opened[0], /\$100\.000/);
  assert.match(h.opened[0], /sandblasting/);
});

test('6 panel fijo: perfil U en los 4 lados (2 × ancho + 2 × alto)', () => {
  const h = makeHarness();
  const r = cotizar(h, { producto: PANEL, ancho: 100, alto: 240, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  assert.equal(r.d.accesorios, 40000); // 6,8 m → 2 tiras de 6 m (antes 4,4 m → 1)
});

// ---------- 3. Plazo y garantía, iguales a la orden ----------
test('7 plazo de entrega de la ficha en el mensaje: incoloro, especial, tiras; sin dato, nada', () => {
  const h = makeHarness();
  const plazo = (values) => cotizar(h, values).calc.plazoEntrega || '';
  assert.equal(plazo({ producto: CLASICA, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: PLEGABLE, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: PREMIUM, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'serigrafia_negra_8mm' }), '12 a 15 días hábiles después del anticipo');
  assert.equal(plazo({ producto: TIRAS, ancho: 10, alto: 260 }), '12 a 15 días hábiles después del anticipo');
  // Sandblasting: templado común (6 a 8) más el diseño (1 a 2) (Andrés, 2026-11-24).
  assert.equal(plazo({ producto: CLASICA, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'sandblasted' }), '7 a 10 días hábiles después del anticipo');
  // Promoción de la clásica: 3 días hábiles (Andrés, 2026-11-24); justo fuera de la promoción, el común.
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '3 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 125, alto: 180, espesor: '6mm', color_acc: 'negro', glass_finish: 'transparent' }), '3 días hábiles después del anticipo');
  // Juego hecho, ficha V20 (A4, 2026-11-24): 3 días hábiles haya o no promoción, hasta 160 cm, natural o negro.
  assert.equal(plazo({ producto: CLASICA, ancho: 131, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '3 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 160, alto: 180, espesor: '6mm', color_acc: 'negro', glass_finish: 'transparent' }), '3 días hábiles después del anticipo');
  assert.equal(plazo({ producto: L_COR, ancho: 100, ancho2: 160, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '3 días hábiles después del anticipo');
  // Fuera de la ruta: el templado común.
  assert.equal(plazo({ producto: CLASICA, ancho: 161, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 200, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'dorado', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: L_COR, ancho: 100, ancho2: 170, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: PREMIUM, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  // La promoción con sandblasting necesita el diseño: no promete 3 días.
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'sandblasted' }), '7 a 10 días hábiles después del anticipo');
  assert.equal(plazo({ producto: ESPEJO, ancho: 80, alto: 100 }), '3 días hábiles después del anticipo'); // AP3, 2026-11-24
  assert.equal(plazo({ producto: REPISA }), '');
  assert.equal(plazo({ producto: CORTAVIENTO, ancho: 150, alto: 200, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }), '');

  cotizar(h, { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Entrega:\* 6 a 8 días hábiles después del anticipo/);
  assert.match(texto, /\*Garantía:\* 12 meses sobre los herrajes y la instalación/);

  // Carrito: cada división dice su plazo; la garantía dice qué cubre.
  h.run('agregarItem()');
  cotizar(h, { producto: ESPEJO, ancho: 80, alto: 100 });
  h.run('agregarItem()');
  h.run('compartirCompleto()');
  const presupuesto = h.opened[h.opened.length - 1];
  assert.equal((presupuesto.match(/Entrega: 6 a 8 días hábiles/g) || []).length, 1);
  assert.match(presupuesto, /Garantía:\* 12 meses sobre los herrajes y la instalación/);

  // Solo un espejo: la garantía sigue «12 meses», como antes.
  const solo = makeHarness();
  cotizar(solo, { producto: ESPEJO, ancho: 80, alto: 100 });
  solo.run('compartir()');
  assert.match(solo.opened[0], /\*Garantía:\* 12 meses\n/);
});

// ---------- 4. Los costos no salen al cliente ----------
test('8 con A1b, premium y sandblasting, mensaje, presupuesto e imagen siguen sin costos', () => {
  const h = makeHarness();
  const casos = [
    { producto: CLASICA, ancho: 140, alto: 190, espesor: '8mm', color_acc: 'oro_rosa', glass_finish: 'sandblasted' },
    { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'negro', glass_finish: 'transparent' },
  ];
  const textos = [];
  const costos = [];
  for (const caso of casos) {
    const r = cotizar(h, caso);
    costos.push(r.d);
    h.run('compartir()');
    textos.push(h.opened[h.opened.length - 1]);
    h.drawn.length = 0;
    h.run('viz_generarParaPrincipal()');
    textos.push(h.drawn.join('\n'));
    h.run('agregarItem()');
  }
  h.run('compartirCompleto()');
  textos.push(h.opened[h.opened.length - 1]);
  for (const texto of textos) {
    assert.ok(texto.length > 0);
    assert.doesNotMatch(texto, COST_WORDS);
    const sinVisita = texto.replace(/Visita de medidas:\*? \$20\.000/g, '');
    for (const d of costos) {
      for (const clave of ['vidrio', 'accesorios', 'instalacion', 'transporte', 'insumos', 'estructura', 'ganancia', 'baseGravable', 'ivaADeclarar']) {
        if (d[clave] > 0) assert.ok(!sinVisita.includes(fmt(d[clave])), `aparece el costo «${clave}» (${fmt(d[clave])})`);
      }
    }
    for (const valor of [180000, 150000]) assert.ok(!sinVisita.includes(fmt(valor)), `aparece ${fmt(valor)}`);
  }
});

// El repositorio es público: ni siquiera esta prueba escribe los nombres. Guarda la
// huella SHA-256 de cada proveedor (en minúsculas) y la compara con cada palabra y
// cada par de palabras del código.
const HUELLAS_PROVEEDORES = new Set([
  'e3c7c3bb17722b1a868f5f8a3ffe02c2693eda0c460d19eaeafe94ecb00a5deb',
  '61d5d751e4d843634cb482b04e59921b79e37ed158261badbe1fb852d4e9d414',
  'd5442876f8bc17c7dceed9efc351c7e71ab34acf601ca1d0af269e4fc585dfe0',
  '9a475197bd05277e9d53e41b10119f9893cac1d628580e114522bbd9ddf15a77',
  '657571d77ee6157efed4361bd3415911ebcae7568331dba9a354b9b71c1224e7',
  '87f9c628d301f7906cf5de9c0c4128add45c6f11a0413d07fdef86125a4cad9d',
  'c6a458faee14443356506d6c3f2565854edc3fb9fd02fc0a00ace1e35ce36f53',
  '0f1b5dd31a5defcd4cdeb5ab51f236cba3768552ac310cc8e4709e35c35e693b',
]);
const huella = (texto) => require('node:crypto').createHash('sha256').update(texto).digest('hex');
function proveedoresEn(texto, huellas = HUELLAS_PROVEEDORES) {
  const palabras = texto.toLowerCase().split(/[^a-záéíóúñü0-9]+/).filter(Boolean);
  const hallados = [];
  palabras.forEach((p, i) => {
    if (huellas.has(huella(p))) hallados.push(p);
    if (i + 1 < palabras.length && huellas.has(huella(`${p} ${palabras[i + 1]}`))) hallados.push(`${p} ${palabras[i + 1]}`);
  });
  return hallados;
}

test('9 el repositorio público no lleva nombres de proveedores', () => {
  // La búsqueda funciona: encuentra un proveedor ficticio, solo y de dos palabras.
  const ficticios = new Set([huella('vidriosficticios'), huella('herrajes inventados')]);
  assert.deepEqual(proveedoresEn('Kit de Herrajes Inventados y vidrio de VidriosFicticios.', ficticios), ['herrajes inventados', 'vidriosficticios']);
  const archivos = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/)
    .filter((f) => /\.(js|html|json|md|css)$/.test(f));
  for (const archivo of archivos) {
    assert.deepEqual(proveedoresEn(read(archivo)), [], archivo);
  }
});

// ---------- 5. Lo puesto a mano en un teléfono ----------
const DEFAULTS = makeHarness().run('JSON.parse(JSON.stringify(DEFAULT_CONFIG))');
const guardada = (cambios = {}) => {
  const cfg = JSON.parse(JSON.stringify(DEFAULTS));
  for (const [clave, valor] of Object.entries(cambios.globales || {})) cfg.globales[clave] = valor;
  for (const [clave, valor] of Object.entries(cambios.productos || {})) cfg.productos[clave] = valor;
  return JSON.stringify(cfg);
};

test('10 un teléfono igual a las fichas no avisa nada; uno viejo sin las claves nuevas las recibe', () => {
  const h = makeHarness({ storage: { vidrios_config: guardada(), wilan_kit_premium_280000: 'al-dia' } });
  h.runTimers();
  assert.ok(!h.el('toast-container').log.some((t) => /fichas/.test(t.innerHTML)));
  assert.ok(h.localStorage.getItem('wilan_fichas_vistas'));
  // Configuración guardada en la v7.32: sin est_premium, kit A1b ni sandblasting nuevos.
  const vieja = JSON.parse(guardada());
  ['est_premium', 'kit_clasica_a1b', 'precio_sandblasting_menor_140', 'precio_sandblasting_desde_140'].forEach((k) => delete vieja.globales[k]);
  vieja.globales.extra_sandblasting_porc = 0.3;
  const v = makeHarness({ storage: { vidrios_config: JSON.stringify(vieja), wilan_kit_premium_280000: 'al-dia' } });
  assert.equal(v.run('currentConfig.globales.est_premium'), 150000);
  assert.equal(v.run('currentConfig.globales.kit_clasica_a1b'), 180000);
  assert.equal(cotizar(v, { producto: CLASICA, ancho: 130, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' }).d.accesorios, 180000);
});

test('11 un valor puesto a mano no se pisa: se avisa, se ve en Configuración y deja de avisar al tocar Guardar', () => {
  const h = makeHarness({ storage: { vidrios_config: guardada({ globales: { precio_vidrio_6mm: 110000 }, productos: { [CLASICA]: 125000 } }), wilan_kit_premium_280000: 'al-dia' } });
  assert.equal(h.run('currentConfig.globales.precio_vidrio_6mm'), 110000);
  assert.equal(h.run(`currentConfig.productos[${JSON.stringify(CLASICA)}]`), 125000);
  h.runTimers();
  const aviso = h.el('toast-container').log.map((t) => t.innerHTML).join('\n');
  assert.match(aviso, /2 valores puestos a mano distintos de las fichas/);
  assert.match(aviso, /PRECIO VIDRIO 6MM: \$110\.000 \(ficha \$106\.000\)/);
  assert.match(aviso, /No se cambiaron/);
  // En Configuración: el aviso, el botón y la nota bajo cada valor.
  const general = h.el('tab-general').children;
  assert.ok(general.some((c) => c.id === 'aviso-fichas'));
  const notas = [];
  ['tab-general', 'tab-divisiones'].forEach((tab) => h.el(tab).children.forEach((g) => g.children.forEach((c) => { if (c.className === 'nota-ficha') notas.push(c.innerText); })));
  assert.deepEqual(notas.sort(), ['La ficha dice $106.000. Este teléfono tiene otro valor.', 'La ficha dice $120.000. Este teléfono tiene otro valor.']);
  // Guardar: queda revisado y deja de avisar, sin cambiar lo puesto a mano.
  h.run('guardarConfig()');
  const despues = makeHarness({ storage: h.localStorage.dump() });
  despues.runTimers();
  assert.equal(despues.run('currentConfig.globales.precio_vidrio_6mm'), 110000);
  assert.ok(!despues.el('toast-container').log.some((t) => /puestos? a mano distint/.test(t.innerHTML)));
});

test('12 «Usar los valores de las fichas» cambia solo lo distinto, después de confirmar', () => {
  const storage = { vidrios_config: guardada({ globales: { precio_vidrio_6mm: 110000, desmonte: 25000 } }), wilan_kit_premium_280000: 'al-dia' };
  const no = makeHarness({ storage, confirmar: false });
  no.run('usarValoresDeFichas()');
  assert.equal(JSON.parse(no.localStorage.getItem('vidrios_config')).globales.precio_vidrio_6mm, 110000);
  const si = makeHarness({ storage });
  si.run('usarValoresDeFichas()');
  assert.match(si.confirmaciones[0], /PRECIO VIDRIO 6MM: \$110\.000 → \$106\.000/);
  const cfg = JSON.parse(si.localStorage.getItem('vidrios_config'));
  assert.equal(cfg.globales.precio_vidrio_6mm, 106000);
  assert.equal(cfg.globales.desmonte, 25000, 'el desmonte no tiene ficha: no se toca');
});

test('13 cuando una ficha cambia, el teléfono que no la tocó la recibe; el que la puso a mano recibe un aviso', () => {
  // Simula que la versión anterior de la app decía $100.000 para el vidrio de 6 mm.
  const vistas = JSON.parse(makeHarness().localStorage.getItem('wilan_fichas_vistas') || makeHarness().run('JSON.stringify(valoresDeFichas(DEFAULT_CONFIG))'));
  vistas.globales.precio_vidrio_6mm = 100000;
  const igual = makeHarness({ storage: { vidrios_config: guardada({ globales: { precio_vidrio_6mm: 100000 } }), wilan_fichas_vistas: JSON.stringify(vistas), wilan_kit_premium_280000: 'al-dia' } });
  assert.equal(igual.run('currentConfig.globales.precio_vidrio_6mm'), 106000);
  assert.equal(JSON.parse(igual.localStorage.getItem('vidrios_config')).globales.precio_vidrio_6mm, 106000);
  igual.runTimers();
  assert.ok(igual.el('toast-container').log.some((t) => /Un valor actualizado desde las fichas/.test(t.innerHTML)));

  // Puesto a mano ($95.000) y revisado con la ficha vieja ($100.000): la ficha nueva avisa otra vez.
  const revisadas = JSON.parse(JSON.stringify(vistas));
  const mano = makeHarness({ storage: { vidrios_config: guardada({ globales: { precio_vidrio_6mm: 95000 } }), wilan_fichas_vistas: JSON.stringify(vistas), wilan_fichas_revisadas: JSON.stringify(revisadas), wilan_kit_premium_280000: 'al-dia' } });
  assert.equal(mano.run('currentConfig.globales.precio_vidrio_6mm'), 95000);
  mano.runTimers();
  assert.ok(mano.el('toast-container').log.some((t) => /\$95\.000 \(ficha \$106\.000\)/.test(t.innerHTML)));
});

test('14 el kit premium puesto a mano sigue con el aviso de B2, sin aviso doble', () => {
  const h = makeHarness({ storage: { vidrios_config: guardada({ productos: { [PREMIUM]: 250000 } }) } });
  h.runTimers();
  const avisos = h.el('toast-container').log.map((t) => t.innerHTML);
  assert.equal(avisos.filter((t) => /250\.000/.test(t)).length, 1);
});

test('15 Configuración marca lo que sale de las fichas y muestra los valores nuevos', () => {
  const h = makeHarness();
  const etiquetas = [];
  const conFicha = [];
  ['tab-general', 'tab-divisiones', 'tab-especiales'].forEach((tab) => h.el(tab).children.forEach((g) => g.children.forEach((c) => {
    if (c.innerText && c.children && c.children.length !== undefined && c.id === '' && c.className !== 'nota-ficha') {
      etiquetas.push(c.innerText);
      if (c.children.some((m) => m.innerText === ' 📋')) conFicha.push(c.innerText);
    }
  })));
  for (const etiqueta of ['EST PREMIUM Y DIVISIONES DE MÁS DE 150 CM (LÍNEA CONTROLADA)', 'KIT CLÁSICA 8 MM DESDE 120 CM Y 10 MM', 'SANDBLASTING AL CLIENTE, MENOS DE 140 CM',
    'SANDBLASTING AL CLIENTE, DESDE 140 CM O L', 'EXTRA COLOR DORADO U ORO ROSA']) {
    assert.ok(conFicha.includes(etiqueta), `${etiqueta} (${conFicha.join(', ')})`);
  }
  assert.ok(conFicha.includes(CLASICA.toUpperCase()) && conFicha.includes(PREMIUM.toUpperCase()), conFicha.join(', '));
  assert.ok(etiquetas.includes('DESMONTE') && !conFicha.includes('DESMONTE'), 'el desmonte no tiene ficha');
  assert.ok(!etiquetas.includes('EXTRA SANDBLASTING PORC'), 'el 30 % del sandblasting ya no está');
  assert.ok(h.el('tab-general').children.some((c) => c.id === 'nota-fichas'));
});

test('16 el comparador usa las mismas fichas que el cálculo principal', () => {
  const h = makeHarness();
  vm.runInContext(read('comparador.js'), h.context, { filename: 'comparador.js' });
  for (const caso of [
    { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
    { producto: CLASICA, ancho: 130, alto: 190, espesor: '10mm', color_acc: 'oro_rosa', glass_finish: 'sandblasted' },
  ]) {
    const r = cotizar(h, caso);
    h.run('cmp_baseSnapshot = JSON.parse(JSON.stringify(lastCalculation.raw))');
    const cmp = h.run(`cmp_calcularPrincipal(${JSON.stringify(caso.producto)})`);
    // El comparador no suma el recargo de más de 150 cm ni sube la instalación (ya era así);
    // con estos anchos no aplica, así que debe dar lo mismo.
    assert.equal(Math.round(cmp.precioFinal), Math.round(r.precio), caso.producto);
  }
});

test('17 IQ calcula el ahorro de premium a clásica con los valores de las fichas', () => {
  const h = makeHarness();
  vm.runInContext(read('iq.js'), h.context, { filename: 'iq.js' });
  // (280.000 − 120.000) + (150.000 − 100.000) = 210.000 ÷ 0,85 × 1,05 ≈ 259.412 → «unos $260.000»
  assert.equal(h.run('iq_ahorroPremiumAClasica()'), '(unos $260.000)');
  assert.doesNotMatch(read('iq.js'), /~\$100k/);
});

// ================= B8, segunda parte (2026-11-24) =================
const REEMPLAZO = 'Vidrio de reemplazo para división';
const NEO = 'División neoangular';
// Fórmula de la ficha M1: vidrio × 1,05 + insumos + instalación $70.000 + transporte $50.000 (+ piezas), ÷ 0,85 × 1,05.
const precioM1 = (anchoCm, altoCm, costoM2, piezas = 0) =>
  ((anchoCm / 100) * (altoCm / 100) * costoM2 * 1.05 + 15000 + 70000 + 50000 + piezas) / 0.85 * 1.05;

test('18 vidrio de reemplazo: los ejemplos de la ficha M1 (63 × 176,5 y 50 × 180 en 6 mm)', () => {
  const h = makeHarness();
  // Los ejemplos de AP2 se hicieron sin burbuja: valen para un fijo o para la batiente.
  const a = cotizar(h, { producto: REEMPLAZO, ancho: 63, alto: 176.5, espesor: '6mm', glass_finish: 'transparent', reemplazo_pieza: 'fijo' });
  assert.equal(Math.round(a.precio), Math.round(precioM1(63, 176.5, 106000)));
  assert.ok(Math.abs(a.precio - 319600) < 100, `unos $319.600 (${a.precio})`);
  const b = cotizar(h, { producto: REEMPLAZO, ancho: 50, alto: 180, espesor: '6mm', glass_finish: 'transparent', reemplazo_origen: 'batiente' });
  assert.ok(Math.abs(b.precio - 290500) < 100, `unos $290.500 (${b.precio})`);
  assert.equal(b.d.estructura, 0);
  assert.equal(b.d.transporte, 50000);
  assert.equal(b.d.instalacion, 70000);
  assert.equal(b.d.accesorios, 0);
  // Un vidrio ancho no sube la instalación a $100.000: la ficha dice $70.000.
  assert.equal(cotizar(h, { producto: REEMPLAZO, ancho: 160, alto: 190, espesor: '8mm', glass_finish: 'transparent' }).d.instalacion, 70000);
  // El color es opcional: sin color también calcula.
  assert.equal(b.calc.raw.color_acc, '');
  // Cuatro variantes (AP3, 2026-11-24): la puerta de corrediza suma la burbuja ($10.000), ya incluida.
  const variante = (pieza, origen) => cotizar(h, { producto: REEMPLAZO, ancho: 63, alto: 176.5, espesor: '6mm', glass_finish: 'transparent', reemplazo_pieza: pieza, reemplazo_origen: origen });
  const puertaCorrediza = variante('puerta', 'corrediza');
  assert.equal(puertaCorrediza.d.accesorios, 10000);
  assert.equal(Math.round(puertaCorrediza.precio), Math.round(precioM1(63, 176.5, 106000, 10000)));
  assert.equal(variante('puerta', 'clasica_180_190').d.accesorios, 10000);
  assert.equal(variante('fijo', 'corrediza').d.accesorios, 0);
  assert.equal(variante('puerta', 'batiente').d.accesorios, 0);
  assert.equal(variante('fijo', 'batiente').d.accesorios, 0);
  assert.equal(puertaCorrediza.calc.raw.reemplazo.descripcion, 'vidrio para puerta de división corrediza');
  assert.equal(variante('fijo', 'batiente').calc.raw.reemplazo.descripcion, 'vidrio fijo de división batiente');
});

test('19 vidrio de reemplazo con accesorios: pieza por pieza, con su costo', () => {
  const h = makeHarness();
  // Puerta de batiente: 2 bisagras + 1 botón haladera = $85.000 (ejemplo de la ficha).
  const r = cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '8mm', glass_finish: 'transparent', reemplazo_origen: 'batiente', piezas: { bisagra: 2, boton: 1 } });
  assert.equal(r.d.accesorios, 85000);
  assert.equal(Math.round(r.precio), Math.round(precioM1(60, 185, 135000, 85000)));
  // Puerta de clásica: un par de deslizantes + 1 botón haladera = $65.000, más la burbuja incluida.
  assert.equal(cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '6mm', glass_finish: 'transparent', piezas: { deslizantes: 1, boton: 1 } }).d.accesorios, 75000);
  // Por metro: 1,2 m de tubo y 1,2 m de riel a $15.000 el metro.
  assert.equal(cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '6mm', glass_finish: 'transparent', reemplazo_pieza: 'fijo', piezas: { tubo: 1.2, riel: 1.2 } }).d.accesorios, 36000);
  // Color de las piezas (Andrés, 2026-11-24): negro +$5.000 y dorado u oro rosa +$22.000 por pieza.
  // Un par son 2 piezas; tubo y riel, 1 cada uno; la burbuja, la guía y el barredor no llevan color.
  const conColor = (color) => cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '6mm', glass_finish: 'transparent',
    color_acc: color, piezas: { deslizantes: 1, boton: 1, tubo: 1.5, guia: 2 } }).d.accesorios;
  const base = 50000 + 15000 + 1.5 * 15000 + 2 * 10000 + 10000; // con la burbuja de la puerta de corrediza
  assert.equal(conColor(''), base);
  assert.equal(conColor('natural'), base);
  assert.equal(conColor('negro'), base + 4 * 5000);
  assert.equal(conColor('dorado'), base + 4 * 22000);
  assert.equal(conColor('oro_rosa'), base + 4 * 22000);
  // Todas las piezas con el costo de la ficha.
  const cfg = h.run('currentConfig.globales');
  assert.deepEqual([cfg.acc_bisagra_muro, cfg.acc_bisagra_vidrio_vidrio, cfg.acc_boton, cfg.acc_mariposa, cfg.acc_manija_vertical,
    cfg.acc_deslizantes_par, cfg.acc_deslizantes_par_superior, cfg.acc_medias_lunas_par, cfg.acc_terminales_freno_par, cfg.acc_tubo_m,
    cfg.acc_riel_m, cfg.acc_guia, cfg.acc_burbuja, cfg.acc_barredor, cfg.acc_boquete, cfg.acc_l_fija],
  [35000, 70000, 15000, 25000, 40000, 50000, 85000, 15000, 15000, 15000, 15000, 10000, 10000, 10000, 15000, 30000]);
});

test('20 vidrio de reemplazo: mensaje sin costos, qué se cambia, accesorios, plazo de la ficha y sin aviso del mínimo', () => {
  const h = makeHarness();
  const r = cotizar(h, { producto: REEMPLAZO, ancho: 50, alto: 180, espesor: '6mm', glass_finish: 'transparent',
    reemplazo_origen: 'clasica_180_190', piezas: { boton: 1 } });
  assert.ok(r.precio < 350000, String(r.precio));
  assert.equal(h.el('aviso-minimo-main').style.display, 'none', 'el reemplazo no avisa del mínimo');
  assert.equal(r.calc.plazoEntrega, '1 a 3 días después del anticipo');
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Producto:\* Vidrio de reemplazo para división/);
  assert.match(texto, /\*Se cambia:\* vidrio para puerta de división corrediza/);
  assert.match(texto, /\*Accesorios:\* Botón haladera × 1, Burbuja × 1/);
  assert.match(texto, /\*Entrega:\* 1 a 3 días después del anticipo/);
  assert.match(texto, /\*Garantía:\* 12 meses\n/);
  assert.match(texto, /\*Transporte:\* incluido/);
  assert.doesNotMatch(texto, /\*Acabado:\*/);
  assert.doesNotMatch(texto, COST_WORDS);
  for (const costo of [15000, 10000, 25000, 50000, 70000]) assert.ok(!texto.includes(fmt(costo)), `aparece ${fmt(costo)}`);
  // Plazo: 6 a 8 si no es de clásica de 180 o 190 en 6 mm; especiales y sandblasting como siempre.
  const plazo = (v) => cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, ...v }).calc.plazoEntrega;
  assert.equal(plazo({ espesor: '8mm', glass_finish: 'transparent', reemplazo_origen: 'clasica_180_190' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ espesor: '6mm', glass_finish: 'transparent', reemplazo_origen: 'corrediza' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ espesor: '6mm', glass_finish: 'transparent', reemplazo_origen: 'batiente' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ espesor: '6mm', glass_finish: 'sandblasted', reemplazo_origen: 'clasica_180_190' }), '7 a 10 días hábiles después del anticipo');
  assert.equal(plazo({ espesor: '6mm', glass_finish: 'serigrafia_6mm' }), '12 a 15 días hábiles después del anticipo');
  // Sin accesorios, lo dice; el fijo, también.
  cotizar(h, { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '6mm', glass_finish: 'transparent', reemplazo_pieza: 'fijo' });
  h.run('compartir()');
  assert.match(h.opened[h.opened.length - 1], /\*Se cambia:\* vidrio fijo de división corrediza[\s\S]*\*Accesorios:\* sin accesorios/);
  // En el carrito, solo, tampoco avisa del mínimo; y el presupuesto lleva las mismas líneas.
  h.run('agregarItem()');
  assert.equal(h.el('aviso-minimo-cart').style.display, 'none');
  h.run('compartirCompleto()');
  const presupuesto = h.opened[h.opened.length - 1];
  assert.match(presupuesto, /Se cambia: vidrio fijo de división corrediza/);
  assert.match(presupuesto, /Accesorios: sin accesorios/);
  assert.doesNotMatch(presupuesto, COST_WORDS);
});

test('21 vidrio de reemplazo: editar desde el carrito recupera la pieza, el origen y los accesorios', () => {
  const h = makeHarness();
  const antes = cotizar(h, { producto: REEMPLAZO, ancho: 55, alto: 180, espesor: '6mm', glass_finish: 'transparent',
    reemplazo_pieza: 'fijo', reemplazo_origen: 'clasica_180_190', piezas: { burbuja: 1, tubo: 0.5 } });
  h.run('agregarItem()');
  fill(h, {}); // limpia la pantalla
  h.run('editarItem(0)');
  assert.equal(h.el('reemplazo_pieza').value, 'fijo');
  assert.equal(h.el('reemplazo_origen').value, 'clasica_180_190');
  assert.equal(h.el('pieza_burbuja').value, '1');
  assert.equal(h.el('pieza_tubo').value, '0.5');
  assert.equal(Math.round(h.run('lastCalculation.precio')), Math.round(antes.precio));
});

test('22 espejo con otro trabajo: sin transporte y con $20.000 de aporte (ejemplo de la ficha E1)', () => {
  const h = makeHarness();
  const viejo = makeHarness({ app: readAt(V732, 'app.js'), visual: null });
  const caso = { producto: ESPEJO, ancho: 60, alto: 90, 'check-espejo-led': true };
  const solo = cotizar(h, caso);
  assert.equal(Math.round(solo.precio), Math.round(cotizar(viejo, caso).precio), 'el espejo solo no cambia');
  assert.ok(Math.abs(solo.precio - 369700) < 100, `solo, unos $369.700 (${solo.precio})`);
  const conOtro = cotizar(h, { ...caso, 'check-espejo-otro': true });
  assert.ok(Math.abs(conOtro.precio - 291000) < 100, `con otro trabajo, unos $291.000 (${conOtro.precio})`);
  assert.equal(conOtro.d.transporte, 0);
  assert.equal(conOtro.d.estructura, 20000);
  h.run('compartir()');
  assert.doesNotMatch(h.opened[h.opened.length - 1], /Transporte/);
  // Al cambiar de producto, la casilla se apaga.
  h.el('producto').value = BATIENTE;
  h.run('verificarProducto()');
  assert.equal(h.el('check-espejo-otro').checked, false);
});

test('23 neoangular: los tres anchos sumados × el alto, kit de la L batiente e instalación de $100.000', () => {
  const h = makeHarness();
  const r = cotizar(h, { producto: NEO, ancho: 40, ancho2: 60, ancho3: 40, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  const esperado = (1.4 * 1.9 * 135000 * 1.05 + 335000 + 100000 + 70000 + 15000 + 100000) / 0.85 * 1.05;
  assert.equal(Math.round(r.precio), Math.round(esperado));
  assert.equal(r.d.accesorios, 335000);
  assert.equal(r.d.instalacion, 100000);
  assert.equal(r.calc.plazoEntrega, '6 a 8 días hábiles después del anticipo');
  assert.equal(r.calc.medidas, '40+60+40x190');
  assert.equal(r.calc.canonicalProductId, 'DB-NEO');
  assert.equal(r.calc.variantId, 'DB-NEO-STD');
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Medidas:\* 40 \+ 60 \+ 40 x 190 cm/);
  assert.match(texto, /\*Garantía:\* 12 meses sobre los herrajes y la instalación/);
  // Negro: el recargo de siempre; sandblasting con los anchos sumados (140 cm → $100.000).
  assert.equal(cotizar(h, { producto: NEO, ancho: 40, ancho2: 60, ancho3: 40, alto: 190, espesor: '8mm', color_acc: 'negro', glass_finish: 'transparent' }).d.accesorios, 385000);
  assert.equal(cotizar(h, { producto: NEO, ancho: 40, ancho2: 60, ancho3: 40, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'sandblasted' }).d.sandblasting, 100000);
  // Sin el tercer ancho no calcula.
  h.run('lastCalculation = null');
  fill(h, { producto: NEO, ancho: 40, ancho2: 60, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('calcular()');
  assert.equal(h.run('lastCalculation'), null);
  // Editar recupera el tercer ancho.
  cotizar(h, { producto: NEO, ancho: 45, ancho2: 55, ancho3: 45, alto: 195, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('agregarItem()');
  fill(h, {});
  h.run('editarItem(0)');
  assert.equal(String(h.el('ancho3').value), '45');
});

test('24 el CRM no convierte la neoangular ni el reemplazo en otro producto', () => {
  // «Usar esta cotización» del CRM busca el sistema por variante y, si no la conoce, por
  // palabras del nombre (corrediza, batiente, plegable, premium). Estos nombres no las tienen:
  // el CRM los deja para agregarlos con el asistente, en vez de convertirlos en otro producto.
  for (const nombre of [NEO, REEMPLAZO]) assert.doesNotMatch(nombre, /corrediza|batiente|plegable|premium|divisi[oó]n de baño l\b/i);
});

test('25 Configuración muestra las piezas sueltas y los valores nuevos con 📋', () => {
  const h = makeHarness();
  const conFicha = [];
  ['tab-espejos', 'tab-especiales', 'tab-divisiones'].forEach((tab) => h.el(tab).children.forEach((g) => g.children.forEach((c) => {
    if (c.children && c.children.some((m) => m.innerText === ' 📋')) conFicha.push(c.innerText);
  })));
  for (const etiqueta of ['ACC MARIPOSA', 'ACC MANIJA VERTICAL', 'ACC DESLIZANTES PAR', 'ACC TUBO SUPERIOR (POR METRO)', 'ACC L FIJA',
    'TRANSPORTE VIDRIO DE REEMPLAZO', 'EST ESPEJO CON OTRO TRABAJO', NEO.toUpperCase()]) {
    assert.ok(conFicha.includes(etiqueta), `${etiqueta} (${conFicha.join(', ')})`);
  }
  // El reemplazo no tiene kit: no sale como precio base en Divisiones.
  assert.ok(!conFicha.includes(REEMPLAZO.toUpperCase()));
});

// ================= B8, segunda parte: lo que confirmó AP3 (2026-11-24) =================
const L_PREMIUM = 'División de baño L - Corrediza premium';
const INSTALACION = 'Instalación sola de división (accesorios del cliente)';

test('26 «incluye» de la ficha en el mensaje y en el presupuesto; la clásica con kit A1b dice «accesorios de alta calidad»', () => {
  const h = makeHarness();
  const caso = (v) => cotizar(h, { alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', ...v }).calc.raw.incluye || '';
  assert.equal(caso({ producto: CLASICA, ancho: 110 }),
    'Vidrio templado incoloro cortado, perforado, pulido y brillado; herrajes en acero inoxidable 304 (2 deslizantes, tubo superior, botón haladera); guías acrílicas o riel inferior de aluminio, según el diseño; transporte e instalación en el perímetro urbano de Bogotá; asesoría técnica y verificación de medidas');
  assert.match(caso({ producto: CLASICA, ancho: 130 }), /accesorios de alta calidad en acero inoxidable 304 \(2 deslizantes/);
  assert.match(caso({ producto: CLASICA, ancho: 100, espesor: '10mm' }), /accesorios de alta calidad/);
  assert.doesNotMatch(caso({ producto: CLASICA, ancho: 140, espesor: '6mm' }), /alta calidad/);
  assert.match(caso({ producto: BATIENTE, ancho: 90 }), /2 bisagras, boquetes y botón haladera o mariposa/);
  // Con vidrio especial no dice «incoloro».
  assert.match(caso({ producto: BATIENTE, ancho: 90, glass_finish: 'negro_6mm' }), /^Vidrio cortado, perforado, pulido y brillado; herrajes/);
  assert.match(caso({ producto: NEO, ancho: 40, ancho2: 60, ancho3: 40 }), /bisagras vidrio a vidrio, L fijas, boquetes/);
  for (const producto of [PREMIUM, L_COR, 'División de baño L - Batiente', 'División de baño plegable (2 hojas)', 'Panel fijo piso a techo (perfil U)']) {
    assert.match(caso({ producto, ancho: 100, ancho2: 60 }), /^Vidrio templado incoloro[\s\S]*asesoría técnica y verificación de medidas$/, producto);
  }
  // Sin «incluye» confirmado: nada (L premium, cortaviento, espejo, tiras, reemplazo).
  assert.equal(caso({ producto: L_PREMIUM, ancho: 100, ancho2: 60 }), '');
  assert.equal(caso({ producto: CORTAVIENTO, ancho: 150 }), '');
  assert.equal(cotizar(h, { producto: ESPEJO, ancho: 60, alto: 90 }).calc.raw.incluye, undefined);
  cotizar(h, { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('compartir()');
  assert.match(h.opened[h.opened.length - 1], /🔹 \*Incluye:\* Vidrio templado incoloro/);
  h.run('agregarItem()');
  h.run('compartirCompleto()');
  assert.match(h.opened[h.opened.length - 1], /✅ Incluye: Vidrio templado incoloro/);
});

test('27 L corrediza premium: fórmula de la L, estructura de $150.000; 1 puerta kit × 1,05, 2 puertas 2 kits', () => {
  const h = makeHarness();
  const base = { producto: L_PREMIUM, ancho: 100, ancho2: 60, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' };
  const uno = cotizar(h, { ...base, l_puertas: '1' });
  assert.equal(uno.d.accesorios, 280000 * 1.05);
  assert.equal(uno.d.estructura, 150000);
  assert.equal(uno.d.instalacion, 100000);
  const esperado = (1.6 * 1.9 * 135000 * 1.05 + 294000 + 100000 + 70000 + 15000 + 150000) / 0.85 * 1.05;
  assert.equal(Math.round(uno.precio), Math.round(esperado));
  const dos = cotizar(h, { ...base, l_puertas: '2' });
  assert.equal(dos.d.accesorios, 560000);
  assert.equal(dos.calc.raw.l_puertas, 2);
  assert.equal(dos.calc.canonicalProductId, 'DB-ESC');
  assert.equal(dos.calc.variantId, null);
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Medidas:\* L\(100 \+ 60\) x 190 cm/);
  assert.match(texto, /\*Puertas:\* 2 \(2 fijos y 2 puertas\)/);
  // Plazo y garantía de la L premium siguen por confirmar en la ficha: como hoy.
  assert.doesNotMatch(texto, /Entrega/);
  assert.match(texto, /\*Garantía:\* 12 meses\n/);
  assert.doesNotMatch(texto, COST_WORDS);
  assert.ok(!texto.includes(fmt(560000)) && !texto.includes(fmt(294000)));
});

test('28 instalación sola: $140.000 al cliente, sin aviso del mínimo, garantía de 3 meses sobre la instalación', () => {
  const h = makeHarness();
  const r = cotizar(h, { producto: INSTALACION, ancho: 120, alto: 190 });
  assert.equal(r.precio, 140000);
  assert.equal(r.d.vidrio, 0);
  assert.equal(h.el('aviso-minimo-main').style.display, 'none');
  assert.equal(r.calc.mappingStatus, 'review_manual');
  assert.deepEqual(JSON.parse(JSON.stringify(r.calc.canonicalAttributes)), {});
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Producto:\* Instalación sola de división \(accesorios del cliente\)/);
  assert.match(texto, /\*Garantía:\* 3 meses sobre la instalación/);
  assert.doesNotMatch(texto, /Espesor|Acabado|Entrega|Transporte|Incluye/);
  assert.match(texto, /\$140\.000, IVA incluido/);
  // En el carrito con una división: su propia garantía en su renglón y la general para la división.
  h.run('agregarItem()');
  cotizar(h, { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('agregarItem()');
  h.run('compartirCompleto()');
  const presupuesto = h.opened[h.opened.length - 1];
  assert.match(presupuesto, /🛡️ Garantía: 3 meses sobre la instalación/);
  assert.match(presupuesto, /🛡️ \*Garantía:\* 12 meses sobre los herrajes y la instalación/);
  // Sola en el carrito: no hay garantía general que la contradiga, ni aviso del mínimo.
  const sola = makeHarness();
  cotizar(sola, { producto: INSTALACION, ancho: 120, alto: 190 });
  sola.run('agregarItem()');
  assert.equal(sola.el('aviso-minimo-cart').style.display, 'none');
  sola.run('compartirCompleto()');
  const soloTexto = sola.opened[sola.opened.length - 1];
  assert.match(soloTexto, /🛡️ Garantía: 3 meses sobre la instalación/);
  assert.doesNotMatch(soloTexto, /\*Garantía:\*/);
});

test('29 la bandeja del CRM acepta los productos nuevos (identidad y atributos presentes)', () => {
  const h = makeHarness();
  for (const v of [
    { producto: REEMPLAZO, ancho: 60, alto: 185, espesor: '6mm', glass_finish: 'transparent' },
    { producto: NEO, ancho: 40, ancho2: 60, ancho3: 40, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
    { producto: L_PREMIUM, ancho: 100, ancho2: 60, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' },
    { producto: INSTALACION, ancho: 120, alto: 190 },
  ]) {
    const c = cotizar(h, v).calc;
    assert.ok(['map_with_attributes', 'map_with_variant', 'review_manual'].includes(c.mappingStatus), v.producto);
    assert.equal(typeof c.canonicalAttributes, 'object', v.producto);
    assert.ok(c.canonicalAttributes !== null, v.producto);
  }
  // Los nombres no hacen que el CRM los confunda con otro producto (busca «corrediza», «batiente»…
  // solo si no reconoce la L por «L -»).
  assert.doesNotMatch(INSTALACION, /corrediza|batiente|plegable|premium/i);
  assert.match(L_PREMIUM, /\bL\s*-/);
});

// ================= Batiente con chaflán (2026-11-26) =================
test('30 batiente con chaflán: $20.000 de costo adicional por cada vidrio (puerta y fijo), dentro de la fórmula', () => {
  const h = makeHarness();
  const caso = { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' };
  const sin = cotizar(h, caso);
  const con = cotizar(h, { ...caso, 'check-chaflan': true });
  assert.equal(con.d.chaflan, 40000);
  assert.equal(con.d.accesorios, sin.d.accesorios, 'el kit no cambia; el chaflán va en su propia fila');
  assert.equal(Math.round(con.precio - sin.precio), Math.round(40000 / 0.85 * 1.05));
  assert.ok(h.el('desglose-lista').children.some((row) => /Chaflán \(2 vidrios\)/.test(row.innerHTML)));
  // Sin la casilla, igual que la v7.34 en vivo.
  const viejo = makeHarness({ app: readAt('9abb680', 'app.js'), visual: null });
  assert.equal(Math.round(sin.precio), Math.round(cotizar(viejo, caso).precio));
  // Mensaje y presupuesto: dicen el chaflán, sin el costo.
  cotizar(h, { ...caso, 'check-chaflan': true });
  h.run('compartir()');
  const texto = h.opened[h.opened.length - 1];
  assert.match(texto, /\*Chaflán:\* en la puerta y el fijo/);
  assert.doesNotMatch(texto, COST_WORDS);
  const sinVisita = texto.replace(/Visita de medidas:\*? \$20\.000/g, '');
  assert.ok(!sinVisita.includes(fmt(40000)) && !sinVisita.includes(fmt(20000)));
  h.run('agregarItem()');
  h.run('compartirCompleto()');
  assert.match(h.opened[h.opened.length - 1], /📐 Chaflán: en la puerta y el fijo/);
  // Editar desde el carrito la recupera.
  fill(h, {});
  h.run('editarItem(0)');
  assert.equal(h.el('check-chaflan').checked, true);
  assert.equal(Math.round(h.run('lastCalculation.precio')), Math.round(con.precio));
});

test('31 el chaflán es solo de la batiente: en otro producto la casilla se apaga y no suma', () => {
  const h = makeHarness();
  h.el('check-chaflan').checked = true;
  h.el('producto').value = CLASICA;
  h.run('verificarProducto()');
  assert.equal(h.el('check-chaflan').checked, false);
  assert.equal(h.el('group-chaflan').style.display, 'none');
  h.el('producto').value = BATIENTE;
  h.run('verificarProducto()');
  assert.equal(h.el('group-chaflan').style.display, 'flex');
  const r = cotizar(h, { producto: CLASICA, ancho: 100, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', 'check-chaflan': true });
  assert.equal(r.d.chaflan, 0);
  assert.equal(r.calc.raw.chaflan, undefined);
  // Configuración: el costo por vidrio sale de la ficha.
  assert.equal(h.run('currentConfig.globales.costo_chaflan_vidrio'), 20000);
  assert.equal(h.run('FICHAS.globales.costo_chaflan_vidrio'), 'D4');
});

test('32 el comparador cobra el chaflán igual que el cálculo principal', () => {
  const h = makeHarness();
  vm.runInContext(read('comparador.js'), h.context, { filename: 'comparador.js' });
  const r = cotizar(h, { producto: BATIENTE, ancho: 90, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent', 'check-chaflan': true });
  h.run('cmp_baseSnapshot = JSON.parse(JSON.stringify(lastCalculation.raw))');
  assert.equal(Math.round(h.run(`cmp_calcularPrincipal(${JSON.stringify(BATIENTE)})`).precioFinal), Math.round(r.precio));
});
