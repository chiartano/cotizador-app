const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Bandeja de cotizaciones: se registra sola al mandar por WhatsApp, sin datos
// del cliente, y espera en cola si no hay red o sesión.
const root = path.resolve(__dirname, '..');
const values = new Map();
const listeners = {};
const window = {
  window: null, crypto: crypto.webcrypto, TextEncoder, structuredClone, URLSearchParams,
  location: { hostname: 'localhost', search: '' }, navigator: { onLine: true },
  localStorage: { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, String(value)) },
  addEventListener: (name, fn) => { listeners[name] = fn; },
  setTimeout: () => 0,
  document: { readyState: 'complete' },
};
window.window = window;
const context = vm.createContext(window);
const load = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
load('agenda/config.js');
load('agenda/productSpec.js');
let sequence = 0;
let authKind = 'unauthenticated';
const calls = [];
let callImpl = async () => ({ status: 'received' });
context.WilanAgenda.commands = {
  newCommandId: () => `cmd_inbox_${String(++sequence).padStart(3, '0')}`,
  classify: (error) => ({ code: error.code || 'NETWORK_ERROR' }),
};
context.WilanAgenda.auth = { getState: () => ({ kind: authKind }), subscribe: () => () => {} };
context.WilanAgenda.firebase = { adapter: { call: async (name, data) => { calls.push({ name, data }); return callImpl(name, data); } } };
context.WilanAgenda.config.quoteBridgeEnabled = true;
load('agenda/quoteToCrm.js');
load('agenda/quoteInbox.js');

const item = {
  producto: 'División sintética', medidas: '120 x 190 cm', cantidad: 1, precio: 820000,
  vidrio: '6 mm', color: 'natural', canonicalProductId: null, familyId: 'DB', variantId: null,
  mappingStatus: 'split_required', canonicalAttributes: {},
  shareInputSnapshot: { producto: 'division', ancho: 120, alto: 190 }, raw: { ancho: 120, alto: 190 },
};
const quote = (extra = {}) => ({
  quoteId: 'q_inbox_test_001', items: [item], subtotal: 820000, discount: 0, total: 820000, folio: '',
  customer: { name: 'No debe viajar', phone: '3000000000' }, ...extra,
});
const inbox = context.WilanAgenda.quoteInbox;
const pending = () => inbox.readStore().pending;

(async () => {
  // Sin sesión: queda en cola, sin llamadas.
  assert.equal(inbox.record(quote(), 'F-042'), true);
  await inbox.flush();
  assert.equal(calls.length, 0);
  assert.equal(pending().length, 1);
  const command = pending()[0].command;
  assert.equal(command.schema, 'quote-inbox-command.v1');
  assert.deepEqual(JSON.parse(JSON.stringify(command.payload.customer)), {});
  assert.equal(JSON.stringify(command).includes('No debe viajar'), false);
  assert.equal(JSON.stringify(command).includes('3000000000'), false);
  assert.equal(command.payload.identity.folio, 'F-042');
  assert.equal(command.payload.quote.total, 820000);

  // Sin red: sigue en cola.
  authKind = 'advisor';
  window.navigator.onLine = false;
  await inbox.flush();
  assert.equal(calls.length, 0);

  // Error de red: se conserva para reintentar.
  window.navigator.onLine = true;
  callImpl = async () => { const error = new Error('net'); error.code = 'NETWORK_ERROR'; throw error; };
  await inbox.flush();
  assert.equal(calls.length, 1);
  assert.equal(pending().length, 1);
  assert.equal(pending()[0].attempts, 1);

  // Al volver la red se manda una sola vez y sale de la cola.
  callImpl = async () => ({ status: 'received' });
  await listeners.online();
  await inbox.flush();
  assert.equal(calls.length, 2);
  assert.equal(calls[1].name, 'quoteToCrmCommand');
  assert.equal(calls[1].data.command.commandId, command.commandId);
  assert.equal(pending().length, 0);
  assert.equal(inbox.readStore().sent, 1);

  // Un rechazo permanente no bloquea la cola.
  inbox.record(quote({ quoteId: 'q_inbox_test_002' }), 'F-043');
  inbox.record(quote({ quoteId: 'q_inbox_test_003' }), 'F-044');
  callImpl = async (_n, data) => {
    if (data.command.quoteId === 'q_inbox_test_002') { const error = new Error('bad'); error.code = 'INVALID_COMMAND'; throw error; }
    return { status: 'received' };
  };
  await inbox.flush();
  assert.equal(pending().length, 0);
  assert.equal(inbox.readStore().dropped, 1);
  assert.equal(inbox.readStore().sent, 2);

  // Una cotización incompleta no se encola ni rompe el envío.
  assert.equal(inbox.record(null, 'F-045'), false);
  assert.equal(inbox.record(quote({ items: [] }), 'F-046'), false);

  console.log('ok - bandeja de cotizaciones: sin datos personales, con cola, reintento y sin duplicar');
})().catch((error) => { console.error(error); process.exit(1); });
