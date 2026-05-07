import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { Listing, Event, Job, NewsArticle } from '../types';
import { Bookmark, Heart, Clock, ChevronRight, ChevronLeft, MapPin, Calendar, Briefcase, Newspaper, Trash2, Star, ExternalLink, FileText, Search } from 'lucide-react';
import { DEMO_LISTINGS, DEMO_EVENTS, DEMO_JOBS, DEMO_NEWS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl } from '../utils/url';
import { Helmet } from 'react-helmet-async';

export const SavedItems: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedListings, setSavedListings] = useState<Listing[]>([]);
  const [savedEvents, setSavedEvents] = useState<Event[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [savedNews, setSavedNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [unsavingId, setUnsavingId] = useState<string | null>(null);

  const fetchSavedContent = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const savedItemsQ = query(collection(db, 'saved_items'), where('userId', '==', user.uid));
      const savedItemsSnap = await getDocs(savedItemsQ);
      const savedItems = savedItemsSnap.docs.map(d => ({ docId: d.id, ...d.data() } as { docId: string; itemId: string; itemType: string; userId: string }));

      const fetchSavedDetails = async (type: string, collectionName: string, demoData: any[]) => {
        const typeItems = savedItems.filter(si => si.itemType === type);
        if (typeItems.length === 0) return [];

        const details = [];
        for (const si of typeItems) {
          const demoItem = demoData.find(d => d.id === si.itemId);
          if (demoItem) {
            details.push({ ...demoItem, savedDocId: si.docId });
          } else {
            try {
              const docSnap = await getDocs(query(collection(db, collectionName), where('__name__', '==', si.itemId)));
              if (!docSnap.empty) {
                details.push({ id: docSnap.docs[0].id, ...docSnap.docs[0].data(), savedDocId: si.docId });
              }
            } catch (e) {
              console.error(`Error fetching saved ${type} ${si.itemId}`, e);
            }
          }
        }
        return details;
      };

      const [sListings, sEvents, sJobs, sNews] = await Promise.all([
        fetchSavedDetails('listing', 'listings', DEMO_LISTINGS),
        fetchSavedDetails('event', 'events', DEMO_EVENTS),
        fetchSavedDetails('job', 'jobs', DEMO_JOBS),
        fetchSavedDetails('news', 'news', DEMO_NEWS)
      ]);

      setSavedListings(sListings as any[]);
      setSavedEvents(sEvents as any[]);
      setSavedJobs(sJobs as any[]);
      setSavedNews(sNews as any[]);
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'saved_items');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSavedContent();
  }, [user]);

  const handleUnsave = async (e: React.MouseEvent, savedDocId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!savedDocId) return;

    setUnsavingId(savedDocId);
    try {
      await deleteDoc(doc(db, 'saved_items', savedDocId));
      // Refresh content
      await fetchSavedContent();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `saved_items/${savedDocId}`);
    } finally {
      setUnsavingId(null);
    }
  };

  if (!user) return null;

  const renderItemCard = (item: any, type: string, isLast: boolean) => {
    const getTitle = () => item.name || item.title || 'Untitled';
    const getSubtitle = () => {
      if (type === 'listings') return Array.isArray(item.category as any) ? (item.category as any).join(', ') : item.category;
      if (type === 'events') return item.location;
      if (type === 'jobs') return item.company;
      return '';
    };
    const getLink = () => {
      if (type === 'listings') return getListingUrl(item);
      return `/${type}/${item.slug || item.id}`;
    };
    const getImage = () => {
      if (item.photos?.[0] && item.photos[0].trim() !== '') return item.photos[0];
      if (item.coverImage && item.coverImage.trim() !== '') return item.coverImage;
      if (item.companyLogo && item.companyLogo.trim() !== '') return item.companyLogo;
      if (item.logo && item.logo.trim() !== '') return item.logo;
      return `https://picsum.photos/seed/${item.id}/200/200`;
    };

    return (
      <Link 
        key={item.id} 
        to={getLink()}
        className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-50' : ''}`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
            {type === 'jobs' && !item.companyLogo ? (
              <Briefcase className="w-5 h-5 text-gray-400" />
            ) : (
              <img 
                src={(getImage()) || undefined} 
                alt={getTitle()} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <div className="text-left min-w-0">
            <h3 className="font-medium text-gray-700 truncate max-w-[200px] sm:max-w-xs">{getTitle()}</h3>
            <p className="text-xs text-gray-400 truncate max-w-[200px] sm:max-w-xs">{getSubtitle()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          <button
            onClick={(e) => handleUnsave(e, item.savedDocId)}
            disabled={unsavingId === item.savedDocId}
            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all active:scale-90"
            title="Unsave"
          >
            {unsavingId === item.savedDocId ? (
              <div className="w-4 h-4 border-2 border-red-50 border-t-red-500 rounded-full animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
          <div className="p-2 text-gray-300 hover:text-gray-700 transition-colors">
            <ChevronRight className="w-4 h-4" />
          </div>
        </div>
      </Link>
    );
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-12 animate-in fade-in duration-500">
      <Helmet>
        <title>Saved Items | Halal Ottawa</title>
        <meta name="description" content="View your saved listings, events, jobs, and news on Halal Ottawa." />
      </Helmet>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <h1 className="text-3xl font-bold">Saved Items</h1>

        {loading ? (
          <div className="py-20 flex flex-col items-center gap-4">
            <div className="w-10 h-10 border-4 border-red-50 border-t-[#e90b35] rounded-full animate-spin" />
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Loading your collection...</p>
          </div>
        ) : (
          <>
            {/* Saved Listings */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
                Saved Listings
              </h2>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {savedListings.map((item, idx) => renderItemCard(item, 'listings', idx === savedListings.length - 1))}
                {savedListings.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-gray-400 text-sm font-medium italic">No saved listings found.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Saved Events */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
                Saved Events
              </h2>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {savedEvents.map((item, idx) => renderItemCard(item, 'events', idx === savedEvents.length - 1))}
                {savedEvents.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-gray-400 text-sm font-medium italic">No saved events found.</p>
                  </div>
                )}
              </div>
            </section>

            {/* Saved Jobs */}
            <section className="space-y-3">
              <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
                Saved Jobs
              </h2>
              <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
                {savedJobs.map((item, idx) => renderItemCard(item, 'jobs', idx === savedJobs.length - 1))}
                {savedJobs.length === 0 && (
                  <div className="p-8 text-center">
                    <p className="text-gray-400 text-sm font-medium italic">No saved jobs found.</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
};
