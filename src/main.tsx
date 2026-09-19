import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (typeof window !== 'undefined' && window.location.hostname === 'halalottawa.ca') {
  window.location.replace(`https://www.halalottawa.ca${window.location.pathname}${window.location.search}${window.location.hash}`);
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
