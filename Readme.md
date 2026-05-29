\# Cotizador Pro v5.0 — Inteligencia que vende y bloquea errores



\## Qué cambia para el usuario final



\*\*Nada en lo que ya hace hoy.\*\* La app funciona exactamente igual.



Aparecen \*\*tres cosas nuevas\*\* y todas ayudan al vendedor sin pedirle que aprenda nada:



1\. \*\*⚡ Plantillas rápidas\*\* (al inicio de cada vista) — 1 toque y todo cargado: producto, vidrio, medidas

2\. \*\*🧠 Banda inteligente\*\* (sobre el precio después de calcular) — avisos técnicos, recomendaciones con botón "✓ Usar", upsells dorados

3\. \*\*📸 Imagen profesional para WhatsApp\*\* — genera un PNG con marca, datos, sketch y precio gigante



Si el vendedor ignora las 3 cosas, todo sigue funcionando como en v4. La banda solo aparece si hay algo útil que decir.



\## Archivos a subir al servidor



| Archivo | Estado | Tamaño aprox |

|---|---|---|

| `index.html` | modificado (5 inserciones) | 38 KB |

| `app.js` | modificado (2 líneas) | 54 KB |

| `aluminio.js` | modificado (2 líneas) | 70 KB |

| `styles.css` | modificado (sólo agregado al final) | 41 KB |

| `sw.js` | modificado (cache v5 → v6) | 2.5 KB |

| `iq.js` | \*\*NUEVO\*\* | 34 KB |

| `visual.js` | \*\*NUEVO\*\* | 21 KB |



Súbelos todos juntos a la misma carpeta donde está la app.



\## Las 6 mejoras de inteligencia (lo que pediste)



\### 1) Entiende restricciones técnicas ✅



Cada sistema/producto tiene reglas duras codificadas:

\- \*\*Ancho/alto min/max\*\* (técnico y "ideal")

\- \*\*Vidrios compatibles\*\* y \*\*prohibidos\*\*

\- \*\*Área máxima\*\* recomendada

\- \*\*Ancho máximo de nave\*\* (corredizas) y \*\*ancho máximo de hoja\*\* (batientes)



Ejemplos reales que vienen cargados:

\- Puerta VC8025: alto mínimo 200 cm, vidrios 4 y 5 mm prohibidos

\- VC5020 corrediza liviana: vidrio 10 mm prohibido, ancho máx 240 cm

\- División Corrediza Premium: vidrio 6 mm prohibido (mínimo 8 mm)



\### 2) Recomienda mejores configuraciones ✅



La banda muestra recomendaciones \*\*con un botón "✓ Usar"\*\* que aplica el cambio y recalcula:

\- VC5020 con ancho > 240 cm → sugiere PC744

\- PC744 con vano chico (< 140×120) → sugiere VC5020 (ahorro real)

\- Premium con vano < 100×200 → sugiere Clásica (~$100k menos)

\- Batiente con ancho > 140 cm → sugiere Corrediza

\- Puerta VC8025 con alto < 200 → sugiere PC744 (no es puerta)



\### 3) Bloquea errores graves ✅



Funciones `iq\_validarPrincipalAntes()` y `iq\_validarAluminioAntes()` listas para llamarse antes de calcular si quieres bloqueo duro. \*\*Por ahora se llaman post-cálculo\*\* (banda roja) para no interrumpir al vendedor, pero los hooks están dejados listos para activar el confirm si más adelante prefieres bloqueo modal.



\### 4) Sugiere upsells automáticamente ✅



Panel dorado con sugerencias accionables:

\- Espejo sin LED → "✨ Luz LED retroiluminada +$50k"

\- División sin sandblasting → "🌫️ Sandblasting +30%"

\- Ventana en aluminio sin mosquitero → "🦟 Mosquitero"

\- Área > 1.5m² sin alfajía → "🪨 Alfajía/poyo reforzado"

\- Color natural en sistema premium → "⚫ Color negro/madera +10%"

\- Vidrio crudo en exteriores → "🛡️ Subir a templado"

\- Línea controlada en Premium → "🏆 Línea Empresa (garantía 18 meses)"

\- Cotización sin desmonte → "🧰 Incluir desmonte +$20k"



Cada upsell tiene su botón "+ Agregar" que aplica y recalcula.



\### 5) Cotización visual profesional ✅



Botón \*\*"📸 IMAGEN PROFESIONAL PARA WHATSAPP"\*\* genera al instante una tarjeta PNG (1080×1350, formato Instagram/WhatsApp) con:

\- Header azul con gradiente y línea dorada

\- Datos del cliente si los hay (nombre, obra)

\- Producto, medidas, vidrio, color, extras

\- Sketch visual del producto (reutiliza el SVG del preview en aluminio, dibuja sketch genérico en principal)

\- Precio con IVA en grande

\- Bloque "Incluye" con garantía

\- Validez 8 días



Botones del modal:

\- \*\*Compartir\*\* — usa Web Share API si el navegador lo soporta (Android Chrome, iOS Safari), si no descarga el PNG y abre WhatsApp con texto

\- \*\*Descargar PNG\*\*

\- \*\*Copiar texto\*\* — solo el texto formateado para pegar

\- \*\*Cerrar\*\*



\### 6) Reduce tiempo mental del vendedor ✅



\*\*Plantillas rápidas\*\* arriba de cada vista (1 toque carga todo):

\- 🚿 Ducha estándar 90×190

\- 🚿 Ducha amplia 120×200

\- 📐 Baño en L 80+90×200

\- 🪞 Espejo baño 70×100

\- 💼 Cortaviento oficina 150×200

\- 🪟 Ventana baño 80×60 (Frozen, abatible)

\- 🛏️ Ventana dormitorio 120×100

