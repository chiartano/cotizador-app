const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const protectedFiles = ['app.js', 'aluminio.js', 'visual.js', 'comparador.js'];

function readSet(dir) {
  return Object.fromEntries(protectedFiles.map(file => [
    file,
    fs.readFileSync(path.join(dir, file), 'utf8')
  ]));
}

function commercialInvariantErrors(dir) {
  const files = readSet(dir);
  const joined = protectedFiles.map(file => files[file]).join('\n');
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
    name:'reintroducir pie global del carrito',
    file:'app.js',
    search:'texto += `🛡️ *Garantía:* 12 meses`;',
    replacement:"texto += `🛡️ *Garantía:* 12 meses`;\n            texto += `\\nIncluye transporte e instalación`;"
  },
  {
    name:'eliminar cantidad',
    file:'app.js',
    search:'`🔢 *Cantidad:* ${qty}\\n`',
    replacement:'`🔢 *Unidades omitidas:* ${qty}\\n`'
  },
  {
    name:'usar precio anterior sin gate',
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
  }
];

assert.deepEqual(commercialInvariantErrors(root), [], 'La fuente limpia debe cumplir invariantes');
const results = [];
for (const mutation of mutations) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'wilan-wa-sensitivity-'));
  try {
    protectedFiles.forEach(file => fs.copyFileSync(path.join(root, file), path.join(temp, file)));
    mutate(temp, mutation.file, mutation.search, mutation.replacement);
    const errors = commercialInvariantErrors(temp);
    assert.ok(errors.length > 0, `La mutación no fue detectada: ${mutation.name}`);
    results.push({mutation:mutation.name, detected:true, errors});
    console.log(`ok - detectada: ${mutation.name}`);
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }
}

assert.equal(results.length, 8);
if (process.argv[2]) {
  fs.writeFileSync(process.argv[2], `${JSON.stringify(results, null, 2)}\n`, 'utf8');
}
console.log('sensitivity: 8/8');
