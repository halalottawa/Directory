import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { isAppWrapper } from './utils/platform';

// Intercept all API calls inside native/mobile apps (Capacitor) to hit the production API url
if (typeof window !== 'undefined') {
  const isApp = isAppWrapper();
  if (isApp) {
    const originalFetch = window.fetch;
    window.fetch = function (input, init) {
      let urlStr = '';
      if (typeof input === 'string') {
        urlStr = input;
      } else if (input instanceof URL) {
        urlStr = input.toString();
      } else if (input && typeof input === 'object' && 'url' in input) {
        urlStr = (input as any).url || '';
      }

      const isRelativeApi = urlStr.startsWith('/api/');
      const isLocalhostApi = (urlStr.startsWith('http://localhost') || urlStr.startsWith('capacitor://localhost')) && urlStr.includes('/api/');

      if (isRelativeApi || isLocalhostApi) {
        let cleanPath = urlStr;
        if (urlStr.startsWith('http') || urlStr.startsWith('capacitor')) {
          try {
            const parsed = new URL(urlStr);
            cleanPath = parsed.pathname + parsed.search;
          } catch (e) {
            // fallback
          }
        }
        
        const absoluteUrl = `https://www.halalottawa.ca${cleanPath}`;
        
        if (typeof input === 'string') {
          return originalFetch(absoluteUrl, init);
        } else if (input instanceof URL) {
          return originalFetch(new URL(absoluteUrl), init);
        } else if (input && typeof input === 'object' && 'url' in input) {
          try {
            const newRequest = new Request(absoluteUrl, input as RequestInit);
            return originalFetch(newRequest, init);
          } catch (e) {
            return originalFetch(absoluteUrl, init);
          }
        }
      }
      return originalFetch(input, init);
    };
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
