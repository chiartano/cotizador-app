(function (global) {
  'use strict';

  const A = () => global.WilanAgenda;
  const STORAGE_KEY = 'wilan_quote_intake_v1';
  const KINDS = Object.freeze({
    contact_call: 'Llamar o contactar',
    wait_response: 'Esperar respuesta',
    visit_measure: 'Visita o medición',
    requote: 'Volver a cotizar',
    other_followup: 'Otro seguimiento',
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const todayPlus = (days = 1) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date.toLocaleDateString('en-CA');
  };
  const emptyStore = () => ({ schema: 'quote-intake-local-store.v1', byQuoteCommand: {} });
  const readStore = () => {
    try {
      const value = JSON.parse(global.localStorage?.getItem(STORAGE_KEY) || 'null');
      return value?.schema === 'quote-intake-local-store.v1' && value.byQuoteCommand ? value : emptyStore();
    } catch (_) { return emptyStore(); }
  };
  const writeStore = (value) => global.localStorage?.setItem(STORAGE_KEY, JSON.stringify(value));
  const getByQuoteCommand = (quoteCommandId) => clone(readStore().byQuoteCommand[quoteCommandId] || null);
  const save = (record) => {
    const store = readStore();
    store.byQuoteCommand[record.quoteCommandId] = clone(record);
    writeStore(store);
    return clone(record);
  };
  const currentContext = () => global.WilanCotizadorAgendaBridge?.getQuoteContext?.() || null;
  const quoteRecord = (quoteId) => A().quoteToCrm?.get?.(quoteId) || null;
  const current = () => {
    const context = currentContext();
    const quote = context?.quoteId ? quoteRecord(context.quoteId) : null;
    return { context, quote, intake: quote?.commandId ? getByQuoteCommand(quote.commandId) : null };
  };
  const isComplete = (quoteId) => {
    const quote = quoteRecord(quoteId);
    return quote?.commandId ? getByQuoteCommand(quote.commandId)?.status === 'recorded' : false;
  };
  const isAwaitingVisit = (quoteId) => {
    const quote = quoteRecord(quoteId);
    const intake = quote?.commandId ? getByQuoteCommand(quote.commandId) : null;
    return intake?.status === 'awaiting_appointment' && intake.action?.kind === 'visit_measure';
  };

  const send = async (record) => {
    if (!record?.action || record.status === 'recorded') return { ok: record?.status === 'recorded' };
    const quote = quoteRecord(record.quoteId);
    if (!await A().quoteToCrm?.matchesCurrent?.(currentContext(), quote)) {
      return { ok: false, error: { code: 'QUOTE_CHANGED', uncertain: false, message: 'La cotización cambió. Envía esos cambios al CRM antes de definir la próxima acción.' } };
    }
    if (global.navigator?.onLine === false) {
      save({ ...record, status: 'pending', message: 'Pendiente de conexión. Reintenta cuando tengas red.' });
      refresh();
      return { ok: false, error: { code: 'OFFLINE' } };
    }
    const adapter = A().firebase?.adapter;
    if (!adapter?.call) return { ok: false, error: { code: 'NETWORK_ERROR' } };
    save({ ...record, status: 'sending', message: 'Guardando próxima acción…' });
    refresh();
    try {
      const result = await adapter.call('quoteIntakeActionCommand', {
        appId: A().config.appId,
        workspaceId: A().config.workspaceId,
        command: {
          schema: 'quote-intake-action-command.v1', commandId: record.commandId,
          workspaceId: A().config.workspaceId, quoteCommandId: record.quoteCommandId,
          action: record.action,
        },
      });
      save({ ...record, status: 'recorded', receipt: result, message: 'Terminado' });
      refresh();
      return { ok: true, result };
    } catch (error) {
      const classified = A().commands.classify(error);
      save({ ...record, status: classified.uncertain ? 'unknown' : 'pending', message: classified.message });
      refresh();
      return { ok: false, error: classified };
    }
  };

  const prepare = (quote, action, status = 'pending') => {
    const existing = getByQuoteCommand(quote.commandId);
    if (existing) return existing;
    return save({
      schema: 'quote-intake-local.v1', commandId: A().commands.newCommandId(),
      quoteCommandId: quote.commandId, quoteId: quote.quoteId, action, status,
    });
  };

  const attachAppointment = async (quoteId, appointmentId) => {
    const quote = quoteRecord(quoteId);
    if (!quote?.commandId || quote.status !== 'sent' || quote.receipt?.status !== 'received') return { ok: false };
    const existing = getByQuoteCommand(quote.commandId);
    if (!existing || existing.action?.kind !== 'visit_measure' || existing.status === 'recorded') return { ok: false };
    const record = save({ ...existing, action: { kind: 'visit_measure', appointmentId }, status: 'pending' });
    return send(record);
  };

  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]));
  const dateLabel = (value) => {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  const ensureRoot = () => {
    const action = global.document?.querySelector?.('#agenda-quote-action');
    if (!action) return null;
    let root = action.querySelector('#quote-intake-root');
    if (!root) {
      root = global.document.createElement('section');
      root.id = 'quote-intake-root';
      root.className = 'quote-intake-root';
      action.append(root);
    }
    return root;
  };

  const renderForm = (root, quote, message = '') => {
    root.innerHTML = `<div class="quote-intake-card">
      <strong>Próxima acción</strong>
      <label>¿Qué sigue?<select data-intake="kind">${Object.entries(KINDS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>
      <div data-intake-fields>
        <label>Fecha<input data-intake="date" type="date" value="${todayPlus(1)}" min="${todayPlus(0)}"></label>
        <small data-intake-date-label>${esc(dateLabel(todayPlus(1)))}</small>
        <label class="quote-intake-check"><input data-intake="has-time" type="checkbox"> Agregar hora</label>
        <label data-intake-time hidden>Hora<input data-intake="time" type="time" value="09:00"></label>
        <label data-intake-note hidden>Nota breve<textarea data-intake="note" maxlength="300" rows="2"></textarea></label>
      </div>
      <button type="button" class="quote-crm-button" data-intake="submit">Guardar próxima acción</button>
      <span class="quote-crm-status" data-intake-message>${esc(message)}</span>
    </div>`;
    const kind = root.querySelector('[data-intake="kind"]');
    const fields = root.querySelector('[data-intake-fields]');
    const date = root.querySelector('[data-intake="date"]');
    const hasTime = root.querySelector('[data-intake="has-time"]');
    const timeLabel = root.querySelector('[data-intake-time]');
    const noteLabel = root.querySelector('[data-intake-note]');
    const sync = () => {
      const visit = kind.value === 'visit_measure';
      fields.hidden = visit;
      noteLabel.hidden = kind.value !== 'other_followup';
      timeLabel.hidden = !hasTime.checked;
      root.querySelector('[data-intake="submit"]').textContent = visit ? 'Agendar visita en Agenda' : 'Guardar próxima acción';
    };
    kind.addEventListener('change', sync);
    hasTime.addEventListener('change', sync);
    date.addEventListener('change', () => { root.querySelector('[data-intake-date-label]').textContent = dateLabel(date.value); });
    root.querySelector('[data-intake="submit"]').addEventListener('click', async () => {
      const messageNode = root.querySelector('[data-intake-message]');
      if (!await A().quoteToCrm?.matchesCurrent?.(currentContext(), quote)) {
        messageNode.textContent = 'La cotización cambió. Envía esos cambios al CRM antes de continuar.';
        return;
      }
      if (kind.value === 'visit_measure') {
        const record = prepare(quote, { kind: 'visit_measure' }, 'awaiting_appointment');
        const link = A().pendingDrafts?.quoteLink?.(quote.quoteId);
        if (link?.appointmentId) {
          messageNode.textContent = 'Vinculando la cita existente…';
          await attachAppointment(quote.quoteId, link.appointmentId);
        } else {
          messageNode.textContent = 'Completa la fecha y horario en Agenda.';
          A().ui?.openForm?.(currentContext());
        }
        return;
      }
      const note = root.querySelector('[data-intake="note"]').value.trim();
      if (!date.value || (kind.value === 'other_followup' && note.length < 3)) {
        messageNode.textContent = kind.value === 'other_followup' ? 'Escribe una nota breve.' : 'Selecciona una fecha.';
        return;
      }
      const action = { kind: kind.value, date: date.value, ...(hasTime.checked ? { time: root.querySelector('[data-intake="time"]').value } : {}), ...(note ? { note } : {}) };
      await send(prepare(quote, action));
    });
    sync();
  };

  const refresh = () => {
    const root = ensureRoot();
    if (!root) return;
    const { quote, intake } = current();
    if (!quote || quote.status !== 'sent') { root.hidden = true; root.innerHTML = ''; return; }
    root.hidden = false;
    if (quote.receipt?.status === 'review_required') {
      root.innerHTML = '<div class="quote-intake-card"><strong>Enviado al CRM</strong><span>El Operator debe revisar los clientes coincidentes antes de definir la próxima acción.</span></div>';
      return;
    }
    if (intake?.status === 'recorded') {
      root.innerHTML = `<div class="quote-intake-card quote-intake-complete"><strong>Enviado al CRM</strong><span>${esc(KINDS[intake.action.kind])} · Terminado</span></div>`;
      return;
    }
    if (intake?.status === 'awaiting_appointment') {
      root.innerHTML = '<div class="quote-intake-card"><strong>Próxima acción</strong><span>Completa la visita en Agenda para terminar.</span><button type="button" class="quote-crm-button" data-intake-resume>Continuar en Agenda</button></div>';
      root.querySelector('[data-intake-resume]').addEventListener('click', () => A().ui?.openForm?.(currentContext()));
      return;
    }
    if (intake && ['pending', 'unknown', 'sending'].includes(intake.status)) {
      root.innerHTML = `<div class="quote-intake-card"><strong>Próxima acción</strong><span>${esc(intake.message || 'Pendiente de confirmar.')}</span><button type="button" class="quote-crm-button" data-intake-retry ${intake.status === 'sending' ? 'disabled' : ''}>Reintentar</button></div>`;
      root.querySelector('[data-intake-retry]')?.addEventListener('click', () => { void send(intake); });
      return;
    }
    renderForm(root, quote);
  };

  const initialize = () => {
    refresh();
    global.addEventListener('wilan:quote-ready', refresh);
    global.addEventListener('wilan:quote-to-crm-changed', refresh);
    global.addEventListener('online', () => {
      const { intake } = current();
      if (intake && ['pending', 'unknown'].includes(intake.status)) void send(intake);
      else refresh();
    });
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.intake = { STORAGE_KEY, KINDS, getByQuoteCommand, save, prepare, send, attachAppointment, isComplete, isAwaitingVisit, refresh, initialize, _dateLabel: dateLabel };
  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else if (global.document) initialize();
})(window);
