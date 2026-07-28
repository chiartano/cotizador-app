(function (global) {
  'use strict';

  const status = Object.freeze({
    requested: 'Por coordinar',
    tentative: 'Pendiente de confirmar',
    alternative_proposed: 'Elegir otra fecha',
    confirmed: 'Confirmada',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    no_show: 'Cliente no atendió'
  });
  const types = Object.freeze({
    measure_visit: 'Tomar medidas',
    install_visit: 'Instalar',
    correction_visit: 'Mantenimiento o reparación',
    warranty_visit: 'Revisar una garantía'
  });
  const needs = Object.freeze({
    bath_partition: 'División de baño',
    window_or_door: 'Ventana/puerta',
    mirror: 'Espejo',
    railing: 'Baranda',
    glass_replacement: 'Cambio de vidrio',
    general_maintenance: 'Mantenimiento general',
    other: 'Otro',
    correction_or_warranty: 'Corrección o garantía',
    multiple_jobs: 'Varios trabajos',
    unclear: 'Otro'
  });
  const asDate = (value) => {
    if (!value) return null;
    const date = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  };
  const dateTime = (value) => {
    const date = asDate(value);
    return date ? new Intl.DateTimeFormat('es-CO', {
      timeZone: 'America/Bogota', weekday: 'short', day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit'
    }).format(date) : 'Horario pendiente';
  };
  const money = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;
  const fee = (value) => {
    if (!value || value.applicability === 'not_applicable') return 'No aplica';
    if (value.applicability === 'pending_operator_review') return 'Por definir';
    if (value.disclosure?.status === 'not_informed') return 'No informado';
    if (value.disclosure?.status === 'exception') return 'Excepción aprobada';
    if (value.disclosure?.status === 'informed') return money(value.disclosure.amount);
    return 'Pendiente';
  };
  const communication = (value) => ({
    blocked: 'Falta información', pending: 'Pendiente', ready: 'Pendiente de informar',
    communicated: 'Cliente informado', needs_recommunication: 'Informar de nuevo'
  }[value?.status] || 'Sin dato');
  const reason = (appointment) => appointment?.cancellation?.reason || ({
    visit_fee_not_disclosed: 'Falta informar el costo de visita',
    operations_review_pending: 'Pendiente de revisión operativa',
    alternative_pending: 'Pendiente acordar otra fecha',
    other: 'Pendiente de gestión'
  }[appointment?.communication?.blockedReason] || '');
  const terminal = (appointment) => ['completed', 'cancelled', 'no_show'].includes(appointment?.status);
  const requiresResponse = (appointment) => appointment?.archived !== true && !terminal(appointment) && (
    (appointment.type === 'install_visit' && appointment.operationsReview?.status === 'pending') ||
    (appointment.type === 'measure_visit' && appointment.capacity?.occupancyBefore >= 1 && appointment.status === 'tentative') ||
    appointment.status === 'alternative_proposed' ||
    appointment.visitFee?.applicability === 'pending_operator_review' ||
    ['blocked', 'ready', 'needs_recommunication'].includes(appointment.communication?.status)
  );

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.formatters = { status, types, needs, asDate, dateTime, money, fee, communication, reason, terminal, requiresResponse };
})(window);
