import { initializeApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { safeLocalStorage } from './utils/safeStorage';
import firebaseConfig from '../firebase-applet-config.json';

const config = { ...firebaseConfig };

export const app = initializeApp(config);

let _authInstance: Auth | null = null;

export function getAuthInstance(): Auth {
  if (!_authInstance) {
    _authInstance = getAuth(app);
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

export interface GeneralSettings {
  logoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
  heroImageUrl?: string;
}

let cachedSettingsPromise: Promise<GeneralSettings | null> | null = null;

export function clearGeneralSettingsCache() {
  if (typeof window !== 'undefined') {
    safeLocalStorage.removeItem('halal_ottawa_general_settings');
    safeLocalStorage.removeItem('halal_ottawa_general_settings_expiry');
  }
  cachedSettingsPromise = null;
}

export async function getGeneralSettings(forceFresh = false): Promise<GeneralSettings | null> {
  const CACHE_KEY = 'halal_ottawa_general_settings';
  const CACHE_TTL_KEY = 'halal_ottawa_general_settings_expiry';
  const now = Date.now();
  
  if (typeof window !== 'undefined' && !forceFresh) {
    const cached = safeLocalStorage.getItem(CACHE_KEY);
    const expiry = safeLocalStorage.getItem(CACHE_TTL_KEY);
    if (cached && expiry && now < parseInt(expiry, 10)) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback
      }
    }
  }

  if (!cachedSettingsPromise || forceFresh) {
    cachedSettingsPromise = (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          const data = docSnap.data() as GeneralSettings;
          if (typeof window !== 'undefined') {
            safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(data));
            safeLocalStorage.setItem(CACHE_TTL_KEY, (now + 3600000).toString()); // 1 hour TTL
          }
          return data;
        }
        return null;
      } catch (err) {
        console.error('Error fetching general settings:', err);
        cachedSettingsPromise = null;
        return null;
      }
    })();
  }

  return cachedSettingsPromise;
}


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
