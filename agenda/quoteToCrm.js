(function (global) {
  'use strict';

  const A = () => global.WilanAgenda;
  const RELEASE = 'cotizador-v7.17';
  const STORAGE_KEY = 'wilan_quote_to_crm_v2';
  const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{2,159}$/;
  const MAPPING = new Set(['map_with_attributes', 'map_with_variant', 'split_required', 'review_manual', 'unmapped']);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const object = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const text = (value, max) => String(value ?? '').trim().slice(0, max);
  const money = (value) => {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return null;
    const rounded = Math.round(number);
    return Number.isSafeInteger(rounded) ? rounded : null;
  };
  const list = (values) => [...new Set(values.filter(Boolean).map((value) => text(value, 300)))];
  const emptyStore = () => ({ schema: 'quote-to-crm-local-store.v2', intents: {}, latestByQuote: {} });
  const readStore = () => {
    try {
      const value = JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || 'null');
      return value?.schema === 'quote-to-crm-local-store.v2' && object(value.intents) && object(value.latestByQuote)
        ? value : emptyStore();
    } catch (_) { return emptyStore(); }
  };
  const writeStore = (value) => global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  const get = (quoteId) => {
    const store = readStore();
    const commandId = store.latestByQuote[quoteId];
    return commandId ? clone(store.intents[commandId] || null) : null;
  };
  const save = (record) => {
    const store = readStore();
    store.intents[record.commandId] = clone(record);
    store.latestByQuote[record.quoteId] = record.commandId;
    writeStore(store);
    return clone(store.intents[record.commandId]);
  };
  const rawAttributes = (raw = {}) => ({
    technicalVersion: RELEASE,
    ...(raw.ancho !== undefined ? { widthCm: raw.ancho } : {}),
    ...(raw.ancho2 !== undefined ? { secondaryWidthCm: raw.ancho2 } : {}),
    ...(raw.alto !== undefined ? { heightCm: raw.alto } : {}),
    ...(raw.espesor !== undefined ? { thickness: raw.espesor } : {}),
    ...(raw.sistema !== undefined ? { aluminumSystem: text(raw.sistema, 160) } : {}),
    ...(raw.config !== undefined ? { aluminumConfiguration: text(raw.config, 160) } : {}),
    ...(raw.led !== undefined ? { hasLed: Boolean(raw.led) } : {}),
    ...(raw.sandblasting !== undefined ? { hasSandblasting: Boolean(raw.sandblasting) } : {}),
  });

  const isQuoteBridgeEligible = (context) => Boolean(
    object(context)
    && ID.test(String(context.quoteId || ''))
    && Array.isArray(context.items) && context.items.length >= 1 && context.items.length <= 100
    && (text(context.customer?.name, 160) || text(context.customer?.phone, 80))
    && [context.subtotal, context.discount, context.total].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0)
    && Math.abs((context.subtotal - context.discount) - context.total) < 0.000001
    && Math.abs(context.items.reduce((sum, item) => sum + Number(item?.precio || 0), 0) - context.subtotal) < 0.000001
    && context.items.every((item) => object(item)
      && text(item.producto, 300)
      && text(item.medidas, 300)
      && Number.isInteger(item.cantidad) && item.cantidad >= 1 && item.cantidad <= 1000
      && typeof item.precio === 'number' && Number.isFinite(item.precio) && item.precio >= 0
      && object(item.raw) && object(item.shareInputSnapshot)
      && MAPPING.has(item.mappingStatus) && object(item.canonicalAttributes))
  );

  const itemFrom = (item) => {
    const quantity = Number(item.cantidad);
    const calculatedTotalPrice = Number(item.precio);
    const displayTotalPrice = money(calculatedTotalPrice);
    const suppliedUnit = Number(item.precioUnitario);
    const unitPrice = Number.isSafeInteger(suppliedUnit) && suppliedUnit >= 0
      ? suppliedUnit : money(calculatedTotalPrice / quantity);
    return {
      description: text(item.producto, 300), quantity, measurements: text(item.medidas, 300),
      unitPrice, totalPrice: displayTotalPrice, displayTotalPrice, calculatedTotalPrice,
      canonicalProductId: item.canonicalProductId == null ? null : text(item.canonicalProductId, 160),
      familyId: item.familyId == null ? null : text(item.familyId, 160),
      variantId: item.variantId == null ? null : text(item.variantId, 160),
      mappingStatus: item.mappingStatus,
      canonicalAttributes: clone(item.canonicalAttributes),
      ...(item.vidrio ? { glass: text(item.vidrio, 200) } : {}),
      ...(item.color ? { color: text(item.color, 200) } : {}),
      ...(item.observaciones ? { observations: text(item.observaciones, 2000) } : {}),
      addons: list([item.raw.desmonte ? 'Desmonte' : '', item.raw.acarreo ? 'Acarreo' : '']),
      rawAttributes: rawAttributes(item.raw),
    };
  };

  const buildPayload = (context, capturedAt = new Date().toISOString()) => {
    if (!isQuoteBridgeEligible(context)) return null;
    const total = money(context.total);
    const discount = money(context.discount);
    if (total === null || discount === null || !Number.isSafeInteger(total + discount)) return null;
    const subtotal = total + discount;
    const items = context.items.map(itemFrom);
    if (items.some((item) => item.totalPrice === null || item.unitPrice === null)) return null;
    const promotions = list(context.items.flatMap((item) => [
      item.raw.promo_fija_corrediza_economica ? 'Promoción fija corrediza económica' : '',
      item.raw.promoLabel || '',
    ]));
    const alerts = list(context.items.flatMap((item) => [
      item.mappingStatus === 'split_required' ? 'El producto requiere separación canónica' : '',
      item.mappingStatus === 'review_manual' ? 'El producto requiere revisión manual' : '',
      item.raw.promoDescuentoIgnorado ? 'El descuento general no aplica a una promoción fija' : '',
    ]));
    return {
      schemaVersion: 'quote-to-crm.v1.1',
      identity: {
        workspaceId: A().config.workspaceId, quoteId: text(context.quoteId, 160),
        ...(context.folio ? { folio: text(String(context.folio).replace(/^#/, ''), 120) } : {}),
        source: 'cotizador', sourceVersion: RELEASE,
      },
      customer: {
        ...(context.customer?.name ? { name: text(context.customer.name, 160) } : {}),
        ...(context.customer?.phone ? { phone: text(context.customer.phone, 80) } : {}),
        ...(context.customer?.address ? { address: text(context.customer.address, 500) } : {}),
        ...(context.customer?.project ? { project: text(context.customer.project, 500) } : {}),
      },
      quote: {
        quotedAt: capturedAt, currency: 'COP', subtotal, discount, total,
        moneySemantics: 'display-lines-independent-total.v1', promotions, alerts,
      },
      items,
    };
  };

  const canonicalize = (value) => {
    if (Array.isArray(value)) return value.map(canonicalize);
    if (object(value)) return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = canonicalize(value[key]);
      return result;
    }, {});
    return value;
  };
  const sha256 = async (value) => {
    const bytes = new TextEncoder().encode(JSON.stringify(canonicalize(value)));
    const digest = await global.crypto.subtle.digest('SHA-256', bytes);
    return `sha256:${[...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  };
  const hashesFor = async (payload) => {
    const content = clone(payload); delete content.quote.quotedAt;
    return {
      contentHash: await sha256(content),
      payloadHash: await sha256({ payload, quoteId: payload.identity.quoteId, schema: 'quote-to-crm-command.v1', workspaceId: payload.identity.workspaceId }),
    };
  };

  const prepare = async (context) => {
    const payload = buildPayload(context);
    if (!payload) return null;
    const hashes = await hashesFor(payload);
    const existing = get(context.quoteId);
    if (existing?.contentHash === hashes.contentHash) return existing;
    if (existing && ['pending', 'sending', 'unknown'].includes(existing.status)) return existing;
    return save({
      schema: 'quote-to-crm-local.v2', commandId: A().commands.newCommandId(),
      quoteId: context.quoteId, status: 'pending', payload, ...hashes,
    });
  };

  const send = async (context) => {
    const pending = await prepare(context);
    if (!pending) return { ok: false, error: { code: 'INVALID_QUOTE', uncertain: false, message: 'Esta cotización no contiene toda la información necesaria para enviarla al CRM.' } };
    if (pending.status === 'sent') return { ok: true, result: pending.receipt, deduplicated: true };
    if (global.navigator && global.navigator.onLine === false) {
      save({ ...pending, status: 'pending' });
      return { ok: false, error: { code: 'OFFLINE', uncertain: true, message: 'Pendiente de conexión. Reintenta sin cambiar la cotización.' } };
    }
    const adapter = A().firebase?.adapter;
    if (!adapter?.call) return { ok: false, error: { code: 'NETWORK_ERROR', uncertain: true, message: 'No recibimos confirmación. Reintenta el mismo envío.' } };
    save({ ...pending, status: 'sending' });
    try {
      const result = await adapter.call('quoteToCrmCommand', {
        appId: A().config.appId, workspaceId: A().config.workspaceId,
        command: {
          schema: 'quote-to-crm-command.v1', commandId: pending.commandId,
          workspaceId: A().config.workspaceId, quoteId: pending.quoteId,
          payloadHash: pending.payloadHash, payload: pending.payload,
        },
      });
      save({ ...pending, status: 'sent', receipt: result });
      return { ok: true, result };
    } catch (error) {
      const classified = A().commands.classify(error);
      save({ ...pending, status: classified.uncertain ? 'unknown' : 'pending', lastError: classified.code });
      return { ok: false, error: classified };
    }
  };

  const ui = { lock: false, revision: 0 };
  const context = () => global.WilanCotizadorAgendaBridge?.getQuoteContext?.();
  const stateCopy = (record) => {
    if (!record) return '';
    if (record.status === 'sent') return record.receipt?.status === 'review_required'
      ? 'Recibida; el Operator debe revisar clientes duplicados.' : 'Enviada al CRM.';
    if (record.status === 'sending') return 'Enviando…';
    if (record.status === 'unknown') return 'Sin confirmación; reintenta el mismo envío.';
    return 'Pendiente de enviar.';
  };
  const refresh = async () => {
    const revision = ++ui.revision;
    const button = global.document?.querySelector?.('[data-quote-crm-action="send"]');
    const message = global.document?.querySelector?.('#quote-crm-status');
    const quote = context();
    if (!button) return;
    const eligible = isQuoteBridgeEligible(quote);
    const record = quote?.quoteId ? get(quote.quoteId) : null;
    let changed = false;
    if (eligible && record) {
      const payload = buildPayload(quote, record.payload.quote.quotedAt);
      changed = (await hashesFor(payload)).contentHash !== record.contentHash;
    }
    if (revision !== ui.revision) return;
    button.hidden = !quote || !A().config.quoteBridgeEnabled;
    button.disabled = ui.lock || !eligible || record?.status === 'sending' || (record?.status === 'sent' && !changed);
    button.textContent = !eligible ? 'No disponible para CRM'
      : record?.status === 'sent' && !changed ? 'Ya enviado al CRM'
        : changed && ['pending', 'unknown'].includes(record?.status) ? 'Reintentar envío anterior'
          : changed ? 'Enviar cambios al CRM'
            : record?.status === 'unknown' ? 'Reintentar envío al CRM' : 'Enviar al CRM';
    if (message) message.textContent = !eligible
      ? 'Esta cotización antigua no contiene toda la información necesaria para enviarla al CRM.'
      : changed && ['pending', 'unknown'].includes(record?.status)
        ? 'La cotización cambió; primero se reintentará la intención anterior congelada.'
        : changed ? 'La cotización cambió. Envía los cambios para crear una intención nueva.' : stateCopy(record);
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
      ui.lock = true; await refresh();
      const result = await send(context());
      ui.lock = false; await refresh();
      if (!result.ok && message) message.textContent = result.error.message;
    });
    global.addEventListener('wilan:quote-ready', () => { void refresh(); });
    global.addEventListener('online', () => { void refresh(); });
    void refresh();
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.quoteToCrm = { STORAGE_KEY, RELEASE, rawAttributes, isQuoteBridgeEligible, itemFrom, buildPayload, hashesFor, prepare, send, get, save, refresh, initializeUi };
  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', initializeUi, { once: true });
  else if (global.document) initializeUi();
})(window);
