/* ================================================================
 * COTIZADOR PRO v5.0 - Módulo independiente: INTELIGENCIA (IQ)
 * Hace que el cotizador piense por el vendedor:
 *   - Restricciones técnicas (medidas, vidrios, sistemas)
 *   - Recomendaciones de mejor sistema/producto
 *   - Bloqueos suaves de errores graves (confirm dialog)
 *   - Upsells de valor real con 1-toque para aplicar
 *   - Plantillas rápidas para empezar en 1 segundo
 * Todo prefijado con iq_ / IQ_ para no colisionar.
 * Si este archivo no se carga, la app sigue funcionando exacto igual.
 * ================================================================ */
"use strict";

// =================================================================
// 1. REGLAS TÉCNICAS POR SISTEMA / PRODUCTO
// =================================================================
// Estructura por entrada:
//   ancho.min / .max      → si está fuera, error grave (bloquea)
//   ancho.idealMin/Max    → si está fuera del rango ideal, advertencia
//   alto.min/.max/.ideal*  → idem
//   areaMax (m²)           → si supera, advertencia o bloqueo
//   vidriosOK              → arr de claves de vidrio compatibles (warning si no)
//   vidriosNO              → arr de claves prohibidas (bloquea)
//   vidrioSugerido         → vidrio que recomendamos
//   naveMaxCm              → para corredizas: ancho máximo de cada nave móvil
//   hojaMaxCm              → para batientes: ancho máximo de hoja
//   nota                   → tip breve para mostrar
const IQ_REGLAS_ALU = {
    '3831': { // VC3831 Abatible
        ancho:  { min:40,  max:200, idealMin:50,  idealMax:160 },
        alto:   { min:40,  max:220, idealMin:50,  idealMax:180 },
        areaMaxIdeal: 2.4,
        hojaMaxCm: 90,                 // hoja batiente pesada arriba de 90cm
        vidriosOK: ['4mm','5mm','6mm','Frozen 4mm','Frozen 5mm','3+3','4+4'],
        vidrioSugerido: '5mm',
        nota: 'Abatible: hojas pesadas castigan bisagras. Ideal vidrios livianos.'
    },
    '5020': { // VC5020 Corrediza Liviana
        ancho:  { min:80,  max:240, idealMin:100, idealMax:200 },
        alto:   { min:60,  max:180, idealMin:80,  idealMax:160 },
        areaMaxIdeal: 3.2,
        naveMaxCm: 90,
        vidriosOK: ['4mm','5mm','6mm','Frozen 4mm','Frozen 5mm'],
        vidriosNO: ['10mm'],          // perfil ligero, no soporta 10mm
        vidrioSugerido: '6mm',
        nota: 'Corrediza liviana. Ideal vanos chicos y medianos.'
    },
    '744': { // PC744 Corrediza Tradicional
        ancho:  { min:100, max:320, idealMin:140, idealMax:280 },
        alto:   { min:80,  max:220, idealMin:100, idealMax:200 },
        areaMaxIdeal: 5.5,
        naveMaxCm: 130,
        vidriosOK: ['5mm','6mm','8mm','3+3','4+4','5+5'],
        vidrioSugerido: '6mm',
        nota: 'Corrediza tradicional. Aguanta vanos grandes con seguridad.'
    },
    '8025': { // VC8025 Puerta
        ancho:  { min:140, max:400, idealMin:180, idealMax:340 },
        alto:   { min:200, max:240, idealMin:205, idealMax:230 }, // ES PUERTA
        areaMaxIdeal: 7.5,
        naveMaxCm: 100,
        vidriosOK: ['6mm','8mm','10mm','3+3','4+4','5+5'],
        vidriosNO: ['4mm','5mm','Frozen 4mm','Frozen 5mm'],   // puerta: prohibido vidrio fino
        vidrioSugerido: '8mm',
        nota: 'Puerta. Mínimo 200cm de alto y vidrio templado 6mm+.'
    }
};

const IQ_REGLAS_PRINCIPAL = {
    "División Batiente (Tradicional)": {
        ancho: { min:50,  max:160, idealMin:60,  idealMax:140 },
        alto:  { min:140, max:230, idealMin:160, idealMax:220 },
        espesoresOK: ['6mm','8mm'],
        espesoresNO: [],
        espesorSugerido: '8mm',
        nota: 'División fija batiente. Vidrio templado obligatorio.'
    },
    "División Corrediza Clásica": {
        ancho: { min:90,  max:200, idealMin:100, idealMax:180 },
        alto:  { min:160, max:220, idealMin:170, idealMax:210 },
        espesoresOK: ['8mm','10mm'],
        espesoresNO: [],
        espesorSugerido: '8mm',
        nota: 'Corrediza estándar. Necesita 8mm para deslizar firme.'
    },
    "División Corrediza Premium": {
        ancho: { min:90,  max:240, idealMin:110, idealMax:220 },
        alto:  { min:160, max:240, idealMin:180, idealMax:230 },
        espesoresOK: ['8mm','10mm'],
        espesoresNO: ['6mm'],
        espesorSugerido: '10mm',
        nota: 'Premium con riel oculto. Vidrio 8mm mínimo.'
    },
    "División de baño L - Corrediza": {
        ancho: { min:60,  max:150, idealMin:80,  idealMax:130 },
        alto:  { min:160, max:220, idealMin:170, idealMax:210 },
        espesoresOK: ['8mm','10mm'],
        espesoresNO: ['6mm'],
        espesorSugerido: '8mm',
        nota: 'Esquinera con herrajes 90°. Vidrio 8mm.'
    },
    "División de baño L - Batiente": {
        ancho: { min:60,  max:150, idealMin:80,  idealMax:130 },
        alto:  { min:160, max:220, idealMin:170, idealMax:210 },
        espesoresOK: ['6mm','8mm'],
        espesoresNO: [],
        espesorSugerido: '8mm',
        nota: 'Esquinera fija. Más estable que corrediza.'
    },
    "Cortaviento / Oficina": {
        ancho: { min:40,  max:300, idealMin:60,  idealMax:250 },
        alto:  { min:50,  max:300, idealMin:80,  idealMax:250 },
        espesoresOK: ['6mm','8mm','10mm'],
        espesoresNO: [],
        espesorSugerido: '8mm',
        nota: 'Mampara/cortaviento. Cualquier altura.'
    },
    "Espejo Flotante": {
        ancho: { min:30,  max:200, idealMin:40,  idealMax:180 },
        alto:  { min:40,  max:200, idealMin:60,  idealMax:180 },
        areaMaxIdeal: 2.5,
        nota: 'Espejo. Si >2.5m² considerar dividir por peso.'
    }
};

