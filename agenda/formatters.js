(function (global) {
  'use strict';

  const status = Object.freeze({
    requested: 'Pendiente de horario',
    tentative: 'Reservada provisionalmente',
    alternative_proposed: 'Operator propuso otra fecha',
    confirmed: 'Confirmada',
    completed: 'Realizada',
    cancelled: 'Cancelada',
    no_show: 'Cliente no atendió'
  });
  const types = Object.freeze({
    measure_visit: 'Visita de medidas',
    install_visit: 'Instalación',
    correction_visit: 'Corrección',
    warranty_visit: 'Garantía'
  });
  const needs = Object.freeze({
    bath_partition: 'División de baño',
    window_or_door: 'Ventana o puerta',
    mirror: 'Espejo',
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
    if (value.applicability === 'pending_operator_review') return 'Pendiente de operator';
    if (value.disclosure?.status === 'not_informed') return 'No informado';
    if (value.disclosure?.status === 'exception') return 'Excepción aprobada';
    if (value.disclosure?.status === 'informed') return money(value.disclosure.amount);
    return 'Pendiente';
  };
  const communication = (value) => ({
    blocked: 'Bloqueada', pending: 'Pendiente', ready: 'Pendiente de comunicar',
    communicated: 'Comunicada', needs_recommunication: 'Debe comunicarse otra vez'
  }[value?.status] || 'Sin dato');
  const reason = (appointment) => appointment?.cancellation?.reason || ({
    visit_fee_not_disclosed: 'Falta informar el costo de visita',
    operations_review_pending: 'Pendiente de revisión operativa',
    alternative_pending: 'Pendiente acordar otra fecha',
    other: 'Pendiente de gestión'
  }[appointment?.communication?.blockedReason] || '');
  const terminal = (appointment) => ['completed', 'cancelled', 'no_show'].includes(appointment?.status);
  const requiresResponse = (appointment) => !terminal(appointment) && (
    appointment.operationsReview?.status === 'pending' ||
    ['tentative', 'alternative_proposed'].includes(appointment.status) ||
    appointment.visitFee?.applicability === 'pending_operator_review' ||
    ['blocked', 'ready', 'needs_recommunication'].includes(appointment.communication?.status)
  );

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.formatters = { status, types, needs, asDate, dateTime, money, fee, communication, reason, terminal, requiresResponse };
})(window);
