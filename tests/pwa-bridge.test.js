const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = '8f6351bf9a65b030c5e8744938324b3c68f488bb';
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function test(name, callback) {
  try { callback(); console.log(`ok - ${name}`); }
  catch (error) { console.error(`not ok - ${name}`); throw error; }
}

const blockStart = index.indexOf("if ('serviceWorker' in navigator)");
const pwaBlock = index.slice(blockStart, index.indexOf('</script>', blockStart));

test('1 sw.js permanece byte por byte igual a la base', () => {
  assert.equal(git(['hash-object', 'sw.js']), git(['rev-parse', `${base}:sw.js`]));
});

test('2 CACHE_NAME continua en cotizador-v7.4', () => {
  assert.match(sw, /const CACHE_NAME = 'cotizador-v7\.4';/);
});

test('3 installed no recarga automaticamente', () => {
  assert.doesNotMatch(pwaBlock, /nuevo\.state === 'installed'[\s\S]{0,180}window\.location\.reload/);
  assert.match(pwaBlock, /nuevo\.state === 'installed'[\s\S]{0,180}showUpdateNotice/);
});

test('4 protocolo capability request y ack es versionado y correlacionado', () => {
  assert.match(pwaBlock, /WILAN_PWA_CLIENT_CAPABILITY_REQUEST/);
  assert.match(pwaBlock, /WILAN_PWA_CLIENT_CAPABILITY_ACK/);
  assert.match(pwaBlock, /protocolVersion: WILAN_PWA_PROTOCOL_VERSION/);
  assert.match(pwaBlock, /controlledUpdate: true/);
  assert.match(pwaBlock, /token: request\.token/);
  assert.match(pwaBlock, /event\.ports\?\.\[0\]/);
  assert.match(pwaBlock, /event\.ports\[0\]\.postMessage/);
});

test('5 aviso y acciones controladas existen', () => {
  assert.match(pwaBlock, /pwa-update-notice/);
  assert.match(pwaBlock, /Actualizar ahora/);
  assert.match(pwaBlock, /Más tarde/);
  assert.match(pwaBlock, /postMessage\(\{ type: 'SKIP_WAITING' \}\)/);
});

test('6 controllerchange exige consentimiento y guardia', () => {
  assert.match(pwaBlock, /controllerchange/);
  assert.match(pwaBlock, /UPDATE_CONSENT_KEY/);
  assert.match(pwaBlock, /UPDATE_RELOAD_GUARD_KEY/);
  assert.match(pwaBlock, /UPDATE_CONSENT_KEY\) !== '1'/);
});

test('7 actividad incluye campos resultado aluminio carrito y modales', () => {
  for (const token of ['observaciones', 'res-precio-final', 'alu-result', 'quote-summary', 'modal-config']) assert.match(pwaBlock, new RegExp(token));
  assert.match(pwaBlock, /puede descartar los campos actuales/);
});

test('8 mecanismo PWA no toca localStorage', () => {
  assert.doesNotMatch(pwaBlock, /localStorage\.(?:clear|removeItem|setItem)/);
});

test('9 solo index y esta prueba difieren de la base', () => {
  const changed = git(['status', '--porcelain']).split(/\r?\n/).filter(Boolean).map(line => line.replace(/^\S+\s+/, ''));
  assert.deepEqual(changed.sort(), ['index.html', 'tests/pwa-bridge.test.js']);
});

test('10 archivos funcionales protegidos no cambiaron', () => {
  const protectedFiles = ['app.js', 'aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'manifest.json', 'icon.png', '_verify_tmp.js', 'tests/fase1-calculos.test.js'];
  assert.equal(git(['diff', '--name-only', base, '--', ...protectedFiles]), '');
});