// =================================================================
// 2. PLANTILLAS RÁPIDAS (cargan todo con 1 toque)
// =================================================================
const IQ_PLANTILLAS = [
    // --- Cotizador principal ---
    { id:'plt-ducha-std',   modo:'principal', emoji:'🚿', nombre:'Ducha estándar 90×190',
      datos:{ producto:'División Corrediza Clásica', espesor:'8mm', ancho:90, alto:190 } },
    { id:'plt-ducha-amp',   modo:'principal', emoji:'🚿', nombre:'Ducha amplia 120×200',
      datos:{ producto:'División Corrediza Premium', espesor:'8mm', ancho:120, alto:200 } },
    { id:'plt-bano-L',      modo:'principal', emoji:'📐', nombre:'Baño en L 80+90×200',
      datos:{ producto:'División de baño L - Corrediza', espesor:'8mm', ancho:80, ancho2:90, alto:200 } },
    { id:'plt-espejo',      modo:'principal', emoji:'🪞', nombre:'Espejo baño 70×100',
      datos:{ producto:'Espejo Flotante', ancho:70, alto:100 } },
    { id:'plt-cortav',      modo:'principal', emoji:'💼', nombre:'Cortaviento oficina 150×200',
      datos:{ producto:'Cortaviento / Oficina', espesor:'8mm', ancho:150, alto:200 } },
    // --- Cotizador aluminio ---
    { id:'plt-vent-bano',   modo:'aluminio',  emoji:'🪟', nombre:'Ventana baño 80×60',
      datos:{ sistema:'3831', config:'1H', ancho:80, alto:60, vidrio:'Frozen 4mm' } },
    { id:'plt-vent-dorm',   modo:'aluminio',  emoji:'🛏️', nombre:'Ventana dormitorio 120×100',
      datos:{ sistema:'5020', config:'2N', ancho:120, alto:100, vidrio:'6mm' } },
    { id:'plt-vent-sala',   modo:'aluminio',  emoji:'🛋️', nombre:'Ventana sala 240×140',
      datos:{ sistema:'744', config:'3N', ancho:240, alto:140, vidrio:'6mm' } },
    { id:'plt-puerta',      modo:'aluminio',  emoji:'🚪', nombre:'Puerta patio 240×210',
      datos:{ sistema:'8025', config:'2N', ancho:240, alto:210, vidrio:'8mm' } }
];

// =================================================================
// 3. ÚLTIMA EVALUACIÓN (para que viz.js / debugging la consulten)
// =================================================================
let iq_ultimaEvaluacion = null;

