const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const loadQueries = ({ flag, rows, uid = 'advisor_synthetic_a', kind = 'advisor' }) => {
  const querySubscriptions = [];
  let collectionSubscriptions = 0;
  const matches = (row, constraints) => constraints.every((constraint) => {
    if (!constraint.where) return true;
    const [field, operator, expected] = constraint.where;
    const actual = field.split('.').reduce((value, key) => value?.[key], row);
    if (operator === '==') return actual === expected;
    if (operator === '>=') return actual >= expected;
    if (operator === '<') return actual < expected;
    throw new Error(`Unsupported operator ${operator}`);
  });
  const publish = (subscription) => subscription.next(rows.filter((row) => matches(row, subscription.constraints)));
  const adapter = {
    subscribeDoc(_path, next) { next({ agendaOperationalUxEnabled: flag }); return () => {}; },
    subscribeCollection(pathName, next) {
      if (/\/appointments$/.test(pathName)) collectionSubscriptions += 1;
      next([]);
      return () => {};
    },
    subscribeQuery(_path, constraints, next, error) {
      const subscription = { constraints, next, error };
      querySubscriptions.push(subscription);
      publish(subscription);
      return () => {};
    }
  };
  const window = {
    WilanAgenda: {
      auth: { getState: () => ({ kind, user: { uid } }) },
      firebase: { initialize: async () => adapter },
      config: { appId: 'app_synthetic', workspaceId: 'workspace_synthetic' }
    }
  };
  window.window = window;
  const context = vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(root, 'agenda/queries.js'), 'utf8'), context, { filename: 'agenda/queries.js' });
  return {
    queries: context.WilanAgenda.queries,
    querySubscriptions,
    collectionSubscriptions: () => collectionSubscriptions,
    republish: () => querySubscriptions.forEach(publish)
  };
};

const appointment = (id, overrides = {}) => ({
  id,
  schema: 'appointment.v1.1',
  archived: false,
  type: 'measure_visit',
  status: 'confirmed',
  schedule: { startAt: '2026-08-18T14:00:00.000Z' },
  server: { createdByUid: 'advisor_synthetic_a' },
  ...overrides
});

(async () => {
  const rows = [appointment('apt_own')];
  const basic = loadQueries({ flag: false, rows });
  await basic.queries.start();
  assert.equal(basic.collectionSubscriptions(), 0, 'Advisor basic must not subscribe to the whole collection');
  assert.equal(basic.querySubscriptions.length, 2);
  for (const subscription of basic.querySubscriptions) {
    assert.ok(subscription.constraints.some((item) => item.where?.join('|') === 'server.createdByUid|==|advisor_synthetic_a'));
    assert.ok(!subscription.constraints.some((item) => item.where?.[0] === 'schedule.startAt'));
  }
  assert.deepEqual(Array.from(basic.queries.getState().appointments, (item) => item.id), ['apt_own']);

  const beforeFocus = basic.queries.getState().appointments;
  assert.equal(basic.queries.focusAppointmentPeriod('2026-09-22T14:00:00.000Z'), true);
  assert.deepEqual(Array.from(basic.queries.getState().appointments, (item) => item.id), ['apt_own']);
  assert.equal(basic.queries.getState().loading, false);
  assert.equal(basic.querySubscriptions.length, 2, 'Basic focus must keep its live listeners');
  assert.equal(basic.queries.getState().appointments, beforeFocus, 'Basic focus must not clear the visible row');

  rows.push(
    appointment('apt_future', { schedule: { startAt: '2027-01-12T16:00:00.000Z' } }),
    appointment('apt_archived', { archived: true }),
    appointment('apt_foreign', { server: { createdByUid: 'advisor_synthetic_b' } }),
    appointment('apt_legacy', { schema: 'appointment.v1', archived: undefined, schedule: { startAt: '2026-12-15T14:00:00.000Z' } })
  );
  basic.republish();
  assert.deepEqual(Array.from(basic.queries.getState().appointments, (item) => item.id), ['apt_own', 'apt_legacy', 'apt_future']);
  assert.ok(!basic.queries.getState().appointments.some((item) => item.id === 'apt_archived'));
  assert.ok(!basic.queries.getState().appointments.some((item) => item.id === 'apt_foreign'));

  basic.queries.stop();
  await basic.queries.start();
  assert.deepEqual(Array.from(basic.queries.getState().appointments, (item) => item.id), ['apt_own', 'apt_legacy', 'apt_future']);

  const advanced = loadQueries({ flag: true, rows: [appointment('apt_advanced')] });
  await advanced.queries.start();
  assert.equal(advanced.querySubscriptions.length, 2);
  assert.ok(advanced.querySubscriptions.every((subscription) => subscription.constraints.some((item) => item.where?.[0] === 'schedule.startAt')));
  assert.equal(advanced.queries.focusAppointmentPeriod('2026-09-22T14:00:00.000Z'), true);
  assert.equal(advanced.querySubscriptions.length, 4, 'Advanced focus must retain its weekly resubscription');

  const ui = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
  assert.match(ui, /agendaOperationalUxEnabled === true\) return renderOperationalAgenda/);
  assert.match(ui, /<h3>Mis citas<\/h3>/);
  assert.match(ui, /Cargando tus citas/);
  assert.match(ui, /No pudimos cargar tus citas/);
  assert.match(ui, /Aún no tienes citas/);
  assert.match(ui, /formatters\.dateTime\(item\.schedule\?\.startAt\)/);
  assert.match(ui, /formatters\.types\[item\.type\]/);
  assert.match(ui, /formatters\.status\[item\.status\]/);
  assert.match(ui, /submissionLock \|\| form\.sending/);
  assert.match(ui, /activeDraft = activeDraft \|\| await draftForForm/);

  console.log('ok - Mis citas basic listener, isolation, reload, future lookup and advanced regression');
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
