import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Info, Link as LinkIcon, User, Newspaper, Camera, CheckCircle2, Save, Trash2, Send, Upload, Image as ImageIcon, Move } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
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
  const [originalSlug, setOriginalSlug] = useState('');
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
          setOriginalSlug(data.slug || '');
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inlineImageInputRef = useRef<HTMLInputElement>(null);

  const [pendingImageUrl, setPendingImageUrl] = useState<string | null>(null);

  const dragContainerRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 50, y: 50 });
  const isDragging = useRef(false);
  const startDragPos = useRef({ x: 0, y: 0 });
  const startOffset = useRef({ x: 50, y: 50 });

  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    startDragPos.current = { x: e.clientX, y: e.clientY };
    startOffset.current = { ...offset };
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    isDragging.current = true;
    startDragPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    startOffset.current = { ...offset };
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging.current || !dragContainerRef.current) return;
    const rect = dragContainerRef.current.getBoundingClientRect();
    const deltaX = ((e.clientX - startDragPos.current.x) / rect.width) * 100;
    const deltaY = ((e.clientY - startDragPos.current.y) / rect.height) * 100;
    setOffset({
      x: Math.max(0, Math.min(100, startOffset.current.x - deltaX)),
      y: Math.max(0, Math.min(100, startOffset.current.y - deltaY))
    });
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging.current || !dragContainerRef.current || e.touches.length !== 1) return;
    e.preventDefault();
    const rect = dragContainerRef.current.getBoundingClientRect();
    const deltaX = ((e.touches[0].clientX - startDragPos.current.x) / rect.width) * 100;
    const deltaY = ((e.touches[0].clientY - startDragPos.current.y) / rect.height) * 100;
    setOffset({
      x: Math.max(0, Math.min(100, startOffset.current.x - deltaX)),
      y: Math.max(0, Math.min(100, startOffset.current.y - deltaY))
    });
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };

  const handleTouchEnd = () => {
    isDragging.current = false;
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
  };

  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const toastId = toast.loading('Uploading inline photo...');
    try {
      const url = await uploadFile(file, 'news', `${formData.title || 'news'}-inline-${Date.now()}`);
      toast.success('Successfully uploaded photo!', { id: toastId });
      setPendingImageUrl(url);
    } catch (error: any) {
      toast.error(error.message || 'Failed to upload inline photo', { id: toastId });
    } finally {
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  const handleInsertWithAlignment = (align: 'left' | 'center' | 'right') => {
    if (!pendingImageUrl) return;
    
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.content;
      const xPercent = Math.round(offset.x);
      const yPercent = Math.round(offset.y);
      const suffix = `#${align}-${xPercent}-${yPercent}`;
      const alignmentLabel = align === 'center' ? 'Center' : align === 'left' ? 'Left' : 'Right';
      const replacement = `\n![Uploaded Image - ${alignmentLabel}](${pendingImageUrl}${suffix})\n`;
      const newContent = text.substring(0, start) + replacement + text.substring(end);
      setFormData(prev => ({ ...prev, content: newContent }));
      
      setTimeout(() => {
        textarea.focus();
        const newCursorPos = start + replacement.length;
        textarea.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    }
    setPendingImageUrl(null);
    setOffset({ x: 50, y: 50 });
  };

  const insertMarkdown = (syntax: string, placeholder = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = formData.content;
    const selectedText = text.substring(start, end);
    
    let replacement = '';
    
    if (syntax === 'h2') {
      replacement = `\n## ${selectedText || placeholder || 'Heading 2'}\n`;
    } else if (syntax === 'h3') {
      replacement = `\n### ${selectedText || placeholder || 'Heading 3'}\n`;
    } else if (syntax === 'h4') {
      replacement = `\n#### ${selectedText || placeholder || 'Heading 4'}\n`;
    } else if (syntax === 'bold') {
      replacement = `**${selectedText || placeholder || 'bold text'}**`;
    } else if (syntax === 'italic') {
      replacement = `*${selectedText || placeholder || 'italic text'}*`;
    } else if (syntax === 'list-ul') {
      replacement = `\n- ${selectedText || placeholder || 'list item'}\n`;
    } else if (syntax === 'list-ol') {
      replacement = `\n1. ${selectedText || placeholder || 'list item'}\n`;
    } else if (syntax === 'quote') {
      replacement = `\n> ${selectedText || placeholder || 'quote'}\n`;
    } else if (syntax === 'link') {
      replacement = `[${selectedText || placeholder || 'link text'}](https://example.com)`;
    }

    const newContent = text.substring(0, start) + replacement + text.substring(end);
    setFormData(prev => ({ ...prev, content: newContent }));

    // Re-focus and set selection
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + replacement.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

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

      if (originalSlug && newSlug && originalSlug !== newSlug) {
        try {
          await setDoc(doc(db, 'slug_redirects', `news_${originalSlug}`), {
            type: 'news',
            oldSlug: originalSlug,
            newSlug: newSlug,
            createdAt: new Date().toISOString(),
          });
          console.log(`Created news slug redirect: ${originalSlug} -> ${newSlug}`);
        } catch (redirectErr) {
          console.error('Failed to create news redirect:', redirectErr);
        }
      }

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
                      const url = await uploadFile(file, 'news', formData.title || 'news-cover');
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

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-wider block">
                Article Content (Supports Markdown)
              </label>
              <div className="border border-gray-100 bg-gray-50 rounded-2xl overflow-hidden focus-within:ring-2 focus-within:ring-[#e90b35] transition-all">
                {/* Visual formatting toolbar */}
                <div className="flex flex-wrap items-center gap-1.5 p-2 bg-white border-b border-gray-100">
                  <button
                    type="button"
                    onClick={() => insertMarkdown('h2', 'Heading 2')}
                    className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Heading 2 (##)"
                  >
                    H2
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('h3', 'Heading 3')}
                    className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Heading 3 (###)"
                  >
                    H3
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('h4', 'Heading 4')}
                    className="px-2.5 py-1 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Heading 4 (####)"
                  >
                    H4
                  </button>
                  <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('bold', 'bold text')}
                    className="p-1 px-2.5 text-xs font-bold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Bold (**text**)"
                  >
                    B
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('italic', 'italic text')}
                    className="p-1 px-2.5 text-xs italic font-semibold bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Italic (*text*)"
                  >
                    I
                  </button>
                  <div className="h-4 w-[1px] bg-gray-200 mx-1"></div>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('list-ul', 'list item')}
                    className="px-2.5 py-1 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Bullet List (-)"
                  >
                    • List
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('list-ol', 'list item')}
                    className="px-2.5 py-1 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 cursor-pointer"
                    title="Numbered List (1.)"
                  >
                    1. List
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('quote', 'quote text')}
                    className="px-2.5 py-1 text-xs bg-gray-50 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-100 font-serif font-bold cursor-pointer"
                    title="Blockquote (>)"
                  >
                    " Quote
                  </button>
                  <button
                    type="button"
                    onClick={() => insertMarkdown('link', 'link text')}
                    className="px-2.5 py-1 text-xs bg-gray-50 text-[#e90b35] hover:bg-red-50 rounded-lg transition-colors border border-red-50 cursor-pointer"
                    title="Insert Link ([text](url))"
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => inlineImageInputRef.current?.click()}
                    className="px-2.5 py-1 text-xs bg-gray-50 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors border border-emerald-50 flex items-center gap-1 cursor-pointer"
                    title="Upload & Insert Photo"
                  >
                    <ImageIcon className="w-3.5 h-3.5" /> Photo
                  </button>
                  <input
                    type="file"
                    ref={inlineImageInputRef}
                    accept="image/*"
                    className="hidden"
                    onChange={handleInlineImageUpload}
                  />
                </div>
                <textarea
                  ref={textareaRef}
                  placeholder="Type your article text here. Use the buttons above to quickly add H2, H3, H4 headings, bullet lists, bold styles, etc."
                  required
                  className="w-full p-4 bg-transparent border-none outline-none h-64 resize-y text-gray-800 leading-relaxed font-sans placeholder-gray-400"
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                />
              </div>
            </div>

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

      {pendingImageUrl && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 space-y-4 animate-in zoom-in-95 duration-200 shadow-xl border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 text-center">Position Inline Photo</h3>
            
            {/* Draggable Preview Section */}
            <div className="space-y-1">
              <div 
                ref={dragContainerRef}
                className="w-full h-48 bg-gray-100 rounded-2xl overflow-hidden relative cursor-move select-none border border-gray-200 touch-none"
                onMouseDown={handleDragStart}
                onTouchStart={handleTouchStart}
              >
                <img 
                  src={pendingImageUrl} 
                  alt="Position Preview" 
                  className="w-full h-full object-cover pointer-events-none"
                  style={{ objectPosition: `${offset.x}% ${offset.y}%` }}
                />
                <div className="absolute inset-0 bg-black/10 pointer-events-none flex items-center justify-center">
                  <div className="bg-black/60 text-white text-[10px] px-2.5 py-1 rounded-full font-medium flex items-center gap-1.5 backdrop-blur-sm shadow-sm animate-pulse">
                    <Move className="w-3.5 h-3.5" /> Drag image to adjust position
                  </div>
                </div>
                {/* Coordinates tooltip */}
                <div className="absolute right-3 bottom-3 bg-black/75 text-white text-[9px] px-1.5 py-0.5 rounded font-mono">
                  X:{Math.round(offset.x)}% Y:{Math.round(offset.y)}%
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => handleInsertWithAlignment('center')}
                className="w-full py-3.5 bg-[#e90b35] hover:bg-[#c8082b] text-white font-bold rounded-2xl transition-all shadow-lg shadow-red-100 flex items-center justify-center gap-2 text-sm"
              >
                Insert Photo
              </button>
              
              <button
                type="button"
                onClick={() => {
                  setPendingImageUrl(null);
                  setOffset({ x: 50, y: 50 });
                }}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-2xl transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
