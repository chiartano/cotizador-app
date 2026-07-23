(function (global) {
  'use strict';

  const KEY = 'wilan_agenda_advisor_v1';
  const VERSION = 1;
  const MAX_DRAFTS = 20;
  const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const empty = () => ({ version: VERSION, drafts: [], quoteLinks: {}, lastView: 'agenda' });
  const read = () => {
    try {
      const value = JSON.parse(global.localStorage.getItem(KEY));
      if (!value || value.version !== VERSION || !Array.isArray(value.drafts)) return empty();
      const cutoff = Date.now() - MAX_AGE_MS;
      value.drafts = value.drafts.filter((item) => item.confirmed !== true && Date.parse(item.updatedAt) >= cutoff).slice(0, MAX_DRAFTS);
      value.quoteLinks = value.quoteLinks && typeof value.quoteLinks === 'object' ? value.quoteLinks : {};
      return value;
    } catch (_) { return empty(); }
  };
  const write = (value) => global.localStorage.setItem(KEY, JSON.stringify(value));
  const save = (draft) => {
    const store = read();
    const now = new Date().toISOString();
    const record = { ...draft, status: draft.status || 'pending', updatedAt: now, createdAt: draft.createdAt || now, confirmed: false };
    store.drafts = [record, ...store.drafts.filter((item) => item.commandId !== record.commandId)].slice(0, MAX_DRAFTS);
    write(store);
    return record;
  };
  const list = () => read().drafts;
  const remove = (commandId) => {
    const store = read();
    const target = store.drafts.find((item) => item.commandId === commandId);
    if (!target || target.confirmed || target.status !== 'pending') throw new Error('DRAFT_RESULT_MAY_EXIST');
    store.drafts = store.drafts.filter((item) => item.commandId !== commandId);
    write(store);
  };
  const confirm = (commandId, result, quoteId) => {
    const store = read();
    store.drafts = store.drafts.filter((item) => item.commandId !== commandId);
    if (quoteId) {
      store.quoteLinks[quoteId] = {
        appointmentId: result.appointmentId,
        initialCommandId: commandId,
        linkedAt: new Date().toISOString(),
        lastStatus: result.status,
        sync: result.deduplicated ? 'recovered' : 'confirmed'
      };
    }
    write(store);
  };
  const quoteLink = (quoteId) => read().quoteLinks[quoteId] || null;

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.pendingDrafts = { KEY, VERSION, save, list, remove, confirm, quoteLink, _read: read };
})(window);