// =================================================================
// 4. API PÚBLICA - ANÁLISIS POST-CÁLCULO
// =================================================================
// Llamada por app.js::calcular() (1 línea de hook)
function iq_analizarPrincipal() {
    if (typeof lastCalculation === 'undefined' || !lastCalculation) return;
    const raw = lastCalculation.raw;
    const producto = raw.producto;
    const regla = IQ_REGLAS_PRINCIPAL[producto];
    if (!regla) {
        // Producto sin reglas (raro). Limpiamos la banda.
        _iq_pintarStrip('main', { warnings:[], recommends:[], upsells:[] });
        return;
    }

    const esEspejo = producto.includes('Espejo');
    const esLEspecial = producto.includes('División de baño L -');
    const anchoCm = raw.ancho;
    const ancho2Cm = raw.ancho2 || 0;
    const altoCm = raw.alto;
    const anchoTotalCm = esLEspecial ? (anchoCm + ancho2Cm) : anchoCm;
    const espesor = raw.espesor;
    const colorAcc = raw.color_acc;
    const tieneSandblasting = raw.sandblasting;
    const tieneLed = raw.led;
    const tieneDesmonte = raw.desmonte;
    const linea = raw.linea;

    const warnings = [];
    const recommends = [];
    const upsells = [];

    // ----- WARNINGS DE MEDIDAS -----
    // Cada mensaje explica QUÉ pasa técnicamente y QUÉ CONSECUENCIA tiene,
    // para que el vendedor forme criterio y no obedezca a ciegas.
    if (anchoTotalCm < regla.ancho.min) {
        warnings.push({ nivel:'error',
            txt:`Ancho ${anchoTotalCm}cm queda por debajo del mínimo del sistema (${regla.ancho.min}cm). Los herrajes laterales y perfiles ya consumen ~6–8cm; debajo de ese mínimo no queda vidrio útil y la pieza se ve forzada. Si la medida es real, conviene cambiar a una tipología más chica (espejo, batiente).` });
    } else if (anchoTotalCm > regla.ancho.max) {
        warnings.push({ nivel:'error',
            txt:`Ancho ${anchoTotalCm}cm excede el máximo del sistema (${regla.ancho.max}cm). Un solo paño tan ancho flexa por su propio peso, los herrajes trabajan al límite y el riel se desalinea con el uso. Lo correcto es dividir en 2 paños o pasar a un sistema más robusto.` });
    } else if (regla.ancho.idealMin && anchoTotalCm < regla.ancho.idealMin) {
        warnings.push({ nivel:'info',
            txt:`Ancho ${anchoTotalCm}cm está por debajo del rango típico (${regla.ancho.idealMin}–${regla.ancho.idealMax}cm). Funciona, pero la proporción herrajes/vidrio se ve desbalanceada — el cliente puede preguntar por qué los marcos se ven tan anchos. Vale confirmar las medidas antes de cotizar.` });
    } else if (regla.ancho.idealMax && anchoTotalCm > regla.ancho.idealMax) {
        warnings.push({ nivel:'info',
            txt:`Ancho ${anchoTotalCm}cm pasa el rango típico (${regla.ancho.idealMin}–${regla.ancho.idealMax}cm). Aún dentro del límite del sistema, pero el peso por hoja sube de forma notoria: la sensación al usar se vuelve más pesada. Confirma medidas y considera reforzar fijaciones superiores.` });
    }

    if (altoCm < regla.alto.min) {
        warnings.push({ nivel:'error',
            txt:`Alto ${altoCm}cm es muy bajo para ${producto} (mín ${regla.alto.min}cm). En una división de baño, debajo de eso el agua salpicaría por encima del vidrio en cada ducha — la pieza pierde su función principal.` });
    } else if (altoCm > regla.alto.max) {
        warnings.push({ nivel:'error',
            txt:`Alto ${altoCm}cm supera el máximo (${regla.alto.max}cm). Los parantes verticales no están diseñados para tanta luz: ganan vibración, los anclajes superiores trabajan al límite y la rigidez del conjunto cae notoriamente.` });
    }

    // ----- ÁREA / ESPESOR -----
    const areaM2 = (anchoTotalCm * altoCm) / 10000;
    if (regla.areaMaxIdeal && areaM2 > regla.areaMaxIdeal) {
        warnings.push({ nivel:'warn',
            txt:`Área ${areaM2.toFixed(2)}m² queda por encima del área ideal (${regla.areaMaxIdeal}m²). El vidrio templado pesa ~25kg/m²; a esta superficie, bisagras y fijaciones trabajan cerca de su tope. Funciona, pero refuerza anclajes y advierte al cliente que no debe colgar toallas ni objetos del vidrio.` });
    }

    // ----- VIDRIO -----
    if (!esEspejo && regla.espesoresNO && regla.espesoresNO.includes(espesor)) {
        warnings.push({ nivel:'error',
            txt:`Vidrio ${espesor} no cumple con la seguridad mínima para ${producto}. Esta tipología recibe golpes accidentales (puertas, codos, productos de aseo) y por debajo de ${regla.espesorSugerido} templado el riesgo real es estallido por impacto. Subir a ${regla.espesorSugerido} es obligación técnica, no preferencia.` });
        recommends.push({
            id:'rec-vidrio-suba',
            txt:`Subir vidrio a ${regla.espesorSugerido} templado (cumple norma de seguridad)`,
            apply: { type:'main_setEspesor', value: regla.espesorSugerido }
        });
    } else if (!esEspejo && regla.espesoresOK && !regla.espesoresOK.includes(espesor)) {
        warnings.push({ nivel:'warn',
            txt:`Vidrio ${espesor} se puede usar, pero ${regla.espesorSugerido} es el espesor con el que ${producto} fue diseñada. La diferencia real para el cliente: la puerta se siente más sólida al cerrar y la corrediza desliza más estable con el uso. Si no hay tope de presupuesto, conviene subir.` });
        recommends.push({
            id:'rec-vidrio-ideal',
            txt:`Cambiar a ${regla.espesorSugerido} (espesor con el que fue probada esta tipología)`,
            apply: { type:'main_setEspesor', value: regla.espesorSugerido }
        });
    }

    // ----- RECOMENDACIONES DE PRODUCTO -----
    // Premium con vano chico → Clásica cubre lo mismo con menor costo
    if (producto === 'División Corrediza Premium' && anchoTotalCm < 100 && altoCm < 200) {
        recommends.push({
            id:'rec-bajar-clasica',
            txt:`Vano chico para Premium: la Clásica usa los mismos espesores de vidrio y a este tamaño la diferencia visual es mínima. Ahorro real (~$100k) sin perder calidad estructural.`,
            apply: { type:'main_setProducto', value:'División Corrediza Clásica' }
        });
    }
    // Batiente con vano grande → corrediza es la elección práctica
    if (producto === 'División Batiente (Tradicional)' && anchoTotalCm > 140) {
        recommends.push({
            id:'rec-pasar-corrediza',
            txt:`Con ${anchoTotalCm}cm de ancho la batiente queda muy pesada de abrir: cada apertura levanta una hoja larga sobre una sola bisagra. Una corrediza desliza ese peso sobre rieles y es la elección lógica encima de 140cm.`,
            apply: { type:'main_setProducto', value:'División Corrediza Clásica' }
        });
    }
    // Espejo muy grande: dividir o fijar mecánicamente
    if (esEspejo && areaM2 > 2.5) {
        warnings.push({ nivel:'warn',
            txt:`Espejo de ${areaM2.toFixed(1)}m² supera el área manejable como pieza única (~25kg/m²). A este tamaño, dos personas lo cargan al límite y el adhesivo o clips trabajan al borde de su capacidad. Lo profesional es dividir en 2 piezas iguales o sumar fijación mecánica con perfil superior.` });
    }

    // ----- SUGERENCIAS PARA EL MENSAJE DE WHATSAPP -----
    // No tocan el cálculo: son textos opcionales que el vendedor decide
    // incluir o no en el mensaje final. Idea: mencionar productos
    // relacionados con suavidad, sin imponérselos al cliente.
    if (esEspejo && !tieneLed) {
        upsells.push({
            id:'up-led',
            emoji:'✨',
            label:'Mencionar versión con luz LED retroiluminada',
            hint:'Diferencial premium para baños tipo hotel. El cliente lo decide si le interesa.',
            waText:'\n✨ *También lo manejo con luz LED retroiluminada* (efecto baño tipo hotel). Si te llama la atención, te paso el adicional.'
        });
    }
    if (!esEspejo && !tieneSandblasting && (producto.includes('División') || producto.includes('Espejo'))) {
        upsells.push({
            id:'up-sandblasting',
            emoji:'🌫️',
            label:'Mencionar opción con sandblasting (esmerilado)',
            hint:'Privacidad sin perder luz. Útil si la ducha queda visible desde afuera.',
            waText:'\n🌫️ Si buscas más privacidad, también lo hago con *sandblasting* (esmerilado parcial o total del vidrio). Coméntame si quieres y te cotizo la diferencia.'
        });
    }
    if (colorAcc === 'natural' && (producto === 'División Corrediza Premium' || producto === 'División de baño L - Corrediza')) {
        upsells.push({
            id:'up-color-negro',
            emoji:'⚫',
            label:'Mencionar opción en acabado negro mate',
            hint:'Tendencia actual, look moderno. Para clientes que valoran el detalle visual.',
            waText:'\n⚫ Esta misma división la tengo en *accesorios negro mate*, si te gusta una onda más moderna. Si quieres, te paso fotos de cómo queda.'
        });
    }
    if (linea === 'controlada' && (producto === 'División Corrediza Premium' || producto === 'División de baño L - Corrediza')) {
        upsells.push({
            id:'up-linea-empresa',
            emoji:'🏆',
            label:'Mencionar línea con 18 meses de garantía',
            hint:'Para clientes que valoran respaldo a largo plazo.',
            waText:'\n🏆 También tengo una *línea con 18 meses de garantía escrita* (en vez de 12) para quienes prefieren más respaldo. Si te interesa te paso el adicional.'
        });
    }
    if (!tieneDesmonte && (producto.includes('División de baño') || producto.includes('Corrediza'))) {
        upsells.push({
            id:'up-desmonte',
            emoji:'🧰',
            label:'Recordar que ofrezco desmonte del sistema viejo',
            hint:'Servicio aparte: dile que existe si tiene algo previo, pero no lo regales.',
            waText:'\n🧰 Si tienes un sistema viejo que retirar antes de instalar, *también hago el desmonte*. Pregúntame y te paso el costo.'
        });
    }

    // ----- VENTA CRUZADA (productos relacionados) -----
    // El cliente que compra una pieza para el baño suele necesitar otra.
    // Mencionar el producto complementario con suavidad abre una segunda venta.
    if (producto.includes('División de baño') || producto.includes('Corrediza') || producto.includes('Batiente')) {
        // Quien pone división de baño casi siempre quiere espejo en el mismo baño
        upsells.push({
            id:'up-cross-espejo',
            emoji:'🪞',
            label:'Ofrecer espejo a juego para el mismo baño',
            hint:'Venta cruzada natural: mismo baño, misma visita de instalación. Sube el ticket sin nuevo desplazamiento.',
            waText:'\n🪞 Ya que voy a tu baño, *también hago espejos a medida* (flotantes, con o sin luz LED). Si quieres uno a juego con la división, te lo cotizo y lo instalo en la misma visita.'
        });
    }
    if (esEspejo) {
        // Quien compra espejo de baño es candidato a división de ducha
        upsells.push({
            id:'up-cross-division',
            emoji:'🚿',
            label:'Ofrecer división de baño / ducha a juego',
            hint:'Venta cruzada natural: si está renovando el baño, la división suele ser el siguiente paso.',
            waText:'\n🚿 Si estás renovando el baño, *también hago divisiones de ducha en vidrio templado* (corredizas y batientes). Avísame y te paso una cotización a juego.'
        });
    }
    if (producto.includes('División') || producto.includes('Corrediza') || producto.includes('Batiente')) {
        // Aluminio: ventanas/puertas para el resto de la obra
        upsells.push({
            id:'up-cross-aluminio',
            emoji:'🪟',
            label:'Mencionar ventanas y puertas en aluminio',
            hint:'Para obra nueva o remodelación: el cliente puede necesitar ventanería en otros ambientes.',
            waText:'\n🪟 Además de vidrio templado, *trabajo ventanería y puertas en aluminio* (corredizas, proyectantes, batientes). Si tienes otros ambientes por resolver, con gusto te cotizo.'
        });
    }

    const evaluacion = { modo:'principal', warnings, recommends, upsells, areaM2 };
    iq_ultimaEvaluacion = evaluacion;
    _iq_pintarStrip('main', evaluacion);
}

