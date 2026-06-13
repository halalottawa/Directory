import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Newspaper, ChevronRight, Search, Plus, User, Clock } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { NewsArticle } from '../types';
import { DEMO_NEWS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { formatDate } from '../utils/dateFormatter';
import { AdDisplay } from '../components/AdDisplay';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { getAbsoluteUrl } from '../utils/url';
import { SEO } from '../components/SEO';
import { isAppWrapper } from '../utils/platform';

export const News: React.FC = () => {
  const { user } = useAuth();
  const [news, setNews] = useState<NewsArticle[]>(DEMO_NEWS);
  const [searchQuery, setSearchQuery] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8);

  useEffect(() => {
    const q = user?.role === 'admin' 
      ? query(collection(db, 'news')) 
      : query(collection(db, 'news'), where('isApproved', '==', true));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const firestoreNews = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as NewsArticle[];

      // Sort client-side: Featured first, then by date
      firestoreNews.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      // Merge with demo data
      const allNews = [...firestoreNews, ...DEMO_NEWS];
      
      // Sort allNews as well
      allNews.sort((a, b) => {
        if (a.isFeatured && !b.isFeatured) return -1;
        if (!a.isFeatured && b.isFeatured) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Filter by search query
      const filtered = allNews.filter(article => 
        article.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        article.content.toLowerCase().includes(searchQuery.toLowerCase())
      );

      setNews(filtered);
      setCurrentPage(1); // Reset to first page on search
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'news');
    });

    return () => unsubscribe();
  }, [searchQuery, user]);

  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 768 : false);
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    setIsApp(isAppWrapper());
    const handleResize = () => {
      if (typeof window === 'undefined') return;
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 1024) {
        setItemsPerPage(9);
      } else {
        setItemsPerPage(8);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shouldUseInfiniteScroll = isMobile && isApp;

  const totalPages = Math.ceil(news.length / itemsPerPage);
  const currentNews = news.slice(
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

  return (
    <div className="p-4 md:p-8 space-y-6 md:space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto">
      <SEO 
        title="Ottawa News - Halal Ottawa" 
        description="Stay up to date with the latest stories, local community announcements, highlights, and Muslim lifestyle news in the Ottawa region." 
        canonicalUrl={getAbsoluteUrl("news")} 
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
              "name": "News",
              "item": "https://www.halalottawa.ca/news"
            }
          ]
        }}
      />

      <AdDisplay />

      <div className="flex justify-between items-center">
        <h1 className="text-2xl md:text-3xl font-bold">News</h1>
        {user?.role === 'admin' && (
          <Link 
            to="/news/add" 
            className="bg-[#e90b35] text-white p-2 md:p-3 rounded-full shadow-lg active:scale-95 transition-all text-sm font-bold flex items-center justify-center hover:bg-[#d00a2f]"
          >
            <Plus className="w-6 h-6 md:w-5 md:h-5" />
          </Link>
        )}
      </div>

      <div className="relative w-full">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search community news, announcements, and articles..."
          className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {currentNews.map((article, idx) => (
          <Link
            key={article.id}
            to={`/news/${article.slug || article.id}`}
            className="block bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-all border border-gray-50 group flex flex-col"
          >
            <div className="relative h-48 shrink-0">
              {article.coverImage && article.coverImage.trim() !== '' ? (
                <img 
                  src={getOptimizedImageUrl(article.coverImage, 400, 192)} 
                  alt={article.title} 
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
              {article.isFeatured && (
                <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Featured</div>
              )}
              {!article.isApproved && (
                <div className="absolute top-3 right-3 bg-yellow-500 text-white text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest">Pending</div>
              )}
            </div>
            <div className="p-5 flex flex-col justify-between flex-1">
              <div>
                <h2 className="text-lg font-bold leading-tight group-hover:text-[#e90b35] transition-colors">{article.title}</h2>
                <p className="text-gray-500 text-sm line-clamp-2 leading-relaxed mt-2">{article.content}</p>
              </div>
              <div className="pt-4 flex justify-between items-end">
                <div className="flex items-center gap-4 text-xs text-gray-400 font-semibold">
                  <span className="flex items-center gap-2"><Clock className="w-3 h-3" strokeWidth={2.5} /> {formatDate(article.publishDate)}</span>
                </div>
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
            <ChevronRight className="w-5 h-5 text-gray-600 rotate-180" />
          </button>
          
          <div className="flex items-center gap-1.5 md:gap-2">
            {[...Array(totalPages)].map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-xl font-bold text-xs md:text-sm transition-all ${
                  currentPage === i + 1 
                    ? 'bg-[#e90b35] text-white shadow-md' 
                    : 'bg-white text-gray-650 hover:bg-gray-50 border border-gray-100'
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
            <ChevronRight className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      )}
    </div>
  );
};
