import React, { createContext, useContext, useState, useEffect } from 'react';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';
import { 
  onAuthStateChanged, 
  User as FirebaseUser,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  deleteUser,
  signInWithCredential
} from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { auth, db, getMessagingPromise } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getPreciseLocation } from '../utils/geo';
import { isAppWrapper } from '../utils/platform';
import { safeLocalStorage } from '../utils/safeStorage';

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
    return safeLocalStorage.getItem('isGuest') === 'true';
  });

  const setGuest = (val: boolean) => {
    setIsGuest(val);
    if (val) {
      safeLocalStorage.setItem('isGuest', 'true');
    } else {
      safeLocalStorage.removeItem('isGuest');
    }
  };

  const requestNotificationPermission = async () => {
    if (!auth.currentUser) return;

    if (!('Notification' in window)) {
      const { toast } = await import('sonner');
      toast.error('Your browser does not support notifications.');
      return;
    }

    if (Notification.permission === 'denied') {
      const { toast } = await import('sonner');
      toast.error('Notifications are blocked. Go to your browser site settings and allow notifications for this site, then try again.', { duration: 8000 });
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        const { toast } = await import('sonner');
        toast.error('Notification permission was not granted.');
        return;
      }

      const messaging = await getMessagingPromise();
      if (!messaging) {
        const { toast } = await import('sonner');
        toast.error('Push notifications are not supported in this browser.');
        return;
      }

      try {
        const { getToken } = await import('firebase/messaging');

        // Register the service worker explicitly before calling getToken
        let swRegistration: ServiceWorkerRegistration | undefined;
        if ('serviceWorker' in navigator) {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
        }

        const currentToken = await getToken(messaging, {
          vapidKey: 'BIZWmRCjJCF2INz-bqsVSezOPEw6450oLSBzmaAVPPZwkxeDRGAy-FuxtimmvpOibPbkGnVOm9dVWLcrrICkK8M',
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
        });

        if (!currentToken) {
          const { toast } = await import('sonner');
          toast.error('Could not get a push token. Please try again.');
          return;
        }

        const uid = auth.currentUser.uid;
        const existingNativeToken = safeLocalStorage.getItem('nativeFcmToken');

        const updates: Record<string, any> = {
          webFcmToken: currentToken,
          pushNotifications: true,
        };
        if (!existingNativeToken) {
          updates.fcmToken = currentToken;
        }
        await updateDoc(doc(db, 'users', uid), updates);

        await setDoc(doc(db, 'users', uid, 'devices', currentToken), {
          token: currentToken,
          platform: 'web',
          lastUpdated: new Date().toISOString(),
          appVersion: '1.0.0-web',
        });

        const { toast } = await import('sonner');
        toast.success('Browser notifications enabled!');

      } catch (tokenError: any) {
        console.error('Failed to get FCM token:', tokenError);
        const { toast } = await import('sonner');
        toast.error('Push registration failed: ' + (tokenError?.message || 'Unknown error'));
      }

    } catch (error: any) {
      console.error('Error in requestNotificationPermission:', error);
      const { toast } = await import('sonner');
      toast.error('Notification setup failed: ' + (error?.message || 'Unknown error'));
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

            // Strategy B Token Sync: Check if there is a pending native token to assign
            const pendingToken = safeLocalStorage.getItem('pendingNativeFcmToken');
            if (pendingToken) {
              try {
                await updateDoc(userDocRef, {
                  fcmToken: pendingToken,
                  fcmTokenUpdated: new Date().toISOString(),
                  pushNotifications: true
                });
                // Write detailed device registration for multi-device push capabilities
                await setDoc(doc(db, 'users', firebaseUser.uid, 'devices', pendingToken), {
                  token: pendingToken,
                  platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
                  lastUpdated: new Date().toISOString(),
                  appVersion: '1.0.0'
                });
                safeLocalStorage.removeItem('pendingNativeFcmToken');
                console.log('Successfully bounded pending native FCM token to active user account.');
              } catch (err) {
                console.warn('Error binding pending FCM token:', err);
              }
            }
          } else {
            // Create profile if it doesn't exist
            let autoLocation = 'Ottawa, ON';
            try {
              autoLocation = await getPreciseLocation();
            } catch (locationErr) {
              console.warn('Could not auto-fetch location on profile bootstrap:', locationErr);
            }

            // Strategy B Check: Check if we have a pending native push token
            const pendingToken = safeLocalStorage.getItem('pendingNativeFcmToken');

            const newProfile: UserProfile & { fcmToken?: string; fcmTokenUpdated?: string } = {
              uid: firebaseUser.uid,
              name: firebaseUser.displayName || 'Anonymous',
              email: firebaseUser.email || '',
              role: (firebaseUser.email?.toLowerCase() === 'abesabil00@gmail.com' || firebaseUser.email?.toLowerCase() === 'abersabil00@gmail.com' || firebaseUser.email?.toLowerCase() === 'fibaliktn@gmail.com' || firebaseUser.email?.toLowerCase() === 'fibalik.tn@gmail.com') ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              consentToUpdates: true,
              emailFrequency: 'weekly',
              pushNotifications: true,
              pushFrequency: 'daily',
              location: autoLocation,
            };

            if (pendingToken) {
              newProfile.fcmToken = pendingToken;
              newProfile.fcmTokenUpdated = new Date().toISOString();
              newProfile.pushNotifications = true;
            }

            if (firebaseUser.photoURL) {
              newProfile.photoURL = firebaseUser.photoURL;
            }
            await setDoc(userDocRef, newProfile);

            if (pendingToken) {
              try {
                await setDoc(doc(db, 'users', firebaseUser.uid, 'devices', pendingToken), {
                  token: pendingToken,
                  platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
                  lastUpdated: new Date().toISOString(),
                  appVersion: '1.0.0'
                });
                safeLocalStorage.removeItem('pendingNativeFcmToken');
              } catch (deviceWriteErr) {
                console.warn('Could not write device listing during new profile creation:', deviceWriteErr);
              }
            }
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

  // Strategy B: Native JS-to-WebView hybrid push notification bridge
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register global callbacks for native Google Sign-In success
    (window as any).onNativeGoogleSignIn = async (idToken: string) => {
      console.log('Strategy B: Received native Google idToken:', idToken);
      if (!idToken) return;
      try {
        setLoading(true);
        const { signInWithCredential, GoogleAuthProvider } = await import('firebase/auth');
        const credential = GoogleAuthProvider.credential(idToken);
        await signInWithCredential(auth, credential);
        console.log('Successfully authenticated via native Google Sign-In.');
      } catch (err: any) {
        console.error('Error authenticating with native Google credential:', err);
        alert('Google Sign-In failed: ' + (err.message || err));
      } finally {
        setLoading(false);
      }
    };
    (window as any).onGoogleSignInSuccess = (window as any).onNativeGoogleSignIn;

    // 1. Register global callback for when native container obtains FCM token
    (window as any).onFCMTokenReceived = async (token: string) => {
      console.log('Strategy B: FCM Token received from Native Mobile Wrapper:', token);
      if (!token) return;

      // Save to localStorage as pending/resolved reference
      safeLocalStorage.setItem('nativeFcmToken', token);

      if (auth.currentUser) {
        try {
          const uid = auth.currentUser.uid;
          const userDocRef = doc(db, 'users', uid);

          // Update main user profile
          await updateDoc(userDocRef, {
            fcmToken: token,
            fcmTokenUpdated: new Date().toISOString(),
            pushNotifications: true
          });

          // Register in multi-device devices log
          await setDoc(doc(db, 'users', uid, 'devices', token), {
            token,
            platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
            lastUpdated: new Date().toISOString(),
            appVersion: '1.0.0-native'
          });

          console.log('Strategy B: Native push token registered successfully.');
        } catch (err) {
          console.error('Strategy B: Error saving native FCM Token to Firestore:', err);
        }
      } else {
        // Not logged in yet: Hold as pending until auth state resolves
        safeLocalStorage.setItem('pendingNativeFcmToken', token);
        console.log('Strategy B: Held native push token as pending guest registration.');
      }
    };

    // 2. Global handler for notification actions/clicks relayed by native wrapper
    (window as any).onNativeNotificationClicked = (payload: any) => {
      console.log('Strategy B: Notification clicked with payload:', payload);
      // Custom redirect or deep link can be processed here
      if (payload && payload.url) {
        const path = payload.url.replace(/^https?:\/\/[^\/]+/, '');
        window.location.hash = path; // Fallback route resolution or navigate
      }
    };

    // 3. Signal to the native wrapper that the web application is loaded and ready
    const triggerNativeRegister = () => {
      const win = window as any;
      const payloadString = JSON.stringify({ event: 'WEBVIEW_READY', strategy: 'B' });

      // Capacitor Native Push Trigger
      if (win.Capacitor?.Plugins?.PushNotifications) {
        try {
          win.Capacitor.Plugins.PushNotifications.requestPermissions().then((res: any) => {
            if (res.receive === 'granted') {
              win.Capacitor.Plugins.PushNotifications.register();
            }
          });
        } catch (e) {
          console.warn('Capacitor registration attempt failed:', e);
        }
      }

      // React Native WebView PostMessage Bridge
      if (win.ReactNativeWebView?.postMessage) {
        try {
          win.ReactNativeWebView.postMessage(payloadString);
        } catch (e) {}
      }

      // iOS WebKit Native Handlers
      if (win.webkit?.messageHandlers?.notificationHandler?.postMessage) {
        try {
          win.webkit.messageHandlers.notificationHandler.postMessage({ action: 'register', strategy: 'B' });
        } catch (e) {}
      }

      // Custom Android Bridge Injection
      if (win.AndroidBridge?.requestFCMToken) {
        try {
          win.AndroidBridge.requestFCMToken();
        } catch (e) {}
      }
    };

    // Wait slightly to make sure native injectors are present
    const initTimer = setTimeout(() => {
      triggerNativeRegister();
    }, 1500);

    return () => clearTimeout(initTimer);
  }, [user?.uid]);

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const isApp = isAppWrapper();

    if (isApp) {
      console.log('Detecting Native App environment. Dispatched GOOGLE_SIGN_IN signal to bridges.');
      const win = window as any;
      const payloadString = JSON.stringify({ event: 'GOOGLE_SIGN_IN', action: 'signin' });

      // 1. Capacitor Firebase Auth Plugin
      if (win.Capacitor) {
        try {
          const capResult = await FirebaseAuthentication.signInWithGoogle();
          if (capResult?.credential?.idToken) {
            const credential = GoogleAuthProvider.credential(capResult.credential.idToken);
            await signInWithCredential(auth, credential);
            console.log('Successfully completed authentication via native Capacitor Firebase Auth plugin');
            return;
          }
        } catch (capError: any) {
          console.error('Capacitor native Firebase Google sign-in effort returned error:', capError);
          const errMsg = capError.message || String(capError);
          if (capError.code === '10' || errMsg.includes('10') || errMsg.includes('Developer Error') || capError.statusCode === 10) {
            throw new Error('Google Sign-In Developer Error (Code 10). Make sure the signing certificate SHA-1 fingerprint (of the APK you installed) is added to your Firebase project settings.');
          }
          throw new Error('Native Google sign-in failed: ' + (capError.message || JSON.stringify(capError)));
        }
      }

      // 2. Custom React Native postMessage signal
      if (win.ReactNativeWebView?.postMessage) {
        try {
          win.ReactNativeWebView.postMessage(payloadString);
        } catch (e) {}
      }

      // 3. Custom iOS WebKit Handler signal
      if (win.webkit?.messageHandlers?.googleSignInHandler?.postMessage) {
        try {
          win.webkit.messageHandlers.googleSignInHandler.postMessage({ action: 'signin' });
        } catch (e) {}
      }

      // 4. Custom Android Bridge Interface trigger
      if (win.AndroidBridge?.googleSignIn) {
        try {
          win.AndroidBridge.googleSignIn();
        } catch (e) {}
      }

      console.log('Dispatched GOOGLE_SIGN_IN request to all available native webview channels.');
      return;
    }

    try {
      // Always use signInWithPopup to open a popup overlay inside the app Webview / app container itself.
      // This avoids redirecting the app shell away to an external system browser link.
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      // Fallback to redirect only for standard web clients if popup is blocked
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

  // Handle foreground push notifications (when browser tab is open)
  useEffect(() => {
    let unsubscribeMessage: (() => void) | null = null;

    const setupForegroundMessaging = async () => {
      if (isAppWrapper()) return; // Mobile handles its own foreground notifications
      const messaging = await getMessagingPromise();
      if (!messaging) return;
      
      try {
        const { onMessage } = await import('firebase/messaging');
        unsubscribeMessage = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || 'Halal Ottawa';
          const body = payload.notification?.body || payload.data?.message || '';
          const url = payload.data?.url || '/';
          
          // Show as in-app toast (since we already have sonner)
          import('sonner').then(({ toast }) => {
            toast(title, {
              description: body,
              duration: 6000,
              action: url !== '/'
                ? { label: 'View', onClick: () => window.location.href = url }
                : undefined,
            });
          });

          // Also try to show a system notification if SW is available
          if ('serviceWorker' in navigator && Notification.permission === 'granted') {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification(title, {
                body,
                icon: '/favicon.png',
                badge: '/favicon.png',
                data: { url },
              });
            });
          }
        });
      } catch (err) {
        console.warn('Failed to set up foreground messaging:', err);
      }
    };

    setupForegroundMessaging();
    return () => { if (unsubscribeMessage) unsubscribeMessage(); };
  }, []); // Run once on mount

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
