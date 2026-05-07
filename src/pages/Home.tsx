import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Newspaper, Calendar, Briefcase, ChevronRight, ChevronLeft, Star, User, Clock, DollarSign, Building2, ChevronDown } from 'lucide-react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '../firebase';
import { Listing, NewsArticle, Event, Job } from '../types';
import { CategoryIcon } from '../components/CategoryIcon';
import { AdDisplay } from '../components/AdDisplay';
import { CATEGORIES, DEMO_LISTINGS, DEMO_NEWS, DEMO_EVENTS, DEMO_JOBS } from '../constants';
import { formatDate } from '../utils/dateFormatter';
import { getListingUrl } from '../utils/url';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { SEO } from '../components/SEO';

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
        className="w-full text-left p-6 flex justify-between items-center focus:outline-none"
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
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, align: 'start', slidesToScroll: 1 }, [Autoplay({ delay: 3000, stopOnInteraction: false })]);
  const [searchQuery, setSearchQuery] = useState('');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);
  const [featuredListings, setFeaturedListings] = useState<Listing[]>([]);
  const [latestNews, setLatestNews] = useState<NewsArticle[]>([]);
  const [featuredEvents, setFeaturedEvents] = useState<Event[]>([]);
  const [featuredJobs, setFeaturedJobs] = useState<Job[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchHomeData = async () => {
      try {
        // Fetch Featured Listings
        const qListings = query(
          collection(db, 'listings'), 
          where('isApproved', '==', true),
          where('isFeatured', '==', true),
          limit(6)
        );
        const listingsSnap = await getDocs(qListings);
        const listingsData = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Listing[];
        setFeaturedListings(listingsData.length > 0 ? listingsData : DEMO_LISTINGS.filter(l => l.isFeatured));

        // Fetch Latest News
        const qNews = query(
          collection(db, 'news'), 
          where('isApproved', '==', true),
          limit(10)
        );
        const newsSnap = await getDocs(qNews);
        const newsData = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsArticle[];
        
        // Sort by publishDate (newest first) and limit to 6
        const sortedNews = newsData
          .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime())
          .slice(0, 6);

        setLatestNews(sortedNews.length > 0 ? sortedNews : DEMO_NEWS.slice(0, 6));

        // Fetch Events
        const qEvents = query(
          collection(db, 'events'), 
          where('isApproved', '==', true),
          limit(20)
        );
        const eventsSnap = await getDocs(qEvents);
        const eventsData = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Event[];
        
        // Show only upcoming events (today or after), sorted by date (closest first)
        const nowTime = new Date().setHours(0, 0, 0, 0);
        const sortedEvents = eventsData
          .filter(event => new Date(event.dateTime).getTime() >= nowTime)
          .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime())
          .slice(0, 6);
          
        setFeaturedEvents(sortedEvents.length > 0 ? sortedEvents : []);

        // Fetch Latest Jobs
        const qJobs = query(
          collection(db, 'jobs'), 
          where('isApproved', '==', true),
          limit(10)
        );
        const jobsSnap = await getDocs(qJobs);
        const jobsData = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Job[];
        
        // Sort by creation date (newest first)
        const sortedJobs = jobsData
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 4);

        setFeaturedJobs(sortedJobs.length > 0 ? sortedJobs : DEMO_JOBS);
      } catch (error) {
        console.error("Error fetching home data:", error);
      }
    };

    fetchHomeData();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/listings?search=${searchQuery}`);
  };

  return (
    <div className="p-4 md:p-8 space-y-8 md:space-y-12 animate-in fade-in duration-500 max-w-7xl mx-auto">
      <SEO 
        title="Home"
        description="Discover Halal restaurants, mosques, grocery stores, and Islamic organizations in Ottawa. Stay updated with local Muslim community news, events, and jobs."
        canonicalUrl="https://halalottawa.com"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          "name": "Halal Ottawa",
          "url": "https://halalottawa.com/",
          "description": "Discover Halal restaurants, mosques, grocery stores, and Islamic organizations in Ottawa.",
          "potentialAction": {
            "@type": "SearchAction",
            "target": "https://halalottawa.com/listings?search={search_term_string}",
            "query-input": "required name=search_term_string"
          }
        }}
      />

      <AdDisplay />

      <h1 className="sr-only">Halal Ottawa - Local Listings, News, Events, and Jobs</h1>

      {/* Hero & Search */}
      <section className="space-y-4">
        <form onSubmit={handleSearch} className="relative max-w-3xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search restaurants, mosques, jobs..."
            className="w-full pl-12 pr-4 py-4 bg-white border border-gray-100 rounded-2xl shadow-sm focus:ring-2 focus:ring-[#e90b35] focus:border-transparent transition-all outline-none"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </section>

      {/* Categories - Mobile Grid */}
      <section className="grid grid-cols-3 gap-3 md:hidden">
        {CATEGORIES.slice(0, 6).map((cat) => (
          <Link
            key={cat}
            to={`/${cat.toLowerCase()}`}
            className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all active:scale-95"
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
                  className="flex flex-col items-center gap-2 p-4 bg-white border border-gray-50 rounded-2xl hover:shadow-md transition-all h-full"
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

      {/* Featured Listings */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold">Featured Listings</h2>
          <Link to="/listings" className="text-[#e90b35] text-sm md:text-base font-semibold">View all</Link>
        </div>
        <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
          {featuredListings.map((listing) => (
            <Link
              key={listing.id}
              to={getListingUrl(listing)}
              className="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 group hover:shadow-md transition-all"
            >
              <div className="relative h-32 md:h-48">
                {listing.photos?.[0] ? (
                  <img src={listing.photos[0]} alt={listing.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-400 text-xs font-medium">No Image</span>
                  </div>
                )}
                <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>
                <div className="absolute bottom-3 right-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg flex items-center gap-1 text-xs font-bold">
                  <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                  {listing.averageRating}
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold leading-tight line-clamp-1">{listing.name}</h3>
                <p className="text-gray-500 text-xs font-semibold mt-2 flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-[#e90b35]" />
                  {listing.address.split(',')[0]}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest News */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold">Latest News</h2>
          <Link to="/news" className="text-[#e90b35] text-sm md:text-base font-semibold">View all</Link>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-4 md:space-y-0">
          {latestNews.map((news, index) => (
            <Link
              key={news.id}
              to={`/news/${news.slug || news.id}`}
              className={`bg-white hover:shadow-md transition-all border border-gray-50 group flex md:flex-col gap-4 md:gap-0 p-3 md:p-0 rounded-2xl md:rounded-3xl overflow-hidden shadow-sm ${index >= 3 ? 'hidden md:flex' : ''}`}
            >
              <div className="relative w-24 h-24 md:w-full md:h-48 shrink-0">
                {news.coverImage && news.coverImage.trim() !== '' ? (
                  <img src={news.coverImage} alt={news.title} className="w-full h-full object-cover rounded-xl md:rounded-none group-hover:scale-105 transition-transform duration-500" loading="lazy" />
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
          ))}
        </div>
      </section>

      {/* Featured Events */}
      {featuredEvents.length > 0 && (
        <section className="space-y-4">
          <div className="flex justify-between items-end">
            <h2 className="text-xl md:text-2xl font-bold">Upcoming Events</h2>
            <Link to="/events" className="text-[#e90b35] text-sm md:text-base font-semibold">View all</Link>
          </div>
          <div className="flex md:grid md:grid-cols-2 lg:grid-cols-4 gap-4 overflow-x-auto md:overflow-visible pb-4 md:pb-0 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
            {featuredEvents.map((event) => (
              <Link
                key={event.id}
                to={`/events/${event.slug || event.id}`}
                className="min-w-[240px] md:min-w-0 bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 hover:shadow-md transition-all"
              >
                <div className="relative h-32">
                  {event.coverImage && event.coverImage.trim() !== '' ? (
                    <img src={event.coverImage} alt={event.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-lg text-center shadow-lg">
                    <span className="block text-[10px] font-bold text-[#e90b35] uppercase">{new Date(event.dateTime).toLocaleString('default', { month: 'short' })}</span>
                    <span className="block text-lg font-black leading-none">{new Date(event.dateTime).getDate()}</span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-bold leading-tight line-clamp-1">{event.title}</h3>
                  <p className="text-[#e90b35] font-bold text-sm flex items-center gap-2 mt-1">
                    <User className="w-3 h-3" /> {event.organizer}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Latest Jobs */}
      <section className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl md:text-2xl font-bold">Latest Jobs</h2>
          <Link to="/jobs" className="text-[#e90b35] text-sm md:text-base font-semibold">View all</Link>
        </div>
        <div className="space-y-3 md:grid md:grid-cols-2 lg:grid-cols-2 md:gap-4 md:space-y-0">
          {featuredJobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.slug || job.id}`}
              className="block bg-white p-4 rounded-2xl border border-gray-50 shadow-sm hover:shadow-md transition-all"
            >
              <div className="flex gap-3 items-start">
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                  {job.companyLogo && job.companyLogo.trim() !== '' ? (
                    <img src={job.companyLogo} alt={job.company} className="w-full h-full object-cover" loading="lazy" />
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
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.type}</span>
              </div>
            </Link>
          ))}
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
  );
};
