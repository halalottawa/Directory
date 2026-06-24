import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Phone, Clock, Star, ShieldCheck, ChevronLeft, ChevronRight, MessageSquare, Edit2, Trash2, Mail, Globe, X, FileText, Send } from 'lucide-react';
import { doc, getDoc, collection, query, where, getDocs, addDoc, deleteDoc, updateDoc, onSnapshot, limit } from 'firebase/firestore';
import { db, getGeneralSettings } from '../firebase';
import { Listing, Review } from '../types';
import { useAuth } from '../context/AuthContext';
import { DEMO_LISTINGS, CATEGORIES, LISTING_TYPES, CUISINES } from '../constants';
import L from 'leaflet';

import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl, getAbsoluteUrl, formatAddressWithoutProvinceAndPostalCode } from '../utils/url';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SaveButton } from '../components/SaveButton';
import { OpenStreetMap } from '../components/OpenStreetMap';
import { SEO } from '../components/SEO';
import { NotFound } from './NotFound';
import { toast } from 'sonner';
import { BeehiivEmbed } from '../components/BeehiivEmbed';

// Custom inline SVG social icons for zero bundle-size cost
const FaInstagram: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
  </svg>
);

const FaFacebook: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

const FaTwitter: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" />
  </svg>
);

const FaTiktok: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
  </svg>
);

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

interface ListingDetailProps {
  overrideSlug?: string;
}

