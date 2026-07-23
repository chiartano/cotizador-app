const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const memoryStorage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    _values: values,
  };
};
const sandboxFor = (hostname = 'cotizador.example.invalid') => {
  const window = {
    location: { hostname, search: '' }, localStorage: memoryStorage(),
    crypto: crypto.webcrypto, URLSearchParams, TextEncoder, structuredClone,
    setTimeout, clearTimeout,
  };
  window.window = window;
  return vm.createContext(window);
};
const load = (context, file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const test = async (name, callback) => {
  try { await callback(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
};

(async () => {
  await test('1 feature flag productivo permanece apagado por defecto', () => {
    const context = sandboxFor(); load(context, 'agenda/config.js');
    assert.equal(context.WilanAgenda.config.enabled, false);
    assert.equal(context.WilanAgenda.config.appId, 'contabilidad-vidrio');
    assert.equal(context.WilanAgenda.config.workspaceId, 'wilan-main');
    assert.equal(context.WilanAgenda.config.firebase.projectId, 'contabilidad-vidrio');
    assert.equal(context.WilanAgenda.config.firebase.messagingSenderId, '732209399912');
    const firebaseSource = fs.readFileSync(path.join(root, 'agenda/firebase.js'), 'utf8');
    assert.match(firebaseSource, /FIREBASE_PROJECT_MISMATCH/);
  });

  await test('2 emulator local activa Agenda sin cambiar produccion', () => {
    const context = sandboxFor('127.0.0.1'); load(context, 'agenda/config.js');
    assert.equal(context.WilanAgenda.config.enabled, true);
    assert.equal(context.WilanAgenda.config.emulator, true);
    assert.equal(context.WilanAgenda.config.firebase.projectId, 'demo-wilan-agenda-backend');
    assert.equal(context.WilanAgenda.config.appId, 'app_agenda_demo');
    assert.equal(context.WilanAgenda.config.workspaceId, 'workspace_agenda_demo');
  });

  await test('3 bloques rutinarios y sabado excepcional respetan politica', () => {
    const context = sandboxFor(); context.WilanAgenda = {}; load(context, 'agenda/availability.js');
    const policy = context.WilanAgenda.availability;
    assert.deepEqual(Array.from(policy.blocksForDate('2026-07-23'), (item) => item.start), ['09:00', '11:00', '13:00', '15:00']);
    assert.deepEqual(Array.from(policy.blocksForDate('2026-07-25'), (item) => item.start), ['08:00', '10:00']);
    const enabled = policy.blocksForDate('2026-07-25', { saturdayException: { id: 'override_saturday', enabled: true } });
    assert.equal(enabled.at(-1).schedule.availabilitySource, 'exceptional_block');
    assert.equal(enabled.at(-1).schedule.availabilityOverrideId, 'override_saturday');
    assert.deepEqual(Array.from(policy.INSTALL_DURATIONS), [180, 240, 300, 360]);
    const installations = policy.installBlocksForDate('2026-07-23', 360);
    assert.deepEqual(Array.from(installations, (item) => item.start), ['09:00', '10:00', '11:00']);
    assert.equal(installations.at(-1).schedule.endAt, '2026-07-23T22:00:00.000Z');
  });

  await test('4 disponibilidad visible es orientativa y no lee ledger', () => {
    const context = sandboxFor(); context.WilanAgenda = {}; load(context, 'agenda/availability.js');
    const schedule = context.WilanAgenda.availability.blocksForDate('2026-07-23')[0].schedule;
    const appointments = [{ status: 'confirmed', schedule }, { status: 'tentative', schedule }];
    assert.equal(context.WilanAgenda.availability.occupancy(appointments, schedule), 2);
    assert.match(context.WilanAgenda.availability.availabilityText(2), /backend decide/);
    const queries = fs.readFileSync(path.join(root, 'agenda/queries.js'), 'utf8');
    assert.doesNotMatch(queries, /appointmentCommands|availabilityLedger|\/private\//);
  });

  await test('5 snapshot usa allowlist, cinco campos canonicos y hash sha256', async () => {
    const context = sandboxFor(); context.WilanAgenda = {}; load(context, 'agenda/quoteSnapshot.js');
    const source = { producto: 'Division', medidas: '120x190', cantidad: 1, precio: 729244, vidrio: '6mm', color: 'natural',
      canonicalProductId: 'DB-COR', familyId: 'DB', variantId: 'DB-COR-2H', mappingStatus: 'map_with_variant', canonicalAttributes: { glassThickness: 6 }, raw: { ancho: 120 } };
    const result = await context.WilanAgenda.quoteSnapshot.build({ quoteId: 'q_synthetic001', customer: { phone: '3000000000' }, items: [source], total: 729244 });
    assert.match(result.snapshot.snapshotHash, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(JSON.parse(JSON.stringify(result.snapshot.items[0])).canonicalProductId, 'DB-COR');
    for (const key of ['canonicalProductId', 'familyId', 'variantId', 'mappingStatus', 'canonicalAttributes']) assert.ok(key in result.snapshot.items[0]);
    source.precio = 1;
    assert.equal(result.snapshot.quotedTotal, 729244);
    assert.equal(result.snapshot.items[0].totalPrice, 729244);
    assert.equal('recargo' in result.snapshot.items[0].rawAttributes, false);
  });

  await test('5b quoteId nace en el modelo local y se conserva al agendar y agrupar el carrito', () => {
    const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
    const ui = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
    assert.match(app, /quoteId:\s*newAgendaQuoteId\(\)/);
    assert.match(app, /quoteItems\.find\(item\s*=>\s*item\.quoteId\)\?\.quoteId\s*\|\|\s*newAgendaQuoteId\(\)/);
    assert.match(app, /quoteItems\.forEach\(item\s*=>\s*\{\s*if\s*\(!item\.quoteId\)\s*item\.quoteId\s*=\s*quoteId/);
    assert.match(app, /itemToAdd\.quoteId\s*=\s*quoteItems\[0\]\?\.quoteId\s*\|\|\s*itemToAdd\.quoteId/);
    assert.match(app, /quoteId:\s*cartVisible\s*\?\s*quoteItems\[0\]\?\.quoteId\s*:\s*lastCalculation\?\.quoteId/);
    assert.match(ui, /form\.direct\s*=\s*!quoteContext\.quoteId/);
    assert.match(ui, /quoteContext\.quoteId\s*\?\s*\{\s*quoteId:\s*quoteContext\.quoteId/);
    assert.doesNotMatch(ui, /quoteContext\.quoteId\s*\|\|\s*A\(\)\.quoteSnapshot\.newQuoteId/);
  });

  await test('6 drafts conservan IDs para replay manual y separan referencias confirmadas', () => {
    const context = sandboxFor(); context.WilanAgenda = {}; load(context, 'agenda/pendingDrafts.js');
    const drafts = context.WilanAgenda.pendingDrafts;
    drafts.save({ commandId: 'cmd_synthetic0001', appointmentId: 'apt_synthetic0001', payload: { phone: '3000000000' } });
    drafts.save({ commandId: 'cmd_synthetic0001', appointmentId: 'apt_synthetic0001', status: 'unknown', payload: { phone: '3000000000' } });
    assert.equal(drafts.list().length, 1);
    assert.equal(drafts.list()[0].commandId, 'cmd_synthetic0001');
    assert.throws(() => drafts.remove('cmd_synthetic0001'), /DRAFT_RESULT_MAY_EXIST/);
    drafts.confirm('cmd_synthetic0001', { appointmentId: 'apt_synthetic0001', status: 'confirmed' }, 'q_synthetic001');
    assert.equal(drafts.list().length, 0);
    assert.equal(drafts.quoteLink('q_synthetic001').appointmentId, 'apt_synthetic0001');
  });

  await test('7 comando usa v1.2, callable y no confia rol o payloadHash cliente', async () => {
    const context = sandboxFor(); load(context, 'agenda/config.js');
    let captured = null;
    context.WilanAgenda.firebase = { adapter: { call: async (_name, payload) => { captured = payload; return { appointmentId: payload.command.appointmentId, revision: 1, status: 'confirmed' }; } } };
    load(context, 'agenda/commands.js');
    const result = await context.WilanAgenda.commands.send({ commandId: 'cmd_synthetic0002', appointmentId: 'apt_synthetic0002', expectedRevision: 0, type: 'createAppointment', payload: { synthetic: true } });
    assert.equal(result.ok, true);
    assert.equal(captured.command.schema, 'appointment-command.v1.2');
    assert.equal(captured.workspaceId, 'wilan-main');
    assert.equal('role' in captured, false);
    assert.equal(captured.command.payloadHash, `sha256:${'0'.repeat(64)}`);
    assert.equal(context.WilanAgenda.commands.classify({ code: 'functions/internal' }).uncertain, true);
    assert.equal(context.WilanAgenda.commands.classify({ details: { code: 'CAPACITY_EXCEEDED' } }).uncertain, false);
  });

  await test('8 UI advisor no ofrece acciones terminales ni acceso privado', () => {
    const ui = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
    for (const command of ['cancelAppointment', 'completeAppointment', 'markNoShow', 'reviewAppointment']) assert.doesNotMatch(ui, new RegExp(`type:\\s*['\"]${command}`));
    assert.doesNotMatch(ui, /appointmentCommands|availabilityLedger|\/private\//);
    assert.match(ui, /resolveVisitFee/);
    assert.match(ui, /markCommunicated/);
    assert.match(ui, /rescheduleAppointment/);
    assert.match(ui, /Horario reservado provisionalmente/);
  });

  await test('8b UI reubicada conserva CTA visible y borrador offline reintentable', () => {
    const ui = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
    assert.match(ui, /document\.querySelector\('#quote-summary'\)\s*\|\|\s*document\.querySelector\('#resultado-panel \.card'\)/);
    assert.match(ui, /document\.querySelector\('#agenda-header-button'\)\.addEventListener\('click', openAgenda\)/);
    assert.match(ui, /document\.querySelector\('\[data-agenda-action="quote"\]'\)\.addEventListener\('click'/);
    assert.match(ui, /const action = document\.querySelector\('#agenda-quote-action'\)/);
    assert.match(ui, /A\(\)\.pendingDrafts\.save\(\{ \.\.\.draft, status: 'pending' \}\);\s*form\.sending = false;/);
  });

  await test('8c acceso abierto solicita advisor sin confiar identidad o rol del navegador', async () => {
    const context = sandboxFor();
    load(context, 'agenda/config.js');
    load(context, 'agenda/commands.js');
    let captured = null;
    context.WilanAgenda.firebase = { adapter: { call: async (name, payload) => {
      captured = { name, payload };
      return { status: 'pending', revision: 1, targetUid: 'uid-derived-by-backend' };
    } } };
    load(context, 'agenda/access.js');
    const result = await context.WilanAgenda.access.send({ type: 'requestAccess', commandId: 'cmd_access_synthetic_001' });
    assert.equal(result.ok, true);
    assert.equal(captured.name, 'agendaAccessCommand');
    assert.equal(captured.payload.command.schema, 'agenda-access-command.v1');
    assert.equal(captured.payload.command.type, 'requestAccess');
    assert.equal('targetUid' in captured.payload.command, false);
    assert.equal('email' in captured.payload.command.payload, false);
    assert.equal('role' in captured.payload.command.payload, false);
  });

  await test('8d revocacion en sesion abierta detiene listeners y limpia citas visibles', () => {
    const auth = fs.readFileSync(path.join(root, 'agenda/auth.js'), 'utf8');
    const queries = fs.readFileSync(path.join(root, 'agenda/queries.js'), 'utf8');
    const ui = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
    assert.match(auth, /requestKind/);
    assert.match(auth, /request\?\.status === 'revoked' \? 'revoked' : 'inactive'/);
    assert.match(queries, /emit\(\{ appointments: \[\], config: null, overrides: \[\]/);
    assert.match(ui, /if \(!allowed\(\) && wasAllowed\)[\s\S]{0,100}A\(\)\.queries\.stop\(\)/);
    assert.match(ui, /resetAndCloseForm\(\)/);
    assert.match(ui, /Tu acceso fue desactivado por el administrador/);
    assert.match(ui, /No puedes ver citas ni agendar/);
  });

  await test('9 PWA v7.7 incluye shell Agenda local y no cachea Firebase externo', () => {
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(sw, /CACHE_NAME = 'cotizador-v7\.7'/);
    for (const asset of ['agenda.css', 'config.js', 'firebase.js', 'commands.js', 'access.js', 'queries.js', 'ui.js']) assert.match(sw, new RegExp(asset.replace('.', '\\.')));
    assert.doesNotMatch(sw, /gstatic|firebasejs/);
    assert.match(sw, /cache: 'reload'/);
  });

  await test('10 almacenamiento Agenda no toca claves historicas ni guarda tokens', () => {
    const sources = ['agenda/pendingDrafts.js', 'agenda/auth.js', 'agenda/firebase.js'].map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
    assert.doesNotMatch(sources, /vidrios_historial|cotizador_carrito_v1|cotizador_cliente_v1|cotizador_historial_full_v1/);
    assert.doesNotMatch(sources, /accessToken|refreshToken|idToken/);
    assert.match(sources, /wilan_agenda_advisor_v1/);
    const css = fs.readFileSync(path.join(root, 'agenda/agenda.css'), 'utf8');
    assert.doesNotMatch(css, /(?:^|})details summary/);
  });
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
