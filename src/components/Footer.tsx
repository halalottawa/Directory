import React from 'react';
import { Link } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Globe, ExternalLink } from 'lucide-react';

const TikTok: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
  >
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93v7.2c0 1.96-.5 3.94-1.6 5.56-1.25 1.83-3.23 3.03-5.38 3.25-2.43.25-4.99-.44-6.8-2.07C.92 20.35-.41 17.84.1 15.2c.42-2.18 1.91-4.06 3.9-5.02 1.93-.93 4.26-1.02 6.26-.34V14c-1.43-.37-3.08-.1-4.22.84-.96.79-1.48 2.06-1.34 3.29.17 1.51 1.48 2.8 2.97 3.03 1.58.24 3.26-.44 4.08-1.84.45-.77.68-1.7.67-2.61v-16.7h.1z"/>
  </svg>
);

export const Footer: React.FC = () => {
  return (
    <footer className="hidden md:block bg-gray-900 pt-16 pb-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src="https://www.halalottawa.ca/wp-content/uploads/2023/07/Halal-Ottawa.png.webp" 
                alt="Halal Ottawa" 
                className="h-10 w-auto brightness-0 invert" 
              />
            </Link>
            <p className="text-gray-400 text-sm leading-relaxed max-w-sm">
              Supporting the Ottawa Muslim community by connecting people with halal-certified businesses, community events, local news, and career opportunities. Your trusted hub for halal life in the capital.
            </p>
            <div className="flex items-center gap-4">
              <a href="https://www.facebook.com/halalottawa.ca/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="Facebook">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/halalottawa.ca/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="Instagram">
                <Instagram className="w-5 h-5" />
              </a>
              <a href="https://www.linkedin.com/company/halalottawa/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="LinkedIn">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="https://www.tiktok.com/@halalottawa.ca" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="TikTok">
                <TikTok className="w-5 h-5" />
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

          {/* Contact */}
          <div className="space-y-6">
            <h3 className="text-white font-bold text-lg tracking-tight">Contact Us</h3>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#e90b35] shrink-0 mt-0.5" />
                <span className="text-gray-400 text-sm">Ottawa, Ontario, Canada</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-[#e90b35] shrink-0" />
                <a href="mailto:info@halalottawa.ca" className="text-gray-400 hover:text-white text-sm transition-colors">info@halalottawa.ca</a>
              </li>
              <li className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#e90b35] shrink-0" />
                <a href="https://halalottawa.ca" className="text-gray-400 hover:text-white text-sm transition-colors">halalottawa.ca</a>
              </li>
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
