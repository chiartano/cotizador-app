const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const repo = path.resolve(__dirname, '..');
const lab = process.env.WILAN_PWA_LAB_ROOT || path.resolve(repo, '..');
const playwrightPath = process.env.WILAN_PLAYWRIGHT_CORE || path.join(lab, 'node_modules', 'playwright-core');
const { chromium } = require(playwrightPath);
const baselines = path.join(lab, 'baselines');
const profiles = path.join(lab, 'profiles');
const evidence = path.join(lab, 'evidencias', 'pwa-atomic-browser-results.json');
const baselineFiles = ['index.html', 'app.js', 'aluminio.js', 'comparador.js', 'dashboard.js', 'iq.js', 'visual.js', 'styles.css', 'manifest.json', 'icon.png', 'sw.js'];
const agendaFiles = ['agenda/agenda.css', 'agenda/config.js', 'agenda/formatters.js', 'agenda/availability.js', 'agenda/pendingDrafts.js', 'agenda/quoteSnapshot.js', 'agenda/firebase.js', 'agenda/auth.js', 'agenda/commands.js', 'agenda/access.js', 'agenda/queries.js', 'agenda/ui.js'];
const servedFiles = [...baselineFiles, ...agendaFiles];
const commits = { A: 'a23e827f628ee8a8678b2ad326ad72aa0d67ba66', B: '8f6351bf9a65b030c5e8744938324b3c68f488bb', Bridge: '04b7ed374a4d69bf86242b5a4e69e2b8c09a6170' };
let active = 'Atomic';
let injectedFailure = null;

function git(args, options = {}) { return execFileSync('git', args, { cwd: repo, ...options }); }
function resetDir(directory) { fs.rmSync(directory, { recursive: true, force: true }); fs.mkdirSync(directory, { recursive: true }); }
function copyCommit(commit, destination) {
  resetDir(destination);
  for (const file of baselineFiles) {
    const data = git(['show', `${commit}:${file}`]);
    const target = path.join(destination, file); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, data);
  }
}
function copyWorkingTree(destination) {
  resetDir(destination);
  for (const file of servedFiles) {
    const target = path.join(destination, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(path.join(repo, file), target);
  }
}
function prepend(file, marker) { fs.writeFileSync(file, `${marker}\n${fs.readFileSync(file, 'utf8')}`); }

function prepareBaselines() {
  fs.mkdirSync(baselines, { recursive: true }); fs.mkdirSync(profiles, { recursive: true }); fs.mkdirSync(path.dirname(evidence), { recursive: true });
  copyCommit(commits.A, path.join(baselines, 'A'));
  copyCommit(commits.B, path.join(baselines, 'B'));
  copyCommit(commits.Bridge, path.join(baselines, 'Bridge'));
  copyWorkingTree(path.join(baselines, 'Atomic'));
  fs.cpSync(path.join(baselines, 'Bridge'), path.join(baselines, 'Incompatible'), { recursive: true });
  const incompatibleIndex = path.join(baselines, 'Incompatible', 'index.html');
  fs.writeFileSync(incompatibleIndex, fs.readFileSync(incompatibleIndex, 'utf8').replace('const WILAN_PWA_PROTOCOL_VERSION = 1;', 'const WILAN_PWA_PROTOCOL_VERSION = 0;'));
  fs.cpSync(path.join(baselines, 'Atomic'), path.join(baselines, 'C'), { recursive: true });
  for (const version of ['Atomic', 'C']) {
    const dir = path.join(baselines, version); const marker = version === 'Atomic' ? 'N' : 'C';
    prepend(path.join(dir, 'index.html'), `<!-- INDEX_RELEASE=${marker} -->`);
    prepend(path.join(dir, 'app.js'), `// APP_RELEASE=${marker}`);
    prepend(path.join(dir, 'comparador.js'), `// COMPARADOR_RELEASE=${marker}`);
    prepend(path.join(dir, 'sw.js'), `// SW_RELEASE=${marker}`);
  }
  fs.cpSync(path.join(baselines, 'Atomic'), path.join(baselines, 'AtomicRetry'), { recursive: true });
  prepend(path.join(baselines, 'AtomicRetry', 'sw.js'), '// RETRY_AFTER_LEGACY_CLOSED');
  const cSw = path.join(baselines, 'C', 'sw.js');
  fs.writeFileSync(cSw, fs.readFileSync(cSw, 'utf8').replace("const CACHE_NAME = 'cotizador-v7.7';", "const CACHE_NAME = 'cotizador-v7.8-audit';"));
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  if (url.pathname === '/__switch__') {
    active = url.searchParams.get('version') || active;
    injectedFailure = url.searchParams.get('failure') || null;
    response.writeHead(200, { 'Cache-Control': 'no-store' }); response.end(JSON.stringify({ active, injectedFailure })); return;
  }
  const relative = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\//, '');
  if (injectedFailure?.file === relative) {
    if (injectedFailure.type === 'interrupt') { response.destroy(); return; }
    response.writeHead(Number(injectedFailure.type), { 'Cache-Control': 'no-store' }); response.end('injected failure'); return;
  }
  const base = path.join(baselines, active); const file = path.normalize(path.join(base, relative));
  if (!file.startsWith(base)) { response.writeHead(403); response.end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { response.writeHead(404, { 'Cache-Control': 'no-store' }); response.end('missing'); return; }
    response.writeHead(200, { 'Content-Type': contentType(file), 'Cache-Control': 'public, max-age=3600' }); response.end(data);
  });
});

