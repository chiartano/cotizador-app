const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const values = new Map();
let lockTail = Promise.resolve();
const locks = { request: (_name, _options, callback) => {
  const result = lockTail.then(callback);
  lockTail = result.catch(() => {});
  return result;
} };
const window = {
  window: null, crypto: crypto.webcrypto, TextEncoder, structuredClone, URLSearchParams,
  location: { hostname: 'localhost', search: '' }, navigator: { onLine: true, locks },
  localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) },
};
window.window = window;
const context = vm.createContext(window);
const load = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
load('agenda/config.js');
load('agenda/productSpec.js');
let commandSequence = 0;
context.WilanAgenda.commands = {
  newCommandId: () => `cmd_semantic_${String(++commandSequence).padStart(3, '0')}`,
  classify: () => ({ code: 'NETWORK_ERROR', uncertain: true, message: 'retry' }),
};
load('agenda/quoteToCrm.js');

const item = () => ({
  producto: 'División batiente', medidas: '120 × 150 cm', cantidad: 1, precio: 729244,
  precioUnitario: 729244, vidrio: '6 mm transparente', color: 'natural',
  canonicalProductId: 'DIV-BAT', familyId: 'DB', variantId: 'DB-2H',
  mappingStatus: 'map_with_variant',
  canonicalAttributes: { opening: 'central', leaves: 2 },
  productSpec: context.WilanAgenda.productSpec.buildMain({
    metadata: {
      canonicalProductId: 'DIV-BAT', familyId: 'DB', variantId: 'DB-2H',
      mappingStatus: 'map_with_variant', canonicalAttributes: { opening: 'central', leaves: 2 },
    },
    productName: 'División batiente', widthCm: 120, heightCm: 150,
    thickness: '6mm', glassFinish: 'transparent', hardwareColor: 'natural', quantity: 1,
  }),
  shareInputSnapshot: { producto: 'division_batiente', ancho: 120, alto: 150 },
  raw: { ancho: 120, alto: 150, espesor: '6mm', glass_finish: 'transparent', color_acc: 'natural' },
});

const quote = (overrides = {}) => ({
  quoteId: 'q_legacy_v723', folio: 'COT-2026-0723', subtotal: 729244, discount: 0, total: 729244,
  customer: { name: 'Cliente sintético', phone: '3000000000', address: 'Dirección sintética', project: 'Obra sintética' },
  items: [item()], ...overrides,
});

const mutate = (value, edit) => {
  const copy = structuredClone(value);
  edit(copy);
  return copy;
};
const reverseObjectOrder = (value) => {
  if (Array.isArray(value)) return value.map(reverseObjectOrder);
  if (!value || typeof value !== 'object') return value;
  return Object.keys(value).reverse().reduce((result, key) => {
    result[key] = reverseObjectOrder(value[key]);
    return result;
  }, {});
};

const canonicalize = (value) => {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') return Object.keys(value).sort().reduce((result, key) => {
    if (value[key] !== undefined) result[key] = canonicalize(value[key]);
    return result;
  }, {});
  return value;
};
const sha256 = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex')}`;

