const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = 'b0a3c5f266a86a9d16e92e96472ff3c1ff3d3d3a';
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const blockStart = index.indexOf("if ('serviceWorker' in navigator)");
const pwaBlock = index.slice(blockStart, index.indexOf('</script>', blockStart));

function git(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

async function test(name, callback) {
  try {
    await callback();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function updateCheckBody() {
  const match = pwaBlock.match(/window\.setTimeout\(\(\) => \{([\s\S]*?)\n\s*\}, 1000\);/);
  assert.ok(match, 'No se encontro la comprobacion diferida de actualizacion');
  return match[1];
}

async function exerciseUpdateCheck(registration) {
  const warnings = [];
  let delay = null;
  const fakeWindow = {
    setTimeout(callback, milliseconds) {
      delay = milliseconds;
      callback();
    }
  };
  const fakeConsole = { warn: (...args) => warnings.push(args) };
  const execute = new Function('reg', 'window', 'console', `window.setTimeout(() => {${updateCheckBody()}\n}, 1000);`);
  execute(registration, fakeWindow, fakeConsole);
  await new Promise(resolve => setImmediate(resolve));
  return { delay, warnings };
}

(async () => {
  await test('1 elimina la llamada incondicional anterior', () => {
    assert.doesNotMatch(pwaBlock, /window\.setTimeout\(\(\) => reg\.update\(\), 1000\)/);
  });

  await test('2 update requiere registration.active', async () => {
    let calls = 0;
    const result = await exerciseUpdateCheck({ active: null, installing: null, update: () => { calls += 1; return Promise.resolve(); } });
    assert.equal(calls, 0);
    assert.equal(result.delay, 1000);
  });

  await test('3 update no se ejecuta mientras existe registration.installing', async () => {
    let calls = 0;
    await exerciseUpdateCheck({ active: {}, installing: {}, update: () => { calls += 1; return Promise.resolve(); } });
    assert.equal(calls, 0);
  });

  await test('4 rechazo de update queda manejado', async () => {
    let calls = 0;
    const error = new Error('fallo controlado');
    const result = await exerciseUpdateCheck({ active: {}, installing: null, update: () => { calls += 1; return Promise.reject(error); } });
    assert.equal(calls, 1);
    assert.equal(result.warnings.length, 1);
    assert.equal(result.warnings[0][0], '[PWA] No fue posible comprobar una actualización:');
    assert.equal(result.warnings[0][1], error);
  });

  await test('5 nueva version conserva hardening y usa shell v7.8', () => {
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.match(sw, /CACHE_NAME = 'cotizador-v7\.8'/);
    assert.match(sw, /await caches\.delete\(CACHE_NAME\)/);
    assert.match(sw, /cache: 'reload'/);
  });

  await test('6 motores monetarios protegidos no cambian', () => {
    const protectedFiles = ['aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'styles.css', 'manifest.json', 'icon.png', '_verify_tmp.js', 'tests/fase1-calculos.test.js'];
    assert.equal(git(['diff', '--name-only', base, '--', ...protectedFiles]), '');
  });

  await test('7 mecanismo PWA no borra localStorage', () => {
    assert.doesNotMatch(pwaBlock, /localStorage\.(?:clear|removeItem)/);
  });

  await test('8 protocolo request ACK permanece', () => {
    assert.match(pwaBlock, /WILAN_PWA_CLIENT_CAPABILITY_REQUEST/);
    assert.match(pwaBlock, /WILAN_PWA_CLIENT_CAPABILITY_ACK/);
    assert.match(pwaBlock, /token: request\.token/);
    assert.match(pwaBlock, /event\.ports\[0\]\.postMessage\(response\)/);
  });

  await test('9 guardia anti loop permanece', () => {
    assert.match(pwaBlock, /UPDATE_RELOAD_GUARD_KEY/);
    assert.match(pwaBlock, /UPDATE_CONSENT_KEY\) !== '1'/);
    assert.match(pwaBlock, /window\.location\.reload\(\)/);
  });

  await test('10 aviso Actualizar ahora y Mas tarde permanece', () => {
    assert.match(pwaBlock, /Actualizar ahora/);
    assert.match(pwaBlock, /Más tarde/);
    assert.match(pwaBlock, /pwa-update-now/);
    assert.match(pwaBlock, /pwa-update-later/);
  });
})().catch(error => {
  console.error(error.stack || error);
  process.exit(1);
});
