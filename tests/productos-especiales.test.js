// Productos y vidrios especiales del Cotizador (2026-11-19).
// Datos ficticios. Precios de costo dados por Andrés el 2026-11-19.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function test(name, fn) {
  try { fn(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

function extractBlock(startNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `No se encontró ${startNeedle}`);
  const firstBrace = source.indexOf('{', start);
  let depth = 0;
  for (let i = firstBrace; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    if (source[i] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`No se pudo extraer ${startNeedle}`);
}

const defaults = Function(`${extractBlock('const DEFAULT_CONFIG =')}; return DEFAULT_CONFIG;`)();
const helpers = Function(`
  ${extractBlock('const PRODUCTOS_ESPECIALES =')};
  const esProductoEspecial = (nombre) => Object.values(PRODUCTOS_ESPECIALES).includes(nombre);
  ${extractBlock('const VIDRIOS_ESPECIALES =')};
  ${extractBlock('function costoKitPlegable')}
  ${extractBlock('function costoPerfilU')}
  return { PRODUCTOS_ESPECIALES, esProductoEspecial, VIDRIOS_ESPECIALES, costoKitPlegable, costoPerfilU };
`)();
const metadata = Function(`${extractBlock('const CANONICAL_PRODUCT_METADATA =')}; return CANONICAL_PRODUCT_METADATA;`)();
const cfg = defaults.globales;

test('1 precios de costo de Andrés en Configuración', () => {
  assert.equal(cfg.precio_vidrio_serigrafia_6mm, 250000);
  assert.equal(cfg.precio_vidrio_serigrafia_negra_8mm, 310000);
  assert.equal(cfg.precio_vidrio_laminado_4_4, 430000);
  assert.equal(cfg.precio_vidrio_negro_6mm, 170000);
  assert.equal(cfg.precio_vidrio_5mm, 80000);
  assert.equal(cfg.acc_bisagra_muro, 35000);
  assert.equal(cfg.acc_bisagra_vidrio_vidrio, 70000);
  assert.equal(cfg.acc_boton, 15000);
  assert.equal(cfg.acc_tubo_terminales_carro, 120000);
  assert.equal(cfg.acc_perfil_u_6m, 20000);
  assert.equal(cfg.precio_repisa_6mm, 60000);
});

test('2 los 4 productos nuevos aparecen en la lista y los viejos siguen', () => {
  const nombres = Object.keys(defaults.productos);
  Object.values(helpers.PRODUCTOS_ESPECIALES).forEach((nombre) => assert.ok(nombres.includes(nombre), nombre));
  ['División Batiente (Tradicional)', 'División Corrediza Clásica', 'División Corrediza Premium',
    'División de baño L - Corrediza', 'División de baño L - Batiente', 'Cortaviento / Oficina', 'Espejo Flotante']
    .forEach((nombre) => assert.ok(nombres.includes(nombre), nombre));
  assert.equal(defaults.productos['División Corrediza Clásica'], 120000);
});

test('3 kit de la plegable de 2 hojas: natural 360.000, negro 410.000 (tubo y carro 120.000 / 140.000)', () => {
  assert.equal(helpers.costoKitPlegable(cfg, 'natural'), 360000);
  assert.equal(helpers.costoKitPlegable(cfg, 'negro'), 410000);
  assert.equal(helpers.costoKitPlegable(cfg, 'dorado'), 360000 + cfg.extra_color_dorado);
});

// B8 (2026-11-23): la ficha D7 dice un perfil en cada lado del vidrio, 2 x ancho + 2 x alto
// (Andrés, 2026-11-20). Antes el Cotizador cobraba 2 x ancho + alto.
test('4 perfil U del panel fijo en tiras de 6 m (2 x ancho + 2 x alto)', () => {
  assert.equal(helpers.costoPerfilU(cfg, 0.5, 2.15), 20000);  // 5,3 m → 1 tira
  assert.equal(helpers.costoPerfilU(cfg, 1.0, 2.0), 20000);   // 6 m justos → 1 tira
  assert.equal(helpers.costoPerfilU(cfg, 1.0, 2.15), 40000);  // 6,3 m → 2 tiras
  assert.equal(helpers.costoPerfilU(cfg, 2.0, 4.1), 60000);   // 12,2 m → 3 tiras
});

test('5 vidrios especiales fijan su espesor', () => {
  const v = helpers.VIDRIOS_ESPECIALES;
  assert.equal(v.serigrafia_6mm.espesor, '6mm');
  assert.equal(v.serigrafia_negra_8mm.espesor, '8mm');
  assert.equal(v.laminado_4_4.label, 'Laminado templado 4+4');
  assert.equal(v.negro_6mm.label, 'Transparente negro 6 mm');
  Object.values(v).forEach((item) => assert.equal(typeof cfg[item.precioKey], 'number', item.precioKey));
});

test('6 identidad de catálogo que acepta la bandeja del CRM', () => {
  const p = helpers.PRODUCTOS_ESPECIALES;
  assert.equal(metadata[p.PLEGABLE].canonicalProductId, 'DB-PLE');
  assert.equal(metadata[p.PANEL_FIJO].canonicalProductId, 'DB-FIJ');
  assert.equal(metadata[p.TIRAS].canonicalProductId, 'VID-TEM');
  assert.equal(metadata[p.REPISA].canonicalProductId, 'REP-REC');
  Object.values(p).forEach((nombre) => assert.equal(metadata[nombre].mappingStatus, 'map_with_attributes'));
});

test('7 los productos especiales no se editan como precio base en Divisiones', () => {
  assert.ok(helpers.esProductoEspecial('Repisa de vidrio 6 mm (hasta 30 cm)'));
  assert.ok(!helpers.esProductoEspecial('División Corrediza Clásica'));
});

const texts = Function(`
  const fmtMoney = (n) => '$' + Math.round(n).toLocaleString('es-CO');
  ${extractBlock('const FICHAS =')};
  ${extractBlock('function etiquetaColorHerraje')}
  ${extractBlock('function textoGarantia')}
  ${extractBlock('function main_sharePriceLines')}
  ${extractBlock('function cartInstallationLabel')}
  ${extractBlock('function aluminumColorLabel')}
  ${extractBlock('function buildMainCommercialMessage')}
  ${extractBlock('function buildCartCommercialMessage')}
  return { buildMainCommercialMessage, buildCartCommercialMessage };
`)();

test('9 el mensaje dice el vidrio especial y el plazo de 12 a 15 días hábiles', () => {
  const result = {
    producto: 'Panel fijo piso a techo (perfil U)', precio: 688290, medidas: '50x215',
    services: { transportIncluded: true }, shareInputSnapshot: { cantidad: 1 },
    raw: { ancho: 50, alto: 215, espesor: '6mm', color_acc: 'negro',
      vidrio_descripcion: 'Serigrafía 6 mm', plazo_entrega: '12 a 15 días hábiles después del anticipo' },
  };
  const texto = texts.buildMainCommercialMessage(result, 'COT-2026-0101', '19/11/2026');
  assert.match(texto, /\*Vidrio:\* Serigrafía 6 mm/);
  assert.doesNotMatch(texto, /\*Espesor:\*/);
  assert.match(texto, /\*Acabado:\* NEGRO/);
  assert.match(texto, /\*Entrega:\* 12 a 15 días hábiles después del anticipo/);
  assert.match(texto, /Garantía:\* 12 meses/);
});

test('10 el presupuesto con varios productos describe cada uno; la repisa sin medidas dice «hasta 30 cm»', () => {
  const items = [
    { producto: 'División de baño plegable (2 hojas)', medidas: '110x193', vidrio: '6mm', vidrioDescripcion: 'Transparente negro 6 mm',
      plazoEntrega: '12 a 15 días hábiles después del anticipo', color: 'negro', cantidad: 1, precio: 1200000, services: { transportIncluded: true } },
    { producto: 'Tiras de vidrio 5 mm (adicional)', medidas: '10x260', vidrio: '5mm', vidrioDescripcion: 'Templado incoloro 5 mm',
      color: '', cantidad: 2, precio: 91016, services: { transportIncluded: false } },
    { producto: 'Repisa de vidrio 6 mm (hasta 30 cm)', medidas: 'hasta 30', vidrio: '6mm', vidrioDescripcion: 'Templado 6 mm',
      color: '', cantidad: 1, precio: 60000, services: { transportIncluded: false } },
    { producto: 'División Corrediza Clásica', medidas: '120x190', vidrio: '8mm', color: 'natural', cantidad: 1, precio: 900000,
      services: { transportIncluded: true } },
  ];
  const texto = texts.buildCartCommercialMessage(items, { folio: 'COT-2026-0102', fecha: '19/11/2026', cliente: { nombre: 'Cliente Ficticio' } });
  assert.match(texto, /Vidrio: Transparente negro 6 mm/);
  assert.match(texto, /Entrega: 12 a 15 días hábiles después del anticipo/);
  assert.match(texto, /Vidrio: Templado incoloro 5 mm/);
  assert.match(texto, /Medidas: hasta 30 cm/);
  assert.match(texto, /Espesor: 8mm/); // los productos de siempre no cambian
  assert.equal((texto.match(/Entrega:/g) || []).length, 1); // solo el vidrio especial lleva plazo
  assert.equal((texto.match(/Transporte: incluido/g) || []).length, 2); // tiras y repisa van en la misma visita
});

// Plegable, panel y tiras (Andrés, 2026-11-19): margen propio sobre la venta sin IVA.
// precio = (costos + estructura) x 1,19 / (1 - margen). La línea controlada pone estructura 100.000.
const precio = (costoDirecto, margen, est = cfg.est_controlada) => (costoDirecto + est) * (1 + cfg.iva) / (1 - margen);

test('8 ejemplos del cliente del 2026-11-19 (los mismos que se verifican en el navegador)', () => {
  const otros = cfg.instalacion_base + cfg.transporte + cfg.insumos;
  // Plegable negra 109,5 x 193 en 8 mm transparente
  // Plegable negra 109,5 x 193 en transparente negro 6 mm, margen 15 %
  const plegable = precio(1.095 * 1.93 * cfg.precio_vidrio_negro_6mm * cfg.colchon_vidrio + 410000 + otros, cfg.margen_plegable);
  assert.equal(Math.round(plegable), 1459126);
  // Panel fijo 50 x 215 en serigrafía negra 8 mm, margen 20 %
  const panel = precio(0.5 * 2.15 * cfg.precio_vidrio_serigrafia_negra_8mm * cfg.colchon_vidrio + 20000 + otros, cfg.margen_panel_fijo);
  assert.equal(Math.round(panel), 929557); // con el costo redondeado a $624.913 da $929.558
  // Tira 10 x 260: vidrio + insumos, sin transporte ni estructura, margen 30 %
  const tira = precio(0.1 * 2.6 * cfg.precio_vidrio_5mm * cfg.colchon_vidrio + cfg.insumos + cfg.instalacion_adicional, cfg.margen_tiras, 0);
  assert.equal(Math.round(tira), 62628);
  assert.equal(Math.round(tira * 4), 250512);
  assert.equal(cfg.margen_plegable, 0.15);
  assert.equal(cfg.margen_panel_fijo, 0.20);
  assert.equal(cfg.margen_tiras, 0.30);
});
