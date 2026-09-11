import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { isAppWrapper } from './utils/platform';
import { getGeneralSettings } from './firebase';

const CookieCheckRedirect: React.FC = () => {
  const navigate = useNavigate();
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('return_url');
      if (returnUrl) {
        let target = returnUrl;
        if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
          const parsed = new URL(returnUrl);
          target = parsed.pathname + parsed.search + parsed.hash;
        }
        target = target.replace(/https?:\/\/[^\/]+/i, '');
        if (!target.startsWith('/')) target = '/' + target;
        navigate(target, { replace: true });
        return;
      }
    } catch (e) {}
    navigate('/', { replace: true });
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};

// Direct load for main landing page to eliminate render delay
import { Home } from './pages/Home';

// Lazy load secondary pages
const Listings = React.lazy(() => import('./pages/Listings').then(module => ({ default: module.Listings })));
const CategoryListings = React.lazy(() => import('./pages/CategoryListings').then(module => ({ default: module.CategoryListings })));
const ListingDetail = React.lazy(() => import('./pages/ListingDetail').then(module => ({ default: module.ListingDetail })));
const AddListing = React.lazy(() => import('./pages/AddListing').then(module => ({ default: module.AddListing })));
const News = React.lazy(() => import('./pages/News').then(module => ({ default: module.News })));
const NewsDetail = React.lazy(() => import('./pages/NewsDetail').then(module => ({ default: module.NewsDetail })));
const Events = React.lazy(() => import('./pages/Events').then(module => ({ default: module.Events })));
const EventDetail = React.lazy(() => import('./pages/EventDetail').then(module => ({ default: module.EventDetail })));
const AddEvent = React.lazy(() => import('./pages/AddEvent').then(module => ({ default: module.AddEvent })));
const Jobs = React.lazy(() => import('./pages/Jobs').then(module => ({ default: module.Jobs })));
const JobDetail = React.lazy(() => import('./pages/JobDetail').then(module => ({ default: module.JobDetail })));
const AddJob = React.lazy(() => import('./pages/AddJob').then(module => ({ default: module.AddJob })));
const AddNews = React.lazy(() => import('./pages/AddNews').then(module => ({ default: module.AddNews })));
const EditListing = React.lazy(() => import('./pages/EditListing').then(module => ({ default: module.EditListing })));
const EditEvent = React.lazy(() => import('./pages/EditEvent').then(module => ({ default: module.EditEvent })));
const EditJob = React.lazy(() => import('./pages/EditJob').then(module => ({ default: module.EditJob })));
const EditNews = React.lazy(() => import('./pages/EditNews').then(module => ({ default: module.EditNews })));
const Login = React.lazy(() => import('./pages/Login').then(module => ({ default: module.Login })));
const Profile = React.lazy(() => import('./pages/Profile').then(module => ({ default: module.Profile })));
const EditProfile = React.lazy(() => import('./pages/EditProfile').then(module => ({ default: module.EditProfile })));
const SavedItems = React.lazy(() => import('./pages/SavedItems').then(module => ({ default: module.SavedItems })));
const Settings = React.lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })));
const AdminDashboard = React.lazy(() => import('./pages/AdminDashboard').then(module => ({ default: module.AdminDashboard })));
const PrivacyPolicy = React.lazy(() => import('./pages/PrivacyPolicy').then(module => ({ default: module.PrivacyPolicy })));
const TermsOfService = React.lazy(() => import('./pages/TermsOfService').then(module => ({ default: module.TermsOfService })));
const FAQ = React.lazy(() => import('./pages/FAQ').then(module => ({ default: module.FAQ })));
const QiblaDirection = React.lazy(() => import('./pages/QiblaDirection').then(module => ({ default: module.QiblaDirection })));
const NotFound = React.lazy(() => import('./pages/NotFound').then(module => ({ default: module.NotFound })));
const ShortLinkRedirect = React.lazy(() => import('./pages/ShortLinkRedirect').then(module => ({ default: module.ShortLinkRedirect })));

import ErrorBoundary from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';

import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';

import { safeLocalStorage } from './utils/safeStorage';

