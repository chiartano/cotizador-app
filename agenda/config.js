(function (global) {
  'use strict';

  const localHost = /^(localhost|127\.0\.0\.1)$/.test(global.location?.hostname || '');
  const params = new URLSearchParams(global.location?.search || '');
  const explicit = params.get('agendaAdvisor');
  const releaseEnabled = global.document?.querySelector?.('meta[name="wilan-agenda-advisor-enabled"]')?.content === 'true';

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.config = Object.freeze({
    schema: 'wilan-agenda-advisor-config.v1',
    enabled: releaseEnabled || (localHost && explicit !== '0'),
    emulator: localHost && params.get('agendaEmulator') !== '0',
    appId: 'contabilidad-vidrio',
    workspaceId: 'wilan-main',
    region: 'us-central1',
    firebaseSdkVersion: '12.6.0',
    firebase: Object.freeze({
      apiKey: 'AIzaSyAhLwVdU9vWghBC0ieu5FUmgOfPZsYaTUw',
      authDomain: 'contabilidad-vidrio.firebaseapp.com',
      projectId: 'contabilidad-vidrio',
      storageBucket: 'contabilidad-vidrio.firebasestorage.app',
      messagingSenderId: '732209399912',
      appId: '1:732209399912:web:c23b6729a5067759f053dd'
    }),
    emulators: Object.freeze({ auth: 9099, firestore: 8085, functions: 5002 }),
    demoAdvisor: Object.freeze({
      email: 'advisor.agenda@example.invalid',
      password: 'Synthetic-Agenda-Advisor-123!'
    })
  });
})(window);
