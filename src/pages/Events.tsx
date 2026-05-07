import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Plus, ChevronRight, User, Search, Clock, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Event } from '../types';
import { DEMO_EVENTS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatDate, formatTime } from '../utils/dateFormatter';
import { AdDisplay } from '../components/AdDisplay';
import { SEO } from '../components/SEO';

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

      // Sort client-side: Featured first, then by date (reverse chronological)
      firestoreEvents.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
      });

      // Merge with demo data
      const allEvents = [...firestoreEvents, ...DEMO_EVENTS];
      
      // Sort allEvents as well
      allEvents.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime();
      });
      const filtered = allEvents.filter(event => 
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

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalPages = Math.ceil(events.length / itemsPerPage);
  const currentEvents = events.slice(
    isMobile ? 0 : (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMobile) return;
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
  }, [isMobile, currentPage, totalPages]);

  // Reset page when searchQuery changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <SEO 
        title="Events" 
        description="Find upcoming Islamic events, meetups, classes, and halaqas in the Ottawa Muslim community." 
        canonicalUrl="https://halalottawa.com/events" 
      />

      <AdDisplay />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">Events</h1>
        <Link 
          to="/events/add" 
          className="bg-[#e90b35] text-white p-2 md:px-4 md:py-2 rounded-full md:rounded-xl shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center md:gap-2"
        >
          <Plus className="w-6 h-6 md:w-5 md:h-5" />
          <span className="hidden md:inline">Add Event</span>
        </Link>
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search events..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {currentEvents.map((event) => (
          <Link
            key={event.id}
            to={`/events/${event.slug || event.id}`}
            className="block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-50 group flex flex-col"
          >
            <div className="relative h-48 shrink-0">
              {event.coverImage && event.coverImage.trim() !== '' ? (
                <img src={(event.coverImage) || undefined} alt={event.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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
                <p className="flex items-center gap-3"><Calendar className="w-4 h-4 text-[#e90b35]" /> {formatDate(event.dateTime)} at {formatTime(event.dateTime)}</p>
              </div>
              <div className="pt-2 flex justify-between items-center">
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Infinite Scroll target for mobile */}
      {isMobile && currentPage < totalPages && (
        <div ref={observerTarget} className="h-10 w-full flex justify-center items-center py-4">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#e90b35] rounded-full animate-spin"></div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="hidden md:flex justify-center items-center gap-2 pt-8 pb-12">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
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
