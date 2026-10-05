import React, { createContext, useContext, useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { UserProfile } from '../types';
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
    if (typeof document !== 'undefined' && document.cookie.includes('has_auth_session=1')) {
      return true;
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:authUser:')) {
        safeLocalStorage.setItem('has_auth_session', 'true');
        return true;
      }
    }
  } catch {}
  return false;
};

const isProtectedOrAuthRoute = (pathname?: string): boolean => {
  if (typeof window === 'undefined') return false;
  const path = pathname || window.location.pathname;
  return (
    path === '/login' ||
    path === '/register' ||
    path.startsWith('/admin') ||
    path.startsWith('/saved') ||
    path.startsWith('/profile') ||
    path.startsWith('/settings') ||
    path.includes('/add') ||
    path.includes('/edit')
  );
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(() => {
    return isProtectedOrAuthRoute() || hasStoredAuthSession();
  });
  const [isGuest, setIsGuest] = useState(() => {
    return safeLocalStorage.getItem('isGuest') === 'true';
  });

  const isAuthInitializedRef = React.useRef(false);
  const unsubscribeAuthRef = React.useRef<(() => void) | null>(null);
  const safetyTimeoutRef = React.useRef<any>(null);
  const notifPromptShown = React.useRef(false);

  const [notificationPermission, setNotificationPermission] = useState<string>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );

  const setGuest = (val: boolean) => {
    setIsGuest(val);
    if (val) {
      safeLocalStorage.setItem('isGuest', 'true');
    } else {
      safeLocalStorage.removeItem('isGuest');
    }
  };

  const requestNotificationPermission = async () => {
    const { runRequestNotificationPermission } = await import('./authRuntime');
    await runRequestNotificationPermission(setNotificationPermission);
  };

  const initAuth = React.useCallback(() => {
    if (isAuthInitializedRef.current) return;
    isAuthInitializedRef.current = true;

    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
    }
    safetyTimeoutRef.current = setTimeout(() => {
      setLoading(false);
    }, 1500);

    import('./authRuntime')
      .then(({ startFirebaseAuthSubscription }) => {
        const unsub = startFirebaseAuthSubscription(setUser, setLoading, () => {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
          }
        });
        unsubscribeAuthRef.current = () => {
          if (safetyTimeoutRef.current) {
            clearTimeout(safetyTimeoutRef.current);
          }
          unsub();
          isAuthInitializedRef.current = false;
        };
      })
      .catch((err) => {
        console.error('Failed to dynamically initialize Firebase Auth:', err);
        setLoading(false);
      });
  }, []);

  // Load firebase/auth ONLY when the user has a stored session flag/cookie or opens a protected/auth route.
  useEffect(() => {
    if (hasStoredAuthSession() || isProtectedOrAuthRoute(location.pathname)) {
      initAuth();
    }
  }, [initAuth, location.pathname]);

  useEffect(() => {
    return () => {
      if (unsubscribeAuthRef.current) {
        unsubscribeAuthRef.current();
        unsubscribeAuthRef.current = null;
      }
    };
  }, []);

  const loginWithGoogle = async (): Promise<UserProfile | null> => {
    initAuth();
    const { runLoginWithGoogle } = await import('./authRuntime');
    return runLoginWithGoogle(setUser, setLoading);
  };

  const logout = async () => {
    const { runLogout } = await import('./authRuntime');
    await runLogout(setUser, setGuest);
  };

  const deleteAccount = async () => {
    const { runDeleteAccount } = await import('./authRuntime');
    await runDeleteAccount(setUser, setGuest);
  };

  useEffect(() => {
    if (!user?.uid) return;
    let unsubscribeMessage: (() => void) | null = null;
    import('./authRuntime')
      .then(({ setupSignedInForegroundMessaging }) =>
        setupSignedInForegroundMessaging(notificationPermission, notifPromptShown, requestNotificationPermission)
      )
      .then((unsub) => {
        unsubscribeMessage = unsub;
      })
      .catch(() => {});
    return () => {
      if (unsubscribeMessage) unsubscribeMessage();
    };
  }, [notificationPermission, user?.uid]);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isGuest,
        setGuest,
        loginWithGoogle,
        logout,
        deleteAccount,
        requestNotificationPermission,
        initAuth,
      }}
    >
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
