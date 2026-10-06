import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, User, ChevronLeft, ChevronRight, ExternalLink, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { NewsArticle } from '../types';
import { CommentSection } from '../components/CommentSection';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SaveButton } from '../components/SaveButton';
import { formatDate } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { getAbsoluteUrl } from '../utils/url';
import { SEO } from '../components/SEO';
import { NotFound } from './NotFound';
import { ArticleAd } from '../components/ArticleAd';
import { GooglePreferredSourceBadge } from '../components/GooglePreferredSourceBadge';
import { notifyContentChanged } from '../utils/revalidate';

function renderInlineMarkdown(text: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  const tokenRegex = /(!\[([^\]]*)\]\(([^)]+)\)|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    if (match[1].startsWith('![')) {
      const alt = match[2] || 'Article Photo';
      const rawSrc = match[3] || '';
      const [cleanSrc, hash] = rawSrc.split('#');
      const hashParts = (hash || '').split('-');
      const alignment = hashParts[0] || 'center';
      const posX = hashParts[1] !== undefined ? `${hashParts[1]}%` : '50%';
      const posY = hashParts[2] !== undefined ? `${hashParts[2]}%` : '50%';

      let imgClass =
        'rounded-2xl my-6 mx-auto shadow-md border border-gray-100 max-h-[480px] object-cover w-full md:max-w-[100%] block clear-both';
      if (alignment === 'left') {
        imgClass =
          'rounded-2xl my-3 mr-6 md:float-left shadow-md border border-gray-100 max-h-[350px] object-cover w-full md:max-w-[45%] block md:inline clear-none';
      } else if (alignment === 'right') {
        imgClass =
          'rounded-2xl my-3 ml-6 md:float-right shadow-md border border-gray-100 max-h-[350px] object-cover w-full md:max-w-[45%] block md:inline clear-none';
      }
      nodes.push(
        <img
          key={`img-${keyIdx++}`}
          src={cleanSrc}
          alt={alt}
          className={imgClass}
          style={{ objectPosition: `${posX} ${posY}` }}
          referrerPolicy="no-referrer"
          loading="lazy"
          decoding="async"
        />
      );
    } else if (match[4] !== undefined && match[5] !== undefined) {
      nodes.push(
        <a
          key={`a-${keyIdx++}`}
          href={match[5]}
          target={match[5].startsWith('http') ? '_blank' : undefined}
          rel={match[5].startsWith('http') ? 'noopener noreferrer' : undefined}
          className="text-[#e90b35] hover:underline font-medium"
        >
          {match[4]}
        </a>
      );
    } else if (match[6] !== undefined) {
      nodes.push(<strong key={`b-${keyIdx++}`}>{match[6]}</strong>);
    } else if (match[7] !== undefined) {
      nodes.push(<em key={`i-${keyIdx++}`}>{match[7]}</em>);
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function renderMarkdownBlocks(content: string): React.ReactNode {
  const blocks = content.split(/\r?\n\s*\r?\n/);
  return blocks.map((block, idx) => {
    const trimmed = block.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('### ')) {
      return (
        <h3 key={idx} className="text-lg font-bold text-gray-900 mt-4 mb-2">
          {renderInlineMarkdown(trimmed.slice(4))}
        </h3>
      );
    }
    if (trimmed.startsWith('## ')) {
      return (
        <h2 key={idx} className="text-xl font-bold text-gray-900 mt-6 mb-2">
          {renderInlineMarkdown(trimmed.slice(3))}
        </h2>
      );
    }
    if (trimmed.startsWith('# ')) {
      return (
        <h1 key={idx} className="text-2xl font-bold text-gray-900 mt-6 mb-3">
          {renderInlineMarkdown(trimmed.slice(2))}
        </h1>
      );
    }
    return (
      <p key={idx} className="mb-4 last:mb-0">
        {renderInlineMarkdown(trimmed)}
      </p>
    );
  });
}

