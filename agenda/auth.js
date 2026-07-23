(function (global) {
  'use strict';

  const listeners = new Set();
  let unsubscribeAuth = null;
  let unsubscribeMember = null;
  let unsubscribeRequest = null;
  let memberLoaded = false;
  let requestLoaded = false;
  let currentMember = null;
  let currentRequest = null;
  let currentUser = null;
  let state = { kind: 'unauthenticated', user: null, member: null, accessRequest: null, error: null };

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
  const validRequest = (request, uid) => Boolean(
    request
    && request.schema === 'agenda-access-request.v1'
    && request.uid === uid
    && request.requestedRole === 'advisor'
    && request.provider === 'google.com'
    && ['pending', 'approved', 'rejected', 'revoked', 'withdrawn'].includes(request.status)
  );
  const requestKind = (status) => ({
    pending: 'request_pending',
    rejected: 'request_rejected',
    revoked: 'revoked',
    withdrawn: 'request_withdrawn',
    approved: 'approved_pending_membership',
  }[status] || 'no_membership');
  const resolve = () => {
    if (!currentUser) return;
    if (!memberLoaded || !requestLoaded) {
      emit({ kind: 'checking_membership', user: currentUser, member: null, accessRequest: null, error: null });
      return;
    }
    const request = validRequest(currentRequest, currentUser.uid) ? currentRequest : null;
    if (currentMember) {
      if (!structurallyValid(currentMember, currentUser.uid)) {
        emit({ kind: 'invalid_membership', user: currentUser, member: null, accessRequest: request, error: null });
      } else if (!currentMember.active) {
        emit({
          kind: request?.status === 'revoked' ? 'revoked' : 'inactive',
          user: currentUser,
          member: currentMember,
          accessRequest: request,
          error: null,
        });
      } else {
        emit({ kind: currentMember.role, user: currentUser, member: currentMember, accessRequest: request, error: null });
      }
      return;
    }
    emit({
      kind: request ? requestKind(request.status) : 'no_membership',
      user: currentUser,
      member: null,
      accessRequest: request,
      error: null,
    });
  };
  const stopWorkspaceListeners = () => {
    unsubscribeMember?.();
    unsubscribeRequest?.();
    unsubscribeMember = null;
    unsubscribeRequest = null;
  };
  const watchAccess = (adapter, user) => {
    stopWorkspaceListeners();
    memberLoaded = false;
    requestLoaded = false;
    currentMember = null;
    currentRequest = null;
    const config = global.WilanAgenda.config;
    const root = `artifacts/${config.appId}/workspaces/${config.workspaceId}`;
    unsubscribeMember = adapter.subscribeDoc(`${root}/members/${user.uid}`, (member) => {
      currentMember = member;
      memberLoaded = true;
      resolve();
    }, (error) => emit({ kind: 'network_error', user, member: null, accessRequest: null, error }));
    unsubscribeRequest = adapter.subscribeDoc(`${root}/accessRequests/${user.uid}`, (request) => {
      currentRequest = request;
      requestLoaded = true;
      resolve();
    }, (error) => emit({ kind: 'network_error', user, member: null, accessRequest: null, error }));
  };
  const start = async () => {
    emit({ kind: 'loading' });
    try {
      const adapter = await global.WilanAgenda.firebase.initialize();
      unsubscribeAuth?.();
      unsubscribeAuth = adapter.authState((user) => {
        if (!user) {
          stopWorkspaceListeners();
          currentUser = null;
          emit({ kind: 'unauthenticated', user: null, member: null, accessRequest: null, error: null });
          return;
        }
        currentUser = user;
        emit({ kind: 'checking_membership', user, member: null, accessRequest: null, error: null });
        watchAccess(adapter, user);
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

  global.WilanAgenda.auth = { start, signIn, signOut, subscribe, getState, structurallyValid, validRequest };
})(window);
