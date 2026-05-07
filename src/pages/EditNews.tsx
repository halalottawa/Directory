import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Info, Link as LinkIcon, User, Newspaper, Camera, CheckCircle2, Save, Trash2 } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { NewsArticle } from '../types';
import { generateSlug } from '../utils/slugify';
import { Helmet } from 'react-helmet-async';

export const EditNews: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    sourceLink: '',
    coverImage: '',
    slug: '',
  });

  useEffect(() => {
    const fetchNews = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'news', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as NewsArticle;
          // Security check: only owner or admin can edit
          if (data.submittedBy !== user?.uid && user?.role !== 'admin') {
            navigate('/news');
            return;
          }
          setFormData({
            title: data.title,
            content: data.content,
            sourceLink: data.sourceLink || '',
            coverImage: data.coverImage || '',
            slug: data.slug || '',
          });
        } else {
          navigate('/news');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `news/${id}`);
      } finally {
        setLoading(false);
      }
    };
    fetchNews();
  }, [id, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setSaving(true);
    try {
      const newSlug = user?.role === 'admin' && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.title);
        
      await updateDoc(doc(db, 'news', id), {
        ...formData,
        slug: newSlug,
        updatedAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        navigate(`/news/${newSlug}`, { replace: true });
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `news/${id}`);
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
      await deleteDoc(doc(db, 'news', id));
      navigate('/news');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `news/${id}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading news details...</div>;

  return (
    <main className="min-h-screen bg-white p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Helmet>
        <title>Edit News | Halal Ottawa</title>
        <meta name="description" content="Update the community news article." />
      </Helmet>

      <div className="max-w-md mx-auto space-y-8">
        <div className="flex items-center justify-end">
          <button onClick={handleDelete} className="p-2 text-red-500 hover:text-red-600">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit News</h1>
          <p className="text-gray-500">Update the community news article.</p>
        </div>

        {showSuccess && (
          <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>Your news article has been updated successfully!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="relative">
              <Newspaper className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Article Title"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="relative">
              <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cover Image URL (Optional)"
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
              />
            </div>

            <div className="relative">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Add a link"
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.sourceLink}
                onChange={(e) => setFormData({ ...formData, sourceLink: e.target.value })}
              />
            </div>

            <textarea
              placeholder="Article Content"
              required
              className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-48 resize-none"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
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
        title="Delete Article"
        message="Are you sure you want to delete this news article? This action cannot be undone."
      />
    </main>
  );
};
