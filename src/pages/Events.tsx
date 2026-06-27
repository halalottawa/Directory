import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Plus, ChevronRight, User, Search, Clock, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import { DEMO_EVENTS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatDate, formatTime, formatEventDates } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SEO } from '../components/SEO';
import { isAppWrapper } from '../utils/platform';

export const Events: React.FC = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState<Event[]>(DEMO_EVENTS);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 9;

  useEffect(() => {
    const q = user?.role === 'admin' 
      ? query(collection(db, 'events')) 
      : query(collection(db, 'events'), where('isApproved', '==', true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreEvents = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Event[];

      // Merge with demo data, deduplicating by ID or slug
      const mergedEventsMap = new Map<string, Event>();
      DEMO_EVENTS.forEach(item => mergedEventsMap.set(item.id, item));
      firestoreEvents.forEach(item => {
        mergedEventsMap.set(item.id, item);
        if (item.slug) {
          const demoItem = DEMO_EVENTS.find(d => d.slug === item.slug);
          if (demoItem) mergedEventsMap.delete(demoItem.id);
        }
      });
      const allEvents = Array.from(mergedEventsMap.values());
      
      // Sort: upcoming events nearest to today, then past events
      const nowMs = new Date().getTime();
      const upcomingEvents = allEvents.filter(e => new Date(e.dateTime).getTime() >= nowMs)
        .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
      const pastEvents = allEvents.filter(e => new Date(e.dateTime).getTime() < nowMs)
        .sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());
      
      const sortedAllEvents = [...upcomingEvents, ...pastEvents];

      const filtered = sortedAllEvents.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        event.location.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setEvents(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'events');
    });

    return () => unsubscribe();
  }, [searchQuery, user]);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(isAppWrapper());
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldUseInfiniteScroll = isMobile && isApp;

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const currentEvents = events.slice(
    shouldUseInfiniteScroll ? 0 : (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!shouldUseInfiniteScroll) return;
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && currentPage < totalPages) {
          setCurrentPage(prev => Math.min(prev + 1, totalPages));
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }
    return () => observer.disconnect();
  }, [shouldUseInfiniteScroll, currentPage, totalPages]);

  // Reset page when searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title="Halal Events in Ottawa - Halal Ottawa" 
        description="Discover upcoming Islamic lectures, halaqas, local seminars, fundraisers, festivals, and social networking meetups in the Ottawa Muslim community." 
        canonicalUrl="https://www.halalottawa.ca/events" 
        disableSuffix={true}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          "itemListElement": [
            {
              "@type": "ListItem",
              "position": 1,
              "name": "Home",
              "item": "https://www.halalottawa.ca"
            },
            {
              "@type": "ListItem",
              "position": 2,
              "name": "Events",
              "item": "https://www.halalottawa.ca/events"
            }
          ]
        }}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">Events</h1>
        <Link 
          to="/events/add" 
          className="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f]"
        >
          <Plus className="w-6 h-6 md:w-5 md:h-5" />
        </Link>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search upcoming community events, meetups, and classes in Ottawa..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {currentEvents.map((event, idx) => (
          <Link
            key={event.id}
            to={`/events/${event.slug || event.id}`}
            className="block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-50 group flex flex-col"
          >
            <div className="relative h-48 shrink-0">
              {event.coverImage && event.coverImage.trim() !== '' ? (
                <img 
                  src={getOptimizedImageUrl(event.coverImage, 400, 192)} 
                  alt={event.title} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  loading={idx < 3 ? "eager" : "lazy"}
                  fetchPriority={idx < 3 ? "high" : "auto"}
                  width="400"
                  height="192"
                  decoding="async"
                />
              ) : (
                <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                  <span className="text-gray-400 text-xs font-medium">No Image</span>
                </div>
              )}
              <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-lg text-center shadow-lg">
                <span className="block text-[10px] font-bold text-[#e90b35] uppercase">{new Date(event.dateTime).toLocaleString('default', { month: 'short' })}</span>
                <span className="block text-lg font-black leading-none">{new Date(event.dateTime).getDate()}</span>
              </div>
              {event.isFeatured && (
                <div className="absolute top-3 right-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>
              )}
              {!event.isApproved && (
                <div className="absolute top-10 right-3 bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Pending</div>
              )}
            </div>
            <div className="p-5 space-y-3">
              <h2 className="text-xl font-bold leading-tight group-hover:text-[#e90b35] transition-colors">{event.title}</h2>
              <div className="space-y-1 text-sm text-gray-500">
                <p className="flex items-center gap-3"><User className="w-4 h-4 text-[#e90b35]" /> {event.organizer}</p>
                <p className="flex items-center gap-3"><MapPin className="w-4 h-4 text-[#e90b35]" /> {event.location}</p>
                <p className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-[#e90b35]" /> 
                  {event.isMultiDay && event.endDate
                    ? `${formatEventDates(event.dateTime, event.isMultiDay, event.endDate)}`
                    : `${formatDate(event.dateTime)} at ${formatTime(event.dateTime)}`
                  }
                </p>
              </div>
              <div className="pt-2 flex justify-between items-center">
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Infinite Scroll target for mobile */}
      {shouldUseInfiniteScroll && currentPage < totalPages && (
        <div ref={observerTarget} className="h-10 w-full flex justify-center items-center py-4">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#e90b35] rounded-full animate-spin"></div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !shouldUseInfiniteScroll && (
        <div className="flex justify-center items-center gap-1.5 md:gap-2 pt-8 pb-12">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-1.5 md:gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-xl font-bold text-xs md:text-sm transition-all ${
                  currentPage === i + 1 
                    ? 'bg-[#e90b35] text-white shadow-lg shadow-red-200' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
        </div>
      )}
    </div>
  );
};
