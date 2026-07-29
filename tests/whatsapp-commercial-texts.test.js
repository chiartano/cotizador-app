const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const capturedMessages = [];

function captureMessage(name, text) {
  capturedMessages.push({name, text});
}

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `No se encontró function ${name}`);
  const firstBrace = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let templateDepth = 0;
  for (let i = firstBrace; i < source.length; i += 1) {
    const char = source[i];
    const prev = source[i - 1];
    if (quote) {
      if (char === quote && prev !== '\\' && templateDepth === 0) quote = '';
      else if (quote === '`' && char === '$' && source[i + 1] === '{' && prev !== '\\') templateDepth += 1;
      else if (quote === '`' && char === '}' && templateDepth > 0) templateDepth -= 1;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`No se pudo extraer ${name}`);
}

function extractBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  assert.notEqual(start, -1, `No se encontró ${startNeedle}`);
  assert.notEqual(end, -1, `No se encontró ${endNeedle}`);
  return source.slice(start, end);
}

function normalizeEol(value) {
  return value.replace(/\r\n/g, '\n');
}

function functionsFrom(file, names, prelude, exportsList = names) {
  const source = read(file);
  const declarations = names.map(name => extractFunction(source, name)).join('\n');
  return Function(`${prelude}\n${declarations}\nreturn {${exportsList.join(',')}};`)();
}

const money = value => '$' + Math.round(value).toLocaleString('es-CO');
const main = functionsFrom(
  'app.js',
  ['main_sharePriceLines', 'buildMainCommercialMessage', 'cartInstallationLabel', 'buildCartCommercialMessage'],
  `const fmtMoney = ${money.toString()};
   const ALU_COLOR_LABELS = {natural:'Natural', negro:'Negro', blanco:'Blanco'};`
);
const aluminum = functionsFrom(
  'aluminio.js',
  ['alu_fmt', 'alu_installationLabel', 'buildAluminumCommercialMessage'],
  `const aluConfig = {
     sistemas: {
       '3831': {nombre:'VC3831 Abatible'},
       '5020': {nombre:'VC5020 Corrediza'},
       '744': {nombre:'PC744 Tradicional'},
       '8025': {nombre:'VC8025 Puerta'}
     },
     vidrios: {claro6:{label:'Claro 6 mm'}, claro8:{label:'Claro 8 mm'}}
   };
   const ALU_CONFIG_LABELS = {
     OX:{label:'OX'}, '2N':{label:'2 naves'}, CF:{label:'Panel fijo'}
   };
   const ALU_COLOR_LABELS = {natural:'Natural', negro:'Negro'};`
);
const visual = functionsFrom(
  'visual.js',
  ['_viz_fmtMoney', 'viz_factLines', 'buildVisualCommercialText'],
  ''
);
const comparator = functionsFrom(
  'comparador.js',
  ['cmp_fmt', 'buildComparisonCommercialMessage'],
  `const aluConfig = {vidrios:{claro6:{label:'Claro 6 mm'}}};
   const ALU_COLOR_LABELS = {natural:'Natural'};`
);

function calculatePrincipalWithRealEngine(snapshot, product) {
  const appSource = read('app.js');
  const comparatorSource = read('comparador.js');
  const defaultConfig = extractBetween(
    appSource,
    'const DEFAULT_CONFIG =',
    'const LOGICA_ACCESORIOS ='
  );
  const accessoryLogic = extractBetween(
    appSource,
    'const LOGICA_ACCESORIOS =',
    'const CANONICAL_PRODUCT_METADATA ='
  );
  const calculate = extractFunction(comparatorSource, 'cmp_calcularPrincipal');
  return Function(`
    ${defaultConfig}
    ${accessoryLogic}
    const currentConfig = DEFAULT_CONFIG;
    const cmp_baseSnapshot = ${JSON.stringify(snapshot)};
    const buildCanonicalProductMetadata = undefined;
    ${calculate}
    return cmp_calcularPrincipal(${JSON.stringify(product)});
  `)();
}

function mainResult({
  producto,
  ancho = 80,
  ancho2 = 0,
  alto = 190,
  espesor = '8mm',
  color = 'natural',
  led = false,
  cantidad = 1,
  precio,
  promo = false,
  promoColor = ''
}) {
  return {
    producto,
    precio,
    services: {installationIncluded:true, transportIncluded:true},
    shareInputSnapshot: {cantidad},
    raw: {
      ancho, ancho2, alto, espesor, color_acc:color, led, sandblasting:false,
      promo_fija_corrediza_economica:promo,
      promo_fija_corrediza_economica_color:promoColor
    }
  };
}

