import React, { useEffect, useRef } from 'react';

interface ArticleAdProps {
  variant?: 'auto' | 'desktop' | 'mobile';
  className?: string;
}

const AD_SCRIPT_SRC = 'https://cdn77.aj2742.top/dcfc6ab7.js';
const DESKTOP_KEY = '78ada30287908ae8dc023653b98196be'; // 728x90
const MOBILE_KEY = '536fb5cb065ddb32c898accf7dd56bfc'; // 300x250
const TRIGGER_EVENTS = ['scroll', 'pointerdown', 'touchstart', 'keydown'] as const;

let interactionListenerBound = false;
const pendingCallbacks = new Set<() => void>();

function ensureAdScriptInjectedOnce() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  const win = window as any;

  // If the ad script has already loaded and registered EpomAdServer, just trigger its scan for new <ins> slots
  if (win.__manAdScriptLoaded && win.EpomAdServer?.bbbac5e5?.init) {
    try {
      win.EpomAdServer.bbbac5e5.init();
    } catch {
      // Ignore ad init errors
    }
    return;
  }

  // Guard flag: inject the <script> element at most once across the entire page lifecycle
  if (win.__manAdScriptInjected) {
    return;
  }
  win.__manAdScriptInjected = true;

  if (!document.querySelector(`script[src="${AD_SCRIPT_SRC}"]`)) {
    const script = document.createElement('script');
    script.src = AD_SCRIPT_SRC;
    script.async = true;
    script.onload = () => {
      win.__manAdScriptLoaded = true;
    };
    document.head.appendChild(script);
  }
}

function onFirstUserInteraction() {
  if (typeof window === 'undefined') return;
  const win = window as any;
  win.__userHasInteracted = true;

  if (interactionListenerBound) {
    TRIGGER_EVENTS.forEach((evt) => window.removeEventListener(evt, onFirstUserInteraction));
    interactionListenerBound = false;
  }

  pendingCallbacks.forEach((cb) => cb());
  pendingCallbacks.clear();

  ensureAdScriptInjectedOnce();
}

function registerAdSlotOnInteraction(cb: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const win = window as any;

  if (win.__userHasInteracted) {
    cb();
    ensureAdScriptInjectedOnce();
    return () => {};
  }

  pendingCallbacks.add(cb);

  if (!interactionListenerBound) {
    interactionListenerBound = true;
    TRIGGER_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onFirstUserInteraction, { once: true, passive: true })
    );
  }

  return () => {
    pendingCallbacks.delete(cb);
  };
}

export const ArticleAd: React.FC<ArticleAdProps> = ({ variant = 'auto', className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const slotInitializedRef = useRef<boolean>(false);

  useEffect(() => {
    const getSelectedKey = (): string => {
      if (variant === 'desktop') return DESKTOP_KEY;
      if (variant === 'mobile') return MOBILE_KEY;
      const isMobile = window.matchMedia
        ? window.matchMedia('(max-width: 767px)').matches
        : window.innerWidth < 768;
      return isMobile ? MOBILE_KEY : DESKTOP_KEY;
    };

    const mountInsElement = () => {
      if (!containerRef.current || slotInitializedRef.current) return;
      slotInitializedRef.current = true;
      const key = getSelectedKey();
      containerRef.current.innerHTML = `<ins class="bbbac5e5" data-key="${key}"></ins>`;
    };

    const unregister = registerAdSlotOnInteraction(mountInsElement);

    return () => {
      unregister();
    };
  }, [variant]);

  const outerHeightClass =
    variant === 'desktop'
      ? 'min-h-[114px]'
      : variant === 'mobile'
      ? 'min-h-[274px]'
      : 'min-h-[274px] md:min-h-[114px]';

  const innerSizeClass =
    variant === 'desktop'
      ? 'w-[728px] max-w-full h-[90px] min-h-[90px]'
      : variant === 'mobile'
      ? 'w-[300px] max-w-full h-[250px] min-h-[250px]'
      : 'w-[300px] max-w-full h-[250px] min-h-[250px] md:w-[728px] md:h-[90px] md:min-h-[90px]';

  return (
    <div className={`my-8 w-full flex flex-col items-center justify-center overflow-hidden ${outerHeightClass} ${className}`}>
      <div ref={containerRef} className={`mx-auto flex justify-center items-center ${innerSizeClass}`} />
      <p style={{ textAlign: 'center' }} className="mt-2 text-xs text-gray-600">
        <a 
          href="https://muslimadnetwork.com/?pub=halalottawa.ca" 
          title="Ads By Muslim Ad Network" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline text-gray-600 hover:text-gray-900 focus:text-gray-900"
        >
          Ads By Muslim Ad Network
        </a>
      </p>
    </div>
  );
};
