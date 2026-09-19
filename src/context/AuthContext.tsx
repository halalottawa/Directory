import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
import { auth, getAuthInstance, db, getMessagingPromise, isAuthInitialized } from '../firebase';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getPreciseLocation } from '../utils/geo';
import { isAppWrapper } from '../utils/platform';
import { safeLocalStorage } from '../utils/safeStorage';

export const checkIsAdminEmail = (email?: string | null): boolean => {
  if (!email) return false;
  const lower = email.toLowerCase().trim();
  return (
    lower === 'abesabil00@gmail.com' ||
    lower === 'abersabil00@gmail.com' ||
    lower === 'fibaliktn@gmail.com' ||
    lower === 'fibalik.tn@gmail.com'
  );
};

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isGuest: boolean;
  setGuest: (val: boolean) => void;
  loginWithGoogle: () => Promise<UserProfile | null>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  requestNotificationPermission: () => Promise<void>;
  initAuth: () => void;
}

const hasStoredAuthSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  if (safeLocalStorage.getItem('has_auth_session') === 'true') return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:authUser:')) {
        safeLocalStorage.setItem('has_auth_session', 'true');
        return true;
      }
    }
  } catch (e) {}
  return false;
};

const isAuthRoute = (pathname?: string): boolean => {
  if (typeof window === 'undefined') return false;
  const p = pathname || window.location.pathname;
  return p === '/login' || p === '/register';
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(() => {
    // Only start in loading state if returning user has an active session or is directly on an auth page.
    // Anonymous visitors browsing directory pages start with loading === false immediately.
    return isAuthRoute() || hasStoredAuthSession();
  });
  const [isGuest, setIsGuest] = useState(() => {
    return safeLocalStorage.getItem('isGuest') === 'true';
  });

  const isAuthInitializedRef = React.useRef(false);
  const unsubscribeAuthRef = React.useRef<(() => void) | null>(null);
  const safetyTimeoutRef = React.useRef<any>(null);

  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const notifPromptShown = React.useRef(false);

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
      // If already granted, skip the dialog and go straight to token registration
      if (Notification.permission === 'granted') {
        setNotificationPermission('granted');
      } else {
        // Permission is 'default' — browser dialog is about to appear
        const { toast } = await import('sonner');
        toast.info('A browser popup will appear — click Allow to enable notifications.', { duration: 4000 });

        const permission = await Notification.requestPermission();
        setNotificationPermission(permission);

        if (permission !== 'granted') {
          const { toast: t } = await import('sonner');
          t.error('Notification permission was not granted. You can change this in your browser site settings.');
          return;
        }
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

  const initAuth = React.useCallback(() => {
    if (isAuthInitializedRef.current) return;
    isAuthInitializedRef.current = true;

    // Safety timeout: ensure loading is NEVER stuck permanently
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 1500);

    const authInstance = getAuthInstance();

    // Handle redirect result for Google login
    const handleRedirect = async () => {
      try {
        const redirectRes = await getRedirectResult(authInstance);
        if (redirectRes?.user) {
          const fbUser = redirectRes.user;
          safeLocalStorage.setItem('has_auth_session', 'true');
          const isAdmin = checkIsAdminEmail(fbUser.email);
          const initialProfile: UserProfile = {
            uid: fbUser.uid,
            name: (fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member').slice(0, 90),
            email: fbUser.email || '',
            role: isAdmin ? 'admin' : 'user',
            createdAt: new Date().toISOString(),
            consentToUpdates: true,
            emailFrequency: 'weekly',
            pushNotifications: true,
            pushFrequency: 'daily',
            location: 'Ottawa, ON',
            photoURL: fbUser.photoURL || undefined,
          };
          setUser((prev) => prev || initialProfile);
          setLoading(false);
        }
      } catch (err: any) {
        console.error('Error handling redirect result:', err);
      }
    };
    handleRedirect();

    let unsubscribeDoc: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(authInstance, async (firebaseUser) => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      if (firebaseUser) {
        safeLocalStorage.setItem('has_auth_session', 'true');

        // Enforce email verification for email/password users
        const isPasswordProvider = firebaseUser.providerData.some(p => p.providerId === 'password');
        if (isPasswordProvider && !firebaseUser.emailVerified) {
          await signOut(authInstance);
          safeLocalStorage.removeItem('has_auth_session');
          setUser(null);
          setLoading(false);
          return;
        }

        const isAdmin = checkIsAdminEmail(firebaseUser.email);
        const fallbackProfile: UserProfile = {
          uid: firebaseUser.uid,
          name: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Community Member').slice(0, 90),
          email: firebaseUser.email || '',
          role: isAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          consentToUpdates: true,
          emailFrequency: 'weekly',
          pushNotifications: true,
          pushFrequency: 'daily',
          location: 'Ottawa, ON',
          photoURL: firebaseUser.photoURL || undefined,
        };

        // Immediately unblock the UI with fallback profile if not already set
        setUser((prev) => prev || fallbackProfile);
        setLoading(false);

        // Clean up previous doc subscription if user changed
        if (unsubscribeDoc) {
          unsubscribeDoc();
          unsubscribeDoc = null;
        }

        // Listen to user document changes
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        unsubscribeDoc = onSnapshot(userDocRef, async (snapshot) => {
          try {
            if (snapshot.exists()) {
              const userData = snapshot.data() as UserProfile;
              const effectiveRole = isAdmin ? 'admin' : (userData.role || 'user');
              const resolvedUser: UserProfile = { ...userData, role: effectiveRole };
              
              setUser(resolvedUser);

              if (isAdmin && userData.role !== 'admin') {
                setDoc(userDocRef, { role: 'admin' }, { merge: true }).catch((err) => {
                  console.warn('Could not sync admin role to Firestore:', err);
                });
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
              // Profile does not exist yet in Firestore
              const pendingToken = safeLocalStorage.getItem('pendingNativeFcmToken');

              const newProfile: UserProfile & { fcmToken?: string; fcmTokenUpdated?: string } = {
                uid: firebaseUser.uid,
                name: (firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Community Member').slice(0, 90),
                email: firebaseUser.email || '',
                role: isAdmin ? 'admin' : 'user',
                createdAt: new Date().toISOString(),
                consentToUpdates: true,
                emailFrequency: 'weekly',
                pushNotifications: true,
                pushFrequency: 'daily',
                location: 'Ottawa, ON',
              };

              if (pendingToken) {
                newProfile.fcmToken = pendingToken;
                newProfile.fcmTokenUpdated = new Date().toISOString();
                newProfile.pushNotifications = true;
              }

              if (firebaseUser.photoURL) {
                newProfile.photoURL = firebaseUser.photoURL;
              }

              // Immediately set user profile in state
              setUser(newProfile);

              // Persist to Firestore asynchronously
              setDoc(userDocRef, newProfile).then(async () => {
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
              }).catch((writeErr) => {
                console.error('Could not write initial profile to Firestore:', writeErr);
              });

              // Asynchronously resolve precise location without blocking login
              getPreciseLocation().then((loc) => {
                if (loc && loc !== 'Ottawa, ON') {
                  updateDoc(userDocRef, { location: loc }).catch(() => {});
                  setUser((prev) => (prev ? { ...prev, location: loc } : null));
                }
              }).catch(() => {});
            }
          } catch (snapshotErr) {
            console.error('Error handling user profile snapshot:', snapshotErr);
          } finally {
            setLoading(false);
          }
        }, (err) => {
          console.warn('User doc onSnapshot subscription error:', err);
          setLoading(false);
        });
      } else {
        if (unsubscribeDoc) unsubscribeDoc();
        safeLocalStorage.removeItem('has_auth_session');
        setUser(null);
        setLoading(false);
      }
    });

    unsubscribeAuthRef.current = () => {
      if (safetyTimeoutRef.current) {
        clearTimeout(safetyTimeoutRef.current);
      }
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
      isAuthInitializedRef.current = false;
    };
  }, []);

  // Initialize Auth on mount and keep persistent listener alive across route changes
  useEffect(() => {
    initAuth();

    return () => {
      if (unsubscribeAuthRef.current) {
        unsubscribeAuthRef.current();
        unsubscribeAuthRef.current = null;
      }
    };
  }, [initAuth]);

  // Strategy B: Native JS-to-WebView hybrid push notification bridge
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let messagingListenersAdded = false;

    // Register global callbacks for native Google Sign-In success
    (window as any).onNativeGoogleSignIn = async (idToken: string) => {
      console.log('Strategy B: Received native Google idToken:', idToken);
      if (!idToken) return;
      try {
        initAuth();
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

    const initMobilePush = async () => {
      if (!isAppWrapper()) return;
      try {
        const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

        await FirebaseMessaging.requestPermissions();

        const { token } = await FirebaseMessaging.getToken({
          vapidKey: 'BIZWmRCjJCF2INz-bqsVSezOPEw6450oLSBzmaAVPPZwkxeDRGAy-FuxtimmvpOibPbkGnVOm9dVWLcrrICkK8M'
        });

        if (token) {
          console.log('Strategy B: Mobile FCM token obtained via plugin:', token);
          if (typeof (window as any).onFCMTokenReceived === 'function') {
            (window as any).onFCMTokenReceived(token);
          } else {
            // onFCMTokenReceived not yet registered, store as pending
            safeLocalStorage.setItem('pendingNativeFcmToken', token);
            safeLocalStorage.setItem('nativeFcmToken', token);
          }
        }

        if (!messagingListenersAdded) {
          messagingListenersAdded = true;

          FirebaseMessaging.addListener('notificationReceived', async (event: any) => {
            const title = event.notification?.title || 'Halal Ottawa';
            const body = event.notification?.body || '';
            const { toast } = await import('sonner');
            toast(title, { description: body, duration: 6000 });
          });

          FirebaseMessaging.addListener('notificationActionPerformed', (event: any) => {
            const url = event.notification?.data?.url;
            if (url) window.location.href = url;
          });
        }

      } catch (err) {
        console.error('Strategy B: Mobile push plugin init failed:', err);
      }
    };

    initMobilePush();

    return () => {
      clearTimeout(initTimer);
      if (messagingListenersAdded) {
        import('@capacitor-firebase/messaging').then(({ FirebaseMessaging }) => {
          FirebaseMessaging.removeAllListeners();
        });
      }
    };
  }, [user?.uid]);

  const loginWithGoogle = async (): Promise<UserProfile | null> => {
    initAuth();
    const authInstance = getAuthInstance();
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const win = typeof window !== 'undefined' ? (window as any) : {};

    // 1. Check if running inside a native mobile app wrapper with active bridges
    const isCapacitorNative = !!(win.Capacitor && (
      win.Capacitor.isNative === true || 
      (typeof win.Capacitor.getPlatform === 'function' && win.Capacitor.getPlatform() !== 'web') ||
      (win.Capacitor.platform && win.Capacitor.platform !== 'web')
    ));

    if (isCapacitorNative) {
      try {
        const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
        const capResult = await FirebaseAuthentication.signInWithGoogle();
        if (capResult?.credential?.idToken) {
          const credential = GoogleAuthProvider.credential(capResult.credential.idToken);
          const credResult = await signInWithCredential(authInstance, credential);
          if (credResult?.user) {
            const fbUser = credResult.user;
            safeLocalStorage.setItem('has_auth_session', 'true');
            const isAdmin = checkIsAdminEmail(fbUser.email);
            const instantProfile: UserProfile = {
              uid: fbUser.uid,
              name: (fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member').slice(0, 90),
              email: fbUser.email || '',
              role: isAdmin ? 'admin' : 'user',
              createdAt: new Date().toISOString(),
              consentToUpdates: true,
              emailFrequency: 'weekly',
              pushNotifications: true,
              pushFrequency: 'daily',
              location: 'Ottawa, ON',
              photoURL: fbUser.photoURL || undefined,
            };
            setUser(instantProfile);
            setLoading(false);
            return instantProfile;
          }
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

    // 2. Custom native bridge triggers (React Native, iOS WebKit, Android JavascriptInterface)
    let dispatchedBridge = false;
    const payloadString = JSON.stringify({ event: 'GOOGLE_SIGN_IN', action: 'signin' });

    if (win.ReactNativeWebView?.postMessage) {
      try {
        win.ReactNativeWebView.postMessage(payloadString);
        dispatchedBridge = true;
      } catch (e) {}
    }

    if (win.webkit?.messageHandlers?.googleSignInHandler?.postMessage) {
      try {
        win.webkit.messageHandlers.googleSignInHandler.postMessage({ action: 'signin' });
        dispatchedBridge = true;
      } catch (e) {}
    }

    if (win.AndroidBridge?.googleSignIn) {
      try {
        win.AndroidBridge.googleSignIn();
        dispatchedBridge = true;
      } catch (e) {}
    }

    if (dispatchedBridge) {
      console.log('Dispatched GOOGLE_SIGN_IN request to custom native webview channel.');
      return null;
    }

    // 3. Web & WebView Firebase Authentication Flow
    const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

    try {
      const result = await signInWithPopup(authInstance, provider);
      if (result?.user) {
        const fbUser = result.user;
        safeLocalStorage.setItem('has_auth_session', 'true');
        const isAdmin = checkIsAdminEmail(fbUser.email);
        const instantProfile: UserProfile = {
          uid: fbUser.uid,
          name: (fbUser.displayName || fbUser.email?.split('@')[0] || 'Community Member').slice(0, 90),
          email: fbUser.email || '',
          role: isAdmin ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          consentToUpdates: true,
          emailFrequency: 'weekly',
          pushNotifications: true,
          pushFrequency: 'daily',
          location: 'Ottawa, ON',
          photoURL: fbUser.photoURL || undefined,
        };
        setUser(instantProfile);
        setLoading(false);
        return instantProfile;
      }
      return null;
    } catch (error: any) {
      console.warn('signInWithPopup returned error:', error?.code, error?.message);

      // If user intentionally closed or canceled the popup, do not redirect
      if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
        return null;
      }

      // Inside an iframe (e.g. AI Studio preview), redirecting to accounts.google.com will be blocked by X-Frame-Options: DENY
      if (isInIframe) {
        if (error.code === 'auth/popup-blocked') {
          throw new Error('Pop-up was blocked by your browser. Please allow pop-ups for this site, or open Halal Ottawa in a new browser tab to sign in with Google.');
        }
        if (error.code === 'auth/unauthorized-domain') {
          throw new Error('This preview domain is not authorized for Google Sign-In in Firebase Console. Please access via https://www.halalottawa.ca or add this domain in Firebase Console.');
        }
        throw error;
      }

      // On top-level pages, fallback to redirect if popup was blocked or failed internally
      if (error.code === 'auth/popup-blocked' || error.code === 'auth/internal-error') {
        await signInWithRedirect(authInstance, provider);
        return null;
      } else {
        throw error;
      }
    }
  };

  const logout = async () => {
    safeLocalStorage.removeItem('has_auth_session');
    const authInstance = getAuthInstance();
    await signOut(authInstance);
    setUser(null);
    setGuest(false);
  };

  const deleteAccount = async () => {
    const authInstance = getAuthInstance();
    if (authInstance.currentUser) {
      const uid = authInstance.currentUser.uid;
      try {
        await deleteDoc(doc(db, 'users', uid));
        await deleteUser(authInstance.currentUser);
        safeLocalStorage.removeItem('has_auth_session');
        setUser(null);
        setGuest(false);
      } catch (error) {
        console.error('Error deleting account:', error);
        throw error;
      }
    }
  };

  // Handle foreground push notifications + keep web FCM token fresh on every page load
  useEffect(() => {
    let unsubscribeMessage: (() => void) | null = null;

    const setupForegroundMessaging = async () => {
      if (isAppWrapper()) return;
      if (!('Notification' in window)) return;
      if (notificationPermission !== 'granted') return;
      if (!auth.currentUser) return;

      // Register SW explicitly and hold a reference so we can call showNotification later
      let swRegistration: ServiceWorkerRegistration | undefined;
      if ('serviceWorker' in navigator) {
        try {
          swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', { scope: '/' });
          await navigator.serviceWorker.ready;
        } catch (swErr) {
          console.warn('SW re-registration failed:', swErr);
        }
      }

      const messaging = await getMessagingPromise();
      if (!messaging) return;

      // Refresh the FCM token on every page load.
      // Firebase can silently rotate/invalidate tokens after browser updates,
      // data clears, or on its own schedule. Without this, Firestore holds a
      // dead token and every push send silently fails.
      try {
        const { getToken } = await import('firebase/messaging');
        const freshToken = await getToken(messaging, {
          vapidKey: 'BIZWmRCjJCF2INz-bqsVSezOPEw6450oLSBzmaAVPPZwkxeDRGAy-FuxtimmvpOibPbkGnVOm9dVWLcrrICkK8M',
          ...(swRegistration ? { serviceWorkerRegistration: swRegistration } : {}),
        });

        if (freshToken && auth.currentUser) {
          const uid = auth.currentUser.uid;
          const userSnap = await getDoc(doc(db, 'users', uid));
          const storedWebToken = userSnap.exists() ? userSnap.data()?.webFcmToken : null;

          if (freshToken !== storedWebToken) {
            console.log('Web FCM token changed — updating Firestore with fresh token.');
            const existingNativeToken = safeLocalStorage.getItem('nativeFcmToken');
            const updates: Record<string, any> = { webFcmToken: freshToken, pushNotifications: true };
            if (!existingNativeToken) updates.fcmToken = freshToken;
            await updateDoc(doc(db, 'users', uid), updates);

            await setDoc(doc(db, 'users', uid, 'devices', freshToken), {
              token: freshToken,
              platform: 'web',
              lastUpdated: new Date().toISOString(),
              appVersion: '1.0.0-web',
            });
          }
        }
      } catch (tokenRefreshErr) {
        console.warn('Web FCM token refresh failed:', tokenRefreshErr);
      }

      // If user has push enabled in Firestore but browser permission is still 'default'
      // (never asked), trigger the permission request automatically.
      // We do this here because it runs after the SW is ready, which is required.
      if (
        auth.currentUser &&
        Notification.permission === 'default' &&
        !notifPromptShown.current
      ) {
        notifPromptShown.current = true;
        // Small delay so the page is fully settled before the browser dialog fires
        setTimeout(() => requestNotificationPermission(), 1500);
      }

      // Set up foreground message handler
      try {
        const { onMessage } = await import('firebase/messaging');
        unsubscribeMessage = onMessage(messaging, (payload) => {
          const title = payload.notification?.title || payload.data?.title || 'Halal Ottawa';
          const body = payload.notification?.body || payload.data?.message || '';
          const url = payload.data?.url || '/';

          // Show in-app toast
          import('sonner').then(({ toast }) => {
            toast(title, {
              description: body,
              duration: 6000,
              action: url !== '/'
                ? { label: 'View', onClick: () => window.location.href = url }
                : undefined,
            });
          });

          // Also show a system notification popup even when the tab is focused.
          // When the tab is open, Firebase calls onMessage (not onBackgroundMessage),
          // so the SW never fires automatically — we must trigger showNotification manually.
          const showSystemNotif = (reg: ServiceWorkerRegistration) => {
            reg.showNotification(title, {
              body,
              icon: 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/favicon.webp',
              badge: 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/favicon.webp',
              data: { url },
            });
          };

          if (swRegistration) {
            showSystemNotif(swRegistration);
          } else if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(showSystemNotif);
          }
        });
      } catch (err) {
        console.warn('Failed to set up foreground messaging:', err);
      }
    };

    setupForegroundMessaging();
    return () => { if (unsubscribeMessage) unsubscribeMessage(); };
  }, [notificationPermission, user?.uid]);

  return (
    <AuthContext.Provider value={{ user, loading, isGuest, setGuest, loginWithGoogle, logout, deleteAccount, requestNotificationPermission, initAuth }}>
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