function aluminumResult({
  sys,
  cfg = '2N',
  tipoInst = 'basica',
  precioFinal,
  cantidad = 1,
  transporte = 0,
  incluirCF = false
}) {
  return {
    sys, cfg, vid:'claro6', col:'natural', tipoInst, w:120, h:150,
    precioFinal, transporte, incluirCF, cfAncho:40, cfAlto:150,
    incluirAlfajia:false, incluirMosq:false,
    shareInputSnapshot:{cantidad}
  };
}

function assertNoForbidden(text) {
  const forbidden = [
    /acero inoxidable 304/i,
    /vidrio templado/i,
    /18 meses/i,
    /garantía escrita/i,
    /VIALCOR/i,
    /válid[oa].*(?:8|15) días/i,
    /Incluye transporte e instalación/i,
    /canonicalProductId|familyId|variantId|mappingStatus|canonicalAttributes/i
  ];
  forbidden.forEach(pattern => assert.doesNotMatch(text, pattern));
}

function test(name, callback) {
  try {
    callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const outsidePromoInput = {
  producto:'División Corrediza Clásica',
  ancho:131,
  ancho2:0,
  alto:180,
  espesor:'6mm',
  color_acc:'natural',
  linea:'controlada',
  desmonte:false,
  sandblasting:false,
  led:false,
  recargo:0,
  extra:0,
  descuento:0
};
const outsidePromoCalculation = calculatePrincipalWithRealEngine(
  outsidePromoInput,
  outsidePromoInput.producto
);

const mainMatrix = [
  ['batiente', mainResult({producto:'División Batiente (Tradicional)', precio:747921})],
  ['clásica natural promo', mainResult({producto:'División Corrediza Clásica', espesor:'6mm', precio:650000, promo:true, promoColor:'natural'})],
  ['clásica negra promo', mainResult({producto:'División Corrediza Clásica', espesor:'6mm', color:'negro', precio:690000, promo:true, promoColor:'negro'})],
  ['clásica fuera promo', mainResult({
    producto:outsidePromoInput.producto,
    ancho:outsidePromoInput.ancho,
    alto:outsidePromoInput.alto,
    espesor:outsidePromoInput.espesor,
    color:outsidePromoInput.color_acc,
    precio:outsidePromoCalculation.precioFinal,
    promo:outsidePromoCalculation.promoFija
  })],
  ['premium', mainResult({producto:'División Corrediza Premium', precio:1114303})],
  ['L', mainResult({producto:'División de baño L - Corrediza', ancho:90, ancho2:80, precio:1207935})],
  ['cortaviento', mainResult({producto:'Cortaviento / Oficina', precio:1183103})],
  ['espejo sin LED', mainResult({producto:'Espejo Flotante', ancho:80, alto:100, precio:339938})],
  ['espejo con LED', mainResult({producto:'Espejo Flotante', ancho:80, alto:100, led:true, precio:405563})]
];

test('matriz principal usa plantillas por familia y precios auditados', () => {
  for (const [name, fixture] of mainMatrix) {
    const text = main.buildMainCommercialMessage(fixture, 'F-001', '29/07/2026');
    assert.match(text, new RegExp(money(fixture.precio).replace('$', '\\$').replace('.', '\\.')));
    assert.match(text, /Garantía:\* 12 meses/);
    if (fixture.producto.includes('Espejo')) {
      assert.match(text, /Producto:\* Espejo Flotante/);
      assert.match(text, fixture.raw.led ? /LED:\* incluido/ : /LED:\* no incluido/);
      assert.doesNotMatch(text, /Espesor|Acabado|Vidrio/);
    }
    assertNoForbidden(text);
    captureMessage(name, text);
    console.log(`message:${name}\n${text}\n`);
  }
});

test('frontera promocional 130/131 usa el motor real y el mensaje correcto', () => {
  const at130 = calculatePrincipalWithRealEngine(
    {...outsidePromoInput, ancho:130},
    outsidePromoInput.producto
  );
  assert.equal(at130.precioFinal, 650000);
  assert.equal(at130.promoFija, true);
  assert.equal(Math.round(outsidePromoCalculation.precioFinal), 787433);
  assert.equal(outsidePromoCalculation.promoFija, false);
  const text = main.buildMainCommercialMessage(
    mainMatrix.find(([name]) => name === 'clásica fuera promo')[1],
    'F-OUT',
    '29/07/2026'
  );
  assert.match(text, /Medidas:\* 131 x 180 cm/);
  assert.match(text, /Precio:\* \$787\.433, IVA incluido/);
  assert.doesNotMatch(text, /Promoción por tiempo limitado/);
});

test('cantidad dos informa unitario y total sin cambiar el precio unitario', () => {
  const fixture = mainResult({producto:'División Batiente (Tradicional)', precio:747921, cantidad:2});
  const text = main.buildMainCommercialMessage(fixture, 'F-002', '29/07/2026');
  assert.match(text, /Cantidad:\* 2/);
  assert.match(text, /Precio unitario:\* \$747\.921/);
  assert.match(text, /Total:\* \$1\.495\.842, IVA incluido/);
  captureMessage('division-cantidad-2', text);
});

const aluMatrix = [
  ['3831', aluminumResult({sys:'3831', cfg:'OX', precioFinal:974940, transporte:30000})],
  ['5020', aluminumResult({sys:'5020', precioFinal:768853})],
  ['5020 panel fijo', aluminumResult({sys:'5020', cfg:'CF', precioFinal:585952, incluirCF:true})],
  ['744 sin instalación', aluminumResult({sys:'744', tipoInst:'ninguna', precioFinal:1247709})],
  ['8025', aluminumResult({sys:'8025', precioFinal:3112120, transporte:50000})]
];

test('matriz aluminio respeta instalación y transporte efectivos', () => {
  for (const [name, fixture] of aluMatrix) {
    const text = aluminum.buildAluminumCommercialMessage(fixture);
    assert.match(text, /Garantía:\* 12 meses/);
    assert.match(text, new RegExp(money(fixture.precioFinal).replace('$', '\\$').replaceAll('.', '\\.')));
    if (fixture.tipoInst === 'ninguna') assert.match(text, /Instalación:\* no incluida/);
    if (fixture.transporte > 0) assert.match(text, /Transporte:\* incluido/);
    else assert.doesNotMatch(text, /Transporte:/);
    assertNoForbidden(text);
    captureMessage(`aluminio-${name}`, text);
    console.log(`message:aluminio-${name}\n${text}\n`);
  }
});

test('carrito mixto conserva familia, servicios, cantidad, descuento y total', () => {
  const items = [
    {...mainMatrix[0][1], medidas:'80x190', vidrio:'8mm', color:'natural', cantidad:1, precioUnitario:747921},
    {...mainMatrix[7][1], medidas:'80x100', vidrio:'Espejo', cantidad:1, precioUnitario:339938},
    {
      producto:'PC744 Tradicional (2 naves)', medidas:'120×150', vidrio:'Claro 6 mm',
      esAluminio:true, cantidad:1, precioUnitario:1247709, precio:1247709,
      raw:{color:'natural', instalacion:'ninguna', transporte:0}
    }
  ];
  const text = main.buildCartCommercialMessage(items, {
    folio:'F-003', fecha:'29/07/2026', cliente:{}, discount:50000
  });
  assert.match(text, /LED: no incluido/);
  assert.match(text, /Instalación: no incluida/);
  assert.match(text, /Descuento:\* -\$50\.000/);
  assert.match(text, /TOTAL: \$2\.285\.568\*, IVA incluido/);
  assert.match(text, /Garantía:\* 12 meses/);
  assert.doesNotMatch(text, /Incluye transporte e instalación/);
  const mirrorSection = text.slice(text.indexOf('*2. Espejo Flotante*'), text.indexOf('*3. PC744'));
  assert.doesNotMatch(mirrorSection, /Acabado|Color|Natural|Vidrio/);
  assertNoForbidden(text);
  captureMessage('carrito-mixto', text);
  console.log(`message:carrito-mixto\n${text}\n`);
});

test('comparador muestra características, IVA, diferencia y garantía sin validez', () => {
  const text = comparator.buildComparisonCommercialMessage(
    {producto:'División Batiente (Tradicional)', precioFinal:747921},
    {producto:'División Corrediza Premium', precioFinal:1114303},
    'principal',
    {ancho:80, alto:190, espesor:'8mm', color_acc:'negro', led:false}
  );
  assert.match(text, /Espesor: 8mm/);
  assert.match(text, /Acabado: negro/);
  assert.match(text, /Diferencia: \$366\.382/);
  assert.match(text, /IVA incluido/);
  assert.match(text, /Garantía: 12 meses/);
  assertNoForbidden(text);
  captureMessage('comparador', text);

  const mixed = comparator.buildComparisonCommercialMessage(
    {producto:'División Batiente (Tradicional)', precioFinal:747921},
    {producto:'Espejo Flotante', precioFinal:339938},
    'principal',
    {ancho:80, alto:100, espesor:'8mm', color_acc:'natural', led:false}
  );
  const mirrorOption = mixed.slice(mixed.indexOf('*OPCIÓN B:*'));
  assert.match(mirrorOption, /LED: no incluido/);
  assert.doesNotMatch(mirrorOption, /Espesor|Acabado|Vidrio/);
});

test('división L conserva 90 + 80 x 190 en individual, comparador, carrito y visual', () => {
  const lFixture = mainMatrix.find(([name]) => name === 'L')[1];
  const expectedGeometry = 'L(90 + 80) x 190 cm';
  const individual = main.buildMainCommercialMessage(lFixture, 'F-L', '29/07/2026');
  const lMetadata = {
    canonicalProductId:'DB-ESC',
    canonicalAttributes:{dimensionSchema:'width_height_side2'}
  };
  const comparison = comparator.buildComparisonCommercialMessage(
    {...lMetadata, producto:'División de baño L - Corrediza', precioFinal:1207935},
    {...lMetadata, producto:'División de baño L - Batiente', precioFinal:1400000},
    'principal',
    {producto:lFixture.producto, ancho:90, ancho2:80, alto:190, espesor:'8mm', color_acc:'natural', led:false}
  );
  const cart = main.buildCartCommercialMessage([
    {...lFixture, medidas:'L(90 + 80) x 190', vidrio:'8mm', color:'natural',
      cantidad:1, precioUnitario:lFixture.precio}
  ], {folio:'F-LC', fecha:'29/07/2026', cliente:{}, discount:0});
  const visualText = visual.buildVisualCommercialText({
    modo:'principal', familia:'division', folio:'F-LV', cliente:{},
    producto:lFixture.producto, medidas:expectedGeometry, vidrio:'8mm', color:'natural',
    led:false, instalacion:'incluida', transporteIncluido:true, cantidad:1,
    precioUnitario:lFixture.precio, precioFinal:lFixture.precio, extras:[]
  }, false);
  for (const [surface, text] of Object.entries({individual, comparison, cart, visual:visualText})) {
    assert.match(text, /L\(90 \+ 80\) x 190 cm/, surface);
  }
  captureMessage('L-individual-focal', individual);
  captureMessage('L-comparador-focal', comparison);
  captureMessage('L-carrito-focal', cart);
  captureMessage('L-visual-focal', visualText);
});

test('visual comparte exactamente los hechos propios de espejo', () => {
  const data = {
    modo:'principal', familia:'espejo', folio:'F-004', cliente:{nombre:'Cliente Ficticio'},
    producto:'Espejo Flotante', medidas:'80x100', vidrio:'', color:'', led:true,
    instalacion:'incluida', transporteIncluido:true, cantidad:1,
    precioUnitario:405563, precioFinal:405563, extras:[]
  };
  const facts = visual.viz_factLines(data);
  const text = visual.buildVisualCommercialText(data, true);
  for (const fact of facts) assert.match(text, new RegExp(fact.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(text, /Precio: \$405\.563, IVA incluido/);
  assertNoForbidden(text);
  captureMessage('visual-espejo-led', text);
});

test('protección de resultado anterior compara todos los inputs relevantes', () => {
  const source = read('app.js');
  const snapshotFns = functionsFrom(
    'app.js',
    ['main_getShareInputSnapshot', 'main_isShareSnapshotCurrent'],
    `const document = {getElementById(id) { return globalThis.values[id]; }};`
  );
  globalThis.values = {
    producto:{value:'División Batiente (Tradicional)'}, ancho:{value:'80'}, ancho2:{value:''},
    alto:{value:'190'}, espesor:{value:'8mm'}, color_acc:{value:'natural'},
    'check-espejo-led':{checked:false}, 'cantidad-item':{value:'1'},
    descuento_adicional:{value:''}, recargo_transporte:{value:''}
  };
  const result = {shareInputSnapshot:snapshotFns.main_getShareInputSnapshot()};
  assert.equal(snapshotFns.main_isShareSnapshotCurrent(result), true);
  globalThis.values.producto.value = 'Espejo Flotante';
  assert.equal(snapshotFns.main_isShareSnapshotCurrent(result), false);
  globalThis.values.producto.value = 'División Batiente (Tradicional)';
  globalThis.values.ancho.value = '81';
  assert.equal(snapshotFns.main_isShareSnapshotCurrent(result), false);
  const shareSource = extractFunction(source, 'compartir');
  const validationIndex = shareSource.indexOf('main_isShareSnapshotCurrent(lastCalculation)');
  const folioIndex = shareSource.indexOf('const folio = folioConsumir()');
  assert.notEqual(validationIndex, -1, 'Debe existir la validación anti-stale');
  assert.notEqual(folioIndex, -1, 'Debe existir el consumo de folio');
  assert.ok(validationIndex < folioIndex, 'La validación debe ocurrir antes del consumo de folio');

  const behavioral = Function('main_isShareSnapshotCurrent', `
    let lastCalculation = ${JSON.stringify(result)};
    const STALE_SHARE_MESSAGE = 'Los datos cambiaron después del último cálculo. Calcula nuevamente antes de compartir.';
    const notices = [];
    let consumedFolios = 0;
    function toast(message) { notices.push(message); }
    function folioConsumir() { consumedFolios += 1; return 'F-NO-DEBE-CONSUMIRSE'; }
    ${shareSource}
    return {
      run: compartir,
      state: () => ({notices:[...notices], consumedFolios})
    };
  `)(snapshotFns.main_isShareSnapshotCurrent);
  behavioral.run();
  assert.deepEqual(behavioral.state(), {
    notices:['Los datos cambiaron después del último cálculo. Calcula nuevamente antes de compartir.'],
    consumedFolios:0
  });
  delete globalThis.values;
});

test('IQ permanece no bloqueante y fuera del diff', () => {
  const appSource = read('app.js');
  const aluSource = read('aluminio.js');
  const sharing = [
    extractFunction(appSource, 'compartir'),
    extractFunction(aluSource, 'alu_compartirWA')
  ].join('\n');
  assert.doesNotMatch(sharing, /iq_get|IQ|danger|block|revisión técnica/i);
});

test('fórmulas monetarias permanecen idénticas a 76db88e', () => {
  const base = '76db88eecc56101a8ead1eb4fae9d421be5992d6';
  const atBase = file => execFileSync('git', ['show', `${base}:${file}`], {cwd:root, encoding:'utf8'});
  const formulaRegions = [
    ['app.js', 'function calcular()', '// Guardar cálculo actual'],
    ['aluminio.js', 'function alu_calcular()', '// ---- 11. GUARDAR Y RENDERIZAR ----']
  ];
  formulaRegions.forEach(([file, start, end]) => {
    assert.equal(
      normalizeEol(extractBetween(read(file), start, end)),
      normalizeEol(extractBetween(atBase(file), start, end)),
      file
    );
  });
  assert.equal(
    normalizeEol(extractFunction(read('comparador.js'), 'cmp_calcularPrincipal')),
    normalizeEol(extractFunction(atBase('comparador.js'), 'cmp_calcularPrincipal'))
  );
});

test('todas las superficies automáticas incluyen garantía aprobada', () => {
  const sources = ['app.js', 'aluminio.js', 'visual.js', 'comparador.js'].map(read).join('\n');
  assert.match(sources, /Garantía:\*? 12 meses/);
  assert.doesNotMatch(sources, /garantía escrita por (?:12|18) meses/i);
});

const evidenceDir = process.env.WA_EVIDENCE_DIR || process.argv[2];
if (evidenceDir) {
  fs.mkdirSync(evidenceDir, {recursive:true});
  for (const message of capturedMessages) {
    const safeName = message.name.normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase();
    fs.writeFileSync(path.join(evidenceDir, `${safeName}.txt`), `${message.text}\n`, 'utf8');
  }
  fs.writeFileSync(
    path.join(evidenceDir, 'matriz-mensajes.json'),
    `${JSON.stringify(capturedMessages, null, 2)}\n`,
    'utf8'
  );
}
