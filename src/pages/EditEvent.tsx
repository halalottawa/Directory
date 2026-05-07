import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Info, MapPin, Calendar, Clock, Link as LinkIcon, User, Camera, CheckCircle2, AlertCircle, Save, Trash2 } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { TimePicker } from '../components/TimePicker';
import { Event } from '../types';
import { generateSlug } from '../utils/slugify';
import { Helmet } from 'react-helmet-async';

export const EditEvent: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    organizer: '',
    location: '',
    date: '',
    time: '',
    description: '',
    registrationLink: '',
    coverImage: '',
    slug: '',
  });

  useEffect(() => {
    const fetchEvent = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'events', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Event;
          // Security check: only owner or admin can edit
          if (data.submittedBy !== user?.uid && user?.role !== 'admin') {
            navigate('/events');
            return;
          }
          const [date, time] = data.dateTime ? data.dateTime.split('T') : ['', ''];
          setFormData({
            title: data.title,
            organizer: data.organizer,
            location: data.location,
            date: date || '',
            time: time ? time.substring(0, 5) : '',
            description: data.description,
            registrationLink: data.registrationLink || '',
            coverImage: data.coverImage || '',
            slug: data.slug || '',
          });
        } else {
          navigate('/events');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `events/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchEvent();
  }, [id, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
    setError('');

    setSaving(true);
    try {
      const { date, time, ...rest } = formData;
      const newSlug = user?.role === 'admin' && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.title);
        
      await updateDoc(doc(db, 'events', id), {
        ...rest,
        slug: newSlug,
        dateTime: `${date}T${time}`,
        updatedAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/events/${newSlug}`, { replace: true });
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to update event');
      handleFirestoreError(err, OperationType.UPDATE, `events/${id}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'events', id));
      navigate('/events');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `events/${id}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading event details...</div>;

  return (
    <main className="min-h-screen bg-white p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Helmet>
        <title>Edit Event | Halal Ottawa</title>
        <meta name="description" content="Update your community gathering details." />
      </Helmet>

      <div className="max-w-md mx-auto space-y-8">
        <div className="flex items-center justify-end">
          <button onClick={handleDelete} className="p-2 text-red-500 hover:text-red-600">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit Event</h1>
          <p className="text-gray-500">Update your community gathering details.</p>
        </div>

        {showSuccess && (
          <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>Your event has been updated successfully!</span>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 text-red-700 rounded-2xl border border-red-100 animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Info className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Event Title"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Organizer Name"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.organizer}
                onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
              />
            </div>

            <div className="relative">
              <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Location"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="flex gap-4">
              <div className="relative flex-1">
                <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  required
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.date}
                  onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                />
              </div>
              <div className="relative flex-1">
                <TimePicker
                  value={formData.time}
                  onChange={(val) => setFormData({ ...formData, time: val })}
                  required
                />
              </div>
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Registration Link (Optional)"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.registrationLink}
                onChange={(e) => setFormData({ ...formData, registrationLink: e.target.value })}
              />
            </div>

            <div className="relative">
              <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cover Image URL (Optional)"
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              />
            </div>

            <textarea
              placeholder="Event Description"
              required
              className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-32 resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            {user?.role === 'admin' && (
              <div className="relative">
                <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Custom Slug (URL path)"
                  className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                />
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </form>
      </div>

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Event"
        message="Are you sure you want to delete this event? This action cannot be undone."
      />
    </main>
  );
};