(async () => {
  const bridge = context.WilanAgenda.quoteToCrm;
  const current = quote();
  const legacyPayload = structuredClone(bridge.buildPayload(current, '2026-08-20T12:00:00.000Z'));
  legacyPayload.identity.sourceVersion = 'cotizador-v7.23';
  legacyPayload.items.forEach((value) => { value.rawAttributes.technicalVersion = 'cotizador-v7.23'; });
  const legacyContent = structuredClone(legacyPayload);
  delete legacyContent.quote.quotedAt;
  const legacyRecord = {
    schema: 'quote-to-crm-local.v2', commandId: 'cmd_quote_legacy_v723', quoteId: current.quoteId,
    status: 'sent', payload: legacyPayload, contentHash: sha256(legacyContent), payloadHash: 'sha256:legacy-payload',
    receipt: { status: 'received', quoteId: current.quoteId, canOpenCrm: false },
  };
  bridge.save(legacyRecord);

  assert.equal(await bridge.matchesCurrent(current, legacyRecord), true, 'v7.23 y la PWA candidata deben ser la misma cotización comercial');
  const prepared = await bridge.prepare(current);
  assert.equal(prepared.commandId, legacyRecord.commandId, 'una actualización técnica no debe crear otro command');
  assert.equal(prepared.status, 'sent');

  assert.equal(bridge.SEMANTIC_FINGERPRINT_VERSION, 'quote-semantic-fingerprint.v1');
  const currentPayload = bridge.buildPayload(current, legacyPayload.quote.quotedAt);
  const [legacyHashes, currentHashes] = await Promise.all([bridge.hashesFor(legacyPayload), bridge.hashesFor(currentPayload)]);
  assert.equal(legacyHashes.semanticHash, currentHashes.semanticHash, 'la identidad comercial debe ignorar versiones PWA');
  assert.notEqual(legacyHashes.payloadHash, currentHashes.payloadHash, 'el hash del payload de backend debe seguir congelando el envío exacto');

  const technicalCases = [
    ['sourceVersion', mutate(legacyRecord, (record) => { record.payload.identity.sourceVersion = 'cotizador-v0.01'; })],
    ['technicalVersion', mutate(legacyRecord, (record) => { record.payload.items[0].rawAttributes.technicalVersion = 'bundle-otro'; })],
    ['quotedAt', mutate(legacyRecord, (record) => { record.payload.quote.quotedAt = '2030-01-01T00:00:00.000Z'; })],
    ['orden interno', mutate(legacyRecord, (record) => { record.payload = reverseObjectOrder(record.payload); })],
  ];
  for (const [name, record] of technicalCases) {
    assert.equal(await bridge.matchesCurrent(current, record), true, `${name} no debe cambiar la identidad comercial`);
  }

  const commercialCases = [
    ['producto', (candidate) => { candidate.items[0].producto = 'División corrediza'; }],
    ['cantidad', (candidate) => { candidate.items[0].cantidad = 2; }],
    ['dimensiones', (candidate) => { candidate.items[0].medidas = '125 × 150 cm'; }],
    ['vidrio 6 a 8 mm', (candidate) => { candidate.items[0].productSpec.attributes.glass.thickness.value = 8; }],
    ['transparente a Frozen', (candidate) => { candidate.items[0].productSpec.attributes.glass.finish.value = 'FROZEN'; }],
    ['acabado/color natural a negro', (candidate) => { candidate.items[0].productSpec.attributes.hardware.color.value = 'BLACK'; }],
    ['Product Spec', (candidate) => { candidate.items[0].productSpec.attributes.dimensions.width.value = 125; }],
    ['estado Product Spec', (candidate) => { candidate.items[0].productSpec.completeness.status = 'incomplete'; }],
    ['unknown a confirmed', (candidate) => { candidate.items[0].productSpec.attributes.product.configuration = { status: 'confirmed', value: '2H' }; }],
    ['composición laminada', (candidate) => {
      candidate.items[0].productSpec.attributes.glass = { type: { status: 'confirmed', value: 'LAMINATED' }, composition: { status: 'confirmed', value: '4+4', unit: 'mm' } };
    }],
    ['total global', (candidate) => { candidate.total = 729243; candidate.discount = 1; }],
    ['descuento', (candidate) => { candidate.discount = 1000; candidate.total = 728244; }],
    ['cliente', (candidate) => { candidate.customer.phone = '3111111111'; }],
  ];
  for (const [name, edit] of commercialCases) {
    assert.equal(await bridge.matchesCurrent(mutate(current, edit), legacyRecord), false, `${name} sí debe cambiar la identidad comercial`);
  }

  const changed = mutate(current, (candidate) => { candidate.customer.name = 'Cliente comercial cambiado'; });
  const changedPrepared = await bridge.prepare(changed);
  assert.notEqual(changedPrepared.commandId, legacyRecord.commandId, 'un cambio comercial debe permitir un command nuevo');
  assert.equal(changedPrepared.status, 'pending');

  for (const status of ['sent', 'pending', 'unknown']) {
    const insufficientQuote = quote({ quoteId: `q_insufficient_${status}` });
    const insufficient = {
      schema: 'quote-to-crm-local.v2', commandId: `cmd_insufficient_${status}`,
      quoteId: insufficientQuote.quoteId, status, contentHash: 'sha256:legacy-only', payloadHash: 'sha256:legacy-only',
      ...(status === 'sent' ? { receipt: { status: 'received', quoteId: insufficientQuote.quoteId } } : {}),
    };
    bridge.save(insufficient);
    assert.equal(await bridge.compareCurrent(insufficientQuote, insufficient), bridge.COMPARISON.INSUFFICIENT);
    const beforeSequence = commandSequence;
    for (let reload = 0; reload < 3; reload += 1) {
      assert.equal((await bridge.prepare(insufficientQuote)).commandId, insufficient.commandId);
    }
    assert.equal(commandSequence, beforeSequence, `legacy insuficiente ${status} no debe crear commands al cargar o actualizar`);
  }

  const seedSent = async (candidate, commandId) => {
    const payload = bridge.buildPayload(candidate, '2026-08-20T12:00:00.000Z');
    payload.identity.sourceVersion = 'cotizador-v7.23';
    payload.items.forEach((value) => { value.rawAttributes.technicalVersion = 'cotizador-v7.23'; });
    return bridge.save({
      schema: 'quote-to-crm-local.v2', commandId, quoteId: candidate.quoteId, status: 'sent', payload,
      ...(await bridge.hashesFor(payload)), receipt: { status: 'received', quoteId: candidate.quoteId },
    });
  };

  const concurrentBase = quote({ quoteId: 'q_concurrent_same' });
  await seedSent(concurrentBase, 'cmd_concurrent_sent');
  const concurrentChange = mutate(concurrentBase, (candidate) => { candidate.customer.name = 'Misma edición concurrente'; });
  const twenty = await Promise.all(Array.from({ length: 20 }, () => bridge.prepare(concurrentChange)));
  assert.equal(new Set(twenty.map((record) => record.commandId)).size, 1, '20 prepares deben observar un único commandId');
  const concurrentStore = JSON.parse(values.get(bridge.STORAGE_KEY));
  assert.equal(Object.values(concurrentStore.intents).filter((record) => record.quoteId === concurrentBase.quoteId).length, 2, 'debe existir sólo el sent previo y una intención nueva');

  const initialConcurrent = quote({ quoteId: 'q_concurrent_initial' });
  const ten = await Promise.all(Array.from({ length: 10 }, () => bridge.prepare(initialConcurrent)));
  assert.equal(new Set(ten.map((record) => record.commandId)).size, 1, 'diez prepares iniciales deben crear una sola intención');

  context.navigator.onLine = false;
  const offlineConcurrent = quote({ quoteId: 'q_concurrent_offline' });
  const offline = await Promise.all(Array.from({ length: 10 }, () => bridge.prepare(offlineConcurrent)));
  assert.equal(new Set(offline.map((record) => record.commandId)).size, 1, 'offline debe conservar una sola intención por edición');
  context.navigator.onLine = true;
  assert.equal((await bridge.prepare(offlineConcurrent)).commandId, offline[0].commandId, 'al volver online debe reutilizar la intención offline');

  const distinctBase = quote({ quoteId: 'q_concurrent_distinct' });
  await seedSent(distinctBase, 'cmd_distinct_sent');
  const black = mutate(distinctBase, (candidate) => { candidate.items[0].color = 'negro'; });
  const natural = mutate(distinctBase, (candidate) => { candidate.items[0].color = 'natural mate'; });
  const [blackPending, frozenBeforeNatural] = await Promise.all([bridge.prepare(black), bridge.prepare(natural)]);
  assert.equal(blackPending.commandId, frozenBeforeNatural.commandId, 'una intención pendiente se congela antes de preparar otra edición');
  assert.equal(await bridge.matchesCurrent(black, blackPending), true);
  assert.equal(await bridge.matchesCurrent(natural, frozenBeforeNatural), false, 'ediciones distintas no se consideran semánticamente iguales');
  bridge.save({ ...blackPending, status: 'sent', receipt: { status: 'received', quoteId: distinctBase.quoteId } });
  const naturalPending = await bridge.prepare(natural);
  assert.notEqual(naturalPending.commandId, blackPending.commandId, 'resuelta la intención anterior, otra edición obtiene su propio command');

  const savedLocks = context.navigator.locks;
  context.navigator.locks = undefined;
  const unsupported = quote({ quoteId: 'q_without_web_locks' });
  const beforeUnsupported = commandSequence;
  assert.equal(await bridge.prepare(unsupported), null, 'sin coordinación nativa el fallback no prepara una intención nueva');
  assert.equal(commandSequence, beforeUnsupported);
  context.navigator.locks = savedLocks;

  console.log('ok - fingerprint, legacy insuficiente y concurrencia coordinada');
})().catch((error) => { console.error(error); process.exitCode = 1; });
