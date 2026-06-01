import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { MapPin, Star, Plus, Search, ChevronLeft, UtensilsCrossed, Globe } from 'lucide-react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Listing } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { CATEGORIES, DEMO_LISTINGS, LISTING_TYPES, CUISINES } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl } from '../utils/url';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SEO } from '../components/SEO';
import { NotFound } from './NotFound';
import { ListingDetail } from './ListingDetail';
import { isAppWrapper } from '../utils/platform';

export const CategoryListings: React.FC = () => {
  const { user } = useAuth();
  const { category: paramCategory } = useParams<{ category: string }>();
  const { pathname } = useLocation();
  
  // Get category from param or from the first part of the pathname
  const categorySlug = paramCategory || pathname.split('/')[1];
  
  // Normalize category slug by decurling and removing hyphens (e.g. middle-eastern -> middle eastern)
  const cleanCategorySlug = categorySlug 
    ? decodeURIComponent(categorySlug).replace(/-/g, ' ')
    : '';
  
  // Format category from slug (e.g., "restaurants" -> "Restaurants")
  const rawFormattedCategory = cleanCategorySlug 
    ? cleanCategorySlug.charAt(0).toUpperCase() + cleanCategorySlug.slice(1).toLowerCase()
    : '';
    
  const isMainCategory = CATEGORIES.map(c => c.toLowerCase()).includes(rawFormattedCategory.toLowerCase());
  const matchedType = LISTING_TYPES.find(t => t.toLowerCase() === rawFormattedCategory.toLowerCase());
  const matchedCuisine = CUISINES.find(c => c.toLowerCase() === rawFormattedCategory.toLowerCase());

  // Validate if it's a real category, listing type, or cuisine
  const isValidCategory = isMainCategory || !!matchedType || !!matchedCuisine;

  const formattedCategory = isMainCategory 
    ? (CATEGORIES.find(c => c.toLowerCase() === rawFormattedCategory.toLowerCase()) || rawFormattedCategory)
    : (matchedType || matchedCuisine || rawFormattedCategory);
    
  // Calculate current month and year for SEO titles
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYearStr = `${currentMonth} ${currentYear}`;

  let pageTitle = `${formattedCategory}`;
  let seoDescription = `Explore the best halal ${formattedCategory} in Ottawa. Find top-rated places, read reviews, and discover local spots in the Ottawa Muslim community directory.`;

  if (formattedCategory === 'Restaurants') {
    pageTitle = `Halal Restaurants in Ottawa - ${monthYearStr}`;
    seoDescription = "Discover the best verified halal restaurants and food spots in Ottawa. Search by cuisine or food type, read verified reviews, and get directions.";
  } else if (formattedCategory === 'Grocery') {
    pageTitle = `Halal Grocery Stores in Ottawa - ${monthYearStr}`;
    seoDescription = "Find the best halal grocery stores, supermarkets, and specialty food shops in Ottawa offering certified halal products and international ingredients.";
  } else if (formattedCategory === 'Clothing') {
    pageTitle = `Islamic Clothing in Ottawa - ${monthYearStr}`;
    seoDescription = "Explore trusted Islamic clothing stores and boutiques in Ottawa offering modest wear, hijabs, abayas, thobes, and daily apparel for the family.";
  } else if (formattedCategory === 'Schools') {
    pageTitle = `Islamic Schools in Ottawa - ${monthYearStr}`;
    seoDescription = "Browse directories of Islamic schools, preschools, and educational institutions in Ottawa offering academic excellence and Islamic values.";
  } else if (formattedCategory === 'Butchers') {
    pageTitle = `Halal Meat in Ottawa - ${monthYearStr}`;
    seoDescription = "Find trusted halal butcher shops and meat markets in Ottawa providing fresh, premium hand-slaughtered zabihah halal chicken, beef, lamb, and goat.";
  } else if (formattedCategory === 'Organizations') {
    pageTitle = `Muslim Organizations in Ottawa - ${monthYearStr}`;
    seoDescription = "Connect with Ottawa's Islamic organizations, community groups, charitable societies, and family services supporting the local Muslim community.";
  } else if (formattedCategory === 'Mosques') {
    pageTitle = `Mosques in Ottawa - ${monthYearStr}`;
    seoDescription = "Find mosques, Islamic centers, and prayer places (musallas) in Ottawa, including prayer times, Friday khutbah details, and community events.";
  } else if (!isMainCategory && isValidCategory) {
    if (matchedCuisine) {
      pageTitle = `Halal ${formattedCategory} Restaurants in Ottawa - ${monthYearStr}`;
      seoDescription = `Find top-rated halal ${formattedCategory} restaurants in Ottawa. Explore authentic ${formattedCategory} dishes, read reviews, and find directions to local favorites.`;
    } else {
      pageTitle = `Halal ${formattedCategory} in Ottawa - ${monthYearStr}`;
      if (matchedType) {
        seoDescription = `Discover the best spots for halal ${formattedCategory} in Ottawa. Find delicious halal ${formattedCategory} options near you, complete with reviews, addresses, and hours.`;
      }
    }
  } else {
    pageTitle = `Halal ${formattedCategory} in Ottawa - ${monthYearStr}`;
  }

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

    // Build targeted query depending on the facet type to fetch from firestore efficiently
    let q = query(collection(db, 'listings'));
    if (isMainCategory) {
      q = query(collection(db, 'listings'), where('category', 'array-contains', formattedCategory));
    } else if (matchedType) {
      q = query(collection(db, 'listings'), where('types', 'array-contains', formattedCategory));
    } else if (matchedCuisine) {
      q = query(collection(db, 'listings'), where('cuisine', 'array-contains', formattedCategory));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreListings = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Listing[];
      
      // Filter client-side for better robustness (handles string vs array and pending vs approved)
      const filtered = firestoreListings.filter(l => {
        const listingCategories = Array.isArray(l.category) ? l.category : [l.category];
        const listingTypes = l.types || [];
        const listingCuisines = l.cuisine || [];

        const matchesCategory = listingCategories.some(cat => cat.toLowerCase() === formattedCategory.toLowerCase());
        const matchesType = listingTypes.some(t => t.toLowerCase() === formattedCategory.toLowerCase());
        const matchesCuisine = listingCuisines.some(c => c.toLowerCase() === formattedCategory.toLowerCase());
        
        if (!(matchesCategory || matchesType || matchesCuisine)) return false;
        
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
        const types = l.types || [];
        const cuisines = l.cuisine || [];
        return cats.some(cat => cat.toLowerCase() === formattedCategory.toLowerCase()) || 
               types.some(t => t.toLowerCase() === formattedCategory.toLowerCase()) ||
               cuisines.some(c => c.toLowerCase() === formattedCategory.toLowerCase());
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

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(isAppWrapper());
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldUseInfiniteScroll = isMobile && isApp;

  const totalPages = Math.ceil(filteredListings.length / itemsPerPage);
  const currentListings = filteredListings.slice(
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

  if (!isValidCategory) {
    return <ListingDetail overrideSlug={categorySlug} />;
  }

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title={pageTitle} 
        description={seoDescription} 
        canonicalUrl={`https://www.halalottawa.ca${pathname}`} 
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
              "name": formattedCategory,
              "item": `https://www.halalottawa.ca/${paramCategory || pathname.split('/')[1]}`
            }
          ]
        }}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
          {formattedCategory === 'Restaurants' ? 'Halal Restaurants in Ottawa' :
           formattedCategory === 'Mosques' ? 'Mosques in Ottawa' :
           formattedCategory === 'Grocery' ? 'Halal Grocery in Ottawa' :
           formattedCategory === 'Clothing' ? 'Islamic Clothing in Ottawa' :
           formattedCategory === 'Schools' ? 'Islamic Schools in Ottawa' :
           formattedCategory === 'Butchers' ? 'Halal Butchers in Ottawa' :
           formattedCategory === 'Organizations' ? 'Muslim Organizations in Ottawa' :
           matchedCuisine ? `Halal ${formattedCategory} Restaurants in Ottawa` :
           formattedCategory}
        </h1>
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
          currentListings.map((listing, idx) => (
            <Link
              key={listing.id}
              to={getListingUrl(listing)}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col sm:flex-row transition-all group"
            >
              <div className="relative h-48 sm:w-48 sm:h-auto shrink-0">
                {listing.photos?.[0] ? (
                  <img 
                    src={getOptimizedImageUrl(listing.photos[0], 400, 192)} 
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
                  <div className="text-gray-500 text-sm mt-1 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-3">
                      <MapPin className="w-4 h-4 text-[#e90b35]" />
                      {listing.address}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const allCategories = Array.isArray(listing.category as any) ? (listing.category as any) : [listing.category].filter(Boolean);
                      let tags = [...allCategories.slice(1)];
                      
                      if (allCategories.includes('Restaurants')) {
                        if (listing.types?.length) tags = [...tags, ...listing.types];
                        if (listing.cuisine?.length) tags = [...tags, ...listing.cuisine];
                      }
                      
                      return tags.slice(0, 2).map((tag: string, idx: number) => (
                        <span key={`tag-${idx}`} className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase">
                          {tag}
                        </span>
                      ));
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
      {shouldUseInfiniteScroll && currentPage < totalPages && (
        <div ref={observerTarget} className="h-10 w-full flex justify-center items-center py-4">
          <div className="w-6 h-6 border-2 border-gray-300 border-t-[#e90b35] rounded-full animate-spin"></div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && !shouldUseInfiniteScroll && (
        <div className="flex justify-center items-center gap-1.5 md:gap-2 pt-8 pb-12">
          <button
            onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
            disabled={currentPage === 1}
            className="p-2 border border-gray-100 rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
          
          <div className="flex items-center gap-1.5 md:gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => handlePageChange(i + 1)}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-xl font-bold text-xs md:text-sm transition-all ${
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

      {/* Categories for Restaurants */}
      {formattedCategory === 'Restaurants' && (
        <div className="mt-12 space-y-12">
          {/* Browse by Food Type */}
          <section className="hidden md:block space-y-6 pt-8 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse by Food Type</h2>
              <p className="text-gray-500">Explore businesses by what they offer</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {LISTING_TYPES.map((item) => {
                const count = [...rawListings, ...DEMO_LISTINGS].filter(l => (l.types?.includes(item as any) || l.category?.includes(item as any))).length;
                const displayCount = count > 0 ? count : Math.floor(Math.random() * 50) + 1; // Fake count for demo if real count is 0
                
                return (
                  <Link
                    key={item}
                    to={`/restaurants/${item.toLowerCase()}`}
                    className="group flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-2xl hover:border-[#e90b35]/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] transition-colors">
                       <UtensilsCrossed className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900">{item}</h3>
                      <p className="text-xs text-gray-500 mt-1">{displayCount} listing{displayCount !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Browse by Cuisine */}
          <section className="hidden md:block space-y-6 pt-8 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse by Cuisine</h2>
              <p className="text-gray-500">Discover flavors from around the world</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CUISINES.map((item) => {
                const count = [...rawListings, ...DEMO_LISTINGS].filter(l => (l.cuisine?.includes(item as any) || l.category?.includes(item as any))).length;
                const displayCount = count > 0 ? count : Math.floor(Math.random() * 50) + 1; // Fake count for demo if real count is 0
                
                return (
                  <Link
                    key={item}
                    to={`/restaurants/${item.toLowerCase()}`}
                    className="group flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-2xl hover:border-[#e90b35]/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] transition-colors">
                       <Globe className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900">{item}</h3>
                      <p className="text-xs text-gray-500 mt-1">{displayCount} listing{displayCount !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