export const ListingDetail: React.FC<ListingDetailProps> = ({ overrideSlug }) => {
  const DAY_ORDER = ['Mo','Tu','We','Th','Fr','Sa','Su'];
  const dayMap: Record<string, string> = {
    Mo: 'Monday', Tu: 'Tuesday', We: 'Wednesday', Th: 'Thursday',
    Fr: 'Friday', Sa: 'Saturday', Su: 'Sunday'
  };
  const expandDays = (dayStr: string): string[] => {
    if (dayStr.includes('-')) {
      const [start, end] = dayStr.split('-');
      const startIdx = DAY_ORDER.indexOf(start.trim());
      const endIdx = DAY_ORDER.indexOf(end.trim());
      if (startIdx === -1 || endIdx === -1) return [];
      return DAY_ORDER.slice(startIdx, endIdx + 1)
        .map(d => `https://schema.org/${dayMap[d]}`);
    }
    return dayStr.split(',').map(d => `https://schema.org/${dayMap[d.trim()] || d.trim()}`);
  };

  const { slug: urlSlug } = useParams<{ slug: string }>();
  const slug = overrideSlug || urlSlug;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [listing, setListing] = useState<Listing | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_ROUTE_TYPE__ === 'listing') {
      const initData = (window as any).__INITIAL_DATA__ as Listing;
      if (initData && (initData.slug === slug || initData.id === slug)) {
        return initData;
      }
    }
    return null;
  });
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(listing === null);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [reviewSuccess, setReviewSuccess] = useState(false);
  const [editingReview, setEditingReview] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [relatedListings, setRelatedListings] = useState<Listing[]>([]);
  const [settingsCoverUrl, setSettingsCoverUrl] = useState<string>('');

  useEffect(() => {
    getGeneralSettings().then((data) => {
      if (data && data.coverImageUrl) {
        setSettingsCoverUrl(data.coverImageUrl);
      }
    });
  }, []);

  // Contact Info Modal state
  const [infoModal, setInfoModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    content: null
  });
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalConfig, setModalConfig] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    title: '',
    message: '',
    onConfirm: () => {}
  });

  useEffect(() => {
    const fetchListing = async () => {
      if (!slug) return;
      
      // Check demo listings first
      const found = DEMO_LISTINGS.find(l => l.id === slug || l.slug === slug);
      if (found) {
        setListing(found);
        setLoading(false);
        return;
      }

      // Fetch from Firestore
      try {
        let docSnap = await getDoc(doc(db, 'listings', slug));
        let listingData: Listing | null = null;
        
        if (docSnap.exists()) {
          listingData = { id: docSnap.id, ...docSnap.data() } as Listing;
        } else {
          const q = query(collection(db, 'listings'), where('slug', '==', slug));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            docSnap = querySnapshot.docs[0];
            listingData = { id: docSnap.id, ...docSnap.data() } as Listing;
          }
        }
        
        if (!listingData) {
          const redirectSnap = await getDoc(doc(db, 'slug_redirects', `listings_${slug}`));
          if (redirectSnap.exists()) {
            const rData = redirectSnap.data();
            if (rData && rData.newSlug) {
              let destination = `/listings/${rData.newSlug}`;
              try {
                const newDocRef = doc(db, 'listings', rData.newSlug);
                const newDocSnap = await getDoc(newDocRef);
                let newListing: any = null;
                if (newDocSnap.exists()) {
                  newListing = { id: newDocSnap.id, ...newDocSnap.data() };
                } else {
                  const q = query(collection(db, 'listings'), where('slug', '==', rData.newSlug), limit(1));
                  const snap = await getDocs(q);
                  if (!snap.empty) {
                    newListing = { id: snap.docs[0].id, ...snap.docs[0].data() };
                  }
                }
                if (newListing) {
                  const cat = Array.isArray(newListing.category) ? newListing.category[0] : newListing.category;
                  if (cat) {
                    destination = `/${cat.toLowerCase()}/${rData.newSlug}`;
                  }
                }
              } catch (e) {
                console.error("Error determining navigation category", e);
              }
              navigate(destination, { replace: true });
              return;
            }
          }
        }

        if (listingData) {
          setListing(listingData);
          
          // Fetch reviews with real-time updates
          const reviewsRef = user?.role === 'admin'
            ? query(collection(db, 'reviews'), where('listingId', '==', listingData.id))
            : query(collection(db, 'reviews'), where('listingId', '==', listingData.id), where('isApproved', '==', true));

          const unsubscribe = onSnapshot(reviewsRef, (snapshot) => {
            const reviewsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Review));
            // Only show approved reviews unless user is admin or the author
            const filteredReviews = reviewsData.filter(r => 
              r.isApproved || user?.role === 'admin' || r.userId === user?.uid
            );
            setReviews(filteredReviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
          }, (err) => {
            handleFirestoreError(err, OperationType.GET, 'reviews');
          });
          
          return () => unsubscribe();
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `listings/${slug}`);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [slug, user]);

  useEffect(() => {
    const fetchRelatedListings = async () => {
      if (!listing) return;

      try {
        const currentCategories = Array.isArray(listing.category) ? listing.category : [listing.category];
        const primaryCat = currentCategories[0] || 'Restaurants';

        const q = query(
          collection(db, 'listings'),
          where('isApproved', '==', true),
          where('category', 'array-contains', primaryCat),
          limit(12)
        );
        const querySnapshot = await getDocs(q);
        const allFirestore = querySnapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as Listing))
          .filter(l => l.id !== listing.id);

        const allDemo = DEMO_LISTINGS.filter(l => l.id !== listing.id && l.id !== slug);

        const allListings = [...allFirestore, ...allDemo];
        const uniqueListings = Array.from(new Map(allListings.map(item => [item.id, item])).values());

        // Find listings that share at least one category with the current listing
        const related = uniqueListings.filter(l => {
          const lCategories = Array.isArray(l.category) ? l.category : [l.category];
          return lCategories.some(c => currentCategories.includes(c));
        });

        // Sort by averageRating prioritizing highly rated, and take 4
        const sortedRelated = related.sort((a, b) => {
             const aRating = a.averageRating || 0;
             const bRating = b.averageRating || 0;
             return bRating - aRating;
        }).slice(0, 4);

        setRelatedListings(sortedRelated);
      } catch(err) {
        console.error("Error fetching related listings:", err);
        
        // Fallback to demo data
        const currentCategories = Array.isArray(listing.category) ? listing.category : [listing.category];
        const relatedDemo = DEMO_LISTINGS.filter(l => l.id !== listing.id && l.id !== slug)
          .filter(l => {
            const lCategories = Array.isArray(l.category) ? l.category : [l.category];
            return lCategories.some(c => currentCategories.includes(c));
          })
          .sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0))
          .slice(0, 4);
          
        setRelatedListings(relatedDemo);
      }
    };

    fetchRelatedListings();
  }, [listing?.id, listing?.category, slug]);

  const onClaim = () => {
    if (!user) {
      navigate('/login', { 
        state: { 
          from: window.location.pathname,
          message: 'Please sign in to claim this listing.'
        } 
      });
      return;
    }
    setShowClaimModal(true);
  };

  const onEdit = () => {
    if (!listing) return;
    navigate(`/listings/edit/${listing.id}`);
  };

  const onDelete = () => {
    setModalConfig({
      title: 'Delete Listing',
      message: `Are you sure you want to delete "${listing?.name}"? This action cannot be undone.`,
      onConfirm: confirmDelete
    });
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!listing) return;
    try {
      await deleteDoc(doc(db, 'listings', listing.id));
      navigate('/listings');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `listings/${listing.id}`);
    }
  };

  const handleInfoClick = (title: string, content: string, icon: React.ReactNode, actionLabel?: string, onAction?: () => void, hideValue?: boolean) => {
    setInfoModal({
      isOpen: true,
      title,
      content: (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35]">
            {icon}
          </div>
          {!hideValue && (
            <p className="text-[13px] font-semibold text-gray-900 text-center break-all px-4">{content}</p>
          )}
          <div className="flex flex-col gap-2 w-full px-8">
            {onAction && actionLabel && (
              <button 
                onClick={() => {
                  onAction();
                  setInfoModal(prev => ({ ...prev, isOpen: false }));
                }}
                className="w-full py-3 bg-[#e90b35] text-white font-bold rounded-xl active:scale-95 transition-all text-sm shadow-lg shadow-red-100"
              >
                {actionLabel}
              </button>
            )}
          </div>
        </div>
      )
    });
  };

  const openInMaps = () => {
    if (!listing?.address) return;
    const cleanAddress = listing.address.replace(/(?:Unit|Apt|Suite|#|Room)\s*[A-Za-z0-9\-]+/gi, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim();
    const url = `https://www.openstreetmap.org/search?query=${encodeURIComponent(cleanAddress)}`;
    window.open(url, '_blank');
  };

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { 
        state: { 
          from: window.location.pathname,
          message: 'Please sign in to share your experience and leave a review.'
        } 
      });
      return;
    }
    if (!newReview.comment.trim()) return;

    setIsSubmitting(true);
    try {
      const reviewData: any = {
        listingId: listing.id,
        userId: user.uid,
        userName: user.name,
        rating: newReview.rating,
        comment: newReview.comment,
        isApproved: false, // Reviews require admin approval
        createdAt: new Date().toISOString(),
      };
      if (user.photoURL) {
        reviewData.userPhoto = user.photoURL;
      }
      
      await addDoc(collection(db, 'reviews'), reviewData);
      
      setNewReview({ rating: 5, comment: '' });
      
      setReviewSuccess(true);
      setTimeout(() => setReviewSuccess(false), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'reviews');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    setModalConfig({
      title: 'Delete Review',
      message: 'Are you sure you want to delete this review?',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'reviews', reviewId));
          setReviews(reviews.filter(r => r.id !== reviewId));
          
          // Update listing average rating and count
          if (listing) {
            const deletedReview = reviews.find(r => r.id === reviewId);
            if (deletedReview && deletedReview.isApproved) {
              const newCount = Math.max(0, (listing.reviewCount || 0) - 1);
              let newAvg = 0;
              if (newCount > 0) {
                const newTotal = ((listing.averageRating || 0) * (listing.reviewCount || 0)) - deletedReview.rating;
                newAvg = Number((newTotal / newCount).toFixed(1));
              }
              
              const isDemo = DEMO_LISTINGS.some(l => l.id === listing.id);
              if (!isDemo) {
                await updateDoc(doc(db, 'listings', listing.id), {
                  reviewCount: newCount,
                  averageRating: newAvg
                });
              }
              
              setListing({
                ...listing,
                reviewCount: newCount,
                averageRating: newAvg
              });
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `reviews/${reviewId}`);
        }
      }
    });
    setModalOpen(true);
  };

  const handleUpdateReview = async (reviewId: string) => {
    if (!editComment.trim()) return;
    try {
      await updateDoc(doc(db, 'reviews', reviewId), {
        comment: editComment,
        updatedAt: new Date().toISOString()
      });
      setReviews(reviews.map(r => r.id === reviewId ? { ...r, comment: editComment } : r));
      setEditingReview(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reviews/${reviewId}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!listing) return <NotFound />;

  const renderBreadcrumbs = (position: 'top' | 'content') => {
    const mainCategory = Array.isArray(listing.category) ? listing.category[0] : listing.category;
    
    let displayCategory: string = mainCategory;
    if (mainCategory === 'Restaurants') displayCategory = 'Halal Restaurants';
    if (mainCategory === 'Schools') displayCategory = 'Islamic Schools';
    if (mainCategory === 'Grocery') displayCategory = 'Halal Grocery';
    
    return (
      <div className={`hidden md:flex items-center gap-2 text-[13px] text-gray-500 font-medium overflow-x-auto whitespace-nowrap scrollbar-hide ${position === 'top' ? 'py-4 px-6 border-b border-gray-100 bg-gray-50/50' : ''}`}>
        <Link to="/" className="hover:text-[#e90b35] transition-colors">Home</Link>
        {mainCategory && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
            <Link to={`/${mainCategory.toLowerCase()}`} className="hover:text-[#e90b35] transition-colors">{displayCategory}</Link>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
        <span className="text-gray-900 truncate max-w-[200px]">{listing.name}</span>
      </div>
    );
  };

  const { categories: cleanCats } = getCleanCategoriesAndTags(listing);
  const mainCategoryStr = cleanCats[0] || 'listings';
    
  return (
    <>
      <div className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100">
      <SEO
        title={listing.name}
        description={`Find verified reviews, directions, address, phone number, and open hours for ${listing.name} in Ottawa. Located at ${listing.address}${listing.suburb ? ` (${listing.suburb})` : ""}.`}
        canonicalUrl={getAbsoluteUrl(getListingUrl(listing))}
        ogImage={listing.photos && listing.photos.length > 0 ? getAbsoluteUrl(listing.photos[0]) : undefined}
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": (() => {
              switch(mainCategoryStr) {
                case 'Restaurants': return 'Restaurant';
                case 'Mosques': return 'PlaceOfWorship';
                case 'Grocery': return 'GroceryStore';
                case 'Clothing': return 'ClothingStore';
                case 'Schools': return 'School';
                case 'Organizations': return 'Organization';
                case 'Butchers': return 'FoodEstablishment';
                default: return 'LocalBusiness';
              }
            })(),
            "name": listing.name,
            "image": listing.photos?.length > 0 ? listing.photos.map(p => getAbsoluteUrl(p)) : undefined,
            "@id": getAbsoluteUrl(getListingUrl(listing)),
            "url": listing.website || getAbsoluteUrl(getListingUrl(listing)),
            "telephone": listing.phoneNumber || undefined,
            "address": {
              "@type": "PostalAddress",
              "streetAddress": listing.address,
              "addressLocality": "Ottawa",
              "addressRegion": "ON",
              "addressCountry": "CA"
            },
            "geo": {
              "@type": "GeoCoordinates",
              "latitude": listing.lat,
              "longitude": listing.lng
            },
            "description": listing.description,
            "openingHours": listing.openingHours ? listing.openingHours : undefined,
            "openingHoursSpecification": listing.openingHours && listing.openingHours.length > 0
              ? (typeof listing.openingHours === 'string' ? listing.openingHours.split(',').map(s => s.trim()) : (listing.openingHours as any)).map((entry: string) => {
                  const match = entry.match(/^([A-Za-z]{2}(?:[,\-][A-Za-z]{2})*)\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
                  if (!match) return null;
                  return {
                    "@type": "OpeningHoursSpecification",
                    "dayOfWeek": expandDays(match[1]),
                    "opens": match[2],
                    "closes": match[3]
                  };
                }).filter(Boolean)
              : undefined,
            ...(listing.cuisine && listing.cuisine.length > 0 && Array.isArray(listing.category) && listing.category.includes('Restaurants') ? { "servesCuisine": listing.cuisine.join(", ") } : {}),
            ...(listing.plan === 'premium' && (listing.menuUrl || listing.menuPdfUrl) ? { "hasMenu": getAbsoluteUrl(listing.menuUrl || listing.menuPdfUrl!) } : {}),
            "aggregateRating": listing.reviewCount && listing.reviewCount > 0 ? {
              "@type": "AggregateRating",
              "ratingValue": listing.averageRating,
              "reviewCount": listing.reviewCount
            } : undefined
          },
          {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": getAbsoluteUrl("")
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": mainCategoryStr,
                "item": getAbsoluteUrl(mainCategoryStr.toLowerCase())
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": listing.name
              }
            ]
          }
        ]}
      />

      {/* Listing Header Banner */}
      <div className="relative h-72 bg-slate-900 overflow-hidden">
        <img 
          src={
            listing.photos && listing.photos.length > 0 && listing.photos[0] && listing.photos[0].trim() !== ''
              ? getOptimizedImageUrl(listing.photos[0], 1920, 600)
              : getOptimizedImageUrl(settingsCoverUrl || "/ottawa-sunset.webp", 1920, 600)
          } 
          alt={listing.name}
          className="absolute inset-0 w-full h-full object-cover object-center"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
        <div className="absolute inset-0 bg-black/70"></div>

        {listing.isFeatured && (
          <div className="absolute top-4 left-4 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>
        )}
        
        {/* Action Buttons Overlay */}
        <div className="absolute top-4 right-4 flex gap-2">
          {(user?.uid === listing.submittedBy || user?.role === 'admin') && (
            <>
              <button onClick={onEdit} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={onDelete} className="p-2 bg-red-500/20 backdrop-blur-md rounded-full text-white hover:bg-red-500/40 transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
          
          {user?.uid !== listing.submittedBy && (
            <button 
              onClick={onClaim}
              className="flex items-center gap-2 px-5 py-2.5 bg-white/95 backdrop-blur-md rounded-2xl text-xs font-bold text-gray-800 shadow-xl shadow-black/10 hover:bg-white active:scale-95 transition-all border border-white/20 group"
            >
              <div className="relative">
                <ShieldCheck className="w-4 h-4 text-[#e90b35] group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-[#e90b35]/20 blur-sm rounded-full animate-pulse"></div>
              </div>
              Claim
            </button>
          )}
        </div>

        <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap text-white">
              {(() => {
                const { categories, types, cuisine } = getCleanCategoriesAndTags(listing);
                const mainCategory = categories[0];
                const otherCategories = categories.slice(1);
                
                const subcategories: string[] = [];
                if (categories.includes('Restaurants')) {
                  subcategories.push(...types);
                  subcategories.push(...cuisine);
                }
                subcategories.push(...otherCategories);
                
                const uniqueSubcategories = Array.from(new Set(subcategories)).filter(Boolean);
                const displaySubcategories = uniqueSubcategories.slice(0, 2);

                return (
                  <>
                    {mainCategory && (
                      <Link 
                        to={`/${mainCategory.toLowerCase().replace(/\s+/g, '-')}`}
                        className={`transition-all hover:scale-105 active:scale-95 duration-200 ${
                          displaySubcategories.length === 0 
                            ? "bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase" 
                            : "bg-[#e90b35] text-white border border-[#e90b35] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm hover:brightness-110"
                        }`}
                      >
                        {mainCategory}
                      </Link>
                    )}
                    {displaySubcategories.map((sub, index) => {
                      const isRestaurantSubcategory = 
                        (CUISINES as readonly any[]).some(c => String(c).toLowerCase().trim() === sub.toLowerCase().trim()) || 
                        (LISTING_TYPES as readonly any[]).some(t => String(t).toLowerCase().trim() === sub.toLowerCase().trim());
                      const subPath = isRestaurantSubcategory 
                        ? `/restaurants/${sub.toLowerCase().replace(/\s+/g, '-')}` 
                        : `/${sub.toLowerCase().replace(/\s+/g, '-')}`;
                      return (
                        <Link 
                          key={`sub-${index}`} 
                          to={subPath}
                          className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase transition-all hover:scale-105 hover:bg-red-100/80 active:scale-95 duration-200"
                        >
                          {sub}
                        </Link>
                      );
                    })}
                  </>
                );
              })()}
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold leading-tight">{listing.name}</h1>
            </div>
            <div className="flex items-center gap-4 mt-2 text-sm">
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                <span className="font-bold">{listing.averageRating}</span>
                <span className="text-white/70">({listing.reviewCount} reviews)</span>
              </div>
            </div>
          </div>
          
          <SaveButton id={listing.id} type="listing" variant="glass" />
        </div>
      </div>

      <div className="p-6">
        {renderBreadcrumbs('content')}
        <div className="grid grid-cols-1 lg:grid-cols-10 gap-8 mt-6">
          <div className="lg:col-span-7 flex flex-col h-full gap-8">
        {/* Info Buttons */}
        <div className="flex lg:hidden flex-wrap justify-center gap-8">
          <button 
            onClick={() => handleInfoClick(
              'Address', 
              formatAddressWithoutProvinceAndPostalCode(listing.address), 
              <MapPin className="w-6 h-6" />,
              'Open in Google Maps',
              openInMaps
            )}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Address</span>
          </button>
          
          {listing.phoneNumber && (
            <button 
              onClick={() => handleInfoClick(
                'Phone', 
                listing.phoneNumber, 
                <Phone className="w-6 h-6" />,
                'Call Now',
                () => window.open(`tel:${listing.phoneNumber}`, '_self')
              )}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
                <Phone className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Phone</span>
            </button>
          )}

          {listing.email && (
            <button 
              onClick={() => handleInfoClick(
                'Email', 
                listing.email!, 
                <Mail className="w-6 h-6" />,
                'Send Email',
                () => window.open(`mailto:${listing.email}`, '_self')
              )}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
                <Mail className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Email</span>
            </button>
          )}

          {listing.website && (
            <button 
              onClick={() => handleInfoClick(
                'Website', 
                listing.website!, 
                <Globe className="w-5 h-5" />,
                'Visit Website',
                () => window.open(listing.website!.startsWith('http') ? listing.website! : `https://${listing.website!}`, '_blank')
              )}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
                <Globe className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Website</span>
            </button>
          )}

          {listing.plan === 'premium' && (listing.menuUrl || listing.menuPdfUrl) && !listing.name.toLowerCase().includes('jamia islamia') && (
            <button 
              onClick={() => handleInfoClick(
                'Menu', 
                (listing.menuPdfUrl || listing.menuUrl)!, 
                <FileText className="w-6 h-6" />,
                'View Menu',
                () => window.open((listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`, '_blank')
              )}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
                <FileText className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Menu</span>
            </button>
          )}
        </div>

        {listing.plan === 'premium' && ((listing.socialMedia && Object.values(listing.socialMedia).some(val => val)) || (listing.socialMediaLinks && listing.socialMediaLinks.length > 0)) && (
          <div className="flex lg:hidden justify-center gap-4 mt-6">
            {listing.socialMedia?.instagram && (
              <a href={listing.socialMedia.instagram.startsWith('http') ? listing.socialMedia.instagram : `https://${listing.socialMedia.instagram}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                <FaInstagram className="w-5 h-5" />
              </a>
            )}
            {listing.socialMedia?.facebook && (
              <a href={listing.socialMedia.facebook.startsWith('http') ? listing.socialMedia.facebook : `https://${listing.socialMedia.facebook}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                <FaFacebook className="w-5 h-5" />
              </a>
            )}
            {listing.socialMedia?.twitter && (
              <a href={listing.socialMedia.twitter.startsWith('http') ? listing.socialMedia.twitter : `https://${listing.socialMedia.twitter}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                <FaTwitter className="w-5 h-5" />
              </a>
            )}
            {listing.socialMedia?.tiktok && (
              <a href={listing.socialMedia.tiktok.startsWith('http') ? listing.socialMedia.tiktok : `https://${listing.socialMedia.tiktok}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                <FaTiktok className="w-5 h-5" />
              </a>
            )}
            {listing.socialMediaLinks?.map((link, idx) => {
              if (!link) return null;
              const formattedLink = link.startsWith('http') ? link : `https://${link}`;
              const isInstagram = link.toLowerCase().includes('instagram.com');
              const isFacebook = link.toLowerCase().includes('facebook.com');
              const isTikTok = link.toLowerCase().includes('tiktok.com');
              const isTwitter = link.toLowerCase().includes('twitter.com') || link.toLowerCase().includes('x.com');
              
              const Icon = isInstagram ? FaInstagram : isFacebook ? FaFacebook : isTwitter ? FaTwitter : isTikTok ? FaTiktok : Globe;

              return (
                <a key={idx} href={formattedLink} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors flex items-center justify-center">
                  <Icon className="w-5 h-5" />
                </a>
              );
            })}
          </div>
        )}

        {/* Info Modal */}
        {infoModal.isOpen && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 pb-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setInfoModal(prev => ({ ...prev, isOpen: false }))}
          >
            <div 
              className="bg-white rounded-3xl p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300 relative"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setInfoModal(prev => ({ ...prev, isOpen: false }))}
                className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="text-center">
                <h3 className="text-xl font-bold">{infoModal.title}</h3>
              </div>
              {infoModal.content}
            </div>
          </div>
        )}

        {/* Claim Modal */}
          {showClaimModal && (
            <div 
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
              onClick={() => setShowClaimModal(false)}
            >
              <div 
                className="bg-white rounded-[32px] p-8 max-w-sm w-full space-y-6 animate-in zoom-in-95 duration-300 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 bg-red-50 rounded-3xl rotate-6"></div>
                  <div className="absolute inset-0 bg-red-100/50 rounded-3xl -rotate-3"></div>
                  <div className="relative w-full h-full bg-white rounded-3xl shadow-sm border border-red-50 flex items-center justify-center text-[#e90b35]">
                    <ShieldCheck className="w-10 h-10" />
                  </div>
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-gray-900">Claim</h3>
                  <p className="text-gray-500 text-sm leading-relaxed">
                    Are you the owner of <span className="font-bold text-gray-900">{listing.name}</span>? 
                    Submit a request to verify your ownership and unlock listing management tools.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Verification Details</label>
                    <textarea
                      placeholder="Provide your phone, official email, or website to help us verify you..."
                      className="w-full p-4 bg-gray-50 border-2 border-transparent rounded-2xl outline-none focus:border-[#e90b35]/10 focus:bg-white transition-all h-28 resize-none text-sm"
                      id="claim-reason"
                    />
                  </div>

                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={async () => {
                        const reason = (document.getElementById('claim-reason') as HTMLTextAreaElement)?.value;
                        if (!reason?.trim()) {
                          toast.error('Please provide some details to verify your ownership.');
                          return;
                        }
                        try {
                          await addDoc(collection(db, 'claim_requests'), {
                            listingId: listing.id,
                            userId: user?.uid,
                            listingName: listing.name,
                            reason: reason,
                            status: 'pending',
                            createdAt: new Date().toISOString()
                          });
                          
                          await addDoc(collection(db, 'plan_requests'), {
                            listingId: listing.id,
                            userId: user?.uid,
                            listingName: listing.name,
                            plan: 'basic',
                            isFeatured: false,
                            autoRenewPremium: false,
                            autoRenewFeatured: false,
                            contactName: user?.name,
                            contactPhone: user?.phoneNumber || '',
                            contactEmail: user?.email,
                            requestType: 'claim_listing',
                            status: 'pending',
                            createdAt: new Date().toISOString()
                          });
                          setShowClaimModal(false);
                          toast.success('Claim request submitted! Our team will verify your ownership.');
                        } catch (err) {
                          handleFirestoreError(err, OperationType.CREATE, 'claim_requests');
                        }
                      }}
                      className="w-full py-4 bg-[#e90b35] text-white font-bold rounded-2xl shadow-xl shadow-red-100 hover:shadow-red-200 active:scale-[0.98] transition-all"
                    >
                      Submit Claim Request
                    </button>
                    <button 
                      onClick={() => setShowClaimModal(false)}
                      className="w-full py-4 bg-gray-50 text-gray-500 font-bold rounded-2xl hover:bg-gray-100 active:scale-[0.98] transition-all"
                    >
                      Maybe Later
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Details */}
          <section className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-xl font-bold">About</h2>
              {(() => {
                const paragraphs = listing.description ? listing.description.split(/\r?\n\s*\r?\n/) : [];
                const numParagraphs = paragraphs.length;

                if (numParagraphs <= 1) {
                  return (
                    <>
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{listing.description}</p>
                      <BeehiivEmbed />
                    </>
                  );
                }

                const isHeading = (text: string) => {
                  const trimmed = text.trim();
                  if (/^#{1,6}\s+/.test(trimmed)) return true;
                  if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length < 120 && !trimmed.includes('\n')) return true;
                  return false;
                };

                let midIndex = Math.floor(numParagraphs / 2);
                if (midIndex > 0 && isHeading(paragraphs[midIndex - 1])) {
                  if (midIndex - 1 > 0) {
                    midIndex = midIndex - 1;
                  } else if (midIndex + 1 < numParagraphs) {
                    midIndex = midIndex + 1;
                  }
                }

                const firstHalf = paragraphs.slice(0, midIndex).join('\n\n');
                const secondHalf = paragraphs.slice(midIndex).join('\n\n');

                return (
                  <>
                    <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{firstHalf}</p>
                    <BeehiivEmbed />
                    {secondHalf.trim() && (
                      <p className="text-gray-600 leading-relaxed whitespace-pre-wrap mt-4">{secondHalf}</p>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Menu Section */}
            {listing.plan === 'premium' && (listing.menuPdfUrl || listing.menuUrl || (listing.menuItems && listing.menuItems.length > 0)) && !listing.name.toLowerCase().includes('jamia islamia') && (
              <div className="space-y-4 pt-4 border-t border-gray-50">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#e90b35]/10 text-[#e90b35] flex items-center justify-center">
                      <Star className="w-4 h-4 fill-current" />
                    </div>
                    Menu
                  </h2>
                  {(listing.menuPdfUrl || listing.menuUrl) && (
                    <a 
                      href={listing.menuPdfUrl || listing.menuUrl}
                      target="_blank"
                      rel="noopener noreferrer" 
                      className="text-[#e90b35] text-sm font-bold flex items-center gap-1 hover:underline"
                    >
                      View Full Menu
                    </a>
                  )}
                </div>

                {listing.menuItems && listing.menuItems.length > 0 && (
                  <div className="space-y-6">
                    {listing.menuItems.map((menuCategory, catIdx) => (
                      <div key={catIdx} className="space-y-3">
                        <h3 className="font-bold text-gray-900 border-b border-gray-100 pb-2">{menuCategory.category}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {menuCategory.items.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex justify-between gap-4 p-3 rounded-2xl bg-gray-50 hover:bg-red-50/50 transition-colors">
                              <div>
                                <h4 className="font-bold text-sm text-gray-900">{item.name}</h4>
                                {item.description && <p className="text-xs text-gray-500 mt-1">{item.description}</p>}
                              </div>
                              <div className="font-bold text-[#e90b35] min-w-max">{item.price}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {listing.openingHours && (
              <div id="additional-info-section" className="lg:hidden space-y-4 pt-4 border-t border-gray-50">
                <h2 className="text-xl font-bold">Hours</h2>
                <div className="bg-gray-50 p-6 rounded-3xl">
                  <div className="grid grid-cols-1 gap-3">
                    {listing.openingHours.split(', ').map((hour, index) => {
                      const parts = hour.split(': ');
                      if (parts.length < 2) return <div key={index} className="text-sm text-gray-700">{hour}</div>;
                      const [day, time] = parts;
                      const isClosed = time.toLowerCase().includes('closed');
                      return (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200/50 last:border-0">
                          <span className="text-[13px] font-semibold text-gray-900">{day}</span>
                          <span className={`text-[13px] font-semibold ${isClosed ? 'text-red-500' : 'text-gray-900'}`}>{time}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Reviews */}
          <section className="flex flex-col flex-1 space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Reviews</h2>
              <button 
                onClick={() => document.getElementById('review-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="text-[#e90b35] text-sm font-bold"
              >
                Write a Review
              </button>
            </div>

            <div className="space-y-4 flex-1">
              {reviews.length > 0 ? (
                reviews.map((review) => (
                  <div key={review.id} className="bg-white p-4 rounded-2xl border border-gray-50 shadow-sm space-y-2">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-100 rounded-full overflow-hidden">
                          {<div className="w-full h-full flex items-center justify-center text-gray-500 font-bold uppercase text-sm">{(review.userName?.[0] || '?')}</div>}
                        </div>
                        <div>
                          <p className="font-bold text-sm">{review.userName}</p>
                          <p className="text-[10px] text-gray-400">{new Date(review.createdAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                            ))}
                          </div>
                          {!review.isApproved && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-[8px] font-bold rounded-full uppercase tracking-widest">
                              Pending Approval
                            </span>
                          )}
                        </div>
                        {(user?.uid === review.userId || user?.role === 'admin') && (
                          <div className="flex items-center gap-2 ml-2">
                            <button 
                              onClick={() => {
                                setEditingReview(review.id);
                                setEditComment(review.comment);
                              }}
                              className="text-gray-400 hover:text-[#e90b35] transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button 
                              onClick={() => handleDeleteReview(review.id)}
                              className="text-gray-400 hover:text-[#e90b35] transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    {editingReview === review.id ? (
                      <div className="space-y-2 mt-2">
                        <textarea
                          className="w-full p-3 bg-gray-50 border-none rounded-xl outline-none focus:ring-2 focus:ring-[#e90b35] text-sm resize-none"
                          value={editComment}
                          onChange={(e) => setEditComment(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleUpdateReview(review.id)}
                            className="px-3 py-1.5 bg-[#e90b35] text-white text-xs font-bold rounded-lg"
                          >
                            Save
                          </button>
                          <button 
                            onClick={() => setEditingReview(null)}
                            className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-bold rounded-lg"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-600 whitespace-pre-wrap">{review.comment}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-gray-400 text-center py-4">No reviews yet. Be the first to review!</p>
              )}
            </div>

            {/* Review Form */}
            <div id="review-form" className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4 mt-auto">
              <h3 className="font-bold">Leave a Review</h3>
              {reviewSuccess && (
                <div className="bg-green-50 text-green-600 p-4 rounded-2xl text-sm font-bold animate-in zoom-in-95 duration-300">
                  Review submitted successfully! It will be visible after admin approval.
                </div>
              )}
              
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                    className="p-1 transition-transform active:scale-125"
                  >
                    <Star className={`w-8 h-8 ${star <= newReview.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} />
                  </button>
                ))}
              </div>
              <textarea
                placeholder="Share your experience..."
                className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-32 resize-none"
                value={newReview.comment}
                onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
              />
              <button
                onClick={handleAddReview}
                disabled={isSubmitting}
                className="w-full md:w-auto md:px-8 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? 'Submitting...' : <>Submit a Review <Send className="w-4 h-4 ml-1" /></>}
              </button>
            </div>
          </section>
          </div>

          {/* Right Column (Sidebar) */}
          <div className="hidden lg:flex lg:flex-col lg:col-span-3 gap-6 lg:-mt-4 h-full">
            {/* Map */}
            {listing.address && (
              <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-xl font-bold">Location</h2>
                <div className="w-full h-48 rounded-2xl overflow-hidden bg-gray-100 relative z-10">
                  <OpenStreetMap address={listing.address.replace(/(?:Unit|Apt|Suite|#|Room)\s*[A-Za-z0-9\-]+/gi, '').replace(/,\s*,/g, ',').replace(/^,\s*/, '').trim()} />
                </div>
                <div className="flex items-start gap-3 text-sm text-gray-600">
                  <MapPin className="w-5 h-5 text-[#e90b35] shrink-0 mt-0.5" />
                  <span>{formatAddressWithoutProvinceAndPostalCode(listing.address)}</span>
                </div>
                <button 
                  onClick={openInMaps}
                  className="w-full py-3 bg-red-50 text-[#e90b35] font-bold rounded-xl hover:bg-red-100 transition-colors text-sm"
                >
                  Get Directions
                </button>
              </div>
            )}

            {/* Information Details */}
            <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
              <h2 className="text-xl font-bold mb-4">Contact</h2>
              
              {listing.phoneNumber && (
                <div className="flex items-center gap-4 text-sm text-gray-600">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <a href={`tel:${listing.phoneNumber}`} className="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors">{listing.phoneNumber}</a>
                </div>
              )}

              {listing.email && (
                <div className="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <a href={`mailto:${listing.email}`} className="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1">{listing.email}</a>
                </div>
              )}

              {listing.website && (
                <div className="flex items-center gap-4 text-sm text-gray-600 break-all">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <Globe className="w-4 h-4" />
                  </div>
                  <a href={listing.website.startsWith('http') ? listing.website : `https://${listing.website}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors line-clamp-1">
                    {listing.website.replace(/^https?:\/\//, '')}
                  </a>
                </div>
              )}

              {listing.plan === 'premium' && (listing.menuUrl || listing.menuPdfUrl) && !listing.name.toLowerCase().includes('jamia islamia') && (
                <div className="flex items-center gap-4 text-sm text-gray-600 break-all pt-2">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35] shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <a href={(listing.menuPdfUrl || listing.menuUrl)!.startsWith('http') ? (listing.menuPdfUrl || listing.menuUrl)! : `https://${(listing.menuPdfUrl || listing.menuUrl)!}`} target="_blank" rel="noopener noreferrer" className="text-[13px] font-semibold text-gray-900 hover:text-[#e90b35] transition-colors">
                    View Menu
                  </a>
                </div>
              )}
            </div>
            
            {/* Hours */}
            {listing.openingHours && (
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4 mt-auto">
                <h2 className="text-xl font-bold">
                  Hours
                </h2>
                <div className="space-y-3">
                  {listing.openingHours.split(', ').map((hour, index) => {
                    const parts = hour.split(': ');
                    if (parts.length < 2) return <div key={index} className="text-sm text-gray-700">{hour}</div>;
                    const [day, time] = parts;
                    const isClosed = time.toLowerCase().includes('closed');
                    return (
                      <div key={index} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                        <span className="text-[13px] font-semibold text-gray-900">{day}</span>
                        <span className={`text-[13px] font-semibold ${isClosed ? 'text-red-500' : 'text-gray-900'}`}>{time}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {listing.plan === 'premium' && ((listing.socialMedia && Object.values(listing.socialMedia).some(val => val)) || (listing.socialMediaLinks && listing.socialMediaLinks.length > 0)) && (
              <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm space-y-4">
                <h2 className="text-xl font-bold mb-4">Social Media</h2>
                <div className="flex flex-wrap gap-4">
                  {listing.socialMedia?.instagram && (
                    <a href={listing.socialMedia.instagram.startsWith('http') ? listing.socialMedia.instagram : `https://${listing.socialMedia.instagram}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                      <FaInstagram className="w-5 h-5" />
                    </a>
                  )}
                  {listing.socialMedia?.facebook && (
                    <a href={listing.socialMedia.facebook.startsWith('http') ? listing.socialMedia.facebook : `https://${listing.socialMedia.facebook}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                      <FaFacebook className="w-5 h-5" />
                    </a>
                  )}
                  {listing.socialMedia?.twitter && (
                    <a href={listing.socialMedia.twitter.startsWith('http') ? listing.socialMedia.twitter : `https://${listing.socialMedia.twitter}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                      <FaTwitter className="w-5 h-5" />
                    </a>
                  )}
                  {listing.socialMedia?.tiktok && (
                    <a href={listing.socialMedia.tiktok.startsWith('http') ? listing.socialMedia.tiktok : `https://${listing.socialMedia.tiktok}`} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors">
                      <FaTiktok className="w-5 h-5" />
                    </a>
                  )}
                  {listing.socialMediaLinks?.map((link, idx) => {
                    if (!link) return null;
                    const formattedLink = link.startsWith('http') ? link : `https://${link}`;
                    const isInstagram = link.toLowerCase().includes('instagram.com');
                    const isFacebook = link.toLowerCase().includes('facebook.com');
                    const isTikTok = link.toLowerCase().includes('tiktok.com');
                    const isTwitter = link.toLowerCase().includes('twitter.com') || link.toLowerCase().includes('x.com');
                    
                    const Icon = isInstagram ? FaInstagram : isFacebook ? FaFacebook : isTwitter ? FaTwitter : isTikTok ? FaTiktok : Globe;

                    return (
                      <a key={idx} href={formattedLink} target="_blank" rel="noopener noreferrer" className="p-3 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-[#e90b35] rounded-full transition-colors flex items-center justify-center">
                        <Icon className="w-5 h-5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={modalConfig.onConfirm}
        title={modalConfig.title}
        message={modalConfig.message}
      />
    </div>

    {/* Related Listings - Desktop Only */}
    {relatedListings.length > 0 && (
      <div className="hidden md:block w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto mt-12 mb-16 animate-in fade-in duration-500">
        <h2 className="text-2xl font-bold mb-6">Related Listings</h2>
        <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
          {relatedListings.map((related) => (
            <Link
              key={related.id}
              to={getListingUrl(related)}
              className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md border border-gray-50 flex flex-col transition-all group"
            >
              <div className="relative h-48 w-full shrink-0">
                {related.photos && related.photos[0] && related.photos[0].trim() !== '' ? (
                  <img 
                    src={getOptimizedImageUrl(related.photos[0], 400, 192)} 
                    alt={related.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    loading="lazy"
                    width="400"
                    height="192"
                    decoding="async"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <span className="text-gray-400 font-medium text-sm">No Image</span>
                  </div>
                )}
                {related.isFeatured && (
                  <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">
                    Featured
                  </div>
                )}
              </div>
              <div className="p-5 flex flex-col flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-lg leading-tight group-hover:text-[#e90b35] transition-colors line-clamp-1">{related.name}</h3>
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg shrink-0">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm font-bold">{related.averageRating}</span>
                  </div>
                </div>
                <p className="text-gray-500 text-sm flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-[#e90b35]" />
                  <span className="line-clamp-1">{formatAddressWithoutProvinceAndPostalCode(related.address)}</span>
                </p>
                <div className="mt-auto flex items-center justify-between">
                  <span className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[10px] font-bold tracking-wide uppercase inline-block">
                    {getCleanCategoriesAndTags(related).categories[0] || 'Listing'}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    )}
    </>
  );
};
