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
    sessionStorage.setItem('openInAppWrapper', 'true');
    // Ensure we clear old legacy localStorage
    localStorage.removeItem('openInAppWrapper');
    return true;
  }

  // 2. Check for native global bridge objects commonly injected by frameworks or custom webviews
  const win = window as any;
  const hasNativeBridge = 
    !!win.cordova || 
    !!win.Capacitor || 
    !!win.ReactNativeWebView ||
    !!win.AndroidBridge || 
    !!(win.webkit && win.webkit.messageHandlers && (
      win.webkit.messageHandlers.notificationHandler || 
      win.webkit.messageHandlers.googleSignInHandler
    ));

  if (hasNativeBridge) {
    sessionStorage.setItem('openInAppWrapper', 'true');
    // Ensure we clear old legacy localStorage
    localStorage.removeItem('openInAppWrapper');
    return true;
  }

  // 3. Fallback: Parse User Agent for common native WebView patterns
  const ua = navigator.userAgent || navigator.vendor || win.opera || '';
  
  // Custom brand user agent
  if (/halalottawa/i.test(ua)) {
    sessionStorage.setItem('openInAppWrapper', 'true');
    localStorage.removeItem('openInAppWrapper');
    return true;
  }

  // Check if we previously set a flag in sessionStorage, but ONLY if we are actually on a mobile device UA!
  const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
  if (isMobile && sessionStorage.getItem('openInAppWrapper') === 'true') {
    return true;
  }

  // Android WebView typically has "Version/4.0" or "wv"
  const isAndroidWebView = isMobile && /Android/i.test(ua) && (/Version\/[0-9.]+/i.test(ua) || /wv/i.test(ua));

  // iOS WebView typically contains "iPhone" or "iPad" but lacks "Safari"
  const isAppleWebView = isMobile && !/Safari/i.test(ua);

  if (isAndroidWebView || isAppleWebView) {
    sessionStorage.setItem('openInAppWrapper', 'true');
    localStorage.removeItem('openInAppWrapper');
    return true;
  }

  // Clear stale flags if not inside app context
  sessionStorage.removeItem('openInAppWrapper');
  localStorage.removeItem('openInAppWrapper');
  return false;
}
