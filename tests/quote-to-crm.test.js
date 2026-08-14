const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const values = new Map();
const window = {
  window: null, crypto: crypto.webcrypto, TextEncoder, structuredClone, URLSearchParams,
  location: { hostname: 'localhost', search: '' }, navigator: { onLine: true },
  localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) },
};
window.window = window;
const context = vm.createContext(window);
const load = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
load('agenda/config.js');
context.WilanAgenda.commands = {
  newCommandId: () => 'cmd_synthetic_quote_001',
  classify: () => ({ code: 'NETWORK_ERROR', uncertain: true, message: 'retry' }),
};
load('agenda/quoteToCrm.js');

const quote = {
  quoteId: 'q_synthetic_quote_001', folio: 'COT-2026-0042', total: 550000,
  customer: { name: 'Cliente sintético', phone: '3000000000', address: 'Dirección sintética', project: 'Obra sintética' },
  items: [{
    producto: 'División', medidas: '120 x 190 cm', cantidad: 2, precioUnitario: 300000, precio: 600000,
    vidrio: '6 mm', color: 'natural', canonicalProductId: null, familyId: 'DB', variantId: null,
    mappingStatus: 'split_required', canonicalAttributes: { leaves: 2 }, raw: { ancho: 120, alto: 190 },
  }],
};

(async () => {
  const bridge = context.WilanAgenda.quoteToCrm;
  const payload = bridge.buildPayload(quote, '2026-08-14T12:00:00.000Z');
  assert.equal(payload.quote.subtotal, 600000);
  assert.equal(payload.quote.discount, 50000);
  assert.equal(payload.quote.total, 550000);
  assert.equal(payload.items[0].unitPrice, 300000);
  assert.equal(payload.items[0].totalPrice, 600000);
  assert.equal(payload.items[0].mappingStatus, 'split_required');
  assert.equal(payload.identity.folio, 'COT-2026-0042');
  const adjusted = bridge.buildPayload({ ...quote, quoteId: 'q_adjusted', items: [{ ...quote.items[0], precio: 600001, precioUnitario: undefined }], total: 600001 }, '2026-08-14T12:00:00.000Z');
  assert.equal(adjusted.items[0].quantity, 2);
  assert.equal(adjusted.items[0].totalPrice, 600001);

  let calls = 0;
  context.WilanAgenda.firebase = { adapter: { call: async (name, envelope) => {
    calls += 1;
    assert.equal(name, 'quoteToCrmCommand');
    assert.equal(envelope.command.payloadHash, bridge.ZERO_HASH);
    return { status: 'received', quoteId: quote.quoteId, canOpenCrm: false };
  } } };
  const first = await bridge.send(quote);
  const replay = await bridge.send(quote);
  assert.equal(first.ok, true);
  assert.equal(replay.ok, true);
  assert.equal(calls, 1);
  assert.equal(bridge.get(quote.quoteId).status, 'sent');
  assert.equal(first.result.canOpenCrm, false);

  const source = fs.readFileSync(path.join(root, 'agenda/quoteToCrm.js'), 'utf8');
  assert.doesNotMatch(source, /folioConsumir\s*\(/);
  assert.doesNotMatch(source, /crmReceiverUid/);
  console.log('ok - quote-to-crm exactitud, replay local, privacidad y folio');
})().catch((error) => { console.error(error); process.exitCode = 1; });
