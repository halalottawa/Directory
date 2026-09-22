import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && window.location.hostname === 'halalottawa.ca') {
  window.location.replace(`https://www.halalottawa.ca${window.location.pathname}${window.location.search}${window.location.hash}`);
}

// Proactively set session cookies on client to prevent proxy redirects in iframes
if (typeof document !== 'undefined') {
  try {
    const isHttps = window.location.protocol === 'https:';
    const maxAge = '; max-age=2592000';
    if (!document.cookie.includes('__session=')) {
      if (isHttps) {
        document.cookie = '__session=true; path=/; SameSite=None; Secure; Partitioned' + maxAge;
        document.cookie = '__session=true; path=/; SameSite=None; Secure' + maxAge;
      } else {
        document.cookie = '__session=true; path=/; SameSite=Lax' + maxAge;
      }
    }
    if (!document.cookie.includes('cookie_check=')) {
      if (isHttps) {
        document.cookie = 'cookie_check=passed; path=/; SameSite=None; Secure; Partitioned' + maxAge;
        document.cookie = 'cookie_check=passed; path=/; SameSite=None; Secure' + maxAge;
      } else {
        document.cookie = 'cookie_check=passed; path=/; SameSite=Lax' + maxAge;
      }
    }
  } catch (e) {}
}

// Synchronously remove server-injected JSON-LD structured data scripts before React mounts.
// React Helmet will render fresh client-managed JSON-LD tags, preventing duplicate schemas.
if (typeof document !== 'undefined') {
  document.querySelectorAll('script[type="application/ld+json"]').forEach((el) => el.remove());
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
