import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';

// Lazy load pages
const Home = React.lazy(() => import('./pages/Home').then(module => ({ default: module.Home })));
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

import ErrorBoundary from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';

import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  const { user, loading, isGuest } = useAuth();

  return (
    <ErrorBoundary>
      <Suspense fallback={
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/listings" element={<Listings />} />
          <Route path="/restaurants" element={<CategoryListings />} />
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
        </Route>
        
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Login />} />
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
