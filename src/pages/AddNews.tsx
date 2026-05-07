import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Link as LinkIcon, User, Newspaper, Camera, CheckCircle2, ChevronLeft } from 'lucide-react';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { generateSlug } from '../utils/slugify';
import { Helmet } from 'react-helmet-async';

export const AddNews: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    sourceLink: '',
    coverImage: '',
    slug: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const isAdmin = user.role === 'admin';
      const newSlug = isAdmin && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.title);

      await addDoc(collection(db, 'news'), {
        ...formData,
        slug: newSlug,
        author: 'Halal Ottawa',
        coverImage: formData.coverImage || 'https://picsum.photos/seed/news/800/600',
        isFeatured: false,
        isApproved: isAdmin, // Admin posts directly
        submittedBy: user.uid,
        publishDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/news');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'news');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-white p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <Helmet>
        <title>Submit News | Halal Ottawa</title>
        <meta name="description" content="Share community news or updates." />
      </Helmet>

      <div className="max-w-md mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Submit News</h1>
          <p className="text-gray-500">Share community news or updates.</p>
        </div>

        {showSuccess && (
          <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {user?.role === 'admin' 
                ? 'Your news article has been published successfully!' 
                : 'Your news article has been submitted successfully and is pending approval.'}
            </span>
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
            disabled={loading}
            className="w-full py-4 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit News'}
          </button>
        </form>
      </div>
    </main>
  );
};
