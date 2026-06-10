import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';
import { isAppWrapper } from '../utils/platform';

export const Layout: React.FC = () => {
  const location = useLocation();
  const hideNavs = ['/login', '/register'].includes(location.pathname);
  const isAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isEditingOrAdding = location.pathname.includes('/edit') || location.pathname.includes('/add');
  const showBack = isEditingOrAdding || (!['/', '/listings', '/news', '/events', '/jobs', '/admin'].includes(location.pathname) && !isAdminPage);

  const [inApp, setInApp] = useState(false);

  useEffect(() => {
    setInApp(isAppWrapper());
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!hideNavs && <TopNav showBack={showBack} />}
      <main className={`flex-1 ${!hideNavs ? (inApp ? 'pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12' : 'pt-20 pb-12') : ''} ${isAdminPage ? 'pb-0' : ''}`}>
        <Outlet />
      </main>
      {!hideNavs && !isAdminPage && (
        <>
          {/* Version 1: Connected using standard web browser. Shows the desktop-like adapted mobile footer. */}
          {!inApp && <Footer />}
          
          {/* Version 2: Connected using native android / ios app wrappers. Keeps only the bottom navigation bar and no text footer. */}
          {inApp && <BottomNav />}
        </>
      )}
    </div>
  );
};