// =================================================================
// 5. ANÁLISIS POST-CÁLCULO - ALUMINIO
// =================================================================
function iq_analizarAluminio() {
    if (typeof aluLastCalc === 'undefined' || !aluLastCalc) return;
    const r = aluLastCalc;
    const regla = IQ_REGLAS_ALU[r.sys];
    if (!regla) {
        _iq_pintarStrip('alu', { warnings:[], recommends:[], upsells:[] });
        return;
    }

    const warnings = [];
    const recommends = [];
    const upsells = [];

    const areaM2 = (r.w * r.h) / 10000;

    // ----- MEDIDAS -----
    // Cada mensaje explica el riesgo técnico y la consecuencia real.
    if (r.w < regla.ancho.min) {
        warnings.push({ nivel:'error',
            txt:`Ancho ${r.w}cm queda por debajo del mínimo del sistema (${regla.ancho.min}cm). Los perfiles laterales ocupan ~7cm en total; debajo del mínimo casi no queda vidrio visible y la ventana se ve sobredimensionada de perfilería. Conviene revisar la medida o pasar a un sistema más liviano.` });
    } else if (r.w > regla.ancho.max) {
        warnings.push({ nivel:'error',
            txt:`Ancho ${r.w}cm supera el máximo del sistema (${regla.ancho.max}cm). El perfil cabecero se vence por gravedad a esa luz y queda con holguras visibles; con viento, la ventana vibra notoriamente. Pasa a un sistema con perfilería más profunda.` });
    } else if (r.w < regla.ancho.idealMin) {
        warnings.push({ nivel:'info',
            txt:`Ancho ${r.w}cm queda chico para este sistema (típico ${regla.ancho.idealMin}–${regla.ancho.idealMax}cm). El perfil pesado contra un vano chico se ve sobredimensionado y el costo se infla — un sistema más liviano daría mejor relación precio/aspecto.` });
    } else if (r.w > regla.ancho.idealMax) {
        warnings.push({ nivel:'info',
            txt:`Ancho ${r.w}cm pasa el rango típico (${regla.ancho.idealMin}–${regla.ancho.idealMax}cm). Aún dentro del límite, pero la sensación de "ventana firme" empieza a degradarse y con viento fuerte se nota. Si es planta alta o fachada expuesta, considera subir de sistema.` });
    }

    if (r.h < regla.alto.min) {
        const detallePuerta = (r.sys === '8025')
            ? ' Una puerta debajo de 200cm obliga a agacharse al entrar — funcional, pero pésima primera impresión y el cliente lo nota cada día.'
            : ' Los perfiles superior e inferior consumen ~5–6cm; debajo del mínimo apenas queda vidrio visible.';
        warnings.push({ nivel:'error',
            txt:`Alto ${r.h}cm está por debajo del mínimo del sistema (${regla.alto.min}cm).${detallePuerta}` });
    } else if (r.h > regla.alto.max) {
        warnings.push({ nivel:'error',
            txt:`Alto ${r.h}cm supera el máximo (${regla.alto.max}cm) que este sistema soporta. Los parantes verticales pierden rigidez a esa luz: la ventana vibra con el viento, los anclajes superiores trabajan al límite y el sello pierde adherencia con el tiempo.` });
    }

    if (regla.areaMaxIdeal && areaM2 > regla.areaMaxIdeal) {
        warnings.push({ nivel:'warn',
            txt:`Área ${areaM2.toFixed(2)}m² está sobre lo cómodo para este sistema (${regla.areaMaxIdeal}m²). El vidrio se flexa hacia adentro con presión de viento (lo verás temblar levemente). Subir espesor de vidrio o cambiar a sistema con perfil más profundo restaura la sensación de "ventana firme".` });
    }

    // ----- ANCHO DE NAVE / HOJA -----
    if (regla.naveMaxCm && r.numNaves > 0) {
        const anchoNave = r.w / r.numNaves;
        if (anchoNave > regla.naveMaxCm) {
            warnings.push({ nivel:'warn',
                txt:`Cada nave mide ~${anchoNave.toFixed(0)}cm (máx recomendado ${regla.naveMaxCm}cm). La roldana inferior carga peso lineal: con naves más anchas, el vidrio cabecea, se sale del riel con el uso y la corrediza queda dura. Repartir el ancho en más naves del mismo sistema soluciona el problema.` });
        }
    }
    if (regla.hojaMaxCm && r.numHojas > 0) {
        const anchoHoja = r.w / Math.max(1, r.numHojas);
        if (anchoHoja > regla.hojaMaxCm) {
            warnings.push({ nivel:'warn',
                txt:`Hoja batiente de ~${anchoHoja.toFixed(0)}cm supera el máximo (${regla.hojaMaxCm}cm). Las bisagras trabajan a palanca: cada cm extra multiplica la fuerza sobre los pivotes. Encima del máximo, las bisagras se desalinean en meses y la hoja termina raspando contra el marco.` });
        }
    }

    // ----- VIDRIO -----
    if (regla.vidriosNO && regla.vidriosNO.includes(r.vid)) {
        const detalleSeg = (r.sys === '8025')
            ? 'Una puerta recibe portazos, peso humano apoyado y vibración constante; con vidrio fino el riesgo de estallido por impacto es real.'
            : 'En este sistema, el peso del vidrio recae en perfiles que necesitan espesor mayor para sellar bien y no quedar con luz.';
        warnings.push({ nivel:'error',
            txt:`Vidrio ${r.vid} no es seguro para el sistema ${r.sys}. ${detalleSeg} Subir a ${regla.vidrioSugerido} es obligación técnica, no una preferencia.` });
        recommends.push({
            id:'rec-vidrio-cambia',
            txt:`Cambiar vidrio a ${regla.vidrioSugerido} (cumple norma de seguridad para este sistema)`,
            apply: { type:'alu_setVidrio', value: regla.vidrioSugerido }
        });
    } else if (regla.vidriosOK && !regla.vidriosOK.includes(r.vid)) {
        warnings.push({ nivel:'warn',
            txt:`Vidrio ${r.vid} funciona, pero ${regla.vidrioSugerido} es el espesor con el que ${r.sys} fue probado. Con el sugerido, la ventana se siente más sólida al cerrar y aísla mejor del ruido — diferencia real para el cliente.` });
        recommends.push({
            id:'rec-vidrio-ideal',
            txt:`Subir a ${regla.vidrioSugerido} (espesor con el que este sistema fue probado)`,
            apply: { type:'alu_setVidrio', value: regla.vidrioSugerido }
        });
    }

    // ----- RECOMENDACIONES DE SISTEMA -----
    // VC5020 con ancho > 240 → PC744
    if (r.sys === '5020' && r.w > 240) {
        recommends.push({
            id:'rec-pasar-744',
            txt:`Vano de ${r.w}cm: el VC5020 está cerca de su tope. El PC744 tiene perfilería más profunda y aguanta mejor la flexión por viento — sale más caro pero también más durable a largo plazo.`,
            apply: { type:'alu_setSistema', value:'744' }
        });
    }
    // PC744 con vano chico → VC5020 (ahorro real, sin pérdida de calidad)
    if (r.sys === '744' && r.w < 140 && r.h < 120) {
        recommends.push({
            id:'rec-pasar-5020',
            txt:`Vano chico para PC744: el VC5020 cubre estas medidas con perfil más liviano y precio menor. Si no necesitas la robustez del 744, el 5020 hace exactamente el mismo trabajo a menor costo.`,
            apply: { type:'alu_setSistema', value:'5020' }
        });
    }
    // VC8025 con alto < 200 → no es puerta
    if (r.sys === '8025' && r.h < 200) {
        recommends.push({
            id:'rec-puerta-no',
            txt:`Alto ${r.h}cm no es altura de puerta (parten desde 200cm). El VC8025 está sobreespecificado para una ventana, paga estructura que no necesitas. El PC744 hace el trabajo con mejor precio.`,
            apply: { type:'alu_setSistema', value:'744' }
        });
    }
    // Corrediza con vano muy chico (< 100×80) → mejor abatible
    if ((r.sys === '5020' || r.sys === '744') && r.w < 100 && r.h < 100) {
        recommends.push({
            id:'rec-pasar-abatible',
            txt:`Vano muy chico para corrediza: la roldana y el riel ocupan espacio que ya es escaso. Una abatible VC3831 deja más superficie de vidrio aprovechable y se abre/cierra más cómoda.`,
            apply: { type:'alu_setSistema', value:'3831' }
        });
    }

    // ----- SUGERENCIAS PARA EL MENSAJE DE WHATSAPP -----
    // No tocan el cálculo. Son textos opcionales para que el vendedor decida
    // si menciona productos relacionados al cliente, sin imponérselos.
    if (!r.incluirMosq && (r.sys === '5020' || r.sys === '744' || r.sys === '3831')) {
        upsells.push({
            id:'up-mosquitero',
            emoji:'🦟',
            label:'Mencionar mosquitero integrado',
            hint:'Esperado en dormitorios y zonas cálidas. Si no se ofrece, suelen pedirlo después.',
            waText:'\n🦟 ¿Te interesa con *mosquitero integrado*? Es muy útil en dormitorios y zonas cálidas; cuesta poco más al ya tener la ventana lista.'
        });
    }
    if (!r.incluirAlfajia && areaM2 > 1.5) {
        upsells.push({
            id:'up-alfajia',
            emoji:'🪨',
            label:'Mencionar alfajía / poyo reforzado',
            hint:'Acabado profesional del borde inferior. Útil en baños y cocinas.',
            waText:'\n🪨 Si quieres el acabado completo, también hago la *alfajía (poyo reforzado)* para el borde inferior. Te paso el adicional si te interesa.'
        });
    }
    // Vidrio crudo en sistema mayor: sugerir subir a templado
    if (['4mm','5mm'].includes(r.vid) && (r.sys === '744' || r.sys === '8025')) {
        upsells.push({
            id:'up-vidrio-temp',
            emoji:'🛡️',
            label:'Mencionar opción con vidrio 6mm templado',
            hint:'Seguridad real en zonas expuestas o de uso intensivo. No es un capricho, es una mejora concreta.',
            waText:'\n🛡️ Para más seguridad, también lo manejo con *vidrio 6mm templado*. En este sistema es el espesor que recomiendo cuando hay uso intensivo o fachada expuesta — te paso el adicional si lo prefieres.'
        });
    }
    // Frozen para ventanas chicas (baño)
    if (r.sys === '3831' && r.w <= 100 && r.h <= 80 && !r.vid.includes('Frozen')) {
        upsells.push({
            id:'up-frozen',
            emoji:'🌫️',
            label:'Mencionar opción Frozen (privacidad baño)',
            hint:'Privacidad sin perder luz natural. Útil cuando la ventana mira a otra propiedad.',
            waText:'\n🌫️ Si es para baño, también lo manejo en *vidrio Frozen (esmerilado)*. Da privacidad sin sacrificar la luz natural.'
        });
    }
    // Color: si natural en sistema premium, sugerir negro/maderato
    if (r.col === 'natural' && (r.sys === '744' || r.sys === '8025')) {
        upsells.push({
            id:'up-color-negro',
            emoji:'⚫',
            label:'Mencionar acabados negro / imitación madera',
            hint:'Diferencial visual fuerte frente al blanco/natural. Cambia mucho la fachada.',
            waText:'\n⚫ También lo tengo en *acabado negro* o *imitación madera*. Cambia bastante la onda de la fachada — si te llama la atención te paso fotos.'
        });
    }

    // ----- VENTA CRUZADA (productos relacionados) -----
    // Quien encarga ventanería suele estar en obra/remodelación: el baño
    // (división + espejo) es un complemento natural en la misma visita.
    upsells.push({
        id:'up-cross-bano',
        emoji:'🚿',
        label:'Ofrecer división de baño y espejos a juego',
        hint:'Venta cruzada natural: si está en obra o remodelación, el baño en vidrio templado es el siguiente paso.',
        waText:'\n🚿 Además de la ventanería, *también hago divisiones de baño en vidrio templado y espejos a medida*. Si estás resolviendo el baño, te lo cotizo a juego y lo coordino en la misma obra.'
    });

    const evaluacion = { modo:'aluminio', warnings, recommends, upsells, areaM2 };
    iq_ultimaEvaluacion = evaluacion;
    _iq_pintarStrip('alu', evaluacion);
}

