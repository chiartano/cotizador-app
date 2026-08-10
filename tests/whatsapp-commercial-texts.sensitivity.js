const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const commercialFiles = ['app.js', 'aluminio.js', 'visual.js', 'comparador.js'];
const protectedFiles = [...commercialFiles, 'sw.js', 'tests/pwa-atomic-update.test.js'];

function readSet(dir) {
  return Object.fromEntries(protectedFiles.map(file => [
    file,
    fs.readFileSync(path.join(dir, file), 'utf8')
  ]));
}

function commercialInvariantErrors(dir) {
  const files = readSet(dir);
  const joined = commercialFiles.map(file => files[file]).join('\n');
  const errors = [];
  const banned = [
    /acero inoxidable 304/i,
    /garantía escrita/i,
    /18 meses/i,
    /Perfilería aluminio VIALCOR/i,
    /Incluye transporte e instalación/i,
    /Válid[oa].*(?:8|15) días/i
  ];
  banned.forEach(pattern => {
    if (pattern.test(joined)) errors.push(`frase prohibida: ${pattern}`);
  });
  if (!files['visual.js'].includes("color: esEspejo ? '' : raw.color_acc")) {
    errors.push('el espejo visual puede heredar color');
  }
  if (!files['aluminio.js'].includes('alu_installationLabel(result.tipoInst)')) {
    errors.push('aluminio no deriva instalación de la selección');
  }
  if (!files['aluminio.js'].includes('if (result.transporte > 0)')) {
    errors.push('aluminio puede afirmar transporte sin respaldo');
  }
  if (!files['app.js'].includes('`🔢 *Cantidad:* ${qty}\\n`')) {
    errors.push('falta cantidad en mensaje individual');
  }
  const shareStart = files['app.js'].indexOf('function compartir()');
  const shareEnd = files['app.js'].indexOf('function fmtMoney', shareStart);
  const share = files['app.js'].slice(shareStart, shareEnd);
  if (!share.includes('if (!main_isShareSnapshotCurrent(lastCalculation))')) {
    errors.push('falta protección de resultado anterior');
  }
  const requiredWarranty = [
    ['app.js', 'texto += `🔹 *Garantía:* 12 meses'],
    ['app.js', 'texto += `🛡️ *Garantía:* 12 meses'],
    ['aluminio.js', 'texto += `🛡️ *Garantía:* 12 meses'],
    ['visual.js', "facts.push('Garantía: 12 meses')"],
    ['comparador.js', 'texto += `🛡️ Garantía: 12 meses`']
  ];
  requiredWarranty.forEach(([file, token]) => {
    if (!files[file].includes(token)) errors.push(`falta garantía aprobada en ${file}`);
  });
  if (!files['app.js'].includes('const AJUSTE_COMERCIAL = 1.05;')) {
    errors.push('precio principal alterado');
  }
  if (!files['sw.js'].includes("const CACHE_NAME = 'cotizador-v7.14';")) {
    errors.push('sw.js fuera de la versión autorizada');
  }
  const pwaTest = files['tests/pwa-atomic-update.test.js'];
  const guardStart = pwaTest.indexOf('const protectedFiles = [');
  const guardEnd = pwaTest.indexOf('];', guardStart);
  const guard = pwaTest.slice(guardStart, guardEnd + 2);
  if (guardStart === -1 || !guard.includes("'index.html'")) {
    errors.push('guarda PWA debilitada para index.html');
  }
  if (!pwaTest.includes("candidateSw.replace(\"const CACHE_NAME = 'cotizador-v7.9';\", \"const CACHE_NAME = 'cotizador-v7.14';\")")) {
    errors.push('guarda PWA debilitada para sw.js');
  }
  return errors;
}

function mutate(dir, file, search, replacement) {
  const target = path.join(dir, file);
  const source = fs.readFileSync(target, 'utf8');
  assert.ok(source.includes(search), `No se encontró mutación base en ${file}: ${search}`);
  fs.writeFileSync(target, source.replace(search, replacement), 'utf8');
}

const mutations = [
  {
    name:'reintroducir acero en espejo',
    file:'app.js',
    search:'return `${texto}\\n----------------------------`;',
    replacement:"texto += '\\nAcero inoxidable 304';\n            return `${texto}\\n----------------------------`;"
  },
  {
    name:'reintroducir color natural en espejo',
    file:'visual.js',
    search:"color: esEspejo ? '' : raw.color_acc",
    replacement:'color: raw.color_acc'
  },
  {
    name:'afirmar instalación en aluminio ninguna',
    file:'aluminio.js',
    search:'alu_installationLabel(result.tipoInst)',
    replacement:"'incluida'"
  },
  {
    name:'afirmar transporte sin respaldo',
    file:'aluminio.js',
    search:'if (result.transporte > 0)',
    replacement:'if (true)'
  },
  {
    name:'eliminar cantidad',
    file:'app.js',
    search:'`🔢 *Cantidad:* ${qty}\\n`',
    replacement:'`🔢 *Unidades omitidas:* ${qty}\\n`'
  },
  {
    name:'eliminar protección anti-stale',
    file:'app.js',
    search:'if (!main_isShareSnapshotCurrent(lastCalculation))',
    replacement:'if (false)'
  },
  {
    name:'eliminar garantía de 12 meses',
    file:'visual.js',
    search:"facts.push('Garantía: 12 meses')",
    replacement:"facts.push('')"
  },
  {
    name:'reintroducir garantía de 18 meses',
    file:'aluminio.js',
    search:'texto += `🛡️ *Garantía:* 12 meses',
    replacement:'texto += `🛡️ *Garantía:* 18 meses'
  },
  {
    name:'alterar precio principal',
    file:'app.js',
    search:'const AJUSTE_COMERCIAL = 1.05;',
    replacement:'const AJUSTE_COMERCIAL = 1.06;'
  },
  {
    name:'modificar sw.js fuera del empaquetado',
    file:'sw.js',
    search:"const CACHE_NAME = 'cotizador-v7.14';",
    replacement:"const CACHE_NAME = 'cotizador-v7.14-mutado';"
  },
  {
    name:'debilitar guarda PWA de index.html',
    file:'tests/pwa-atomic-update.test.js',
    search:"'index.html', 'dashboard.js'",
    replacement:"'dashboard.js'"
  }
];

assert.deepEqual(commercialInvariantErrors(root), [], 'La fuente limpia debe cumplir invariantes');
const results = [];
const tempRoot = process.env.WILAN_SENSITIVITY_ROOT || os.tmpdir();
fs.mkdirSync(tempRoot, {recursive:true});
for (const mutation of mutations) {
  const temp = fs.mkdtempSync(path.join(tempRoot, 'wa11-'));
  try {
    protectedFiles.forEach(file => {
      const destination = path.join(temp, file);
      fs.mkdirSync(path.dirname(destination), {recursive:true});
      fs.copyFileSync(path.join(root, file), destination);
    });
    mutate(temp, mutation.file, mutation.search, mutation.replacement);
    const errors = commercialInvariantErrors(temp);
    assert.ok(errors.length > 0, `La mutación no fue detectada: ${mutation.name}`);
    results.push({mutation:mutation.name, detected:true, errors});
    console.log(`ok - detectada: ${mutation.name}`);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
}

assert.equal(results.length, 11);
if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], `${JSON.stringify(results, null, 2)}\n`, 'utf8');
}
console.log('sensitivity: 11/11');
