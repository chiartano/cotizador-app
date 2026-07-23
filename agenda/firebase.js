(function (global) {
  'use strict';

  const state = { promise: null };
  const loadScript = (url) => new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-wilan-firebase="${url}"]`);
    if (existing) {
      if (existing.dataset.loaded === '1') resolve();
      else existing.addEventListener('load', resolve, { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = url;
    script.async = true;
    script.dataset.wilanFirebase = url;
    script.addEventListener('load', () => { script.dataset.loaded = '1'; resolve(); }, { once: true });
    script.addEventListener('error', () => reject(new Error('FIREBASE_SDK_UNAVAILABLE')), { once: true });
    document.head.appendChild(script);
  });
  const initialize = () => {
    if (global.WilanAgenda.firebase?.adapter) return Promise.resolve(global.WilanAgenda.firebase.adapter);
    if (state.promise) return state.promise;
    state.promise = (async () => {
      const config = global.WilanAgenda.config;
      const base = `https://www.gstatic.com/firebasejs/${config.firebaseSdkVersion}`;
      await loadScript(`${base}/firebase-app-compat.js`);
      await Promise.all([
        loadScript(`${base}/firebase-auth-compat.js`),
        loadScript(`${base}/firebase-firestore-compat.js`),
        loadScript(`${base}/firebase-functions-compat.js`)
      ]);
      const firebase = global.firebase;
      const appName = 'wilan-agenda-cotizador';
      const app = firebase.apps.find((candidate) => candidate.name === appName)
        || firebase.initializeApp(config.firebase, appName);
      if (app.options.projectId !== config.firebase.projectId) throw new Error('FIREBASE_PROJECT_MISMATCH');
      const auth = app.auth();
      const db = app.firestore();
      const functions = app.functions(config.region);
      if (config.emulator && !global.__WILAN_COTIZADOR_AGENDA_EMULATORS__) {
        auth.useEmulator(`http://127.0.0.1:${config.emulators.auth}`, { disableWarnings: true });
        db.useEmulator('127.0.0.1', config.emulators.firestore);
        functions.useEmulator('127.0.0.1', config.emulators.functions);
        global.__WILAN_COTIZADOR_AGENDA_EMULATORS__ = true;
      }
      await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      const adapter = {
        authState: (callback) => auth.onAuthStateChanged(callback),
        signInGoogle: () => auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()),
        signInDemoAdvisor: () => {
          const profile = new URLSearchParams(global.location?.search || '').get('agendaProfile');
          const account = profile === 'applicant' ? config.demoApplicant : config.demoAdvisor;
          return auth.signInWithEmailAndPassword(account.email, account.password);
        },
        signOut: () => auth.signOut(),
        call: async (name, payload) => (await functions.httpsCallable(name)(payload)).data,
        subscribeDoc: (path, next, error) => db.doc(path).onSnapshot((snapshot) => next(snapshot.exists ? { id: snapshot.id, ...snapshot.data() } : null), error),
        subscribeCollection: (path, next, error) => db.collection(path).onSnapshot((snapshot) => next(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))), error)
      };
      global.WilanAgenda.firebase.adapter = adapter;
      return adapter;
    })().catch((error) => {
      state.promise = null;
      throw error;
    });
    return state.promise;
  };

  global.WilanAgenda = global.WilanAgenda || {};
  const testAdapter = global.WilanAgenda.config?.emulator ? global.__WILAN_AGENDA_TEST_ADAPTER__ : null;
  global.WilanAgenda.firebase = { initialize, adapter: testAdapter || null };
})(window);
