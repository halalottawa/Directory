import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, Link as LinkIcon, User, Newspaper, Camera, CheckCircle2, ChevronLeft, Send, Upload } from 'lucide-react';
import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { generateSlug, getUniqueSlug } from '../utils/slugify';
import { SEO } from '../components/SEO';
import { uploadFromUrl, uploadFile } from '../utils/storageUtils';
import { toast } from 'sonner';

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

  const processingUrls = useRef<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
      
      const toastId = toast.loading('Uploading photo from URL to R2 Cloudflare...');
      try {
        const uploadedUrl = await uploadFromUrl(url, `${formData.title || 'news'}-cover`);
        setFormData(prev => ({ ...prev, coverImage: uploadedUrl }));
        toast.success('Photo uploaded to R2 from URL successfully', { id: toastId });
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
    if (!user) return;

    setLoading(true);
    try {
      const isAdmin = user.role === 'admin';
      const baseSlug = isAdmin && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.title);
      const uniqueSlug = await getUniqueSlug(db, 'news', baseSlug);

      let finalImageUrl = formData.coverImage || 'https://picsum.photos/seed/news/800/600';
      if (finalImageUrl.startsWith('http://') || finalImageUrl.startsWith('https://')) {
        finalImageUrl = await uploadFromUrl(finalImageUrl, `${uniqueSlug}-cover`);
      }

      await setDoc(doc(db, 'news', uniqueSlug), {
        ...formData,
        slug: uniqueSlug,
        author: 'Halal Ottawa',
        coverImage: finalImageUrl,
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
    <main className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:mb-12">
      <SEO 
        title="Submit News" 
        description="Share community news or updates." 
        noindex={true}
      />

      <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 p-4 md:p-10 space-y-8">
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
              disabled={loading}
              className="w-full md:w-auto md:px-12 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : <>Submit News <Send className="w-5 h-5" /></>}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
