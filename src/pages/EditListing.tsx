import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ChevronLeft, Camera, MapPin, Info, Tag, Phone, Globe, Clock, Mail, Save, Trash2, Star, Loader2, Upload, FileText, Facebook, Instagram, Twitter, Smartphone, Send, Sparkles, RefreshCw } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { CATEGORIES, LISTING_TYPES, CUISINES } from '../constants';
import { Listing, ListingCategory, ListingType, CuisineType } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { generateSlug } from '../utils/slugify';
import { getListingUrl } from '../utils/url';
import { SEO } from '../components/SEO';
import { toast } from 'sonner';
import { uploadFile, uploadFromUrl } from '../utils/storageUtils';
import { getSuburbFromAddress } from '../utils/geo';

export const EditListing: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDetectingSuburb, setIsDetectingSuburb] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [menuInputType, setMenuInputType] = useState<'pdf' | 'items'>('pdf');
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    suburb: '',
    category: [] as string[],
    description: '',
    phoneNumber: '',
    email: '',
    website: '',
    openingHours: '',
    photos: [] as string[],
    isFeatured: false,
    slug: '',
    types: [] as ListingType[],
    cuisine: [] as CuisineType[],
    plan: 'basic' as 'basic' | 'premium',
    menuPdfUrl: '',
    menuItems: [{ category: '', items: [{ name: '', price: '', description: '' }] }] as { category: string; items: { name: string; price: string; description?: string }[] }[],
    socialMediaLinks: [''] as string[],
  });

  const processingUrls = useRef<string[]>([]);
  const handlePhotoUrlChange = async (url: string) => {
    setFormData(prev => ({ ...prev, photos: [url] }));
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
      
      setIsUploading(true);
      const toastId = toast.loading('Uploading photo from URL to R2 Cloudflare...');
      try {
        const uploadedUrl = await uploadFromUrl(url, `${formData.name || 'listing'}-photo`);
        setFormData(prev => ({ ...prev, photos: [uploadedUrl] }));
        toast.success('Photo uploaded to R2 from URL successfully', { id: toastId });
      } catch (err: any) {
        toast.error(err.message || 'Failed to upload image from URL', { id: toastId });
        console.error(err);
      } finally {
        setIsUploading(false);
        processingUrls.current = processingUrls.current.filter(item => item !== url);
      }
    }
  };

  const [showHoursModal, setShowHoursModal] = useState(false);
  const [hours, setHours] = useState({
    Monday: { open: '09:00', close: '17:00', closed: false },
    Tuesday: { open: '09:00', close: '17:00', closed: false },
    Wednesday: { open: '09:00', close: '17:00', closed: false },
    Thursday: { open: '09:00', close: '17:00', closed: false },
    Friday: { open: '09:00', close: '17:00', closed: false },
    Saturday: { open: '09:00', close: '17:00', closed: true },
    Sunday: { open: '09:00', close: '17:00', closed: true },
  });

  const [isFetchingAI, setIsFetchingAI] = useState(false);
  const [isFetchingField, setIsFetchingField] = useState({
    address: false,
    phoneNumber: false,
    openingHours: false,
    email: false,
    website: false,
  });

  const handleFetchAIInfo = async (field?: 'address' | 'phoneNumber' | 'openingHours' | 'email' | 'website') => {
    if (!formData.name.trim()) {
      toast.error('Please enter a business name first so the AI knows what to search for.');
      return;
    }

    if (field) {
      setIsFetchingField(prev => ({ ...prev, [field]: true }));
    } else {
      setIsFetchingAI(true);
    }

    try {
      const response = await fetch('/api/admin/fetch-listing-ai-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          currentAddress: formData.address,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'Failed to fetch details via AI';
        try {
          const errJSON = JSON.parse(errorText);
          errorMessage = errJSON.error || errorMessage;
        } catch (_) {}
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const updates: Partial<typeof formData> = {};
      const updatedFieldsLog: string[] = [];

      if (!field || field === 'address') {
        if (data.address) {
          updates.address = data.address;
          updatedFieldsLog.push('Address');
          try {
            const suburbName = await getSuburbFromAddress(data.address);
            if (suburbName) {
              updates.suburb = suburbName;
              updatedFieldsLog.push('Suburb');
            }
          } catch (subErr) {
            console.warn('Suburb detection failed during AI update:', subErr);
          }
        }
      }

      if (!field || field === 'phoneNumber') {
        if (data.phoneNumber) {
          updates.phoneNumber = data.phoneNumber;
          updatedFieldsLog.push('Phone Number');
        }
      }

      if (!field || field === 'openingHours') {
        if (data.openingHours) {
          updates.openingHours = data.openingHours;
          updatedFieldsLog.push('Opening Hours');
        }
      }

      if (!field || field === 'email') {
        if (data.email) {
          updates.email = data.email;
          updatedFieldsLog.push('Email');
        }
      }

      if (!field || field === 'website') {
        if (data.website) {
          updates.website = data.website;
          updatedFieldsLog.push('Website');
        }
      }

      setFormData(prev => ({ ...prev, ...updates }));

      if (updatedFieldsLog.length > 0) {
        toast.success(`Successfully updated ${updatedFieldsLog.join(', ')} via AI!`);
      } else {
        toast.info('AI search completed but returned no changes.');
      }
    } catch (err: any) {
      console.error('Error fetching details via AI:', err);
      toast.error(`AI Fetching failed: ${err.message || 'Unknown error'}`);
    } finally {
      if (field) {
        setIsFetchingField(prev => ({ ...prev, [field]: false }));
      } else {
        setIsFetchingAI(false);
      }
    }
  };

  useEffect(() => {
    const fetchListing = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, 'listings', id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as Listing;
          
          // Check permission
          if (user?.role !== 'admin' && user?.uid !== data.submittedBy) {
            toast.error('You do not have permission to edit this listing.');
            navigate('/listings');
            return;
          }

          setFormData({
            name: data.name,
            address: data.address,
            suburb: data.suburb || '',
            category: Array.isArray(data.category) ? data.category : [data.category],
            description: data.description,
            phoneNumber: data.phoneNumber,
            email: data.email || '',
            website: data.website || '',
            openingHours: data.openingHours,
            photos: data.photos?.length ? data.photos : [''],
            isFeatured: data.isFeatured || false,
            slug: data.slug || '',
            types: data.types || [],
            cuisine: data.cuisine || [],
            plan: data.plan || 'basic',
            menuPdfUrl: data.menuPdfUrl || '',
            menuItems: data.menuItems?.length ? data.menuItems : [{ category: '', items: [{ name: '', price: '', description: '' }] }],
            socialMediaLinks: data.socialMediaLinks?.length ? data.socialMediaLinks : [''],
          });
        } else {
          toast.error('Listing not found');
          navigate('/listings');
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `listings/${id}`);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchListing();
    }
  }, [id, user, navigate]);

  const formatTime = (time: string) => {
    if (!time) return '';
    const [h, m] = time.split(':');
    const hour = parseInt(h, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:${m} ${ampm}`;
  };

  const handleSaveHours = () => {
    const hoursString = Object.entries(hours)
      .map(([day, data]) => {
        if (data.closed) return `${day}: Closed`;
        return `${day}: ${formatTime(data.open)} - ${formatTime(data.close)}`;
      })
      .join(', ');
    setFormData({ ...formData, openingHours: hoursString });
    setShowHoursModal(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;

    setIsSubmitting(true);
    try {
      let finalSuburb = formData.suburb;
      if (!finalSuburb && formData.address.trim()) {
        try {
          const detected = await getSuburbFromAddress(formData.address);
          if (detected) {
            finalSuburb = detected;
          }
        } catch (subErr) {
          console.warn('On submit suburb detection failed:', subErr);
        }
      }

      const docRef = doc(db, 'listings', id);
      const newSlug = user?.role === 'admin' && formData.slug 
        ? generateSlug(formData.slug) 
        : generateSlug(formData.name);

      const processedPhotos = await Promise.all(
        formData.photos.filter(p => p.trim() !== '').map(async (photoUrl, idx) => {
          if (photoUrl.startsWith('http://') || photoUrl.startsWith('https://')) {
            const fileName = idx === 0 ? newSlug : `${newSlug}-${idx}`;
            return await uploadFromUrl(photoUrl, fileName);
          }
          return photoUrl;
        })
      );
        
      await updateDoc(docRef, {
        ...formData,
        suburb: finalSuburb,
        types: formData.category.includes('Restaurants') ? formData.types : [],
        cuisine: formData.category.includes('Restaurants') ? formData.cuisine : [],
        slug: newSlug,
        photos: processedPhotos,
        updatedAt: new Date().toISOString(),
      });
      toast.success('Listing updated successfully!');
      const finalListing = { ...formData, slug: newSlug, id };
      navigate(getListingUrl(finalListing), { replace: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `listings/${id}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    setModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!id) return;
    try {
      await deleteDoc(doc(db, 'listings', id));
      navigate('/listings');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `listings/${id}`);
    }
  };

  if (loading) return <div className="p-8 text-center">Loading listing...</div>;

  return (
    <main className="animate-in fade-in duration-500 md:max-w-[76rem] xl:max-w-[1336px] md:mx-auto md:w-[calc(100%-2rem)] lg:w-[calc(100%-4rem)] md:mt-8 md:mb-12">
      <SEO 
        title="Edit Listing" 
        description="Update the details for this place or organization." 
        noindex={true}
      />

      <div className="bg-white md:rounded-3xl md:shadow-sm md:border md:border-gray-100 p-4 md:p-10 space-y-6">
        <div className="flex items-center justify-end">
          <button onClick={handleDelete} className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-all">
            <Trash2 className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Edit Listing</h1>
          <p className="text-gray-500">Update the details for this place or organization.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="relative md:col-span-2">
              <Info className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Name of the listing"
                required
                className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="relative md:col-span-2 flex items-center gap-2">
              <div className="relative flex-1">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Address"
                  required
                  className="w-full pl-14 pr-12 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  onBlur={async () => {
                    if (formData.address.trim()) {
                      setIsDetectingSuburb(true);
                      try {
                        const detected = await getSuburbFromAddress(formData.address);
                        if (detected) {
                          setFormData(prev => ({ ...prev, suburb: detected }));
                          toast.success(`Automatically detected suburb: ${detected}`);
                        }
                      } catch (e) {
                        console.warn(e);
                      } finally {
                        setIsDetectingSuburb(false);
                      }
                    }
                  }}
                />
                {isDetectingSuburb && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2 text-xs text-gray-400">
                    <Loader2 className="w-3 h-3 animate-spin text-[#e90b35]" />
                    <span>Detecting suburb...</span>
                  </div>
                )}
              </div>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  disabled={isFetchingAI || Object.values(isFetchingField).some(Boolean) || !formData.name.trim()}
                  onClick={() => handleFetchAIInfo('address')}
                  title="Autofill Address with AI"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {isFetchingField.address ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="space-y-4 md:col-span-2">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      const newCategories = formData.category.includes(cat)
                        ? formData.category.filter(c => c !== cat)
                        : [...formData.category, cat];
                      setFormData({ ...formData, category: newCategories });
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                      formData.category.includes(cat)
                        ? 'bg-[#e90b35] text-white shadow-md shadow-red-100'
                        : 'bg-white text-gray-500 border border-gray-100 hover:border-red-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {formData.category.includes('Restaurants') && (
              <div className="space-y-6 p-6 bg-gray-50 rounded-[32px] border border-gray-100 animate-in fade-in slide-in-from-top-2 duration-300 md:col-span-2">
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {LISTING_TYPES.map(type => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => {
                          const newTypes = formData.types.includes(type)
                            ? formData.types.filter(t => t !== type)
                            : [...formData.types, type];
                          setFormData({ ...formData, types: newTypes });
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          formData.types.includes(type)
                            ? 'bg-[#e90b35] text-white shadow-md shadow-red-100'
                            : 'bg-white text-gray-500 border border-gray-100 hover:border-red-200'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t-2 border-gray-200">
                  <div className="flex flex-wrap gap-2">
                    {CUISINES.map(cuisine => (
                      <button
                        key={cuisine}
                        type="button"
                        onClick={() => {
                          const newCuisine = formData.cuisine.includes(cuisine)
                            ? formData.cuisine.filter(c => c !== cuisine)
                            : [...formData.cuisine, cuisine];
                          setFormData({ ...formData, cuisine: newCuisine });
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                          formData.cuisine.includes(cuisine)
                            ? 'bg-gray-900 text-white shadow-md shadow-gray-200'
                            : 'bg-white text-gray-500 border border-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {cuisine}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="relative md:col-span-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                />
              </div>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  disabled={isFetchingAI || Object.values(isFetchingField).some(Boolean) || !formData.name.trim()}
                  onClick={() => handleFetchAIInfo('phoneNumber')}
                  title="Autofill Phone with AI"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {isFetchingField.phoneNumber ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="relative md:col-span-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="Email"
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  disabled={isFetchingAI || Object.values(isFetchingField).some(Boolean) || !formData.name.trim()}
                  onClick={() => handleFetchAIInfo('email')}
                  title="Autofill Email with AI"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {isFetchingField.email ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="relative md:col-span-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Website"
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  disabled={isFetchingAI || Object.values(isFetchingField).some(Boolean) || !formData.name.trim()}
                  onClick={() => handleFetchAIInfo('website')}
                  title="Autofill Website with AI"
                  className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {isFetchingField.website ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-gray-500" />
                  ) : (
                    <RefreshCw className="w-4 h-4" />
                  )}
                </button>
              )}
            </div>

            <div className="relative md:col-span-1 flex items-center gap-2">
              <div className="relative flex-1">
                <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Hours"
                  readOnly
                  onClick={() => setShowHoursModal(true)}
                  className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all cursor-pointer"
                  value={formData.openingHours}
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setFormData(prev => ({ ...prev, openingHours: '' }));
                  setHours({
                    Monday: { open: '', close: '', closed: false },
                    Tuesday: { open: '', close: '', closed: false },
                    Wednesday: { open: '', close: '', closed: false },
                    Thursday: { open: '', close: '', closed: false },
                    Friday: { open: '', close: '', closed: false },
                    Saturday: { open: '', close: '', closed: false },
                    Sunday: { open: '', close: '', closed: false },
                  });
                }}
                title="Reset Hours"
                className="p-4 text-red-500 hover:text-red-700 hover:bg-red-50 bg-gray-50 rounded-2xl transition-all shrink-0 flex items-center justify-center border-none"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2 md:col-span-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Camera className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Photo URL"
                    className="w-full pl-14 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                    value={formData.photos[0] || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, photos: [e.target.value] }))}
                    onBlur={(e) => handlePhotoUrlChange(e.target.value)}
                  />
                </div>
                <div className="relative">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsUploading(true);
                      try {
                        const url = await uploadFile(file, 'listings', formData.name);
                        setFormData({ ...formData, photos: [url] });
                        toast.success('Photo uploaded successfully');
                      } catch (error: any) {
                        toast.error(error.message || 'Failed to upload photo');
                      } finally {
                        setIsUploading(false);
                      }
                    }}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    disabled={isUploading}
                  />
                  <button
                    type="button"
                    disabled={isUploading}
                    className="h-full px-6 bg-gray-100 text-gray-700 font-bold rounded-2xl border border-gray-200 hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
                  >
                    {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                    <span className="hidden sm:inline">{isUploading ? 'Uploading...' : 'Upload'}</span>
                  </button>
                </div>
              </div>
            </div>

            <textarea
              placeholder="Description"
              required
              className="w-full p-4 bg-gray-50 border-none rounded-2xl outline-none focus:ring-2 focus:ring-[#e90b35] h-32 resize-none md:col-span-2"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />

            {user?.role === 'admin' && (
              <div className="space-y-4 md:col-span-2">
                <div className="relative">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Custom Slug (URL path)"
                    className="w-full pl-12 pr-4 py-4 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-start">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full md:w-auto md:px-12 py-4 md:py-3 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-100 flex md:inline-flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : <>Save Changes <Save className="w-5 h-5" /></>}
            </button>
          </div>
        </form>
      </div>

      {showHoursModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowHoursModal(false)}
        >
          <div 
            className="bg-white w-full max-w-sm rounded-3xl p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold">Set Hours</h3>
            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
              {Object.entries(hours).map(([day, data]) => (
                <div key={day} className="space-y-2 p-3 bg-gray-50 rounded-xl">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">{day}</label>
                    <label className="flex items-center gap-2 text-xs font-medium text-gray-500">
                      <input 
                        type="checkbox" 
                        checked={data.closed}
                        onChange={(e) => setHours({
                          ...hours,
                          [day]: { ...data, closed: e.target.checked }
                        })}
                        className="accent-[#e90b35]"
                      />
                      Closed
                    </label>
                  </div>
                  {!data.closed && (
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        className="flex-1 p-2 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-[#e90b35]"
                        value={data.open}
                        onChange={(e) => setHours({
                          ...hours,
                          [day]: { ...data, open: e.target.value }
                        })}
                      />
                      <span className="text-gray-400">to</span>
                      <input
                        type="time"
                        className="flex-1 p-2 bg-white border border-gray-100 rounded-lg outline-none focus:ring-2 focus:ring-[#e90b35]"
                        value={data.close}
                        onChange={(e) => setHours({
                          ...hours,
                          [day]: { ...data, close: e.target.value }
                        })}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowHoursModal(false)}
                className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl active:scale-95 transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveHours}
                className="flex-1 py-3 bg-[#e90b35] text-white font-bold rounded-xl active:scale-95 transition-all"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onConfirm={confirmDelete}
        title="Delete Listing"
        message="Are you sure you want to delete this listing? This action cannot be undone."
      />
    </main>
  );
};