\- 🛋️ Ventana sala 240×140

\- 🚪 Puerta patio 240×210



El vendedor que cotiza duchas 10 veces al día ahora lo hace en 2 toques: chip → calcular.



\## Detalles técnicos importantes



\### Aislamiento (igual patrón que v4)



\- `iq.js` usa prefijo `iq\_` / `IQ\_` para TODO

\- `visual.js` usa prefijo `viz\_` / `VIZ\_`

\- Ninguna variable nueva colisiona con código existente

\- Si los nuevos archivos NO se cargan por cualquier razón, la app sigue funcionando: los hooks usan `if (typeof iq\_analizarPrincipal === 'function')` y los botones nuevos hacen `toast` si las funciones no existen



\### Hooks mínimos en archivos existentes



\- En `app.js`: \*\*2 líneas\*\* después de `mostrarResultados(...)` para llamar a `iq\_analizarPrincipal()`

\- En `aluminio.js`: \*\*2 líneas\*\* después de `alu\_renderResult(...)` para llamar a `iq\_analizarAluminio()`

\- En `index.html`: 5 inserciones — 2 contenedores de plantillas, 2 contenedores de banda IQ, 2 botones "📸 IMAGEN", 1 modal viz, 2 tags `<script>`

\- En `styles.css`: \*\*solo agregado al final\*\*, sin modificar nada existente

\- En `sw.js`: cache `v5` → `v6` e incluir 2 archivos nuevos



\### Banda inteligente: comportamiento



\- Solo aparece si hay algo que mostrar (warnings, recomendaciones o upsells)

\- Si todo está OK muestra una franja verde "✅ Configuración técnicamente correcta"

\- Errores en rojo (🚫), warnings en amarillo (⚠️), info en azul (ℹ️)

\- Recomendaciones en verde con botón "✓ Usar" que aplica y recalcula

\- Upsells en panel dorado con "+ Agregar" individual



\### Generador visual: detalles del PNG



\- Resolución 1080×1350 — proporción 4:5 que WhatsApp e Instagram NO recortan

\- Texto y precio renderizados con Canvas API (sin librerías externas)

\- Sketch de aluminio reutiliza el SVG del preview vía Blob URL → Image → drawImage

\- Sketch del cotizador principal se dibuja directo en Canvas según tipo (espejo, L, corrediza, batiente, mampara)

\- Web Share API con archivos si está disponible (móvil); fallback a descarga + WhatsApp web



\### Cache del PWA



Subí `CACHE\_NAME` de `cotizador-v5` a `cotizador-v6`. El service worker borra el caché viejo automáticamente al activarse.



También subí `APP\_VERSION` de 4.0 a 5.0.



\## Cómo probar (en orden)



1\. Sube los 7 archivos al servidor

2\. Abre la app, fuerza recarga (Ctrl+Shift+R en escritorio, cierra y abre en móvil)

3\. \*\*Plantillas\*\*: Verás chips amarillos arriba — toca "🚿 Ducha estándar 90×190" → todo cargado, toca Calcular

4\. \*\*Banda IQ\*\*: Tras calcular, mira encima del precio — debería decir "✅ Configuración técnicamente correcta" o mostrar avisos/upsells

5\. \*\*Probar error\*\*: en aluminio elige sistema VC8025 (Puerta) con alto 180 cm → banda roja "Alto muy bajo, las puertas necesitan mínimo 200cm"

6\. \*\*Probar recomendación\*\*: en aluminio elige PC744 con 100×80 → banda verde "Vano chico: VC5020 también sirve y baja precio" con botón "✓ Usar" → tócalo y se recalcula automático

7\. \*\*Probar upsell\*\*: cotiza un espejo flotante 70×100 sin LED → panel dorado con "✨ Luz LED retroiluminada — + Agregar"

8\. \*\*Imagen pro\*\*: toca "📸 IMAGEN PROFESIONAL PARA WHATSAPP" → ver tarjeta → tocar "Compartir" o "Descargar PNG"



\## Si algo sale mal



Los archivos modificados se pueden revertir sin problema:

\- `app.js`: borra las 2 líneas tras `mostrarResultados(...)`

\- `aluminio.js`: borra las 2 líneas tras `alu\_renderResult(...)`

\- `index.html`: borra las 5 inserciones (busca "v5.0" en comentarios)

\- `styles.css`: borra todo a partir de `/\* IQ v5.0 \*/`

\- `sw.js`: vuelve a `cotizador-v5` y borra `iq.js`/`visual.js` del array



Los archivos nuevos `iq.js` y `visual.js` quedarán huérfanos pero no romperán nada.



\## Riesgo y compatibilidad



\- ✅ Compatible 100% con datos guardados de v4 (mismo localStorage)

\- ✅ El comparador (v4) sigue funcionando

\- ✅ El dashboard (v4) sigue funcionando — sigue registrando todas las cotizaciones

\- ✅ Funciona offline una vez cacheado

\- ✅ Web Share API tiene fallback — si no está, descarga + WhatsApp web

\- ⚠️ El Canvas del generador puede tardar 200-500ms en abrirse en móviles viejos (Android < 8), pero no bloquea la app

\- ⚠️ Si el sketch SVG del aluminio no se carga (caso raro de CORS), el sketch sale en blanco con texto "Vista previa" — no rompe nada



\## Próximos pasos posibles (no incluidos, sugeridos para v5.1 o v6)



\- Activar el `iq\_validarPrincipalAntes()` como bloqueo modal pre-cálculo si las quejas de errores graves persisten

\- Banner "Precio muy bajo / muy alto vs. histórico del producto" usando el dashboard

\- Personalizar plantillas: que el vendedor agregue las suyas desde un modal

\- Logo/marca del negocio en la imagen pro (cargar PNG del logo en config)
