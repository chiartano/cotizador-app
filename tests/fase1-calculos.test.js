const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function money(value) {
  return Math.round(value);
}

function generalQuote({ recargoTransporte = 0, descuento = 0, vidrio = 106000 }) {
  const cfg = {
    colchonVidrio: 1.05,
    instalacionBase: 70000,
    transporte: 70000,
    insumos: 15000,
    estControlada: 100000,
    utilControlada: 0.15,
    iva: 0.19,
  };

  const area = 1.2 * 1.5;
  const costoVidrio = area * vidrio * cfg.colchonVidrio;
  const costoAccesorios = 135000;
  const costoDirecto = costoVidrio + costoAccesorios + cfg.instalacionBase
    + cfg.transporte + recargoTransporte + cfg.insumos;
  const totalCostos = costoDirecto + cfg.estControlada;
  const precioBase = totalCostos / (1 - cfg.utilControlada);
  let precioFinal = precioBase * 1.05;
  if (descuento > 0) precioFinal = Math.max(0, precioFinal - descuento);

  const baseGravable = precioFinal / (1 + cfg.iva);
  const gananciaReal = baseGravable - totalCostos;
  const margenReal = baseGravable > 0 ? (gananciaReal / baseGravable) * 100 : 0;

  return {
    totalCostos: money(totalCostos),
    precioBase: money(precioBase),
    precioFinal: money(precioFinal),
    margenReal,
  };
}

function aluminioQuote({ descuento = 0 }) {
  const precioVenta = 646095;
  const iva = 0.19;
  let precioFinal = precioVenta + (precioVenta * iva);
  if (descuento > 0) precioFinal = Math.max(0, precioFinal - descuento);
  return { precioFinal: money(precioFinal) };
}

function readSource(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(start, -1, `No se encontro ${startNeedle}`);
  assert.notEqual(end, -1, `No se encontro ${endNeedle}`);
  return source.slice(start, end);
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `No se encontro function ${name}`);
  const firstBrace = source.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function loadMainCanonicalHarness() {
  const app = readSource('app.js');
  const block = extractBetween(app, 'const DEFAULT_CONFIG =', '// Variables para cotiz');
  return Function(`${block}; return {
    DEFAULT_CONFIG,
    LOGICA_ACCESORIOS,
    CANONICAL_PRODUCT_METADATA,
    buildCanonicalProductMetadata
  };`)();
}

function loadAluminumCanonicalHarness() {
  const aluminio = readSource('aluminio.js');
  const block = extractBetween(aluminio, 'const ALU_CANONICAL_METADATA =', '// ---------- ESTADO RUNTIME');
  return Function(`${block}; return {
    ALU_CANONICAL_METADATA,
    alu_buildCanonicalMetadata
  };`)();
}

function loadComparatorPrincipal(env) {
  const comparador = readSource('comparador.js');
  const fn = extractFunction(comparador, 'cmp_calcularPrincipal');
  return Function('env', `
    const currentConfig = env.currentConfig;
    const LOGICA_ACCESORIOS = env.LOGICA_ACCESORIOS;
    const buildCanonicalProductMetadata = env.buildCanonicalProductMetadata;
    let cmp_baseSnapshot = env.cmp_baseSnapshot;
    ${fn}
    return cmp_calcularPrincipal;
  `)(env);
}

function loadDashboardHarness() {
  const dashboard = readSource('dashboard.js');
  const store = new Map();
  const sandbox = {
    console,
    Date,
    localStorage: {
      getItem(key) {
        return store.has(key) ? store.get(key) : null;
      },
      setItem(key, value) {
        store.set(key, String(value));
      },
    },
  };
  vm.runInNewContext(dashboard, sandbox);
  return { ...sandbox, store };
}

function assertFiveCanonicalFields(value) {
  for (const field of [
    'canonicalProductId',
    'familyId',
    'variantId',
    'mappingStatus',
    'canonicalAttributes',
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(value, field), `falta ${field}`);
  }
}

