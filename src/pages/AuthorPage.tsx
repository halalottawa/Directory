import React, { useState, useEffect, useMemo } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Clock, Newspaper, Search, User, ArrowRight } from 'lucide-react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { NewsArticle } from '../types';
import { DEMO_NEWS } from '../constants';
import { formatDate } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { getPlainText } from '../utils/textUtils';
import { getAbsoluteUrl } from '../utils/url';
import { SEO } from '../components/SEO';
import { GooglePreferredSourceBadge } from '../components/GooglePreferredSourceBadge';

export const AuthorPage: React.FC = () => {
  const { slug } = useParams<{ slug?: string }>();
  const [articles, setArticles] = useState<NewsArticle[]>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_ROUTE_TYPE__ === 'author') {
      const initData = (window as any).__INITIAL_DATA__;
      if (initData && Array.isArray(initData.articles)) {
        return initData.articles;
      }
    }
    return DEMO_NEWS;
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const authorName = "Youssef Agrebi";
  const authorRole = "Editor • Halal Ottawa";
  const authorBio = 
    "Youssef Agrebi is an editor at Halal Ottawa with deep roots across the National Capital Region. Youssef is dedicated to reporting on local community announcements and Halal dining discoveries in Ottawa.";

  useEffect(() => {
    let isMounted = true;
    const fetchArticles = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'news'),
          where('isApproved', '==', true)
        );
        const snapshot = await getDocs(q);
        if (isMounted) {
          if (!snapshot.empty) {
            const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as NewsArticle[];
            // Filter by author name (case-insensitive) or include default articles authored by Youssef
            const authorArticles = fetched.filter(a => {
              if (!a.author) return true;
              return a.author.toLowerCase().trim() === authorName.toLowerCase().trim();
            });

            // Sort by publishDate descending
            authorArticles.sort((a, b) => {
              const timeA = new Date(a.publishDate || a.createdAt || 0).getTime();
              const timeB = new Date(b.publishDate || b.createdAt || 0).getTime();
              return timeB - timeA;
            });

            setArticles(authorArticles.length > 0 ? authorArticles : fetched);
          } else {
            setArticles(DEMO_NEWS);
          }
        }
      } catch (err) {
        console.error("Error fetching author articles:", err);
        if (isMounted) {
          setArticles(DEMO_NEWS);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchArticles();
    return () => { isMounted = false; };
  }, []);

  const filteredArticles = useMemo(() => {
    return articles.filter(article => {
      const matchesSearch = 
        (article.title && article.title.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (article.content && article.content.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesSearch;
    });
  }, [articles, searchQuery]);

  const authorProfileSchema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    "mainEntity": {
      "@type": "Person",
      "name": authorName,
      "alternateName": "Youssef Agrebi",
      "identifier": "youssef-agrebi",
      "jobTitle": authorRole,
      "worksFor": {
        "@type": "Organization",
        "name": "Halal Ottawa",
        "url": "https://www.halalottawa.ca"
      },
      "description": authorBio,
      "image": "https://www.halalottawa.ca/favicon.png",
      "url": "https://www.halalottawa.ca/author/youssef-agrebi",
      "sameAs": [
        "https://www.linkedin.com/in/youssef-agrebi-a05010aa/"
      ],
      "knowsAbout": [
        "Halal Dining in Ottawa",
        "Ottawa Muslim Community News",
        "Islamic Culture & Lifestyle",
        "Community Journalism"
      ],
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Ottawa",
        "addressRegion": "ON",
        "addressCountry": "CA"
      }
    }
  };

  const breadcrumbsSchema = {
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
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": authorName,
        "item": "https://www.halalottawa.ca/author/youssef-agrebi"
      }
    ]
  };

  return (
    <div className="p-4 md:p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl xl:max-w-[1400px] mx-auto min-h-screen">
      <SEO
        title={`${authorName} - Editor & Journalist | Halal Ottawa`}
        description={`Read all community news, investigative articles, and local announcements authored by ${authorName} on Halal Ottawa.`}
        canonicalUrl={getAbsoluteUrl("author/youssef-agrebi")}
        disableSuffix={true}
        structuredData={[authorProfileSchema, breadcrumbsSchema]}
      />

      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-gray-500 font-medium">
        <Link to="/" className="hover:text-[#e90b35] transition-colors">Home</Link>
        <span>/</span>
        <Link to="/news" className="hover:text-[#e90b35] transition-colors">News</Link>
        <span>/</span>
        <span className="text-gray-900 font-bold">{authorName}</span>
      </nav>

      {/* About Author Section */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            About {authorName}
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-relaxed max-w-3xl">
            {authorBio}
          </p>
          <div className="mt-2.5 flex items-center">
            <a
              href="https://www.linkedin.com/in/youssef-agrebi-a05010aa/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center justify-center group"
              title={`Connect with ${authorName} on LinkedIn`}
              aria-label={`Connect with ${authorName} on LinkedIn`}
            >
              <svg className="w-5 h-5 fill-current group-hover:scale-105 transition-transform shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 8.76a1.67 1.67 0 1 0 0-3.34 1.67 1.67 0 0 0 0 3.34m1.39 9.74v-8.37H5.07v8.37h2.78z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="shrink-0 pt-1">
          <GooglePreferredSourceBadge variant="button" />
        </div>
      </div>

      {/* Articles Section Header & Search Filter */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Articles by {authorName}
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              {searchQuery
                ? `Showing ${filteredArticles.length} result${filteredArticles.length === 1 ? '' : 's'} matching "${searchQuery}"`
                : `Explore ${filteredArticles.length} published ${filteredArticles.length === 1 ? 'story' : 'stories'}, community announcements, and halal dining discoveries across Ottawa.`}
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search articles..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-2xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-[#e90b35] shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Articles Grid */}
        {filteredArticles.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm max-w-lg mx-auto">
            <Newspaper className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-gray-800">No Articles Found</h3>
            <p className="text-gray-500 text-sm mt-1">
              {searchQuery ? `No articles matching "${searchQuery}".` : 'No articles published under this filter yet.'}
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article, idx) => (
              <Link
                key={article.id}
                to={`/news/${article.slug || article.id}`}
                className="bg-white hover:shadow-md transition-all border border-gray-100 group flex flex-col rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="relative h-48 shrink-0 bg-gray-100 overflow-hidden">
                  {article.coverImage && article.coverImage.trim() !== '' ? (
                    <img
                      src={getOptimizedImageUrl(article.coverImage, 400, 192)}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading={idx < 3 ? "eager" : "lazy"}
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
                    <div className="absolute top-3 left-3 bg-[#e90b35] text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider shadow">
                      Featured
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between p-5 sm:p-6">
                  <div>
                    <h3 className="font-bold text-base sm:text-lg leading-snug text-gray-900 group-hover:text-[#e90b35] transition-colors line-clamp-2">
                      {article.title}
                    </h3>
                    <p className="text-gray-500 text-xs sm:text-sm line-clamp-3 leading-relaxed mt-2.5">
                      {getPlainText(article.content)}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                      {formatDate(article.publishDate || article.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5 text-gray-500 hover:text-[#e90b35] font-medium transition-colors cursor-pointer shrink-0">
                      <User className="w-3.5 h-3.5 text-gray-400" strokeWidth={2.5} />
                      <span className="hover:underline">Read More</span>
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
