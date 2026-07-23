(function (global) {
  'use strict';
  const params = new URLSearchParams(global.location.search);
  const profile = params.get('profile') || 'advisor';
  const appointments = [];
  const commands = new Map();
  const collectionListeners = new Map();
  const now = () => new Date().toISOString();
  const emitAppointments = () => (collectionListeners.get('appointments') || []).forEach((listener) => listener(JSON.parse(JSON.stringify(appointments))));
  const error = (code) => Promise.reject({ details: { code }, code: `functions/${code.toLowerCase().replace(/_/g, '-')}` });
  const feeFor = (payload) => payload.type === 'install_visit'
    ? { applicability: 'not_applicable', disclosure: { status: 'not_required' }, settlement: { status: 'not_applicable' } }
    : ['correction_visit', 'warranty_visit'].includes(payload.type)
      ? { applicability: 'pending_operator_review', disclosure: { status: 'pending_review' }, settlement: { status: 'not_due' } }
      : { applicability: 'applies', disclosure: payload.visitFee.disclosureStatus === 'informed' ? { status: 'informed', amount: payload.visitFee.amount } : { status: 'not_informed' }, settlement: { status: 'not_due' } };
  const communicationFor = (appointment) => appointment.operationsReview.status === 'pending'
    ? { status: 'blocked', blockedReason: 'operations_review_pending' }
    : appointment.visitFee.disclosure.status === 'not_informed'
      ? { status: 'blocked', blockedReason: 'visit_fee_not_disclosed' }
      : { status: 'ready' };
  const create = (command) => {
    const payload = command.payload;
    const overlap = appointments.filter((item) => ['tentative', 'confirmed'].includes(item.status)
      && item.schedule.startAt < payload.schedule.endAt && item.schedule.endAt > payload.schedule.startAt).length;
    if (overlap >= 2) throw { details: { code: 'CAPACITY_EXCEEDED' } };
    const status = payload.type === 'measure_visit' && overlap === 0 ? 'confirmed' : 'tentative';
    const operationsReview = status === 'confirmed' ? { status: 'not_required' } : { status: 'pending', dueAt: new Date(Date.now() + 86400000).toISOString() };
    const appointment = {
      id: command.appointmentId, appointmentId: command.appointmentId, revision: 1, status,
      type: payload.type, source: payload.source, contact: payload.contact, location: payload.location,
      customerNeed: payload.customerNeed, requestedAvailability: payload.requestedAvailability,
      durationMinutes: payload.durationMinutes, schedule: payload.schedule, operationsReview,
      visitFee: feeFor(payload), quoteRef: payload.quoteRef, immutableQuoteSnapshot: payload.immutableQuoteSnapshot,
      communication: null, rescheduleHistory: [], createdAt: now(), updatedAt: now()
    };
    appointment.communication = communicationFor(appointment);
    appointments.push(appointment);
    return appointment;
  };
  const mutate = (appointment, command) => {
    appointment.revision += 1; appointment.updatedAt = now();
    if (command.type === 'resolveVisitFee') {
      appointment.visitFee.disclosure = { status: 'informed', amount: command.payload.informedAmount };
      appointment.communication = communicationFor(appointment);
    }
    if (command.type === 'markCommunicated') appointment.communication = { status: 'communicated', channel: command.payload.channel, lastCommunicatedAt: now() };
    if (command.type === 'rescheduleAppointment') {
      appointment.rescheduleHistory.push({ fromStartAt: appointment.schedule.startAt, toStartAt: command.payload.newSchedule.startAt, reason: command.payload.reason });
      appointment.schedule = command.payload.newSchedule;
      appointment.communication = { status: 'needs_recommunication' };
      appointment.status = 'confirmed';
    }
    return appointment;
  };
  const adapter = {
    authState(callback) {
      const user = { uid: profile === 'foreign' ? 'uid-foreign-synthetic' : 'uid-advisor-synthetic', email: `${profile}.agenda@example.invalid` };
      setTimeout(() => callback(user), 0); return () => {};
    },
    signInGoogle: () => Promise.resolve(), signInDemoAdvisor: () => Promise.resolve(), signOut: () => Promise.resolve(),
    subscribeDoc(path, next) {
      if (/\/members\//.test(path)) {
        setTimeout(() => next(['no-member', 'foreign', 'inactive'].includes(profile) ? (profile === 'inactive' ? { id: 'uid-advisor-synthetic', uid: 'uid-advisor-synthetic', active: false, role: 'advisor', createdAt: {}, updatedAt: {} } : null) : { id: 'uid-advisor-synthetic', uid: 'uid-advisor-synthetic', active: true, role: 'advisor', createdAt: {}, updatedAt: {} }), 0);
      } else if (/agendaConfig/.test(path)) setTimeout(() => next({ serviceEnabled: true, advisorCreationEnabled: true }), 0);
      else setTimeout(() => next(null), 0);
      return () => {};
    },
    subscribeCollection(path, next) {
      if (/\/appointments$/.test(path)) {
        const listeners = collectionListeners.get('appointments') || [];
        listeners.push(next); collectionListeners.set('appointments', listeners); setTimeout(() => next(JSON.parse(JSON.stringify(appointments))), 0);
      } else setTimeout(() => next([]), 0);
      return () => {};
    },
    async call(name, request) {
      if (name !== 'appointmentCommand') return error('INVALID_COMMAND');
      if (['no-member', 'foreign', 'inactive'].includes(profile)) return error('WORKSPACE_ACCESS_DENIED');
      const command = request.command;
      const prior = commands.get(command.commandId);
      const intent = JSON.stringify({ type: command.type, appointmentId: command.appointmentId, payload: command.payload });
      if (prior) {
        if (prior.intent !== intent) return error('IDEMPOTENCY_KEY_REUSED');
        return { ...prior.result, deduplicated: true };
      }
      let appointment;
      if (command.type === 'createAppointment') appointment = create(command);
      else {
        appointment = appointments.find((item) => item.id === command.appointmentId);
        if (!appointment) return error('APPOINTMENT_NOT_FOUND');
        if (appointment.revision !== command.expectedRevision) return error('REVISION_CONFLICT');
        appointment = mutate(appointment, command);
      }
      const result = { commandId: command.commandId, appointmentId: appointment.id, revision: appointment.revision, status: appointment.status, deduplicated: false };
      commands.set(command.commandId, { intent, result }); emitAppointments();
      if (command.payload?.customerNeed?.detail === 'ACK_LOST_SYNTHETIC') throw { details: { code: 'NETWORK_ERROR' } };
      return result;
    }
  };
  global.__WILAN_AGENDA_TEST_ADAPTER__ = adapter;
  global.__AGENDA_TEST_STATE__ = { appointments, commands };
})(window);
