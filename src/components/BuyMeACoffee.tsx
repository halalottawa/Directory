import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const BuyMeACoffee: React.FC = () => {
  const location = useLocation();

  useEffect(() => {
    // We want to load the script on mount / route change to ensure it initializes the widget on every page.
    const loadBMCScript = () => {
      // Find and remove any existing script to prevent accumulation
      const existingScript = document.querySelector('script[data-name="BMC-Widget"]');
      if (existingScript) {
        existingScript.remove();
      }

      // Cleanup existing BMAC elements in the DOM to avoid duplication
      const existingBtn = document.getElementById("bmc-wbtn");
      if (existingBtn) existingBtn.remove();

      const existingWebpage = document.getElementById("bmc-webpage");
      if (existingWebpage) existingWebpage.remove();

      const existingIframes = document.querySelectorAll('iframe[src*="buymeacoffee.com"]');
      existingIframes.forEach((iframe) => iframe.remove());

      // Create new script element
      const script = document.createElement("script");
      script.src = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";
      script.setAttribute("data-name", "BMC-Widget");
      script.setAttribute("data-cfasync", "false");
      script.setAttribute("data-id", "halalottawa.ca");
      script.setAttribute("data-description", "Support me on Buy me a coffee!");
      script.setAttribute("data-message", "");
      script.setAttribute("data-color", "#FF5F5F");
      script.setAttribute("data-position", "Right");
      script.setAttribute("data-x_margin", "18");
      script.setAttribute("data-y_margin", "18");
      script.async = true;

      // Append to body after a slight delay to ensure React DOM is hydrated
      const timer = setTimeout(() => {
        document.body.appendChild(script);
      }, 500);

      return () => clearTimeout(timer);
    };

    const cleanup = loadBMCScript();

    return () => {
      if (cleanup) cleanup();
      
      // Complete cleanup on component unmount
      const script = document.querySelector('script[data-name="BMC-Widget"]');
      if (script) script.remove();

      const bmcBtn = document.getElementById("bmc-wbtn");
      if (bmcBtn) bmcBtn.remove();

      const bmcWebpage = document.getElementById("bmc-webpage");
      if (bmcWebpage) bmcWebpage.remove();

      const bmcIframes = document.querySelectorAll('iframe[src*="buymeacoffee.com"]');
      bmcIframes.forEach((iframe) => iframe.remove());
    };
  }, [location.pathname]); // Re-run on route switch to guarantee widget persistence

  return null;
};

export default BuyMeACoffee;
