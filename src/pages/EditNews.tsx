import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Info, Link as LinkIcon, User, Newspaper, Camera, CheckCircle2, Save, Trash2, Send, Upload } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { NewsArticle } from '../types';
import { generateSlug } from '../utils/slugify';
import { SEO } from '../components/SEO';
import { uploadFromUrl, uploadFile } from '../utils/storageUtils';
import { toast } from 'sonner';

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

  const processingUrls = useRef<string[]>([]);
  const handleCoverImageUrlChange = async (url: string) => {
    setFormData(prev => ({ ...prev, coverImage: url }));
    if (!url) return;
    
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    const isAlreadyProcessed = 
      url.includes('.r2.dev') ||
      url.includes('.r2.cloudflarestorage.com') ||
      url.includes('/uploads/');

    if (isHttp && !isAlreadyProcessed) {
      if (processingUrls.current.includes(url)) return;
      processingUrls.current.push(url);
      
      const toastId = toast.loading('Uploading cover photo to R2 Cloudflare...');
      try {
        const uploadedUrl = await uploadFromUrl(url, `${formData.title || 'news'}-cover`);
        setFormData(prev => ({ ...prev, coverImage: uploadedUrl }));
        toast.success('Cover photo uploaded to R2 from URL successfully', { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image from URL', { id: toastId });
        console.error(err);
      } finally {
        processingUrls.current = processingUrls.current.filter(item => item !== url);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;

    setSaving(true);
    try {
      const newSlug = user?.role === 'admin' && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.title);

      let finalImageUrl = formData.coverImage;
      if (finalImageUrl && (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://'))) {
        finalImageUrl = await uploadFromUrl(finalImageUrl, `${formData.title}-cover`);
      }
        
      await updateDoc(doc(db, 'news', id), {
        ...formData,
        coverImage: finalImageUrl,
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
    <main className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:mb-12">
      <SEO 
        title="Edit News" 
        description="Update the community news article." 
        noindex={true}
      />

      <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 p-4 md:p-10 space-y-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative md:col-span-2">
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

            <div className="relative md:col-span-1">
              <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Cover Image URL (Optional) or upload ->"
                className="w-full pl-14 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                onBlur={(e) => handleCoverImageUrlChange(e.target.value)}
              />
              <label className="absolute right-4 top-1/2 -translate-y-1/2 p-2 cursor-pointer bg-white rounded-xl shadow-sm text-gray-500 hover:text-[#e90b35] transition-colors border border-gray-100 hover:border-red-100">
                <Upload className="w-4 h-4" />
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const toastId = toast.loading('Uploading photo...');
                    try {
                      const url = await uploadFile(file, 'news');
                      setFormData(prev => ({ ...prev, coverImage: url }));
                      toast.success('Photo uploaded successfully', { id: toastId });
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to upload photo', { id: toastId });
                    }
                  }}
                />
              </label>
            </div>

            <div className="relative md:col-span-1">
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
              className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-48 resize-none md:col-span-2"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            />

            {user?.role === 'admin' && (
              <div className="relative md:col-span-2">
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

          <div className="flex justify-start">
            <button
              type="submit"
              disabled={saving}
              className="w-full md:w-auto md:px-12 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {saving ? 'Saving Changes...' : <>Save Changes <Save className="w-5 h-5" /></>}
            </button>
          </div>
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
