import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { TopNav } from './TopNav';
import { BottomNav } from './BottomNav';
import { Footer } from './Footer';

export const Layout: React.FC = () => {
  const location = useLocation();
  const hideNavs = ['/login', '/register'].includes(location.pathname);
  const isAdminPage = location.pathname === '/admin' || location.pathname.startsWith('/admin/');
  const isEditingOrAdding = location.pathname.includes('/edit') || location.pathname.includes('/add');
  const showBack = isEditingOrAdding || (!['/', '/listings', '/news', '/events', '/jobs', '/admin'].includes(location.pathname) && !isAdminPage);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {!hideNavs && <TopNav showBack={showBack} />}
      <main className={`flex-1 ${!hideNavs ? 'pt-20 pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-12' : ''} ${isAdminPage ? 'pb-0' : ''}`}>
        <Outlet />
      </main>
      {!hideNavs && !isAdminPage && <Footer />}
      {!hideNavs && !isAdminPage && <BottomNav />}
    </div>
  );
};
