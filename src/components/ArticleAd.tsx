import React, { useEffect, useRef } from 'react';

export const ArticleAd: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Check if script is already injected to avoid duplicate insertion on re-render
    if (containerRef.current.querySelector('script[src="https://cdn77.aj2742.top/dcfc6ab7.js"]')) {
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.src = "https://cdn77.aj2742.top/dcfc6ab7.js";
    containerRef.current.appendChild(script);
  }, []);

  return (
    <div className="my-8 flex flex-col items-center justify-center w-full overflow-hidden" ref={containerRef}>
      <ins className="bbbac5e5" data-key="78ada30287908ae8dc023653b98196be" style={{ display: 'block', width: '100%' }}></ins>
    </div>
  );
};
