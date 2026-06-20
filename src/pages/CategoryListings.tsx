import React, { useState, useEffect, useRef } from 'react';
import { Link, useParams, useLocation, useSearchParams } from 'react-router-dom';
import { MapPin, Star, Plus, Search, ChevronLeft, UtensilsCrossed, Globe, Compass, Info, ChevronDown, ChevronUp, Utensils } from 'lucide-react';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { Listing } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { CATEGORIES, DEMO_LISTINGS, LISTING_TYPES, CUISINES } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl, getAbsoluteUrl, formatAddressWithoutProvinceAndPostalCode } from '../utils/url';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SEO } from '../components/SEO';
import { NotFound } from './NotFound';
import { ListingDetail } from './ListingDetail';
import { isAppWrapper } from '../utils/platform';
import { getNeighborhoodFromAddress } from '../utils/geo';

const LOCATION_BOUNDARIES: Record<string, {
  headline: string;
  description: string;
  north: string;
  south: string;
  east: string;
  west: string;
  neighborhoods: string[];
}> = {
  downtown: {
    headline: "Downtown & Central Core",
    description: "The historical and cultural heart of Ottawa, boasting a dense mix of landmarks, government hubs, and multi-cultural dining pockets.",
    north: "Ottawa River (facing Gatineau)",
    south: "Queensway (Highway 417), extending south to include Centretown and the Glebe corridor",
    east: "Rideau Canal & Rideau River (encompassing Lowertown & Sandy Hill)",
    west: "Bronson Avenue & Preston Street corridor (including Chinatown & Little Italy)",
    neighborhoods: ["ByWard Market", "Centretown", "Sandy Hill", "Chinatown", "Little Italy", "The Glebe", "Lowertown"]
  },
  kanata: {
    headline: "Kanata & West End",
    description: "Ottawa's high-tech suburb that seamlessly merges modern residential infrastructure, major commercial centers, and dynamic business hubs.",
    north: "Richardson Ridge & March Road (High-tech corridor / Morgan's Grant)",
    south: "Hope Side Road & Trail Road (bordering Richmond / Bridlewood)",
    east: "Eagleson Road & the Ottawa Greenbelt (bordering Bells Corners/Bayshore)",
    west: "Terry Fox Drive & Stittsville boundary",
    neighborhoods: ["Bridlewood", "Beaverbrook", "Katimavik-Hazeldean", "Morgan's Grant", "Glen Cairn", "Kanata Lakes"]
  },
  barrhaven: {
    headline: "Barrhaven & South End",
    description: "A rapidly growing, family-friendly master community in Ottawa's southwest, defined by peaceful parks and vibrant commercial plazas.",
    north: "Fallowfield Road & the Greenbelt (bordering Nepean)",
    south: "Barnsdale Road & the flowing Jock River (bordering Manotick)",
    east: "Scenic Rideau River shores",
    west: "Cedarview Road & Highway 416 corridor",
    neighborhoods: ["Chapman Mills", "Stonebridge", "Half Moon Bay", "Longfields", "Davidson Heights"]
  },
  orleans: {
    headline: "Orléans & East End",
    description: "A vibrant, bilingual community in East Ottawa overlooking the Ottawa River, rich in French heritage and home to beautiful nature parks.",
    north: "Sands of Petrie Island & Ottawa River shores",
    south: "Wall Road & rural Innes Road pathways (bordering Blackburn Hamlet)",
    east: "Trim Road & Cardinal Creek region (bordering Cumberland)",
    west: "Shefford Road, Blair Road & the scenic Greenbelt",
    neighborhoods: ["Avalon", "Fallingbrook", "Convent Glen", "Chateauneuf", "Queenswood Heights", "Chapel Hill"]
  }
};

