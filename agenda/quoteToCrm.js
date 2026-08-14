(function (global) {
  'use strict';

  const A = () => global.WilanAgenda;
  const STORAGE_KEY = 'wilan_quote_to_crm_v1';
  const ZERO_HASH = `sha256:${'0'.repeat(64)}`;
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const readStore = () => {
    try { return JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  };
  const writeStore = (value) => global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  const get = (quoteId) => readStore()[quoteId] || null;
  const save = (quoteId, value) => {
    const store = readStore(); store[quoteId] = clone(value); writeStore(store); return store[quoteId];
  };
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const integer = (value) => Math.max(0, Math.round(Number(value) || 0));
  const list = (values) => [...new Set(values.filter(Boolean).map((value) => text(value, 300)))];
  const rawAttributes = (raw = {}) => ({
    technicalVersion: 'cotizador-v7.15',
    ...(raw.ancho !== undefined ? { widthCm: raw.ancho } : {}),
    ...(raw.ancho2 !== undefined ? { secondaryWidthCm: raw.ancho2 } : {}),
    ...(raw.alto !== undefined ? { heightCm: raw.alto } : {}),
    ...(raw.espesor !== undefined ? { thickness: raw.espesor } : {}),
    ...(raw.sistema !== undefined ? { aluminumSystem: text(raw.sistema, 160) } : {}),
    ...(raw.config !== undefined ? { aluminumConfiguration: text(raw.config, 160) } : {}),
    ...(raw.led !== undefined ? { hasLed: Boolean(raw.led) } : {}),
    ...(raw.sandblasting !== undefined ? { hasSandblasting: Boolean(raw.sandblasting) } : {}),
  });
  const itemFrom = (item) => {
    const quantity = Math.max(1, Math.round(Number(item.cantidad) || 1));
    const totalPrice = integer(item.precio);
    const suppliedUnit = Number(item.precioUnitario);
    const unitPrice = Number.isSafeInteger(suppliedUnit) && suppliedUnit >= 0
      ? suppliedUnit : integer(totalPrice / quantity);
    return {
      description: text(item.producto || 'Producto cotizado', 300),
      quantity,
      measurements: text(item.medidas, 300),
      unitPrice, totalPrice,
      canonicalProductId: item.canonicalProductId == null ? null : text(item.canonicalProductId, 160),
      familyId: item.familyId == null ? null : text(item.familyId, 160),
      variantId: item.variantId == null ? null : text(item.variantId, 160),
      mappingStatus: ['map_with_attributes', 'map_with_variant', 'split_required', 'review_manual', 'unmapped'].includes(item.mappingStatus) ? item.mappingStatus : 'unmapped',
      canonicalAttributes: clone(item.canonicalAttributes || {}),
      ...(item.vidrio ? { glass: text(item.vidrio, 200) } : {}),
      ...(item.color ? { color: text(item.color, 200) } : {}),
      ...(item.observaciones ? { observations: text(item.observaciones, 2000) } : {}),
      addons: list([item.raw?.desmonte ? 'Desmonte' : '', item.raw?.acarreo ? 'Acarreo' : '']),
      rawAttributes: rawAttributes(item.raw || {}),
    };
  };
  const buildPayload = (context, capturedAt = new Date().toISOString()) => {
    if (!context || !Array.isArray(context.items) || context.items.length === 0 || !context.quoteId) return null;
    const items = context.items.slice(0, 100).map(itemFrom);
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const total = Math.min(subtotal, integer(context.total));
    const promotions = list(context.items.flatMap((item) => [
      item.raw?.promo_fija_corrediza_economica ? 'Promoción fija corrediza económica' : '',
      item.raw?.promoLabel || '',
    ]));
    const alerts = list(context.items.flatMap((item) => [
      item.mappingStatus === 'split_required' ? 'El producto requiere separación canónica' : '',
      item.mappingStatus === 'review_manual' ? 'El producto requiere revisión manual' : '',
      item.raw?.promoDescuentoIgnorado ? 'El descuento general no aplica a una promoción fija' : '',
    ]));
    return {
      schemaVersion: 'quote-to-crm.v1',
      identity: {
        workspaceId: A().config.workspaceId, quoteId: text(context.quoteId, 160),
        ...(context.folio ? { folio: text(String(context.folio).replace(/^#/, ''), 120) } : {}),
        source: 'cotizador', sourceVersion: 'cotizador-v7.15',
      },
      customer: {
        ...(context.customer?.name ? { name: text(context.customer.name, 160) } : {}),
        ...(context.customer?.phone ? { phone: text(context.customer.phone, 80) } : {}),
        ...(context.customer?.address ? { address: text(context.customer.address, 500) } : {}),
        ...(context.customer?.project ? { project: text(context.customer.project, 500) } : {}),
      },
      quote: {
        quotedAt: capturedAt, currency: 'COP', subtotal, discount: subtotal - total, total,
        promotions, alerts,
      },
      items,
    };
  };
  const prepare = (context) => {
    const existing = get(context?.quoteId);
    if (existing) return existing;
    const payload = buildPayload(context);
    if (!payload) return null;
    return save(context.quoteId, {
      schema: 'quote-to-crm-local.v1', commandId: A().commands.newCommandId(),
      quoteId: context.quoteId, status: 'pending', payload,
    });
  };
  const send = async (context) => {
    const pending = prepare(context);
    if (!pending) return { ok: false, error: { code: 'INVALID_QUOTE', uncertain: false, message: 'La cotización no tiene datos suficientes.' } };
    if (pending.status === 'sent') return { ok: true, result: pending.receipt, deduplicated: true };
    if (global.navigator && global.navigator.onLine === false) {
      save(pending.quoteId, { ...pending, status: 'pending' });
      return { ok: false, error: { code: 'OFFLINE', uncertain: true, message: 'Pendiente de conexión. Reintenta sin cambiar la cotización.' } };
    }
    const adapter = A().firebase?.adapter;
    if (!adapter?.call) return { ok: false, error: { code: 'NETWORK_ERROR', uncertain: true, message: 'No recibimos confirmación. Reintenta el mismo envío.' } };
    save(pending.quoteId, { ...pending, status: 'sending' });
    try {
      const result = await adapter.call('quoteToCrmCommand', {
        appId: A().config.appId, workspaceId: A().config.workspaceId,
        command: {
          schema: 'quote-to-crm-command.v1', commandId: pending.commandId,
          workspaceId: A().config.workspaceId, quoteId: pending.quoteId,
          payloadHash: ZERO_HASH, payload: pending.payload,
        },
      });
      save(pending.quoteId, { ...pending, status: 'sent', receipt: result });
      return { ok: true, result };
    } catch (error) {
      const classified = A().commands.classify(error);
      save(pending.quoteId, { ...pending, status: classified.uncertain ? 'unknown' : 'pending', lastError: classified.code });
      return { ok: false, error: classified };
    }
  };

  const ui = { lock: false };
  const context = () => global.WilanCotizadorAgendaBridge?.getQuoteContext?.();
  const stateCopy = (record) => {
    if (!record) return '';
    if (record.status === 'sent') return record.receipt?.status === 'review_required'
      ? 'Recibida; el Operator debe revisar clientes duplicados.' : 'Enviada al CRM.';
    if (record.status === 'sending') return 'Enviando…';
    if (record.status === 'unknown') return 'Sin confirmación; reintenta el mismo envío.';
    return 'Pendiente de enviar.';
  };
  const refresh = () => {
    const button = global.document?.querySelector?.('[data-quote-crm-action="send"]');
    const message = global.document?.querySelector?.('#quote-crm-status');
    const quote = context();
    const record = quote?.quoteId ? get(quote.quoteId) : null;
    if (!button) return;
    button.hidden = !quote || !A().config.quoteBridgeEnabled;
    button.disabled = ui.lock || record?.status === 'sending' || record?.status === 'sent';
    button.textContent = record?.status === 'sent' ? 'Ya enviada al CRM' : record?.status === 'unknown' ? 'Reintentar envío al CRM' : 'Enviar al CRM';
    if (message) message.textContent = stateCopy(record);
  };
  const initializeUi = () => {
    const action = global.document?.querySelector?.('#agenda-quote-action');
    if (!action || action.querySelector('[data-quote-crm-action="send"]')) return;
    const button = global.document.createElement('button');
    button.type = 'button'; button.dataset.quoteCrmAction = 'send'; button.className = 'quote-crm-button'; button.textContent = 'Enviar al CRM';
    const message = global.document.createElement('span'); message.id = 'quote-crm-status'; message.className = 'quote-crm-status';
    action.append(button, message);
    button.addEventListener('click', async () => {
      if (ui.lock) return;
      ui.lock = true; refresh();
      const result = await send(context());
      ui.lock = false; refresh();
      if (!result.ok && message) message.textContent = result.error.message;
    });
    global.addEventListener('wilan:quote-ready', refresh);
    global.addEventListener('online', refresh);
    refresh();
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.quoteToCrm = { STORAGE_KEY, ZERO_HASH, rawAttributes, itemFrom, buildPayload, prepare, send, get, save, refresh, initializeUi };
  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', initializeUi, { once: true });
  else if (global.document) initializeUi();
})(window);
