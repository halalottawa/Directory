import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User, Settings, LogIn, LogOut, ChevronLeft, MapPin, Newspaper, Calendar, Briefcase, Shield, PlusCircle, Home, Bookmark, LayoutDashboard, Clock, Check, Users, MessageSquare, Star, ChevronDown, ChevronUp, Globe, FileText, HelpCircle } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { CATEGORIES } from '../constants';

interface TopNavProps {
  showBack?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ showBack }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAdminMenuExpanded, setIsAdminMenuExpanded] = useState(location.pathname === '/admin');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [siteLogoUrl, setSiteLogoUrl] = useState("https://www.halalottawa.ca/wp-content/uploads/2023/07/Halal-Ottawa.png.webp");
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'general'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().logoUrl) {
        setSiteLogoUrl(docSnap.data().logoUrl);
      }
    });

    return () => unsub();
  }, []);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleLogoClick = () => {
    navigate('/');
  };

  const handleBackClick = () => {
    navigate(-1);
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 h-20 bg-white/80 backdrop-blur-md border-b border-gray-100 z-40 flex justify-between items-center px-4 md:px-8 lg:px-12">
        {/* Mobile Left: Menu / Back */}
        <div className="flex items-center justify-start md:hidden">
          {showBack ? (
            <button onClick={handleBackClick} className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
          ) : (
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          )}
        </div>

        {/* Desktop Left: Logo */}
        <div onClick={handleLogoClick} className="hidden md:flex items-center justify-start gap-2 cursor-pointer">
          <img 
            src={getOptimizedImageUrl(siteLogoUrl, 180, 52)} 
            alt="Halal Ottawa" 
            className="h-[52px] w-auto"
            fetchPriority="high"
            width="180"
            height="52"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Desktop Center: Navigation Links */}
        <nav className="hidden md:flex shrink-0 justify-center items-center gap-4 lg:gap-6">
          {CATEGORIES.filter(c => c !== 'Organizations').map(cat => {
            const path = `/${cat.toLowerCase().replace(/\s+/g, '-')}`;
            return (
              <Link
                key={cat}
                to={path}
                className={`text-sm font-semibold transition-colors whitespace-nowrap ${
                  location.pathname === path || (location.pathname.startsWith(path + '/') && location.pathname !== '/')
                    ? 'text-[#e90b35]'
                    : 'text-gray-900 hover:text-[#e90b35]'
                }`}
              >
                {cat}
              </Link>
            );
          })}
        </nav>

        {/* Mobile Center: Logo */}
        <div onClick={handleLogoClick} className="absolute left-1/2 -translate-x-1/2 flex md:hidden items-center gap-2 cursor-pointer">
          <img 
            src={getOptimizedImageUrl(siteLogoUrl, 152, 44)} 
            alt="Halal Ottawa" 
            className="h-[44px] w-auto"
            width="152"
            height="44"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Right Side: Profile & Admin */}
        <div className="flex justify-end items-center gap-3 relative">


          {loading ? (
            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center animate-pulse border border-gray-200">
              <User className="w-4 h-4 text-gray-300" />
            </div>
          ) : user ? (
            <div className="relative">
              <button 
                onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e90b35] to-[#ff4d6d] overflow-hidden border border-white shadow-sm flex items-center justify-center text-white text-[10px] font-black hover:scale-105 transition-transform"
              >
                <span>{(user?.firstName?.[0] || user?.name?.[0] || '?').toUpperCase()}</span>
              </button>

              {/* Desktop Profile Dropdown */}
              {isProfileDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40 hidden md:block" 
                    onClick={() => setIsProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-4 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-50 animate-in fade-in slide-in-from-top-4 duration-200 hidden md:block">
                    <div className="px-5 py-3 border-b border-gray-50 mb-2">
                      <p className="text-sm font-black text-gray-900 truncate">{user.name || user.email}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>
                    
                    <div className="px-2 space-y-1">
                      <Link 
                        to="/profile" 
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-gray-700 hover:text-[#e90b35] font-bold text-sm transition-all group"
                      >
                        <User className="w-4 h-4 text-gray-400 group-hover:text-[#e90b35]" />
                        <span>My Profile</span>
                      </Link>
                      <Link 
                        to="/saved" 
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-gray-700 hover:text-[#e90b35] font-bold text-sm transition-all group"
                      >
                        <Bookmark className="w-4 h-4 text-gray-400 group-hover:text-[#e90b35]" />
                        <span>Saved Items</span>
                      </Link>
                      <Link 
                        to="/settings" 
                        onClick={() => setIsProfileDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-gray-700 hover:text-[#e90b35] font-bold text-sm transition-all group"
                      >
                        <Settings className="w-4 h-4 text-gray-400 group-hover:text-[#e90b35]" />
                        <span>Settings</span>
                      </Link>
                      {user.role === 'admin' && (
                        <Link 
                          to="/admin" 
                          onClick={() => setIsProfileDropdownOpen(false)}
                          className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-[#e90b35] font-bold text-sm transition-all group"
                        >
                          <Shield className="w-4 h-4 text-[#e90b35]" />
                          <span>Admin Dashboard</span>
                        </Link>
                      )}
                    </div>

                    <div className="mt-2 pt-2 border-t border-gray-50 px-2">
                      <button 
                        onClick={() => { logout(); setIsProfileDropdownOpen(false); }}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 font-bold text-sm transition-all group"
                      >
                        <LogOut className="w-4 h-4 text-gray-400 group-hover:text-red-500" />
                        <span className="group-hover:text-red-500">Logout</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link to="/login" className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center border border-gray-200 text-gray-400 hover:bg-gray-200 transition-colors shadow-sm">
              <User className="w-4 h-4" />
            </Link>
          )}
        </div>
      </header>

      {/* Hamburger Menu Overlay */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-[200] flex animate-in fade-in duration-300">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl animate-in slide-in-from-left duration-500 flex flex-col pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="p-6 flex justify-between items-center border-b border-gray-50">
              <div className="flex items-center gap-2">
                <img 
                  src={getOptimizedImageUrl(siteLogoUrl, 180, 52)} 
                  alt="Halal Ottawa" 
                  className="h-[52px] w-auto"
                  width="180"
                  height="52"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                />
              </div>
              <button onClick={() => setIsMenuOpen(false)} className="p-2 hover:bg-gray-50 rounded-full">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto py-6 px-4">
              {user ? (
                <nav className="">
                  <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Account</p>
                  <Link 
                    to="/profile" 
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                      isActive('/profile') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive('/profile') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                    }`}>
                      <User className="w-4 h-4" />
                    </div>
                    <span className="font-bold">My Profile</span>
                  </Link>
                  <Link 
                    to="/saved" 
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                      isActive('/saved') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive('/saved') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                    }`}>
                      <Bookmark className="w-4 h-4" />
                    </div>
                    <span className="font-bold">Saved Items</span>
                  </Link>
                  <Link 
                    to="/settings" 
                    onClick={() => setIsMenuOpen(false)}
                    className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                      isActive('/settings') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                      isActive('/settings') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                    }`}>
                      <Settings className="w-4 h-4" />
                    </div>
                    <span className="font-bold">Settings</span>
                  </Link>
                  {user.role === 'admin' && (
                    <Link 
                      to="/admin" 
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                        isActive('/admin') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                        isActive('/admin') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                      }`}>
                        <Shield className="w-4 h-4" />
                      </div>
                      <span className="font-bold">Admin Dashboard</span>
                    </Link>
                  )}
                </nav>
              ) : (
                <div className="px-4 py-8 text-center">
                  <p className="text-gray-400 text-sm">Please login to access your account menu.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-50 space-y-4">
              <div className="flex flex-col gap-2 mb-4">
                <Link 
                  to="/privacy-policy" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-start gap-2 py-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-[#e90b35] transition-colors"
                >
                  <Shield className="w-3 h-3" />
                  <span>Privacy Policy</span>
                </Link>
                <Link 
                  to="/terms" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-start gap-2 py-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-[#e90b35] transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  <span>Terms Of Service</span>
                </Link>
                <Link 
                  to="/faq" 
                  onClick={() => setIsMenuOpen(false)}
                  className="flex items-center justify-start gap-2 py-2 text-gray-400 text-[10px] font-bold uppercase tracking-widest hover:text-[#e90b35] transition-colors"
                >
                  <HelpCircle className="w-3 h-3" />
                  <span>FAQ</span>
                </Link>
              </div>

              {user ? (
                <button 
                  onClick={() => { logout(); setIsMenuOpen(false); }}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-gray-50 text-gray-600 font-bold rounded-2xl hover:bg-red-50 hover:text-red-600 transition-all active:scale-95"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              ) : (
                <Link 
                  to="/login" 
                  onClick={() => setIsMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 py-4 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