// =================================================================
// 6. RENDER DE LA BANDA INTELIGENTE (warnings + recomendaciones)
// Cada aviso tiene un ✕ para cerrarlo individualmente.
// =================================================================
function _iq_cerrarStrip(el) {
    const strip = el.closest('.iq-strip');
    if (strip) strip.style.display = 'none';
}

function _iq_pintarStrip(modo, ev) {
    const cont = document.getElementById(modo === 'main' ? 'iq-strip-main' : 'iq-strip-alu');
    if (!cont) return;

    const errores  = ev.warnings.filter(w => w.nivel === 'error');
    const avisos   = ev.warnings.filter(w => w.nivel === 'warn');
    const infos    = ev.warnings.filter(w => w.nivel === 'info');

    const totalCosas = errores.length + avisos.length + infos.length
                     + ev.recommends.length;

    if (totalCosas === 0) {
        cont.innerHTML = `<div class="iq-strip iq-strip-ok">
            <span class="iq-icon">✅</span>
            <span class="iq-msg">Configuración técnicamente correcta.</span>
            <button class="iq-btn-cerrar-strip" onclick="_iq_cerrarStrip(this)" title="Cerrar">✕</button>
        </div>`;
        _iq_pintarSugerenciasWA(modo, ev.upsells || []);
        return;
    }

    let html = '';

    // 1. ERRORES (rojo)
    errores.forEach(e => {
        html += `<div class="iq-strip iq-strip-error">
            <span class="iq-icon">🚫</span>
            <span class="iq-msg">${e.txt}</span>
            <button class="iq-btn-cerrar-strip" onclick="_iq_cerrarStrip(this)" title="Cerrar">✕</button>
        </div>`;
    });

    // 2. AVISOS (amarillo, cerrables)
    avisos.forEach(w => {
        html += `<div class="iq-strip iq-strip-warn">
            <span class="iq-icon">⚠️</span>
            <span class="iq-msg">${w.txt}</span>
            <button class="iq-btn-cerrar-strip" onclick="_iq_cerrarStrip(this)" title="Cerrar">✕</button>
        </div>`;
    });

    // 3. INFO (azul claro, cerrables)
    infos.forEach(i => {
        html += `<div class="iq-strip iq-strip-info">
            <span class="iq-icon">ℹ️</span>
            <span class="iq-msg">${i.txt}</span>
            <button class="iq-btn-cerrar-strip" onclick="_iq_cerrarStrip(this)" title="Cerrar">✕</button>
        </div>`;
    });

    // 4. RECOMENDACIONES (verde con botón aplicar y X)
    ev.recommends.forEach(r => {
        html += `<div class="iq-strip iq-strip-reco">
            <span class="iq-icon">💡</span>
            <span class="iq-msg">${r.txt}</span>
            <button class="iq-btn-apply" onclick='iq_aplicar(${JSON.stringify(r.apply)})'>✓ Aplicar</button>
            <button class="iq-btn-cerrar-strip" onclick="_iq_cerrarStrip(this)" title="Ignorar">✕</button>
        </div>`;
    });

    cont.innerHTML = html;

    // Sugerencias para WhatsApp van en su propio contenedor (junto al botón)
    _iq_pintarSugerenciasWA(modo, ev.upsells || []);
}

