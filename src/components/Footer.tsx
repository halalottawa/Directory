import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Globe } from 'lucide-react';
import { FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaReddit } from 'react-icons/fa6';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

export const Footer: React.FC = () => {
  const [siteLogoUrl, setSiteLogoUrl] = useState("https://www.halalottawa.ca/wp-content/uploads/2023/07/Halal-Ottawa.png.webp");

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().logoUrl) {
        setSiteLogoUrl(docSnap.data().logoUrl);
      }
    });
    return () => unsub();
  }, []);

  return (
    <footer className="hidden md:block bg-gray-900 pt-16 pb-8 border-t border-gray-800">
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 lg:px-12">
        <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-12 lg:gap-8">
          {/* Brand Column */}
          <div className="lg:col-span-2 space-y-6">
            <Link to="/" className="flex items-center gap-2">
              <img 
                src={siteLogoUrl} 
                alt="Halal Ottawa" 
                className="h-10 w-auto brightness-0 invert" 
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
              <a href="https://www.reddit.com/r/Ottawamuslims/" target="_blank" rel="noopener noreferrer" className="p-2 bg-gray-800 text-gray-400 hover:text-white hover:bg-[#e90b35] rounded-lg transition-all" aria-label="Reddit">
                <FaReddit className="w-5 h-5" />
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
