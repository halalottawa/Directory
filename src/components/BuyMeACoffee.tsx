import React, { useEffect } from 'react';

export const BuyMeACoffee: React.FC = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    
    const handleWidgetInjections = () => {
      if (mediaQuery.matches) {
        // If script doesn't exist, inject it
        if (!document.querySelector('script[data-name="BMC-Widget"]')) {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js';
          script.setAttribute('data-name', 'BMC-Widget');
          script.setAttribute('data-cfasync', 'false');
          script.setAttribute('data-id', 'halalottawa.ca');
          script.setAttribute('data-description', 'Support me on Buy me a coffee!');
          script.setAttribute('data-message', '');
          script.setAttribute('data-color', '#FF5F5F');
          script.setAttribute('data-position', 'Right');
          script.setAttribute('data-x_margin', '18');
          script.setAttribute('data-y_margin', '18');
          script.async = true;

          document.body.appendChild(script);
        } else {
          // If already injected but hidden or removed, restore visibility
          const bmcBtn = document.getElementById('bmc-wbtn');
          if (bmcBtn) {
            bmcBtn.style.setProperty('display', 'flex', 'important');
            bmcBtn.style.setProperty('visibility', 'visible', 'important');
            bmcBtn.style.setProperty('opacity', '1', 'important');
          }
          const bmcWebpage = document.getElementById('bmc-webpage');
          if (bmcWebpage) {
            bmcWebpage.style.setProperty('display', 'block', 'important');
          }
        }
      } else {
        // Hide BMC elements on screen size changes
        const bmcBtn = document.getElementById('bmc-wbtn');
        if (bmcBtn) {
          bmcBtn.style.setProperty('display', 'none', 'important');
          bmcBtn.style.setProperty('visibility', 'hidden', 'important');
          bmcBtn.style.setProperty('opacity', '0', 'important');
        }
        const bmcWebpage = document.getElementById('bmc-webpage');
        if (bmcWebpage) {
          bmcWebpage.style.setProperty('display', 'none', 'important');
        }
      }
    };

    // Initial check and run
    handleWidgetInjections();

    // Listen to changes in viewport width
    mediaQuery.addEventListener('change', handleWidgetInjections);

    return () => {
      mediaQuery.removeEventListener('change', handleWidgetInjections);
      
      // Clean up the script itself on unmount
      const script = document.querySelector('script[data-name="BMC-Widget"]');
      if (script && script.parentNode) {
        script.parentNode.removeChild(script);
      }

      // Cleanup DOM elements injected by BMAC widget
      const bmcBtn = document.getElementById('bmc-wbtn');
      if (bmcBtn) bmcBtn.remove();
      
      const bmcWebpage = document.getElementById('bmc-webpage');
      if (bmcWebpage) bmcWebpage.remove();

      const bmcIframes = document.querySelectorAll('iframe[src*="buymeacoffee.com"]');
      bmcIframes.forEach(iframe => iframe.remove());
    };
  }, []);

  return null;
};
export default BuyMeACoffee;
