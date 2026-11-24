// B2 «Cotizador sencillo» (2026-11-21). Datos ficticios.
// - Los costos siguen a la vista en la app, pero nunca salen al cliente:
//   ni en el mensaje de WhatsApp, ni en el presupuesto, ni en la imagen.
// - El kit premium vale $280.000 en todos los teléfonos.
// - El mínimo de $350.000 por salida solo avisa, en pantalla.
// - Ya no hay botón «Enviar al CRM»; la bandeja recibe todo por WhatsApp.
// - El agarre se llama «botón haladera»; «pomo» no aparece.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

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

function makeHarness({ storage = {} } = {}) {
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
  const makeEl = (id = '') => {
    const el = {
      id, value: '', checked: false, style: {}, innerText: '', innerHTML: '', textContent: '',
      children: [], log: [], dataset: {}, className: '', hidden: false, parentNode: null,
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      appendChild(child) { this.children.push(child); this.log.push(child); child.parentNode = this; return child; },
      removeChild(child) { this.children = this.children.filter((c) => c !== child); },
      prepend(child) { this.children.unshift(child); child.parentNode = this; },
      append(...nodes) { nodes.forEach((n) => this.appendChild(n)); },
      querySelector: () => makeEl(), querySelectorAll: () => [],
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null,
      remove() {}, focus() {}, scrollIntoView() {}, click() {},
      getContext: () => ctx, toDataURL: () => 'data:image/png;base64,', toBlob(cb) { cb(null); },
    };
    return el;
  };
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
  const inbox = [];
  const timers = [];
  const localStorage = makeStorage(storage);
  const context = {
    console, Math, JSON, Date, Number, String, Object, Array, Promise, Intl, Map, Set, parseFloat, parseInt, isNaN,
    encodeURIComponent, decodeURIComponent, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
    document, localStorage,
    navigator: { clipboard: { writeText: () => Promise.resolve() }, onLine: true },
    location: { reload() {} },
    confirm: () => true, alert() {},
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
  context.WilanAgenda = { quoteInbox: { record: (quoteContext, folio) => { inbox.push({ quoteContext, folio }); return true; } } };
  vm.createContext(context);
  vm.runInContext(read('app.js'), context, { filename: 'app.js' });
  vm.runInContext(read('visual.js'), context, { filename: 'visual.js' });
  return {
    context, document, opened, inbox, drawn, localStorage,
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

const fmt = (n) => '$' + Math.round(n).toLocaleString('es-CO', { maximumFractionDigits: 0 });
const COST_WORDS = /costo|margen|utilidad|ganancia|estructura|insumo|base gravable|a declarar|proveedor|desglose|m[ií]nimo|el cliente no ve/i;

function assertSinCostos(nombre, texto, costos) {
  assert.ok(texto.length > 0, `${nombre}: no se generó texto`);
  assert.doesNotMatch(texto, COST_WORDS, `${nombre}: menciona costos o márgenes`);
  // La visita de medidas ($20.000) es un precio al cliente; el desmonte cuesta
  // lo mismo. Se quita esa frase antes de buscar cifras de costos.
  const sinVisita = texto.replace(/Visita de medidas:\*? \$20\.000/g, '');
  for (const [clave, valor] of Object.entries(costos)) {
    if (!(valor > 0)) continue;
    assert.ok(!sinVisita.includes(fmt(valor)), `${nombre}: aparece el costo «${clave}» (${fmt(valor)})`);
  }
}

// ---------- 1. Los costos no salen al cliente ----------
test('1 mensaje, presupuesto e imagen no llevan costos ni márgenes (cálculo real)', () => {
  const h = makeHarness();
  let costos = null;
  const original = h.context.mostrarResultados;
  h.context.mostrarResultados = (final, neto, d, mar, mercado) => {
    costos = { vidrio: d.vidrio, accesorios: d.accesorios, instalacion: d.instalacion, transporte: d.transporte,
      recargoTransporte: d.recargoTransporte, insumos: d.insumos, desmonte: d.desmonte, estructura: d.estructura,
      ganancia: d.ganancia, baseGravable: d.baseGravable, ivaADeclarar: d.ivaADeclarar, kitPremium: 280000 };
    return original(final, neto, d, mar, mercado);
  };
  // Valores raros a propósito, para reconocerlos si se cuelan en un texto.
  fill(h, { producto: 'División Corrediza Premium', ancho: 120, alto: 190, espesor: '8mm',
    color_acc: 'negro', glass_finish: 'transparent', extra_acc: 12345, recargo_transporte: 23456,
    mercado: 1999999, 'check-desmonte': true });
  h.run('calcular()');
  assert.ok(costos, 'calcular() no mostró el desglose');
  // El desglose sigue en pantalla para Andrés y su mamá.
  assert.ok(h.el('desglose-lista').children.length >= 5, 'el desglose de costos ya no se muestra en la app');

  h.run('compartir()');
  assert.equal(h.opened.length, 1);
  assertSinCostos('WhatsApp individual', h.opened[0], { ...costos, extra: 12345, recargo: 23456, mercado: 1999999 });

  h.run('viz_generarParaPrincipal()');
  const imagen = h.drawn.join('\n');
  assertSinCostos('imagen', imagen, { ...costos, extra: 12345, recargo: 23456, mercado: 1999999 });
  assert.match(imagen, /\$\d/, 'la imagen no dibujó el precio');

  h.run('agregarItem()');
  fill(h, { producto: 'Espejo Flotante', ancho: 80, alto: 100, extra_acc: 777, 'cantidad-item': 2 });
  h.run('calcular()');
  const costosEspejo = costos;
  h.run('agregarItem()');
  h.el('quote-discount').value = '5000';
  h.run('compartirCompleto()');
  assert.equal(h.opened.length, 2);
  assertSinCostos('presupuesto (carrito)', h.opened[1], { ...costos, ...Object.fromEntries(Object.entries(costosEspejo).map(([k, v]) => [`espejo_${k}`, v])), extra: 12345, recargo: 23456, mercado: 1999999 });
  assert.match(h.opened[1], /PRESUPUESTO/);
  // La bandeja del CRM recibe las dos cotizaciones por el botón de WhatsApp.
  assert.equal(h.inbox.length, 2);
});

test('2 el texto que acompaña la imagen y el de aluminio no llevan costos', () => {
  const h = makeHarness();
  const texto = h.run(`buildVisualCommercialText({
    modo:'principal', familia:'division', folio:'F-1', cliente:{nombre:'Cliente Ficticio'},
    producto:'División Corrediza Premium', medidas:'120x190', vidrio:'8mm', color:'negro',
    instalacion:'incluida', transporteIncluido:true, cantidad:1, precioNeto:987654,
    precioUnitario:1175308, precioFinal:1175308, extras:[]
  }, true)`);
  assertSinCostos('texto de la imagen', texto, { precioNeto: 987654 });

  vm.runInContext(read('aluminio.js'), h.context, { filename: 'aluminio.js' });
  const alu = h.run(`buildAluminumCommercialMessage({
    sys:'5020', cfg:'2N', vid:'5mm', col:'natural', tipoInst:'basica', w:120, h:150,
    totalAlu:111111, totalVid:122222, totalAcc:133333, costoMO:144444, costoInsumos:155555,
    costoInst:166666, transporte:30000, costoPrimo:177777, utilidad:188888, precioVenta:999999,
    ivaMonto:189999, precioFinal:1189998, margen:21.5, baseGravable:999999, ivaADeclarar:189999,
    gananciaReal:211111, margenReal:21.1, descuento:0, incluirCF:false, cfAncho:0, cfAlto:0,
    incluirAlfajia:false, incluirMosq:false, shareInputSnapshot:{cantidad:1}
  })`);
  assertSinCostos('WhatsApp aluminio', alu, { totalAlu: 111111, totalVid: 122222, totalAcc: 133333,
    costoMO: 144444, costoInsumos: 155555, costoInst: 166666, costoPrimo: 177777, utilidad: 188888,
    precioVenta: 999999, gananciaReal: 211111 });
  assert.match(alu, /\$1\.189\.998/);
});

// ---------- 2. Kit premium a $280.000 en todos los teléfonos ----------
const PREMIUM = 'División Corrediza Premium';
const configGuardada = (premium) => JSON.stringify({
  globales: { precio_vidrio_6mm: 106000, instalacion_base: 70000 },
  productos: { 'División Batiente (Tradicional)': 135000, 'División Corrediza Clásica': 120000, [PREMIUM]: premium },
});

test('3 la app trae el kit premium a $280.000 y la corrediza premium sube de precio', () => {
  const h = makeHarness();
  assert.equal(h.run(`DEFAULT_CONFIG.productos[${JSON.stringify(PREMIUM)}]`), 280000);
  assert.equal(h.run(`currentConfig.productos[${JSON.stringify(PREMIUM)}]`), 280000);
  assert.equal(h.localStorage.getItem('wilan_kit_premium_280000'), 'al-dia');
  let precio = null;
  const original = h.context.mostrarResultados;
  h.context.mostrarResultados = (final, ...rest) => { precio = final; return original(final, ...rest); };
  fill(h, { producto: PREMIUM, ancho: 120, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('calcular()');
  // (1,2 × 1,9 × 135.000 × 1,05 + 280.000 + 70.000 + 70.000 + 15.000 + 150.000) ÷ 0,85 × 1,05
  // B8 (2026-11-23): la estructura de la premium es $150.000 (ficha D2); con $100.000 daba
  // $1.060.117 (v7.32) y con el kit a $220.000, $985.999.
  assert.equal(Math.round(precio), 1121882);
});

test('4 un teléfono con $220.000 guardado pasa solo a $280.000 y queda guardado', () => {
  const h = makeHarness({ storage: { vidrios_config: configGuardada(220000) } });
  assert.equal(h.run(`currentConfig.productos[${JSON.stringify(PREMIUM)}]`), 280000);
  assert.equal(JSON.parse(h.localStorage.getItem('vidrios_config')).productos[PREMIUM], 280000);
  assert.equal(h.localStorage.getItem('wilan_kit_premium_280000'), 'actualizado');
  // Los demás valores guardados en el teléfono no se tocan.
  assert.equal(JSON.parse(h.localStorage.getItem('vidrios_config')).productos['División Corrediza Clásica'], 120000);
  h.runTimers();
  assert.ok(h.el('toast-container').log.some((t) => /actualizado a \$280\.000/.test(t.innerHTML)));
});

test('5 un teléfono con otro valor puesto a mano no se pisa: se avisa', () => {
  const h = makeHarness({ storage: { vidrios_config: configGuardada(250000) } });
  assert.equal(h.run(`currentConfig.productos[${JSON.stringify(PREMIUM)}]`), 250000);
  assert.equal(JSON.parse(h.localStorage.getItem('vidrios_config')).productos[PREMIUM], 250000);
  assert.equal(h.localStorage.getItem('wilan_kit_premium_280000'), null);
  h.runTimers();
  const aviso = h.el('toast-container').log.map((t) => t.innerHTML).join('\n');
  assert.match(aviso, /tiene \$250\.000 puesto a mano/);
  assert.match(aviso, /valor nuevo de la app es \$280\.000/);
  const nota = h.el('tab-divisiones').children.find((c) => c.id === 'aviso-kit-premium');
  assert.ok(nota && /\$250\.000/.test(nota.innerText), 'Configuración → Divisiones no muestra el aviso');
  // Al revisar y tocar Guardar, el aviso deja de salir y se respeta lo que quede.
  h.run('guardarConfig()');
  assert.equal(h.localStorage.getItem('wilan_kit_premium_280000'), 'revisado');
  const despues = makeHarness({ storage: h.localStorage.dump() });
  despues.runTimers();
  assert.equal(despues.run(`currentConfig.productos[${JSON.stringify(PREMIUM)}]`), 250000);
  assert.ok(!despues.el('toast-container').log.some((t) => /puesto a mano/.test(t.innerHTML)));
});

test('6 la migración corre una sola vez: un $220.000 puesto después de revisar se respeta', () => {
  const h = makeHarness({ storage: { vidrios_config: configGuardada(220000), wilan_kit_premium_280000: 'revisado' } });
  assert.equal(h.run(`currentConfig.productos[${JSON.stringify(PREMIUM)}]`), 220000);
});

// ---------- 3. Mínimo de $350.000 por salida: solo avisa ----------
test('7 el mínimo por salida avisa en pantalla, no cambia el precio y no va al cliente', () => {
  const h = makeHarness();
  let precio = null;
  const original = h.context.mostrarResultados;
  h.context.mostrarResultados = (final, ...rest) => { precio = final; return original(final, ...rest); };
  fill(h, { producto: 'Espejo Flotante', ancho: 40, alto: 50 });
  h.run('calcular()');
  assert.ok(precio < 350000, `el ejemplo debía quedar bajo el mínimo (${precio})`);
  const aviso = h.el('aviso-minimo-main');
  assert.equal(aviso.style.display, 'block');
  assert.match(aviso.innerText, new RegExp(`suma \\${fmt(precio).replace(/\./g, '\\.')}, menos que el mínimo de \\$350\\.000`));
  h.run('compartir()');
  assert.match(h.opened[0], new RegExp(fmt(precio).replace('$', '\\$').replace(/\./g, '\\.')), 'el precio cambió');
  assert.doesNotMatch(h.opened[0], /mínimo|aviso/i);

  // Con 9 espejos la salida pasa el mínimo y el aviso se va.
  h.el('cantidad-item').value = '9';
  h.run('actualizarAvisoMinimoPrincipal()');
  assert.equal(aviso.style.display, 'none');
});

test('8 en el carrito el aviso mira la salida completa, con descuento; tiras y repisa solas no avisan', () => {
  const h = makeHarness();
  fill(h, { producto: 'Repisa de vidrio 6 mm (hasta 30 cm)' });
  h.run('calcular()');
  assert.equal(h.el('aviso-minimo-main').style.display, 'none', 'una repisa sola no es una salida');
  h.run('agregarItem()');
  assert.equal(h.el('aviso-minimo-cart').style.display, 'none');

  fill(h, { producto: 'Espejo Flotante', ancho: 40, alto: 50 });
  h.run('calcular()');
  assert.equal(h.el('aviso-minimo-main').style.display, 'none', 'con carrito, el aviso va en el carrito');
  h.run('agregarItem()');
  const total = h.run('quoteItems.reduce((s, i) => s + i.precio, 0)');
  assert.ok(total < 350000);
  assert.equal(h.el('aviso-minimo-cart').style.display, 'block');

  fill(h, { producto: 'División Batiente (Tradicional)', ancho: 80, alto: 190, espesor: '8mm', color_acc: 'natural', glass_finish: 'transparent' });
  h.run('calcular()');
  h.run('agregarItem()');
  assert.equal(h.el('aviso-minimo-cart').style.display, 'none');
  // Un descuento que deja la salida bajo el mínimo vuelve a avisar.
  const conBatiente = h.run('quoteItems.reduce((s, i) => s + i.precio, 0)');
  h.el('quote-discount').value = String(Math.round(conBatiente) - 300000);
  h.run('actualizarTotalCotizacion()');
  assert.equal(h.el('aviso-minimo-cart').style.display, 'block');
  assert.match(h.el('aviso-minimo-cart').innerText, /suma \$300\.000/);
  h.run('compartirCompleto()');
  assert.doesNotMatch(h.opened[0], /mínimo|aviso/i);
});

// ---------- 4. Sin «Enviar al CRM» ----------
test('9 ya no hay botón «Enviar al CRM»; la bandeja sigue recibiendo por WhatsApp', () => {
  const bridge = read('agenda/quoteToCrm.js');
  assert.doesNotMatch(bridge, /Enviar al CRM|initializeUi|data-quote-crm-action|quoteCrmAction/);
  for (const file of ['index.html', 'app.js', 'aluminio.js', 'visual.js', 'comparador.js', 'agenda/ui.js']) {
    assert.doesNotMatch(read(file), /Enviar al CRM/, file);
  }
  const app = read('app.js');
  assert.equal((app.match(/quoteInbox\?\.record\(/g) || []).length, 2, 'WhatsApp individual y carrito registran en la bandeja');
});

// ---------- 5. «Botón haladera», no «pomo» ----------
test('10 el agarre se llama «botón haladera» y «pomo» no aparece', () => {
  const sources = ['index.html', 'app.js', 'aluminio.js', 'visual.js', 'comparador.js', 'iq.js', 'dashboard.js']
    .concat(fs.readdirSync(path.join(root, 'agenda')).filter((f) => f.endsWith('.js')).map((f) => `agenda/${f}`));
  sources.forEach((file) => assert.doesNotMatch(read(file), /\bpomos?\b/i, file));
  const h = makeHarness();
  const etiquetas = [];
  h.el('tab-especiales').children.forEach((group) => group.children.forEach((c) => { if (c.innerText) etiquetas.push(c.innerText); }));
  assert.ok(etiquetas.includes('ACC BOTÓN HALADERA'), `etiquetas: ${etiquetas.join(', ')}`);
});
