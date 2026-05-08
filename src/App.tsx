import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Home } from './pages/Home';
import { Listings } from './pages/Listings';
import { CategoryListings } from './pages/CategoryListings';
import { ListingDetail } from './pages/ListingDetail';
import { AddListing } from './pages/AddListing';
import { News } from './pages/News';
import { NewsDetail } from './pages/NewsDetail';
import { Events } from './pages/Events';
import { EventDetail } from './pages/EventDetail';
import { AddEvent } from './pages/AddEvent';
import { Jobs } from './pages/Jobs';
import { JobDetail } from './pages/JobDetail';
import { AddJob } from './pages/AddJob';
import { AddNews } from './pages/AddNews';
import { EditListing } from './pages/EditListing';
import { EditEvent } from './pages/EditEvent';
import { EditJob } from './pages/EditJob';
import { EditNews } from './pages/EditNews';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { EditProfile } from './pages/EditProfile';
import { SavedItems } from './pages/SavedItems';
import { Settings } from './pages/Settings';
import { AdminDashboard } from './pages/AdminDashboard';
import { PrivacyPolicy } from './pages/PrivacyPolicy';
import { TermsOfService } from './pages/TermsOfService';
import { FAQ } from './pages/FAQ';
import { QiblaDirection } from './pages/QiblaDirection';
import ErrorBoundary from './components/ErrorBoundary';

import { useAuth } from './context/AuthContext';

import { HelmetProvider } from 'react-helmet-async';
import { Toaster } from 'sonner';

const AppContent: React.FC = () => {
  const { user, loading, isGuest } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
