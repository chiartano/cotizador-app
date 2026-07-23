(function (global) {
  'use strict';

  const listeners = new Set();
  let unsubscribeAuth = null;
  let unsubscribeMember = null;
  let state = { kind: 'unauthenticated', user: null, member: null, error: null };
  const emit = (next) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener(state));
  };
  const structurallyValid = (member, uid) => {
    if (!member || member.uid !== uid) return false;
    const keys = Object.keys(member).filter((key) => key !== 'id').sort();
    return JSON.stringify(keys) === JSON.stringify(['active', 'createdAt', 'role', 'uid', 'updatedAt'])
      && typeof member.active === 'boolean'
      && ['advisor', 'operator'].includes(member.role);
  };
  const watchMember = (adapter, user) => {
    unsubscribeMember?.();
    const config = global.WilanAgenda.config;
    const path = `artifacts/${config.appId}/workspaces/${config.workspaceId}/members/${user.uid}`;
    unsubscribeMember = adapter.subscribeDoc(path, (member) => {
      if (!member) return emit({ kind: 'no_membership', user, member: null, error: null });
      if (!structurallyValid(member, user.uid)) return emit({ kind: 'invalid_membership', user, member: null, error: null });
      if (!member.active) return emit({ kind: 'inactive', user, member, error: null });
      emit({ kind: member.role, user, member, error: null });
    }, (error) => emit({ kind: 'network_error', user, member: null, error }));
  };
  const start = async () => {
    emit({ kind: 'loading' });
    try {
      const adapter = await global.WilanAgenda.firebase.initialize();
      unsubscribeAuth?.();
      unsubscribeAuth = adapter.authState((user) => {
        if (!user) {
          unsubscribeMember?.(); unsubscribeMember = null;
          emit({ kind: 'unauthenticated', user: null, member: null, error: null });
          return;
        }
        emit({ kind: 'checking_membership', user, member: null, error: null });
        watchMember(adapter, user);
      });
    } catch (error) {
      emit({ kind: 'network_error', error });
    }
  };
  const signIn = async () => {
    emit({ kind: 'signing_in', error: null });
    try {
      const adapter = await global.WilanAgenda.firebase.initialize();
      if (global.WilanAgenda.config.emulator) await adapter.signInDemoAdvisor();
      else await adapter.signInGoogle();
    } catch (error) { emit({ kind: 'network_error', error }); }
  };
  const signOut = async () => {
    const adapter = await global.WilanAgenda.firebase.initialize();
    await adapter.signOut();
  };
  const subscribe = (listener) => { listeners.add(listener); listener(state); return () => listeners.delete(listener); };
  const getState = () => state;

  global.WilanAgenda.auth = { start, signIn, signOut, subscribe, getState, structurallyValid };
})(window);