async function switchTo(port, version, failure = null) {
  const encoded = failure ? encodeURIComponent(JSON.stringify(failure)) : '';
  await fetch(`http://127.0.0.1:${port}/__switch__?version=${version}&failure=${encoded}`);
  injectedFailure = failure;
}
function cleanProfile(name) { const directory = path.join(profiles, name); fs.rmSync(directory, { recursive: true, force: true }); return directory; }
async function launch(name) { return chromium.launchPersistentContext(cleanProfile(name), { headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' }); }
async function waitUntil(callback, timeout = 12000) {
  const started = Date.now(); let last;
  while (Date.now() - started < timeout) {
    try { last = await callback(); if (last) return last; }
    catch (error) { last = error.message; }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Timeout de navegador; último estado: ${JSON.stringify(last)}`);
}
async function snapshot(page) {
  return page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return {
      fields: Object.fromEntries(['ancho', 'alto', 'observaciones'].map(id => [id, document.getElementById(id)?.value ?? null])),
      result: document.getElementById('res-precio-final')?.innerText || '',
      prompt: !!document.getElementById('pwa-update-notice') && getComputedStyle(document.getElementById('pwa-update-notice')).display !== 'none',
      caches: await caches.keys(), localStorage: Object.fromEntries(Object.entries(localStorage)), sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
      workers: { installing: registration?.installing?.state || null, waiting: registration?.waiting?.state || null, active: registration?.active?.state || null },
      canonicalFunction: typeof buildCanonicalProductMetadata === 'function', title: document.title
    };
  });
}
async function prepareQuote(page) {
  await page.selectOption('#producto', { label: 'División Batiente (Tradicional)' }); await page.evaluate(() => verificarProducto());
  await page.fill('#ancho', '120'); await page.fill('#alto', '150'); await page.evaluate(() => { document.getElementById('observaciones').value = 'TRABAJO-ACTIVO'; });
  await page.selectOption('#espesor', '6mm'); await page.selectOption('#color_acc', 'natural'); await page.evaluate(() => calcular());
  await page.evaluate(() => localStorage.setItem('wilan_atomic_marker', 'preserve-me'));
}
async function installVersion(port, version, profileName) {
  await switchTo(port, version); const context = await launch(profileName); const page = context.pages()[0] || await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1800); await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700);
  return { context, page };
}
async function requestUpdate(page) { await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration(); await registration.update(); }); }

async function legacyDirect(port, version, name) {
  const { context, page } = await installVersion(port, version, name); let navigations = 0; page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; });
  await prepareQuote(page); const before = await snapshot(page); const navBefore = navigations;
  await switchTo(port, 'Atomic'); await requestUpdate(page); await page.waitForTimeout(3500); const after = await snapshot(page);
  assert.deepEqual(after.fields, before.fields); assert.equal(after.result, before.result); assert.equal(navigations, navBefore); assert.deepEqual(after.caches, ['cotizador-v7.4']); assert.equal(after.workers.waiting, null);
  await context.close(); return { before, after, reloads: navigations - navBefore };
}

async function bridgeFlow(port, fromVersion, name) {
  const { context, page } = await installVersion(port, fromVersion, name); let navigations = 0; const dialogs = [];
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations += 1; }); page.on('dialog', async dialog => { dialogs.push(dialog.message()); await dialog.accept(); });
  await prepareQuote(page); const legacyBeforeBridge = await snapshot(page); const navBeforeBridge = navigations;
  await switchTo(port, 'Bridge'); await page.waitForTimeout(1800); const legacyStillOpen = await snapshot(page);
  assert.deepEqual(legacyStillOpen.fields, legacyBeforeBridge.fields); assert.equal(navigations, navBeforeBridge);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(700); await prepareQuote(page); const bridgeBeforeAtomic = await snapshot(page);
  await switchTo(port, 'Atomic'); await requestUpdate(page);
  await waitUntil(async () => (await snapshot(page)).prompt); const waiting = await snapshot(page); const navBeforeLater = navigations;
  await page.click('#pwa-update-later'); await page.waitForTimeout(400); const afterLater = await snapshot(page);
  assert.deepEqual(afterLater.fields, bridgeBeforeAtomic.fields); assert.equal(navigations, navBeforeLater);
  await page.evaluate(() => { sessionStorage.removeItem('wilan_pwa_update_dismissed_v1'); document.getElementById('pwa-update-notice').style.display = 'flex'; });
  await page.click('#pwa-update-now'); await waitUntil(async () => (await snapshot(page)).caches.length === 1 && (await snapshot(page)).caches[0] === 'cotizador-v7.7'); await page.waitForTimeout(700);
  const afterNow = await snapshot(page); assert.equal(navigations, navBeforeLater + 1); assert.equal(afterNow.localStorage.wilan_atomic_marker, 'preserve-me'); assert.deepEqual(afterNow.caches, ['cotizador-v7.7']); assert.equal(dialogs.length, 1); assert.equal(afterNow.canonicalFunction, true);
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500); await prepareQuote(page); const offline = await snapshot(page); assert.equal(offline.result, 'Total con IVA: $729.244');
  await context.close(); return { legacyBeforeBridge, legacyStillOpen, bridgeBeforeAtomic, waiting, afterLater, afterNow, offline, dialogs, consentedReloads: navigations - navBeforeLater };
}

async function incompatibleClient(port) {
  const { context, page } = await installVersion(port, 'Incompatible', 'incompatible'); await prepareQuote(page); const before = await snapshot(page);
  await switchTo(port, 'Atomic'); await requestUpdate(page); await page.waitForTimeout(3200); const after = await snapshot(page);
  assert.deepEqual(after.fields, before.fields); assert.equal(after.workers.waiting, null); assert.deepEqual(after.caches, ['cotizador-v7.4']); await context.close(); return { before, after };
}

async function failedInstall(port, failure, name) {
  const { context, page } = await installVersion(port, 'Bridge', name); await page.evaluate(() => localStorage.setItem('wilan_atomic_marker', 'preserve-me')); const before = await snapshot(page);
  await switchTo(port, 'Atomic', failure); await requestUpdate(page); await page.waitForTimeout(3200); const after = await snapshot(page);
  assert.equal(after.workers.waiting, null); assert.deepEqual(after.caches, ['cotizador-v7.4']); assert.equal(after.localStorage.wilan_atomic_marker, 'preserve-me');
  await context.setOffline(true); const offlinePage = await context.newPage(); await offlinePage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' }); await offlinePage.waitForTimeout(500); const offline = await snapshot(offlinePage); assert.equal(offline.title, 'Cotizador Divisiones');
  await context.close(); return { failure, before, after, offline };
}

async function multipleTabs(port) {
  const { context, page: legacy } = await installVersion(port, 'A', 'multiple-tabs'); await prepareQuote(legacy); const legacyBefore = await snapshot(legacy);
  await switchTo(port, 'Bridge'); const bridge = await context.newPage(); await bridge.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'networkidle' }); await bridge.waitForTimeout(700); await prepareQuote(bridge);
  await switchTo(port, 'Atomic'); await requestUpdate(bridge); await bridge.waitForTimeout(3200); const blocked = await snapshot(bridge); const legacyAfter = await snapshot(legacy);
  assert.equal(blocked.workers.waiting, null); assert.deepEqual(legacyAfter.fields, legacyBefore.fields); assert.deepEqual(blocked.caches, ['cotizador-v7.4']);
  await legacy.close(); await bridge.waitForTimeout(1200); await switchTo(port, 'AtomicRetry');
  await bridge.reload({ waitUntil: 'networkidle' }); await bridge.waitForTimeout(700); await requestUpdate(bridge);
  await waitUntil(async () => { const state = await snapshot(bridge); return state.prompt || (state.workers.waiting === 'installed' && state); }, 18000);
  const allowed = await snapshot(bridge); assert.equal(allowed.workers.waiting, 'installed'); assert.equal(allowed.prompt, true);
  await context.close(); return { legacyBefore, legacyAfter, blocked, allowed };
}

async function consistency(port) {
  const { context, page } = await installVersion(port, 'Bridge', 'consistency');
  page.on('dialog', dialog => dialog.accept()); await prepareQuote(page); await switchTo(port, 'Atomic'); await requestUpdate(page); await waitUntil(async () => (await snapshot(page)).prompt);
  await page.click('#pwa-update-now'); await waitUntil(async () => (await snapshot(page)).caches.includes('cotizador-v7.7')); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(1200);
  await switchTo(port, 'C', { file: 'comparador.js', type: 'interrupt' }); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(700);
  const online = await page.evaluate(async () => ({ indexN: (await fetch('./index.html').then(r => r.text())).includes('INDEX_RELEASE=N'), appN: (await fetch('./app.js').then(r => r.text())).includes('APP_RELEASE=N'), comparadorN: (await fetch('./comparador.js').then(r => r.text())).includes('COMPARADOR_RELEASE=N') }));
  await context.setOffline(true); await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForTimeout(500);
  const offline = await page.evaluate(async () => ({ indexN: (await fetch('./index.html').then(r => r.text())).includes('INDEX_RELEASE=N'), appN: (await fetch('./app.js').then(r => r.text())).includes('APP_RELEASE=N'), comparadorN: (await fetch('./comparador.js').then(r => r.text())).includes('COMPARADOR_RELEASE=N'), caches: await caches.keys() }));
  assert.deepEqual(online, { indexN: true, appN: true, comparadorN: true }); assert.equal(offline.indexN && offline.appN && offline.comparadorN, true);
  await context.close(); return { online, offline };
}

async function monetaryBrowser(port) {
  const { context, page } = await installVersion(port, 'Atomic', 'monetary');
  async function division(label, width, height, color) { await page.selectOption('#producto', { label }); await page.evaluate(() => verificarProducto()); await page.fill('#ancho', String(width)); await page.fill('#alto', String(height)); await page.selectOption('#espesor', '6mm'); await page.selectOption('#color_acc', color); await page.evaluate(() => calcular()); return page.locator('#res-precio-final').innerText(); }
  const base = await division('División Batiente (Tradicional)', 120, 150, 'natural'); const natural = await division('División Corrediza Clásica', 120, 180, 'natural'); const black = await division('División Corrediza Clásica', 120, 180, 'negro'); const outside = await division('División Corrediza Clásica', 131, 180, 'natural');
  await page.evaluate(() => abrirVistaAluminio()); await page.fill('#alu-ancho', '120'); await page.fill('#alu-alto', '100'); await page.evaluate(() => alu_calcular()); const aluminum = await page.locator('#alu-precio-iva').innerText();
  assert.equal(base, 'Total con IVA: $729.244'); assert.equal(natural, 'Total con IVA: $650.000'); assert.equal(black, 'Total con IVA: $690.000'); assert.equal(outside, 'Total con IVA: $787.433'); assert.match(aluminum, /768\.853/);
  await context.close(); return { base, natural, black, outside, aluminum };
}

(async () => {
  prepareBaselines(); const port = await new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server.address().port)));
  const results = { legacyA: await legacyDirect(port, 'A', 'legacy-direct-a'), legacyB: await legacyDirect(port, 'B', 'legacy-direct-b'), bridgeA: await bridgeFlow(port, 'A', 'bridge-a'), bridgeB: await bridgeFlow(port, 'B', 'bridge-b'), incompatible: await incompatibleClient(port), failures: [], multipleTabs: await multipleTabs(port) };
  results.failures.push(await failedInstall(port, { file: 'app.js', type: '404' }, 'fail-404'));
  results.failures.push(await failedInstall(port, { file: 'styles.css', type: '500' }, 'fail-500'));
  results.failures.push(await failedInstall(port, { file: 'visual.js', type: 'interrupt' }, 'fail-interrupt'));
  results.consistency = await consistency(port); results.monetary = await monetaryBrowser(port);
  fs.writeFileSync(evidence, JSON.stringify(results, null, 2)); server.close(); console.log(`ok - navegador real: ${evidence}`);
})().catch(error => { server.close(); console.error(error.stack || error); process.exit(1); });
