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
    note: '', sending: false, message: '', messageKind: '', receipt: null
  });
  let form = initialForm();
  let root = null;
  let agendaOpen = false;
  let authState = { kind: 'unauthenticated' };
  let queryState = { appointments: [], overrides: [], loading: false };
  let accessMessage = '';
  let selectedDay = '';
  let agendaView = 'week';
  let submissionLock = false;
  let activeDraft = null;
  let recentlyCreatedId = '';

  const authCopy = (kind) => ({
    loading: 'Preparando acceso seguro…', signing_in: 'Abriendo acceso Google…',
    checking_membership: 'Verificando tu membresía…', unauthenticated: 'Inicia sesión para usar Agenda.',
    no_membership: 'Tu cuenta está identificada, pero todavía no tiene acceso a la Agenda de WILAN.',
    request_withdrawn: 'Retiraste la solicitud de acceso.',
    request_pending: 'Solicitud enviada. Está pendiente de aprobación.',
    request_rejected: 'Tu solicitud no fue aprobada.',
    approved_pending_membership: 'La solicitud fue aprobada. Estamos confirmando tu acceso.',
    revoked: 'Tu acceso fue desactivado por el administrador.',
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
        <div id="agenda-quote-compact"></div>
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
    const result = document.querySelector('#resultado-panel .card') || document.querySelector('#quote-summary');
    if (result) result.appendChild(container.querySelector('#agenda-quote-action'));
    return container;
  };

  const renderAuth = () => {
    const content = root.querySelector('#agenda-content');
    const request = authState.accessRequest;
    const identity = authState.user?.email
      ? `<div class="agenda-identity"><strong>${esc(authState.user.displayName || 'Cuenta Google')}</strong><p class="agenda-muted">${esc(authState.user.email)}</p></div>`
      : '';
    const decided = request?.decidedAt?.toDate?.() || request?.updatedAt?.toDate?.() || (request?.updatedAt ? new Date(request.updatedAt) : null);
    const cooldownReady = !decided || !Number.isFinite(decided.getTime()) || Date.now() - decided.getTime() >= 24 * 3600000;
    const canRequest = ['no_membership', 'request_withdrawn', 'revoked'].includes(authState.kind)
      || (authState.kind === 'request_rejected' && cooldownReady);
    const reason = request?.generalReason ? `<p class="agenda-warning">${esc(request.generalReason)}</p>` : '';
    const explanation = ['no_membership', 'request_withdrawn'].includes(authState.kind)
      ? '<p class="agenda-muted">Envía una solicitud para que el administrador la revise. La solicitud no concede acceso por sí sola.</p>'
      : authState.kind === 'request_pending'
        ? '<p class="agenda-muted">No puedes ver citas ni agendar hasta que una cuenta administradora apruebe la solicitud.</p>'
        : authState.kind === 'revoked'
          ? '<p class="agenda-muted">Las citas históricas se conservan, pero esta sesión ya no puede leerlas ni crear nuevas.</p>'
          : '';
    content.innerHTML = `<div class="agenda-empty"><h3>${esc(authCopy(authState.kind))}</h3>${identity}${explanation}${reason}
      ${accessMessage ? `<p class="agenda-message" role="status">${esc(accessMessage)}</p>` : ''}
      ${authState.kind === 'unauthenticated' || authState.kind === 'network_error'
        ? '<button type="button" class="agenda-primary" data-agenda-action="login">Iniciar sesión con Google</button>' : ''}
      ${canRequest ? `<button type="button" class="agenda-primary" data-agenda-action="request-access">${authState.kind === 'revoked' ? 'Solicitar reactivación' : 'Solicitar acceso'}</button>` : ''}
      ${authState.kind === 'request_pending' ? '<button type="button" class="agenda-secondary" data-agenda-action="withdraw-access">Retirar solicitud</button>' : ''}
      ${authState.kind === 'request_rejected' && !cooldownReady ? '<p class="agenda-muted">Podrás volver a solicitar después del cooldown de 24 horas.</p>' : ''}
      ${authState.user ? '<button type="button" class="agenda-secondary" data-agenda-action="switch-account">Usar otra cuenta</button>' : ''}
    </div>`;
  };
  const card = (appointment) => {
    const f = A().formatters;
    const quote = appointment.quoteRef?.quoteId ? `<span class="agenda-chip">${appointment.quoteRef.folio ? `Cotización ${esc(appointment.quoteRef.folio)}` : 'Cotización vinculada'}</span>` : '';
    const alternative = appointment.status === 'alternative_proposed'
      ? '<p class="agenda-warning">Se propuso otra fecha. Coordínala antes de confirmar al cliente.</p>' : '';
    const canReschedule = appointment.type === 'measure_visit'
      && !f.terminal(appointment) && appointment.operationsReview?.status !== 'pending';
    const canInform = appointment.type === 'measure_visit'
      && appointment.visitFee?.applicability === 'applies'
      && appointment.visitFee?.disclosure?.status === 'not_informed';
    const canCommunicate = ['ready', 'needs_recommunication'].includes(appointment.communication?.status);
    const canArchive = queryState.config?.appointmentArchiveEnabled === true
      && appointment.server?.createdByUid === authState.user?.uid
      && !['completed', 'no_show'].includes(appointment.status)
      && appointment.links?.client?.status !== 'linked'
      && !['prospect_project_linked', 'project_linked'].includes(appointment.links?.commercial?.status);
    const generalReason = f.reason(appointment);
    return `<article class="agenda-card" data-appointment-id="${esc(appointment.id || appointment.appointmentId)}">
      <div class="agenda-card-top"><strong>${esc(f.types[appointment.type] || appointment.type)}</strong><span>${esc(f.status[appointment.status] || appointment.status)}</span></div>
      <h3>${esc(appointment.contact?.name || appointment.contact?.phone || 'Cliente')}</h3>
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
        ${canArchive ? `<button type="button" class="agenda-delete-action" data-agenda-action="archive" data-id="${esc(appointment.id)}">Eliminar cita</button>` : ''}
      </div>
    </article>`;
  };
  const section = (title, items, empty) => `<section class="agenda-section"><div class="agenda-section-title"><h3>${title}</h3><span>${items.length}</span></div>${items.length ? items.map(card).join('') : `<p class="agenda-muted">${empty}</p>`}</section>`;
  const dateKey = (date) => date.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
  const operationalDays = () => {
    const first = queryState.rangeStart ? new Date(queryState.rangeStart) : new Date();
    return Array.from({ length: 6 }, (_, index) => new Date(first.getTime() + index * 86400000));
  };
  const dayTitle = (date) => new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota', weekday: 'short', day: 'numeric', month: 'short'
  }).format(date);
  const dayAppointments = (date) => queryState.appointments.filter((item) =>
    dateKey(A().formatters.asDate(item.schedule?.startAt)) === dateKey(date));
  const weekCard = (appointment) => {
    const start = A().formatters.asDate(appointment.schedule?.startAt);
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hour12: false
    }).format(start).split(':').map(Number);
    const top = Math.max(0, (((parts[0] - 8) * 60 + parts[1]) / 60) * 56);
    const height = Math.max(48, Number(appointment.durationMinutes || 60) / 60 * 56);
    return `<button type="button" class="agenda-week-card" data-agenda-action="appointment-focus" data-id="${esc(appointment.id)}" style="top:${top}px;height:${height}px">
      <strong>${esc(appointment.contact?.name || appointment.contact?.phone)}</strong>
      <span>${esc(A().formatters.types[appointment.type] || 'Visita')}</span>
      <small>${esc(A().formatters.dateTime(appointment.schedule?.startAt).split(',').pop() || '')}</small>
    </button>`;
  };
  const freeBlocks = (date) => A().availability.blocksForDate(dateKey(date), {
    saturdayException: A().queries.saturdayException()
  }).map((block) => {
    const occupied = A().availability.occupancy(queryState.appointments, block.schedule);
    const startHour = Number(block.start.slice(0, 2));
    const top = (startHour - 8) * 56;
    const height = block.durationMinutes / 60 * 56;
    return `<button type="button" class="agenda-free-slot" data-agenda-action="free-slot" data-date="${dateKey(date)}" data-block="${block.start}" style="top:${top}px;height:${height}px" ${occupied || !navigator.onLine ? 'disabled' : ''}>${occupied ? '' : navigator.onLine ? `${block.start} libre` : 'Sin conexión'}</button>`;
  }).join('');
  const renderOperationalAgenda = (content) => {
    const days = operationalDays();
    if (!selectedDay || !days.some((date) => dateKey(date) === selectedDay)) selectedDay = dateKey(days[0]);
    const attention = queryState.appointments.filter(A().formatters.requiresResponse);
    const activeDay = days.find((date) => dateKey(date) === selectedDay) || days[0];
    const selectedItems = dayAppointments(activeDay);
    const drafts = A().pendingDrafts.list();
    const list = [...queryState.appointments].sort((left, right) =>
      Date.parse(left.schedule?.startAt || 0) - Date.parse(right.schedule?.startAt || 0));
    const mine = list.filter((item) => item.server?.createdByUid === authState.user?.uid);
    const mineHtml = queryState.loading
      ? '<p class="agenda-muted" role="status">Cargando tus citas…</p>'
      : queryState.error
        ? '<p class="agenda-warning" role="alert">No pudimos actualizar tus citas. Conservamos la última vista disponible.</p>'
        : mine.length
          ? mine.map((item) => `<button type="button" class="agenda-draft" data-agenda-action="appointment-focus" data-id="${esc(item.id)}"><div><strong>${esc(item.contact?.name || item.contact?.phone || 'Cliente')}</strong><small>${esc(A().formatters.types[item.type] || 'Visita')} · ${esc(A().formatters.dateTime(item.schedule?.startAt))} · ${esc(A().formatters.status[item.status] || item.status)}${item.id === recentlyCreatedId ? ' · Recién guardada' : ''}</small></div><span>Ver</span></button>`).join('')
          : '<p class="agenda-muted">Aún no tienes citas en este periodo.</p>';
    content.innerHTML = `${!navigator.onLine ? '<p class="agenda-offline">Información guardada. Conéctate para actualizar.</p>' : ''}
      <div class="agenda-profile"><div><strong>Agenda semanal</strong><small>${esc(authState.user?.email || '')}</small></div><button type="button" data-agenda-action="logout">Salir</button></div>
      <div class="agenda-toolbar"><button type="button" class="agenda-primary" data-agenda-action="direct">Nueva cita</button><span>${queryState.appointments.length} citas esta semana</span></div>
      <section class="agenda-section" aria-live="polite"><div class="agenda-section-title"><h3>Mis citas</h3><span>${mine.length}</span></div>${mineHtml}</section>
      ${drafts.length ? `<section class="agenda-section"><div class="agenda-section-title"><h3>Pendientes de enviar</h3><span>${drafts.length}</span></div>${drafts.map((draft) => `<article class="agenda-draft"><div><strong>${esc(draft.form?.name || draft.form?.phone || 'Cita pendiente')}</strong><small>${['unknown', 'sending'].includes(draft.status) ? 'Resultado no confirmado' : 'Guardado en este dispositivo'}</small></div><button type="button" data-agenda-action="retry" data-command="${esc(draft.commandId)}">Reintentar</button></article>`).join('')}</section>` : ''}
      <section class="agenda-attention"><div class="agenda-section-title"><div><h3>Necesitan atención</h3><p>Solo decisiones y comunicaciones pendientes.</p></div><span>${attention.length}</span></div>
        ${attention.length ? attention.map((item) => `<button type="button" data-agenda-action="appointment-focus" data-id="${esc(item.id)}"><strong>${esc(item.contact?.name || item.contact?.phone)}</strong><small>${esc(A().formatters.status[item.status] || 'Revisar cita')} · ${esc(A().formatters.communication(item.communication))}</small></button>`).join('') : '<p class="agenda-empty-line">No hay citas que necesiten atención.</p>'}
      </section>
      <div class="agenda-week-nav"><button type="button" data-agenda-action="week-prev">‹</button><button type="button" data-agenda-action="week-today">Hoy</button><strong>${esc(dayTitle(days[0]))} – ${esc(dayTitle(days[5]))}</strong><button type="button" data-agenda-action="week-next">›</button></div>
      <div class="agenda-view-tabs"><button type="button" data-agenda-action="view-week" class="${agendaView === 'week' ? 'active' : ''}">Semana</button><button type="button" data-agenda-action="view-list" class="${agendaView === 'list' ? 'active' : ''}">Lista</button></div>
      ${agendaView === 'list' ? `<div class="agenda-list">${list.length ? list.map(card).join('') : '<p class="agenda-muted">No hay citas en este periodo.</p>'}</div>` : `
        <div class="agenda-mobile-days">${days.map((date) => `<button type="button" data-agenda-action="select-day" data-date="${dateKey(date)}" class="${dateKey(date) === selectedDay ? 'active' : ''}">${esc(dayTitle(date))}</button>`).join('')}</div>
        <div class="agenda-mobile-day">${selectedItems.length ? selectedItems.map(card).join('') : '<p class="agenda-muted">No hay citas este día.</p>'}
          ${A().availability.blocksForDate(dateKey(activeDay), { saturdayException: A().queries.saturdayException() }).map((block) => {
            const occupied = A().availability.occupancy(queryState.appointments, block.schedule);
            return `<button type="button" class="agenda-mobile-slot" data-agenda-action="free-slot" data-date="${dateKey(activeDay)}" data-block="${block.start}" ${occupied || !navigator.onLine ? 'disabled' : ''}>${block.start}${block.end ? `–${block.end}` : ''} · ${occupied ? 'ocupado' : navigator.onLine ? 'Agendar' : 'sin conexión'}</button>`;
          }).join('')}
        </div>
        <div class="agenda-week-grid"><div class="agenda-week-axis">${Array.from({ length: 10 }, (_, index) => `<span style="top:${index * 56}px">${index + 8}:00</span>`).join('')}</div>${days.map((date) => `<div class="agenda-week-column"><header>${esc(dayTitle(date))}</header><div class="agenda-week-body">${freeBlocks(date)}${dayAppointments(date).map(weekCard).join('')}</div></div>`).join('')}</div>`}
    `;
  };
  const renderAgenda = () => {
    if (!allowed()) return renderAuth();
    const content = root.querySelector('#agenda-content');
    if (queryState.config?.agendaOperationalUxEnabled === true) return renderOperationalAgenda(content);
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
    const quoteSummary = document.querySelector('#quote-summary');
    const resultCard = document.querySelector('#resultado-panel .card');
    const target = quoteSummary && quoteSummary.style.display !== 'none' ? quoteSummary : resultCard;
    if (target && action.parentElement !== target) target.appendChild(action);
    action.hidden = !context || !A().config.enabled || !allowed();
    const compact = document.querySelector('#agenda-quote-compact');
    if (compact && context) {
      const items = (context.items || []).slice(0, 4);
      compact.innerHTML = `<strong>${context.folio ? `Cotización #${esc(context.folio)}` : 'Cotización actual'}</strong>
        ${items.map((item) => `<span>${esc(item.producto || 'Producto')} · ${esc(item.medidas || '')}${item.vidrio ? ` · ${esc(item.vidrio)}` : ''}${item.color ? ` · ${esc(item.color)}` : ''}${item.cantidad ? ` · ${esc(item.cantidad)} und.` : ''}</span>`).join('')}
        <b>${esc(A().formatters.money(context.total))}</b>`;
    } else if (compact) compact.innerHTML = '';
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
  const resetAndCloseForm = () => {
    form = initialForm();
    const layer = root?.querySelector('#agenda-form-layer');
    if (layer) {
      layer.hidden = true;
      layer.setAttribute('aria-hidden', 'true');
    }
  };
  const openForm = (quoteContext) => {
    form = initialForm();
    submissionLock = false;
    activeDraft = null;
    if (quoteContext) {
      form.direct = !quoteContext.quoteId;
      form.quote = quoteContext.quoteId ? { quoteId: quoteContext.quoteId, context: quoteContext } : null;
      form.name = quoteContext.customer?.name || '';
      form.phone = quoteContext.customer?.phone || '';
      form.address = quoteContext.customer?.address || '';
      form.detail = quoteContext.items.map((item) => item.producto).filter(Boolean).join(', ').slice(0, 1000);
      form.need = quoteContext.items.length > 1 ? 'other' : /espejo/i.test(form.detail) ? 'mirror' : /ventana|puerta/i.test(form.detail) ? 'window_or_door' : 'bath_partition';
    }
    const layer = root.querySelector('#agenda-form-layer');
    layer.hidden = false; layer.setAttribute('aria-hidden', 'false');
    renderForm();
  };
  const field = (name, label, type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(form[name])}" ${extra}></label>`;
  const renderForm = () => {
    const node = root.querySelector('#agenda-form');
    node.setAttribute('aria-busy', String(form.sending));
    if (form.receipt) {
      node.innerHTML = `<section class="agenda-message success" role="status"><small>Cita guardada</small><h3>${esc(form.receipt.date)} · ${esc(form.receipt.block)}</h3><p><strong>${esc(A().formatters.status[form.receipt.status] || form.receipt.status)}</strong> · ${esc(A().formatters.types[form.receipt.type] || 'Visita')}</p><p>El servidor confirmó el registro. Esto no envía mensajes al cliente.</p><button type="button" class="agenda-primary agenda-full" data-agenda-action="receipt-view" data-id="${esc(form.receipt.appointmentId)}">Ver cita</button></section>`;
      return;
    }
    const progress = `<div class="agenda-progress"><strong class="${form.step === 1 ? 'active' : ''}">1 Cliente y servicio</strong><span>→</span><strong class="${form.step === 2 ? 'active' : ''}">2 Horario</strong></div>`;
    if (form.step === 1) {
      node.innerHTML = `${progress}${form.direct ? '<p class="agenda-muted">Cita directa, sin fabricar una referencia de cotización.</p>' : '<p class="agenda-success">La cotización se adjuntará como snapshot inmutable.</p>'}
        ${field('phone', 'Teléfono del cliente *', 'tel', 'inputmode="tel" autocomplete="tel" placeholder="+57 300 123 4567"')}
        ${A().phone.warning(form.phone) ? `<p class="agenda-phone-hint">${esc(A().phone.warning(form.phone))}</p>` : ''}
        ${field('name', 'Nombre del cliente (opcional)', 'text', 'placeholder="Ej. Ana Rodríguez"')}<p class="agenda-muted">Si no lo sabes, puedes dejarlo vacío. La cita se mostrará con el número.</p>
        ${field('address', 'Dirección *')}
        <fieldset><legend>¿Qué necesita el cliente?</legend><div class="agenda-choice-grid">${[
          ['bath_partition', 'División de baño'], ['window_or_door', 'Ventana/puerta'], ['mirror', 'Espejo'],
          ['railing', 'Baranda'], ['glass_replacement', 'Cambio de vidrio'], ['general_maintenance', 'Mantenimiento general'], ['other', 'Otro']
        ].map(([value, label]) => `<label class="agenda-choice"><input type="radio" name="need" value="${value}" ${form.need === value ? 'checked' : ''}> ${label}</label>`).join('')}</div></fieldset>
        <label>Descripción ${form.need === 'other' ? '*' : '(opcional)'}<textarea name="detail" rows="2" placeholder="Describe brevemente lo que necesita">${esc(form.detail)}</textarea></label>
        <button type="button" class="agenda-primary agenda-full" data-agenda-action="next">Continuar</button>${messageHtml()}`;
      return;
    }
    const exception = A().queries.saturdayException();
    if (form.type === 'install_visit' && !A().availability.INSTALL_DURATIONS.includes(Number(form.durationMinutes))) {
      form.durationMinutes = A().availability.INSTALL_DURATIONS[0];
    }
    const blocks = form.type === 'install_visit'
      ? A().availability.installBlocksForDate(form.date, form.durationMinutes)
      : A().availability.blocksForDate(form.date, { saturdayException: exception });
    if (!blocks.some((block) => block.start === form.block) && blocks[0]) form.block = blocks[0].start;
    const selected = blocks.find((block) => block.start === form.block);
    const occupied = selected ? A().availability.occupancy(queryState.appointments, selected.schedule) : 0;
    node.innerHTML = `${progress}
      <fieldset><legend>¿Por qué vamos?</legend><div class="agenda-choice-grid">${[
        ['measure_visit', 'Tomar medidas'], ['install_visit', 'Instalar'],
        ['correction_visit', 'Mantenimiento o reparación'], ['warranty_visit', 'Revisar una garantía']
      ].map(([value, label]) => `<label class="agenda-choice"><input type="radio" name="type" value="${value}" ${form.type === value ? 'checked' : ''}> ${label}</label>`).join('')}</div></fieldset>
      ${field('date', 'Fecha *', 'date')}
      <label>Bloque *<select name="block">${blocks.map((block) => `<option value="${block.start}" ${form.block === block.start ? 'selected' : ''}>${block.start}${block.end ? `–${block.end}` : ''}</option>`).join('')}</select></label>
      ${form.type === 'install_visit' ? `<label>Duración<select name="durationMinutes">${A().availability.INSTALL_DURATIONS.map((minutes) => `<option value="${minutes}" ${Number(form.durationMinutes) === minutes ? 'selected' : ''}>${minutes / 60} horas</option>`).join('')}</select></label><p class="agenda-warning">El horario quedará pendiente de confirmación.</p>` : ''}
      <p class="agenda-capacity level-${Math.min(occupied, 2)}">${esc(A().availability.availabilityText(occupied))}</p>
      ${form.type === 'measure_visit' ? `<fieldset><legend>Costo de visita</legend><label class="agenda-radio"><input type="radio" name="feeMode" value="informed" ${form.feeMode === 'informed' ? 'checked' : ''}> Informado</label><label class="agenda-radio"><input type="radio" name="feeMode" value="not_informed" ${form.feeMode === 'not_informed' ? 'checked' : ''}> Aún no informado</label>${form.feeMode === 'informed' ? `${field('feeAmount', 'Valor informado (COP) *', 'number', 'min="0" step="1" list="agenda-fee-options"')}<datalist id="agenda-fee-options"><option value="20000"></option><option value="30000"></option></datalist>` : '<p class="agenda-warning">La comunicación quedará bloqueada hasta informar el costo.</p>'}</fieldset>` : ''}
      <label>Nota general<textarea name="note" rows="2">${esc(form.note)}</textarea></label>
      <div class="agenda-summary"><strong>Resumen</strong><span>${esc(A().formatters.types[form.type])} · ${esc(form.durationMinutes / 60)} h</span><span>${esc(form.name || form.phone)} · ${esc(form.phone)}</span><span>${esc(form.address)}</span></div>
      <div class="agenda-form-actions"><button type="button" class="agenda-secondary" data-agenda-action="back" ${form.sending ? 'disabled' : ''}>Volver</button><button type="submit" class="agenda-primary" aria-busy="${form.sending}" ${form.sending ? 'disabled' : ''}>${form.sending ? 'Guardando…' : activeDraft ? 'Reintentar' : 'Guardar cita'}</button></div>${messageHtml()}`;
  };
  const messageHtml = () => form.message ? `<div class="agenda-message ${esc(form.messageKind)}" role="status">${esc(form.message)}</div>` : '';
  const syncForm = () => {
    const data = new FormData(root.querySelector('#agenda-form'));
    for (const [key, value] of data.entries()) form[key] = value;
    form.durationMinutes = Number(form.durationMinutes);
    form.feeAmount = Number(form.feeAmount);
  };
  const firstError = () => {
    if (!A().phone.inspect(form.phone)) return 'Ingresa un teléfono válido de 7 a 15 dígitos.';
    if (form.address.trim().length < 5) return 'Ingresa una dirección clara.';
    if (form.need === 'other' && form.detail.trim().length < 3) return 'Describe brevemente qué necesita el cliente.';
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
      form.message = 'Cita guardada';
      recentlyCreatedId = result.result.appointmentId;
      if (activeDraft?.commandId === draft.commandId) {
        form.receipt = { appointmentId: result.result.appointmentId, status: result.result.status, type: draft.form.type, date: draft.form.date, block: draft.form.block };
        activeDraft = null;
      }
      renderForm(); renderAgenda(); refreshQuoteAction(); return;
    }
    A().pendingDrafts.save({ ...draft, status: result.error.uncertain ? 'unknown' : 'pending' });
    form.sending = false; form.messageKind = 'error'; form.message = result.error.message;
    renderForm(); renderAgenda();
  };
  const submitForm = async () => {
    if (submissionLock || form.sending) return;
    syncForm();
    const error = firstError();
    if (error) { form.message = error; form.messageKind = 'error'; renderForm(); return; }
    if (form.feeMode === 'informed' && (!Number.isInteger(form.feeAmount) || form.feeAmount < 0)) {
      form.message = 'El costo informado debe ser un entero en COP.'; form.messageKind = 'error'; renderForm(); return;
    }
    submissionLock = true;
    form.sending = true; form.message = 'Guardando la cita…'; form.messageKind = 'loading'; renderForm();
    try {
      activeDraft = activeDraft || await draftForForm();
      await sendDraft(activeDraft);
    } catch (_) {
      form.sending = false; form.message = 'El horario o snapshot no pudo validarse. Reintenta sin volver a llenar el formulario.'; form.messageKind = 'error'; renderForm();
    } finally {
      submissionLock = false;
    }
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
    if (action === 'receipt-view') {
      closeForm();
      openAgenda();
      agendaView = 'list';
      renderAgenda();
      root.querySelector(`[data-appointment-id="${target.dataset.id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
    if (action === 'login') return A().auth.signIn();
    if (action === 'logout') return A().auth.signOut();
    if (action === 'switch-account') return A().auth.signOut();
    if (action === 'request-access' || action === 'withdraw-access') {
      accessMessage = action === 'request-access' ? 'Enviando solicitud segura…' : 'Retirando solicitud…';
      renderAuth();
      const result = await A().access.send({
        type: action === 'request-access' ? 'requestAccess' : 'withdrawAccessRequest'
      });
      accessMessage = result.ok ? 'Acción confirmada.' : result.error.message;
      renderAuth();
      return;
    }
    if (action === 'direct') return openForm(null);
    if (action === 'quote') return openForm(bridgeContext());
    if (action === 'view-week') { agendaView = 'week'; return renderAgenda(); }
    if (action === 'view-list') { agendaView = 'list'; return renderAgenda(); }
    if (action === 'select-day') { selectedDay = target.dataset.date; return renderAgenda(); }
    if (action === 'week-prev' || action === 'week-next' || action === 'week-today') {
      const base = action === 'week-today'
        ? new Date()
        : new Date(queryState.rangeStart || Date.now() + (action === 'week-next' ? 7 : -7) * 86400000);
      if (action !== 'week-today') base.setUTCDate(base.getUTCDate() + (action === 'week-next' ? 7 : -7));
      A().queries.setWeek(base);
      return;
    }
    if (action === 'free-slot') {
      if (!navigator.onLine) return;
      openForm(null);
      form.date = target.dataset.date;
      form.block = target.dataset.block;
      renderForm();
      return;
    }
    if (action === 'appointment-focus') {
      agendaView = 'list';
      renderAgenda();
      const appointmentNode = root.querySelector(`[data-appointment-id="${target.dataset.id}"]`);
      appointmentNode?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }
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
    if (action === 'archive') {
      const choices = {
        '1': 'created_by_mistake',
        '2': 'synthetic_test',
        '3': 'duplicate_customer',
        '4': 'incorrect_information',
        '5': 'other'
      };
      const selected = prompt('Motivo: 1 La agendé por error · 2 Era una prueba · 3 Cliente duplicado · 4 Fecha o información incorrecta · 5 Otra razón', '1');
      const archiveReason = choices[selected];
      if (!archiveReason) return;
      const note = archiveReason === 'other' ? prompt('Describe brevemente la razón', '') : '';
      if (archiveReason === 'other' && !String(note || '').trim()) return;
      const customerCommunicationAcknowledged = appointment.communication?.status === 'communicated'
        ? confirm('El cliente ya fue informado. ¿Confirmas que revisarás si necesita una aclaración?')
        : false;
      if (appointment.communication?.status === 'communicated' && !customerCommunicationAcknowledged) return;
      if (!confirm('La cita dejará de aparecer, pero su historia y controles se conservarán. ¿Eliminar cita?')) return;
      reportActionResult(await A().commands.send({
        appointmentId: appointment.id,
        expectedRevision: appointment.revision,
        type: 'archiveAppointment',
        payload: {
          reason: archiveReason,
          customerCommunicationAcknowledged,
          ...(archiveReason === 'other' ? { note: String(note).trim() } : {})
        }
      }));
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
      if (next.kind !== 'checking_membership') accessMessage = '';
      if (allowed() && !wasAllowed) A().queries.start();
      if (!allowed() && wasAllowed) {
        A().queries.stop();
        resetAndCloseForm();
      }
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
