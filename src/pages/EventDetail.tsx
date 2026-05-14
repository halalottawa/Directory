import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { Calendar, MapPin, User, ChevronLeft, ExternalLink, Clock, Plus, Edit2, Trash2, X, ClipboardCheck } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { doc, getDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { Event } from '../types';
import { DEMO_EVENTS } from '../constants';
import { CommentSection } from '../components/CommentSection';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { SaveButton } from '../components/SaveButton';
import { formatDate, formatTime } from '../utils/dateFormatter';
import { SEO } from '../components/SEO';

export const EventDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(location.state?.event || null);
  const [loading, setLoading] = useState(!location.state?.event);
  const [modalOpen, setModalOpen] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);

  const [infoModal, setInfoModal] = useState<{
    isOpen: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    isOpen: false,
    title: '',
    content: null,
  });

  const handleInfoClick = (title: string, value: string, icon: React.ReactNode, actionLabel?: string, onAction?: () => void, hideValue?: boolean) => {
    setInfoModal({
      isOpen: true,
      title,
      content: (
        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 bg-red-50 rounded-3xl flex items-center justify-center text-[#e90b35]">
            {icon}
          </div>
          {!hideValue && (
            <p className="text-[13px] font-semibold text-gray-900 text-center break-all px-4">{value}</p>
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

  useEffect(() => {
    const fetchEvent = async () => {
      if (!slug) return;
      
      let fetchedEvent: Event | null = event;

      if (!fetchedEvent) {
        // Check demo events first
        const found = DEMO_EVENTS.find(e => e.id === slug || e.slug === slug);
        if (found) {
          fetchedEvent = found;
          setEvent(found);
        } else {
          // Fetch from Firestore
          try {
            let docSnap = await getDoc(doc(db, 'events', slug));
            let eventData: Event | null = null;
            
            if (docSnap.exists()) {
              eventData = { id: docSnap.id, ...docSnap.data() } as Event;
            } else {
              const q = query(collection(db, 'events'), where('slug', '==', slug));
              const querySnapshot = await getDocs(q);
              if (!querySnapshot.empty) {
                docSnap = querySnapshot.docs[0];
                eventData = { id: docSnap.id, ...docSnap.data() } as Event;
              }
            }
            
            if (eventData) {
              fetchedEvent = eventData;
              setEvent(eventData);
            }
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `events/${slug}`);
          }
        }
      }

      setLoading(false);

      if (fetchedEvent) {
        try {
          const qEvents = query(collection(db, 'events'), where('isApproved', '==', true));
          const snap = await getDocs(qEvents);
          const relatedFs = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as Event))
            .filter(e => e.id !== fetchedEvent!.id)
            .sort((a, b) => new Date(a.dateTime).getTime() - new Date(b.dateTime).getTime());
            
          const relatedDemo = DEMO_EVENTS.filter(e => e.id !== fetchedEvent!.id && e.id !== slug);
          const combined = [...relatedFs, ...relatedDemo].slice(0, 4);
          setRelatedEvents(combined);
        } catch (err) {
          const relatedDemo = DEMO_EVENTS.filter(e => e.id !== fetchedEvent!.id && e.id !== slug).slice(0, 4);
          setRelatedEvents(relatedDemo);
        }
      }
    };

    fetchEvent();
  }, [slug, event]);

  const onEdit = () => {
    if (!event) return;
    navigate(`/events/edit/${event.id}`);
  };

  const onDelete = async () => {
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!event) return;
    try {
      await deleteDoc(doc(db, 'events', event.id));
      navigate('/events');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${event.id}`);
    }
  };

  const openInMaps = () => {
    if (!event) return;
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.location)}`;
    window.open(url, '_blank');
  };

  const addToCalendar = () => {
    if (!event) return;
    const startTime = new Date(event.dateTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endTime = new Date(new Date(event.dateTime).getTime() + 2 * 60 * 60 * 1000).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const url = `https://www.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(event.title)}&dates=${startTime}/${endTime}&details=${encodeURIComponent(event.description)}&location=${encodeURIComponent(event.location)}`;
    window.open(url, '_blank');
  };

  if (loading) return <div className="p-8 text-center">Loading event...</div>;
  if (!event) return <div className="p-8 text-center">Event not found.</div>;

  return (
    <>
      <div className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:bg-white md:rounded-3xl md:shadow-sm md:overflow-hidden md:border md:border-gray-100">
        <SEO
        title={event.title}
        description={event.description.length > 150 ? event.description.substring(0, 150) + '...' : event.description}
        canonicalUrl={`https://halalottawa.ca/events/${slug}`}
        ogImage={event.coverImage || undefined}
        structuredData={{
          "@context": "https://schema.org",
          "@type": "Event",
          "name": event.title,
          "description": event.description,
          "startDate": event.dateTime,
          "location": {
            "@type": "Place",
            "name": event.location,
            "address": event.location
          },
          "image": event.coverImage || "https://halalottawa.com/default-og.jpg",
          "organizer": {
            "@type": "Organization",
            "name": event.organizer
          }
        }}
      />

      <div className="relative h-64">
        {event.coverImage && event.coverImage.trim() !== '' ? (
          <img src={(event.coverImage) || undefined} alt={event.title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400 font-medium">No Image Available</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent"></div>
        <div className="absolute top-6 right-6 flex gap-2">
          <SaveButton id={event.id} type="event" variant="glass" />
          {(user?.uid === event.submittedBy || user?.role === 'admin') && (
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
          <div className="flex items-center gap-2 mb-2">
            <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-widest ${event.isFeatured ? 'bg-white text-[#e90b35]' : 'bg-[#e90b35] text-white'}`}>
              {event.isFeatured ? 'Featured Event' : 'Community Event'}
            </span>
          </div>
          <h1 className="text-2xl font-bold leading-tight">{event.title}</h1>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Info Buttons */}
        <div className="flex flex-wrap justify-center gap-8">
          <button 
            onClick={() => handleInfoClick(
              'Date', 
              `${formatDate(event.dateTime)} at ${formatTime(event.dateTime)}`, 
              <Calendar className="w-6 h-6" />,
              'Add to Calendar',
              addToCalendar
            )}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
              <Calendar className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Date</span>
          </button>
          
          <button 
            onClick={() => handleInfoClick(
              'Location', 
              event.location, 
              <MapPin className="w-6 h-6" />,
              'Open in Google Maps',
              openInMaps
            )}
            className="flex flex-col items-center gap-2 group"
          >
            <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
              <MapPin className="w-5 h-5" />
            </div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Location</span>
          </button>

          {event.registrationLink && (
            <button 
              onClick={() => handleInfoClick(
                'Registration', 
                event.registrationLink!, 
                <ClipboardCheck className="w-6 h-6" />,
                'Register Now',
                () => window.open(event.registrationLink!, '_blank'),
                true
              )}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center text-[#e90b35] group-active:scale-95 transition-all">
                <ClipboardCheck className="w-5 h-5" />
              </div>
              <span className="text-[10px] font-bold text-gray-500 uppercase">Registration</span>
            </button>
          )}
        </div>

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

        <section className="space-y-4">
          <h2 className="text-xl font-bold">Description</h2>
          <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed whitespace-pre-wrap">
            <ReactMarkdown>{event.description}</ReactMarkdown>
          </div>
        </section>

        <CommentSection parentId={event.id} parentType="event" />
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message={`Are you sure you want to delete "${event?.title}"? This action cannot be undone.`}
      />
      </div>

      {/* Related Events - Desktop Only */}
      {relatedEvents.length > 0 && (
        <div className="hidden md:block w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] max-w-[76rem] xl:max-w-[1336px] mx-auto mt-12 mb-16 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold mb-6">More Events</h2>
          <div className="grid grid-cols-3 lg:grid-cols-4 gap-6">
            {relatedEvents.map((related) => (
              <Link
                key={related.id}
                to={`/events/${related.slug || related.id}`}
                className="bg-white rounded-3xl overflow-hidden shadow-sm border border-gray-50 hover:shadow-md transition-all group flex flex-col"
              >
                <div className="relative h-32 shrink-0">
                  {related.coverImage && related.coverImage.trim() !== '' ? (
                    <img src={(related.coverImage) || undefined} alt={related.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                      <span className="text-gray-400 text-xs font-medium">No Image</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-white px-2 py-1 rounded-lg text-center shadow-lg">
                    <span className="block text-[10px] font-bold text-[#e90b35] uppercase">{new Date(related.dateTime).toLocaleString('default', { month: 'short' })}</span>
                    <span className="block text-lg font-black leading-none">{new Date(related.dateTime).getDate()}</span>
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h3 className="font-bold leading-tight line-clamp-2 group-hover:text-[#e90b35] transition-colors">{related.title}</h3>
                  <div className="mt-auto">
                    <p className="text-[#e90b35] font-bold text-sm flex items-center gap-2 mt-3 line-clamp-1">
                      <User className="w-3 h-3 shrink-0" /> <span className="truncate">{related.organizer}</span>
                    </p>
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
