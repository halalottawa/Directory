import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const storage = getStorage(app);

// Initialize Messaging conditionally (it might not be supported in some browsers/environments)
export const messagingPromise = isSupported().then(supported => {
  if (supported) {
    try {
      return getMessaging(app);
    } catch (error) {
      console.warn('Firebase Messaging initialization failed:', error);
      return null;
    }
  }
  return null;
}).catch((error) => {
  console.warn('Firebase Messaging is not supported:', error);
  return null;
});

export default app;
