const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'agenda/ui.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'agenda/agenda.css'), 'utf8');

const window = {
  document: { readyState: 'loading', addEventListener() {} },
  WilanAgenda: {
    formatters: {
      asDate: (value) => value instanceof Date ? value : new Date(value),
      types: { measure_visit: 'Tomar medidas', install_visit: 'Instalar' },
      status: { confirmed: 'Confirmada', tentative: 'Pendiente de confirmar' }
    }
  }
};
window.window = window;
const context = vm.createContext(window);
vm.runInContext(source, context, { filename: 'agenda/ui.js' });
const calendar = context.WilanAgenda.ui._calendar;

const appointment = (id, startAt, type = 'measure_visit') => ({
  id,
  type,
  status: 'confirmed',
  schedule: { startAt },
  server: { createdByUid: 'advisor_synthetic_a' }
});

const rows = [
  appointment('apt_monday_9', '2026-08-10T14:00:00.000Z'),
  appointment('apt_monday_11', '2026-08-10T16:00:00.000Z'),
  appointment('apt_tuesday_13', '2026-08-11T18:00:00.000Z', 'install_visit'),
  appointment('apt_next_week', '2026-08-18T14:00:00.000Z')
];

const model = calendar.model(rows, '2026-08-10T05:00:00.000Z');
assert.equal(model.length, 6, 'El calendario Advisor representa lunes a sábado');
assert.equal(model[0].key, '2026-08-10');
assert.deepEqual(Array.from(model[0].items, (item) => item.id), ['apt_monday_9', 'apt_monday_11']);
assert.deepEqual(Array.from(model[1].items, (item) => item.id), ['apt_tuesday_13']);
assert.ok(!model.some((day) => day.items.some((item) => item.id === 'apt_next_week')));
assert.equal(calendar.time(new Date('2026-08-10T14:00:00.000Z')), '09:00');
assert.equal(calendar.time(new Date('2026-08-11T18:00:00.000Z')), '13:00');

assert.match(source, /data-agenda-calendar="week"/);
assert.match(source, /data-agenda-action="week-prev"/);
assert.match(source, /data-agenda-action="week-next"/);
assert.match(source, /data-agenda-action="week-today"/);
assert.match(source, /data-agenda-action="view-week"/);
assert.match(source, /data-agenda-action="view-list"/);
assert.match(source, /data-agenda-action="appointment-focus"/);
assert.match(source, /if \(authState\.kind === 'advisor'\) return renderAdvisorAgenda\(content\)/);
assert.match(source, /if \(action === 'receipt-view'\)[\s\S]*agendaView = 'list'/);
assert.match(css, /\.agenda-advisor-week\{display:grid/);
assert.match(css, /@media\(max-width:700px\)[\s\S]*\.agenda-advisor-week\{display:none\}/);
assert.match(css, /\.agenda-mobile-day,\.agenda-advisor-mobile\{display:block\}/);

console.log('ok - calendario Advisor semanal, horas, múltiples citas, navegación, móvil, lista y deep link');