// -----------------------------------------------------------------
// Sugerencias opcionales para incluir en el mensaje de WhatsApp.
// Renderiza checkboxes discretos. NO modifica el cálculo: solo
// agrega texto sutil al mensaje si el vendedor las marca.
// -----------------------------------------------------------------
// Estado apertura sugerencias WA
const _iq_wa_open = {};

function iq_toggleWA(modo) {
    _iq_wa_open[modo] = !_iq_wa_open[modo];
    const contId = modo === 'main' ? 'iq-upsells-wa-main' : 'iq-upsells-wa-alu';
    const cont = document.getElementById(contId);
    if (!cont) return;
    const body = cont.querySelector('.iq-wa-sug-body-collapsible');
    const arrow = cont.querySelector('.iq-wa-toggle-arrow');
    if (body) body.style.display = _iq_wa_open[modo] ? 'block' : 'none';
    if (arrow) arrow.textContent = _iq_wa_open[modo] ? '▲' : '▼';
}

function _iq_pintarSugerenciasWA(modo, upsells) {
    const cont = document.getElementById(modo === 'main' ? 'iq-upsells-wa-main' : 'iq-upsells-wa-alu');
    if (!cont) return;

    if (!upsells || upsells.length === 0) {
        cont.innerHTML = '';
        cont.style.display = 'none';
        return;
    }

    // Preservar estado de apertura al re-renderizar
    const abierto = !!_iq_wa_open[modo];

    cont.style.display = 'block';
    let html = `<div class="iq-wa-sug">
        <div class="iq-wa-sug-title" onclick="iq_toggleWA('${modo}')" style="cursor:pointer;">
            <span>💬 ¿Mencionar algo más en el mensaje?</span>
            <span style="display:flex;align-items:center;gap:6px;">
                <span class="iq-wa-sug-hint">opcional</span>
                <span class="iq-wa-toggle-arrow">${abierto ? '▲' : '▼'}</span>
            </span>
        </div>
        <div class="iq-wa-sug-body-collapsible" style="display:${abierto ? 'block' : 'none'};">
        <div class="iq-wa-sug-list">`;

    upsells.forEach(u => {
        // ID único del checkbox por modo + id de upsell
        const cid = `iq-wa-${modo}-${u.id}`;
        // Guardamos el texto a inyectar en data-attribute (más estable que JS inline)
        const safeText = (u.waText || '').replace(/"/g, '&quot;');
        const safeHint = (u.hint || '').replace(/"/g, '&quot;');
        html += `<label class="iq-wa-sug-row" for="${cid}">
            <input type="checkbox" id="${cid}" class="iq-wa-sug-chk"
                   data-iq-wa-text="${safeText}">
            <span class="iq-wa-sug-emoji">${u.emoji || '•'}</span>
            <span class="iq-wa-sug-body">
                <span class="iq-wa-sug-label">${u.label}</span>
                <span class="iq-wa-sug-sub">${safeHint}</span>
            </span>
        </label>`;
    });

    html += `</div></div>`;
    cont.innerHTML = html;
}

// -----------------------------------------------------------------
// Devuelve el texto extra a añadir al mensaje de WhatsApp según los
// checkboxes marcados. Llamado por compartir() / alu_compartirWA().
// Si no hay nada marcado, devuelve string vacío.
// -----------------------------------------------------------------
function iq_getSugerenciasWAText(modo) {
    const cont = document.getElementById(modo === 'main' ? 'iq-upsells-wa-main' : 'iq-upsells-wa-alu');
    if (!cont) return '';
    const chks = cont.querySelectorAll('input.iq-wa-sug-chk:checked');
    if (!chks.length) return '';

    let extra = '\n\n— — — — — — — — — — — — — — — — — —';
    chks.forEach(chk => {
        const t = chk.getAttribute('data-iq-wa-text') || '';
        if (t) extra += t;
    });
    return extra;
}

// =================================================================
// 7. APLICAR UNA ACCIÓN (recomendación o upsell)
// =================================================================
function iq_aplicar(accion) {
    if (!accion || !accion.type) return;
    try {
        switch (accion.type) {
            // ----- COTIZADOR PRINCIPAL -----
            case 'main_setProducto': {
                const sel = document.getElementById('producto');
                if (sel) {
                    sel.value = accion.value;
                    if (typeof verificarProducto === 'function') verificarProducto();
                    if (typeof calcular === 'function') calcular();
                    if (typeof toast === 'function') toast('Producto cambiado a ' + accion.value, 'success', 2000);
                }
                break;
            }
            case 'main_setEspesor': {
                const sel = document.getElementById('espesor');
                if (sel) {
                    sel.value = accion.value;
                    if (typeof calcular === 'function') calcular();
                    if (typeof toast === 'function') toast('Vidrio ' + accion.value + ' aplicado', 'success', 2000);
                }
                break;
            }
            case 'main_setColor': {
                const sel = document.getElementById('color_acc');
                if (sel) {
                    sel.value = accion.value;
                    if (typeof calcular === 'function') calcular();
                    if (typeof toast === 'function') toast('Color ' + accion.value + ' aplicado', 'success', 2000);
                }
                break;
            }
            case 'main_setLinea': {
                const sel = document.getElementById('linea');
                if (sel) {
                    sel.value = accion.value;
                    if (typeof calcular === 'function') calcular();
                    if (typeof toast === 'function') toast('Línea ' + accion.value + ' aplicada', 'success', 2000);
                }
                break;
            }
            case 'main_toggle': {
                const chk = document.getElementById(accion.target);
                if (chk) {
                    chk.checked = accion.value;
                    if (typeof calcular === 'function') calcular();
                    if (typeof toast === 'function') toast('Extra agregado', 'success', 2000);
                }
                break;
            }
            // ----- COTIZADOR ALUMINIO -----
            case 'alu_setSistema': {
                if (typeof alu_setSistema === 'function') {
                    alu_setSistema(accion.value);
                    if (typeof alu_actualizarCamposExtra === 'function') alu_actualizarCamposExtra();
                    if (typeof alu_calcular === 'function') alu_calcular();
                    if (typeof toast === 'function') toast('Sistema cambiado', 'success', 2000);
                }
                break;
            }
            case 'alu_setVidrio': {
                if (typeof alu_setVidrio === 'function') {
                    alu_setVidrio(accion.value);
                    if (typeof alu_calcular === 'function') alu_calcular();
                    if (typeof toast === 'function') toast('Vidrio ' + accion.value, 'success', 2000);
                }
                break;
            }
            case 'alu_setColor': {
                if (typeof alu_setColor === 'function') {
                    alu_setColor(accion.value);
                    if (typeof alu_calcular === 'function') alu_calcular();
                    if (typeof toast === 'function') toast('Color cambiado', 'success', 2000);
                }
                break;
            }
            case 'alu_toggle': {
                const chk = document.getElementById(accion.target);
                if (chk) {
                    chk.checked = accion.value;
                    // El cambio de checkbox del CF tiene un onchange; los otros no requieren
                    if (typeof alu_calcular === 'function') alu_calcular();
                    if (typeof toast === 'function') toast('Extra agregado', 'success', 2000);
                }
                break;
            }
            default:
                console.warn('iq_aplicar: tipo desconocido', accion.type);
        }
    } catch(e) {
        console.warn('iq_aplicar error:', e);
        if (typeof toast === 'function') toast('No pude aplicar el cambio', 'warn');
    }
}

// =================================================================
// 8. BLOQUEO SUAVE DE ERRORES GRAVES (pre-cálculo)
// =================================================================
// Llamado por app.js y aluminio.js justo después de leer inputs y antes
// de procesar. Devuelve `true` si el cálculo puede continuar; `false`
// si el usuario canceló al ver el dialog de advertencia.
function iq_validarPrincipalAntes(producto, anchoCm, ancho2Cm, altoCm, espesor) {
    const regla = IQ_REGLAS_PRINCIPAL[producto];
    if (!regla) return true; // sin reglas → no bloquea

    const esLEspecial = producto.includes('División de baño L -');
    const anchoTotal = esLEspecial ? (anchoCm + (ancho2Cm||0)) : anchoCm;
    const motivos = [];

    if (anchoTotal < regla.ancho.min)
        motivos.push(`• Ancho ${anchoTotal}cm está bajo el mínimo (${regla.ancho.min}cm): debajo de eso los herrajes ocupan casi todo el frente y casi no queda vidrio útil.`);
    if (anchoTotal > regla.ancho.max)
        motivos.push(`• Ancho ${anchoTotal}cm supera el máximo (${regla.ancho.max}cm): un paño tan ancho flexa por su peso y los herrajes trabajan al límite — conviene dividir o subir de sistema.`);
    if (altoCm < regla.alto.min)
        motivos.push(`• Alto ${altoCm}cm está bajo el mínimo (${regla.alto.min}cm): debajo de eso, en baño el agua salpicaría por encima del vidrio.`);
    if (altoCm > regla.alto.max)
        motivos.push(`• Alto ${altoCm}cm supera el máximo (${regla.alto.max}cm): los parantes verticales no están diseñados para tanta luz y ganan vibración.`);
    if (regla.espesoresNO && regla.espesoresNO.includes(espesor))
        motivos.push(`• Vidrio ${espesor} no cumple seguridad para ${producto}: por debajo de ${regla.espesorSugerido} templado hay riesgo real de estallido por impacto.`);

    if (motivos.length === 0) return true;

    const msg = `⚠️ ATENCIÓN — Hay puntos técnicos que conviene revisar antes de cotizar ${producto}:\n\n${motivos.join('\n\n')}\n\n¿Quieres cotizar igual? (Tú decides, pero el cliente puede preguntarte por estos puntos después.)`;
    return confirm(msg);
}

function iq_validarAluminioAntes(sys, cfg, w, h, vid) {
    const regla = IQ_REGLAS_ALU[sys];
    if (!regla) return true;
    const motivos = [];

    if (w < regla.ancho.min)
        motivos.push(`• Ancho ${w}cm está bajo el mínimo (${regla.ancho.min}cm): los perfiles laterales ocupan ~7cm y debajo del mínimo casi no queda vidrio visible.`);
    if (w > regla.ancho.max)
        motivos.push(`• Ancho ${w}cm supera el máximo (${regla.ancho.max}cm): el perfil cabecero se vence por gravedad a esa luz y con viento la ventana vibra.`);
    if (h < regla.alto.min) {
        const det = (sys === '8025')
            ? ' Una puerta debajo de 200cm obliga a agacharse al entrar.'
            : ' Los perfiles superior e inferior consumen ~5–6cm en total.';
        motivos.push(`• Alto ${h}cm está bajo el mínimo (${regla.alto.min}cm).${det}`);
    }
    if (h > regla.alto.max)
        motivos.push(`• Alto ${h}cm supera el máximo (${regla.alto.max}cm): los parantes pierden rigidez y los anclajes superiores trabajan al límite.`);
    if (regla.vidriosNO && regla.vidriosNO.includes(vid))
        motivos.push(`• Vidrio ${vid} no es seguro para ${sys}: en esta tipología hay golpes y vibración constantes; por debajo de ${regla.vidrioSugerido} el riesgo de estallido es real.`);

    if (motivos.length === 0) return true;

    const msg = `⚠️ ATENCIÓN — Hay puntos técnicos que conviene revisar antes de cotizar ${sys}:\n\n${motivos.join('\n\n')}\n\n¿Quieres cotizar igual? (Tú decides, pero el cliente puede preguntarte por estos puntos después.)`;
    return confirm(msg);
}

// =================================================================
// 9. PLANTILLAS RÁPIDAS
// =================================================================
// ----- PLANTILLAS PERSONALIZADAS DEL VENDEDOR (localStorage) -----
// Se guardan desde el resultado de un cálculo y aparecen junto a las del
// sistema con un ícono distinto (⭐). Son editables (renombrar) y borrables.
const IQ_USER_PLT_KEY = 'cotizador_plantillas_usuario_v1';

function iq_leerPlantillasUsuario() {
    try {
        const arr = JSON.parse(localStorage.getItem(IQ_USER_PLT_KEY)) || [];
        return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
}

function iq_guardarPlantillasUsuario(arr) {
    try { localStorage.setItem(IQ_USER_PLT_KEY, JSON.stringify(arr)); } catch(e){}
}

// Estado de apertura de plantillas (por modo) — persiste en memoria durante la sesión
const _iq_plt_open = {};

function iq_togglePlantillas(modo, containerId) {
    _iq_plt_open[modo] = !_iq_plt_open[modo];
    iq_renderPlantillas(modo, containerId);
}

function iq_renderPlantillas(modo, containerId) {
    const cont = document.getElementById(containerId);
    if (!cont) return;
    const sistema = IQ_PLANTILLAS.filter(p => p.modo === modo);
    const usuario = iq_leerPlantillasUsuario().filter(p => p.modo === modo);
    const abierto = !!_iq_plt_open[modo];
    const total = sistema.length + usuario.length;

    // Siempre visible: el header-toggle. El cuerpo solo si está abierto.
    let html = `<div class="iq-plt-header" onclick="iq_togglePlantillas('${modo}','${containerId}')">
        <span class="iq-plt-header-label">⚡ Plantillas rápidas</span>
        <span class="iq-plt-header-count">${total}</span>
        <span class="iq-plt-header-arrow">${abierto ? '▲' : '▼'}</span>
    </div>`;

    if (abierto) {
        html += `<div class="iq-plt-body">
            <div class="iq-plt-title">Sistema</div>
            <div class="iq-plt-grid">`;
        sistema.forEach(p => {
            html += `<button class="iq-plt-chip" onclick="iq_aplicarPlantilla('${p.id}')">
                <span class="iq-plt-emoji">${p.emoji}</span>
                <span class="iq-plt-nombre">${p.nombre}</span>
            </button>`;
        });
        html += `</div>`;

        if (usuario.length) {
            html += `<div class="iq-plt-title" style="margin-top:14px;">⭐ Mis plantillas</div>
                     <div class="iq-plt-grid">`;
            usuario.forEach(p => {
                html += `<div class="iq-plt-chip iq-plt-chip-user">
                    <span class="iq-plt-emoji" onclick="iq_aplicarPlantillaUsuario('${p.id}')" style="cursor:pointer;">⭐</span>
                    <span class="iq-plt-nombre" onclick="iq_aplicarPlantillaUsuario('${p.id}')" style="cursor:pointer;">${p.nombre}</span>
                    <span onclick="iq_renombrarPlantillaUsuario('${p.id}','${modo}','${containerId}')"
                        title="Renombrar"
                        style="cursor:pointer; color:#0891b2; padding:0 3px; flex-shrink:0;">✏️</span>
                    <span onclick="iq_borrarPlantillaUsuario('${p.id}','${modo}','${containerId}')"
                        title="Borrar"
                        style="cursor:pointer; color:#c62828; font-weight:700; padding:0 3px; flex-shrink:0;">✕</span>
                </div>`;
            });
            html += `</div>`;
        }
        html += `</div>`; // .iq-plt-body
    }

    cont.innerHTML = html;
}

// Lógica compartida: vuelca los datos de una plantilla en el formulario y calcula.
function iq_aplicarPlantillaDatos(modo, d, nombre) {
    try {
        if (modo === 'principal') {
            const selProd = document.getElementById('producto');
            if (selProd && d.producto) {
                selProd.value = d.producto;
                if (typeof verificarProducto === 'function') verificarProducto();
            }
            if (d.espesor) {
                const selEsp = document.getElementById('espesor');
                if (selEsp) selEsp.value = d.espesor;
            }
            if (d.ancho)  document.getElementById('ancho').value  = d.ancho;
            if (d.ancho2) document.getElementById('ancho2').value = d.ancho2;
            if (d.alto)   document.getElementById('alto').value   = d.alto;
            if (typeof calcular === 'function') calcular();
            if (typeof toast === 'function') toast(`Plantilla cargada y calculada: ${nombre}`, 'success', 2000);
            window.scrollTo({ top: 0, behavior:'smooth' });
        } else if (modo === 'aluminio') {
            if (d.sistema && typeof alu_setSistema === 'function') alu_setSistema(d.sistema);
            if (d.config  && typeof alu_setConfig  === 'function') alu_setConfig(d.config);
            if (d.vidrio  && typeof alu_setVidrio  === 'function') alu_setVidrio(d.vidrio);
            if (d.ancho)  document.getElementById('alu-ancho').value = d.ancho;
            if (d.alto)   document.getElementById('alu-alto').value  = d.alto;
            if (typeof alu_actualizarCamposExtra === 'function') alu_actualizarCamposExtra();
            if (typeof alu_calcular === 'function') alu_calcular();
            if (typeof toast === 'function') toast(`Plantilla cargada y calculada: ${nombre}`, 'success', 2000);
            window.scrollTo({ top: 0, behavior:'smooth' });
        }
    } catch(e) {
        console.warn('Error aplicando plantilla:', e);
        if (typeof toast === 'function') toast('No pude cargar la plantilla', 'warn');
    }
}

function iq_aplicarPlantilla(plantillaId) {
    const p = IQ_PLANTILLAS.find(x => x.id === plantillaId);
    if (!p) return;
    iq_aplicarPlantillaDatos(p.modo, p.datos, p.nombre);
}

function iq_aplicarPlantillaUsuario(id) {
    const p = iq_leerPlantillasUsuario().find(x => x.id === id);
    if (!p) return;
    iq_aplicarPlantillaDatos(p.modo, p.datos, p.nombre);
}

// Captura el cálculo actual (principal o aluminio) como plantilla del vendedor.
function iq_guardarComoPlantilla(modo) {
    let datos = null;
    if (modo === 'principal') {
        if (typeof lastCalculation === 'undefined' || !lastCalculation || !lastCalculation.raw) {
            if (typeof toast === 'function') toast('Calcula una cotización primero', 'warn');
            return;
        }
        const raw = lastCalculation.raw;
        datos = {
            producto: raw.producto,
            espesor: raw.espesor,
            ancho: raw.ancho,
            ancho2: raw.ancho2 || 0,
            alto: raw.alto
        };
    } else if (modo === 'aluminio') {
        if (typeof aluLastCalc === 'undefined' || !aluLastCalc) {
            if (typeof toast === 'function') toast('Calcula una cotización primero', 'warn');
            return;
        }
        const r = aluLastCalc;
        datos = {
            sistema: r.sys,
            config: r.cfg,
            vidrio: r.vid,
            ancho: r.w,
            alto: r.h
        };
    } else { return; }

    const sugerido = (modo === 'principal')
        ? `${datos.producto} ${datos.ancho}×${datos.alto}`
        : `${datos.sistema} ${datos.ancho}×${datos.alto}`;
    const nombre = prompt('Nombre para esta plantilla:', sugerido);
    if (nombre === null) return; // canceló
    const nombreFinal = (nombre.trim() || sugerido).slice(0, 40);

    const lista = iq_leerPlantillasUsuario();
    lista.unshift({
        id: 'usr-' + Date.now(),
        modo: modo,
        nombre: nombreFinal,
        datos: datos
    });
    iq_guardarPlantillasUsuario(lista);

    const containerId = (modo === 'principal') ? 'iq-plantillas-main' : 'iq-plantillas-alu';
    iq_renderPlantillas(modo, containerId);
    if (typeof toast === 'function') toast(`Plantilla guardada: ${nombreFinal}`, 'success');
}

function iq_renombrarPlantillaUsuario(id, modo, containerId) {
    const lista = iq_leerPlantillasUsuario();
    const idx = lista.findIndex(p => p.id === id);
    if (idx < 0) return;
    const nuevo = prompt('Nuevo nombre de la plantilla:', lista[idx].nombre);
    if (nuevo === null) return;
    const limpio = nuevo.trim().slice(0, 40);
    if (!limpio) return;
    lista[idx].nombre = limpio;
    iq_guardarPlantillasUsuario(lista);
    iq_renderPlantillas(modo, containerId);
    if (typeof toast === 'function') toast('Plantilla renombrada', 'success', 2000);
}

function iq_borrarPlantillaUsuario(id, modo, containerId) {
    const lista = iq_leerPlantillasUsuario();
    const idx = lista.findIndex(p => p.id === id);
    if (idx < 0) return;
    if (typeof confirm === 'function' && !confirm(`¿Borrar la plantilla "${lista[idx].nombre}"?`)) return;
    lista.splice(idx, 1);
    iq_guardarPlantillasUsuario(lista);
    iq_renderPlantillas(modo, containerId);
    if (typeof toast === 'function') toast('Plantilla borrada', 'info', 2000);
}

// =================================================================
// 10. INICIALIZACIÓN
// =================================================================
// Pintamos las plantillas al cargar
document.addEventListener('DOMContentLoaded', () => {
    iq_renderPlantillas('principal', 'iq-plantillas-main');
    iq_renderPlantillas('aluminio',  'iq-plantillas-alu');
});
