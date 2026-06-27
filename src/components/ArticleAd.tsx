import React, { useEffect, useRef } from 'react';

export const ArticleAd: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    containerRef.current.innerHTML = '<ins class="bbbac5e5" data-key="78ada30287908ae8dc023653b98196be"></ins>';

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
    </div>
  );
};