const getCleanCategoriesAndTags = (listing: any) => {
  const findCanonical = (val: string, list: readonly any[]): string | undefined => {
    const lower = val.toLowerCase().trim();
    return list.find(item => String(item).toLowerCase().trim() === lower);
  };

  const rawCategories = Array.isArray(listing.category) 
    ? listing.category 
    : (listing.category ? [listing.category] : []);
    
  const cleanCategories = Array.from(new Set(
    rawCategories
      .filter((cat: any) => typeof cat === 'string' && cat.trim() !== '')
      .map((cat: string) => findCanonical(cat, CATEGORIES))
      .filter(Boolean) as string[]
  ));
  
  const rawTypes = Array.isArray(listing.types) 
    ? listing.types 
    : (listing.types ? [listing.types] : []);
  const cleanTypes = Array.from(new Set(
    rawTypes
      .filter((t: any) => typeof t === 'string' && t.trim() !== '')
      .map((t: string) => findCanonical(t, LISTING_TYPES))
      .filter(Boolean) as string[]
  ));
  
  const rawCuisine = Array.isArray(listing.cuisine) 
    ? listing.cuisine 
    : (listing.cuisine ? [listing.cuisine] : []);
  const cleanCuisine = Array.from(new Set(
    rawCuisine
      .filter((c: any) => typeof c === 'string' && c.trim() !== '')
      .map((c: string) => findCanonical(c, CUISINES))
      .filter(Boolean) as string[]
  ));

  return {
    categories: cleanCategories.length > 0 ? cleanCategories : ['Organizations'],
    types: cleanTypes,
    cuisine: cleanCuisine
  };
};

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
  const matchedLocation = ['Orleans', 'Kanata', 'Barrhaven', 'Downtown'].find(l => l.toLowerCase() === rawFormattedCategory.toLowerCase());
  const isLocationCategory = !!matchedLocation;

  // Validate if it's a real category, listing type, cuisine, or location
  // Subcategories are only valid off /restaurants/ path, not root / path
  const isUnderRestaurants = pathname.startsWith('/restaurants') || pathname.startsWith('/restaurants/');
  const isValidCategory = isUnderRestaurants 
    ? (rawFormattedCategory.toLowerCase() === 'restaurants' || !!matchedType || !!matchedCuisine || isLocationCategory) 
    : isMainCategory;

  const formattedCategory = isMainCategory 
    ? (CATEGORIES.find(c => c.toLowerCase() === rawFormattedCategory.toLowerCase()) || rawFormattedCategory)
    : (matchedType || matchedCuisine || matchedLocation || rawFormattedCategory);
    
  // Calculate current month and year for SEO titles
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYearStr = `${currentMonth} ${currentYear}`;

  const h1Text = isLocationCategory ? (
    formattedCategory.toLowerCase() === 'downtown' 
      ? 'Halal Restaurants in Downtown Ottawa' 
      : `Halal Restaurants in ${formattedCategory}`
  ) :
   formattedCategory === 'Restaurants' ? 'Halal Restaurants in Ottawa' :
   formattedCategory === 'Mosques' ? 'Mosques in Ottawa' :
   formattedCategory === 'Grocery' ? 'Halal Grocery in Ottawa' :
   formattedCategory === 'Clothing' ? 'Islamic Clothing in Ottawa' :
   formattedCategory === 'Schools' ? 'Islamic Schools in Ottawa' :
   formattedCategory === 'Butchers' ? 'Halal Butchers in Ottawa' :
   formattedCategory === 'Organizations' ? 'Muslim Organizations in Ottawa' :
   matchedType ? `Halal ${formattedCategory} in Ottawa` :
   matchedCuisine ? `Halal ${formattedCategory} Restaurants in Ottawa` :
   `Halal ${formattedCategory} in Ottawa`;

  const pageTitle = `${h1Text} - ${monthYearStr}`;
  let seoDescription = `Explore the best halal ${formattedCategory} in Ottawa for ${monthYearStr}. Find top-rated places, read reviews, and discover local spots in the Ottawa Muslim community directory.`;

  if (isLocationCategory) {
    seoDescription = `Find the best verified halal restaurants and food spots in ${formattedCategory}, Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get directions.`;
  } else if (formattedCategory === 'Restaurants') {
    seoDescription = `Discover the best verified halal restaurants and food spots in Ottawa for ${monthYearStr}. Search by cuisine or food style, read verified reviews, and get maps directions.`;
  } else if (formattedCategory === 'Grocery') {
    seoDescription = `Find the best halal grocery stores, supermarkets, and specialty food shops in Ottawa offering certified halal products and ingredients for ${monthYearStr}.`;
  } else if (formattedCategory === 'Clothing') {
    seoDescription = `Explore trusted Islamic clothing stores and boutiques in Ottawa offering modest wear, hijabs, abayas, and thobes for ${monthYearStr}.`;
  } else if (formattedCategory === 'Schools') {
    seoDescription = `Browse accredited directories of Islamic schools, preschools, daycares, and weekend Quran educational programs in Ottawa for ${monthYearStr}.`;
  } else if (formattedCategory === 'Butchers') {
    seoDescription = `Find certified halal butcher shops and fresh meat markets in Ottawa providing premium hand-slaughtered zabihah meat for ${monthYearStr}.`;
  } else if (formattedCategory === 'Organizations') {
    seoDescription = `Connect with trusted Islamic organizations, community support networks, and local charities in Ottawa for ${monthYearStr}.`;
  } else if (formattedCategory === 'Mosques') {
    seoDescription = `Locate local mosques, musallahs, and Islamic prayer spaces around Ottawa. Find prayer times and Friday khutbah details for ${monthYearStr}.`;
  } else if (!isMainCategory && isValidCategory) {
    seoDescription = `Discover top-rated, certified halal ${formattedCategory} options in Ottawa for ${monthYearStr}. Find verified business locations, operating hours, phone info, and user reviews.`;
  }

  const [rawListings, setRawListings] = useState<Listing[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBoundaryDetails, setShowBoundaryDetails] = useState(true);
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

    let isMounted = true;

    const fetchListings = async () => {
      try {
        const q = query(collection(db, 'listings'));
        const snapshot = await getDocs(q);

        if (!isMounted) return;

        const firestoreListings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Listing[];
        
        // Filter client-side for better robustness (handles string vs array and pending vs approved)
        const filtered = firestoreListings.filter(l => {
          const listingCategories = Array.isArray(l.category) ? l.category : [l.category];
          const listingTypes = l.types || [];
          const listingCuisines = l.cuisine || [];

          if (isLocationCategory) {
            const computedNeighborhood = getNeighborhoodFromAddress(l.address || '', l.suburb || '');
            const matchesLocation = computedNeighborhood === formattedCategory.toLowerCase();
            const matchesCategory = listingCategories.some(cat => cat.toLowerCase() === 'restaurants');
            if (!(matchesLocation && matchesCategory)) return false;
          } else {
            const matchesCategory = listingCategories.some(cat => cat.toLowerCase() === formattedCategory.toLowerCase());
            const matchesType = listingTypes.some(t => t.toLowerCase() === formattedCategory.toLowerCase());
            const matchesCuisine = listingCuisines.some(c => c.toLowerCase() === formattedCategory.toLowerCase());
            
            if (!(matchesCategory || matchesType || matchesCuisine)) return false;
          }
          
          // Admin sees everything
          if (user?.role === 'admin') return true;
          
          // User sees approved listings OR their own pending listings
          return l.isApproved || (user && l.submittedBy === user.uid);
        });

        // Sort: Recent added ones first
        filtered.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        
        setRawListings(filtered);
      } catch (error) {
        if (isMounted) {
          handleFirestoreError(error, OperationType.LIST, 'listings');
        }
      }
    };

    fetchListings();

    return () => {
      isMounted = false;
    };
  }, [formattedCategory, user, isValidCategory, isLocationCategory]);

  const filteredListings = React.useMemo(() => {
    // Merge with demo data
    const allListings = [...rawListings, ...DEMO_LISTINGS.filter(l => {
        const cats = Array.isArray(l.category) ? l.category : [l.category];
        const types = l.types || [];
        const cuisines = l.cuisine || [];

        if (isLocationCategory) {
          const computedNeighborhood = getNeighborhoodFromAddress(l.address || '', l.suburb || '');
          const matchesLocation = computedNeighborhood === formattedCategory.toLowerCase();
          const matchesCategory = cats.some(cat => cat.toLowerCase() === 'restaurants');
          return matchesLocation && matchesCategory;
        }

        return cats.some(cat => cat.toLowerCase() === formattedCategory.toLowerCase()) || 
               types.some(t => t.toLowerCase() === formattedCategory.toLowerCase()) ||
               cuisines.some(c => c.toLowerCase() === formattedCategory.toLowerCase());
    })];
    
    // Sort allListings: Recent added ones first
    allListings.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
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

  const listings = filteredListings;

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title={pageTitle} 
        description={seoDescription} 
        canonicalUrl={`https://www.halalottawa.ca${pathname}`} 
        disableSuffix={true}
        structuredData={[
          {
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
          },
          ...(listings.length > 0 ? [{
            "@context": "https://schema.org",
            "@type": "ItemList",
            "name": `Halal ${formattedCategory} in Ottawa`,
            "url": `https://www.halalottawa.ca${pathname}`,
            "numberOfItems": listings.length,
            "itemListElement": listings.slice(0, 10).map((listing, index) => ({
              "@type": "ListItem",
              "position": index + 1,
              "name": listing.name,
              "url": `https://www.halalottawa.ca${getListingUrl(listing)}`
            }))
          } as any] : [])
        ]}
      />

      <div className="flex justify-between items-center">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">
          {formattedCategory.toLowerCase() === 'downtown' ? (
            <>
              <span className="hidden md:inline">Halal Restaurants in Downtown Ottawa</span>
              <span className="md:hidden">Halal Restaurants in Downtown</span>
            </>
          ) : (
            h1Text
          )}
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
            placeholder={
              isLocationCategory
                ? `Search halal restaurants in ${formattedCategory}...`
                : formattedCategory === 'Restaurants'
                ? 'Search halal restaurants, cafes, or cuisines in Ottawa...'
                : formattedCategory === 'Mosques'
                ? 'Search mosques or musallahs in Ottawa...'
                : formattedCategory === 'Grocery'
                ? 'Search halal grocery stores and markets...'
                : formattedCategory === 'Clothing'
                ? 'Search Islamic clothing stores and boutiques...'
                : formattedCategory === 'Schools'
                ? 'Search Islamic schools and learning centers...'
                : formattedCategory === 'Butchers'
                ? 'Search halal butcher shops and meat stores...'
                : formattedCategory === 'Organizations'
                ? 'Search Muslim community organizations in Ottawa...'
                : `Search halal ${formattedCategory.toLowerCase()} in Ottawa...`
            }
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
                  {getCleanCategoriesAndTags(listing).categories[0] || 'Listing'}
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
                      {formatAddressWithoutProvinceAndPostalCode(listing.address)}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {(() => {
                      const { categories, types, cuisine } = getCleanCategoriesAndTags(listing);
                      let tags = [...categories.slice(1)];
                      
                      if (categories.includes('Restaurants')) {
                        tags = [...tags, ...types, ...cuisine];
                      }
                      const cleanTags = Array.from(new Set(tags)).filter(Boolean);
                      
                      return cleanTags.slice(0, 2).map((tag: string, idx: number) => (
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
          {/* Browse by Location */}
          <section className="space-y-6 pt-8 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse by Location</h2>
              <p className="text-gray-500">Find the perfect halal spot near you by exploring top-rated restaurants across Ottawa's key neighborhoods and districts.</p>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { name: 'Orleans', desc: 'East End Dining' },
                { name: 'Kanata', desc: 'West End Hub' },
                { name: 'Barrhaven', desc: 'South End Eats' },
                { name: 'Downtown', desc: 'Urban Flavors' }
              ].map((item) => {
                const count = [...rawListings, ...DEMO_LISTINGS].filter(l => {
                  const cats = Array.isArray(l.category) ? l.category : [l.category];
                  const computedNeighborhood = getNeighborhoodFromAddress(l.address || '', l.suburb || '');
                  const matchesLocation = computedNeighborhood === item.name.toLowerCase();
                  const matchesCategory = cats.some(cat => cat.toLowerCase() === 'restaurants');
                  return matchesLocation && matchesCategory;
                }).length;
                
                const displayCount = count;
                
                return (
                  <Link
                    key={item.name}
                    to={`/restaurants/${item.name.toLowerCase()}`}
                    className="group flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-2xl hover:border-[#e90b35]/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] transition-colors group-hover:scale-105 duration-300">
                       <MapPin className="w-5 h-5" />
                    </div>
                    <div className="text-center">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-xs text-gray-500 mt-1">{displayCount} restaurant{displayCount !== 1 ? 's' : ''}</p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>

          {/* Browse by Food */}
          <section className="space-y-6 pt-8 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse by Food</h2>
              <p className="text-gray-500">Looking for a quick bite, sweet dessert, or specialty dish? Explore local food spots by their specific food offerings and styles.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {LISTING_TYPES.map((item) => {
                const count = [...rawListings, ...DEMO_LISTINGS].filter(l => (l.types?.includes(item as any) || l.category?.includes(item as any))).length;
                const displayCount = count;
                
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
          <section className="space-y-6 pt-8 pb-4">
            <div className="space-y-1">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Browse by Cuisine</h2>
              <p className="text-gray-500">Embark on a culinary journey and discover authentic halal restaurants featuring traditional flavors and recipes from around the globe.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {CUISINES.map((item) => {
                const count = [...rawListings, ...DEMO_LISTINGS].filter(l => (l.cuisine?.includes(item as any) || l.category?.includes(item as any))).length;
                const displayCount = count;
                
                return (
                  <Link
                    key={item}
                    to={`/restaurants/${item.toLowerCase()}`}
                    className="group flex flex-col items-center justify-center gap-3 py-8 px-4 bg-white border border-gray-100 rounded-2xl hover:border-[#e90b35]/20 hover:shadow-md transition-all duration-300"
                  >
                    <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] transition-colors">
                       <Utensils className="w-5 h-5" />
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
