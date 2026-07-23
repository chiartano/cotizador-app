(function (global) {
  'use strict';

  const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
  const classify = (error) => {
    const raw = error?.details?.code || error?.code?.split('/').pop()?.toUpperCase().replace(/-/g, '_') || 'NETWORK_ERROR';
    const messages = {
      ACCESS_REQUESTS_DISABLED: 'Las solicitudes de acceso están pausadas.',
      ACCESS_REQUEST_COOLDOWN: 'Aún no se cumple el tiempo para volver a solicitar.',
      ACCESS_ALREADY_GRANTED: 'Tu cuenta ya tiene acceso activo.',
      GOOGLE_PROVIDER_REQUIRED: 'La solicitud requiere una cuenta Google válida.',
      ACCESS_REQUEST_INVALID_TRANSITION: 'El estado cambió. Actualiza y vuelve a revisar.',
      IDEMPOTENCY_KEY_REUSED: 'El identificador ya se usó con otra acción.',
      NETWORK_ERROR: 'No pudimos confirmar la solicitud. Reintenta de forma segura.',
    };
    return { code: raw, message: messages[raw] || 'No fue posible completar la solicitud.', raw: error };
  };
  const send = async ({ type, commandId = global.WilanAgenda.commands.newCommandId() }) => {
    const adapter = global.WilanAgenda.firebase?.adapter;
    if (!adapter?.call) return { ok: false, commandId, error: classify({ details: { code: 'NETWORK_ERROR' } }) };
    const config = global.WilanAgenda.config;
    try {
      const result = await adapter.call('agendaAccessCommand', {
        appId: config.appId,
        workspaceId: config.workspaceId,
        command: {
          schema: 'agenda-access-command.v1',
          commandId,
          type,
          payloadHash: ZERO_HASH,
          payload: {},
        },
      });
      return { ok: true, result, commandId };
    } catch (error) {
      return { ok: false, commandId, error: classify(error) };
    }
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.access = { ZERO_HASH, classify, send };
})(window);
