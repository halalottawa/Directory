import React, { useEffect, useRef } from 'react';

export const BeehiivEmbed: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear any previous elements to ensure we don't duplicate
    containerRef.current.innerHTML = '';

    const script = document.createElement('script');
    script.src = `https://subscribe-forms.beehiiv.com/v3/loader.js?t=${Date.now()}`;
    script.async = true;
    script.setAttribute('data-beehiiv-form', '587dc225-734c-42ea-8148-9fcd6acfb8f7');
    
    containerRef.current.appendChild(script);
    
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, []);

  return (
    <div className="my-8 py-6 px-4 bg-white rounded-3xl border border-gray-100 flex flex-col items-center justify-center min-h-[300px] animate-in fade-in duration-500 shadow-sm w-full mx-auto overflow-hidden beehiiv-embed-container-wrapper">
      <style>{`
        .beehiiv-embed-container-wrapper {
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          justify-content: center !important;
          width: 100% !important;
          margin: 1.5rem auto !important;
        }
        .beehiiv-embed-container-wrapper iframe,
        .beehiiv-embed-container-wrapper div,
        .beehiiv-embed-container-wrapper form {
          margin-left: auto !important;
          margin-right: auto !important;
          display: block !important;
          text-align: center !important;
        }
      `}</style>
      <div 
        ref={containerRef}
        className="w-full flex flex-col items-center justify-center text-center" 
        data-beehiiv-form="587dc225-734c-42ea-8148-9fcd6acfb8f7"
      />
    </div>
  );
};
