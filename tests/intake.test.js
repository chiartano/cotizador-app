'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const storage = new Map();
let sent = [];
let online = true;
let sequence = 0;
let nextFailure = null;
const quote = {
  commandId: 'cmd_quote_synthetic', quoteId: 'quote_synthetic', status: 'sent',
  receipt: { status: 'received', canOpenCrm: false },
};
const context = {
  console,
  setTimeout,
  clearTimeout,
  Date,
  JSON,
  localStorage: {
    getItem: (key) => storage.get(key) || null,
    setItem: (key, value) => storage.set(key, value),
  },
  navigator: {},
  WilanCotizadorAgendaBridge: { getQuoteContext: () => ({ quoteId: quote.quoteId }) },
  WilanAgenda: {
    config: { appId: 'app_synthetic', workspaceId: 'workspace_synthetic' },
    commands: {
      newCommandId: () => `cmd_intake_${++sequence}`,
      classify: (error) => {
        const code = error?.details?.code || 'NETWORK_ERROR';
        return { code, uncertain: ['NETWORK_ERROR', 'INTERNAL_ERROR', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'UNKNOWN'].includes(code), message: `Error ${code}` };
      },
    },
    firebase: { adapter: { call: async (name, data) => {
      sent.push({ name, data });
      if (nextFailure) { const failure = nextFailure; nextFailure = null; throw { details: { code: failure } }; }
      return { commandId: data.command.commandId, quoteId: quote.quoteId, status: 'recorded', actionKind: data.command.action.kind, target: data.command.action.kind === 'visit_measure' ? 'appointment' : 'commitment', deduplicated: false };
    } } },
    quoteToCrm: { get: () => quote, matchesCurrent: async () => true },
  },
  addEventListener: () => {},
};
Object.defineProperty(context.navigator, 'onLine', { get: () => online });
context.window = context;
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(root, 'agenda/intake.js'), 'utf8'), context, { filename: 'agenda/intake.js' });
const intake = context.WilanAgenda.intake;

test.beforeEach(() => {
  storage.clear(); sent = []; online = true; nextFailure = null;
  context.WilanAgenda.quoteToCrm.matchesCurrent = async () => true;
});

test('non-visit action sends only public intent and becomes Terminado', async () => {
  const record = intake.prepare(quote, { kind: 'contact_call', date: '2026-09-01' });
  const result = await intake.send(record);
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].name, 'quoteIntakeActionCommand');
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0].data.command.action)), { kind: 'contact_call', date: '2026-09-01' });
  for (const privateKey of ['projectId', 'clientId', 'operatorUid', 'projectScopeUid', 'crmPath']) {
    assert.equal(JSON.stringify(sent[0]).includes(privateKey), false);
  }
  assert.equal(intake.isComplete(quote.quoteId), true);
});

test('offline preserves the same command and retry does not create a second intent', async () => {
  const record = intake.prepare(quote, { kind: 'wait_response', date: '2026-09-02', time: '14:30' });
  online = false;
  assert.equal((await intake.send(record)).ok, false);
  assert.equal(sent.length, 0);
  const pending = intake.getByQuoteCommand(quote.commandId);
  assert.equal(pending.commandId, record.commandId);
  assert.equal(pending.status, 'pending');
  online = true;
  await intake.send(pending);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].data.command.commandId, record.commandId);
});

test('visit waits for Agenda and then references the confirmed appointment once', async () => {
  const waiting = intake.prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
  assert.equal(intake.isAwaitingVisit(quote.quoteId), true);
  assert.equal(sent.length, 0);
  await intake.attachAppointment(quote.quoteId, 'appointment_synthetic');
  assert.equal(sent.length, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[0].data.command.action)), { kind: 'visit_measure', appointmentId: 'appointment_synthetic' });
  assert.equal(intake.getByQuoteCommand(waiting.quoteCommandId).status, 'recorded');
});

test('date helper tells the Advisor the weekday', () => {
  assert.match(intake._dateLabel('2026-09-01'), /martes/i);
});

test('changed quote cannot receive an action until its changes are sent', async () => {
  context.WilanAgenda.quoteToCrm.matchesCurrent = async () => false;
  const record = intake.prepare(quote, { kind: 'requote', date: '2026-09-03' });
  const result = await intake.send(record);
  assert.equal(result.ok, false);
  assert.equal(result.error.code, 'QUOTE_CHANGED');
  assert.equal(sent.length, 0);
});

test('definitive appointment rejection preserves evidence and a new selection uses a new command', async () => {
  const first = intake.prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
  nextFailure = 'QUOTE_ACTION_NOT_AVAILABLE';
  const rejected = await intake.attachAppointment(quote.quoteId, 'appointment_cancelled');
  assert.equal(rejected.ok, false);
  assert.equal(intake.getByQuoteCommand(quote.commandId).status, 'rejected');
  assert.equal(intake.getByQuoteCommand(quote.commandId).rejectionCode, 'QUOTE_ACTION_NOT_AVAILABLE');

  const second = intake.restartVisit(quote);
  assert.notEqual(second.commandId, first.commandId);
  assert.equal(second.status, 'awaiting_appointment');
  await intake.attachAppointment(quote.quoteId, 'appointment_valid');
  assert.equal(intake.getByQuoteCommand(quote.commandId).status, 'recorded');
  assert.equal(sent[0].data.command.commandId, first.commandId);
  assert.equal(sent[1].data.command.commandId, second.commandId);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[1].data.command.action)), { kind: 'visit_measure', appointmentId: 'appointment_valid' });
  assert.equal(intake._readStore().attempts[first.commandId].status, 'rejected');
});

test('definitive rejection allows switching to a non-visit action with a new command', async () => {
  const first = intake.prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
  nextFailure = 'APPOINTMENT_NOT_FOUND';
  await intake.attachAppointment(quote.quoteId, 'appointment_missing');
  intake.restartChoice(quote);
  const followup = intake.prepare(quote, { kind: 'contact_call', date: '2026-09-05' });
  assert.notEqual(followup.commandId, first.commandId);
  assert.equal((await intake.send(followup)).ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(sent[1].data.command.action)), { kind: 'contact_call', date: '2026-09-05' });
});

for (const code of ['NETWORK_ERROR', 'INTERNAL_ERROR', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'UNKNOWN']) {
  test(`${code} preserves exact visit command and payload for safe retry`, async () => {
    const waiting = intake.prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
    nextFailure = code;
    await intake.attachAppointment(quote.quoteId, 'appointment_uncertain');
    const pending = intake.getByQuoteCommand(quote.commandId);
    assert.equal(pending.status, 'unknown');
    assert.equal(pending.commandId, waiting.commandId);
    await intake.send(pending);
    assert.equal(sent[0].data.command.commandId, sent[1].data.command.commandId);
    assert.deepEqual(JSON.parse(JSON.stringify(sent[0].data.command.action)), JSON.parse(JSON.stringify(sent[1].data.command.action)));
  });
}

for (const code of ['APPOINTMENT_NOT_FOUND', 'QUOTE_ACTION_NOT_AVAILABLE', 'QUOTE_ACTION_NOT_AUTHORIZED']) {
  test(`${code} is a stable definitive visit rejection`, async () => {
    intake.prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
    nextFailure = code;
    await intake.attachAppointment(quote.quoteId, `appointment_${code.toLowerCase()}`);
    const rejected = intake.getByQuoteCommand(quote.commandId);
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.rejectionCode, code);
  });
}
