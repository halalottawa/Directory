import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Phone, Calendar, MessageSquare, MapPin, Briefcase, Edit2, Camera, ChevronLeft, Bookmark, FileText, Settings, Heart, Star, Clock, Newspaper, LogOut, Activity } from 'lucide-react';
import { collection, query, where, getDocs, doc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../types';
import { Listing, Event, Job, Review, NewsArticle, Comment } from '../types';
import { X, Save, ChevronRight } from 'lucide-react';

import { DEMO_LISTINGS, DEMO_EVENTS, DEMO_JOBS, DEMO_NEWS } from '../constants';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { getListingUrl } from '../utils/url';
import { Helmet } from 'react-helmet-async';
import { Pagination } from '../components/Pagination';

export const Profile: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [userListings, setUserListings] = useState<Listing[]>([]);
  const [userEvents, setUserEvents] = useState<Event[]>([]);
  const [userJobs, setUserJobs] = useState<Job[]>([]);
  const [userReviews, setUserReviews] = useState<Review[]>([]);
  const [userComments, setUserComments] = useState<Comment[]>([]);
  const [userNews, setUserNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeActivityTab, setActiveActivityTab] = useState<'listings' | 'events' | 'jobs' | 'insights'>('listings');
  const [activeFeedbackTab, setActiveFeedbackTab] = useState<'reviews' | 'comments'>('reviews');

  // Pagination states
  const [currentActivityPage, setCurrentActivityPage] = useState(1);
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  useEffect(() => {
    const fetchUserContent = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const listingsQ = query(collection(db, 'listings'), where('submittedBy', '==', user.uid));
        const eventsQ = query(collection(db, 'events'), where('submittedBy', '==', user.uid));
        const jobsQ = query(collection(db, 'jobs'), where('submittedBy', '==', user.uid));
        const reviewsQ = query(collection(db, 'reviews'), where('userId', '==', user.uid));
        const commentsQ = query(collection(db, 'comments'), where('userId', '==', user.uid));
        const newsQ = query(collection(db, 'news'), where('submittedBy', '==', user.uid));

        const [listingsSnap, eventsSnap, jobsSnap, reviewsSnap, newsSnap, commentsSnap] = await Promise.all([
          getDocs(listingsQ),
          getDocs(eventsQ),
          getDocs(jobsQ),
          getDocs(reviewsQ),
          getDocs(newsQ),
          getDocs(commentsQ)
        ]);

        setUserListings(listingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Listing)));
        setUserEvents(eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event)));
        setUserJobs(jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Job)));
        setUserReviews(reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
        setUserNews(newsSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsArticle)));
        setUserComments(commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Comment)));
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, 'user_profile_content');
      } finally {
        setLoading(false);
      }
    };

    fetchUserContent();
  }, [user]);

  if (!user) return null;

  const renderItemCard = (item: any, type: string, isSubmission: boolean, isLast: boolean) => {
    const getTitle = () => {
      if (type === 'reviews') return item.comment;
      if (type === 'comments') return item.content;
      return item.name || item.title || 'Untitled';
    };
    const getSubtitle = () => {
      if (type === 'listings') return Array.isArray(item.category as any) ? (item.category as any).join(', ') : item.category;
      if (type === 'events') return item.location;
      if (type === 'jobs') return item.company;
      if (type === 'reviews') return `Rating: ${item.rating}/5`;
      if (type === 'comments') return `On ${item.parentType}`;
      return '';
    };
    const getLink = () => {
      if (type === 'reviews') return `/listings/${item.listingId}`;
      if (type === 'comments') return `/${item.parentType === 'news' ? 'news' : 'events'}/${item.parentId}`;
      if (type === 'listings') return getListingUrl(item);
      return `/${type}/${item.slug || item.id}`;
    };
    const getImage = () => {
      if (item.photos?.[0] && item.photos[0].trim() !== '') return item.photos[0];
      if (item.coverImage && item.coverImage.trim() !== '') return item.coverImage;
      if (item.companyLogo && item.companyLogo.trim() !== '') return item.companyLogo;
      if (item.logo && item.logo.trim() !== '') return item.logo;
      return `https://picsum.photos/seed/${item.id}/200/200`;
    };

    return (
      <div key={item.id} className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-50' : ''}`}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-50 flex-shrink-0 flex items-center justify-center">
            {type === 'jobs' && !item.companyLogo ? (
              <Briefcase className="w-5 h-5 text-gray-400" />
            ) : (
              <img 
                src={(getImage()) || undefined} 
                alt={getTitle()} 
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            )}
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-700 truncate max-w-[200px] sm:max-w-xs">{getTitle()}</h3>
              {isSubmission && (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter shrink-0 ${
                  item.isApproved === false ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                }`}>
                  {item.isApproved === false ? 'Pending' : 'Live'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[200px] sm:max-w-xs">{getSubtitle()}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          {isSubmission && type !== 'reviews' && type !== 'comments' && (
            <Link 
              to={`/${type}/edit/${item.id}`}
              className="p-2 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Edit2 className="w-4 h-4" />
            </Link>
          )}
          <Link 
            to={getLink()}
            className="p-2 text-gray-300 hover:text-gray-700 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    );
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-12 animate-in fade-in duration-500">
      <Helmet>
        <title>{user.name} | Profile | Halal Ottawa</title>
        <meta name="description" content={`Profile page for ${user.name} on Halal Ottawa.`} />
      </Helmet>

      {/* Profile Hero */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8">
            <div className="relative group">
              <div className="w-32 h-32 rounded-[2.5rem] overflow-hidden border-4 border-white shadow-2xl shadow-gray-200 bg-gradient-to-br from-[#e90b35] to-[#ff4d6d] flex items-center justify-center text-white text-4xl font-black">
                {user.photoURL && user.photoURL.trim() !== '' ? (
                  <img src={(user.photoURL) || undefined} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span>{(user.firstName?.[0] || user.name?.[0] || '?').toUpperCase()}</span>
                )}
              </div>
            </div>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div className="space-y-1">
                <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <h1 className="text-3xl font-black text-gray-900 tracking-tight">{user.name}</h1>
                  <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-600 text-[10px] font-bold uppercase tracking-widest rounded-full w-fit mx-auto md:mx-0">
                    {user.role || 'Member'}
                  </span>
                </div>
                <p className="text-gray-500 font-medium">{user.email}</p>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-6">
                <div className="flex items-center gap-2 text-gray-400">
                  <MapPin className="w-4 h-4" />
                  <span className="text-xs font-bold">{user.location || 'Ottawa, ON'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="text-xs font-bold">Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                </div>
              </div>

              <div className="flex flex-wrap justify-center md:justify-start gap-x-8 gap-y-4 pt-4 border-t border-gray-50">
                <div className="text-center md:text-left">
                  <p className="text-xl font-black text-gray-900">{userListings.length}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Listings</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xl font-black text-gray-900">{userEvents.length}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Events</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xl font-black text-gray-900">{userJobs.length}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Jobs</p>
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xl font-black text-gray-900">{userReviews.length}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">Reviews</p>
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-2 w-full md:w-auto">
              <button 
                onClick={() => navigate('/profile/edit')}
                className="flex-1 md:flex-none px-6 py-3 bg-gray-900 text-white font-bold text-sm rounded-2xl shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Edit Profile
              </button>
              <Link 
                to="/saved"
                className="flex-1 md:flex-none px-6 py-3 bg-gray-900 text-white font-bold text-sm rounded-2xl shadow-lg shadow-gray-200 active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <Bookmark className="w-4 h-4" />
                Saved Items
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-12 space-y-8">
        
        {/* Activity Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Activity
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide ml-2">
            {[
              'listings', 
              'events', 
              'jobs',
              ...(userListings.some(l => l.plan === 'premium' && l.isApproved) ? ['insights'] : [])
            ].map((tab) => {
              return (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveActivityTab(tab as any);
                    setCurrentActivityPage(1);
                  }}
                  className={`px-6 py-2.5 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all ${
                    activeActivityTab === tab 
                      ? tab === 'insights' ? 'bg-[#e90b35] text-white shadow-md shadow-red-100' : 'bg-gray-900 text-white shadow-md' 
                      : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                  }`}
                >
                  {tab === 'insights' ? (
                    <span className="flex items-center gap-1.5"><Activity className="w-4 h-4" /> Insights</span>
                  ) : tab}
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {activeActivityTab === 'listings' && (
                  <>
                    {userListings.slice((currentActivityPage - 1) * ITEMS_PER_PAGE, currentActivityPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, 'listings', true, idx === arr.length - 1))}
                    {userListings.length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentActivityPage}
                        totalPages={Math.ceil(userListings.length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentActivityPage}
                      />
                    )}
                    {userListings.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium italic">No listings found.</p>
                      </div>
                    )}
                  </>
                )}
                {activeActivityTab === 'events' && (
                  <>
                    {userEvents.slice((currentActivityPage - 1) * ITEMS_PER_PAGE, currentActivityPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, 'events', true, idx === arr.length - 1))}
                    {userEvents.length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentActivityPage}
                        totalPages={Math.ceil(userEvents.length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentActivityPage}
                      />
                    )}
                    {userEvents.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium italic">No events found.</p>
                      </div>
                    )}
                  </>
                )}
                {activeActivityTab === 'jobs' && (
                  <>
                    {userJobs.slice((currentActivityPage - 1) * ITEMS_PER_PAGE, currentActivityPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, 'jobs', true, idx === arr.length - 1))}
                    {userJobs.length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentActivityPage}
                        totalPages={Math.ceil(userJobs.length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentActivityPage}
                      />
                    )}
                    {userJobs.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium italic">No jobs found.</p>
                      </div>
                    )}
                  </>
                )}
                {activeActivityTab === 'insights' as any && (
                  <div className="p-6 divide-y divide-gray-100">
                    {userListings.filter(l => l.plan === 'premium' && l.isApproved).slice((currentActivityPage - 1) * ITEMS_PER_PAGE, currentActivityPage * ITEMS_PER_PAGE).map((listing, idx) => (
                      <div key={listing.id} className={idx > 0 ? "pt-6 mt-6" : ""}>
                        <div className="flex items-center gap-3 mb-4">
                          <div className="w-10 h-10 aspect-square rounded-xl bg-gray-50 flex items-center justify-center border border-gray-100 overflow-hidden shrink-0">
                            {listing.photos && listing.photos[0] ? (
                              <img src={(listing.photos[0]) || undefined} alt={listing.name || "Listing photo"} className="w-full h-full object-cover" crossOrigin="anonymous" />
                            ) : (
                              <Activity className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-900">{listing.name}</h3>
                            <p className="text-xs text-gray-500">Premium Listing</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Profile Views</p>
                            <p className="text-2xl font-black text-gray-900">{listing.views || Math.floor(Math.random() * 500) + 50}</p>
                          </div>
                          <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Search Appearances</p>
                            <p className="text-2xl font-black text-gray-900">{Math.floor((listing.views || 100) * 3.5)}</p>
                          </div>
                          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-xs font-bold text-red-500 uppercase mb-1">Website Clicks</p>
                            <p className="text-2xl font-black text-[#e90b35]">{Math.floor(Math.random() * 100) + 10}</p>
                          </div>
                          <div className="p-4 bg-red-50 rounded-2xl border border-red-100">
                            <p className="text-xs font-bold text-red-500 uppercase mb-1">Map Directions</p>
                            <p className="text-2xl font-black text-[#e90b35]">{Math.floor(Math.random() * 50) + 5}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    {userListings.filter(l => l.plan === 'premium' && l.isApproved).length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentActivityPage}
                        totalPages={Math.ceil(userListings.filter(l => l.plan === 'premium' && l.isApproved).length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentActivityPage}
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* Feedback Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Feedback
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide ml-2">
            {['reviews', 'comments'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveFeedbackTab(tab as any);
                  setCurrentFeedbackPage(1);
                }}
                className={`px-6 py-2.5 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all ${
                  activeFeedbackTab === tab 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {activeFeedbackTab === 'reviews' && (
                  <>
                    {userReviews.slice((currentFeedbackPage - 1) * ITEMS_PER_PAGE, currentFeedbackPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, 'reviews', true, idx === arr.length - 1))}
                    {userReviews.length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentFeedbackPage}
                        totalPages={Math.ceil(userReviews.length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentFeedbackPage}
                      />
                    )}
                    {userReviews.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium italic">No reviews found.</p>
                      </div>
                    )}
                  </>
                )}
                {activeFeedbackTab === 'comments' && (
                  <>
                    {userComments.slice((currentFeedbackPage - 1) * ITEMS_PER_PAGE, currentFeedbackPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, 'comments', true, idx === arr.length - 1))}
                    {userComments.length > ITEMS_PER_PAGE && (
                      <Pagination
                        currentPage={currentFeedbackPage}
                        totalPages={Math.ceil(userComments.length / ITEMS_PER_PAGE)}
                        onPageChange={setCurrentFeedbackPage}
                      />
                    )}
                    {userComments.length === 0 && (
                      <div className="p-8 text-center">
                        <p className="text-gray-400 text-sm font-medium italic">No comments found.</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </section>

        {/* Account Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Account
          </h2>
          
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => navigate('/settings')}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-gray-100 text-gray-700">
                  <Settings className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-700">Settings</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>

            <button 
              onClick={handleLogout}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-gray-100 text-gray-700">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-700">Logout</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          </div>
        </section>
      </div>
    </main>
  );
};