const AppContent: React.FC = () => {
  const { user, loading, isGuest } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isApp, setIsApp] = useState(() => isAppWrapper());

  useEffect(() => {
    // Check if the app wrapper status gets detected slightly late due to async bridge injection
    if (!isApp) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (isAppWrapper()) {
          setIsApp(true);
          clearInterval(interval);
        } else if (attempts >= 10) {
          clearInterval(interval);
        }
      }, 150);
      return () => clearInterval(interval);
    }
  }, [isApp]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      if (pathname.includes('__cookie_check')) {
        try {
          const params = new URLSearchParams(window.location.search);
          const returnUrl = params.get('return_url');
          if (returnUrl) {
            let target = returnUrl;
            if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
              const parsed = new URL(returnUrl);
              target = parsed.pathname + parsed.search + parsed.hash;
            }
            target = target.replace(/https?:\/\/[^\/]+/i, '');
            if (!target.startsWith('/')) target = '/' + target;
            window.history.replaceState(null, '', target);
            if (location.pathname.includes('__cookie_check')) {
              navigate(target, { replace: true });
            }
          } else {
            window.history.replaceState(null, '', '/');
            if (location.pathname.includes('__cookie_check')) {
              navigate('/', { replace: true });
            }
          }
        } catch (e) {
          window.history.replaceState(null, '', '/');
        }
      }

      // Automatically strip internal preview tokens (like __aistudio_auth_token and return_url)
      // and normalize trailing slashes in the browser URL bar
      try {
        const searchParams = new URLSearchParams(window.location.search);
        let hasModifiedSearch = false;
        if (searchParams.has('__aistudio_auth_token')) {
          searchParams.delete('__aistudio_auth_token');
          hasModifiedSearch = true;
        }
        if (searchParams.has('return_url')) {
          searchParams.delete('return_url');
          hasModifiedSearch = true;
        }

        let cleanPath = window.location.pathname;
        if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
          cleanPath = cleanPath.slice(0, -1);
          hasModifiedSearch = true;
        }

        if (hasModifiedSearch) {
          const queryString = searchParams.toString();
          const newUrl = cleanPath + (queryString ? `?${queryString}` : '') + window.location.hash;
          window.history.replaceState(null, '', newUrl);
        }
      } catch (err) {
        // Safe fallback
      }

      const hostname = window.location.hostname;
      let isIframe = false;
      try {
        isIframe = window.self !== window.top;
      } catch (err) {
        isIframe = true;
      }
      
      const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.');
      const isStagingSandbox = hostname.includes('ais-dev-') || hostname.includes('ais-pre-') || hostname.includes('google-') || isLocal;
      
      // If visited directly on any standalone Cloud Run host outside the builder iframe and staging sandbox,
      // seamlessly redirect to the official production domain www.halalottawa.ca
      if (hostname.endsWith('.run.app') && !isIframe && !isStagingSandbox) {
        const searchParams = new URLSearchParams(window.location.search);
        searchParams.delete('__aistudio_auth_token');
        searchParams.delete('return_url');
        const cleanSearch = searchParams.toString() ? `?${searchParams.toString()}` : '';
        window.location.replace(`https://www.halalottawa.ca${window.location.pathname}${cleanSearch}${window.location.hash}`);
      }
    }
  }, [location.pathname, location.search, navigate]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (
        origin && 
        !origin.startsWith('capacitor://') && 
        origin !== 'http://localhost' && 
        !origin.includes('localhost:80') && 
        !origin.includes('localhost:5173') && 
        !origin.includes('127.0.0.1')
      ) {
        safeLocalStorage.setItem('api_base_url', origin);
      }
    }

    getGeneralSettings().then((data) => {
      let favUrl = (data && data.faviconUrl) || "https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/favicon.webp";
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.getElementsByTagName('head')[0].appendChild(link);
      }
      link.href = favUrl;
    });
  }, []);

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const isAllowedPublicPathInApp = ['/privacy-policy', '/terms', '/faq'].includes(location.pathname);

  // In native mobile app wrappers, redirect to login only once auth check has resolved and user is not a guest
  if (isApp && !loading && !user && !isGuest && !isAuthPage && !isAllowedPublicPathInApp) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
          <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/listings" element={<Listings />} />
          <Route path="/restaurants" element={<CategoryListings />} />
          <Route path="/restaurants/:category" element={<CategoryListings />} />
          <Route path="/mosques" element={<CategoryListings />} />
          <Route path="/organizations" element={<CategoryListings />} />
          <Route path="/grocery" element={<CategoryListings />} />
          <Route path="/clothing" element={<CategoryListings />} />
          <Route path="/schools" element={<CategoryListings />} />
          <Route path="/butchers" element={<CategoryListings />} />
          <Route path="/:category" element={<CategoryListings />} />
          <Route path="/listings/:slug" element={<ListingDetail />} />
          <Route path="/news" element={<News />} />
          <Route path="/news/:slug" element={<NewsDetail />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:slug" element={<EventDetail />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:slug" element={<JobDetail />} />
          <Route path="/:category/:slug" element={<ListingDetail />} />
          <Route path="/privacy-policy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/tools/qibla" element={<QiblaDirection />} />
          
          {/* Protected Routes */}
          <Route path="/profile" element={<ProtectedRoute message="Sign in to view and manage your profile."><Profile /></ProtectedRoute>} />
          <Route path="/profile/edit" element={<ProtectedRoute message="Sign in to edit your profile."><EditProfile /></ProtectedRoute>} />
          <Route path="/saved" element={<ProtectedRoute message="Sign in to access your saved listings, events, and jobs."><SavedItems /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute message="Sign in to manage your account settings."><Settings /></ProtectedRoute>} />
          <Route path="/listings/add" element={<ProtectedRoute message="Sign in to add a new listing to the community."><AddListing /></ProtectedRoute>} />
          <Route path="/listings/edit/:id" element={<ProtectedRoute message="Sign in to edit your listing."><EditListing /></ProtectedRoute>} />
          <Route path="/events/add" element={<ProtectedRoute message="Sign in to share a new community event."><AddEvent /></ProtectedRoute>} />
          <Route path="/events/edit/:id" element={<ProtectedRoute message="Sign in to edit your event details."><EditEvent /></ProtectedRoute>} />
          <Route path="/jobs/add" element={<ProtectedRoute message="Sign in to post a new job opportunity."><AddJob /></ProtectedRoute>} />
          <Route path="/jobs/edit/:id" element={<ProtectedRoute message="Sign in to edit your job posting."><EditJob /></ProtectedRoute>} />
          <Route path="/news/add" element={<ProtectedRoute requireAdmin message="Admin access required to publish news articles."><AddNews /></ProtectedRoute>} />
          <Route path="/news/edit/:id" element={<ProtectedRoute requireAdmin message="Admin access required to edit news articles."><EditNews /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute requireAdmin message="Admin access required for the dashboard."><AdminDashboard /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Route>
        
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
        <Route path="/go/:slug" element={<ShortLinkRedirect />} />
        <Route path="/__cookie_check.html" element={<CookieCheckRedirect />} />
      </Routes>
      </Suspense>
    </ErrorBoundary>
  );
};

export default function App() {
  return (
    <HelmetProvider>
      <Toaster position="top-center" richColors />
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
