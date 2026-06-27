import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Newspaper, Briefcase, ChevronRight, ChevronLeft, Star, User, Clock, DollarSign, Building2, ChevronDown, Utensils } from 'lucide-react';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db, getGeneralSettings } from '../firebase';
import { Listing, NewsArticle, Job } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { CATEGORIES, DEMO_LISTINGS, DEMO_NEWS, DEMO_JOBS } from '../constants';
import { formatDate } from '../utils/dateFormatter';
import { getListingUrl, getAbsoluteUrl } from '../utils/url';
import { useAuth } from '../context/AuthContext';
import { isAppWrapper } from '../utils/platform';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { SEO } from '../components/SEO';
import { Helmet } from 'react-helmet-async';
import { getOptimizedImageUrl } from '../utils/imageUtils';

const faqs = [
  {
    question: "How do I add my business to the directory?",
    answer: "You can add your business by clicking the \"Add Listing\" button or the \"+\" icon in the top right corner. Ensure you have an account and are logged in to submit your business details for approval."
  },
  {
    question: "Is it free to list my business?",
    answer: "Yes! Basic listings are completely free. We also offer premium features to stand out and attract more customers, which you can explore in your dashboard."
  },
  {
    question: "How are listings approved?",
    answer: "Our community moderators review all submitted listings and events within 24-48 hours. They verify the information to ensure quality standards our community expects."
  },
  {
    question: "Can I promote an event?",
    answer: "Absolutely. Navigate to the Events section and click \"Add Event\" to share your upcoming activity with the local community. It will be visible after a quick review."
  }
];

const FAQItem: React.FC<{ question: string, answer: string, isOpen: boolean, onToggle: () => void }> = ({ question, answer, isOpen, onToggle }) => {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300">
      <button 
        onClick={onToggle} 
        aria-expanded={isOpen}
        className="w-full text-left p-6 flex justify-between items-center focus:outline-none focus:ring-2 focus:ring-[#e90b35] focus:ring-inset"
      >
        <h3 className="font-bold text-lg text-gray-900">{question}</h3>
        <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <div 
        className="transition-all duration-300 ease-in-out"
        style={{ maxHeight: isOpen ? '500px' : '0', opacity: isOpen ? 1 : 0 }}
      >
        <div className="p-6 pt-0 text-gray-500 text-sm leading-relaxed">
          {answer}
        </div>
      </div>
    </div>
  );
};

