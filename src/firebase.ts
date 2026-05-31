import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

// Dynamically use the current host as the authDomain on the client-side,
// ensuring the Firebase Auth iframe is loaded from our own domain.
// This solves the PageSpeed Cache-Control warning and overcomes third-party cookie restrictions.
const config = { ...firebaseConfig };
if (typeof window !== 'undefined' && 
    !window.location.hostname.includes('localhost') && 
    !window.location.hostname.includes('127.0.0.1')) {
  config.authDomain = window.location.host;
}

const app = initializeApp(config);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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
