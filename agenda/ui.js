(function (global) {
  'use strict';

  const A = () => global.WilanAgenda;
  const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
  const nextBusinessDay = () => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    while ([0].includes(date.getDay())) date.setDate(date.getDate() + 1);
    return date.toLocaleDateString('en-CA');
  };
  const initialForm = () => ({
    step: 1, quote: null, direct: true, name: '', phone: '', address: '',
    need: 'bath_partition', detail: '', type: 'measure_visit', date: nextBusinessDay(),
    block: '09:00', durationMinutes: 120, feeMode: 'informed', feeAmount: 20000,
    note: '', sending: false, message: '', messageKind: ''
  });
  let form = initialForm();
  let root = null;
  let agendaOpen = false;
  let authState = { kind: 'unauthenticated' };
  let queryState = { appointments: [], overrides: [], loading: false };

  const authCopy = (kind) => ({
    loading: 'Preparando acceso seguro…', signing_in: 'Abriendo acceso Google…',
    checking_membership: 'Verificando tu membresía…', unauthenticated: 'Inicia sesión para usar Agenda.',
    no_membership: 'Tu cuenta no tiene membresía en wilan-main.',
    invalid_membership: 'La membresía no cumple el esquema de seguridad.',
    inactive: 'Tu membresía está inactiva.', network_error: 'No fue posible verificar el acceso.'
  }[kind] || 'Acceso no disponible.');
  const allowed = () => ['advisor', 'operator'].includes(authState.kind);
  const bridgeContext = () => global.WilanCotizadorAgendaBridge?.getQuoteContext?.() || null;
  const short = (value, limit = 120) => String(value || '').slice(0, limit);

  const shell = () => {
    const container = document.createElement('div');
    container.id = 'agenda-advisor-root';
    container.innerHTML = `
      <button id="agenda-header-button" class="agenda-header-button" type="button" aria-label="Abrir Agenda">Agenda</button>
      <div id="agenda-quote-action" class="agenda-quote-action" hidden>
        <button type="button" data-agenda-action="quote">Agendar esta cotización</button>
        <span id="agenda-quote-link"></span>
      </div>
      <div id="agenda-drawer" class="agenda-drawer" hidden aria-hidden="true">
        <div class="agenda-backdrop" data-agenda-action="close"></div>
        <section class="agenda-panel" role="dialog" aria-modal="true" aria-labelledby="agenda-title">
          <header class="agenda-panel-header">
            <div><small>Agenda Compartida</small><h2 id="agenda-title">Agenda comercial</h2></div>
            <button type="button" class="agenda-icon-button" data-agenda-action="close" aria-label="Cerrar Agenda">×</button>
          </header>
          <div id="agenda-content" class="agenda-content"></div>
        </section>
      </div>
      <div id="agenda-form-layer" class="agenda-drawer" hidden aria-hidden="true">
        <div class="agenda-backdrop" data-agenda-action="form-close"></div>
        <section class="agenda-form-panel" role="dialog" aria-modal="true" aria-labelledby="agenda-form-title">
          <header class="agenda-panel-header">
            <div><small>Dos pasos</small><h2 id="agenda-form-title">Nueva cita</h2></div>
            <button type="button" class="agenda-icon-button" data-agenda-action="form-close" aria-label="Cerrar formulario">×</button>
          </header>
          <form id="agenda-form" class="agenda-form" novalidate></form>
        </section>
      </div>`;
    document.body.appendChild(container);
    const headerActions = document.querySelector('header > div');
    if (headerActions) headerActions.prepend(container.querySelector('#agenda-header-button'));
    const result = document.querySelector('#quote-summary') || document.querySelector('#resultado-panel .card');
    if (result) result.appendChild(container.querySelector('#agenda-quote-action'));
    return container;
  };

  const renderAuth = () => {
    const content = root.querySelector('#agenda-content');
    const identity = authState.user?.email ? `<p class="agenda-muted">${esc(authState.user.email)}</p>` : '';
    content.innerHTML = `<div class="agenda-empty"><h3>${esc(authCopy(authState.kind))}</h3>${identity}
      ${authState.kind === 'unauthenticated' || authState.kind === 'network_error'
        ? '<button type="button" class="agenda-primary" data-agenda-action="login">Iniciar sesión con Google</button>' : ''}
      ${authState.user ? '<button type="button" class="agenda-secondary" data-agenda-action="logout">Cerrar sesión</button>' : ''}
    </div>`;
  };
  const card = (appointment) => {
    const f = A().formatters;
    const quote = appointment.quoteRef?.quoteId ? `<span class="agenda-chip">Cotización ${esc(appointment.quoteRef.folio || appointment.quoteRef.quoteId)}</span>` : '';
    const alternative = appointment.status === 'alternative_proposed'
      ? '<p class="agenda-warning">Operator propuso alternativas. Coordina con operator; este contrato no permite que advisor las acepte.</p>' : '';
    const canReschedule = appointment.type === 'measure_visit'
      && !f.terminal(appointment) && appointment.operationsReview?.status !== 'pending';
    const canInform = appointment.type === 'measure_visit'
      && appointment.visitFee?.applicability === 'applies'
      && appointment.visitFee?.disclosure?.status === 'not_informed';
    const canCommunicate = ['ready', 'needs_recommunication'].includes(appointment.communication?.status);
    const generalReason = f.reason(appointment);
    return `<article class="agenda-card" data-appointment-id="${esc(appointment.id || appointment.appointmentId)}">
      <div class="agenda-card-top"><strong>${esc(f.types[appointment.type] || appointment.type)}</strong><span>${esc(f.status[appointment.status] || appointment.status)}</span></div>
      <h3>${esc(appointment.contact?.name || 'Cliente sin nombre')}</h3>
      <p>${esc(appointment.contact?.phone || '')} · ${esc(short(appointment.location?.addressText))}</p>
      <p>${esc(f.needs[appointment.customerNeed?.category] || appointment.customerNeed?.detail || 'Necesidad por precisar')}</p>
      <p><strong>${esc(f.dateTime(appointment.schedule?.startAt))}</strong> · ${esc(appointment.durationMinutes)} min</p>
      <div class="agenda-chips">${quote}<span class="agenda-chip">Costo: ${esc(f.fee(appointment.visitFee))}</span><span class="agenda-chip">${esc(f.communication(appointment.communication))}</span></div>
      ${generalReason ? `<p class="agenda-muted">Motivo: ${esc(short(generalReason, 240))}</p>` : ''}
      ${appointment.immutableQuoteSnapshot?.items?.length ? `<details><summary>Contexto cotizado</summary><p>${appointment.immutableQuoteSnapshot.items.map((item) => `${esc(item.productLabel)} · ${esc(item.measurements || '')} · ${esc(f.money(item.totalPrice))}`).join('<br>')}</p></details>` : ''}
      ${alternative}
      <div class="agenda-card-actions">
        ${canInform ? `<button type="button" data-agenda-action="inform-fee" data-id="${esc(appointment.id)}">Informar costo</button>` : ''}
        ${canCommunicate ? `<button type="button" data-agenda-action="communicate" data-id="${esc(appointment.id)}">Marcar comunicación</button>` : ''}
        ${canReschedule ? `<button type="button" data-agenda-action="reschedule" data-id="${esc(appointment.id)}">Reprogramar medida</button>` : ''}
      </div>
    </article>`;
  };
  const section = (title, items, empty) => `<section class="agenda-section"><div class="agenda-section-title"><h3>${title}</h3><span>${items.length}</span></div>${items.length ? items.map(card).join('') : `<p class="agenda-muted">${empty}</p>`}</section>`;
  const renderAgenda = () => {
    if (!allowed()) return renderAuth();
    const content = root.querySelector('#agenda-content');
    const f = A().formatters;
    const appointments = [...queryState.appointments];
    const now = Date.now();
    const response = appointments.filter(f.requiresResponse);
    const upcoming = appointments.filter((item) => !f.terminal(item) && (f.asDate(item.schedule?.startAt)?.getTime() || 0) >= now)
      .sort((a, b) => (f.asDate(a.schedule?.startAt)?.getTime() || 0) - (f.asDate(b.schedule?.startAt)?.getTime() || 0));
    const recent = appointments.filter((item) => f.terminal(item) || (f.asDate(item.schedule?.startAt)?.getTime() || 0) < now).slice(-12).reverse();
    const drafts = A().pendingDrafts.list();
    content.innerHTML = `<div class="agenda-profile"><div><strong>Perfil ${esc(authState.kind)}</strong><small>${esc(authState.user?.email || '')}</small></div><button type="button" data-agenda-action="logout">Salir</button></div>
      <div class="agenda-toolbar"><button type="button" class="agenda-primary" data-agenda-action="direct">Nueva cita</button><span>${appointments.length} citas compartidas</span></div>
      ${drafts.length ? `<section class="agenda-section"><div class="agenda-section-title"><h3>Pendientes de enviar</h3><span>${drafts.length}</span></div>${drafts.map((draft) => `<article class="agenda-draft"><div><strong>${esc(draft.form?.name || draft.form?.phone || 'Cita pendiente')}</strong><small>${['unknown', 'sending'].includes(draft.status) ? 'Resultado no confirmado; no puede eliminarse' : 'Nunca enviado; guardado en este dispositivo'}</small></div><button type="button" data-agenda-action="retry" data-command="${esc(draft.commandId)}">Reintentar</button>${draft.status === 'pending' ? `<button type="button" data-agenda-action="delete-draft" data-command="${esc(draft.commandId)}">Eliminar</button>` : ''}</article>`).join('')}</section>` : ''}
      ${section('Requieren respuesta', response, 'No hay decisiones pendientes.')}
      ${section('Próximas', upcoming, 'No hay citas próximas.')}
      ${section('Recientes', recent, 'Aún no hay citas recientes.')}`;
  };
  const refreshQuoteAction = () => {
    const action = document.querySelector('#agenda-quote-action');
    const context = bridgeContext();
    action.hidden = !context || !A().config.enabled || !allowed();
    const quoteId = context?.quoteId;
    const link = quoteId ? A().pendingDrafts.quoteLink(quoteId) : null;
    const appointment = link ? queryState.appointments.find((item) => item.id === link.appointmentId) : null;
    document.querySelector('#agenda-quote-link').textContent = appointment
      ? `${A().formatters.status[appointment.status] || 'Cita registrada'} · ${A().formatters.dateTime(appointment.schedule?.startAt)} · ${A().formatters.communication(appointment.communication)}`
      : link ? `${A().formatters.status[link.lastStatus] || 'Cita registrada'} · sincronización ${link.sync === 'recovered' ? 'recuperada' : 'confirmada'}` : '';
  };

  const openAgenda = () => {
    agendaOpen = true;
    const drawer = root.querySelector('#agenda-drawer');
    drawer.hidden = false; drawer.setAttribute('aria-hidden', 'false');
    renderAgenda();
  };
  const closeAgenda = () => {
    agendaOpen = false;
    const drawer = root.querySelector('#agenda-drawer');
    drawer.hidden = true; drawer.setAttribute('aria-hidden', 'true');
  };
  const closeForm = () => {
    if (form.sending) return;
    const layer = root.querySelector('#agenda-form-layer');
    layer.hidden = true; layer.setAttribute('aria-hidden', 'true');
  };
  const openForm = (quoteContext) => {
    form = initialForm();
    if (quoteContext) {
      form.direct = !quoteContext.quoteId;
      form.quote = quoteContext.quoteId ? { quoteId: quoteContext.quoteId, context: quoteContext } : null;
      form.name = quoteContext.customer?.name || '';
      form.phone = quoteContext.customer?.phone || '';
      form.address = quoteContext.customer?.address || '';
      form.detail = quoteContext.items.map((item) => item.producto).filter(Boolean).join(', ').slice(0, 1000);
      form.need = quoteContext.items.length > 1 ? 'multiple_jobs' : /espejo/i.test(form.detail) ? 'mirror' : /ventana|puerta/i.test(form.detail) ? 'window_or_door' : 'bath_partition';
    }
    const layer = root.querySelector('#agenda-form-layer');
    layer.hidden = false; layer.setAttribute('aria-hidden', 'false');
    renderForm();
  };
  const field = (name, label, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(form[name])}" ${extra}></label>`;
  const renderForm = () => {
    const node = root.querySelector('#agenda-form');
    const progress = `<div class="agenda-progress"><strong class="${form.step === 1 ? 'active' : ''}">1 Cliente y servicio</strong><span>→</span><strong class="${form.step === 2 ? 'active' : ''}">2 Horario</strong></div>`;
    if (form.step === 1) {
      node.innerHTML = `${progress}${form.direct ? '<p class="agenda-muted">Cita directa, sin fabricar una referencia de cotización.</p>' : '<p class="agenda-success">La cotización se adjuntará como snapshot inmutable.</p>'}
        ${field('phone', 'Celular *', 'tel', 'inputmode="tel" autocomplete="tel"')}
        ${field('name', 'Nombre')}${field('address', 'Dirección *')}
        <label>Necesidad *<select name="need">${Object.entries(A().formatters.needs).map(([value, label]) => `<option value="${value}" ${form.need === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
        <label>Detalle<textarea name="detail" rows="2">${esc(form.detail)}</textarea></label>
        <label>Tipo de cita<select name="type"><option value="measure_visit">Visita de medidas</option><option value="install_visit">Instalación provisional</option><option value="correction_visit">Corrección pendiente de operator</option><option value="warranty_visit">Garantía pendiente de operator</option></select></label>
        <button type="button" class="agenda-primary agenda-full" data-agenda-action="next">Continuar</button>${messageHtml()}`;
      node.elements.type.value = form.type;
      return;
    }
    const exception = A().queries.saturdayException();
    const blocks = form.type === 'install_visit'
      ? A().availability.installBlocksForDate(form.date, form.durationMinutes)
      : A().availability.blocksForDate(form.date, { saturdayException: exception });
    if (!blocks.some((block) => block.start === form.block) && blocks[0]) form.block = blocks[0].start;
    const selected = blocks.find((block) => block.start === form.block);
    const occupied = selected ? A().availability.occupancy(queryState.appointments, selected.schedule) : 0;
    node.innerHTML = `${progress}
      ${field('date', 'Fecha *', 'date')}
      <label>Bloque *<select name="block">${blocks.map((block) => `<option value="${block.start}" ${form.block === block.start ? 'selected' : ''}>${block.start}${block.end ? `–${block.end}` : ''}</option>`).join('')}</select></label>
      ${form.type === 'install_visit' ? `<label>Duración<select name="durationMinutes">${A().availability.INSTALL_DURATIONS.map((minutes) => `<option value="${minutes}" ${Number(form.durationMinutes) === minutes ? 'selected' : ''}>${minutes / 60} horas</option>`).join('')}</select></label><p class="agenda-warning">La instalación quedará provisional hasta revisión de operator.</p>` : ''}
      <p class="agenda-capacity level-${Math.min(occupied, 2)}">${esc(A().availability.availabilityText(occupied))}</p>
      ${form.type === 'measure_visit' ? `<fieldset><legend>Costo de visita</legend><label class="agenda-radio"><input type="radio" name="feeMode" value="informed" ${form.feeMode === 'informed' ? 'checked' : ''}> Informado</label><label class="agenda-radio"><input type="radio" name="feeMode" value="not_informed" ${form.feeMode === 'not_informed' ? 'checked' : ''}> Aún no informado</label>${form.feeMode === 'informed' ? `${field('feeAmount', 'Valor informado (COP) *', 'number', 'min="0" step="1" list="agenda-fee-options"')}<datalist id="agenda-fee-options"><option value="20000"></option><option value="30000"></option></datalist>` : '<p class="agenda-warning">La comunicación quedará bloqueada hasta informar el costo.</p>'}</fieldset>` : ''}
      <label>Nota general<textarea name="note" rows="2">${esc(form.note)}</textarea></label>
      <div class="agenda-summary"><strong>Resumen</strong><span>${esc(A().formatters.types[form.type])} · ${esc(form.durationMinutes)} min</span><span>${esc(form.name || 'Sin nombre')} · ${esc(form.phone)}</span><span>${esc(form.address)}</span></div>
      <div class="agenda-form-actions"><button type="button" class="agenda-secondary" data-agenda-action="back">Volver</button><button type="submit" class="agenda-primary" ${form.sending ? 'disabled' : ''}>${form.sending ? 'Esperando confirmación…' : 'Crear cita'}</button></div>${messageHtml()}`;
  };
  const messageHtml = () => form.message ? `<div class="agenda-message ${esc(form.messageKind)}" role="status">${esc(form.message)}</div>` : '';
  const syncForm = () => {
    const data = new FormData(root.querySelector('#agenda-form'));
    for (const [key, value] of data.entries()) form[key] = value;
    form.durationMinutes = Number(form.durationMinutes);
    form.feeAmount = Number(form.feeAmount);
  };
  const firstError = () => {
    if (!/^\s*(?:\+?57)?3[0-9\s-]{9,}\s*$/.test(form.phone)) return 'Ingresa un celular colombiano válido.';
    if (form.address.trim().length < 5) return 'Ingresa una dirección clara.';
    return null;
  };
  const scheduleForForm = () => {
    if (form.type === 'install_visit') return A().availability.installSchedule(form.date, form.block, form.durationMinutes);
    const block = A().availability.blocksForDate(form.date, { saturdayException: A().queries.saturdayException() }).find((item) => item.start === form.block);
    return block?.schedule || null;
  };
  const draftForForm = async () => {
    const schedule = scheduleForForm();
    if (!schedule) throw new Error('SLOT_NOT_AVAILABLE');
    let quote = null;
    if (!form.direct && form.quote) {
      const context = JSON.parse(JSON.stringify(form.quote.context));
      context.quoteId = form.quote.quoteId;
      context.customer = { name: form.name, phone: form.phone, address: form.address };
      quote = await A().quoteSnapshot.build(context);
    }
    const visitFee = form.type === 'install_visit'
      ? { disclosureStatus: 'not_required' }
      : ['correction_visit', 'warranty_visit'].includes(form.type)
        ? { disclosureStatus: 'pending_review' }
        : form.feeMode === 'informed'
          ? { disclosureStatus: 'informed', amount: Number(form.feeAmount) }
          : { disclosureStatus: 'not_informed' };
    const payload = {
      type: form.type,
      source: { mode: quote ? 'quote' : 'direct', surface: 'cotizador' },
      contact: { phone: form.phone.trim(), ...(form.name.trim() ? { name: form.name.trim() } : {}) },
      location: { addressText: form.address.trim(), source: 'new', ...(form.note.trim() ? { notes: form.note.trim() } : {}) },
      customerNeed: { category: form.need, ...(form.detail.trim() ? { detail: form.detail.trim() } : {}) },
      requestedAvailability: { mode: 'selected_block', windows: [{ startAt: schedule.startAt, endAt: schedule.endAt }] },
      durationMinutes: Number(form.durationMinutes), schedule, visitFee,
      ...(['correction_visit', 'warranty_visit'].includes(form.type) ? { previousWork: { status: 'not_attempted' } } : {}),
      ...(quote ? { quoteRef: quote.quoteRef, immutableQuoteSnapshot: quote.snapshot } : {})
    };
    return {
      commandId: A().commands.newCommandId(), appointmentId: A().commands.newAppointmentId(),
      expectedRevision: 0, type: 'createAppointment', payload,
      quoteId: quote?.quoteRef.quoteId || null,
      form: { name: form.name, phone: form.phone, address: form.address, type: form.type, date: form.date, block: form.block }
    };
  };
  const sendDraft = async (draft) => {
    if (!navigator.onLine) {
      A().pendingDrafts.save({ ...draft, status: 'pending' });
      form.sending = false;
      form.messageKind = 'warning'; form.message = 'Sin conexión: quedó Pendiente de enviar. Usa Reintentar cuando tengas red.';
      renderForm(); renderAgenda(); return;
    }
    A().pendingDrafts.save({ ...draft, status: 'sending' });
    const result = await A().commands.send(draft);
    if (result.ok) {
      A().pendingDrafts.confirm(draft.commandId, result.result, draft.quoteId);
      form.sending = false; form.messageKind = 'success';
      form.message = result.result.deduplicated
        ? `La cita ya existía; recuperamos el mismo resultado sin duplicarla: ${A().formatters.status[result.result.status] || 'registrada'}.`
        : result.result.status === 'confirmed'
          ? 'Cita confirmada por el backend.'
          : result.result.status === 'tentative'
            ? 'Horario reservado provisionalmente. Operator debe revisarlo antes de prometerlo al cliente.'
            : `Cita registrada: ${A().formatters.status[result.result.status] || 'pendiente de revisión'}.`;
      renderForm(); renderAgenda(); refreshQuoteAction(); return;
    }
    A().pendingDrafts.save({ ...draft, status: result.error.uncertain ? 'unknown' : 'pending' });
    form.sending = false; form.messageKind = 'error'; form.message = result.error.message;
    renderForm(); renderAgenda();
  };
  const submitForm = async () => {
    syncForm();
    const error = firstError();
    if (error) { form.message = error; form.messageKind = 'error'; renderForm(); return; }
    if (form.feeMode === 'informed' && (!Number.isInteger(form.feeAmount) || form.feeAmount < 0)) {
      form.message = 'El costo informado debe ser un entero en COP.'; form.messageKind = 'error'; renderForm(); return;
    }
    form.sending = true; form.message = 'Esperando confirmación autoritativa del backend…'; form.messageKind = 'loading'; renderForm();
    try { await sendDraft(await draftForForm()); }
    catch (_) { form.sending = false; form.message = 'El horario o snapshot no pudo validarse.'; form.messageKind = 'error'; renderForm(); }
  };

  const findAppointment = (id) => queryState.appointments.find((item) => item.id === id);
  const reportActionResult = (result) => {
    if (!result?.ok) return alert(result?.error?.message || 'No fue posible completar la acción.');
    if (result.result?.deduplicated) alert('La acción ya había sido confirmada; recuperamos el mismo resultado.');
  };
  const runAction = async (target) => {
    const action = target.dataset.agendaAction;
    if (action === 'close') return closeAgenda();
    if (action === 'form-close') return closeForm();
    if (action === 'login') return A().auth.signIn();
    if (action === 'logout') return A().auth.signOut();
    if (action === 'direct') return openForm(null);
    if (action === 'quote') return openForm(bridgeContext());
    if (action === 'next') {
      syncForm(); const error = firstError();
      if (error) { form.message = error; form.messageKind = 'error'; return renderForm(); }
      form.step = 2; form.message = ''; return renderForm();
    }
    if (action === 'back') { syncForm(); form.step = 1; form.message = ''; return renderForm(); }
    if (action === 'retry') {
      const draft = A().pendingDrafts.list().find((item) => item.commandId === target.dataset.command);
      if (draft) await sendDraft(draft);
      return;
    }
    if (action === 'delete-draft') {
      if (confirm('Eliminar este borrador nunca confirmado? La cita confirmada, si existe, no se borra.')) A().pendingDrafts.remove(target.dataset.command);
      return renderAgenda();
    }
    const appointment = findAppointment(target.dataset.id);
    if (!appointment) return;
    if (action === 'inform-fee') {
      const amount = Number(prompt('Valor informado en COP', '20000'));
      if (!Number.isInteger(amount) || amount < 0) return;
      reportActionResult(await A().commands.send({ appointmentId: appointment.id, expectedRevision: appointment.revision, type: 'resolveVisitFee', payload: { action: 'inform', informedAmount: amount } }));
    }
    if (action === 'communicate') {
      const channel = prompt('Canal: whatsapp, call o conversation', 'whatsapp');
      if (!['whatsapp', 'call', 'conversation'].includes(channel)) return;
      reportActionResult(await A().commands.send({ appointmentId: appointment.id, expectedRevision: appointment.revision, type: 'markCommunicated', payload: { channel } }));
    }
    if (action === 'reschedule') {
      const date = prompt('Nueva fecha (AAAA-MM-DD)', nextBusinessDay());
      const hour = prompt('Bloque: 09:00, 11:00, 13:00 o 15:00', '09:00');
      const schedule = A().availability.blocksForDate(date, { saturdayException: A().queries.saturdayException() }).find((item) => item.start === hour)?.schedule;
      if (!schedule) return;
      reportActionResult(await A().commands.send({ appointmentId: appointment.id, expectedRevision: appointment.revision, type: 'rescheduleAppointment', payload: { newSchedule: schedule, reason: 'Reprogramación coordinada por advisor', customerCommunicationStatus: 'pending' } }));
    }
  };
  const initialize = () => {
    if (!A().config.enabled) return;
    root = shell();
    root.addEventListener('click', (event) => {
      const target = event.target.closest('[data-agenda-action]');
      if (target) runAction(target);
    });
    document.querySelector('#agenda-header-button').addEventListener('click', openAgenda);
    document.querySelector('[data-agenda-action="quote"]').addEventListener('click', () => openForm(bridgeContext()));
    root.querySelector('#agenda-form').addEventListener('change', () => { syncForm(); if (form.step === 2) renderForm(); });
    root.querySelector('#agenda-form').addEventListener('submit', (event) => { event.preventDefault(); submitForm(); });
    A().auth.subscribe((next) => {
      const wasAllowed = allowed(); authState = next;
      if (allowed() && !wasAllowed) A().queries.start();
      if (!allowed() && wasAllowed) A().queries.stop();
      if (agendaOpen) renderAgenda();
      refreshQuoteAction();
    });
    A().queries.subscribe((next) => { queryState = next; if (agendaOpen) renderAgenda(); });
    global.addEventListener('wilan:quote-ready', refreshQuoteAction);
    global.addEventListener('online', () => { if (agendaOpen) renderAgenda(); });
    refreshQuoteAction();
    A().auth.start();
  };

  A().ui = { initialize, openAgenda, openForm, renderAgenda, _state: () => ({ form, authState, queryState }) };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})(window);