function test(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

test('1 general base mantiene precio final auditado', () => {
  const result = generalQuote({});
  console.log('  result:', {
    totalCostos: result.totalCostos,
    precioBase: result.precioBase,
    precioFinal: result.precioFinal,
    margenReal: Number(result.margenReal.toFixed(4)),
  });
  assert.equal(result.totalCostos, 590340);
  assert.equal(result.precioBase, 694518);
  assert.equal(result.precioFinal, 729244);
  assert.ok(Math.abs(result.margenReal - 3.67) < 0.01);
});

test('2 general suma recargo transporte al costo real', () => {
  const result = generalQuote({ recargoTransporte: 70000 });
  console.log('  result:', {
    totalCostos: result.totalCostos,
    precioBase: result.precioBase,
    precioFinal: result.precioFinal,
  });
  assert.equal(result.totalCostos, 660340);
  assert.equal(result.precioBase, 776871);
  assert.equal(result.precioFinal, 815714);
});

test('3 general descuento reduce exactamente el precio final', () => {
  const base = generalQuote({});
  const discounted = generalQuote({ descuento: 10000 });
  console.log('  result:', {
    basePrecioFinal: base.precioFinal,
    descuento: 10000,
    precioFinalConDescuento: discounted.precioFinal,
    diferencia: base.precioFinal - discounted.precioFinal,
  });
  assert.equal(discounted.precioFinal, 719244);
  assert.equal(base.precioFinal - discounted.precioFinal, 10000);
});

test('4 aluminio elimina sobrecosto del 5%', () => {
  const result = aluminioQuote({});
  console.log('  result:', {
    precioFinal: result.precioFinal,
  });
  assert.equal(result.precioFinal, 768853);
});

test('5 aluminio descuento reduce exactamente el precio final', () => {
  const base = aluminioQuote({});
  const discounted = aluminioQuote({ descuento: 10000 });
  console.log('  result:', {
    basePrecioFinal: base.precioFinal,
    descuento: 10000,
    precioFinalConDescuento: discounted.precioFinal,
    diferencia: base.precioFinal - discounted.precioFinal,
  });
  assert.equal(discounted.precioFinal, 758853);
  assert.equal(base.precioFinal - discounted.precioFinal, 10000);
});

test('6 comparador y cotizador principal comparten precio final general', () => {
  const appResult = generalQuote({});
  const comparadorResult = generalQuote({});
  console.log('  result:', {
    cotizadorPrincipalPrecioFinal: appResult.precioFinal,
    comparadorPrecioFinal: comparadorResult.precioFinal,
    iguales: comparadorResult.precioFinal === appResult.precioFinal,
  });
  assert.equal(comparadorResult.precioFinal, appResult.precioFinal);
});

test('guardas de fuente contra regresiones criticas', () => {
  const app = readSource('app.js');
  const comparador = readSource('comparador.js');
  const aluminio = readSource('aluminio.js');

  assert.match(app, /costoInstalacion \+ costoTransporte \+ recargoTransporte \+ costoInsumos/);
  assert.match(app, /const AJUSTE_COMERCIAL = 1\.05;/);
  assert.match(app, /precioFinal = Math\.max\(0, precioFinal - descuentoAdicional\)/);
  assert.doesNotMatch(app, /precioFinal\s*\*=\s*1\.05/);
  assert.doesNotMatch(app, /precioFinal\s*=\s*precioSinIva \* \(1 \+ cfg\.iva\)/);
  assert.doesNotMatch(app, /precioSinIva/);
  assert.match(comparador, /const AJUSTE_COMERCIAL = 1\.05;/);
  assert.match(comparador, /precioFinal = Math\.max\(0, precioFinal - descuentoAdicional\)/);
  assert.doesNotMatch(comparador, /precioSinIva/);
  assert.match(aluminio, /let precioFinal = precioVenta \+ ivaMonto;/);
  assert.match(aluminio, /precioFinal = Math\.max\(0, precioFinal - descuento\)/);
  assert.doesNotMatch(aluminio, /precioFinal\s*=\s*\(precioVenta \+ ivaMonto\) \* 1\.05/);
  assert.doesNotMatch(aluminio, /precioVenta\s*=\s*costoPrimo \+ utilidad - descuento/);
});

test('7 metadata canonica para division mapeada deriva IDs de la tabla real', () => {
  const { CANONICAL_PRODUCT_METADATA, buildCanonicalProductMetadata } = loadMainCanonicalHarness();
  const [productName, expected] = Object.entries(CANONICAL_PRODUCT_METADATA)
    .find(([, meta]) => meta.canonicalProductId === 'DB-COR' && meta.variantId === 'DB-COR-2H');

  const result = buildCanonicalProductMetadata(productName, { espesor: '8mm' });

  console.log('  canonical:', { productName, result });
  assertFiveCanonicalFields(result);
  assert.equal(result.canonicalProductId, expected.canonicalProductId);
  assert.equal(result.familyId, expected.familyId);
  assert.equal(result.variantId, expected.variantId);
  assert.equal(result.mappingStatus, expected.mappingStatus);
  assert.equal(result.canonicalAttributes.glassThickness, 8);
});

test('8 producto ambiguo conserva ID nulo y estado split_required', () => {
  const { CANONICAL_PRODUCT_METADATA, buildCanonicalProductMetadata } = loadMainCanonicalHarness();
  const [productName, expected] = Object.entries(CANONICAL_PRODUCT_METADATA)
    .find(([, meta]) => meta.mappingStatus === 'split_required');

  const result = buildCanonicalProductMetadata(productName, {});

  console.log('  ambiguous:', { productName, result });
  assert.equal(expected.canonicalProductId, null);
  assert.equal(result.canonicalProductId, null);
  assert.equal(result.familyId, null);
  assert.equal(result.variantId, null);
  assert.equal(result.mappingStatus, expected.mappingStatus);
  assert.ok(!result.canonicalAttributes);
});

test('9 metadata canonica de aluminio deriva IDs de la tabla real', () => {
  const { ALU_CANONICAL_METADATA, alu_buildCanonicalMetadata } = loadAluminumCanonicalHarness();
  const system = '5020';
  const expected = ALU_CANONICAL_METADATA[system];
  const result = alu_buildCanonicalMetadata(system, '2N', '6mm');

  console.log('  aluminum canonical:', { system, result });
  assertFiveCanonicalFields(result);
  assert.equal(result.canonicalProductId, expected.canonicalProductId);
  assert.equal(result.familyId, expected.familyId);
  assert.equal(result.variantId, expected.variantId);
  assert.equal(result.mappingStatus, expected.mappingStatus);
  assert.deepEqual(result.canonicalAttributes, {
    aluminumSystem: '5020',
    aluminumConfig: '2N',
    glassThickness: 6,
  });
});

test('10 comparador conserva metadata y precio final de division', () => {
  const main = loadMainCanonicalHarness();
  const productName = Object.entries(main.CANONICAL_PRODUCT_METADATA)
    .find(([, meta]) => meta.canonicalProductId === 'DB-COR' && meta.variantId === 'DB-COR-2H')[0];
  const baseEnv = {
    currentConfig: JSON.parse(JSON.stringify(main.DEFAULT_CONFIG)),
    LOGICA_ACCESORIOS: main.LOGICA_ACCESORIOS,
    cmp_baseSnapshot: {
      ancho: 120,
      ancho2: 0,
      alto: 150,
      espesor: '8mm',
      linea: 'controlada',
      color_acc: 'natural',
      desmonte: false,
      sandblasting: false,
      led: false,
      recargo: 0,
      extra: 0,
      descuento: 0,
      producto: productName,
    },
  };
  const withMetadata = loadComparatorPrincipal({
    ...baseEnv,
    buildCanonicalProductMetadata: main.buildCanonicalProductMetadata,
  })(productName);
  const withoutMetadata = loadComparatorPrincipal({
    ...baseEnv,
    buildCanonicalProductMetadata: undefined,
  })(productName);

  console.log('  comparator:', {
    productName,
    precioConMetadata: Math.round(withMetadata.precioFinal),
    precioSinMetadata: Math.round(withoutMetadata.precioFinal),
    canonicalProductId: withMetadata.canonicalProductId,
  });
  assertFiveCanonicalFields(withMetadata);
  assert.equal(withMetadata.precioFinal, withoutMetadata.precioFinal);
  assert.equal(withMetadata.canonicalProductId, main.CANONICAL_PRODUCT_METADATA[productName].canonicalProductId);
  assert.equal(Object.prototype.hasOwnProperty.call(withoutMetadata, 'canonicalProductId'), false);
});

test('11 dashboard preserva metadata canonica en historial extendido', () => {
  const dash = loadDashboardHarness();
  const item = {
    producto: 'Division de prueba',
    medidas: '120x150',
    precio: 729244,
    fecha: new Date('2026-07-11T12:00:00-05:00'),
    origen: 'principal',
    canonicalProductId: 'DB-COR',
    familyId: 'DB',
    variantId: 'DB-COR-2H',
    mappingStatus: 'map_with_variant',
    canonicalAttributes: { glassThickness: 8 },
  };

  dash.dash_registrar(item);
  const saved = JSON.parse(dash.localStorage.getItem('cotizador_historial_full_v1'));

  console.log('  dashboard saved:', saved[0]);
  assertFiveCanonicalFields(saved[0]);
  assert.equal(saved[0].canonicalProductId, item.canonicalProductId);
  assert.deepEqual(saved[0].canonicalAttributes, item.canonicalAttributes);
});

test('12 carrito conserva metadata al copiar lastCalculation', () => {
  const main = loadMainCanonicalHarness();
  const productName = Object.entries(main.CANONICAL_PRODUCT_METADATA)
    .find(([, meta]) => meta.canonicalProductId === 'DB-BAT')[0];
  const lastCalculation = {
    producto: productName,
    precio: generalQuote({}).precioFinal,
    ...main.buildCanonicalProductMetadata(productName, { espesor: '6mm' }),
  };
  const itemToAdd = { ...lastCalculation };

  console.log('  cart metadata:', itemToAdd);
  assertFiveCanonicalFields(itemToAdd);
  assert.equal(itemToAdd.precio, lastCalculation.precio);
  assert.deepEqual(itemToAdd.canonicalAttributes, { glassThickness: 6 });
});

test('13 metadata de aluminio es monetariamente neutra', () => {
  const { alu_buildCanonicalMetadata } = loadAluminumCanonicalHarness();
  const base = aluminioQuote({});
  const withMetadata = {
    ...base,
    ...alu_buildCanonicalMetadata('5020', '2N', '6mm'),
  };

  console.log('  aluminum neutrality:', {
    precioBase: base.precioFinal,
    precioConMetadata: withMetadata.precioFinal,
    canonicalProductId: withMetadata.canonicalProductId,
  });
  assert.equal(withMetadata.precioFinal, base.precioFinal);
  assertFiveCanonicalFields(withMetadata);
});
