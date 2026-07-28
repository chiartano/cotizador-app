(function (global) {
  'use strict';

  const inspect = (raw) => {
    const visible = String(raw || '').trim();
    if (!visible || !/^[+0-9().\-\s]+$/.test(visible)) return null;
    if ((visible.match(/\+/g) || []).length > 1 || (visible.includes('+') && !visible.startsWith('+'))) return null;
    const internationalPrefix = visible.startsWith('+') || visible.startsWith('00');
    const digits = visible.replace(/\D/g, '').replace(/^00/, '');
    if (digits.length < 7 || digits.length > 15) return null;
    if (/^3\d{9}$/.test(digits) && !internationalPrefix) return { normalized: `+57${digits}`, ambiguous: false };
    if (/^573\d{9}$/.test(digits) && !visible.startsWith('+')) return { normalized: `+${digits}`, ambiguous: false };
    return { normalized: `+${digits}`, ambiguous: !internationalPrefix };
  };
  const warning = (raw) => {
    const value = inspect(raw);
    if (!value) return '';
    if (value.ambiguous) return `Guardaremos ${value.normalized}. Confirma que incluye el código de país.`;
    return String(raw).trim() === value.normalized ? '' : `Formato normalizado: ${value.normalized}. Conservaremos el número como lo escribiste.`;
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.phone = { inspect, warning };
})(window);
