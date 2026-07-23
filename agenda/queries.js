(function (global) {
  'use strict';

  const listeners = new Set();
  let subscriptions = [];
  let state = { appointments: [], config: null, overrides: [], loading: false, error: null };
  const emit = (next) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  };
  const stop = () => { subscriptions.forEach((unsubscribe) => unsubscribe?.()); subscriptions = []; emit({ appointments: [], config: null, overrides: [], loading: false, error: null }); };
  const start = async () => {
    stop();
    const auth = global.WilanAgenda.auth.getState();
    if (!['advisor', 'operator'].includes(auth.kind)) return;
    emit({ loading: true });
    const adapter = await global.WilanAgenda.firebase.initialize();
    const config = global.WilanAgenda.config;
    const root = `artifacts/${config.appId}/workspaces/${config.workspaceId}`;
    const onError = (error) => emit({ error, loading: false });
    subscriptions = [
      adapter.subscribeCollection(`${root}/appointments`, (appointments) => emit({ appointments, loading: false, error: null }), onError),
      adapter.subscribeDoc(`${root}/agendaConfig/backend-v1`, (backendConfig) => emit({ config: backendConfig }), onError),
      adapter.subscribeCollection(`${root}/availabilityOverrides`, (overrides) => emit({ overrides }), onError),
      adapter.subscribeCollection(`${root}/availabilityRules`, () => {}, onError)
    ];
  };
  const saturdayException = () => {
    const match = state.overrides.find((item) => item.enabled === true && (
      item.kind === 'saturday_exception' || /saturday|sabado|sábado/i.test(item.id || '')
    ));
    return match ? { id: match.id, enabled: true } : null;
  };
  const subscribe = (listener) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); };
  const getState = () => state;

  global.WilanAgenda.queries = { start, stop, subscribe, getState, saturdayException };
})(window);
