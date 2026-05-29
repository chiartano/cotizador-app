/* ================================================================
 * COTIZADOR PRO - Módulo independiente: Ventanería en Aluminio
 * Sistemas: VC3831 abatible, VC5020/PC744 corrediza, VC8025 puerta
 * Todo el código de aluminio está prefijado con alu_ o ALU_
 * para no colisionar con el cotizador principal (app.js)
 * ================================================================ */
"use strict";

        // =================================================================
        // =================================================================
        // ============= MÓDULO INDEPENDIENTE: ALUMINIO ====================
        // =================================================================
        // =================================================================
        // Todo el código de aluminio está prefijado con `alu_` o `ALU_`
        // para no chocar con el resto de la app. Tiene su propio storage,
        // su propia config, su propio motor de cálculo y su propia UI.
        // =================================================================

        const ALU_STORAGE_KEY = 'alu_config_v2';

        // ---------- DEFAULTS DE FÁBRICA ----------
        // Estos son los valores iniciales. Se sobreescriben por lo guardado
        // en localStorage. El usuario puede editarlos desde el modal de
        // configuración o restaurar fábrica.
        const ALU_DEFAULTS = {
            // Orden columnas de color (idéntico al PDF VIALCOR):
            // [crudo, natural, champana, anolock, demas, maderato, blanco_negro]
            sistemas: {
                '3831': {
                    nombre: 'VC3831 Abatible',
                    tipoLabel: 'Abatible',
                    icono: '🪟',
                    perfiles: {
                        cabezalSillar: { ref:'ALN173', desc:'Cabezal/Sillar (Marco Liso)', precios:[50485,58252,58252,63106,63106,68843,105963] },
                        jamba:         { ref:'ALN174', desc:'Jamba (Autorroscante)',       precios:[56190,64834,64834,70237,70237,76622,111795] },
                        marcoHoja:     { ref:'ALN176', desc:'Marco Hoja (Z)',              precios:[77757,89719,89719,97196,97196,106032,135314] },
                        pisavidrio:    { ref:'ALN177', desc:'Pisavidrio',                  precios:[31882,36787,36787,39852,39852,43475,59564] },
                        divisor:       { ref:'ALN292', desc:'Divisor entre hojas',         precios:[96671,111543,111543,120839,120839,131824,163591] },
                        adaptador:     { ref:'ALN175', desc:'Adaptador Cuerpo Fijo',       precios:[40510,46743,46743,50638,50638,55241,78298] }
                    }
                },
                '5020': {
                    nombre: 'VC5020 Corrediza Liviana',
                    tipoLabel: 'Corrediza',
                    icono: '🔀',
                    perfiles: {
                        cabezal:  { ref:'ALN144', desc:'Cabezal',          precios:[48638,56121,56121,60798,60798,66325,112169] },
                        sillar:   { ref:'ALN194', desc:'Sillar',           precios:[54941,63393,63393,68676,68676,74919,117547] },
                        jamba:    { ref:'ALN193', desc:'Jamba',            precios:[48963,56496,56496,61203,61203,66767,113459] },
                        enganche: { ref:'ALN147', desc:'Enganche',         precios:[44691,51566,51566,55863,55863,60942,95477] },
                        traslape: { ref:'ALN192', desc:'Traslape',         precios:[31837,36735,36735,39796,39796,43414,78225] },
                        horizSup: { ref:'ALN349', desc:'Horizontal Sup.',  precios:[53836,62119,62119,67296,67296,73413,101696] },
                        horizInf: { ref:'ALN349', desc:'Horizontal Inf.',  precios:[53836,62119,62119,67296,67296,73413,101696] }
                    }
                },
                '744': {
                    nombre: 'PC744 Corrediza Tradicional',
                    tipoLabel: 'Corrediza Pesada',
                    icono: '🔀',
                    perfiles: {
                        cabezal:  { ref:'ALN392', desc:'Cabezal',              precios:[55851,64443,64443,69813,69813,76160,124154] },
                        sillar:   { ref:'ALN387', desc:'Sillar',               precios:[56718,65443,65443,70897,70897,77342,122481] },
                        jamba:    { ref:'ALN393', desc:'Jamba',                precios:[56701,65424,65424,70876,70876,77320,125736] },
                        enganche: { ref:'ALN391', desc:'Enganche',             precios:[65049,75056,75056,81311,81311,88703,128752] },
                        traslape: { ref:'ALN388', desc:'Traslape',             precios:[65699,75807,75807,82124,82124,89590,128631] },
                        horizSup: { ref:'ALN389', desc:'Horizontal Superior',  precios:[44509,51356,51356,55636,55636,60693,95437] },
                        horizInf: { ref:'ALN390', desc:'Horizontal Inferior',  precios:[69688,80409,80409,87110,87110,95029,126531] },
                        adaptador:{ ref:'ALN403', desc:'Adaptador Cuerpo Fijo',precios:[30210,34858,34858,37763,37763,41196,74267] }
                    }
                },
                '8025': {
                    nombre: 'VC8025 Puerta Corrediza',
                    tipoLabel: 'Puerta',
                    icono: '🚪',
                    perfiles: {
                        cabezal:  { ref:'ALN151', desc:'Cabezal',              precios:[103536,119464,119464,129420,129420,141185,184255] },
                        sillar:   { ref:'ALN150', desc:'Sillar',               precios:[100713,116207,116207,125891,125891,137336,170121] },
                        jamba:    { ref:'ALN841', desc:'Jamba',                precios:[102680,118477,118477,128350,128350,140019,178564] },
                        enganche: { ref:'ALN191', desc:'Enganche',             precios:[99813,115169,115169,124766,124766,136108,170856] },
                        traslape: { ref:'ALN190', desc:'Traslape',             precios:[96120,110908,110908,120150,120150,131073,162259] },
                        horizSup: { ref:'ALN156', desc:'Horizontal Superior',  precios:[79357,91566,91566,99196,99196,108214,145339] },
                        horizInf: { ref:'ALN157', desc:'Horizontal Inferior',  precios:[125024,144259,144259,156280,156280,170488,194623] },
                        adaptador:{ ref:'ALN158', desc:'Adaptador Cuerpo Fijo',precios:[38545,44475,44475,48181,48181,52561,80387] }
                    }
                }
            },
            // Accesorios por sistema (precios editables del mercado colombiano 2025)
            accesorios: {
                '3831': {
                    bisagra:     { desc:'Bisagras de presión',              porHoja:2, precio:14000 },
                    cremona:     { desc:'Cremona / manija',                 porHoja:1, precio:45000 },
                    felpaMl:     { desc:'Felpa perimetral (por metro)',     porMetro:true, precio:4500 },
                    tornilleria: { desc:'Tornillería + escuadras',          fijo:true, precio:10000 },
                    mosquitero:  { desc:'Kit mosquitero (1 nave)',          opcional:'mosquitero', precio:75000 },
                    alfajia:     { desc:'Alfajía 11cm (por metro de ancho)',opcional:'alfajia', porAncho:true, precio:25000 }
                },
                '5020': {
                    rodachina:   { desc:'Rodachinas',                       porMovil:2, precio:8500 },
                    cerradura:   { desc:'Cerradura de impacto (por móvil)', porMovil:1, precio:22000 },
                    felpaMl:     { desc:'Felpa pelo+nylon (por metro)',     porMetro:true, precio:3800 },
                    tornilleria: { desc:'Tornillería + escuadras',          fijo:true, precio:8000 },
                    mosquitero:  { desc:'Kit mosquitero (1 nave)',          opcional:'mosquitero', precio:65000 },
                    alfajia:     { desc:'Alfajía 11cm (por metro de ancho)',opcional:'alfajia', porAncho:true, precio:22000 }
                },
                '744': {
                    rodachina:   { desc:'Rodachinas reforzadas',            porMovil:2, precio:14500 },
                    cerradura:   { desc:'Cerradura de impacto (por móvil)', porMovil:1, precio:35000 },
                    felpaMl:     { desc:'Felpa pelo+nylon (por metro)',     porMetro:true, precio:4500 },
                    tornilleria: { desc:'Tornillería + escuadras',          fijo:true, precio:10000 },
                    mosquitero:  { desc:'Kit mosquitero (1 nave)',          opcional:'mosquitero', precio:75000 },
                    alfajia:     { desc:'Alfajía 11cm (por metro de ancho)',opcional:'alfajia', porAncho:true, precio:25000 }
                },
                '8025': {
                    rodachina:   { desc:'Rodachinas puerta (par)',          porMovil:2, precio:38000 },
                    cerradura:   { desc:'Cerradura de impacto (por móvil)', porMovil:1, precio:85000 },
                    manija:      { desc:'Manija gancho (par)',              porMovil:1, precio:28000 },
                    felpaMl:     { desc:'Felpa puerta (por metro)',         porMetro:true, precio:6500 },
                    tornilleria: { desc:'Tornillería + escuadras',          fijo:true, precio:15000 }
                }
            },
            // Vidrios disponibles ($/m²)
            vidrios: {
                '4mm':        { label:'4mm Crudo (económico)',                  precio:28000 },
                '5mm':        { label:'5mm Crudo',                              precio:35000 },
                '3+3':        { label:'3+3 Laminado seguridad',                 precio:110000 },
                'Frozen 4mm': { label:'Frozen 4mm esmerilado (baño/cocina)',    precio:75000 },
                'Frozen 5mm': { label:'Frozen 5mm esmerilado (baño/cocina)',    precio:95000 },
                '6mm':        { label:'6mm Templado',                           precio:106000 },
                '8mm':        { label:'8mm Templado',                           precio:135000 },
                '10mm':       { label:'10mm Templado',                          precio:170000 },
                '4+4':        { label:'4+4 Laminado',                           precio:155000 },
                '5+5':        { label:'5+5 Laminado',                           precio:175000 }
            },
            // Parámetros del cálculo (todos editables)
            formula: {
                inflacion: 10,        // % sobre lista
                mermaBaja: 10,        // % en obras grandes
                mermaAlta: 22,        // % en piezas pequeñas (antes 35%, era exagerado)
                umbralOptimo: 2.5,    // metros para usar merma baja (antes 3.0)
                umbralProyectoGrande: 12.0, // metros totales para considerar obra grande
                largoTira: 600,       // cm (6m)
                mermaVidrio: 15,      // %
                accImprevistos: 8,    // % extra sobre accesorios
                // ── MO: rebalanceada para que escale con el tamaño ──
                moFija: 25000,        // $ MO base por ventana (antes 55000)
                moPorM2: 55000,       // $ MO por m² (antes 35000)
                insumosFijos: 10000,  // $ silicona, tornillos extra (antes 18000)
                // ── Instalación: también más variable, menos fija ──
                instBasicaFija: 20000,    // antes 45000
                instBasicaPorM2: 35000,   // antes 15000
                instAlturaFija: 40000,    // antes 75000
                instAlturaPorM2: 55000,   // antes 25000
                utilidad: 35,         // % sobre costo primo
                iva: 19               // %
            },
            // Dificultad de armado por sistema (multiplicador de MO)
            dificultad: {
                '3831': 1.15, '5020': 1.00, '744': 1.10, '8025': 1.55
            },
            // Configuraciones de diseño por sistema
            configsValidas: {
                '3831': ['OX','OXO','1B_CF','2B_CF','1H','2H','CF'],
                '5020': ['2N','3N','4N','CF'],
                '744':  ['2N','3N','4N','CF'],
                '8025': ['2N','3N','4N']
            }
        };

        const ALU_COLOR_LABELS = {
            'crudo':'Crudo','natural':'Natural Mate','champana':'Champaña',
            'anolock':'Anolock','demas':'Demás Acabados','maderato':'Maderato',
            'blanco_negro':'Blanco / Negro'
        };
        const ALU_COLOR_IDX = {
            'crudo':0,'natural':1,'champana':2,'anolock':3,'demas':4,'maderato':5,'blanco_negro':6
        };
        const ALU_CONFIG_LABELS = {
            'OX':   {label:'OX - Batiente + Fijo',sub:'1 hoja lateral + fijo lateral'},
            'OXO':  {label:'OXO - 2 Batientes + Fijo',sub:'Hojas a los lados, fijo central'},
            '1B_CF':{label:'1 Basculante + CF',sub:'Proyectante abajo, fijo arriba'},
            '2B_CF':{label:'2 Basculantes + CF',sub:'2 proyectantes abajo, fijo arriba'},
            '1H':   {label:'1 Hoja Simple',sub:'Solo abatible, sin fijo'},
            '2H':   {label:'2 Hojas Simples',sub:'Abatible doble, sin fijo'},
            '2N':   {label:'2 Naves',sub:'XO (1 fija, 1 móvil)'},
            '3N':   {label:'3 Naves',sub:'OXO (3 paños)'},
            '4N':   {label:'4 Naves',sub:'OOXX (4 paños)'},
            'CF':   {label:'Solo Cuerpo Fijo',sub:'Sin hojas móviles'}
        };

        // ---------- ESTADO RUNTIME ----------
        let aluConfig = null;       // config activa (defaults + overrides del user)
        let aluState = {            // estado actual del cotizador
            sistema: '5020',
            config:  '2N',
            vidrio:  '6mm',
            color:   'natural',
            instalacion: 'basica'
        };
        let aluLastCalc = null;     // resultado del último cálculo

        // ---------- PERSISTENCIA ----------
        function alu_loadConfig() {
            const saved = localStorage.getItem(ALU_STORAGE_KEY);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    aluConfig = alu_mergeDefaults(parsed);
                } catch(e) {
                    console.warn('Config aluminio corrupta, restaurando defaults');
                    aluConfig = JSON.parse(JSON.stringify(ALU_DEFAULTS));
                }
            } else {
                aluConfig = JSON.parse(JSON.stringify(ALU_DEFAULTS));
            }
        }
        function alu_saveConfig() {
            localStorage.setItem(ALU_STORAGE_KEY, JSON.stringify(aluConfig));
        }
        function alu_mergeDefaults(saved) {
            // Si añadimos campos nuevos en defaults, los completamos sin perder lo guardado
            const result = JSON.parse(JSON.stringify(ALU_DEFAULTS));
            const merge = (target, src) => {
                for (const k in src) {
                    if (src[k] && typeof src[k]==='object' && !Array.isArray(src[k])) {
                        if (!target[k]) target[k] = {};
                        merge(target[k], src[k]);
                    } else {
                        target[k] = src[k];
                    }
                }
            };
            merge(result, saved);
            return result;
        }
        function alu_restaurarFabrica() {
            if (!confirm('Esto restaurará TODOS los precios y parámetros de aluminio a los valores de fábrica. ¿Continuar?')) return;
            localStorage.removeItem(ALU_STORAGE_KEY);
            aluConfig = JSON.parse(JSON.stringify(ALU_DEFAULTS));
            alu_renderConfigUI();
            toast('Valores de fábrica restaurados', 'success');
        }

        // ---------- NAVEGACIÓN ENTRE VISTAS ----------
        function abrirVistaAluminio() {
            if (!aluConfig) alu_loadConfig();
            document.getElementById('main-view').style.display = 'none';
            document.querySelector('header').style.display = 'none';
            document.getElementById('alu-view').classList.add('active');
            alu_renderUI();
            alu_actualizarVisibilidadBasc();
            window.scrollTo({top:0, behavior:'instant'});
        }
        function cerrarVistaAluminio() {
            document.getElementById('alu-view').classList.remove('active');
            document.getElementById('main-view').style.display = 'block';
            document.querySelector('header').style.display = 'flex';
            window.scrollTo({top:0, behavior:'instant'});
        }
        function alu_abrirConfig() {
            alu_renderConfigUI();
            document.getElementById('alu-modal-config').classList.add('show');
            window.scrollTo({top:0});
        }
        function alu_cerrarConfig() {
            document.getElementById('alu-modal-config').classList.remove('show');
        }

        // ---------- RENDER UI PRINCIPAL ----------
        // =================================================================
        // PREVIEW VISUAL — Dibuja un esquema SVG de la ventana según config
        // =================================================================
        function alu_renderPreview() {
            const box = document.getElementById('alu-preview-svg');
            const caption = document.getElementById('alu-preview-caption');
            if (!box) return;

            const cfg = aluState.config;
            const sys = aluState.sistema;
            const isPuerta = (sys === '8025');

            // Dimensiones del SVG (mantener relación ~16:11 horizontal o 11:16 vertical)
            // Para puertas, la verticalidad ayuda; para ventanas, formato horizontal
            const W = 280;
            const H = isPuerta ? 230 : 160;
            const pad = 6;
            const innerW = W - 2*pad;
            const innerH = H - 2*pad;

            // Colores
            const stroke = '#475569';
            const fillFijo = '#dbeafe';   // azul claro = vidrio fijo
            const fillHoja = '#fef3c7';   // amarillo claro = hoja móvil
            const fillCF = '#e0e7ff';     // morado claro = cuerpo fijo grande

            // Helpers para dibujar
            const rect = (x,y,w,h,fill,label,sub) => {
                let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" rx="2"/>`;
                if (label) {
                    const cx = x + w/2, cy = y + h/2;
                    s += `<text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="12" font-weight="700" fill="#334155">${label}</text>`;
                    if (sub) s += `<text x="${cx}" y="${cy + 17}" text-anchor="middle" font-size="9" fill="#64748b">${sub}</text>`;
                }
                return s;
            };
            // Flecha indicando dirección de apertura (para hojas batientes)
            const arrowBat = (x,y,w,h,dir) => {
                // dir: 'right' (manija a la izquierda, abre hacia la derecha) o 'left'
                const cy = y + h/2;
                if (dir === 'right') {
                    return `<path d="M ${x+5} ${y+5} L ${x+w-5} ${cy} L ${x+5} ${y+h-5}" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>`;
                } else {
                    return `<path d="M ${x+w-5} ${y+5} L ${x+5} ${cy} L ${x+w-5} ${y+h-5}" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>`;
                }
            };
            // Marca de basculante: triángulo apuntando hacia adentro
            const arrowBasc = (x,y,w,h) => {
                const cx = x + w/2;
                return `<path d="M ${x+8} ${y+h-4} L ${cx} ${y+4} L ${x+w-8} ${y+h-4}" fill="none" stroke="#d97706" stroke-width="1.5" stroke-linejoin="round"/>`;
            };
            // Marca de corredera: flecha doble horizontal
            const arrowCorr = (x,y,w,h) => {
                const cy = y + h/2;
                return `<path d="M ${x+5} ${cy} L ${x+w-5} ${cy} M ${x+5} ${cy} L ${x+10} ${cy-4} M ${x+5} ${cy} L ${x+10} ${cy+4} M ${x+w-5} ${cy} L ${x+w-10} ${cy-4} M ${x+w-5} ${cy} L ${x+w-10} ${cy+4}" fill="none" stroke="#d97706" stroke-width="1.5"/>`;
            };

            let svgInner = '';
            let captionText = '';

            // Marco perimetral siempre
            svgInner += `<rect x="${pad}" y="${pad}" width="${innerW}" height="${innerH}" fill="white" stroke="${stroke}" stroke-width="2.5" rx="3"/>`;

            switch (cfg) {
                case 'CF': {
                    // Solo cuerpo fijo: rectángulo con vidrio
                    svgInner += rect(pad+8, pad+8, innerW-16, innerH-16, fillCF, 'X', 'Cuerpo fijo');
                    captionText = 'Solo cuerpo fijo. No tiene hojas que abren.';
                    break;
                }
                case 'OX': {
                    // Hoja batiente izquierda + Fijo derecho
                    const wHoja = innerW * 0.45;
                    const wFijo = innerW - wHoja;
                    const hojaX = pad, hojaY = pad;
                    const fijoX = pad + wHoja, fijoY = pad;
                    svgInner += rect(hojaX+4, hojaY+4, wHoja-6, innerH-8, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(hojaX+4, hojaY+4, wHoja-6, innerH-8, 'right');
                    svgInner += rect(fijoX+2, fijoY+4, wFijo-6, innerH-8, fillFijo, 'X', 'Fijo');
                    captionText = 'OX — 1 hoja batiente lateral + cuerpo fijo al lado.';
                    break;
                }
                case 'OXO': {
                    // Hoja izq + Fijo central + Hoja der
                    const wHoja = innerW * 0.27;
                    const wFijo = innerW - 2*wHoja;
                    svgInner += rect(pad+4, pad+4, wHoja-2, innerH-8, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(pad+4, pad+4, wHoja-2, innerH-8, 'right');
                    svgInner += rect(pad+wHoja+4, pad+4, wFijo-8, innerH-8, fillFijo, 'X', 'Fijo');
                    svgInner += rect(pad+wHoja+wFijo, pad+4, wHoja-2, innerH-8, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(pad+wHoja+wFijo, pad+4, wHoja-2, innerH-8, 'left');
                    captionText = 'OXO — 2 hojas batientes a los lados + cuerpo fijo central.';
                    break;
                }
                case '1B_CF': {
                    // Basculante abajo + CF arriba
                    const hBasc = innerH * 0.32;
                    const hCF = innerH - hBasc;
                    svgInner += rect(pad+4, pad+4, innerW-8, hCF-2, fillCF, 'X', 'Cuerpo fijo');
                    svgInner += rect(pad+4, pad+hCF+2, innerW-8, hBasc-6, fillHoja, 'O', 'Basculante');
                    svgInner += arrowBasc(pad+4, pad+hCF+2, innerW-8, hBasc-6);
                    captionText = '1 Basculante (proyectante) abajo + cuerpo fijo arriba.';
                    break;
                }
                case '2B_CF': {
                    const hBasc = innerH * 0.32;
                    const hCF = innerH - hBasc;
                    const wB = (innerW - 4) / 2;
                    svgInner += rect(pad+4, pad+4, innerW-8, hCF-2, fillCF, 'X', 'Cuerpo fijo');
                    svgInner += rect(pad+4, pad+hCF+2, wB-2, hBasc-6, fillHoja, 'O', null);
                    svgInner += arrowBasc(pad+4, pad+hCF+2, wB-2, hBasc-6);
                    svgInner += rect(pad+4+wB, pad+hCF+2, wB-2, hBasc-6, fillHoja, 'O', null);
                    svgInner += arrowBasc(pad+4+wB, pad+hCF+2, wB-2, hBasc-6);
                    captionText = '2 Basculantes abajo + cuerpo fijo arriba.';
                    break;
                }
                case '1H': {
                    // Solo 1 hoja batiente (sin fijo)
                    svgInner += rect(pad+8, pad+8, innerW-16, innerH-16, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(pad+8, pad+8, innerW-16, innerH-16, 'right');
                    captionText = '1 Hoja batiente simple (sin cuerpo fijo).';
                    break;
                }
                case '2H': {
                    const wH = (innerW - 4) / 2;
                    svgInner += rect(pad+4, pad+4, wH-2, innerH-8, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(pad+4, pad+4, wH-2, innerH-8, 'right');
                    svgInner += rect(pad+4+wH, pad+4, wH-2, innerH-8, fillHoja, 'O', 'Hoja');
                    svgInner += arrowBat(pad+4+wH, pad+4, wH-2, innerH-8, 'left');
                    captionText = '2 Hojas batientes (sin cuerpo fijo).';
                    break;
                }
                case '2N': {
                    // Corrediza XO: 1 fija + 1 móvil
                    const wN = (innerW - 4) / 2;
                    svgInner += rect(pad+4, pad+4, wN-2, innerH-8, fillFijo, 'X', null);
                    svgInner += rect(pad+4+wN, pad+4, wN-2, innerH-8, fillHoja, 'O', null);
                    svgInner += arrowCorr(pad+4+wN, pad+4, wN-2, innerH-8);
                    captionText = 'XO — 1 nave fija + 1 nave corrediza.';
                    break;
                }
                case '3N': {
                    // OXO corrediza: las del medio fija, las de afuera móviles
                    const wN = (innerW - 6) / 3;
                    svgInner += rect(pad+4, pad+4, wN-2, innerH-8, fillHoja, 'O', null);
                    svgInner += arrowCorr(pad+4, pad+4, wN-2, innerH-8);
                    svgInner += rect(pad+4+wN+1, pad+4, wN-2, innerH-8, fillFijo, 'X', null);
                    svgInner += rect(pad+4+2*wN+2, pad+4, wN-2, innerH-8, fillHoja, 'O', null);
                    svgInner += arrowCorr(pad+4+2*wN+2, pad+4, wN-2, innerH-8);
                    captionText = 'OXO corrediza — 2 móviles a los lados + fijo central.';
                    break;
                }
                case '4N': {
                    const wN = (innerW - 8) / 4;
                    for (let i = 0; i < 4; i++) {
                        const x = pad+4 + i*(wN+1);
                        const fill = (i < 2) ? fillFijo : fillHoja;
                        const lbl = (i < 2) ? 'X' : 'O';
                        svgInner += rect(x, pad+4, wN-1, innerH-8, fill, lbl, null);
                        if (i >= 2) svgInner += arrowCorr(x, pad+4, wN-1, innerH-8);
                    }
                    captionText = 'OOXX — 4 naves (2 fijas + 2 móviles).';
                    break;
                }
                default:
                    captionText = '';
            }

            box.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${svgInner}</svg>`;
            caption.innerText = captionText;
        }

        function alu_renderUI() {
            // 1. Sistemas
            const cs = document.getElementById('alu-sistema-chips');
            cs.innerHTML = '';
            Object.keys(aluConfig.sistemas).forEach(k => {
                const s = aluConfig.sistemas[k];
                const sel = (k === aluState.sistema) ? 'selected' : '';
                cs.innerHTML += `<div class="alu-chip ${sel}" onclick="alu_setSistema('${k}')">
                    ${s.icono} <b>${k}</b>
                    <span class="alu-chip-sub">${s.tipoLabel}</span>
                </div>`;
            });

            // 2. Diseño (depende del sistema)
            const cc = document.getElementById('alu-config-chips');
            cc.innerHTML = '';
            const validas = aluConfig.configsValidas[aluState.sistema] || [];
            if (!validas.includes(aluState.config)) aluState.config = validas[0];
            validas.forEach(c => {
                const lbl = ALU_CONFIG_LABELS[c];
                const sel = (c === aluState.config) ? 'selected' : '';
                cc.innerHTML += `<div class="alu-chip ${sel}" onclick="alu_setConfig('${c}')">
                    <b>${lbl.label}</b>
                    <span class="alu-chip-sub">${lbl.sub}</span>
                </div>`;
            });

            // 4. Vidrios
            const cv = document.getElementById('alu-vidrio-chips');
            cv.innerHTML = '';
            Object.keys(aluConfig.vidrios).forEach(k => {
                const v = aluConfig.vidrios[k];
                const sel = (k === aluState.vidrio) ? 'selected' : '';
                cv.innerHTML += `<div class="alu-chip ${sel}" onclick="alu_setVidrio('${k}')" style="flex:1 1 47%;">
                    <b>${k}</b>
                    <span class="alu-chip-sub">${v.label.replace(k,'').trim()}</span>
                </div>`;
            });

            // 5. Colores
            const ck = document.getElementById('alu-color-chips');
            ck.innerHTML = '';
            Object.keys(ALU_COLOR_LABELS).forEach(k => {
                const sel = (k === aluState.color) ? 'selected' : '';
                ck.innerHTML += `<div class="alu-chip ${sel}" onclick="alu_setColor('${k}')" style="flex:1 1 30%;">
                    <b style="font-size:0.82rem;">${ALU_COLOR_LABELS[k]}</b>
                </div>`;
            });

            // 6. Instalación
            const ci = document.getElementById('alu-instal-chips');
            ci.innerHTML = '';
            [
                {k:'ninguna', l:'Sin instalación'},
                {k:'basica',  l:'Básica 1er piso'},
                {k:'altura',  l:'Con altura/andamio'}
            ].forEach(opt => {
                const sel = (opt.k === aluState.instalacion) ? 'selected' : '';
                ci.innerHTML += `<div class="alu-chip ${sel}" onclick="alu_setInstalacion('${opt.k}')" style="flex:1 1 30%;">
                    <b style="font-size:0.82rem;">${opt.l}</b>
                </div>`;
            });

            // Listener cuerpo fijo
            const cfChk = document.getElementById('alu-extra-cf');
            cfChk.onchange = () => {
                document.getElementById('alu-cf-medidas').style.display = cfChk.checked ? 'block' : 'none';
            };

            // Preview visual
            alu_renderPreview();
        }

        // Setters (chips clickeables)
        function alu_setSistema(s) { aluState.sistema = s; alu_renderUI(); alu_actualizarCamposExtra(); }
        function alu_setConfig(c)  { aluState.config = c;  alu_renderUI(); alu_actualizarCamposExtra(); }
        function alu_setVidrio(v)  { aluState.vidrio = v;  alu_renderUI(); }
        function alu_setColor(c)   { aluState.color = c;   alu_renderUI(); }
        function alu_setInstalacion(i) { aluState.instalacion = i; alu_renderUI(); }

        // Mostrar/ocultar campos adicionales según la configuración elegida
        function alu_actualizarCamposExtra() {
            const c = aluState.config;
            const necesitaBasc   = (c === '1B_CF' || c === '2B_CF');
            const necesitaHojaBat = (c === 'OX' || c === 'OXO');
            const contBasc = document.getElementById('alu-basc-container');
            const contHoja = document.getElementById('alu-hojabat-container');
            if (contBasc) contBasc.style.display = necesitaBasc ? 'block' : 'none';
            if (contHoja) contHoja.style.display = necesitaHojaBat ? 'block' : 'none';
        }
        // Alias por compatibilidad
        function alu_actualizarVisibilidadBasc() { alu_actualizarCamposExtra(); }

        function alu_toggleDespiece(btn) {
            const d = document.getElementById('alu-despiece');
            const v = d.style.display === 'none';
            d.style.display = v ? 'block' : 'none';
            btn.innerHTML = v ? '📋 Ocultar despiece ▲' : '📋 Ver despiece detallado ▼';
        }

        function alu_fmt(num) {
            return "$" + Math.round(num).toLocaleString('es-CO');
        }

        // =================================================================
        // MOTOR DE CÁLCULO PRINCIPAL
        // =================================================================
        function alu_calcular() {
            // ---- 1. INPUTS ----
            const w = parseFloat(document.getElementById('alu-ancho').value);
            const h = parseFloat(document.getElementById('alu-alto').value);
            if (!w || !h) { toast('Falta ingresar Ancho y Alto', 'warn'); return; }
            if (w < 10 || h < 10) {
                if (!confirm(`Las medidas (${w}×${h} cm) parecen pequeñas. ¿Continuar?`)) return;
            }

            const sys = aluState.sistema;
            const cfg = aluState.config;
            const vid = aluState.vidrio;
            const col = aluState.color;
            const tipoInst = aluState.instalacion;
            const colorIdx = ALU_COLOR_IDX[col];

            const incluirCF = document.getElementById('alu-extra-cf').checked;
            const incluirAlfajia = document.getElementById('alu-extra-alfajia').checked;
            const incluirMosq = document.getElementById('alu-extra-mosquitero').checked;
            const cfAncho = incluirCF ? (parseFloat(document.getElementById('alu-cf-ancho').value)||0) : 0;
            const cfAlto  = incluirCF ? (parseFloat(document.getElementById('alu-cf-alto').value)||0)  : 0;
            const transporte = parseFloat(document.getElementById('alu-transporte').value) || 0;
            const descuento = parseFloat(document.getElementById('alu-descuento').value) || 0;

            const sysData = aluConfig.sistemas[sys];
            const F = aluConfig.formula;
            const inflacion = 1 + (F.inflacion/100);
            const mermaBaja = 1 + (F.mermaBaja/100);
            const mermaAlta = 1 + (F.mermaAlta/100);
            const mermaVid  = 1 + (F.mermaVidrio/100);

            // ---- 2. DETERMINAR NAVES / HOJAS / MÓVILES ----
            let numNaves, numMoviles, numHojas, numBasculantes;
            numBasculantes = 0;
            switch(cfg) {
                case '1H': numNaves=1; numMoviles=1; numHojas=1; break;
                case '2H': numNaves=2; numMoviles=2; numHojas=2; break;
                case '1B_CF': numNaves=1; numMoviles=1; numHojas=1; numBasculantes=1; break;
                case '2B_CF': numNaves=2; numMoviles=2; numHojas=2; numBasculantes=2; break;
                case 'OX':  numNaves=2; numMoviles=1; numHojas=1; break;  // 1 batiente + 1 fijo lateral
                case 'OXO': numNaves=3; numMoviles=2; numHojas=2; break;  // 2 batientes + 1 fijo central
                case '2N': numNaves=2; numMoviles=1; numHojas=0; break;
                case '3N': numNaves=3; numMoviles=2; numHojas=0; break;
                case '4N': numNaves=4; numMoviles=2; numHojas=0; break;
                case 'CF': numNaves=0; numMoviles=0; numHojas=0; break;
                default:   numNaves=2; numMoviles=1; numHojas=0;
            }

            // Alto de la(s) basculante(s) — solo aplica en 1B_CF y 2B_CF
            let basculanteAlto = 0;
            if (numBasculantes > 0) {
                basculanteAlto = parseFloat(document.getElementById('alu-basc-alto').value) || 40;
                if (basculanteAlto >= h - 10) {
                    alert(`El alto de la basculante (${basculanteAlto}cm) deja muy poco espacio para el cuerpo fijo. Revisa.`);
                    basculanteAlto = h - 30; // forzar mínimo 30cm para CF
                }
            }

            // Ancho de la(s) hoja(s) batiente lateral — solo aplica en OX y OXO
            let hojaBatAncho = 0;
            if (cfg === 'OX' || cfg === 'OXO') {
                hojaBatAncho = parseFloat(document.getElementById('alu-hojabat-ancho').value) || 60;
                const anchoTotal = (cfg === 'OXO') ? hojaBatAncho * 2 : hojaBatAncho;
                if (anchoTotal >= w - 30) {
                    alert(`La(s) hoja(s) batiente(s) (${hojaBatAncho}cm) dejan muy poco espacio para el cuerpo fijo. Ajusta.`);
                    hojaBatAncho = (cfg === 'OXO') ? (w-40)/2 : (w-40);
                }
            }

            // ---- 3. ACUMULADOR DE CORTES ----
            const cortes = [];
            const acumPorRef = {};
            function reg(refKey, perfil, largoCm, cantidad) {
                if (cantidad<=0 || largoCm<=0) return;
                const mts = (largoCm * cantidad) / 100;
                if (!acumPorRef[refKey]) acumPorRef[refKey] = { mts:0, perfil };
                acumPorRef[refKey].mts += mts;
                cortes.push({ refKey, ref:perfil.ref, desc:perfil.desc, cant:cantidad, med:largoCm, mts });
            }

            // ---- 4. DESPIECE POR SISTEMA ----
            const vidrios = [];

            if (sys === '3831') {
                // Marco perimetral siempre presente
                reg('cabezalSillar', sysData.perfiles.cabezalSillar, w, 2);
                reg('jamba',         sysData.perfiles.jamba,         h, 2);

                if (cfg === 'CF') {
                    // Solo cuerpo fijo
                    const wVid = w - 5, hVid = h - 5;
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wVid, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hVid, 2);
                    vidrios.push({ w_cm: wVid-0.5, h_cm: hVid-0.5, label:'Vidrio cuerpo fijo' });

                } else if (cfg === 'OX') {
                    // === BATIENTE LATERAL + CUERPO FIJO LATERAL ===
                    const wHoja = hojaBatAncho;            // ancho de la hoja batiente
                    const hHoja = h - 5;                   // alto interior
                    const wFijo = w - wHoja - 5;           // ancho del fijo lateral

                    // Divisor vertical entre hoja y fijo
                    reg('divisor', sysData.perfiles.divisor, h, 1);

                    // Hoja batiente: marco Z (2 verticales + 2 horizontales)
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  hHoja, 2);
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  wHoja - 3, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wHoja - 6, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja - 6, 2);
                    vidrios.push({ w_cm: wHoja - 6, h_cm: hHoja - 6, label:'Hoja batiente (O)' });

                    // Cuerpo fijo lateral: pisavidrio interior
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wFijo, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja, 2);
                    vidrios.push({ w_cm: wFijo - 0.5, h_cm: hHoja - 0.5, label:'Cuerpo fijo (X)' });

                } else if (cfg === 'OXO') {
                    // === 2 BATIENTES LATERALES + CUERPO FIJO CENTRAL ===
                    const wHoja = hojaBatAncho;
                    const hHoja = h - 5;
                    const wFijo = w - (2 * wHoja) - 8;     // descuenta 2 hojas + 2 divisores

                    // 2 divisores verticales
                    reg('divisor', sysData.perfiles.divisor, h, 2);

                    // 2 hojas batientes (idénticas)
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  hHoja, 4);     // 2 verticales × 2 hojas
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  wHoja - 3, 4); // 2 horizontales × 2 hojas
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wHoja - 6, 4);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja - 6, 4);
                    vidrios.push({ w_cm: wHoja - 6, h_cm: hHoja - 6, label:'Hoja batiente izq (O)' });
                    vidrios.push({ w_cm: wHoja - 6, h_cm: hHoja - 6, label:'Hoja batiente der (O)' });

                    // Cuerpo fijo central: pisavidrio interior
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wFijo, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja, 2);
                    vidrios.push({ w_cm: wFijo - 0.5, h_cm: hHoja - 0.5, label:'Cuerpo fijo central (X)' });

                } else if (numBasculantes > 0) {
                    // === BASCULANTE(S) + CUERPO FIJO ARRIBA ===
                    const hBasc = basculanteAlto;        // alto de la basculante
                    const hCF   = h - hBasc;             // alto del cuerpo fijo arriba

                    // Divisor horizontal entre CF arriba y basculante abajo
                    reg('divisor', sysData.perfiles.divisor, w, 1);

                    // --- BASCULANTE(S) ABAJO ---
                    const wHoja = (numBasculantes === 2) ? (w-8)/2 : (w-5);
                    const hHoja = hBasc - 3;
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  hHoja, 2 * numBasculantes);
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  wHoja, 2 * numBasculantes);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wHoja-3, 2 * numBasculantes);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja-3, 2 * numBasculantes);
                    if (numBasculantes === 2) {
                        reg('divisor', sysData.perfiles.divisor, hBasc, 1);
                    }
                    for (let i = 0; i < numBasculantes; i++) {
                        vidrios.push({ w_cm: wHoja-3, h_cm: hHoja-3, label:`Basculante ${i+1}` });
                    }

                    // --- CUERPO FIJO ARRIBA ---
                    const wCFVid = w - 5;
                    const hCFVid = hCF - 5;
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wCFVid, 2);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hCFVid, 2);
                    vidrios.push({ w_cm: wCFVid-0.5, h_cm: hCFVid-0.5, label:'Cuerpo fijo superior' });

                } else {
                    // 1H o 2H — hojas simples sin cuerpo fijo
                    const wHoja = (numHojas === 2) ? (w-8)/2 : (w-5);
                    const hHoja = h - 5;
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  hHoja, 2*numHojas);
                    reg('marcoHoja',  sysData.perfiles.marcoHoja,  wHoja, 2*numHojas);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, wHoja-3, 2*numHojas);
                    reg('pisavidrio', sysData.perfiles.pisavidrio, hHoja-3, 2*numHojas);
                    if (numHojas === 2) reg('divisor', sysData.perfiles.divisor, h, 1);
                    for (let i=0; i<numHojas; i++) {
                        vidrios.push({ w_cm: wHoja-3, h_cm: hHoja-3, label:`Hoja ${i+1}` });
                    }
                }
            } else {
                // Sistemas corredizos (5020, 744, 8025)
                const p = sysData.perfiles;
                reg('cabezal', p.cabezal, w, 1);
                reg('sillar',  p.sillar,  w, 1);
                reg('jamba',   p.jamba,   h, 2);
                if (cfg === 'CF') {
                    const wVid = w-4, hVid = h-4;
                    vidrios.push({ w_cm: wVid, h_cm: hVid, label:'Vidrio cuerpo fijo' });
                } else {
                    const hNave = h - (sys==='8025' ? 6 : 4.5);
                    const wNave = (w - 4) / numNaves;
                    reg('enganche', p.enganche, hNave, numNaves);
                    reg('traslape', p.traslape, hNave, numNaves);
                    reg('horizSup', p.horizSup, wNave, numNaves);
                    reg('horizInf', p.horizInf, wNave, numNaves);
                    for (let i=0; i<numNaves; i++) {
                        vidrios.push({ w_cm: wNave-2, h_cm: hNave-4, label:`Nave ${i+1}` });
                    }
                }
            }

            // Cuerpo fijo extra
            if (incluirCF && cfAncho > 0 && cfAlto > 0) {
                if (sys === '3831') {
                    reg('cabezalSillar', sysData.perfiles.cabezalSillar, cfAncho, 2);
                    reg('jamba',         sysData.perfiles.jamba,         cfAlto,  2);
                    reg('pisavidrio',    sysData.perfiles.pisavidrio, cfAncho-5, 2);
                    reg('pisavidrio',    sysData.perfiles.pisavidrio, cfAlto-5,  2);
                } else {
                    reg('cabezal', sysData.perfiles.cabezal, cfAncho, 1);
                    reg('sillar',  sysData.perfiles.sillar,  cfAncho, 1);
                    reg('jamba',   sysData.perfiles.jamba,   cfAlto,  1);
                    if (sysData.perfiles.adaptador) {
                        reg('adaptador', sysData.perfiles.adaptador, cfAlto, 1);
                    }
                }
                vidrios.push({ w_cm: cfAncho-5, h_cm: cfAlto-5, label:'Cuerpo fijo extra' });
            }

            // ---- 5. COSTO ALUMINIO (con lógica de merma) ----
            const totalMetros = Object.values(acumPorRef).reduce((a,b)=>a+b.mts, 0);
            const esProyectoGrande = totalMetros > F.umbralProyectoGrande;
            let totalAlu = 0;
            let mermaAltaUsada = false;

            cortes.forEach(c => {
                const acumRef = acumPorRef[c.refKey].mts;
                const usarBaja = esProyectoGrande || acumRef >= F.umbralOptimo;
                const factor = usarBaja ? mermaBaja : mermaAlta;
                if (!usarBaja) mermaAltaUsada = true;
                const precioTira = acumPorRef[c.refKey].perfil.precios[colorIdx] * inflacion;
                c.precioTira = precioTira;
                c.factorMerma = factor;
                c.costo = (precioTira / (F.largoTira/100)) * c.mts * factor;
                totalAlu += c.costo;
            });

            // ---- 6. COSTO VIDRIO ----
            const precioVidM2 = (aluConfig.vidrios[vid] || {}).precio || 60000;
            let totalVid = 0;
            vidrios.forEach(v => {
                v.area = (v.w_cm * v.h_cm) / 10000;
                v.costo = v.area * precioVidM2 * mermaVid;
                totalVid += v.costo;
            });

            // ---- 7. ACCESORIOS ----
            const accSys = aluConfig.accesorios[sys] || {};
            let totalAcc = 0;
            const detalleAcc = [];
            const perimetroM = (2*(w+h)) / 100;
            const optMosq = incluirMosq;
            const optAlf  = incluirAlfajia;

            Object.keys(accSys).forEach(k => {
                const a = accSys[k];
                let cant = 0, costo = 0, cantLabel = '';
                if (a.opcional === 'mosquitero' && !optMosq) return;
                if (a.opcional === 'alfajia'    && !optAlf)  return;

                if (a.porHoja) {
                    cant = a.porHoja * Math.max(1, numHojas || numMoviles);
                    costo = cant * a.precio;
                    cantLabel = `x${cant}`;
                } else if (a.porMovil) {
                    cant = a.porMovil * numMoviles;
                    if (cant<=0) return;
                    costo = cant * a.precio;
                    cantLabel = `x${cant}`;
                } else if (a.porMetro) {
                    // Felpa: perímetro real de cada hoja móvil
                    let perimetroHojas = 0;
                    if (numBasculantes > 0) {
                        // Basculantes: ancho de la hoja × alto de la basculante
                        const wH = (numBasculantes === 2) ? (w-8)/2 : (w-5);
                        const hH = basculanteAlto - 3;
                        perimetroHojas = (2 * (wH + hH) / 100) * numBasculantes;
                    } else if (cfg === 'OX' || cfg === 'OXO') {
                        // Hojas batientes laterales: ancho de hoja × alto interior
                        const wH = hojaBatAncho - 6;
                        const hH = h - 5 - 6;
                        perimetroHojas = (2 * (wH + hH) / 100) * numHojas;
                    } else if (numHojas > 0 && sys === '3831') {
                        // Hojas abatibles simples (1H, 2H)
                        const wH = (numHojas === 2) ? (w-8)/2 : (w-5);
                        const hH = h - 5;
                        perimetroHojas = (2 * (wH + hH) / 100) * numHojas;
                    } else if (numMoviles > 0) {
                        // Corredizas: perímetro de cada nave móvil
                        const wN = (w-4)/numNaves;
                        const hN = h - (sys==='8025' ? 6 : 4.5);
                        perimetroHojas = (2 * (wN + hN) / 100) * numMoviles;
                    }
                    cant = perimetroHojas;
                    if (cant <= 0) return;
                    costo = cant * a.precio;
                    cantLabel = `${cant.toFixed(1)} m`;
                } else if (a.porAncho) {
                    cant = w / 100;
                    costo = cant * a.precio;
                    cantLabel = `${cant.toFixed(2)} m`;
                } else if (a.fijo) {
                    cant = 1;
                    costo = a.precio;
                    cantLabel = 'fijo';
                }
                if (costo > 0) {
                    totalAcc += costo;
                    detalleAcc.push({ desc:a.desc, cantLabel, costo });
                }
            });
            const accImprevistos = totalAcc * (F.accImprevistos/100);
            totalAcc += accImprevistos;
            if (accImprevistos > 0) {
                detalleAcc.push({ desc:`Imprevistos (${F.accImprevistos}%)`, cantLabel:'', costo:accImprevistos });
            }

            // ---- 8. MANO DE OBRA E INSUMOS ----
            const areaM2 = (w * h) / 10000;
            const dif = aluConfig.dificultad[sys] || 1.0;
            const factorHojas = 1 + Math.max(0, numMoviles - 1) * 0.15;
            const costoMO = (F.moFija * dif * factorHojas) + (areaM2 * F.moPorM2 * dif);
            const costoInsumos = F.insumosFijos;

            // ---- 9. INSTALACIÓN ----
            let costoInst = 0;
            if (tipoInst === 'basica') costoInst = F.instBasicaFija + (areaM2 * F.instBasicaPorM2);
            else if (tipoInst === 'altura') costoInst = F.instAlturaFija + (areaM2 * F.instAlturaPorM2);

            // ---- 10. TOTALES ----
            const costoMateriales = totalAlu + totalVid;
            const costoPrimo = costoMateriales + totalAcc + costoMO + costoInsumos + costoInst + transporte;
            const utilidad = costoPrimo * (F.utilidad/100);
            const precioVenta = costoPrimo + utilidad - descuento;
            const ivaMonto = precioVenta * (F.iva/100);
            // Aumento general del 5% sobre el precio final (IVA incluido)
            const precioFinal = (precioVenta + ivaMonto) * 1.05;
            const margen = (utilidad / (costoPrimo + utilidad)) * 100;

            // ---- 11. GUARDAR Y RENDERIZAR ----
            aluLastCalc = {
                sys, cfg, vid, col, tipoInst, w, h, numNaves, numMoviles, numHojas,
                numBasculantes, basculanteAlto, hojaBatAncho,
                cortes, vidrios, detalleAcc,
                totalAlu, totalVid, totalAcc, costoMO, costoInsumos, costoInst, transporte,
                costoPrimo, utilidad, precioVenta, ivaMonto, precioFinal, margen,
                mermaAltaUsada, descuento, totalMetros,
                incluirCF, cfAncho, cfAlto, incluirAlfajia, incluirMosq
            };

            // Si el comparador está usando este motor en modo silencioso,
            // no registramos historial ni repintamos UI principal.
            if (window.__cmp_silent_calc) {
                return aluLastCalc;
            }

            // Registrar en historial del dashboard
            if (typeof dash_registrar === 'function') {
                const sysData = aluConfig.sistemas[sys];
                const cfgLbl = (typeof ALU_CONFIG_LABELS !== 'undefined' && ALU_CONFIG_LABELS[cfg])
                    ? ALU_CONFIG_LABELS[cfg].label : cfg;
                dash_registrar({
                    producto: `${sysData.nombre} (${cfgLbl})`,
                    medidas: `${w}×${h}`,
                    precio: precioFinal,
                    fecha: new Date(),
                    origen: 'aluminio'
                });
            }

            alu_renderResult(aluLastCalc);

            // IQ v5.0: análisis inteligente post-cálculo (no rompe nada si iq.js no carga)
            if (typeof iq_analizarAluminio === 'function') iq_analizarAluminio();
        }

        // =================================================================
        // RENDER DE RESULTADOS
        // =================================================================
        function alu_renderResult(r) {
            document.getElementById('alu-result').style.display = 'block';
            document.getElementById('alu-precio-iva').innerText = alu_fmt(r.precioFinal);
            document.getElementById('alu-precio-neto').innerText = alu_fmt(r.precioVenta);

            // Badges
            const bM = document.getElementById('alu-badge-merma');
            if (r.mermaAltaUsada) { bM.className = 'alu-badge warn'; bM.innerText = 'Merma alta (piezas pequeñas)'; }
            else { bM.className = 'alu-badge ok'; bM.innerText = 'Despiece optimizado'; }

            const bMg = document.getElementById('alu-badge-margen');
            bMg.innerText = `Margen ${r.margen.toFixed(1)}%`;

            // Despiece aluminio
            const lP = document.getElementById('alu-list-perfiles');
            lP.innerHTML = '';
            r.cortes.forEach(c => {
                lP.innerHTML += `<div class="alu-row-item">
                    <div>
                        <div class="ref-name">${c.ref} <span style="color:#9ca3af; font-weight:400;">×${c.cant}</span></div>
                        <div class="ref-desc">${c.desc}</div>
                        <div class="ref-detail">${c.med.toFixed(1)} cm c/u · ${c.mts.toFixed(2)} m totales · merma ${Math.round((c.factorMerma-1)*100)}%</div>
                    </div>
                    <div class="ref-cost">${alu_fmt(c.costo)}</div>
                </div>`;
            });
            document.getElementById('alu-total-perfil').innerText = alu_fmt(r.totalAlu);

            // Vidrios
            const lV = document.getElementById('alu-list-vidrios');
            lV.innerHTML = '';
            const vidLabel = aluConfig.vidrios[r.vid].label;
            r.vidrios.forEach(v => {
                lV.innerHTML += `<div class="alu-row-item">
                    <div>
                        <div class="ref-name">${v.label}</div>
                        <div class="ref-desc">${vidLabel}</div>
                        <div class="ref-detail">${v.w_cm.toFixed(1)} × ${v.h_cm.toFixed(1)} cm · ${v.area.toFixed(3)} m²</div>
                    </div>
                    <div class="ref-cost">${alu_fmt(v.costo)}</div>
                </div>`;
            });
            document.getElementById('alu-total-vidrios').innerText = alu_fmt(r.totalVid);

            // Accesorios
            const lA = document.getElementById('alu-list-accesorios');
            lA.innerHTML = '';
            r.detalleAcc.forEach(a => {
                lA.innerHTML += `<div class="alu-row-item">
                    <div>
                        <div class="ref-name">${a.desc} ${a.cantLabel ? `<span style="color:#9ca3af; font-weight:400;">${a.cantLabel}</span>`:''}</div>
                    </div>
                    <div class="ref-cost">${alu_fmt(a.costo)}</div>
                </div>`;
            });
            document.getElementById('alu-total-accesorios').innerText = alu_fmt(r.totalAcc);

            // Mano de obra
            const lM = document.getElementById('alu-list-mo');
            lM.innerHTML = '';
            const moItems = [
                { desc:'Mano de obra (armado)', costo:r.costoMO },
                { desc:'Insumos (silicona, tornillos)', costo:r.costoInsumos },
                { desc:'Instalación', costo:r.costoInst },
                { desc:'Transporte', costo:r.transporte }
            ];
            let totalMO = 0;
            moItems.forEach(m => {
                if (m.costo <= 0) return;
                totalMO += m.costo;
                lM.innerHTML += `<div class="alu-row-item">
                    <div><div class="ref-name">${m.desc}</div></div>
                    <div class="ref-cost">${alu_fmt(m.costo)}</div>
                </div>`;
            });
            document.getElementById('alu-total-mo').innerText = alu_fmt(totalMO);

            // Resumen financiero
            document.getElementById('alu-sum-costo').innerText = alu_fmt(r.costoPrimo);
            document.getElementById('alu-sum-util-pct').innerText = aluConfig.formula.utilidad + '%';
            document.getElementById('alu-sum-util').innerText = alu_fmt(r.utilidad);
            if (r.descuento > 0) {
                document.getElementById('alu-sum-util').innerText += ` (− desc ${alu_fmt(r.descuento)})`;
            }
            document.getElementById('alu-sum-neto').innerText = alu_fmt(r.precioVenta);
            document.getElementById('alu-sum-iva-pct').innerText = aluConfig.formula.iva + '%';
            document.getElementById('alu-sum-iva').innerText = alu_fmt(r.ivaMonto);
            document.getElementById('alu-sum-final').innerText = alu_fmt(r.precioFinal);

            // Scroll suave al resultado
            document.getElementById('alu-result').scrollIntoView({behavior:'smooth', block:'start'});
        }

        // =================================================================
        // COMPARTIR Y AGREGAR AL CARRITO PRINCIPAL
        // =================================================================
        function alu_compartirWA() {
            if (!aluLastCalc) { toast('Calcula primero', 'warn'); return; }
            const r = aluLastCalc;
            const sysData = aluConfig.sistemas[r.sys];
            const cfgLbl = ALU_CONFIG_LABELS[r.cfg].label;
            const vidLbl = aluConfig.vidrios[r.vid].label;
            const colLbl = ALU_COLOR_LABELS[r.col];

            let texto = `*COTIZACIÓN* 📋\n----------------------------\n`;
            texto += `🪟 *Sistema:* ${sysData.nombre}\n`;
            texto += `🔹 *Diseño:* ${cfgLbl}\n`;
            texto += `📏 *Medidas:* ${r.w} × ${r.h} cm\n`;
            texto += `💎 *Vidrio:* ${vidLbl}\n`;
            texto += `🎨 *Color aluminio:* ${colLbl}\n`;
            if (r.incluirCF) texto += `➕ Cuerpo fijo extra ${r.cfAncho}×${r.cfAlto} cm\n`;
            if (r.incluirAlfajia) texto += `➕ Alfajía / poyo reforzado\n`;
            if (r.incluirMosq) texto += `➕ Mosquitero\n`;
            texto += `\n✅ *INCLUYE:* Perfilería aluminio VIALCOR, vidrio, accesorios, herrajes, transporte e instalación. Garantía escrita 18 meses.\n\n`;
            texto += `💰 *Precio total c/IVA:* ${alu_fmt(r.precioFinal)}\n`;
            texto += `----------------------------`;

            // IQ v5.0: añadir las sugerencias opcionales que el vendedor haya marcado
            if (typeof iq_getSugerenciasWAText === 'function') {
                texto += iq_getSugerenciasWAText('alu');
            }

            try { navigator.clipboard.writeText(texto); } catch(e) {}
            window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank');
        }

        function alu_agregarACotizacion() {
            if (!aluLastCalc) { toast('Calcula primero', 'warn'); return; }
            const r = aluLastCalc;
            const cantidad = parseInt(document.getElementById('alu-cantidad').value) || 1;
            const sysData = aluConfig.sistemas[r.sys];
            const cfgLbl = ALU_CONFIG_LABELS[r.cfg].label;
            const item = {
                producto: `${sysData.nombre} (${cfgLbl})`,
                medidas: `${r.w}×${r.h}`,
                vidrio: aluConfig.vidrios[r.vid].label,
                precio: r.precioFinal * cantidad,
                precioUnitario: r.precioFinal,
                cantidad,
                fecha: new Date(),
                esAluminio: true,
                raw: {
                    producto: sysData.nombre,
                    ancho: r.w, alto: r.h,
                    sistema: r.sys, config: r.cfg,
                    espesor: r.vid, color: r.col,
                    instalacion: r.tipoInst,
                    transporte: r.transporte || 0,
                    descuento: r.descuento || 0,
                    extras: {
                        cf: r.incluirCF,
                        cfAncho: r.cfAncho,
                        cfAlto: r.cfAlto,
                        alfajia: r.incluirAlfajia,
                        mosquitero: r.incluirMosq,
                        basculanteAlto: r.basculanteAlto || 0,
                        hojaBatAncho: r.hojaBatAncho || 0
                    },
                    desmonte:false, sandblasting:false, led:false
                }
            };
            quoteItems.push(item);
            if (typeof persistirCarrito === 'function') persistirCarrito();
            renderQuote();
            if (typeof toast === 'function') toast(`Agregado: ${item.producto}`, 'success');
            // Volver a vista principal y mostrar carrito
            cerrarVistaAluminio();
            setTimeout(()=>{
                document.getElementById('quote-summary').scrollIntoView({behavior:'smooth'});
            }, 200);
        }

        // =================================================================
        // CONFIGURACIÓN - MODAL EDITABLE
        // =================================================================
        function alu_renderConfigUI() {
            alu_renderTabPerfiles();
            alu_renderTabAccesorios();
            alu_renderTabVidrios();
            alu_renderTabFormula();
        }

        function alu_cfgSwitchTab(btn, tab) {
            document.querySelectorAll('.alu-cfg-content').forEach(el=>el.classList.remove('active'));
            document.querySelectorAll('.alu-cfg-tab').forEach(el=>el.classList.remove('active'));
            document.getElementById('alu-cfg-tab-'+tab).classList.add('active');
            btn.classList.add('active');
        }

        // PERFILES: tabla editable por sistema, con selector de color
        let aluCfgCurrentColor = 'natural';
        function alu_renderTabPerfiles() {
            const t = document.getElementById('alu-cfg-tab-perfiles');
            // Pestañas de color
            let colorTabsHTML = '<div class="alu-color-tabs">';
            Object.keys(ALU_COLOR_LABELS).forEach(k => {
                const sel = (k === aluCfgCurrentColor) ? 'active' : '';
                colorTabsHTML += `<div class="alu-color-tab ${sel}" onclick="aluCfgCurrentColor='${k}'; alu_renderTabPerfiles();">${ALU_COLOR_LABELS[k]}</div>`;
            });
            colorTabsHTML += '</div>';

            let html = `<div class="alu-quick-info">
                Precios por <b>tira completa de 6m</b>. Selecciona el color para editar la columna correspondiente. Toca cualquier valor para modificarlo.
            </div>` + colorTabsHTML;

            const colorIdx = ALU_COLOR_IDX[aluCfgCurrentColor];
            Object.keys(aluConfig.sistemas).forEach(sysKey => {
                const s = aluConfig.sistemas[sysKey];
                html += `<div class="alu-cfg-section-title">${s.icono} ${s.nombre}</div>`;
                Object.keys(s.perfiles).forEach(pKey => {
                    const p = s.perfiles[pKey];
                    const val = p.precios[colorIdx];
                    html += `<div class="alu-edit-row">
                        <label>${p.desc}<span class="ref-tag">${p.ref}</span></label>
                        <input type="number" value="${val}"
                            data-target="sistemas.${sysKey}.perfiles.${pKey}.precios.${colorIdx}">
                    </div>`;
                });
            });
            t.innerHTML = html;
        }

        function alu_renderTabAccesorios() {
            const t = document.getElementById('alu-cfg-tab-accesorios');
            let html = `<div class="alu-quick-info">
                Precios de cada accesorio. Aquí defines lo que cuesta cada bisagra, rodachina, cerradura, manija, felpa por metro, etc.
            </div>`;
            Object.keys(aluConfig.accesorios).forEach(sysKey => {
                const sys = aluConfig.sistemas[sysKey];
                html += `<div class="alu-cfg-section-title">${sys.icono} ${sys.nombre}</div>`;
                const accs = aluConfig.accesorios[sysKey];
                Object.keys(accs).forEach(aKey => {
                    const a = accs[aKey];
                    let tipoLabel = '';
                    if (a.porHoja) tipoLabel = `${a.porHoja}/hoja`;
                    else if (a.porMovil) tipoLabel = `${a.porMovil}/móvil`;
                    else if (a.porMetro) tipoLabel = `por metro`;
                    else if (a.porAncho) tipoLabel = `por m de ancho`;
                    else if (a.fijo) tipoLabel = `fijo`;
                    html += `<div class="alu-edit-row">
                        <label>${a.desc}<span class="ref-tag">${tipoLabel}${a.opcional?' · opcional':''}</span></label>
                        <input type="number" value="${a.precio}"
                            data-target="accesorios.${sysKey}.${aKey}.precio">
                    </div>`;
                });
            });
            t.innerHTML = html;
        }

        function alu_renderTabVidrios() {
            const t = document.getElementById('alu-cfg-tab-vidrios');
            let html = `<div class="alu-quick-info">
                Precio del vidrio por metro cuadrado. Estos son los precios que se aplican al área neta del vano (después de descontar la perfilería).
            </div>`;
            html += `<div class="alu-cfg-section-title">💎 Vidrios disponibles ($/m²)</div>`;
            Object.keys(aluConfig.vidrios).forEach(vKey => {
                const v = aluConfig.vidrios[vKey];
                html += `<div class="alu-edit-row">
                    <label>${v.label}<span class="ref-tag">${vKey}</span></label>
                    <input type="number" value="${v.precio}" data-target="vidrios.${vKey}.precio">
                </div>`;
            });
            t.innerHTML = html;
        }

        function alu_renderTabFormula() {
            const t = document.getElementById('alu-cfg-tab-formula');
            let html = `<div class="alu-quick-info">
                Estos son los parámetros del cálculo. Aquí controlas tu utilidad, mermas, mano de obra, etc. Son los <b>botones más importantes</b> para ajustar el precio final.
            </div>`;
            const F = aluConfig.formula;
            const items = [
                {section:'💰 Utilidad e IVA', rows:[
                    {k:'utilidad', label:'Utilidad sobre costo primo (%)'},
                    {k:'iva', label:'IVA (%)'}
                ]},
                {section:'📈 Inflación y Mermas', rows:[
                    {k:'inflacion', label:'Inflación sobre lista (%)'},
                    {k:'mermaBaja', label:'Merma aluminio - obra grande (%)'},
                    {k:'mermaAlta', label:'Merma aluminio - pieza pequeña (%)'},
                    {k:'umbralOptimo', label:'Umbral metros para merma baja (m)'},
                    {k:'umbralProyectoGrande', label:'Umbral total proyecto grande (m)'},
                    {k:'mermaVidrio', label:'Merma vidrio (%)'},
                    {k:'accImprevistos', label:'Imprevistos accesorios (%)'},
                    {k:'largoTira', label:'Largo tira aluminio (cm)'}
                ]},
                {section:'🛠️ Mano de Obra e Insumos', rows:[
                    {k:'moFija', label:'MO base por ventana ($)'},
                    {k:'moPorM2', label:'MO variable por m² ($)'},
                    {k:'insumosFijos', label:'Insumos fijos (silicona, etc.) ($)'}
                ]},
                {section:'🚚 Instalación', rows:[
                    {k:'instBasicaFija', label:'Instalación básica - fijo ($)'},
                    {k:'instBasicaPorM2', label:'Instalación básica - por m² ($)'},
                    {k:'instAlturaFija', label:'Instalación con altura - fijo ($)'},
                    {k:'instAlturaPorM2', label:'Instalación con altura - por m² ($)'}
                ]}
            ];
            items.forEach(g => {
                html += `<div class="alu-cfg-section-title">${g.section}</div>`;
                g.rows.forEach(r => {
                    html += `<div class="alu-edit-row">
                        <label>${r.label}</label>
                        <input type="number" value="${F[r.k]}" step="${(r.k.includes('umbral')?'0.1':'1')}" data-target="formula.${r.k}">
                    </div>`;
                });
            });
            // Dificultad por sistema
            html += `<div class="alu-cfg-section-title">⚙️ Dificultad de armado (multiplicador MO)</div>`;
            Object.keys(aluConfig.dificultad).forEach(sk => {
                html += `<div class="alu-edit-row">
                    <label>${aluConfig.sistemas[sk].nombre}<span class="ref-tag">sistema ${sk}</span></label>
                    <input type="number" step="0.05" value="${aluConfig.dificultad[sk]}" data-target="dificultad.${sk}">
                </div>`;
            });
            t.innerHTML = html;
        }

        function alu_guardarConfigEditada() {
            // Recorrer todos los inputs con data-target y aplicarlos
            const inputs = document.querySelectorAll('#alu-modal-config input[data-target]');
            inputs.forEach(inp => {
                const path = inp.dataset.target.split('.');
                const val = parseFloat(inp.value);
                if (isNaN(val)) return;
                let obj = aluConfig;
                for (let i=0; i<path.length-1; i++) {
                    obj = obj[path[i]];
                    if (!obj) return;
                }
                obj[path[path.length-1]] = val;
            });
            alu_saveConfig();
            // Refresh UI principal
            alu_renderUI();
            toast('Configuración guardada', 'success');
            alu_cerrarConfig();
        }

        // ---------- INIT ----------
        alu_loadConfig();
        // Asegurar config inicial si nunca se abrió la vista
        if (aluConfig && aluConfig.configsValidas) {
            const valida = aluConfig.configsValidas[aluState.sistema];
            if (!valida.includes(aluState.config)) aluState.config = valida[0];
        }
        // ===== FIN MÓDULO ALUMINIO =====