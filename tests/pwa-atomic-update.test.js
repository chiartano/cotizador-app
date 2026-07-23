const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const bridgeCommit = '04b7ed374a4d69bf86242b5a4e69e2b8c09a6170';
const workerCommit = 'b0a3c5f266a86a9d16e92e96472ff3c1ff3d3d3a';
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function git(args) { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim(); }
function test(name, callback) {
  try { callback(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

test('1 etapa 2 no modifica index.html', () => {
  assert.equal(git(['diff', '--name-only', bridgeCommit, workerCommit, '--', 'index.html']), '');
});

test('2 usa cache versionada v7.6 y shell critico cerrado', () => {
  assert.match(sw, /const CACHE_NAME = 'cotizador-v7\.6'/);
  for (const asset of ['index.html', 'app.js', 'aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'styles.css', 'agenda/agenda.css', 'agenda/config.js', 'agenda/ui.js', 'manifest.json', 'icon.png']) assert.match(sw, new RegExp(asset.replace('.', '\\.')));
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

test('9 archivos monetarios y canonicos no cambian', () => {
  const baseline = '3aedb52d784c981a5d4f719b4657100531cf7214';
  const protectedFiles = ['aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'manifest.json', 'icon.png', '_verify_tmp.js', 'tests/fase1-calculos.test.js'];
  assert.equal(git(['diff', '--name-only', baseline, '--', ...protectedFiles]), '');
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
