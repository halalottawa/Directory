import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { MapPin, Star, Plus, Search, ChevronLeft } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Listing } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { CATEGORIES, DEMO_LISTINGS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl } from '../utils/url';
import { SEO } from '../components/SEO';

export const CategoryListings: React.FC = () => {
  const { user } = useAuth();
  const { category: paramCategory } = useParams<{ category: string }>();
  const { pathname } = useLocation();
  
  // Get category from param or from the first part of the pathname
  const categorySlug = paramCategory || pathname.split('/')[1];
  
  // Format category from slug (e.g., "restaurants" -> "Restaurants")
  const formattedCategory = categorySlug 
    ? categorySlug.charAt(0).toUpperCase() + categorySlug.slice(1).toLowerCase()
    : '';
    
  // Validate if it's a real category
  const isValidCategory = CATEGORIES.includes(formattedCategory as any);

  const [rawListings, setRawListings] = useState<Listing[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(() => {
    const page = searchParams.get('page');
    return page ? parseInt(page, 10) : 1;
  });
  const itemsPerPage = 18;

  useEffect(() => {
    const page = searchParams.get('page');
    setCurrentPage(page ? parseInt(page, 10) : 1);
  }, [searchParams]);

  const handlePageChange = (newPage: number) => {
    const newParams = new URLSearchParams(searchParams);
    if (newPage > 1) {
      newParams.set('page', newPage.toString());
    } else {
      newParams.delete('page');
    }
    setSearchParams(newParams);
  };

  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('page');
    setSearchParams(newParams);
  };

  useEffect(() => {
    if (!isValidCategory) return;

    // Fetch all listings for the category or all approved listings to filter client-side
    // This handles both string and array category fields and allows showing user's own pending listings
    const q = query(collection(db, 'listings'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreListings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];
      
      // Filter client-side for better robustness (handles string vs array and pending vs approved)
      const filtered = firestoreListings.filter(l => {
        const listingCategories = Array.isArray(l.category) ? l.category : [l.category];
        const matchesCategory = listingCategories.some(cat => cat.toLowerCase() === formattedCategory.toLowerCase());
        
        if (!matchesCategory) return false;
        
        // Admin sees everything
        if (user?.role === 'admin') return true;
        
        // User sees approved listings OR their own pending listings
        return l.isApproved || (user && l.submittedBy === user.uid);
      });

      // Sort: Featured first, then by date
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
  }, [formattedCategory, user, isValidCategory]);

  const filteredListings = React.useMemo(() => {
    // Merge with demo data
    const allListings = [...rawListings, ...DEMO_LISTINGS.filter(l => {
        const cats = Array.isArray(l.category) ? l.category : [l.category];
        return cats.includes(formattedCategory as any);
    })];
    
    // Sort allListings: Featured first, then by date
    allListings.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    
    let filtered = allListings;

    if (searchQuery) {
      filtered = filtered.filter(l => 
        l.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    return filtered;
  }, [rawListings, searchQuery, formattedCategory]);

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

  if (!isValidCategory) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">Category Not Found</h1>
          <p className="text-gray-500">The category you are looking for does not exist.</p>
          <Link to="/" className="inline-block bg-[#e90b35] text-white px-6 py-2 rounded-full font-bold">
            Go Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title={formattedCategory} 
        description={`Explore the best ${formattedCategory} in Ottawa. Find top-rated places in the local Muslim community directory.`} 
        canonicalUrl={`https://halalottawa.ca/${paramCategory}`} 
      />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">{formattedCategory}</h1>
        <Link 
          to="/listings/add" 
          className="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f]"
        >
          <Plus className="w-6 h-6 md:w-5 md:h-5" />
        </Link>
      </div>

      {/* Search & Tabs */}
      <div className="space-y-4">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder={`Search ${formattedCategory.toLowerCase()}...`}
            className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        <div className="flex md:flex-wrap gap-2 overflow-x-auto pb-2 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          <Link
            to="/listings"
            className="px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all bg-white text-gray-500 border border-gray-100"
          >
            All
          </Link>
          {CATEGORIES.map((cat) => (
            <Link
              key={cat}
              to={`/${cat.toLowerCase()}`}
              className={`px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                formattedCategory === cat ? 'bg-[#e90b35] text-white' : 'bg-white text-gray-500 border border-gray-100'
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
          currentListings.map((listing) => (
            <Link
              key={listing.id}
              to={getListingUrl(listing)}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col sm:flex-row transition-all group"
            >
              <div className="relative h-48 sm:w-48 sm:h-auto shrink-0">
                {listing.photos?.[0] ? (
                  <img src={(listing.photos[0]) || undefined} alt={listing.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" referrerPolicy="no-referrer" />
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
            <p className="text-gray-500">No {formattedCategory.toLowerCase()} found matching your criteria.</p>
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
