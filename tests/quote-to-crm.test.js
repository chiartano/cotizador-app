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
let commandSequence = 0;
context.WilanAgenda.commands = {
  newCommandId: () => `cmd_synthetic_quote_${String(++commandSequence).padStart(3, '0')}`,
  classify: () => ({ code: 'NETWORK_ERROR', uncertain: true, message: 'retry' }),
};
load('agenda/quoteToCrm.js');

const item = (overrides = {}) => ({
  producto: 'División sintética', medidas: '120 x 190 cm', cantidad: 1, precio: 600000,
  vidrio: '6 mm', color: 'natural', canonicalProductId: null, familyId: 'DB', variantId: null,
  mappingStatus: 'split_required', canonicalAttributes: { leaves: 2 },
  shareInputSnapshot: { producto: 'division_batiente', ancho: 120, alto: 190 },
  raw: { ancho: 120, alto: 190 }, ...overrides,
});
const quote = (overrides = {}) => ({
  quoteId: 'q_synthetic_quote_001', folio: 'COT-2026-0042', subtotal: 600000, discount: 50000, total: 550000,
  customer: { name: 'Cliente sintético', phone: '3000000000', address: 'Dirección sintética', project: 'Obra sintética' },
  items: [item({ cantidad: 2, precioUnitario: 300000 })], ...overrides,
});

(async () => {
  const bridge = context.WilanAgenda.quoteToCrm;

  const standard = bridge.buildPayload(quote(), '2026-08-14T12:00:00.000Z');
  assert.deepEqual(
    { subtotal: standard.quote.subtotal, discount: standard.quote.discount, total: standard.quote.total },
    { subtotal: 600000, discount: 50000, total: 550000 },
  );
  assert.equal(standard.items[0].unitPrice, 300000);
  assert.equal(standard.items[0].totalPrice, 600000);
  assert.equal(standard.identity.sourceVersion, 'cotizador-v7.17');
  assert.equal(standard.schemaVersion, 'quote-to-crm.v1.1');
  assert.equal(standard.quote.moneySemantics, 'display-lines-independent-total.v1');

  const fractional = 729243.529;
  const monetary = quote({
    quoteId: 'q_money_exact', subtotal: fractional * 2, discount: 0, total: fractional * 2,
    items: [item({ precio: fractional }), item({ producto: 'Segundo sintético', precio: fractional })],
  });
  const exact = bridge.buildPayload(monetary, '2026-08-14T12:00:00.000Z');
  assert.equal(exact.quote.total, 1458487);
  assert.equal(exact.quote.subtotal, 1458487);
  assert.equal(exact.quote.discount, 0);
  assert.deepEqual(exact.items.map((value) => value.displayTotalPrice), [729244, 729244]);
  assert.deepEqual(exact.items.map((value) => value.totalPrice), [729244, 729244]);
  assert.deepEqual(exact.items.map((value) => value.calculatedTotalPrice), [fractional, fractional]);
  assert.equal(exact.items.reduce((sum, value) => sum + value.displayTotalPrice, 0), 1458488);

  for (const candidate of [
    quote({ quoteId: 'q_one', subtotal: 729243.529, discount: 0, total: 729243.529, items: [item({ precio: 729243.529 })] }),
    quote({ quoteId: 'q_quantity', subtotal: 600001, discount: 0, total: 600001, items: [item({ cantidad: 2, precio: 600001, precioUnitario: undefined })] }),
    quote({ quoteId: 'q_promo', subtotal: 650000, discount: 0, total: 650000, items: [item({ precio: 650000, raw: { ancho: 120, alto: 180, promo_fija_corrediza_economica: true } })] }),
  ]) {
    const payload = bridge.buildPayload(candidate, '2026-08-14T12:00:00.000Z');
    assert.deepEqual(payload.items.map((value) => value.displayTotalPrice), candidate.items.map((value) => Math.round(value.precio)));
    assert.deepEqual(payload.items.map((value) => value.calculatedTotalPrice), candidate.items.map((value) => value.precio));
    assert.equal(payload.quote.subtotal - payload.quote.discount, payload.quote.total);
  }

  assert.equal(bridge.isQuoteBridgeEligible(quote()), true);
  const legacy = quote({ items: [{ producto: 'Registro antiguo', medidas: '100 x 100', precio: 100000 }] });
  assert.equal(bridge.isQuoteBridgeEligible(legacy), false);
  assert.equal(bridge.buildPayload(legacy), null);

  const calls = [];
  context.WilanAgenda.firebase = { adapter: { call: async (name, envelope) => {
    calls.push(structuredClone(envelope.command));
    assert.equal(name, 'quoteToCrmCommand');
    assert.match(envelope.command.payloadHash, /^sha256:[a-f0-9]{64}$/);
    return { status: 'received', quoteId: envelope.command.quoteId, canOpenCrm: false };
  } } };
  const initial = quote();
  const first = await bridge.send(initial);
  const replay = await bridge.send(initial);
  assert.equal(first.ok && replay.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(bridge.get(initial.quoteId).status, 'sent');

  const changed = quote({ subtotal: 600001, discount: 0, total: 600001, items: [item({ cantidad: 2, precio: 600001 })] });
  const secondIntent = await bridge.send(changed);
  assert.equal(secondIntent.ok, true);
  assert.equal(calls.length, 2);
  assert.notEqual(calls[0].commandId, calls[1].commandId);
  assert.notEqual(calls[0].payloadHash, calls[1].payloadHash);

  const uncertain = quote({ quoteId: 'q_ack_lost', subtotal: 100000, discount: 0, total: 100000, items: [item({ precio: 100000 })] });
  let attempts = 0;
  const frozen = [];
  context.WilanAgenda.firebase.adapter.call = async (_name, envelope) => {
    attempts += 1; frozen.push(structuredClone(envelope.command));
    if (attempts === 1) throw new Error('ACK perdido');
    return { status: 'received', quoteId: envelope.command.quoteId, canOpenCrm: false };
  };
  assert.equal((await bridge.send(uncertain)).ok, false);
  assert.equal((await bridge.send({ ...uncertain, subtotal: 200000, total: 200000, items: [item({ precio: 200000 })] })).ok, true);
  assert.equal(frozen.length, 2);
  assert.deepEqual(frozen[0], frozen[1]);

  context.navigator.onLine = false;
  const offline = quote({ quoteId: 'q_offline', subtotal: 123456, discount: 0, total: 123456, items: [item({ precio: 123456 })] });
  assert.equal((await bridge.send(offline)).error.code, 'OFFLINE');
  const pending = bridge.get(offline.quoteId);
  assert.equal(pending.status, 'pending');
  context.navigator.onLine = true;

  const source = fs.readFileSync(path.join(root, 'agenda/quoteToCrm.js'), 'utf8');
  assert.doesNotMatch(source, /folioConsumir\s*\(/);
  assert.doesNotMatch(source, /crmReceiverUid/);
  console.log('ok - quote-to-crm dinero, elegibilidad, intención congelada, replay, offline y privacidad');
})().catch((error) => { console.error(error); process.exitCode = 1; });
