import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Search, Newspaper, Calendar, Briefcase, MapPin } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', icon: Home, label: 'Home' },
    { to: '/listings', icon: MapPin, label: 'Listings' },
    { to: '/news', icon: Newspaper, label: 'News' },
    { to: '/events', icon: Calendar, label: 'Events' },
    { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-[110] flex md:hidden items-center justify-around px-2 pt-2 pb-[calc(env(safe-area-inset-bottom,20px)+0.75rem)] min-h-[4.5rem]">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          className={({ isActive }) => cn(
            "flex flex-col items-center gap-1 p-2 rounded-xl transition-all duration-200",
            isActive ? "text-[#e90b35]" : "text-gray-400 hover:text-gray-600"
          )}
        >
          <item.icon className="w-6 h-6" />
          <span className="text-[10px] font-medium uppercase tracking-wider">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};
