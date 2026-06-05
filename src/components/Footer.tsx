import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { getGeneralSettings } from '../firebase';
import { getOptimizedImageUrl } from '../utils/imageUtils';

// Custom inline SVG social icons for zero bundle-size cost
const FaFacebook: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const FaInstagram: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FaLinkedin: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const FaTiktok: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

export const Footer: React.FC = () => {
  const [siteLogoUrl, setSiteLogoUrl] = useState("https://www.halalottawa.ca/wp-content/uploads/2023/07/Halal-Ottawa.png.webp");

  useEffect(() => {
    getGeneralSettings().then((data) => {
      if (data && data.logoUrl) {
        setSiteLogoUrl(data.logoUrl);
      }
    });
  }, []);

  return (
    <footer className="bg-gray-950 pt-12 md:pt-16 pb-8 border-t border-gray-850">
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-2" aria-label="Halal Ottawa Home">
              <img 
                src={siteLogoUrl || undefined} 
                alt="Halal Ottawa" 
                className="h-10 w-auto brightness-0 invert" 
                loading="lazy"
                width="160"
                height="40"
              />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Supporting the Ottawa Muslim community by connecting people with halal-certified businesses, community events, local news, and career opportunities. Your trusted hub for halal life in the capital.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://www.facebook.com/halalottawa.ca/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="Facebook">
                <FaFacebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/halalottawa.ca/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="Instagram">
                <FaInstagram className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/company/halalottawa/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="LinkedIn">
                <FaLinkedin className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@halalottawa.ca" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="TikTok">
                <FaTiktok className="w-5 h-5" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg tracking-tight">Browse</h3>
            <ul className="space-y-4">
              <li><Link to="/listings" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">All Listings</Link></li>
              <li><Link to="/news" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Community News</Link></li>
              <li><Link to="/events" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Upcoming Events</Link></li>
              <li><Link to="/jobs" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Job Board</Link></li>
            </ul>
          </div>

          {/* Community */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg tracking-tight">Support</h3>
            <ul className="space-y-4">
              <li><Link to="/faq" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">FAQ</Link></li>
              <li><Link to="/tools/qibla" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Qibla Direction</Link></li>
              <li><Link to="/terms" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Terms of Service</Link></li>
              <li><Link to="/privacy-policy" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Privacy Policy</Link></li>
            </ul>
          </div>

          {/* Locations */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg tracking-tight">Locations</h3>
            <ul className="space-y-4">
              <li><Link to="/restaurants/orleans" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Orleans</Link></li>
              <li><Link to="/restaurants/kanata" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Kanata</Link></li>
              <li><Link to="/restaurants/barrhaven" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Barrhaven</Link></li>
              <li><Link to="/restaurants/downtown" className="text-gray-400 hover:text-[#e90b35] text-sm transition-colors flex items-center gap-2 underline-offset-4 hover:underline">Downtown</Link></li>
            </ul>
          </div>
        </div>

        {/* Footer Bottom */}
        <div className="mt-16 pt-8 border-t border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-gray-500 text-xs text-center md:text-left">
            © {new Date().getFullYear()} Halal Ottawa. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
