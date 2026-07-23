(function (global) {
  'use strict';

  const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
  const randomPart = () => global.crypto?.randomUUID
    ? global.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const newCommandId = () => `cmd_${randomPart()}`;
  const newAppointmentId = () => `apt_${randomPart()}`;
  const classify = (error) => {
    const rawCode = error?.details?.code || error?.code?.split('/').pop()?.toUpperCase().replace(/-/g, '_') || 'NETWORK_ERROR';
    const code = rawCode === 'INTERNAL' ? 'INTERNAL_ERROR' : rawCode;
    const uncertain = ['NETWORK_ERROR', 'INTERNAL_ERROR', 'UNAVAILABLE', 'DEADLINE_EXCEEDED', 'UNKNOWN'].includes(code);
    const messages = {
      REVISION_CONFLICT: 'La cita cambió. Actualiza y vuelve a intentar.',
      CAPACITY_EXCEEDED: 'Ese horario acaba de llenarse. Conservamos tus datos para elegir otro.',
      SLOT_NOT_AVAILABLE: 'Ese horario no está disponible.',
      SERVICE_DISABLED: 'Agenda está pausada. No se guardó un comando nuevo.',
      OPERATOR_ROLE_REQUIRED: 'Esta acción requiere operator.',
      WORKSPACE_ACCESS_DENIED: 'Tu usuario no pertenece a este workspace.',
      MEMBER_INACTIVE: 'Tu acceso a Agenda está inactivo.',
      ROLE_NOT_ALLOWED: 'Tu perfil no está habilitado para Agenda.',
      IDEMPOTENCY_KEY_REUSED: 'El identificador ya fue usado con datos diferentes. No se reintentará.',
      INTERNAL_ERROR: 'No recibimos una confirmación concluyente. Reintenta el mismo envío para recuperar el resultado.',
      UNAVAILABLE: 'El servicio no respondió. Reintenta el mismo envío para recuperar el resultado.',
      DEADLINE_EXCEEDED: 'La confirmación tardó demasiado. Reintenta el mismo envío para recuperar el resultado.',
      UNKNOWN: 'No pudimos confirmar el resultado. Reintenta el mismo envío.',
      VISIT_FEE_DISCLOSURE_REQUIRED: 'Primero informa el costo de visita.',
      NETWORK_ERROR: 'No recibimos confirmación. Reintenta el mismo envío para recuperar el resultado.'
    };
    return { code, uncertain, message: messages[code] || 'No fue posible completar la acción.', raw: error };
  };
  const send = async ({ commandId = newCommandId(), appointmentId, expectedRevision, type, payload }) => {
    const adapter = global.WilanAgenda.firebase?.adapter;
    if (!adapter?.call) return { ok: false, commandId, error: classify({ details: { code: 'NETWORK_ERROR' } }) };
    const config = global.WilanAgenda.config;
    try {
      const result = await adapter.call('appointmentCommand', {
        appId: config.appId,
        workspaceId: config.workspaceId,
        command: {
          schema: 'appointment-command.v1.2', commandId, workspaceId: config.workspaceId,
          appointmentId, expectedRevision, type, payloadHash: ZERO_HASH, payload
        }
      });
      return { ok: true, commandId, result };
    } catch (error) {
      return { ok: false, commandId, error: classify(error) };
    }
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.commands = { ZERO_HASH, newCommandId, newAppointmentId, classify, send };
})(window);
