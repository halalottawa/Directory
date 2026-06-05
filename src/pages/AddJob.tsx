import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, MapPin, Briefcase, DollarSign, Link as LinkIcon, Building2, CheckCircle2, Image as ImageIcon, Send, Upload } from 'lucide-react';
import { collection, setDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { JobType } from '../types';
import { generateSlug, getUniqueSlug } from '../utils/slugify';
import { SEO } from '../components/SEO';
import { uploadFromUrl, uploadFile } from '../utils/storageUtils';
import { toast } from 'sonner';

export const AddJob: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    company: '',
    companyLogo: '',
    location: '',
    salary: '',
    type: '' as unknown as JobType,
    applyLink: '',
    description: '',
    isFeatured: false,
    slug: '',
  });

  const processingUrls = useRef<string[]>([]);
  const handleCompanyLogoUrlChange = async (url: string) => {
    setFormData(prev => ({ ...prev, companyLogo: url }));
    if (!url) return;
    
    const isHttp = url.startsWith('http://') || url.startsWith('https://');
    const isAlreadyProcessed = 
      url.includes('.r2.dev') ||
      url.includes('.r2.cloudflarestorage.com') ||
      url.includes('.public.blob.vercel-storage.com') ||
      url.includes('/uploads/');

    if (isHttp && !isAlreadyProcessed) {
      if (processingUrls.current.includes(url)) return;
      processingUrls.current.push(url);
      
      const toastId = toast.loading('Uploading company logo from URL to R2 Cloudflare...');
      try {
        const uploadedUrl = await uploadFromUrl(url, `${formData.company || 'company'}-logo`);
        setFormData(prev => ({ ...prev, companyLogo: uploadedUrl }));
        toast.success('Company logo uploaded to R2 from URL successfully', { id: toastId });
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
      const uniqueSlug = await getUniqueSlug(db, 'jobs', baseSlug);

      let finalLogoUrl = formData.companyLogo;
      if (finalLogoUrl && (finalLogoUrl.startsWith('http://') || finalLogoUrl.startsWith('https://'))) {
        finalLogoUrl = await uploadFromUrl(finalLogoUrl, `${uniqueSlug}-logo`);
      }

      await setDoc(doc(db, 'jobs', uniqueSlug), {
        ...formData,
        companyLogo: finalLogoUrl,
        slug: uniqueSlug,
        isApproved: isAdmin, // Admin posts directly
        submittedBy: user.uid,
        createdAt: new Date().toISOString(),
      });
      setShowSuccess(true);
      setTimeout(() => {
        navigate('/jobs');
      }, 2000);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'jobs');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:mb-12">
      <SEO 
        title="Post a Job" 
        description="List a halal-friendly job opportunity." 
        noindex={true}
      />

      <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 p-4 md:p-10 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Post a Job</h1>
          <p className="text-gray-500">List a halal-friendly job opportunity.</p>
        </div>

        {showSuccess && (
          <div className="p-4 bg-green-50 text-green-700 rounded-2xl border border-green-100 animate-in fade-in slide-in-from-top-2 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5" />
            <span>
              {user?.role === 'admin' 
                ? 'Your job posting has been published successfully!' 
                : 'Your job posting has been submitted successfully and is awaiting approval.'}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative md:col-span-1">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Job Title"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="relative md:col-span-1">
              <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Company Name"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
              />
            </div>

            <div className="relative md:col-span-1">
              <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Company Logo URL (optional) or upload ->"
                className="w-full pl-14 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.companyLogo}
                onChange={(e) => setFormData({ ...formData, companyLogo: e.target.value })}
                onBlur={(e) => handleCompanyLogoUrlChange(e.target.value)}
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
                    const toastId = toast.loading('Uploading logo...');
                    try {
                      const url = await uploadFile(file, 'jobs');
                      setFormData(prev => ({ ...prev, companyLogo: url }));
                      toast.success('Logo uploaded successfully', { id: toastId });
                    } catch (error: any) {
                      toast.error(error.message || 'Failed to upload logo', { id: toastId });
                    }
                  }}
                />
              </label>
            </div>

            <div className="relative md:col-span-1">
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

            <div className="relative md:col-span-1">
              <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Salary"
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.salary}
                onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
              />
            </div>

            <div className="relative md:col-span-1">
              <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <select
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all appearance-none"
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
              >
                <option value="">Select Job Type (Optional)</option>
                <option value="Full-time">Full-time</option>
                <option value="Part-time">Part-time</option>
                <option value="Contract">Contract</option>
                <option value="Freelance">Freelance</option>
                <option value="Internship">Internship</option>
              </select>
            </div>

            <div className="relative md:col-span-1">
              <LinkIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Apply Link or Email"
                required
                className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.applyLink}
                onChange={(e) => setFormData({ ...formData, applyLink: e.target.value })}
              />
            </div>

            <textarea
              placeholder="Job Description"
              required
              className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-32 resize-none md:col-span-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            {user?.role === 'admin' && (
              <div className="space-y-4 md:col-span-2">
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
                
                <label className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl cursor-pointer active:scale-95 transition-all w-fit">
                  <input
                    type="checkbox"
                    className="w-5 h-5 accent-[#e90b35]"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                  />
                  <span className="text-sm font-bold text-gray-700">Feature this job</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex justify-start">
            <button
              type="submit"
              disabled={loading}
              className="w-full md:w-auto md:px-12 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Submitting...' : <>Post Job <Send className="w-5 h-5" /></>}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
