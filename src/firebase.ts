import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';
export {
  type GeneralSettings,
  clearGeneralSettingsCache,
  getGeneralSettings,
  getInitialGeneralSettings,
} from './utils/settings';

try {
  setLogLevel('silent');
} catch {}

const config = { ...firebaseConfig };

export const app = initializeApp(config);

let _authInstance: Auth | null = null;

export function getAuthInstance(): Auth {
  if (!_authInstance) {
    _authInstance = getAuth(app);
    (globalThis as any).__FIREBASE_AUTH_INSTANCE__ = _authInstance;
  }
  return _authInstance;
}

export function isAuthInitialized(): boolean {
  return _authInstance !== null;
}

/**
 * Proxy for Firebase Auth that defers getAuth(app) until an auth operation is actually performed.
 * Reading auth.currentUser when auth has not yet been initialized returns null immediately
 * without triggering the Firebase Auth network calls (iframe.js, getProjectConfig).
 */
export const auth: Auth = new Proxy({} as Auth, {
  get(_target, prop) {
    if (prop === 'currentUser') {
      return _authInstance ? _authInstance.currentUser : null;
    }
    if (prop === 'app') {
      return app;
    }
    if (prop === 'isInitialized' || prop === '__isInitialized') {
      return _authInstance !== null;
    }
    if (prop === '_delegate') {
      return getAuthInstance();
    }
    const instance = getAuthInstance();
    const val = (instance as any)[prop];
    if (typeof val === 'function') {
      return val.bind(instance);
    }
    return val;
  },
  set(_target, prop, val) {
    const instance = getAuthInstance();
    (instance as any)[prop] = val;
    return true;
  }
});

export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Initialize Messaging conditionally (it might not be supported in some browsers/environments)
export const getMessagingPromise = async () => {
  try {
    const { getMessaging, isSupported } = await import('firebase/messaging');
    const supported = await isSupported();
    if (supported) {
      return getMessaging(app);
    }
    return null;
  } catch (error) {
    console.warn('Firebase Messaging initialization failed:', error);
    return null;
  }
};

export default app;
