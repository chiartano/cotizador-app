(function (global) {
  'use strict';

  const localHost = /^(localhost|127\.0\.0\.1)$/.test(global.location?.hostname || '');
  const params = new URLSearchParams(global.location?.search || '');
  const explicit = params.get('agendaAdvisor');
  const releaseEnabled = global.document?.querySelector?.('meta[name="wilan-agenda-advisor-enabled"]')?.content === 'true';
  const emulator = localHost && params.get('agendaEmulator') !== '0';
  const productionFirebase = Object.freeze({
    apiKey: 'AIzaSyAhLwVdU9vWghBC0ieu5FUmgOfPZsYaTUw',
    authDomain: 'contabilidad-vidrio.firebaseapp.com',
    projectId: 'contabilidad-vidrio',
    storageBucket: 'contabilidad-vidrio.firebasestorage.app',
    messagingSenderId: '732209399912',
    appId: '1:732209399912:web:c23b6729a5067759f053dd'
  });
  const demoFirebase = Object.freeze({
    apiKey: 'fake-api-key',
    authDomain: 'demo-wilan-agenda-backend.firebaseapp.com',
    projectId: 'demo-wilan-agenda-backend',
    storageBucket: 'demo-wilan-agenda-backend.appspot.com',
    messagingSenderId: '123456789000',
    appId: '1:123456789000:web:agendaaccessdemo'
  });

  global.WilanAgenda = global.WilanAgenda || {};
  global.WilanAgenda.config = Object.freeze({
    schema: 'wilan-agenda-advisor-config.v1',
    enabled: releaseEnabled || (localHost && explicit !== '0'),
    emulator,
    appId: emulator ? 'app_agenda_demo' : 'contabilidad-vidrio',
    workspaceId: emulator ? 'workspace_agenda_demo' : 'wilan-main',
    region: 'us-central1',
    firebaseSdkVersion: '12.6.0',
    firebase: emulator ? demoFirebase : productionFirebase,
    emulators: Object.freeze({ auth: 9099, firestore: 8085, functions: 5002 }),
    demoAdvisor: Object.freeze({
      email: 'advisor.agenda@example.invalid',
      password: 'Synthetic-Agenda-Advisor-123!'
    }),
    demoApplicant: Object.freeze({
      email: 'applicant.agenda@example.invalid',
      password: 'Synthetic-Agenda-Applicant-123!'
    })
  });
})(window);
