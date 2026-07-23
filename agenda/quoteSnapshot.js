(function (global) {
  'use strict';

  const clone = (value) => JSON.parse(JSON.stringify(value));
  const idPart = () => global.crypto?.randomUUID
    ? global.crypto.randomUUID().replace(/-/g, '')
    : `${Date.now()}${Math.random().toString(36).slice(2)}`;
  const newQuoteId = () => `q_${idPart()}`;
  const encode = (value) => new TextEncoder().encode(value);
  const stable = (value) => {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === 'object') return Object.keys(value).sort().reduce((result, key) => {
      if (value[key] !== undefined) result[key] = stable(value[key]);
      return result;
    }, {});
    return value;
  };
  const sha256 = async (value) => {
    if (!global.crypto?.subtle) throw new Error('CRYPTO_UNAVAILABLE');
    const digest = await global.crypto.subtle.digest('SHA-256', encode(JSON.stringify(stable(value))));
    return `sha256:${Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  };
  const technicalAttributes = (raw = {}) => ({
    technicalVersion: 'cotizador-f0-3aedb52d',
    ...(raw.ancho !== undefined ? { widthCm: raw.ancho } : {}),
    ...(raw.ancho2 !== undefined ? { secondaryWidthCm: raw.ancho2 } : {}),
    ...(raw.alto !== undefined ? { heightCm: raw.alto } : {}),
    ...(raw.espesor !== undefined ? { thickness: raw.espesor } : {}),
    ...(raw.color_acc !== undefined ? { finishColor: raw.color_acc } : {}),
    ...(raw.sistema !== undefined ? { aluminumSystem: raw.sistema } : {}),
    ...(raw.config !== undefined ? { aluminumConfiguration: raw.config } : {}),
    ...(raw.led !== undefined ? { hasLed: Boolean(raw.led) } : {}),
    ...(raw.sandblasting !== undefined ? { hasSandblasting: Boolean(raw.sandblasting) } : {})
  });
  const itemFrom = (item) => ({
    productLabel: String(item.producto || 'Producto cotizado').slice(0, 300),
    measurements: String(item.medidas || '').slice(0, 300),
    quantity: Math.max(1, Number(item.cantidad || 1)),
    unitPrice: Math.round(Number(item.precioUnitario ?? item.precio ?? 0)),
    totalPrice: Math.round(Number(item.precio || 0)),
    ...(item.vidrio ? { glass: String(item.vidrio).slice(0, 200) } : {}),
    ...(item.color ? { color: String(item.color).slice(0, 200) } : {}),
    ...(item.observaciones ? { observations: String(item.observaciones).slice(0, 2000) } : {}),
    canonicalProductId: item.canonicalProductId ?? null,
    familyId: item.familyId ?? null,
    variantId: item.variantId ?? null,
    mappingStatus: String(item.mappingStatus || 'unmapped').slice(0, 80),
    canonicalAttributes: clone(item.canonicalAttributes || {}),
    rawAttributes: technicalAttributes(item.raw || {})
  });
  const build = async (context) => {
    if (!context || !Array.isArray(context.items) || context.items.length === 0) return null;
    const quoteId = context.quoteId || newQuoteId();
    const capturedAt = new Date().toISOString();
    const customer = {
      phone: String(context.customer?.phone || context.customer?.telefono || ''),
      ...(context.customer?.name || context.customer?.nombre ? { name: String(context.customer.name || context.customer.nombre).slice(0, 160) } : {}),
      ...(context.customer?.address || context.customer?.direccion ? { address: String(context.customer.address || context.customer.direccion).slice(0, 500) } : {})
    };
    const snapshot = {
      snapshotVersion: 1, capturedAt, currency: 'COP', customer,
      quote: { quoteId, ...(context.folio ? { folio: String(context.folio).replace(/^#/, '').slice(0, 120) } : {}) },
      items: context.items.slice(0, 100).map(itemFrom),
      quotedTotal: Math.round(Number(context.total || context.items.reduce((sum, item) => sum + Number(item.precio || 0), 0)))
    };
    snapshot.snapshotHash = await sha256(snapshot);
    return Object.freeze({
      quoteRef: Object.freeze({ quoteId, ...(context.folio ? { folio: String(context.folio).replace(/^#/, '').slice(0, 120) } : {}), source: 'cotizador' }),
      snapshot: Object.freeze(clone(snapshot))
    });
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.quoteSnapshot = { newQuoteId, stable, sha256, technicalAttributes, itemFrom, build };
})(window);
