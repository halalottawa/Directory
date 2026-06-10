import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Menu, X, User, Settings, LogIn, LogOut, ChevronLeft, MapPin, Newspaper, Calendar, Briefcase, Shield, PlusCircle, Home, Bookmark, LayoutDashboard, Clock, Check, Users, MessageSquare, Star, ChevronDown, ChevronUp, Globe, FileText, HelpCircle, Compass } from 'lucide-react';
import { getGeneralSettings } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { CATEGORIES, LISTING_TYPES, CUISINES } from '../constants';
import { isAppWrapper } from '../utils/platform';
import { CategoryIcon } from './CategoryIcon';

interface TopNavProps {
  showBack?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ showBack }) => {
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isRestaurantsMobileExpanded, setIsRestaurantsMobileExpanded] = useState(false);
  const [isAdminMenuExpanded, setIsAdminMenuExpanded] = useState(location.pathname === '/admin');
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [siteLogoUrl, setSiteLogoUrl] = useState("https://www.halalottawa.ca/wp-content/uploads/2023/07/Halal-Ottawa.png.webp");
  const { user, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isAppWrapper());
  }, []);

  useEffect(() => {
    getGeneralSettings().then((data) => {
      if (data && data.logoUrl) {
        setSiteLogoUrl(data.logoUrl);
      }
    });
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
            <button 
              onClick={handleBackClick} 
              className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
              aria-label="Go back"
            >
              <ChevronLeft className="w-6 h-6 text-gray-600" />
            </button>
          ) : (
            <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 -ml-2 hover:bg-gray-50 rounded-full transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
          )}
        </div>

        {/* Desktop Left: Logo */}
        <div 
          onClick={handleLogoClick} 
          className="hidden md:flex items-center justify-start gap-2 cursor-pointer"
          aria-label="Halal Ottawa Home"
          role="link"
        >
          <img 
            src={siteLogoUrl || undefined} 
            alt="Halal Ottawa" 
            className="h-[52px] w-[180px] object-contain"
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
            const label = cat;
            return (
              <div key={cat} className="relative group/menu py-2">
                <Link
                  to={path}
                  className={`flex items-center gap-1.5 text-sm font-semibold transition-colors whitespace-nowrap ${
                    location.pathname === path || (location.pathname.startsWith(path + '/') && location.pathname !== '/')
                      ? 'text-[#e90b35]'
                      : 'text-gray-900 hover:text-[#e90b35]'
                  }`}
                >
                  <span>{label}</span>
                  {cat === 'Restaurants' && (
                    <ChevronDown className="w-3.5 h-3.5 text-gray-400 group-hover/menu:text-[#e90b35] transition-transform duration-200 group-hover/menu:rotate-180" />
                  )}
                </Link>

                {cat === 'Restaurants' && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-[600px] bg-white border border-gray-100 shadow-2xl rounded-2xl p-5 grid grid-cols-2 gap-6 opacity-0 translate-y-2 pointer-events-none group-hover/menu:opacity-100 group-hover/menu:translate-y-0 group-hover/menu:pointer-events-auto transition-all duration-300 z-50">
                    {/* Food Types column */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-1.5/50">
                        Food
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {LISTING_TYPES.map((type) => {
                          const typePath = `/restaurants/${type.toLowerCase().replace(/\s+/g, '-')}`;
                          return (
                            <Link
                              key={type}
                              to={typePath}
                              className={`text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50 hover:text-[#e90b35] transition-colors whitespace-nowrap ${
                                location.pathname === typePath ? 'text-[#e90b35] bg-red-50/50' : 'text-gray-650'
                              }`}
                            >
                              {type}
                            </Link>
                          );
                        })}
                      </div>
                    </div>

                    {/* Cuisines column */}
                    <div>
                      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-100 pb-1.5/50">
                        Cuisines
                      </div>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                        {CUISINES.map((cuisine) => {
                          const cuisinePath = `/restaurants/${cuisine.toLowerCase().replace(/\s+/g, '-')}`;
                          return (
                            <Link
                              key={cuisine}
                              to={cuisinePath}
                              className={`text-xs font-semibold px-2 py-1.5 rounded-lg hover:bg-red-50 hover:text-[#e90b35] transition-colors whitespace-nowrap ${
                                location.pathname === cuisinePath ? 'text-[#e90b35] bg-red-50/50' : 'text-gray-650'
                              }`}
                            >
                              {cuisine}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Mobile Center: Logo */}
        <div 
          onClick={handleLogoClick} 
          className="absolute left-1/2 -translate-x-1/2 flex md:hidden items-center gap-2 cursor-pointer"
          aria-label="Halal Ottawa Home"
          role="link"
        >
          <img 
            src={siteLogoUrl || undefined} 
            alt="Halal Ottawa" 
            className="h-[44px] w-[152px] object-contain"
            width="152"
            height="44"
            fetchPriority="high"
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
                aria-label="Open profile menu"
                aria-expanded={isProfileDropdownOpen}
                className="w-8 h-8 rounded-full bg-gradient-to-br from-[#e90b35] to-[#ff4d6d] overflow-hidden border border-white shadow-sm flex items-center justify-center text-white text-[10px] font-black hover:scale-105 transition-transform"
              >
                <span>{(user?.firstName?.[0] || user?.name?.[0] || '?').toUpperCase()}</span>
              </button>

              {/* Desktop Profile Dropdown */}
              {isProfileDropdownOpen && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setIsProfileDropdownOpen(false)}
                  />
                  <div className="absolute right-0 mt-4 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-3 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
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
                  src={siteLogoUrl || undefined} 
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
            
            <div className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
              {!inApp ? (
                <nav>
                  <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Categories</p>
                  <div className="space-y-1">
                    {CATEGORIES.map(cat => {
                      const path = `/${cat.toLowerCase().replace(/\s+/g, '-')}`;
                      const isCatActive = location.pathname === path;
                      if (cat === 'Restaurants') {
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex items-center justify-between w-full">
                              <Link
                                to={path}
                                onClick={() => setIsMenuOpen(false)}
                                className={`flex-1 flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                                  isCatActive ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                                }`}
                              >
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                                  isCatActive ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                                }`}>
                                  <CategoryIcon category={cat} className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-sm">Halal Restaurants</span>
                              </Link>
                              <button 
                                onClick={(e) => { e.stopPropagation(); setIsRestaurantsMobileExpanded(!isRestaurantsMobileExpanded); }}
                                className="p-2 hover:bg-gray-50 text-gray-400 rounded-xl mr-1 cursor-pointer transition-colors"
                                aria-label="Toggle Halal Restaurants subcategories"
                              >
                                {isRestaurantsMobileExpanded ? (
                                  <ChevronUp className="w-4 h-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                            
                            {isRestaurantsMobileExpanded && (
                              <div className="pl-2 pr-1 py-1 space-y-3.5 border-l border-red-100 ml-1.5 my-1 animate-in slide-in-from-top-2 duration-200">
                                {/* Food types sub-section */}
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Food</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {LISTING_TYPES.map((type) => {
                                      const typePath = `/restaurants/${type.toLowerCase().replace(/\s+/g, '-')}`;
                                      return (
                                        <Link
                                          key={type}
                                          to={typePath}
                                          onClick={() => setIsMenuOpen(false)}
                                          className={`text-[11px] font-bold px-2 py-1 rounded-full transition-colors ${
                                            location.pathname === typePath
                                              ? 'bg-[#e90b35] text-white'
                                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                          }`}
                                        >
                                          {type}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                                
                                {/* Cuisines sub-section */}
                                <div>
                                  <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1.5">Cuisines</span>
                                  <div className="flex flex-wrap gap-1.5">
                                    {CUISINES.map((cuisine) => {
                                      const cuisinePath = `/restaurants/${cuisine.toLowerCase().replace(/\s+/g, '-')}`;
                                      return (
                                        <Link
                                          key={cuisine}
                                          to={cuisinePath}
                                          onClick={() => setIsMenuOpen(false)}
                                          className={`text-[11px] font-bold px-2 py-1 rounded-full transition-colors ${
                                            location.pathname === cuisinePath
                                              ? 'bg-[#e90b35] text-white'
                                              : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                          }`}
                                        >
                                          {cuisine}
                                        </Link>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return (
                        <Link
                          key={cat}
                          to={path}
                          onClick={() => setIsMenuOpen(false)}
                          className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                            isCatActive ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                            isCatActive ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                          }`}>
                            <CategoryIcon category={cat} className="w-4 h-4" />
                          </div>
                          <span className="font-bold text-sm">
                            {cat === 'Mosques' ? 'Mosques' :
                             cat === 'Grocery' ? 'Halal Grocery' :
                             cat === 'Clothing' ? 'Islamic Clothing' :
                             cat === 'Schools' ? 'Islamic Schools' :
                             cat === 'Butchers' ? 'Halal Butchers' :
                             cat === 'Organizations' ? 'Muslim Organizations' :
                             cat}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </nav>
              ) : (
                <>
                  <nav>
                    <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2">Tools</p>
                    <Link 
                      to="/tools/qibla" 
                      onClick={() => setIsMenuOpen(false)}
                      className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                        isActive('/tools/qibla') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                        isActive('/tools/qibla') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                      }`}>
                        <Compass className="w-4 h-4" />
                      </div>
                      <span className="font-bold">Qibla Direction</span>
                    </Link>
                  </nav>

                  <nav>
                    <p className="px-4 text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-2 mt-4">Support</p>
                    <div className="space-y-1">
                      <Link 
                        to="/faq" 
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                          isActive('/faq') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isActive('/faq') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                        }`}>
                          <HelpCircle className="w-4 h-4" />
                        </div>
                        <span className="font-bold">FAQ</span>
                      </Link>

                      <Link 
                        to="/terms" 
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                          isActive('/terms') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isActive('/terms') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                        }`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <span className="font-bold">Terms of Service</span>
                      </Link>
                      
                      <Link 
                        to="/privacy-policy" 
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center gap-3 py-2 px-3 rounded-2xl transition-all active:scale-95 group ${
                          isActive('/privacy-policy') ? 'bg-red-50 text-[#e90b35]' : 'hover:bg-gray-50 text-gray-750'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${
                          isActive('/privacy-policy') ? 'bg-white text-[#e90b35]' : 'bg-gray-50 text-gray-400 group-hover:text-[#e90b35] group-hover:bg-red-50'
                        }`}>
                          <Shield className="w-4 h-4" />
                        </div>
                        <span className="font-bold">Privacy Policy</span>
                      </Link>
                    </div>
                  </nav>
                </>
              )}
            </div>

            <div className="p-6 border-t border-gray-50">
              {!user && (
                <div className="mt-4">
                  <Link 
                    to="/login" 
                    onClick={() => setIsMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Login</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
