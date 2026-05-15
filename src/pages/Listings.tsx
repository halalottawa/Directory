import React, { useState, useEffect, useRef } from 'react';
import { Link, useSearchParams, useParams, useLocation } from 'react-router-dom';
import { MapPin, Star, Filter, Plus, Search, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Listing } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { AdDisplay } from '../components/AdDisplay';
import { CATEGORIES, DEMO_LISTINGS, LISTING_TYPES, CUISINES } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl } from '../utils/url';
import { SEO } from '../components/SEO';

export const Listings: React.FC = () => {
  const { user } = useAuth();
  const { subcategory } = useParams();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rawListings, setRawListings] = useState<Listing[]>([]);
  const itemsPerPage = 18;
  const [activeCategories, setActiveCategories] = useState<string[]>(() => {
    const cats = searchParams.getAll('category');
    return cats.length > 0 ? cats : ['All'];
  });
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? parseInt(page, 10) : 1;
  });

  // Sync searchParams with state
  useEffect(() => {
    const cats = searchParams.getAll('category');
    setActiveCategories(cats.length > 0 ? cats : ['All']);
    const search = searchParams.get('search') || '';
    setSearchQuery(search);
    const page = searchParams.get('page');
    setCurrentPage(page ? parseInt(page, 10) : 1);
  }, [searchParams, location.pathname, subcategory]);

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set('page', newPage.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  const handleCategoryChange = (category: string) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('category');
    newParams.delete('page');
    
    if (category !== 'All') {
      newParams.set('category', category);
    }
    
    setSearchParams(newParams);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    if (!query) {
      newParams.delete('search');
    } else {
      newParams.set('search', query);
    }
    setSearchParams(newParams);
  };

  useEffect(() => {
    const q = query(collection(db, 'listings'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreListings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];

      // Filter client-side for better robustness
      const filtered = firestoreListings.filter(l => {
        // Admin sees everything
        if (user?.role === 'admin') return true;
        
        // User sees approved listings OR their own pending listings
        return l.isApproved || (user && l.submittedBy === user.uid);
      });

      // Sort client-side: Featured first, then by date
      filtered.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setRawListings(filtered);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'listings');
    });

    return () => unsubscribe();
  }, [user]);

  const filteredListings = React.useMemo(() => {
    // Merge with demo data
    const allListings = [...rawListings, ...DEMO_LISTINGS];
    
    // Sort allListings: Featured first, then by date
    allListings.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    // Filter by category and search query
    let filtered = allListings;
    
    if (!activeCategories.includes('All')) {
      filtered = filtered.filter(l => {
        const listingCategories = Array.isArray(l.category as any) ? (l.category as any) : [l.category];
        return activeCategories.some(cat => listingCategories.includes(cat as any));
      });
    }

    if (searchQuery) {
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [rawListings, activeCategories, searchQuery, user]);

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const currentListings = filteredListings.slice(
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

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title="Listings" 
        description="Browse our comprehensive directory of Halal businesses, organizations, and places in the Ottawa Muslim community." 
        canonicalUrl="https://www.halalottawa.ca/listings" 
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
              "name": "Listings",
              "item": "https://www.halalottawa.ca/listings"
            }
          ]
        }}
      />

      <AdDisplay />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">Listings</h1>
        <Link 
          to="/listings/add" 
          className="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f]"
        >
          <Plus className="w-6 h-6 md:w-5 md:h-5" />
        </Link>
      </div>

      {/* Search & Filter */}
      <div className="space-y-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search listings..."
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex md:flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <Link
            to="/listings"
            className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all ${
              activeCategories.includes('All') ? 'bg-[#e90b35] text-white' : 'bg-white text-gray-500 border border-gray-100'
            }`}
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/${cat.toLowerCase()}`}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                activeCategories.includes(cat) ? 'bg-[#e90b35] text-white' : 'bg-white text-gray-500 border border-gray-100'
              }`}
            >
              <CategoryIcon category={cat as any} className="w-4 h-4" />
              {cat}
            </Link>
          ))}
        </div>
      </div>

      {/* Listings Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-2 gap-4 md:gap-6">
        {currentListings.length > 0 ? (
          currentListings.map((listing, idx) => (
            <Link
              key={listing.id}
              to={getListingUrl(listing)}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col sm:flex-row transition-all group"
            >
              <div className="relative h-48 sm:w-48 sm:h-auto shrink-0">
                {listing.photos?.[0] ? (
                  <img 
                    src={(listing.photos[0]) || undefined} 
                    alt={listing.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    referrerPolicy="no-referrer" 
                    loading={idx < 4 ? "eager" : "lazy"}
                    fetchPriority={idx < 4 ? "high" : "auto"}
                    width="400"
                    height="192"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs font-medium">No Image</span>
                  </div>
                )}
                <div className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-[#e90b35] bg-red-50 border border-red-100 px-2 py-1 rounded-md shadow-md backdrop-blur-md bg-opacity-95">
                  {Array.isArray(listing.category as any) ? (listing.category as any)[0] : listing.category}
                </div>
                {listing.isFeatured && (
                  <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>
                )}
                {!listing.isApproved && (
                  <div className="absolute top-10 right-3 bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Pending</div>
                )}
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h2 className="font-bold text-lg leading-tight">{listing.name}</h2>
                    <div className="flex items-center gap-1 text-xs font-bold bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {listing.averageRating}
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm mt-1 flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-[#e90b35]" />
                    {listing.address}
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const allCategories = Array.isArray(listing.category as any) ? (listing.category as any) : [listing.category].filter(Boolean);
                      return (
                        <>
                          {allCategories.map((cat: string, idx: number) => (
                            <span key={`cat-${idx}`} className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase">
                              {cat}
                            </span>
                          ))}
                          {allCategories.includes('Restaurants') && (
                            <>
                              {listing.types?.map((type, index) => (
                                <span key={`type-${index}`} className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
                                  {type}
                                </span>
                              ))}
                              {listing.cuisine?.map((c, index) => (
                                <span key={`cuisine-${index}`} className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
                                  {c}
                                </span>
                              ))}
                            </>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="mt-4 flex justify-between items-center">
                  <span className="text-xs text-gray-400">{listing.reviewCount} reviews</span>
                </div>
              </div>
            </Link>
          ))
        ) : (
          <div className="text-center py-12 space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto text-gray-400">
              <Search className="w-8 h-8" />
            </div>
            <p className="text-gray-500">No listings found matching your criteria.</p>
          </div>
        )}
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
            onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                  currentPage === i + 1 
                    ? 'bg-[#e90b35] text-white' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
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
