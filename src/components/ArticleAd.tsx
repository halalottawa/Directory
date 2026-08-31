import React, { useEffect, useRef } from 'react';

export const ArticleAd: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Check if the current device/viewport is mobile
    const checkIsMobile = () => {
      const isNarrowScreen = window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth < 768;
      const isMobileAgent = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      return isNarrowScreen || isMobileAgent;
    };

    const isMobile = checkIsMobile();
    // Mobile banner data-key vs Desktop banner data-key
    const dataKey = isMobile ? '536fb5cb065ddb32c898accf7dd56bfc' : '78ada30287908ae8dc023653b98196be';

    containerRef.current.innerHTML = `<ins class="bbbac5e5" data-key="${dataKey}"></ins>`;

    const script = document.createElement('script');
    script.src = 'https://cdn77.aj2742.top/dcfc6ab7.js';
    script.async = true;
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="my-8 w-full flex flex-col items-center justify-center overflow-hidden">
      <div ref={containerRef} className="w-full flex justify-center" />
      <p style={{ textAlign: 'center' }} className="mt-2 text-xs text-gray-500">
        <a 
          href="https://muslimadnetwork.com/?pub=halalottawa.ca" 
          title="Ads By Muslim Ad Network" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="hover:underline"
        >
          Ads By Muslim Ad Network
        </a>
      </p>
    </div>
  );
};

