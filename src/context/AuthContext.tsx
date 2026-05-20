import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  deleteUser
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, getMessagingPromise } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  setGuest: (val: boolean) => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(() => {
    return localStorage.getItem('isGuest') === 'true';
  });

  const setGuest = (val: boolean) => {
    setIsGuest(val);
    if (val) {
      localStorage.setItem('isGuest', 'true');
    } else {
      localStorage.removeItem('isGuest');
    }
  };

  const requestNotificationPermission = async () => {
    if (!auth.currentUser) return;
    try {
      if (!('Notification' in window)) {
        console.warn('This browser does not support desktop notification');
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        const messaging = await getMessagingPromise();
        if (messaging) {
          try {
            const { getToken } = await import('firebase/messaging');
            const currentToken = await getToken(messaging, {
              vapidKey: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeZ1vHIUgl1wIi0m-m2c-x39-t0gQyT9-rX8-p9-s9-v9-w9-y9-z9' // Note: Replace with real VAPID key if needed
            });
            if (currentToken) {
              await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                fcmToken: currentToken
              });
            }
          } catch (tokenError) {
            console.warn('Failed to get FCM token:', tokenError);
          }
        }
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
    }
  };

  useEffect(() => {
    let unsubscribeDoc: (() => void) | null = null;

    // Handle redirect result for Google login
    const handleRedirect = async () => {
      try {
        await getRedirectResult(auth);
      } catch (err: any) {
        console.error('Error handling redirect result:', err);
      }
    };
    handleRedirect();

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Enforce email verification for email/password users
        const isPasswordProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
        if (isPasswordProvider && !firebaseUser.emailVerified) {
          await signOut(auth);
          setUser(null);
          setLoading(false);
          return;
        }

        // Listen to user document changes
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeDoc = onSnapshot(userDocRef, async (snapshot) => {
          if (snapshot.exists()) {
            const userData = snapshot.data() as UserProfile;
            const isAdminEmail = firebaseUser.email?.toLowerCase() === 'abesabil00@gmail.com' || 
                                 firebaseUser.email?.toLowerCase() === 'abersabil00@gmail.com' || 
                                 firebaseUser.email?.toLowerCase() === 'fibaliktn@gmail.com' ||
                                 firebaseUser.email?.toLowerCase() === 'fibalik.tn@gmail.com';
            
            if (isAdminEmail && userData.role !== 'admin') {
              await setDoc(userDocRef, { ...userData, role: 'admin' }, { merge: true });
            } else {
              setUser(userData);
            }
          } else {
            // Create profile if it doesn't exist
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              role: (firebaseUser.email?.toLowerCase() === 'abesabil00@gmail.com' || firebaseUser.email?.toLowerCase() === 'abersabil00@gmail.com' || firebaseUser.email?.toLowerCase() === 'fibaliktn@gmail.com' || firebaseUser.email?.toLowerCase() === 'fibalik.tn@gmail.com') ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              consentToUpdates: true,
              emailFrequency: 'weekly',
              pushNotifications: true,
              pushFrequency: 'daily',
            };
            if (firebaseUser.photoURL) {
              newProfile.photoURL = firebaseUser.photoURL;
            }
            await setDoc(userDocRef, newProfile);
            // onSnapshot will pick this up
          }
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, `users/${firebaseUser.uid}`);
          setLoading(false);
        });
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, []);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Fallback to redirect if popup is blocked or in a WebView environment where popups fail
      if (error.code === 'auth/popup-blocked' || 
          error.code === 'auth/cancelled-popup-request' || 
          error.code === 'auth/popup-closed-by-user' ||
          error.code === 'auth/internal-error') {
        await signInWithRedirect(auth, provider);
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
    setGuest(false);
  };

  const deleteAccount = async () => {
    if (auth.currentUser) {
      const uid = auth.currentUser.uid;
      try {
        await deleteDoc(doc(db, 'users', uid));
        await deleteUser(auth.currentUser);
        setUser(null);
        setGuest(false);
      } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, setGuest, loginWithGoogle, logout, deleteAccount, requestNotificationPermission }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
