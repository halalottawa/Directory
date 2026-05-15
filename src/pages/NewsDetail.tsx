import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Clock, User, ChevronLeft, ExternalLink, Edit2, Trash2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { NewsArticle } from '../types';
import { DEMO_NEWS } from '../constants';
import { CommentSection } from '../components/CommentSection';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SaveButton } from '../components/SaveButton';
import { formatDate } from '../utils/dateFormatter';
import { getOptimizedImageUrl } from '../utils/imageUtils';
import { SEO } from '../components/SEO';

export const NewsDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [article, setArticle] = useState<NewsArticle | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [relatedNews, setRelatedNews] = useState<NewsArticle[]>([]);

  useEffect(() => {
    const fetchArticle = async () => {
      if (!slug) return;
      
      let fetchedArticle: NewsArticle | null = null;
      // Check demo news first
      const found = DEMO_NEWS.find(n => n.id === slug || n.slug === slug);
      if (found) {
        fetchedArticle = found;
        setArticle(found);
      } else {
        // Fetch from Firestore
        try {
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
          
          if (articleData) {
            fetchedArticle = articleData;
            setArticle(articleData);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, `news/${slug}`);
        }
      }

      setLoading(false);

      if (fetchedArticle) {
        try {
          const qNews = query(collection(db, 'news'), where('isApproved', '==', true));
          const snap = await getDocs(qNews);
          const relatedFs = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as NewsArticle))
            .filter(n => n.id !== fetchedArticle!.id)
            .sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime());
            
          const relatedDemo = DEMO_NEWS.filter(n => n.id !== fetchedArticle!.id && n.id !== slug);
          const combined = [...relatedFs, ...relatedDemo].slice(0, 3);
          setRelatedNews(combined);
        } catch (err) {
          const relatedDemo = DEMO_NEWS.filter(n => n.id !== fetchedArticle!.id && n.id !== slug).slice(0, 3);
          setRelatedNews(relatedDemo);
        }
      }
    };

    fetchArticle();
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
      await deleteDoc(doc(db, 'news', article.id));
      navigate('/news');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `news/${article.id}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading article...</div>;
  if (!article) return <div className="p-8 text-center">Article not found.</div>;

  return (
    <>
      <div className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100 md:mb-12">
        <SEO
        title={article.title}
        description={article.content.length > 150 ? article.content.substring(0, 150) + '...' : article.content}
        canonicalUrl={`https://www.halalottawa.ca/news/${slug}`}
        ogImage={article.coverImage || undefined}
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
              "name": article.author || "Halal Ottawa Staff"
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

      <div className="relative h-64">
        {article.coverImage && article.coverImage.trim() !== '' ? (
          <img 
            src={getOptimizedImageUrl(article.coverImage, 800, 256)} 
            alt={article.title} 
            className="w-full h-full object-cover" 
            fetchPriority="high"
            width="800"
            height="256"
          />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 font-medium">No Image Available</span>
          </div>
        )}
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
          <div className="flex items-center gap-4 mt-3 text-xs text-white/80">
            <span className="flex items-center gap-2"><Clock className="w-3 h-3" strokeWidth={2.5} /> {formatDate(article.publishDate)}</span>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <article className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
          <ReactMarkdown>{article.content}</ReactMarkdown>
        </article>

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

          {/* Ad Placeholder */}
          <div className="bg-gray-100 h-32 rounded-2xl flex items-center justify-center text-gray-400 text-xs font-bold uppercase tracking-widest border-2 border-dashed border-gray-200">
            Advertisement
          </div>

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
        <div className="hidden md:block w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto mt-12 mb-16 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold mb-6">More News</h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedNews.map((related) => (
              <Link
                key={related.id}
                to={`/news/${related.slug || related.id}`}
                className="bg-white hover:shadow-md transition-all border border-gray-50 group flex flex-col rounded-3xl overflow-hidden shadow-sm"
              >
                <div className="relative w-full h-48 shrink-0">
                  {related.coverImage && related.coverImage.trim() !== '' ? (
                    <img 
                      src={getOptimizedImageUrl(related.coverImage, 400, 192)} 
                      alt={related.title} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      loading="lazy"
                      width="400"
                      height="192"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">No Image</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between p-5">
                  <h3 className="font-bold leading-tight group-hover:text-[#e90b35] transition-colors">{related.title}</h3>
                  <div className="flex items-center gap-4 mt-4 text-xs text-gray-400 font-semibold">
                    <span className="flex items-center gap-2"><Clock className="w-3 h-3" strokeWidth={2.5} /> {formatDate(related.publishDate)}</span>
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
