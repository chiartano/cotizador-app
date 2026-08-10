(function (global) {
  'use strict';

  const listeners = new Set();
  let subscriptions = [];
  let appointmentSubscriptions = [];
  let root = '';
  let adapter = null;
  let state = { appointments: [], config: null, overrides: [], loading: false, error: null, rangeStart: null, rangeEnd: null };
  const emit = (next) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  };
  const dateKey = (date) => date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const mondayFor = (source = new Date()) => {
    const value = new Date(`${dateKey(source)}T12:00:00-05:00`);
    const day = value.getUTCDay();
    value.setUTCDate(value.getUTCDate() - (day === 0 ? 6 : day - 1));
    return value;
  };
  const rangeFor = (source) => {
    const monday = mondayFor(source);
    const next = new Date(monday.getTime() + 7 * 86400000);
    return {
      rangeStart: `${dateKey(monday)}T05:00:00.000Z`,
      rangeEnd: `${dateKey(next)}T05:00:00.000Z`
    };
  };
  const merge = (...groups) => {
    const values = new Map();
    groups.flat().forEach((item) => values.set(item.id, item));
    return [...values.values()].filter((item) => item.archived !== true)
      .sort((left, right) => String(left.schedule?.startAt || '').localeCompare(String(right.schedule?.startAt || '')));
  };
  const stopAppointments = () => {
    appointmentSubscriptions.forEach((unsubscribe) => unsubscribe?.());
    appointmentSubscriptions = [];
  };
  const subscribeAppointments = () => {
    stopAppointments();
    if (!adapter || !root) return;
    const onError = (error) => emit({ error, loading: false });
    if (state.config?.agendaOperationalUxEnabled !== true || !adapter.subscribeQuery) {
      appointmentSubscriptions = [adapter.subscribeCollection(`${root}/appointments`, (appointments) => {
        emit({ appointments: appointments.filter((item) => item.archived !== true), loading: false, error: null });
      }, onError)];
      return;
    }
    let legacy = [];
    let current = [];
    const publish = () => emit({ appointments: merge(legacy, current), loading: false, error: null });
    const bounds = [
      { where: ['schedule.startAt', '>=', state.rangeStart] },
      { where: ['schedule.startAt', '<', state.rangeEnd] },
      { orderBy: ['schedule.startAt', 'asc'] }
    ];
    appointmentSubscriptions = [
      adapter.subscribeQuery(`${root}/appointments`, [{ where: ['schema', '==', 'appointment.v1'] }, ...bounds], (rows) => { legacy = rows; publish(); }, onError),
      adapter.subscribeQuery(`${root}/appointments`, [{ where: ['archived', '==', false] }, ...bounds], (rows) => { current = rows; publish(); }, onError)
    ];
  };
  const stop = () => {
    stopAppointments();
    subscriptions.forEach((unsubscribe) => unsubscribe?.());
    subscriptions = [];
    emit({ appointments: [], config: null, overrides: [], loading: false, error: null });
  };
  const start = async () => {
    stop();
    const auth = global.WilanAgenda.auth.getState();
    if (!['advisor', 'operator'].includes(auth.kind)) return;
    emit({ loading: true, ...rangeFor(new Date()) });
    adapter = await global.WilanAgenda.firebase.initialize();
    const config = global.WilanAgenda.config;
    root = `artifacts/${config.appId}/workspaces/${config.workspaceId}`;
    const onError = (error) => emit({ error, loading: false });
    subscriptions = [
      adapter.subscribeDoc(`${root}/agendaConfig/backend-v1`, (backendConfig) => {
        emit({ config: backendConfig || {} });
        subscribeAppointments();
      }, onError),
      adapter.subscribeCollection(`${root}/availabilityOverrides`, (overrides) => emit({ overrides }), onError),
      adapter.subscribeCollection(`${root}/availabilityRules`, () => {}, onError)
    ];
  };
  const setWeek = (date) => {
    emit(rangeFor(date));
    if (state.config?.agendaOperationalUxEnabled === true) subscribeAppointments();
  };
  const focusAppointmentPeriod = (startAt) => {
    const effectiveDate = new Date(startAt);
    if (!Number.isFinite(effectiveDate.getTime())) return false;
    emit({ appointments: [], loading: true, error: null, ...rangeFor(effectiveDate) });
    if (state.config?.agendaOperationalUxEnabled === true) subscribeAppointments();
    return true;
  };
  const saturdayException = () => {
    const match = state.overrides.find((item) => item.enabled === true && (
      item.kind === 'saturday_exception' || /saturday|sabado|sábado/i.test(item.id || '')
    ));
    return match ? { id: match.id, enabled: true } : null;
  };
  const subscribe = (listener) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); };
  const getState = () => state;

  global.WilanAgenda.queries = { start, stop, subscribe, getState, setWeek, focusAppointmentPeriod, rangeFor, saturdayException };
})(window);
