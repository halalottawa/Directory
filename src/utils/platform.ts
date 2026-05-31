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
    localStorage.setItem('openInAppWrapper', 'true');
    return true;
  }

  // 2. Check if we previously set a persistent flag in localStorage
  if (localStorage.getItem('openInAppWrapper') === 'true') {
    return true;
  }

  // 3. Check for native global bridge objects commonly injected by frameworks or custom webviews
  const win = window as any;
  const hasNativeBridge = 
    !!win.cordova || 
    !!win.Capacitor || 
    !!win.ReactNativeWebView ||
    !!win.AndroidBridge || 
    !!(win.webkit && win.webkit.messageHandlers);

  if (hasNativeBridge) {
    localStorage.setItem('openInAppWrapper', 'true');
    return true;
  }

  // 4. Fallback: Parse User Agent for common native WebView patterns
  const ua = navigator.userAgent || navigator.vendor || win.opera || '';
  
  // Custom brand user agent
  if (/halalottawa/i.test(ua)) {
    localStorage.setItem('openInAppWrapper', 'true');
    return true;
  }

  // Android WebView typically has "Version/4.0" or "wv"
  const isAndroid = /Android/i.test(ua);
  const isAndroidWebView = isAndroid && (/Version\/[0-9.]+/i.test(ua) || /wv/i.test(ua));

  // iOS WebView typically contains "iPhone" or "iPad" but lacks "Safari"
  const isApple = /iPhone|iPad|iPod/i.test(ua);
  const isAppleWebView = isApple && !/Safari/i.test(ua);

  if (isAndroidWebView || isAppleWebView) {
    localStorage.setItem('openInAppWrapper', 'true');
    return true;
  }

  return false;
}
