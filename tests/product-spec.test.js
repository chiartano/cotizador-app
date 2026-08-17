const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const window = { window: null };
window.window = window;
vm.runInNewContext(fs.readFileSync(path.join(root, 'agenda/productSpec.js'), 'utf8'), window, { filename: 'agenda/productSpec.js' });
const spec = window.WilanAgenda.productSpec;

const aluminumMetadata = {
  canonicalProductId: 'VEN-5020', familyId: 'VEN', variantId: 'VEN-5020-2H',
  mappingStatus: 'map_with_variant', canonicalAttributes: { aluminumSystem: '5020', aluminumConfig: '2N', glassThickness: 4 },
};

const frozen = spec.buildAluminum({
  metadata: aluminumMetadata, system: '5020', configuration: '2N',
  glass: { type: 'FROZEN', thicknessMm: 4, finish: 'FROZEN' },
  frameColor: 'Negro', widthCm: 120, heightCm: 190, quantity: 1,
});
assert.equal(frozen.attributes.glass.type.value, 'FROZEN');
assert.equal(frozen.attributes.glass.finish.value, 'FROZEN');
assert.equal(frozen.attributes.glass.thickness.value, 4);
assert.equal(frozen.attributes.frame.color.value, 'NEGRO');
assert.equal(frozen.completeness.status, 'complete');
assert.match(spec.summary(frozen).critical, /FROZEN/);
assert.doesNotMatch(JSON.stringify(frozen), /TRANSPARENT/);

const blackHardware = spec.buildMain({
  metadata: { canonicalProductId: 'DB-COR', familyId: 'DB', variantId: 'DB-COR-2H', mappingStatus: 'map_with_variant', canonicalAttributes: { glassThickness: 8 } },
  productName: 'División Corrediza Clásica', widthCm: 157.7, heightCm: 190,
  thickness: '8mm', hardwareColor: 'negro', glassFinish: 'transparent', quantity: 1,
});
assert.equal(blackHardware.attributes.hardware.color.value, 'NEGRO');
assert.equal(blackHardware.attributes.glass.thickness.value, 8);
assert.equal(blackHardware.attributes.dimensions.width.value, 157.7);
assert.equal(blackHardware.completeness.status, 'complete');

const incomplete = spec.buildAluminum({
  metadata: aluminumMetadata, system: '5020', configuration: '2N',
  glass: { type: 'TEMPERED', thicknessMm: 6 }, frameColor: 'Natural Mate', widthCm: 120, heightCm: 190,
});
assert.equal(incomplete.attributes.glass.finish.status, 'unknown');
assert.equal(incomplete.completeness.status, 'incomplete');
assert.ok(incomplete.completeness.missing.includes('glass.finish'));
assert.doesNotMatch(JSON.stringify(incomplete), /TRANSPARENT/);

for (const composition of ['3+3', '4+4', '5+5']) {
  const laminated = spec.buildAluminum({
    metadata: { ...aluminumMetadata, canonicalAttributes: { ...aluminumMetadata.canonicalAttributes, glassComposition: composition } },
    system: '5020', configuration: '2N', glass: { type: 'LAMINATED', composition, unit: 'mm' },
    frameColor: 'Negro', widthCm: 120, heightCm: 190,
  });
  assert.equal(laminated.attributes.glass.type.value, 'LAMINATED');
  assert.equal(laminated.attributes.glass.composition.value, composition);
  assert.equal(laminated.attributes.glass.composition.unit, 'mm');
  assert.equal(laminated.attributes.glass.thickness.status, 'not_applicable');
  assert.match(spec.summary(laminated).critical, new RegExp(`LAMINADO ${composition.replace('+', '\\+')} MM`));
  assert.doesNotMatch(spec.summary(laminated).critical, new RegExp(`(^|· )${composition[0]} MM`));
}

for (const thicknessMm of [6, 8, 10]) {
  const tempered = spec.buildAluminum({
    metadata: aluminumMetadata, system: '5020', configuration: '2N',
    glass: { type: 'TEMPERED', thicknessMm }, frameColor: 'Negro', widthCm: 120, heightCm: 190,
  });
  assert.equal(tempered.attributes.glass.thickness.value, thicknessMm);
  assert.equal(tempered.attributes.glass.composition.status, 'not_applicable');
}

const ambiguous = spec.buildMain({
  metadata: { canonicalProductId: null, familyId: null, variantId: null, mappingStatus: 'split_required', canonicalAttributes: {} },
  productName: 'Cortaviento / Oficina', widthCm: 100, heightCm: 100, thickness: '8mm', hardwareColor: 'natural', glassFinish: 'transparent',
});
assert.equal(ambiguous.completeness.status, 'manual_review');
assert.equal(ambiguous.familyRuleId, null);

const mirror = spec.buildMain({
  metadata: { canonicalProductId: 'ESP-FLO', familyId: 'ESP', variantId: 'ESP-FLO-STD', mappingStatus: 'map_with_attributes', canonicalAttributes: {} },
  productName: 'Espejo Flotante', widthCm: 80, heightCm: 120, hasLed: true,
});
assert.equal(mirror.attributes.glass.thickness.status, 'not_applicable');
assert.equal(mirror.attributes.hardware.color.status, 'not_applicable');
assert.equal(mirror.completeness.status, 'complete');

const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const aluminumSource = fs.readFileSync(path.join(root, 'aluminio.js'), 'utf8');
assert.match(indexSource, /<option value="" selected>Selecciona el espesor<\/option>/);
assert.match(indexSource, /<option value="" selected>Selecciona el color<\/option>/);
assert.match(indexSource, /<option value="" selected>Selecciona el acabado<\/option>/);
assert.match(appSource, /Falta definir \$\{missingCritical\[0\]\}/);
assert.match(aluminumSource, /aluSpecConfirmed = \{ sistema: false, config: false, vidrio: false, color: false \}/);
assert.doesNotMatch(appSource, /check-sandblasting/);

console.log('ok - product-spec frozen, negro, fabricación, incompleto, ambigüedad y no aplica');
