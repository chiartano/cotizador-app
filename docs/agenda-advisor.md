# Agenda Compartida para advisor en Cotizador

La integración es aditiva. El release productivo final se activa explícitamente mediante:

```html
<meta name="wilan-agenda-advisor-enabled" content="true">
```

En `localhost` se habilita para pruebas y usa Auth, Firestore y Functions Emulator. El Cotizador, sus cálculos y sus datos históricos siguen funcionando sin iniciar sesión y sin conexión.

## Arquitectura y límites

- Firebase real objetivo: `contabilidad-vidrio`; workspace: `wilan-main`; callable: `appointmentCommand` en `us-central1`.
- Toda mutación usa `appointment-command.v1.2` por callable. El `payloadHash` enviado es marcador; el backend calcula el hash autoritativo.
- Las únicas lecturas son la membresía propia, appointments compartidos, availability rules/overrides y configuración pública del workspace.
- Nunca se leen `private`, `appointmentCommands`, `availabilityLedger`, cuentas, movimientos, clientes completos, proyectos ni finanzas.
- Advisor puede crear, releer, informar el costo de una medición, marcar comunicación y reprogramar una medición elegible.
- Cotizador no presenta revisión, cancelación, completar, no-show, liquidación, excepciones de costo ni conversiones CRM.
- `alternative_proposed` se muestra como decisión pendiente de operator. No existe un comando advisor para aceptar una alternativa y no se inventó uno.

## Snapshot de cotización

Cada cotización nueva recibe un `quoteId` local al calcular; los ítems añadidos a un mismo carrito heredan ese ID y Agenda lo reutiliza sin regenerarlo. Al agendar se crea un snapshot inmutable con producto, medidas, vidrio/acabado visible, cantidad, total COP, cinco campos canónicos y una allowlist técnica. No transporta fórmulas, recargos, descuentos internos, funciones, DOM, caché, historial ni secretos. Una cotización legacy sin ID usa el flujo directo sin referencia fabricada.

La referencia local confirmada conserva solo `appointmentId`, `initialCommandId`, `linkedAt`, último estado y señal de sincronización. El original del Cotizador no se muta.

## Offline e idempotencia

- El cálculo base y el app shell siguen disponibles offline.
- Una mutación de Agenda sin red se guarda explícitamente como “Pendiente de enviar”.
- No existe envío automático en segundo plano.
- El reintento manual reutiliza exactamente `commandId` y `appointmentId`.
- Un resultado desconocido no puede eliminarse; debe reintentarse para recuperar el replay autoritativo.
- Solo un borrador que nunca se envió puede eliminarse con advertencia.
- El namespace local es `wilan_agenda_advisor_v1`, separado de todas las claves históricas.

## PWA

El shell final es `cotizador-v7.8`. Conserva instalación atómica, descarga con `cache: reload`, verificación total, ACK de ventanas, consentimiento, guardia anti-loop, activación fail-closed y ausencia de escrituras runtime. Los módulos Agenda locales forman parte del shell; los SDK Firebase se cargan solo cuando el feature flag está activo. Si Firebase no está disponible, el Cotizador base continúa operando.

## Preparación productiva — no ejecutar sin la compuerta humana

1. Confirmar que Hosting corresponde exactamente a `chiartano/cotizador-app` y al Firebase `contabilidad-vidrio`.
2. Obtener la cuenta Google exacta que será advisor; no inferir email ni UID.
3. Confirmar que el dominio publicado está autorizado en Firebase Auth; añadirlo solo si falta.
4. Crear o verificar el usuario Auth de esa cuenta.
5. Crear una única membresía activa `advisor` en `artifacts/contabilidad-vidrio/workspaces/wilan-main/members/{uid}` con el esquema exacto.
6. Mantener `advisorCreationEnabled=false` mientras se publica el Cotizador con el meta-flag en `false`.
7. Verificar que `appointmentCommand` conserva Node 22, `us-central1`, `minInstances=0` y fijar `maxInstances=2` en una corrección separada del backend si continúa sin límite explícito.
8. Publicar el shell con Agenda apagada y repetir cálculo, carrito, historiales, offline y actualización desde v7.5.
9. Habilitar `advisorCreationEnabled=true` y después publicar únicamente el cambio del meta-flag a `true`.
10. Ejecutar smoke sintético advisor → CRM: creación, replay, medición informada/no informada, segunda visita tentativa, tercera rechazada, instalación tentativa, corrección/garantía, comunicación y reprogramación de medida.
11. Verificar operator en CRM, aislamiento de workspace y ausencia de private/finanzas en Cotizador.
12. Solo después del smoke decidir el uso con citas reales.

No se debe desplegar ninguna Function desde este repositorio ni copiar contratos al app shell.

## Rollback

Disparadores: duplicado, cita confirmada invisible, acceso cruzado, pérdida de capacidad, mezcla PWA, pérdida de cotización/datos locales o regresión monetaria crítica.

1. Volver el meta-flag a `false` y restaurar el Hosting anterior conocido.
2. Poner `advisorCreationEnabled=false`.
3. Desactivar la membresía advisor si el incidente es de acceso.
4. Mantener la operación operator del CRM.
5. Preservar appointments, `appointmentCommands` y `availabilityLedger`; no borrar citas ni ledgers.
6. No relajar reglas ni modificar cuentas, movimientos, precios, fórmulas o finanzas.
7. Auditar IDs, revisiones, commands y capacidad antes de reabrir.

## Compuerta única

La publicación, creación/membresía advisor, dominio Auth, ajuste de `maxInstances` y smoke productivo sintético requieren una única autorización humana explícita después de completar las pruebas locales.
