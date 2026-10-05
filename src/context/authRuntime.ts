import type { User as FirebaseUser } from 'firebase/auth';
import { UserProfile } from '../types';
import { getPreciseLocation } from '../utils/geo';
import { isAppWrapper } from '../utils/platform';
import { safeLocalStorage } from '../utils/safeStorage';
import { auth, db, getAuthInstance, getMessagingPromise } from '../firebase';
import {
  onAuthStateChanged,
  signOut,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signInWithCredential,
  deleteUser,
} from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';

export const setAuthSessionFlags = (active: boolean) => {
  if (typeof window === 'undefined') return;
  if (active) {
    safeLocalStorage.setItem('has_auth_session', 'true');
    try {
      document.cookie = 'has_auth_session=1; path=/; max-age=2592000; SameSite=Lax';
    } catch {}
  } else {
    safeLocalStorage.removeItem('has_auth_session');
    try {
      document.cookie = 'has_auth_session=; path=/; max-age=0; SameSite=Lax';
    } catch {}
  }
};

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

export async function runRequestNotificationPermission(
  setNotificationPermission: (val: string) => void
): Promise<void> {
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
    if (Notification.permission === 'granted') {
      setNotificationPermission('granted');
    } else {
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
}

export function startFirebaseAuthSubscription(
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>,
  clearSafetyTimeout: () => void
): () => void {
  const authInstance = getAuthInstance();

  const handleRedirect = async () => {
    try {
      const redirectRes = await getRedirectResult(authInstance);
      if (redirectRes?.user) {
        const fbUser = redirectRes.user;
        setAuthSessionFlags(true);
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

  const unsubscribeAuth = onAuthStateChanged(authInstance, async (firebaseUser: FirebaseUser | null) => {
    clearSafetyTimeout();
    if (firebaseUser) {
      setAuthSessionFlags(true);

      const isPasswordProvider = firebaseUser.providerData.some((p) => p.providerId === 'password');
      if (isPasswordProvider && !firebaseUser.emailVerified) {
        await signOut(authInstance);
        setAuthSessionFlags(false);
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

      setUser((prev) => prev || fallbackProfile);
      setLoading(false);

      if (unsubscribeDoc) {
        unsubscribeDoc();
        unsubscribeDoc = null;
      }

      const userDocRef = doc(db, 'users', firebaseUser.uid);

      unsubscribeDoc = onSnapshot(
        userDocRef,
        async (snapshot) => {
          try {
            if (snapshot.exists()) {
              const userData = snapshot.data() as UserProfile;
              const effectiveRole = isAdmin ? 'admin' : userData.role || 'user';
              const resolvedUser: UserProfile = { ...userData, role: effectiveRole };

              setUser(resolvedUser);

              if (isAdmin && userData.role !== 'admin') {
                setDoc(userDocRef, { role: 'admin' }, { merge: true }).catch((err) => {
                  console.warn('Could not sync admin role to Firestore:', err);
                });
              }

              const pendingToken = safeLocalStorage.getItem('pendingNativeFcmToken');
              if (pendingToken) {
                try {
                  await updateDoc(userDocRef, {
                    fcmToken: pendingToken,
                    fcmTokenUpdated: new Date().toISOString(),
                    pushNotifications: true,
                  });
                  await setDoc(doc(db, 'users', firebaseUser.uid, 'devices', pendingToken), {
                    token: pendingToken,
                    platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
                    lastUpdated: new Date().toISOString(),
                    appVersion: '1.0.0',
                  });
                  safeLocalStorage.removeItem('pendingNativeFcmToken');
                } catch (err) {
                  console.warn('Error binding pending FCM token:', err);
                }
              }
            } else {
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

              setUser(newProfile);

              setDoc(userDocRef, newProfile)
                .then(async () => {
                  if (pendingToken) {
                    try {
                      await setDoc(doc(db, 'users', firebaseUser.uid, 'devices', pendingToken), {
                        token: pendingToken,
                        platform: /android/i.test(navigator.userAgent) ? 'android' : 'ios',
                        lastUpdated: new Date().toISOString(),
                        appVersion: '1.0.0',
                      });
                      safeLocalStorage.removeItem('pendingNativeFcmToken');
                    } catch (deviceWriteErr) {
                      console.warn('Could not write device listing during new profile creation:', deviceWriteErr);
                    }
                  }
                })
                .catch((writeErr) => {
                  console.error('Could not write initial profile to Firestore:', writeErr);
                });

              getPreciseLocation()
                .then((loc) => {
                  if (loc && loc !== 'Ottawa, ON') {
                    updateDoc(userDocRef, { location: loc }).catch(() => {});
                    setUser((prev) => (prev ? { ...prev, location: loc } : null));
                  }
                })
                .catch(() => {});
            }
          } catch (snapshotErr) {
            console.error('Error handling user profile snapshot:', snapshotErr);
          } finally {
            setLoading(false);
          }
        },
        (err) => {
          console.warn('User doc onSnapshot subscription error:', err);
          setLoading(false);
        }
      );
    } else {
      if (unsubscribeDoc) unsubscribeDoc();
      setAuthSessionFlags(false);
      setUser(null);
      setLoading(false);
    }
  });

  return () => {
    unsubscribeAuth();
    if (unsubscribeDoc) unsubscribeDoc();
  };
}

export async function runLoginWithGoogle(
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>,
  setLoading: React.Dispatch<React.SetStateAction<boolean>>
): Promise<UserProfile | null> {
  const authInstance = getAuthInstance();
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const win = typeof window !== 'undefined' ? (window as any) : {};

  const isCapacitorNative = !!(
    win.Capacitor &&
    (win.Capacitor.isNative === true ||
      (typeof win.Capacitor.getPlatform === 'function' && win.Capacitor.getPlatform() !== 'web') ||
      (win.Capacitor.platform && win.Capacitor.platform !== 'web'))
  );

  if (isCapacitorNative) {
    try {
      const { FirebaseAuthentication } = await import('@capacitor-firebase/authentication');
      const capResult = await FirebaseAuthentication.signInWithGoogle();
      if (capResult?.credential?.idToken) {
        const credential = GoogleAuthProvider.credential(capResult.credential.idToken);
        const credResult = await signInWithCredential(authInstance, credential);
        if (credResult?.user) {
          const fbUser = credResult.user;
          setAuthSessionFlags(true);
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

  let dispatchedBridge = false;
  const payloadString = JSON.stringify({ event: 'GOOGLE_SIGN_IN', action: 'signin' });

  if (win.ReactNativeWebView?.postMessage) {
    try {
      win.ReactNativeWebView.postMessage(payloadString);
      dispatchedBridge = true;
    } catch {}
  }

  if (win.webkit?.messageHandlers?.googleSignInHandler?.postMessage) {
    try {
      win.webkit.messageHandlers.googleSignInHandler.postMessage({ action: 'signin' });
      dispatchedBridge = true;
    } catch {}
  }

  if (win.AndroidBridge?.googleSignIn) {
    try {
      win.AndroidBridge.googleSignIn();
      dispatchedBridge = true;
    } catch {}
  }

  if (dispatchedBridge) {
    return null;
  }

  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  try {
    const result = await signInWithPopup(authInstance, provider);
    if (result?.user) {
      const fbUser = result.user;
      setAuthSessionFlags(true);
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

    if (error.code === 'auth/popup-closed-by-user' || error.code === 'auth/cancelled-popup-request') {
      return null;
    }

    if (isInIframe) {
      if (error.code === 'auth/popup-blocked') {
        throw new Error('Pop-up was blocked by your browser. Please allow pop-ups for this site, or open Halal Ottawa in a new browser tab to sign in with Google.');
      }
      if (error.code === 'auth/unauthorized-domain') {
        throw new Error('This preview domain is not authorized for Google Sign-In in Firebase Console. Please access via https://www.halalottawa.ca or add this domain in Firebase Console.');
      }
      throw error;
    }

    if (error.code === 'auth/popup-blocked' || error.code === 'auth/internal-error') {
      await signInWithRedirect(authInstance, provider);
      return null;
    } else {
      throw error;
    }
  }
}

export async function runLogout(
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>,
  setGuest: (val: boolean) => void
): Promise<void> {
  setAuthSessionFlags(false);
  const authInstance = getAuthInstance();
  await signOut(authInstance);
  setUser(null);
  setGuest(false);
}

export async function runDeleteAccount(
  setUser: React.Dispatch<React.SetStateAction<UserProfile | null>>,
  setGuest: (val: boolean) => void
): Promise<void> {
  const authInstance = getAuthInstance();
  if (authInstance.currentUser) {
    const uid = authInstance.currentUser.uid;
    await deleteDoc(doc(db, 'users', uid));
    await deleteUser(authInstance.currentUser);
    setAuthSessionFlags(false);
    setUser(null);
    setGuest(false);
  }
}

export async function setupSignedInForegroundMessaging(
  notificationPermission: string,
  notifPromptShownRef: React.MutableRefObject<boolean>,
  requestNotificationPermission: () => Promise<void>
): Promise<(() => void) | null> {
  if (isAppWrapper()) return null;
  if (!('Notification' in window)) return null;
  if (notificationPermission !== 'granted') return null;
  if (!auth.currentUser) return null;

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
  if (!messaging) return null;

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

  if (auth.currentUser && Notification.permission === 'default' && !notifPromptShownRef.current) {
    notifPromptShownRef.current = true;
    setTimeout(() => requestNotificationPermission(), 1500);
  }

  try {
    const { onMessage } = await import('firebase/messaging');
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title || payload.data?.title || 'Halal Ottawa';
      const body = payload.notification?.body || payload.data?.message || '';
      const url = payload.data?.url || '/';

      import('sonner').then(({ toast }) => {
        toast(title, {
          description: body,
          duration: 6000,
          action: url !== '/' ? { label: 'View', onClick: () => (window.location.href = url) } : undefined,
        });
      });

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
    return null;
  }
}
