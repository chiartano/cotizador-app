(function (global) {
  'use strict';

  const SCHEMA_VERSION = 'product-spec.v1';
  const AMBIGUOUS_MAPPING = new Set(['split_required', 'review_manual', 'unmapped']);
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const confirmed = (value, unit) => ({ status: 'confirmed', value, ...(unit ? { unit } : {}) });
  const unknown = () => ({ status: 'unknown' });
  const notApplicable = () => ({ status: 'not_applicable' });
  const numberFrom = (value) => {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  };
  const thicknessMm = (value) => {
    const match = String(value || '').match(/(\d+(?:\.\d+)?)/);
    return match ? numberFrom(match[1]) : null;
  };
  const at = (value, path) => path.split('.').reduce((current, key) => current?.[key], value);

  const FAMILY_RULES = Object.freeze({
    DB: Object.freeze({
      id: 'DB.v1',
      required: Object.freeze([
        'product.system', 'glass.type', 'glass.thickness', 'glass.finish',
        'hardware.color', 'dimensions.width', 'dimensions.height', 'dimensions.quantity',
      ]),
      risk: Object.freeze({
        fabrication: Object.freeze(['product.system', 'glass.type', 'glass.thickness', 'glass.finish', 'dimensions.width', 'dimensions.height', 'dimensions.secondaryWidth']),
        installation: Object.freeze(['hardware.color', 'hardware.kit', 'product.opening']),
        commercial: Object.freeze(['dimensions.quantity', 'addons']),
      }),
    }),
    ESP: Object.freeze({
      id: 'ESP.v1',
      required: Object.freeze(['product.system', 'glass.type', 'dimensions.width', 'dimensions.height', 'dimensions.quantity']),
      risk: Object.freeze({
        fabrication: Object.freeze(['product.system', 'glass.type', 'dimensions.width', 'dimensions.height']),
        installation: Object.freeze(['addons']),
        commercial: Object.freeze(['dimensions.quantity']),
      }),
    }),
    VEN: Object.freeze({
      id: 'VEN.v1',
      required: Object.freeze([
        'product.system', 'product.configuration', 'glass.type', 'glass.thickness', 'glass.finish',
        'frame.color', 'dimensions.width', 'dimensions.height', 'dimensions.quantity',
      ]),
      risk: Object.freeze({
        fabrication: Object.freeze(['product.system', 'product.configuration', 'glass.type', 'glass.thickness', 'glass.finish', 'dimensions.width', 'dimensions.height']),
        installation: Object.freeze(['frame.color', 'hardware.kit', 'hardware.color', 'product.opening', 'addons']),
        commercial: Object.freeze(['dimensions.quantity']),
      }),
    }),
  });

  const FIELD_LABELS = Object.freeze({
    'product.system': 'sistema/modelo',
    'product.configuration': 'configuración',
    'product.opening': 'sentido/apertura',
    'glass.type': 'tipo de vidrio',
    'glass.thickness': 'espesor del vidrio',
    'glass.finish': 'acabado del vidrio',
    'frame.color': 'color de perfilería',
    'hardware.kit': 'kit/herrajes',
    'hardware.color': 'color de accesorios/herrajes',
    'dimensions.width': 'ancho',
    'dimensions.height': 'alto',
    'dimensions.quantity': 'cantidad',
  });

  const identityFrom = (metadata = {}) => ({
    canonicalProductId: metadata.canonicalProductId ?? null,
    familyId: metadata.familyId ?? null,
    variantId: metadata.variantId ?? null,
    mappingStatus: metadata.mappingStatus || 'unmapped',
    canonicalAttributes: clone(metadata.canonicalAttributes || {}),
  });

  const completenessFor = (identity, attributes) => {
    const rule = FAMILY_RULES[identity.familyId];
    const missing = rule ? rule.required.filter((path) => at(attributes, path)?.status !== 'confirmed') : [];
    const status = AMBIGUOUS_MAPPING.has(identity.mappingStatus) || !rule
      ? 'manual_review'
      : missing.length ? 'incomplete' : 'complete';
    return { status, missing };
  };

  const create = (metadata, attributes) => {
    const identity = identityFrom(metadata);
    return {
      schemaVersion: SCHEMA_VERSION,
      identity,
      familyRuleId: FAMILY_RULES[identity.familyId]?.id || null,
      attributes,
      completeness: completenessFor(identity, attributes),
    };
  };

  const mainGlassFinish = (value) => value === 'transparent'
    ? confirmed('TRANSPARENT')
    : value === 'sandblasted' ? confirmed('SANDBLASTED') : unknown();

  const buildMain = ({ metadata, productName, widthCm, secondaryWidthCm, heightCm, thickness, hardwareColor, glassFinish, hasLed, quantity = 1 }) => {
    const familyId = metadata?.familyId;
    const isMirror = familyId === 'ESP';
    const width = numberFrom(widthCm);
    const secondaryWidth = numberFrom(secondaryWidthCm);
    const height = numberFrom(heightCm);
    const thicknessValue = thicknessMm(thickness);
    const attributes = {
      product: {
        system: productName ? confirmed(String(productName)) : unknown(),
        configuration: metadata?.variantId ? confirmed(String(metadata.variantId)) : unknown(),
        opening: unknown(),
      },
      glass: {
        type: isMirror ? confirmed('MIRROR') : (thicknessValue ? confirmed('TEMPERED') : unknown()),
        thickness: isMirror ? notApplicable() : (thicknessValue ? confirmed(thicknessValue, 'mm') : unknown()),
        finish: isMirror ? notApplicable() : mainGlassFinish(glassFinish),
      },
      frame: { color: familyId === 'VEN' ? unknown() : notApplicable() },
      hardware: {
        kit: isMirror ? notApplicable() : unknown(),
        color: isMirror ? notApplicable() : (hardwareColor ? confirmed(String(hardwareColor).toUpperCase()) : unknown()),
      },
      dimensions: {
        width: width ? confirmed(width, 'cm') : unknown(),
        height: height ? confirmed(height, 'cm') : unknown(),
        secondaryWidth: secondaryWidth ? confirmed(secondaryWidth, 'cm') : notApplicable(),
        quantity: confirmed(Math.max(1, Number(quantity) || 1), 'unit'),
      },
      addons: hasLed ? [{ code: 'LED', status: 'confirmed' }] : [],
    };
    return create(metadata, attributes);
  };

  const aluminumGlass = (key, label) => {
    const source = `${key || ''} ${label || ''}`.toLowerCase();
    const thicknessValue = thicknessMm(source);
    let type = unknown();
    if (source.includes('frozen')) type = confirmed('FROZEN');
    else if (source.includes('templado')) type = confirmed('TEMPERED');
    else if (source.includes('laminado')) type = confirmed('LAMINATED');
    else if (source.includes('crudo')) type = confirmed('ANNEALED');
    return {
      type,
      thickness: thicknessValue ? confirmed(thicknessValue, 'mm') : unknown(),
      finish: source.includes('frozen') ? confirmed('FROZEN') : unknown(),
    };
  };

  const buildAluminum = ({ metadata, system, configuration, glassKey, glassLabel, frameColor, widthCm, heightCm, quantity = 1, extras = {} }) => create(metadata, {
    product: {
      system: system ? confirmed(String(system)) : unknown(),
      configuration: configuration ? confirmed(String(configuration)) : unknown(),
      opening: unknown(),
    },
    glass: aluminumGlass(glassKey, glassLabel),
    frame: { color: frameColor ? confirmed(String(frameColor).toUpperCase()) : unknown() },
    hardware: { kit: unknown(), color: unknown() },
    dimensions: {
      width: numberFrom(widthCm) ? confirmed(numberFrom(widthCm), 'cm') : unknown(),
      height: numberFrom(heightCm) ? confirmed(numberFrom(heightCm), 'cm') : unknown(),
      secondaryWidth: notApplicable(),
      quantity: confirmed(Math.max(1, Number(quantity) || 1), 'unit'),
    },
    addons: [
      extras.fixedBody ? { code: 'FIXED_BODY', status: 'confirmed' } : null,
      extras.alfajia ? { code: 'ALFAJIA', status: 'confirmed' } : null,
      extras.mosquitoScreen ? { code: 'MOSQUITO_SCREEN', status: 'confirmed' } : null,
    ].filter(Boolean),
  });

  const displayValue = (attribute) => {
    if (!attribute || attribute.status !== 'confirmed') return null;
    return `${attribute.value}${attribute.unit === 'mm' ? ' MM' : attribute.unit === 'cm' ? ' CM' : ''}`;
  };

  const summary = (spec) => {
    if (!spec || spec.schemaVersion !== SCHEMA_VERSION) return null;
    const attributes = spec.attributes || {};
    const critical = [
      displayValue(attributes.glass?.thickness),
      displayValue(attributes.glass?.type),
      displayValue(attributes.glass?.finish),
      displayValue(attributes.hardware?.color) || displayValue(attributes.frame?.color),
    ].filter(Boolean);
    const dimensions = [displayValue(attributes.dimensions?.width), displayValue(attributes.dimensions?.secondaryWidth), displayValue(attributes.dimensions?.height)].filter(Boolean);
    const system = displayValue(attributes.product?.system);
    return {
      critical: [...new Set(critical)].join(' · '),
      secondary: [dimensions.length ? dimensions.join(' × ') : '', system ? `Sistema ${system}` : ''].filter(Boolean).join(' · '),
      missing: (spec.completeness?.missing || []).map((path) => FIELD_LABELS[path] || path),
      status: spec.completeness?.status || 'manual_review',
    };
  };

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.productSpec = {
    SCHEMA_VERSION, FAMILY_RULES, FIELD_LABELS, confirmed, unknown, notApplicable,
    identityFrom, completenessFor, create, buildMain, buildAluminum, summary,
  };
})(window);