export const Home: React.FC = () => {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYearStr = `${currentMonth} ${currentYear}`;

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', slidesToScroll: 1 }, [Autoplay({ delay: 3000, stopOnInteraction: false })]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const { user } = useAuth();
  const [isApp, setIsApp] = useState(false);

  const initData = typeof window !== 'undefined' && (window as any).__INITIAL_ROUTE_TYPE__ === 'home' 
    ? (window as any).__INITIAL_DATA__ 
    : null;

  const [loading, setLoading] = useState(!initData);
  const parseInitTime = (val: any): number => {
    if (!val) return 0;
    if (typeof val.toDate === 'function') return val.toDate().getTime();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    const d = new Date(val);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };
  const [featuredListings, setFeaturedListings] = useState<Listing[]>(
    initData?.listings
      ? [...initData.listings].sort((a, b) => parseInitTime(b.createdAt) - parseInitTime(a.createdAt)).slice(0, 8)
      : []
  );
  const [latestNews, setLatestNews] = useState<NewsArticle[]>(initData?.news || []);
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>(initData?.jobs || []);
  const [heroImageUrl, setHeroImageUrl] = useState<string>('');
  const navigate = useNavigate();

  useEffect(() => {
    setIsApp(isAppWrapper());
    const fetchHomeData = async () => {
      try {
        if (!initData) {
          setLoading(true);
        }
        
        try {
          const settings = await getGeneralSettings(true);
          setHeroImageUrl(settings?.heroImageUrl || '');
        } catch (settingsErr) {
          console.warn("Failed to load general settings:", settingsErr);
        }

        const isAdmin = user?.role === 'admin';

        let listingsPromise;
        if (isAdmin) {
          listingsPromise = getDocs(
            query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(8))
          );
        } else if (user) {
          listingsPromise = Promise.all([
            getDocs(
              query(
                collection(db, 'listings'),
                where('isApproved', '==', true),
                orderBy('createdAt', 'desc'),
                limit(8)
              )
            ),
            getDocs(
              query(
                collection(db, 'listings'),
                where('submittedBy', '==', user.uid),
                limit(50)
              )
            )
          ]);
        } else {
          listingsPromise = getDocs(
            query(
              collection(db, 'listings'),
              where('isApproved', '==', true),
              orderBy('createdAt', 'desc'),
              limit(8)
            )
          );
        }

        // Fetch Latest News with fallback to unordered query if Firestore composite index is not yet built
        const fetchNews = async () => {
          try {
            const q = isAdmin
              ? query(collection(db, 'news'), orderBy('createdAt', 'desc'), limit(8))
              : query(collection(db, 'news'), where('isApproved', '==', true), orderBy('createdAt', 'desc'), limit(8));
            return await getDocs(q);
          } catch (error) {
            console.warn("Index not found for ordered news. Falling back to unordered larger fetch.", error);
            const qFallback = isAdmin
              ? query(collection(db, 'news'), limit(80))
              : query(collection(db, 'news'), where('isApproved', '==', true), limit(80));
            return await getDocs(qFallback);
          }
        };

        // Fetch Latest Jobs with fallback
        const fetchJobs = async () => {
          try {
            const q = isAdmin
              ? query(collection(db, 'jobs'), orderBy('createdAt', 'desc'), limit(6))
              : query(collection(db, 'jobs'), where('isApproved', '==', true), orderBy('createdAt', 'desc'), limit(6));
            return await getDocs(q);
          } catch (error) {
            console.warn("Index not found for ordered jobs. Falling back to unordered larger fetch.", error);
            const qFallback = isAdmin
              ? query(collection(db, 'jobs'), limit(50))
              : query(collection(db, 'jobs'), where('isApproved', '==', true), limit(50));
            return await getDocs(qFallback);
          }
        };

        // Execute all queries in parallel
        const [listingsResult, newsSnap, jobsSnap] = await Promise.all([
          listingsPromise,
          fetchNews(),
          fetchJobs()
        ]);

        const parseTime = (val: any): number => {
          if (!val) return 0;
          if (typeof val.toDate === 'function') {
            return val.toDate().getTime();
          }
          if (typeof val.seconds === 'number') {
            return val.seconds * 1000;
          }
          const d = new Date(val);
          return isNaN(d.getTime()) ? 0 : d.getTime();
        };

        let listingsData: Listing[] = [];
        if (isAdmin) {
          listingsData = (listingsResult as any).docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Listing[];
        } else if (user) {
          const [approvedSnap, ownSnap] = listingsResult as any;
          const seen = new Set<string>();
          const temp: Listing[] = [];
          for (const doc of approvedSnap.docs) {
            seen.add(doc.id);
            temp.push({ id: doc.id, ...doc.data() } as Listing);
          }
          for (const doc of ownSnap.docs) {
            if (!seen.has(doc.id)) {
              seen.add(doc.id);
              temp.push({ id: doc.id, ...doc.data() } as Listing);
            }
          }
          listingsData = temp;
        } else {
          listingsData = (listingsResult as any).docs.map((doc: any) => ({ id: doc.id, ...doc.data() })) as Listing[];
        }

        const sortedListings = listingsData
          .sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt))
          .slice(0, 8);
        setFeaturedListings(sortedListings.length > 0 ? sortedListings : [...DEMO_LISTINGS].sort((a, b) => parseTime(b.createdAt) - parseTime(a.createdAt)).slice(0, 8));

        const newsData = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsArticle[];
        
        // Merge with DEMO_NEWS, deduplicating by ID or slug
        const mergedNewsMap = new Map<string, NewsArticle>();
        DEMO_NEWS.forEach(item => mergedNewsMap.set(item.id, item));
        newsData.forEach(item => {
          mergedNewsMap.set(item.id, item);
          if (item.slug) {
            const demoItem = DEMO_NEWS.find(d => d.slug === item.slug);
            if (demoItem) mergedNewsMap.delete(demoItem.id);
          }
        });
        
        const sortedNews = Array.from(mergedNewsMap.values())
          .sort((a, b) => {
            const dateB = new Date(b.publishDate || b.createdAt || 0).getTime();
            const dateA = new Date(a.publishDate || a.createdAt || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 6);
        setLatestNews(sortedNews);

        const jobsData = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Job[];
        
        // Merge with DEMO_JOBS, deduplicating by ID or slug
        const mergedJobsMap = new Map<string, Job>();
        DEMO_JOBS.forEach(item => mergedJobsMap.set(item.id, item));
        jobsData.forEach(item => {
          mergedJobsMap.set(item.id, item);
          if (item.slug) {
            const demoItem = DEMO_JOBS.find(d => d.slug === item.slug);
            if (demoItem) mergedJobsMap.delete(demoItem.id);
          }
        });

        const sortedJobs = Array.from(mergedJobsMap.values())
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 4);
        setFeaturedJobs(sortedJobs);

      } catch (error) {
        console.error("Error fetching home data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchHomeData();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/listings?search=${searchQuery}`);
  };

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <Helmet>
        <meta name="man-site-verification" content="a2a54c227a8165de30c8765717af49c3" />
      </Helmet>
      <SEO 
        title="Halal Ottawa - Halal Places in Ottawa"
        description="Discover verified Halal restaurants, cafes, mosques, grocery stores, schools, and Muslim organizations in Ottawa. Stay connected with local events, news, and job career opportunities."
        canonicalUrl={getAbsoluteUrl("")}
        disableSuffix={true}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Halal Ottawa",
          "url": getAbsoluteUrl(""),
          "description": "Discover Halal restaurants, mosques, grocery stores, and Islamic organizations in Ottawa.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": `${getAbsoluteUrl("listings")}?search={search_term_string}`,
            "query-input": "required name=search_term_string"
          }
        }}
      />

      {isApp ? (
        <div className="w-full max-w-2xl mx-auto px-4 pt-4 pb-2">
          <form onSubmit={handleSearch} className="relative w-full bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden focus-within:ring-2 focus-within:ring-[#e90b35] transition-all">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search halal restaurants, mosques, events, or jobs in Ottawa..."
              className="w-full pl-12 pr-4 py-4 bg-white border-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 text-sm outline-none"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>
        </div>
      ) : (
        <section className="relative w-full h-[400px] md:h-[500px] lg:h-[550px] flex flex-col justify-center items-center px-4 overflow-hidden mb-8 md:mb-12">
          <div className="absolute inset-0 z-0">
            <img 
              src={getOptimizedImageUrl(heroImageUrl || "https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/global-hero-1781326553984.webp", 1920, 1080)} 
              alt="Ottawa Sunset" 
              className="w-full h-full object-cover brightness-[0.45] saturate-[1.2]"
            />
            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/65 to-transparent" />
            <div className="absolute inset-0 bg-black/55" />
          </div>

          <div className="relative z-10 w-full max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight drop-shadow-lg leading-tight">
              Halal Places in Ottawa
            </h1>
            <p className="text-white/95 text-sm md:text-lg max-w-xl mx-auto font-medium drop-shadow-md">
              Discover verified halal restaurants, cafes, mosques, local events, news, and job opportunities
            </p>
            <div className="w-full max-w-2xl mx-auto">
              <form onSubmit={handleSearch} className="relative w-full bg-white rounded-2xl shadow-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#e90b35] transition-all">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search halal restaurants, mosques, events, or jobs in Ottawa..."
                  className="w-full pl-12 pr-4 py-4 md:py-5 bg-white border-none text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-0 text-sm md:text-base outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Container with standard padding and maximum width */}
      <div className="max-w-7xl xl:max-w-[1400px] mx-auto px-4 md:px-8 pb-12 space-y-8 md:space-y-12">
        {/* Categories - Mobile Grid */}
      <section className="grid grid-cols-3 gap-3 md:hidden">
        {CATEGORIES.slice(0, 6).map((cat) => (
          <Link
            key={cat}
            to={`/${cat.toLowerCase()}`}
            aria-label={`Browse ${cat} category`}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all active:scale-95 outline-none focus:ring-2 focus:ring-[#e90b35]"
          >
            <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35]">
              <CategoryIcon category={cat as any} className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-center leading-tight">{cat}</span>
          </Link>
        ))}
      </section>

      {/* Categories - Desktop Carousel */}
      <section className="hidden md:block relative group mb-8">
        <button 
          onClick={() => emblaApi?.scrollPrev()}
          className="absolute -left-10 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-100/50 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#e90b35] transition-all duration-300 hover:scale-105 hover:bg-white z-10"
        >
          <ChevronLeft className="w-4 h-4 transition-transform hover:-translate-x-0.5" />
        </button>
        <div className="overflow-hidden py-2" ref={emblaRef}>
          <div className="flex -ml-3">
            {[...CATEGORIES, ...CATEGORIES, ...CATEGORIES].map((cat, i) => (
              <div key={`${cat}-${i}`} className="flex-[0_0_calc(100%/6)] min-w-0 pl-3">
                <Link
                  to={`/${cat.toLowerCase()}`}
                  aria-label={`Browse ${cat} category`}
                  className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all h-full outline-none focus:ring-2 focus:ring-[#e90b35]"
                >
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center text-[#e90b35]">
                    <CategoryIcon category={cat as any} className="w-5 h-5" />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 text-center leading-tight">{cat}</span>
                </Link>
              </div>
            ))}
          </div>
        </div>
        <button 
          onClick={() => emblaApi?.scrollNext()}
          className="absolute -right-10 top-1/2 -translate-y-1/2 shrink-0 w-8 h-8 bg-white/90 backdrop-blur-sm border border-gray-100/50 rounded-xl flex items-center justify-center text-gray-400 hover:text-[#e90b35] transition-all duration-300 hover:scale-105 hover:bg-white z-10"
        >
          <ChevronRight className="w-4 h-4 transition-transform hover:translate-x-0.5" />
        </button>
      </section>

      {/* Latest Listings */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Latest Listings</h2>
          <Link 
            to="/listings" 
            className="text-[#e90b35] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4"
            aria-label="View all latest listings"
          >
            View all
          </Link>
        </div>
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden border border-gray-100/60 flex flex-col shadow-sm">
                <div className="animate-pulse bg-gray-200 aspect-[2/1] w-full" />
                <div className="p-4 space-y-2 flex-1 flex flex-col justify-between">
                  <div className="animate-pulse bg-gray-200 h-4 w-3/4 rounded-md" />
                  <div className="animate-pulse bg-gray-200 h-3 w-1/2 rounded-md mt-2" />
                </div>
              </div>
            ))
          ) : featuredListings.length > 0 ? (
            featuredListings.map((listing, idx) => (
              <Link
                key={listing.id}
                to={getListingUrl(listing)}
                className="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 group hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-[#e90b35]"
              >
                <div className="relative aspect-[2/1] w-full bg-gray-100">
                  {listing.photos?.[0] ? (
                    <img 
                       src={getOptimizedImageUrl(listing.photos[0], 480, 240)} 
                       alt={listing.name} 
                       className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                       loading={idx < 2 ? "eager" : "lazy"}
                       fetchPriority={idx < 2 ? "high" : "auto"}
                       width="480"
                       height="240"
                       decoding="async"
                     />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">No Image</span>
                    </div>
                  )}
                  {listing.isFeatured && (
                    <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest animate-pulse">Featured</div>
                  )}
                  <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    {listing.averageRating}
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold leading-tight line-clamp-1">{listing.name}</h3>
                  <div className="text-gray-500 text-xs font-semibold mt-2 flex items-center justify-between flex-wrap gap-2">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-[#e90b35]" />
                      {listing.address.split(',')[0]}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="w-full col-span-full bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <Utensils className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm font-medium">No listings at the moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest News */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Latest News</h2>
          <Link 
            to="/news" 
            className="text-[#e90b35] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4"
            aria-label="View all news articles"
          >
            View all
          </Link>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white border border-gray-100 flex md:flex-col gap-4 md:gap-0 p-3 md:p-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">
                <div className="animate-pulse bg-gray-200 w-24 h-24 md:w-full md:h-48 aspect-square md:aspect-none shrink-0 rounded-xl md:rounded-none" />
                <div className="flex-1 space-y-3 py-1 md:p-5 flex flex-col justify-between">
                  <div>
                    <div className="animate-pulse bg-gray-200 h-4 w-5/6 rounded-md" />
                    <div className="animate-pulse bg-gray-200 h-3 w-2/3 rounded-md hidden md:block mt-2" />
                  </div>
                  <div className="animate-pulse bg-gray-200 h-3 w-1/3 rounded-md mt-2" />
                </div>
              </div>
            ))
          ) : latestNews.length > 0 ? (
            latestNews.map((news, index) => (
              <Link
                key={news.id}
                to={`/news/${news.slug || news.id}`}
                className={`bg-white hover:shadow-md transition-all border border-gray-50 group flex md:flex-col gap-4 md:gap-0 p-3 md:p-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35] ${index >= 3 ? 'hidden md:flex' : ''}`}
              >
                <div className="relative w-24 h-24 md:w-full md:h-48 aspect-square md:aspect-none shrink-0 bg-gray-100">
                  {news.coverImage && news.coverImage.trim() !== '' ? (
                    <img 
                      src={getOptimizedImageUrl(news.coverImage, 400, 192)} 
                      alt={news.title} 
                      className="w-full h-full object-cover rounded-xl md:rounded-none group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy"
                      width="400"
                      height="192"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center rounded-xl md:rounded-none">
                      <span className="text-gray-400 text-[10px] md:text-xs font-medium">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between py-1 md:p-5">
                  <div>
                    <h3 className="font-bold leading-tight">{news.title}</h3>
                    <div className="hidden md:block">
                      <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed mt-2">{news.content}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-3 md:mt-4 text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-2"><Clock className="w-3 h-3" strokeWidth={2.5} /> {formatDate(news.publishDate)}</span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="w-full col-span-full bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <Newspaper className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm font-medium">No news articles published recently.</p>
            </div>
          )}
        </div>
      </section>

      {/* Latest Jobs */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 leading-tight">Latest Jobs</h2>
          <Link 
            to="/jobs" 
            className="text-[#e90b35] text-sm md:text-base font-semibold hover:underline decoration-2 underline-offset-4"
            aria-label="View all job listings"
          >
            View all
          </Link>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
          {loading ? (
            Array.from({ length: 4 }).map((_, idx) => (
              <div key={idx} className="block bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                <div className="flex gap-3 items-start">
                  <div className="w-12 h-12 rounded-xl bg-gray-200 shrink-0 animate-pulse" />
                  <div className="flex-1 space-y-2 mt-1">
                    <div className="h-4 bg-gray-200 rounded-md w-3/4 animate-pulse" />
                    <div className="h-3.5 bg-gray-200 rounded-md w-1/2 animate-pulse" />
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="h-3 bg-gray-200 rounded-md w-1/4 animate-pulse" />
                  <div className="h-3 bg-gray-200 rounded-md w-1/4 animate-pulse" />
                </div>
              </div>
            ))
          ) : featuredJobs.length > 0 ? (
            featuredJobs.map((job) => (
              <Link
                key={job.id}
                to={`/jobs/${job.slug || job.id}`}
                className="block bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all outline-none focus:ring-2 focus:ring-[#e90b35]"
              >
                <div className="flex gap-3 items-start">
                  <div className="w-12 h-12 rounded-xl bg-gray-55 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0 aspect-square">
                    {job.companyLogo && job.companyLogo.trim() !== '' ? (
                      <img 
                        src={getOptimizedImageUrl(job.companyLogo, 48, 48)} 
                        alt={job.company} 
                        className="w-full h-full object-cover" 
                        loading="lazy"
                        width="48"
                        height="48"
                      />
                    ) : (
                      <Building2 className="w-6 h-6 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-4">
                      <h3 className="font-bold text-gray-900 leading-tight">{job.title}</h3>
                      {job.isFeatured && <span className="bg-red-50 text-[#e90b35] text-[10px] font-bold px-2 py-1 rounded-full uppercase shrink-0">Featured</span>}
                    </div>
                    <p className="text-[#e90b35] font-bold text-sm flex items-center gap-1 mt-1">
                      <Briefcase className="w-3 h-3 shrink-0" /> <span>{job.company}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-400 font-medium">
                  {job.salary && <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> {job.salary}</span>}
                  {job.type && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.type}</span>}
                  {(!job.salary && !job.type) && job.location && (
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {job.location.split(',')[1]?.trim() || job.location.split(',')[0]}</span>
                  )}
                </div>
              </Link>
            ))
          ) : (
            <div className="w-full col-span-full bg-gray-50 border border-gray-100 rounded-3xl p-8 flex flex-col items-center justify-center text-center">
              <Briefcase className="w-8 h-8 text-gray-300 mb-2" />
              <p className="text-gray-400 text-sm font-medium">No active job listings posted.</p>
            </div>
          )}
        </div>
      </section>

      {/* FAQ Section */}
      <section className="hidden md:block space-y-8 pt-8 pb-4">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold">Frequently Asked Questions</h2>
          <p className="text-gray-500">Everything you need to know about Halal Ottawa</p>
        </div>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <FAQItem 
              key={index}
              question={faq.question}
              answer={faq.answer}
              isOpen={openFaqIndex === index}
              onToggle={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
            />
          ))}
        </div>
      </section>
      </div>
    </div>
  );
};
