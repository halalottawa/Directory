import React, { useEffect, useRef, useState } from 'react';

interface ArticleAdProps {
  variant?: 'auto' | 'desktop' | 'mobile';
  className?: string;
}

export const ArticleAd: React.FC<ArticleAdProps> = ({ variant = 'auto', className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentKey, setCurrentKey] = useState<string>('');

  useEffect(() => {
    const DESKTOP_KEY = '78ada30287908ae8dc023653b98196be';
    const MOBILE_KEY = '536fb5cb065ddb32c898accf7dd56bfc';

    const getSelectedKey = (): string => {
      if (variant === 'desktop') return DESKTOP_KEY;
      if (variant === 'mobile') return MOBILE_KEY;

      const isMobile = window.matchMedia ? window.matchMedia('(max-width: 767px)').matches : window.innerWidth < 768;
      return isMobile ? MOBILE_KEY : DESKTOP_KEY;
    };

    const loadAd = () => {
      if (!containerRef.current) return;
      const key = getSelectedKey();
      setCurrentKey(key);

      containerRef.current.innerHTML = `<ins class="bbbac5e5" data-key="${key}"></ins>`;

      const script = document.createElement('script');
      script.src = 'https://cdn77.aj2742.top/dcfc6ab7.js';
      script.async = true;
      containerRef.current.appendChild(script);
    };

    loadAd();

    if (variant === 'auto' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(max-width: 767px)');
      const handleChange = () => {
        loadAd();
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        mediaQuery.addListener(handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else {
          mediaQuery.removeListener(handleChange);
        }
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }
      };
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [variant]);

  return (
    <div className={`my-8 w-full flex flex-col items-center justify-center overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full flex justify-center min-h-[50px]" />
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


