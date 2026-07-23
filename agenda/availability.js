(function (global) {
  'use strict';

  const WEEKDAY = Object.freeze([
    ['09:00', '11:00'], ['11:00', '13:00'], ['13:00', '15:00'], ['15:00', '17:00']
  ]);
  const SATURDAY = Object.freeze([['08:00', '10:00'], ['10:00', '12:00']]);
  const SATURDAY_EXCEPTION = Object.freeze(['12:00', '13:00']);
  const INSTALL_DURATIONS = Object.freeze([180, 240, 300, 360]);

  const isoFor = (date, time) => new Date(`${date}T${time}:00-05:00`).toISOString();
  const dayFor = (date) => new Date(`${date}T12:00:00-05:00`).getDay();
  const blockId = (date, start) => `cotizador-${date}-${start.replace(':', '')}`;
  const blocksForDate = (date, options = {}) => {
    if (!date) return [];
    const day = dayFor(date);
    const source = day >= 1 && day <= 5 ? WEEKDAY : day === 6 ? SATURDAY : [];
    const blocks = source.map(([start, end]) => ({
      start, end, durationMinutes: (Number(end.slice(0, 2)) - Number(start.slice(0, 2))) * 60,
      schedule: {
        state: 'scheduled', timezone: 'America/Bogota', availabilitySource: 'routine_block',
        startAt: isoFor(date, start), endAt: isoFor(date, end), blockId: blockId(date, start)
      }
    }));
    if (day === 6 && options.saturdayException?.enabled === true) {
      const [start, end] = SATURDAY_EXCEPTION;
      blocks.push({
        start, end, durationMinutes: 60,
        schedule: {
          state: 'scheduled', timezone: 'America/Bogota', availabilitySource: 'exceptional_block',
          startAt: isoFor(date, start), endAt: isoFor(date, end), blockId: blockId(date, start),
          availabilityOverrideId: options.saturdayException.id
        }
      });
    }
    return blocks;
  };
  const installSchedule = (date, start, durationMinutes) => {
    const startAt = new Date(`${date}T${start}:00-05:00`);
    const endAt = new Date(startAt.getTime() + Number(durationMinutes) * 60000);
    return {
      state: 'held', timezone: 'America/Bogota', availabilitySource: 'routine_block',
      startAt: startAt.toISOString(), endAt: endAt.toISOString(), blockId: blockId(date, start)
    };
  };
  const installBlocksForDate = (date, durationMinutes) => {
    const day = dayFor(date);
    const open = day >= 1 && day <= 5 ? 9 : day === 6 ? 8 : null;
    const close = day >= 1 && day <= 5 ? 17 : day === 6 ? 13 : null;
    if (open === null) return [];
    const hours = Number(durationMinutes) / 60;
    const result = [];
    for (let hour = open; hour + hours <= close; hour += 1) {
      const start = `${String(hour).padStart(2, '0')}:00`;
      result.push({ start, durationMinutes: Number(durationMinutes), schedule: installSchedule(date, start, durationMinutes) });
    }
    return result;
  };
  const occupancy = (appointments, schedule) => (appointments || []).filter((item) => {
    if (!['tentative', 'confirmed'].includes(item.status)) return false;
    return Date.parse(item.schedule?.startAt) < Date.parse(schedule.endAt)
      && Date.parse(item.schedule?.endAt) > Date.parse(schedule.startAt);
  }).length;
  const availabilityText = (count) => count >= 2
    ? 'Capacidad visible agotada; el backend decide al enviar.'
    : count === 1
      ? 'Hay una visita en este bloque; quedará provisional para revisión.'
      : 'Disponible según la Agenda visible.';

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.availability = {
    WEEKDAY, SATURDAY, SATURDAY_EXCEPTION, INSTALL_DURATIONS,
    blocksForDate, installSchedule, installBlocksForDate, occupancy, availabilityText
  };
})(window);
