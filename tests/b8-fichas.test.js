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
  };
  Object.entries({ ...defaults, ...values }).forEach(([id, value]) => { h.el(id).value = String(value); });
  ['check-desmonte', 'check-espejo-led'].forEach((id) => { h.el(id).checked = !!values[id]; });
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
  { producto: BATIENTE, ancho: 160, alto: 200, espesor: '10mm', color_acc: 'negro', glass_finish: 'transparent', 'check-desmonte': true },
  { producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }, // promoción
  { producto: CLASICA, ancho: 140, alto: 190, espesor: '6mm', color_acc: 'negro', glass_finish: 'transparent' },
  { producto: CLASICA, ancho: 170, alto: 200, espesor: '6mm', color_acc: 'dorado', glass_finish: 'transparent' },
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
  assert.equal(plazo({ producto: CLASICA, ancho: 131, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 200, espesor: '6mm', color_acc: 'natural', glass_finish: 'transparent' }), '6 a 8 días hábiles después del anticipo');
  // La promoción con sandblasting necesita el diseño: no promete 3 días.
  assert.equal(plazo({ producto: CLASICA, ancho: 120, alto: 190, espesor: '6mm', color_acc: 'natural', glass_finish: 'sandblasted' }), '7 a 10 días hábiles después del anticipo');
  assert.equal(plazo({ producto: ESPEJO, ancho: 80, alto: 100 }), '');
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
  for (const etiqueta of ['EST PREMIUM (LÍNEA CONTROLADA)', 'KIT CLÁSICA 8 MM DESDE 120 CM Y 10 MM', 'SANDBLASTING AL CLIENTE, MENOS DE 140 CM',
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
