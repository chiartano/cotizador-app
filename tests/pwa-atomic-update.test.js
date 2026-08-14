const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const blockedBridgeCandidate = '55eb836e4b640599467c3c2f84a567c340257d92';
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function test(name, callback) {
  try { callback(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

test('1 protocolo controlado de actualización permanece presente', () => {
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(index, /WILAN_PWA_PROTOCOL_VERSION = 1/);
  assert.match(index, /WILAN_PWA_CLIENT_CAPABILITY_ACK/);
});

test('2 usa cache versionada v7.16 y shell critico cerrado con bridge', () => {
  assert.match(sw, /const CACHE_NAME = 'cotizador-v7\.16'/);
  for (const asset of ['index.html', 'app.js', 'aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'styles.css', 'agenda/agenda.css', 'agenda/config.js', 'agenda/ui.js', 'agenda/quoteToCrm.js', 'manifest.json', 'icon.png']) assert.match(sw, new RegExp(asset.replace('.', '\\.')));
});

test('3 install exige ACK de todos los WindowClient', () => {
  assert.match(sw, /clients\.matchAll\(\{ type: 'window', includeUncontrolled: true \}\)/);
  assert.match(sw, /Promise\.all\(windowClients\.map\(requestClientCapability\)\)/);
  assert.match(sw, /WILAN_PWA_CLIENT_CAPABILITY_REQUEST/);
  assert.match(sw, /WILAN_PWA_CLIENT_CAPABILITY_ACK/);
  assert.match(sw, /ACK incompatible/);
  assert.match(sw, /CLIENT_ACK_TIMEOUT_MS/);
});

test('4 install limpia parciales descarga con reload y verifica totalidad', () => {
  assert.match(sw, /await caches\.delete\(CACHE_NAME\)/);
  assert.match(sw, /cache: 'reload'/);
  assert.match(sw, /!response\.ok/);
  assert.match(sw, /verification\.some\(response => !response\)/);
  assert.match(sw, /catch \(error\)[\s\S]{0,100}caches\.delete\(CACHE_NAME\)/);
});

test('5 no autoactiva y solo acepta SKIP_WAITING', () => {
  const calls = [...sw.matchAll(/self\.skipWaiting\(\)/g)];
  assert.equal(calls.length, 1);
  assert.match(sw, /event\.data\?\.type === 'SKIP_WAITING'/);
  const installBlock = sw.slice(sw.indexOf("addEventListener('install'"), sw.indexOf("addEventListener('message'"));
  assert.doesNotMatch(installBlock, /skipWaiting/);
});

test('6 activate elimina solo caches Cotizador anteriores', () => {
  assert.match(sw, /cacheName\.startsWith\(CACHE_PREFIX\) && cacheName !== CACHE_NAME/);
  assert.match(sw, /self\.clients\.claim/);
});

test('7 shell se sirve cache-first sin escrituras runtime', () => {
  const fetchBlock = sw.slice(sw.indexOf("addEventListener('fetch'"));
  assert.match(fetchBlock, /cachedShellResponse\('\.\/index\.html'\)/);
  assert.match(fetchBlock, /criticalAssetKey/);
  assert.doesNotMatch(fetchBlock, /fetch\(/);
  assert.doesNotMatch(fetchBlock, /cache\.put/);
});

test('8 integracion no agrega escrituras runtime ni CDN al shell', () => {
  assert.doesNotMatch(sw, /gstatic|firebasejs/);
  const fetchBlock = sw.slice(sw.indexOf("addEventListener('fetch'"));
  assert.doesNotMatch(fetchBlock, /cache\.put|fetch\(/);
});

test('9 archivos ajenos a la corrección no cambian', () => {
  const protectedFiles = [
    'dashboard.js', 'iq.js', 'styles.css',
    'manifest.json', 'icon.png', '_verify_tmp.js'
  ];
  assert.equal(git(['diff', '--name-only', blockedBridgeCandidate, '--', ...protectedFiles]), '');
});

test('10 no borra datos del navegador', () => {
  assert.doesNotMatch(sw, /localStorage|sessionStorage|indexedDB|cookie/i);
});

if (process.env.WILAN_SKIP_BROWSER === '1') {
  console.log('skip - 11 navegador real bloqueado por politica del entorno');
} else test('11 runner de navegador real completa la matriz atomica', () => {
  const harness = path.join(root, 'scripts', 'pwa-atomic-browser-harness.js');
  execFileSync(process.execPath, [harness], {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, WILAN_PWA_LAB_ROOT: process.env.WILAN_PWA_LAB_ROOT || path.resolve(root, '..') }
  });
});
