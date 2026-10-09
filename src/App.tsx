import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { isAppWrapper } from './utils/platform';
import { getGeneralSettings } from './services/publicSettings';
import { CATEGORIES, LISTING_TYPES, CUISINES } from './constants';

const CookieCheckRedirect: React.FC = () => {
  useEffect(() => {
    try {
      const isHttps = window.location.protocol === 'https:';
      const flags = '; path=/; SameSite=None' + (isHttps ? '; Secure; Partitioned' : '');
      const maxAge = '; max-age=2592000';
      document.cookie = '__session=true' + flags + maxAge;
      document.cookie = 'cookie_check=passed' + flags + maxAge;
      if (isHttps) {
        document.cookie = '__session=true; path=/; SameSite=None; Secure' + maxAge;
        document.cookie = 'cookie_check=passed; path=/; SameSite=None; Secure' + maxAge;
      } else {
        document.cookie = '__session=true; path=/; SameSite=Lax' + maxAge;
        document.cookie = 'cookie_check=passed; path=/; SameSite=Lax' + maxAge;
      }

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('return_url') || params.get('returnUrl');
      let target = '/';
      if (returnUrl) {
        target = returnUrl;
        if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
          try {
            const parsed = new URL(returnUrl);
            target = parsed.pathname + (parsed.search || '') + (parsed.hash || '');
          } catch (e) {
            target = '/';
          }
        }
        target = target.replace(/https?:\/\/[^\/]+/i, '');
        if (!target.startsWith('/')) target = '/' + target;
        if (target.includes('__cookie_check')) target = '/';
      }
      window.location.replace(target);
    } catch (e) {
      window.location.replace('/');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
};

// Direct load for main landing page to eliminate render delay
import { Home } from './pages/Home';

const normalizeComparisonSlug = (val: string): string =>
  val.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

const MAIN_CATEGORY_NAMES = new Set(CATEGORIES.map((c) => normalizeComparisonSlug(c)));

const RESTAURANT_SUBCATEGORY_NAMES = new Set([
  'orleans',
  'kanata',
  'barrhaven',
  'downtown',
  ...LISTING_TYPES.map((t) => normalizeComparisonSlug(t)),
  ...CUISINES.map((c) => normalizeComparisonSlug(c)),
]);

const RESTAURANT_CATEGORY_NAMES = new Set([
  'restaurants',
  ...MAIN_CATEGORY_NAMES,
  ...RESTAURANT_SUBCATEGORY_NAMES,
]);

export function isRestaurantSubcategorySlug(rawSlug: string | undefined): boolean {
  if (!rawSlug) return true;
  try {
    const normalized = normalizeComparisonSlug(decodeURIComponent(rawSlug).replace(/-/g, ' '));
    return RESTAURANT_CATEGORY_NAMES.has(normalized);
  } catch {
    return false;
  }
}

let PreloadedListingDetail: React.ComponentType<any> | null = null;
let PreloadedNewsDetail: React.ComponentType<any> | null = null;
let PreloadedCategoryListings: React.ComponentType<any> | null = null;
let PreloadedListings: React.ComponentType<any> | null = null;
let PreloadedNews: React.ComponentType<any> | null = null;

export async function preloadInitialRoute(): Promise<void> {
  if (typeof window === 'undefined') return;
  const routeType = (window as any).__INITIAL_ROUTE_TYPE__;
  const pathname = window.location.pathname.replace(/\/+$/, '') || '/';
  const parts = pathname.split('/').filter(Boolean);

  try {
    if (
      routeType === 'listing' ||
      parts[0] === 'listings' && parts.length === 2 && parts[1] !== 'add' ||
      (parts[0] === 'restaurants' && parts.length === 2 && !isRestaurantSubcategorySlug(parts[1])) ||
      (parts.length === 2 && !['restaurants', 'news', 'author', 'authors', 'listings', 'profile', 'tools', 'go'].includes(parts[0]))
    ) {
      const m = await import('./pages/ListingDetail');
      PreloadedListingDetail = m.ListingDetail;
    } else if (
      routeType === 'news' ||
      (parts[0] === 'news' && parts.length === 2 && parts[1] !== 'add')
    ) {
      const m = await import('./pages/NewsDetail');
      PreloadedNewsDetail = m.NewsDetail;
    } else if (routeType === 'news_list' || pathname === '/news') {
      const m = await import('./pages/News');
      PreloadedNews = m.News;
    } else if (pathname === '/listings') {
      const m = await import('./pages/Listings');
      PreloadedListings = m.Listings;
    } else if (
      routeType === 'category' ||
      routeType === 'location' ||
      (parts.length >= 1 && isRestaurantSubcategorySlug(parts[parts.length - 1]))
    ) {
      const m = await import('./pages/CategoryListings');
      PreloadedCategoryListings = m.CategoryListings;
    }
  } catch {
    // Fallback to normal lazy loading
  }
}

// Lazy load secondary pages
const LazyListings = React.lazy(() => import('./pages/Listings').then(module => ({ default: module.Listings })));
const LazyCategoryListings = React.lazy(() => import('./pages/CategoryListings').then(module => ({ default: module.CategoryListings })));
const LazyListingDetail = React.lazy(() => import('./pages/ListingDetail').then(module => ({ default: module.ListingDetail })));
const AddListing = React.lazy(() => import('./pages/AddListing').then(module => ({ default: module.AddListing })));
const LazyNews = React.lazy(() => import('./pages/News').then(module => ({ default: module.News })));
const LazyNewsDetail = React.lazy(() => import('./pages/NewsDetail').then(module => ({ default: module.NewsDetail })));

const Listings: React.FC = (props) => {
  const Comp = PreloadedListings || LazyListings;
  return <Comp {...props} />;
};
const CategoryListings: React.FC = (props) => {
  const Comp = PreloadedCategoryListings || LazyCategoryListings;
  return <Comp {...props} />;
};
const ListingDetail: React.FC<{ overrideSlug?: string }> = (props) => {
  const Comp = PreloadedListingDetail || LazyListingDetail;
  return <Comp {...props} />;
};
const News: React.FC = (props) => {
  const Comp = PreloadedNews || LazyNews;
  return <Comp {...props} />;
};
const NewsDetail: React.FC = (props) => {
  const Comp = PreloadedNewsDetail || LazyNewsDetail;
  return <Comp {...props} />;
};

const RestaurantCategoryOrDetail: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  if (category) {
    try {
      const decoded = decodeURIComponent(category);
      const cleanAsciiSlug = normalizeComparisonSlug(decoded).replace(/\s+/g, '-');
      if (isRestaurantSubcategorySlug(category) && decoded !== cleanAsciiSlug) {
        return <Navigate to={`/restaurants/${cleanAsciiSlug}`} replace />;
      }
    } catch {
      // ignore malformed URI
    }
    if (!isRestaurantSubcategorySlug(category)) {
      return <ListingDetail overrideSlug={category} />;
    }
  }
  return <CategoryListings />;
};

const TopLevelCategoryOrRedirect: React.FC = () => {
  const { category } = useParams<{ category: string }>();
  if (category) {
    try {
      const normalized = normalizeComparisonSlug(decodeURIComponent(category).replace(/-/g, ' '));
      if (!MAIN_CATEGORY_NAMES.has(normalized) && RESTAURANT_SUBCATEGORY_NAMES.has(normalized)) {
        const cleanSlug = normalized.replace(/\s+/g, '-');
        return <Navigate to={`/restaurants/${cleanSlug}`} replace />;
      }
    } catch {
      // ignore malformed URI
    }
  }
  return <CategoryListings />;
};
const AddNews = React.lazy(() => import('./pages/AddNews').then(module => ({ default: module.AddNews })));
const EditListing = React.lazy(() => import('./pages/EditListing').then(module => ({ default: module.EditListing })));
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
const AuthorPage = React.lazy(() => import('./pages/AuthorPage').then(module => ({ default: module.AuthorPage })));
const NotFound = React.lazy(() => import('./pages/NotFound').then(module => ({ default: module.NotFound })));
const ShortLinkRedirect = React.lazy(() => import('./pages/ShortLinkRedirect').then(module => ({ default: module.ShortLinkRedirect })));

import ErrorBoundary from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';

import { HelmetProvider } from 'react-helmet-async';
import { safeLocalStorage } from './utils/safeStorage';

const Toaster = React.lazy(() => import('sonner').then(m => ({ default: m.Toaster })));

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
      if (!data || !data.faviconUrl) return;
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
  const isAllowedPublicPathInApp = ['/privacy-policy', '/terms', '/faq'].includes(location.pathname) || location.pathname.startsWith('/author');

  // In native mobile app wrappers, redirect to login only once auth check has resolved and user is not a guest
  if (isApp && !loading && !user && !isGuest && !isAuthPage && !isAllowedPublicPathInApp) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const routesElement = (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/restaurants" element={<CategoryListings />} />
        <Route path="/restaurants/:category" element={<RestaurantCategoryOrDetail />} />
        <Route path="/mosques" element={<CategoryListings />} />
        <Route path="/organizations" element={<CategoryListings />} />
        <Route path="/grocery" element={<CategoryListings />} />
        <Route path="/clothing" element={<CategoryListings />} />
        <Route path="/schools" element={<CategoryListings />} />
        <Route path="/butchers" element={<CategoryListings />} />
        <Route path="/qibla" element={<Navigate to="/tools/qibla" replace />} />
        <Route path="/:category" element={<TopLevelCategoryOrRedirect />} />
        <Route path="/listings/:slug" element={<ListingDetail />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:slug" element={<NewsDetail />} />
        <Route path="/author/:slug" element={<AuthorPage />} />
        <Route path="/author" element={<Navigate to="/author/youssef-agrebi" replace />} />
        <Route path="/authors/:slug" element={<Navigate to="/author/youssef-agrebi" replace />} />
        <Route path="/authors" element={<Navigate to="/author/youssef-agrebi" replace />} />
        <Route path="/events" element={<Navigate to="/" replace />} />
        <Route path="/events/*" element={<Navigate to="/" replace />} />
        <Route path="/jobs" element={<Navigate to="/" replace />} />
        <Route path="/jobs/*" element={<Navigate to="/" replace />} />
        <Route path="/:category/:slug" element={<ListingDetail />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/faq" element={<FAQ />} />
        <Route path="/tools/qibla" element={<QiblaDirection />} />
        
        {/* Protected Routes */}
        <Route path="/profile" element={<ProtectedRoute message="Sign in to view and manage your profile."><Profile /></ProtectedRoute>} />
        <Route path="/profile/edit" element={<ProtectedRoute message="Sign in to edit your profile."><EditProfile /></ProtectedRoute>} />
        <Route path="/saved" element={<ProtectedRoute message="Sign in to access your saved listings and news."><SavedItems /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute message="Sign in to manage your account settings."><Settings /></ProtectedRoute>} />
        <Route path="/listings/add" element={<ProtectedRoute message="Sign in to add a new listing to the community."><AddListing /></ProtectedRoute>} />
        <Route path="/listings/edit/:id" element={<ProtectedRoute message="Sign in to edit your listing."><EditListing /></ProtectedRoute>} />
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
  );

  return (
    <ErrorBoundary>
      {location.pathname === '/' ? (
        routesElement
      ) : (
        <Suspense fallback={
          <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
            <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
          </div>
        }>
          {routesElement}
        </Suspense>
      )}
    </ErrorBoundary>
  );
};

export default function App() {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <HelmetProvider>
      {hasMounted && (
        <Suspense fallback={null}>
          <Toaster position="top-center" richColors />
        </Suspense>
      )}
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </HelmetProvider>
  );
}
