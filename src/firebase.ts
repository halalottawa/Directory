import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const config = { ...firebaseConfig };

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

export interface GeneralSettings {
  logoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
}

let cachedSettingsPromise: Promise<GeneralSettings | null> | null = null;

export async function getGeneralSettings(): Promise<GeneralSettings | null> {
  const CACHE_KEY = 'halal_ottawa_general_settings';
  const CACHE_TTL_KEY = 'halal_ottawa_general_settings_expiry';
  const now = Date.now();
  
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(CACHE_KEY);
    const expiry = localStorage.getItem(CACHE_TTL_KEY);
    if (cached && expiry && now < parseInt(expiry, 10)) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        // Fallback
      }
    }
  }

  if (!cachedSettingsPromise) {
    cachedSettingsPromise = (async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'general'));
        if (docSnap.exists()) {
          const data = docSnap.data() as GeneralSettings;
          if (typeof window !== 'undefined') {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(CACHE_TTL_KEY, (now + 3600000).toString()); // 1 hour TTL
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
