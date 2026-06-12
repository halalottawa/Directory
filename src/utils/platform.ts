import { safeLocalStorage, safeSessionStorage } from './safeStorage';

/**
 * Utility to detect if the application is running inside a native mobile app wrapper
 * (such as a Capacitor, Cordova, or standard native WebView for Android / iOS).
 */
export function isAppWrapper(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. Check URL query parameters (e.g., ?app=true, ?source=app, ?platform=app)
  const searchParams = new URLSearchParams(window.location.search);
  const hasAppParam = 
    searchParams.get('app') === 'true' || 
    searchParams.get('source') === 'app' || 
    searchParams.get('platform') === 'app' || 
    searchParams.get('platform') === 'android' || 
    searchParams.get('platform') === 'ios';

  if (hasAppParam) {
    safeSessionStorage.setItem('openInAppWrapper', 'true');
    // Ensure we clear old legacy localStorage
    safeLocalStorage.removeItem('openInAppWrapper');
    return true;
  }

  // 2. Check for native global bridge objects commonly injected by frameworks or custom webviews
  const win = window as any;
  const isCapacitorNative = !!(win.Capacitor && (
    win.Capacitor.isNative === true || 
    (typeof win.Capacitor.getPlatform === 'function' && win.Capacitor.getPlatform() !== 'web') ||
    (win.Capacitor.platform && win.Capacitor.platform !== 'web')
  ));

  const hasNativeBridge = 
    !!win.cordova || 
    isCapacitorNative || 
    !!win.ReactNativeWebView ||
    !!win.AndroidBridge || 
    !!(win.webkit && win.webkit.messageHandlers && (
      win.webkit.messageHandlers.notificationHandler || 
      win.webkit.messageHandlers.googleSignInHandler
    ));

  if (hasNativeBridge) {
    safeSessionStorage.setItem('openInAppWrapper', 'true');
    // Ensure we clear old legacy localStorage
    safeLocalStorage.removeItem('openInAppWrapper');
    return true;
  }

  // 3. Fallback: Parse User Agent for common native WebView patterns
  const ua = navigator.userAgent || navigator.vendor || win.opera || '';
  
  // Custom brand user agent
  if (/halalottawa/i.test(ua)) {
    safeSessionStorage.setItem('openInAppWrapper', 'true');
    safeLocalStorage.removeItem('openInAppWrapper');
    return true;
  }

  // Check if we previously set a flag in sessionStorage, but ONLY if we are actually on a mobile device UA!
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (isMobile && safeSessionStorage.getItem('openInAppWrapper') === 'true') {
    return true;
  }

  // Android WebView typically has "Version/4.0" or "wv"
  const isAndroidWebView = isMobile && /Android/i.test(ua) && (/Version\/[0-9.]+/i.test(ua) || /wv/i.test(ua));

  // iOS WebView typically contains "iPhone" or "iPad" but lacks "Safari"
  const isAppleWebView = isMobile && !/Safari/i.test(ua);

  if (isAndroidWebView || isAppleWebView) {
    safeSessionStorage.setItem('openInAppWrapper', 'true');
    safeLocalStorage.removeItem('openInAppWrapper');
    return true;
  }

  // Clear stale flags if not inside app context
  safeSessionStorage.removeItem('openInAppWrapper');
  safeLocalStorage.removeItem('openInAppWrapper');
  return false;
}

/**
 * Resolves the absolute backend API URL based on the environment.
 * If running inside a native mobile webview / app wrapper (where location.origin is localhost or capacitor://),
 * or on standard static web deployments (like www.halalottawa.ca or vercel.app) that don't run our custom Node Express
 * backend locally, it returns the absolute Cloud Run backend container URL. Otherwise, it returns an empty string.
 */
export function getApiBaseUrl(): string {
  if (typeof window === 'undefined') return '';

  const origin = window.location.origin;
  const hostname = window.location.hostname;

  // Static website hosting (e.g., Vercel or main domain) does not run our Node/Express server.
  // We point directly to our Cloud Run backend to avoid Host Header routing and redirection issues,
  // while utilizing our server's dynamic CORS policy for secure requests.
  if (
    hostname === "www.halalottawa.ca" || 
    hostname === "halalottawa.ca" || 
    hostname.endsWith(".vercel.app")
  ) {
    return 'https://ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app';
  }

  const isLocalWebview = 
    origin.startsWith('capacitor://') || 
    origin === 'http://localhost' || 
    origin.includes('localhost:80') || 
    origin.includes('localhost:5173') ||
    origin.includes('127.0.0.1') ||
    isAppWrapper();

  if (isLocalWebview) {
    // Attempt to read the saved last-seen non-local origin first
    const stored = safeLocalStorage.getItem('api_base_url');
    if (stored && stored.startsWith('http') && !stored.includes('localhost') && !stored.includes('127.0.0.1')) {
      const storedUrl = stored.replace(/\/$/, "");
      
      // If the saved origin points to our static frontend (Vercel), use the Cloud Run container instead.
      if (storedUrl.includes("halalottawa.ca") || storedUrl.includes(".vercel.app")) {
        return 'https://ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app';
      }
      return storedUrl;
    }

    // Default fallbacks: Use the active premium/development URL or production
    const isDev = (import.meta as any).env?.DEV;
    return isDev 
      ? 'https://ais-dev-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app' 
      : 'https://ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app';
  }

  // Live web application on Cloud Run directly can use relative path
  return '';
}

/**
 * Returns the fully qualified API URL for a given endpoint path.
 */
export function getApiUrl(path: string): string {
  // If the path is already an absolute URL, return it as-is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }

  const baseUrl = getApiBaseUrl();
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${baseUrl}${cleanPath}`;
}

