(function (global) {
  'use strict';

  // Bandeja de cotizaciones: cada cotización que se manda por WhatsApp queda
  // registrada en el CRM, sin pedir nombre ni teléfono y sin un botón aparte.
  // Si no hay internet o sesión, espera en una cola local y se manda sola.
  const A = () => global.WilanAgenda;
  const STORAGE_KEY = 'wilan_quote_inbox_v1';
  const SCHEMA = 'quote-inbox-command.v1';
  const MAX_PENDING = 200;
  const PERMANENT = new Set(['INVALID_COMMAND', 'WORKSPACE_ACCESS_DENIED', 'ROLE_NOT_ALLOWED', 'MEMBER_INACTIVE', 'INVALID_ARGUMENT']);
  let flushing = false;

  const emptyStore = () => ({ schema: 'quote-inbox-local-store.v1', pending: [], sent: 0, dropped: 0 });
  const readStore = () => {
    try {
      const value = JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || 'null');
      return value?.schema === 'quote-inbox-local-store.v1' && Array.isArray(value.pending) ? value : emptyStore();
    } catch (_) { return emptyStore(); }
  };
  const writeStore = (value) => {
    try { global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value)); } catch (_) { /* sin espacio: no bloquea el envío */ }
  };

  // El puente exige nombre o teléfono; aquí no existen. Se arma con un
  // marcador y luego se vacía el cliente: al CRM no viaja ningún dato personal.
  const buildCommand = (context, folio) => {
    const bridge = A()?.quoteToCrm;
    const config = A()?.config;
    if (!bridge?.buildPayload || !config?.workspaceId || !context) return null;
    const payload = bridge.buildPayload({
      ...context,
      ...(folio ? { folio: String(folio).replace(/^#/, '') } : {}),
      customer: { name: 'bandeja' },
    });
    if (!payload) return null;
    payload.customer = {};
    return {
      schema: SCHEMA,
      commandId: A().commands?.newCommandId?.() || `cmd_${Date.now().toString(36)}`,
      workspaceId: config.workspaceId,
      quoteId: payload.identity.quoteId,
      payload,
    };
  };

  const allowed = () => ['advisor', 'operator'].includes(A()?.auth?.getState?.()?.kind);

  const flush = async () => {
    if (flushing || !A()?.config?.quoteBridgeEnabled) return;
    if (global.navigator && global.navigator.onLine === false) return;
    if (!allowed()) return;
    const adapter = A().firebase?.adapter || (await A().firebase?.initialize?.().catch(() => null));
    if (!adapter?.call) return;
    flushing = true;
    try {
      for (;;) {
        const store = readStore();
        const next = store.pending[0];
        if (!next) break;
        try {
          await adapter.call('quoteToCrmCommand', { appId: A().config.appId, workspaceId: A().config.workspaceId, command: next.command });
          const after = readStore();
          after.pending = after.pending.filter((entry) => entry.command.commandId !== next.command.commandId);
          after.sent += 1;
          writeStore(after);
        } catch (error) {
          const code = A().commands?.classify?.(error)?.code || 'NETWORK_ERROR';
          const after = readStore();
          if (PERMANENT.has(code)) {
            after.pending = after.pending.filter((entry) => entry.command.commandId !== next.command.commandId);
            after.dropped += 1;
          } else {
            after.pending = after.pending.map((entry) => entry.command.commandId === next.command.commandId
              ? { ...entry, attempts: (entry.attempts || 0) + 1, lastError: code } : entry);
          }
          writeStore(after);
          if (!PERMANENT.has(code)) break; // red o servidor: se reintenta luego
        }
      }
    } finally {
      flushing = false;
    }
  };

  // Se llama justo después de abrir WhatsApp. Nunca lanza ni demora el envío.
  const record = (context, folio) => {
    try {
      const command = buildCommand(context, folio);
      if (!command) return false;
      const store = readStore();
      store.pending.push({ command, queuedAt: new Date().toISOString(), attempts: 0 });
      if (store.pending.length > MAX_PENDING) {
        store.dropped += store.pending.length - MAX_PENDING;
        store.pending = store.pending.slice(-MAX_PENDING);
      }
      writeStore(store);
      global.setTimeout?.(() => { void global.WilanAgenda.quoteInbox.flush(); }, 0);
      return true;
    } catch (_) {
      return false;
    }
  };

  const pendingCount = () => readStore().pending.length;

  // Línea discreta al final de la pantalla, para revisar el teléfono sin adivinar.
  const statusText = () => {
    const version = String(A()?.quoteToCrm?.RELEASE || '').replace('cotizador-v', 'Cotizador ');
    const pending = readStore().pending;
    if (!pending.length) return `${version} · Cotizaciones al CRM: al día`;
    const reason = global.navigator?.onLine === false ? 'sin internet'
      : !allowed() ? 'falta iniciar sesión en Agenda'
        : pending[0].lastError ? 'reintentando' : 'enviando';
    return `${version} · ${pending.length} por enviar al CRM · ${reason}`;
  };
  const renderStatus = () => {
    const doc = global.document;
    if (!doc?.createElement || !doc.body) return;
    let el = doc.getElementById('quote-inbox-status');
    if (!el) {
      el = doc.createElement('p');
      el.id = 'quote-inbox-status';
      el.style.cssText = 'margin:18px auto 90px;text-align:center;font-size:.75rem;color:#64748b;';
      doc.body.appendChild(el);
    }
    el.textContent = statusText();
  };
  const flushAndRender = async () => { renderStatus(); await flush(); renderStatus(); };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.quoteInbox = { STORAGE_KEY, SCHEMA, buildCommand, record, flush: flushAndRender, pendingCount, readStore, statusText };
  global.addEventListener?.('online', () => { void flushAndRender(); });
  global.addEventListener?.('offline', renderStatus);
  const start = () => {
    A()?.auth?.subscribe?.(() => { void flushAndRender(); });
  };
  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})(window);