export const NewsDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState<NewsArticle | null>(() => {
    if (typeof window !== 'undefined' && (window as any).__INITIAL_ROUTE_TYPE__ === 'news') {
      const initData = (window as any).__INITIAL_DATA__ as NewsArticle;
      if (initData && (initData.slug === slug || initData.id === slug)) {
        delete (window as any).__INITIAL_DATA__;
        delete (window as any).__INITIAL_ROUTE_TYPE__;
        return initData;
      }
    }
    return null;
  });
  const initialSSRArticleRef = useRef<boolean>(
    Boolean(article && (article.slug === slug || article.id === slug))
  );
  const [loading, setLoading] = useState(article === null);
  const [modalOpen, setModalOpen] = useState(false);
  const [relatedNews, setRelatedNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    let isMounted = true;
    const parseNewsDate = (item: any): number => {
      const val = item.publishDate || item.createdAt;
      if (!val) return 0;
      if (typeof val === 'number') return val;
      if (typeof val.toDate === 'function') return val.toDate().getTime();
      if (typeof val.seconds === 'number') return val.seconds * 1000;
      const d = new Date(val);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    };

    const fetchArticleAndRelated = async () => {
      if (!slug) return;

      let fetchedArticle: NewsArticle | null =
        initialSSRArticleRef.current && article && (article.slug === slug || article.id === slug)
          ? article
          : null;
      initialSSRArticleRef.current = false;

      let apiNewsList: NewsArticle[] = [];
      try {
        const res = await fetch('/api/news');
        if (res.ok) {
          const data = await res.json();
          apiNewsList = Array.isArray(data?.news) ? (data.news as NewsArticle[]) : [];
          if (!fetchedArticle) {
            fetchedArticle = apiNewsList.find((n) => n.id === slug || n.slug === slug) || null;
            if (fetchedArticle && isMounted) {
              setArticle(fetchedArticle);
            }
          }
        }
      } catch {
        // Fallback handled below
      }

      if (!fetchedArticle) {
        try {
          const [{ doc, getDoc, collection, query, where, getDocs }, { db }, { DEMO_NEWS }] =
            await Promise.all([
              import('firebase/firestore'),
              import('../firebase'),
              import('../constants'),
            ]);
          const foundDemo = DEMO_NEWS.find((n) => n.id === slug || n.slug === slug);
          if (foundDemo) {
            fetchedArticle = foundDemo;
            if (isMounted) setArticle(foundDemo);
          } else {
            let docSnap = await getDoc(doc(db, 'news', slug));
            let articleData: NewsArticle | null = null;
            if (docSnap.exists()) {
              articleData = { id: docSnap.id, ...docSnap.data() } as NewsArticle;
            } else {
              const q = query(collection(db, 'news'), where('slug', '==', slug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                docSnap = querySnapshot.docs[0];
                articleData = { id: docSnap.id, ...docSnap.data() } as NewsArticle;
              }
            }

            if (!articleData) {
              const redirectSnap = await getDoc(doc(db, 'slug_redirects', `news_${slug}`));
              if (redirectSnap.exists()) {
                const rData = redirectSnap.data();
                if (rData && rData.newSlug) {
                  if (isMounted) navigate(`/news/${rData.newSlug}`, { replace: true });
                  return;
                }
              }
            }

            if (articleData) {
              fetchedArticle = articleData;
              if (isMounted) setArticle(articleData);
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `news/${slug}`);
        }
      }

      if (isMounted) setLoading(false);

      if (fetchedArticle && apiNewsList.length > 0 && isMounted) {
        const related = apiNewsList
          .filter((n) => n.id !== fetchedArticle!.id && n.slug !== fetchedArticle!.slug)
          .sort((a, b) => parseNewsDate(b) - parseNewsDate(a))
          .slice(0, 3);
        setRelatedNews(related);
      }
    };

    fetchArticleAndRelated();
    return () => {
      isMounted = false;
    };
  }, [slug]);

  const onEdit = () => {
    if (!article) return;
    navigate(`/news/edit/${article.id}`);
  };

  const onDelete = async () => {
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!article) return;
    try {
      const [{ deleteDoc, doc }, { db }] = await Promise.all([
        import('firebase/firestore'),
        import('../firebase'),
      ]);
      await deleteDoc(doc(db, 'news', article.id));
      if (article.isApproved) {
        notifyContentChanged('news:delete', {
          collection: 'news',
          docId: article.id,
          isApproved: true,
        });
      }
      navigate('/news');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `news/${article.id}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4" style={{ minHeight: 'calc(100vh - 80px)' }}>
      <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin"></div>
    </div>
  );
  if (!article) return <NotFound />;

  return (
    <>
      <div className="md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
        <SEO
        title={article.title}
        description={article.content.length > 150 ? article.content.substring(0, 150) + '...' : article.content}
        canonicalUrl={getAbsoluteUrl(`news/${article.slug || article.id}`)}
        ogImage={article.coverImage ? getAbsoluteUrl(article.coverImage) : undefined}
        ogType="article"
        structuredData={[
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": article.title,
            "image": article.coverImage || "https://www.halalottawa.ca/default-og.jpg",
            "datePublished": article.publishDate,
            "author": {
              "@type": "Person",
              "name": article.author || "Youssef Agrebi",
              "url": "https://www.halalottawa.ca/author/youssef-agrebi"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Halal Ottawa",
              "logo": {
                "@type": "ImageObject",
                "url": "https://www.halalottawa.ca/logo.png"
              }
            }
          },
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
                "name": "News",
                "item": "https://www.halalottawa.ca/news"
              },
              {
                "@type": "ListItem",
                "position": 3,
                "name": article.title
              }
            ]
          }
        ]}
      />

      <div className="relative h-64 bg-gray-100 overflow-hidden">
        <img 
          src={getOptimizedImageUrl(article.coverImage && article.coverImage.trim() !== '' ? article.coverImage : '/ottawa-sunset.webp', 800, 256)} 
          alt={article.title} 
          className="w-full h-full object-cover" 
          fetchPriority="high"
          loading="eager"
          width="800"
          height="256"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute top-6 right-6 flex gap-2">
          <SaveButton id={article.id} type="news" variant="glass" />
          {(user?.uid === article.submittedBy || user?.role === 'admin') && (
            <>
              <button onClick={onEdit} className="p-2 bg-white/20 backdrop-blur-md rounded-full text-white hover:bg-white/30 transition-all">
                <Edit2 className="w-5 h-5" />
              </button>
              <button onClick={onDelete} className="p-2 bg-red-500/20 backdrop-blur-md rounded-full text-white hover:bg-red-500/40 transition-all">
                <Trash2 className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
        <div className="absolute bottom-6 left-6 right-6 text-white">
          <h1 className="text-2xl font-bold leading-tight">{article.title}</h1>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 text-xs text-white/90">
            <span className="flex items-center gap-2"><Clock className="w-3.5 h-3.5" strokeWidth={2.5} /> {formatDate(article.publishDate)}</span>
            {(article.author || 'Youssef Agrebi') && (
              <Link 
                to="/author/youssef-agrebi"
                className="flex items-center gap-2 text-white/95 hover:text-white font-medium hover:underline transition-all group"
                title="View Youssef Agrebi author profile"
              >
                <User className="w-3.5 h-3.5 text-white/80 group-hover:text-white" strokeWidth={2.5} />
                <span>By {article.author || 'Youssef Agrebi'}</span>
              </Link>
            )}
            <GooglePreferredSourceBadge variant="compact" className="bg-white/95 hover:bg-white text-gray-900 border-none shadow-sm" />
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {(() => {
          const paragraphs = article.content ? article.content.split(/\r?\n\s*\r?\n/) : [];
          const numParagraphs = paragraphs.length;

          const renderMd = (content: string) => {
            if (!content || !content.trim()) return null;
            return (
              <article className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap flow-root overflow-hidden">
                {renderMarkdownBlocks(content)}
              </article>
            );
          };

          if (numParagraphs <= 1) {
            return (
              <>
                {renderMd(article.content || '')}
                <ArticleAd />
              </>
            );
          }

          const idx1 = Math.floor(numParagraphs / 2);
          const idx2 = idx1 * 2;

          const firstPart = paragraphs.slice(0, idx1).join('\n\n');
          const secondPart = paragraphs.slice(idx1, idx2).join('\n\n');
          const thirdPart = paragraphs.slice(idx2).join('\n\n');

          return (
            <>
              {renderMd(firstPart)}
              <ArticleAd />
              {renderMd(secondPart)}
              <ArticleAd />
              {thirdPart.trim() ? renderMd(thirdPart) : null}
            </>
          );
        })()}

          {article.sourceLink && (
            <div className="flex justify-center">
              <a 
                href={article.sourceLink.startsWith('http') ? article.sourceLink : `https://${article.sourceLink}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-8 py-4 bg-[#e90b35] text-white rounded-2xl font-bold text-sm shadow-lg shadow-red-100 active:scale-95 transition-all"
              >
                <ExternalLink className="w-4 h-4" /> Learn More
              </a>
            </div>
          )}

        {/* Google Preferred Source & Author Banner */}
        <GooglePreferredSourceBadge 
          variant="banner" 
          className="my-6" 
          authorName={article.author || 'Youssef Agrebi'}
        />

        <CommentSection parentId={article.id} parentType="news" />
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Article"
        message={`Are you sure you want to delete "${article?.title}"? This action cannot be undone.`}
      />
      </div>

      {/* Related News - Desktop Only */}
      {relatedNews.length > 0 && (
        <div className="hidden md:block w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto mt-12 mb-16">
          <h2 className="text-2xl font-bold mb-6">More News</h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedNews.map((related) => (
              <Link
                key={related.id}
                to={`/news/${related.slug || related.id}`}
                className="bg-white hover:shadow-md transition-all border border-gray-50 group flex flex-col rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="relative w-full h-48 shrink-0 bg-gray-100">
                  {related.coverImage && related.coverImage.trim() !== '' ? (
                    <img 
                      src={getOptimizedImageUrl(related.coverImage, 400, 192)} 
                      alt={related.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy"
                      width="400"
                      height="192"
                      decoding="async"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between p-5">
                  <h3 className="font-bold leading-tight group-hover:text-[#e90b35] transition-colors">{related.title}</h3>
                  <div className="pt-4 flex justify-between items-end border-t border-gray-50 mt-4">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400 font-semibold">
                      <span className="flex items-center gap-1.5"><Clock className="w-3 h-3" strokeWidth={2.5} /> {formatDate(related.publishDate)}</span>
                    </div>
                    <span className="flex items-center gap-1.5 text-gray-500 hover:text-[#e90b35] font-medium transition-colors cursor-pointer shrink-0">
                      <User className="w-3 h-3 text-gray-400" strokeWidth={2.5} />
                      <span className="hover:underline">Read More</span>
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
