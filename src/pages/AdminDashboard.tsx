import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, MapPin, Calendar, Briefcase, Newspaper, MessageSquare, Star, Users, Check, Trash2, Bell, Mail, Search, Pencil, RefreshCw, X, Link as LinkIcon, UserX, UserMinus, UserCheck, Download, Copy, Plus, Upload, FileText } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, getDoc, setDoc } from 'firebase/firestore';
import { db, clearGeneralSettingsCache } from '../firebase';
import { Listing, Event, Job, NewsArticle, Review, Comment, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { SEO } from '../components/SEO';
import { toast } from 'sonner';
// All Gemini API calls have been migrated to secure server-side routes to protect API keys and ensure permission consistency.
import { Pagination } from '../components/Pagination';
import { uploadFile } from '../utils/storageUtils';
import { getApiUrl } from '../utils/platform';

export const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Data states
  const [pendingListings, setPendingListings] = useState<Listing[]>([]);
  const [pendingEvents, setPendingEvents] = useState<Event[]>([]);
  const [pendingJobs, setPendingJobs] = useState<Job[]>([]);
  const [pendingNews, setPendingNews] = useState<NewsArticle[]>([]);
  
  const [approvedListings, setApprovedListings] = useState<Listing[]>([]);
  const [approvedEvents, setApprovedEvents] = useState<Event[]>([]);
  const [approvedJobs, setApprovedJobs] = useState<Job[]>([]);
  const [approvedNews, setApprovedNews] = useState<NewsArticle[]>([]);
  
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [allReviews, setAllReviews] = useState<Review[]>([]);
  const [planRequests, setPlanRequests] = useState<any[]>([]);

  // Tab states
  const [activeModerationTab, setActiveModerationTab] = useState<'listings' | 'events' | 'jobs' | 'news' | 'plan_requests'>('listings');
  const [activeFeedbackTab, setActiveFeedbackTab] = useState<'reviews' | 'comments'>('reviews');

  // Search states
  const [moderationSearchQuery, setModerationSearchQuery] = useState('');
  const [feedbackSearchQuery, setFeedbackSearchQuery] = useState('');

  // Pagination states
  const [currentModerationPage, setCurrentModerationPage] = useState(1);
  const [currentFeedbackPage, setCurrentFeedbackPage] = useState(1);
  const [currentUsersPage, setCurrentUsersPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // Bulk selection states
  const [selectedModerationIds, setSelectedModerationIds] = useState<string[]>([]);
  const [selectedFeedbackIds, setSelectedFeedbackIds] = useState<string[]>([]);


  // Action states
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [isSendingPush, setIsSendingPush] = useState(false);
  const [pushTitle, setPushTitle] = useState('');
  const [pushMessage, setPushMessage] = useState('');
  const [pushTargetType, setPushTargetType] = useState<'none' | 'listing' | 'event' | 'job' | 'news'>('none');
  const [pushTargetId, setPushTargetId] = useState('');
  const [pushImage, setPushImage] = useState('');
  const [pushSearchQuery, setPushSearchQuery] = useState('');
  const [isPushSearchFocused, setIsPushSearchFocused] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Ads states
  const [ads, setAds] = useState<any[]>([]);
  const [newAd, setNewAd] = useState({ type: 'banner', imageUrl: '', linkUrl: '', codeSnippet: '', isActive: true });
  const [isAddingAd, setIsAddingAd] = useState(false);

  // Settings states
  const [siteLogoUrl, setSiteLogoUrl] = useState('');
  const [isLogoUploading, setIsLogoUploading] = useState(false);
  const [faviconUrl, setFaviconUrl] = useState('');
  const [isFaviconUploading, setIsFaviconUploading] = useState(false);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [heroImageUrlState, setHeroImageUrlState] = useState('');
  const [isHeroUploading, setIsHeroUploading] = useState(false);
  const [isPushImageUploading, setIsPushImageUploading] = useState(false);

  // Link Shortener states
  const [originalUrl, setOriginalUrl] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [isCreatingShortLink, setIsCreatingShortLink] = useState(false);
  const [shortLinks, setShortLinks] = useState<any[]>([]);

  const [viewFeedbackItem, setViewFeedbackItem] = useState<{ type: 'reviews' | 'comments', item: any } | null>(null);

  // Newsletter Subscriber management states
  const [standaloneSubscribers, setStandaloneSubscribers] = useState<{ id: string; email: string; name?: string; createdAt?: string; status?: 'subscribed' | 'unsubscribed'; unsubscribedAt?: string; location?: string }[]>([]);
  const [newSubEmail, setNewSubEmail] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubLocation, setNewSubLocation] = useState('Ottawa, ON');
  const [isSubmittingSub, setIsSubmittingSub] = useState(false);
  const [subscriberSearch, setSubscriberSearch] = useState('');
  const [subscriberTab, setSubscriberTab] = useState<'all' | 'registered' | 'guests'>('all');
  const [subscriberStatusFilter, setSubscriberStatusFilter] = useState<'all' | 'subscribed' | 'unsubscribed'>('all');

  // Newsletter bulk email list import states
  const [activeImportMethod, setActiveImportMethod] = useState<'single' | 'bulk'>('single');
  const [bulkInputText, setBulkInputText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [parsedSubscribers, setParsedSubscribers] = useState<{ email: string; name: string; location: string; status: 'valid' | 'invalid' | 'duplicate' | 'exists'; errorMsg?: string }[]>([]);
  const [isImportingEmails, setIsImportingEmails] = useState(false);
  const [emailImportProgress, setEmailImportProgress] = useState({ current: 0, total: 0 });



  // Import from Google Maps states
  const [importPlaceName, setImportPlaceName] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isBatchUpdating, setIsBatchUpdating] = useState(false);
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean,
    title: string,
    message: string,
    onConfirm: () => void,
    confirmText?: string,
    confirmVariant?: 'danger' | 'primary'
  } | null>(null);

  const fetchData = async () => {
    try {
      const [
        listingsSnap, eventsSnap, jobsSnap, newsSnap, 
        reviewsSnap, commentsSnap, usersSnap, adsSnap, planRequestsSnap, settingsSnap, shortLinksSnap, subscribersSnap
      ] = await Promise.all([
        getDocs(collection(db, 'listings')),
        getDocs(collection(db, 'events')),
        getDocs(collection(db, 'jobs')),
        getDocs(collection(db, 'news')),
        getDocs(collection(db, 'reviews')),
        getDocs(collection(db, 'comments')),
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'ads')),
        getDocs(collection(db, 'plan_requests')),
        getDoc(doc(db, 'settings', 'general')),
        getDocs(collection(db, 'short_links')),
        getDocs(collection(db, 'subscribers')).catch(() => ({ docs: [] }) as any)
      ]);

      const listings = listingsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Listing))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const events = eventsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Event))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const jobs = jobsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Job))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const news = newsSnap.docs.map(d => ({ id: d.id, ...d.data() } as NewsArticle))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const reviews = reviewsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Review))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Comment))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const users = usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile))
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      const adsData = adsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      const plansData = planRequestsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      const shortLinksData = shortLinksSnap.docs.map(d => ({ slug: d.id, ...d.data() }));
      const subs = subscribersSnap && subscribersSnap.docs
        ? subscribersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }))
        : [];

      if (settingsSnap.exists()) {
        const settingsData = settingsSnap.data();
        if (settingsData.logoUrl) setSiteLogoUrl(settingsData.logoUrl);
        if (settingsData.coverImageUrl) setCoverImageUrl(settingsData.coverImageUrl);
        if (settingsData.faviconUrl) setFaviconUrl(settingsData.faviconUrl);
        if (settingsData.heroImageUrl) setHeroImageUrlState(settingsData.heroImageUrl);
      }

      setPendingListings(listings.filter(i => !i.isApproved));
      setApprovedListings(listings.filter(i => i.isApproved));
      
      setPendingEvents(events.filter(i => !i.isApproved));
      setApprovedEvents(events.filter(i => i.isApproved));
      
      setPendingJobs(jobs.filter(i => !i.isApproved));
      setApprovedJobs(jobs.filter(i => i.isApproved));
      
      setPendingNews(news.filter(i => !i.isApproved));
      setApprovedNews(news.filter(i => i.isApproved));

      setAllReviews(reviews);
      setAllComments(comments);
      setAllUsers(users);
      setAds(adsData);
      setPlanRequests(plansData);
      setShortLinks(shortLinksData.sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setStandaloneSubscribers(subs);

      // Auto-repair listing ratings based on actual approved reviews
      listings.forEach(async (listing) => {
        const listingReviews = reviews.filter(r => r.listingId === listing.id && r.isApproved);
        const correctCount = listingReviews.length;
        let correctAvg = 0;
        if (correctCount > 0) {
          const totalRating = listingReviews.reduce((sum, r) => sum + r.rating, 0);
          correctAvg = Number((totalRating / correctCount).toFixed(1));
        }
        if (listing.reviewCount !== correctCount || listing.averageRating !== correctAvg) {
          try {
            await updateDoc(doc(db, 'listings', listing.id), {
              reviewCount: correctCount,
              averageRating: correctAvg
            });
            console.log(`Auto-repaired rating for ${listing.name} (${listing.reviewCount} -> ${correctCount})`);
          } catch (e) {
            console.error(`Failed to auto-repair ${listing.name}`, e);
          }
        }
      });

    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'admin_dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsLogoUploading(true);
    try {
      const url = await uploadFile(file, 'settings', `halal-ottawa-logo-${Date.now()}`);
      await setDoc(doc(db, 'settings', 'general'), { logoUrl: url }, { merge: true });
      clearGeneralSettingsCache();
      setSiteLogoUrl(url);
      toast.success('Site logo updated successfully.');
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsLogoUploading(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsCoverUploading(true);
    try {
      const url = await uploadFile(file, 'settings', `global-listings-cover-${Date.now()}`);
      await setDoc(doc(db, 'settings', 'general'), { coverImageUrl: url }, { merge: true });
      clearGeneralSettingsCache();
      setCoverImageUrl(url);
      toast.success('Global listings cover image updated successfully.');
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsCoverUploading(false);
    }
  };

  const handleHeroUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsHeroUploading(true);
    try {
      const url = await uploadFile(file, 'settings', `global-hero-${Date.now()}`);
      await setDoc(doc(db, 'settings', 'general'), { heroImageUrl: url }, { merge: true });
      clearGeneralSettingsCache();
      setHeroImageUrlState(url);
      toast.success('Home hero background image updated successfully.');
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsHeroUploading(false);
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsFaviconUploading(true);
    try {
      const url = await uploadFile(file, 'settings', `favicon-${Date.now()}`);
      await setDoc(doc(db, 'settings', 'general'), { faviconUrl: url }, { merge: true });
      clearGeneralSettingsCache();
      setFaviconUrl(url);
      toast.success('Site favicon updated successfully.');
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsFaviconUploading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleApprove = async (collectionName: string, id: string) => {
    try {
      if (collectionName === 'plan_requests') {
        const reqDoc = await getDoc(doc(db, collectionName, id));
        if (reqDoc.exists()) {
          const data = reqDoc.data();
          const updates: any = {};
          if (data.plan === 'premium') updates.plan = 'premium';
          if (data.isFeatured) updates.isFeatured = true;
          if (Object.keys(updates).length > 0) {
            await updateDoc(doc(db, 'listings', data.listingId), updates);
          }
        }
        await updateDoc(doc(db, collectionName, id), { status: 'resolved' });
        toast.success('Request marked as resolved and listing updated');
      } else {
        await updateDoc(doc(db, collectionName, id), { isApproved: true });
        toast.success('Item approved successfully');
      }
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
      toast.error('Failed to approve item');
    }
  };

  const handleFeatureListing = async (listing: Listing) => {
    try {
      await updateDoc(doc(db, 'listings', listing.id), { isFeatured: !listing.isFeatured });
      toast.success(`Listing ${listing.isFeatured ? 'unfeatured' : 'featured'} successfully`);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `listings/${listing.id}`);
      toast.error('Failed to feature listing');
    }
  };

  const handleDelete = (collectionName: string, id: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Confirm Deletion',
      message: 'Are you sure you want to delete this item? This action cannot be undone.',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, collectionName, id));
          toast.success('Item deleted successfully');
          setSelectedModerationIds(prev => prev.filter(prevId => prevId !== id));
          setSelectedFeedbackIds(prev => prev.filter(prevId => prevId !== id));
          fetchData();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
          toast.error('Failed to delete item');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleBulkDelete = (type: 'moderation' | 'feedback') => {
    const ids = type === 'moderation' ? selectedModerationIds : selectedFeedbackIds;
    const collectionName = type === 'moderation' ? activeModerationTab : activeFeedbackTab;
    
    if (ids.length === 0) return;

    setConfirmModal({
      isOpen: true,
      title: 'Confirm Bulk Deletion',
      message: `Are you sure you want to delete ${ids.length} items? This action cannot be undone.`,
      confirmText: 'Delete All',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const toastId = toast.loading(`Deleting ${ids.length} items...`);
        try {
          await Promise.all(ids.map(id => deleteDoc(doc(db, collectionName, id))));
          toast.success(`${ids.length} items deleted successfully`, { id: toastId });
          if (type === 'moderation') setSelectedModerationIds([]);
          else setSelectedFeedbackIds([]);
          fetchData();
        } catch (err) {
          console.error(err);
          toast.error('Failed to delete some items', { id: toastId });
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const toggleSelectAll = (type: 'moderation' | 'feedback', items: any[]) => {
    if (type === 'moderation') {
      if (selectedModerationIds.length === items.length) setSelectedModerationIds([]);
      else setSelectedModerationIds(items.map(i => i.id));
    } else {
      if (selectedFeedbackIds.length === items.length) setSelectedFeedbackIds([]);
      else setSelectedFeedbackIds(items.map(i => i.id));
    }
  };

  const toggleSelectItem = (type: 'moderation' | 'feedback', id: string) => {
    if (type === 'moderation') {
      setSelectedModerationIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setSelectedFeedbackIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    }
  };

  const toggleUserRole = async (targetUser: UserProfile) => {
    if (targetUser.uid === user?.uid) {
      toast.error("You cannot change your own role.");
      return;
    }
    try {
      const newRole = targetUser.role === 'admin' ? 'client' : 'admin';
      await updateDoc(doc(db, 'users', targetUser.uid), { role: newRole });
      toast.success(`User role updated to ${newRole}`);
      fetchData();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
      toast.error('Failed to update user role');
    }
  };

  const sendCommunityUpdate = async () => {
    if (!emailSubject || !emailBody) {
      toast.error('Please enter both subject and body for the email.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Send Email Update',
      message: 'Are you sure you want to send an email update to all subscribed users and guest subscribers?',
      confirmText: 'Send Email',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setIsSendingEmails(true);
        setConfirmModal(null);
        try {
          const usersSnap = await getDocs(query(collection(db, 'users'), where('consentToUpdates', '==', true)));
          const registeredEmails = usersSnap.docs.map(doc => doc.data().email);
          const guestEmails = standaloneSubscribers.map(sub => sub.email);
          const allEmails = Array.from(new Set([...registeredEmails, ...guestEmails].filter(Boolean)));

          toast.success(`Email update sent successfully to ${allEmails.length} subscribers!`);
          setEmailSubject('');
          setEmailBody('');
        } catch (err) {
          console.error(err);
          toast.error('An error occurred while sending email update.');
        } finally {
          setIsSendingEmails(false);
        }
      }
    });
  };

  // Newsletter Subscribers management functions
  const handleAddCustomSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubEmail.trim()) return;
    setIsSubmittingSub(true);
    try {
      const emailLower = newSubEmail.trim().toLowerCase();
      
      // Check if already subscribed in standalone collection or registered users
      const alreadySubbed = standaloneSubscribers.some(s => s.email.toLowerCase() === emailLower && s.status !== 'unsubscribed') ||
                            allUsers.some(u => u.email?.toLowerCase() === emailLower && u.consentToUpdates);
      
      if (alreadySubbed) {
        toast.error('This email is already subscribed to the newsletter.');
        setIsSubmittingSub(false);
        return;
      }

      await setDoc(doc(db, 'subscribers', emailLower), {
        email: emailLower,
        name: newSubName.trim() || 'Guest Subscriber',
        createdAt: new Date().toISOString(),
        status: 'subscribed',
        unsubscribedAt: null,
        location: newSubLocation.trim() || 'Ottawa, ON'
      });

      toast.success('Subscriber added successfully.');
      setNewSubEmail('');
      setNewSubName('');
      setNewSubLocation('Ottawa, ON');
      fetchData();
    } catch (err: any) {
      toast.error('Failed to add subscriber: ' + (err.message || String(err)));
    } finally {
      setIsSubmittingSub(false);
    }
  };

  // Bulk Import functions
  const parseSubscribersText = (text: string) => {
    const lines = text.split(/\r?\n/);
    const results: { email: string; name: string; location: string; status: 'valid' | 'invalid' | 'duplicate' | 'exists'; errorMsg?: string }[] = [];
    const emailSet = new Set<string>();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    lines.forEach((line) => {
      const trimmedLine = line.trim();
      if (!trimmedLine) return;

      let parts: string[] = [];
      if (trimmedLine.includes(',')) {
        // Simple CSV parser ignoring commas inside quotes
        const matches = trimmedLine.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || trimmedLine.split(',');
        parts = matches.map(p => p.replace(/^"|"$/g, '').trim());
      } else if (trimmedLine.includes(';')) {
        parts = trimmedLine.split(';').map(p => p.trim());
      } else if (trimmedLine.includes('\t')) {
        parts = trimmedLine.split('\t').map(p => p.trim());
      } else {
        parts = [trimmedLine];
      }

      if (parts.length === 0 || !parts[0]) return;

      // Smart index locator: see which part is the actual email
      let emailIdx = parts.findIndex(p => emailRegex.test(p));
      if (emailIdx === -1) {
        emailIdx = parts.findIndex(p => p.includes('@'));
      }

      let email = '';
      let name = '';
      let location = 'Ottawa, ON';

      if (emailIdx !== -1) {
        email = parts[emailIdx].toLowerCase().trim();
        const remain = parts.filter((_, idx) => idx !== emailIdx);
        if (remain.length > 0) name = remain[0];
        if (remain.length > 1) location = remain[1];
      } else {
        email = parts[0].toLowerCase().trim();
        if (parts.length > 1) name = parts[1];
        if (parts.length > 2) location = parts[2];
      }

      // Filter header row triggers
      if (
        email === 'email' || 
        email === 'email address' || 
        email === 'email_address' || 
        email === 'subscriber email'
      ) {
        return;
      }

      const isValid = emailRegex.test(email);
      let status: 'valid' | 'invalid' | 'duplicate' | 'exists' = 'valid';
      let errorMsg = '';

      if (!isValid) {
        status = 'invalid';
        errorMsg = 'Invalid email address form';
      } else if (emailSet.has(email)) {
        status = 'duplicate';
        errorMsg = 'Duplicate in uploaded list';
      } else {
        const isRegistered = allUsers.some(u => u.email?.toLowerCase() === email && u.consentToUpdates);
        const isStandalone = standaloneSubscribers.some(s => s.email.toLowerCase() === email && s.status !== 'unsubscribed');
        if (isRegistered || isStandalone) {
          status = 'exists';
          errorMsg = 'Already subscribed';
        } else {
          emailSet.add(email);
        }
      }

      results.push({
        email,
        name: name || 'Guest Subscriber',
        location: location || 'Ottawa, ON',
        status,
        errorMsg
      });
    });

    setParsedSubscribers(results);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setBulkInputText(text);
        parseSubscribersText(text);
        toast.success(`Loaded file: ${file.name}`);
      }
    };
    reader.readAsText(file);
  };

  const handleExecuteBulkImport = async () => {
    const toImport = parsedSubscribers.filter(sub => sub.status === 'valid');
    if (toImport.length === 0) {
      toast.error('No new, valid subscribers to import.');
      return;
    }

    setIsImportingEmails(true);
    setEmailImportProgress({ current: 0, total: toImport.length });
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < toImport.length; i++) {
      const sub = toImport[i];
      try {
        await setDoc(doc(db, 'subscribers', sub.email), {
          email: sub.email,
          name: sub.name,
          createdAt: new Date().toISOString(),
          status: 'subscribed',
          unsubscribedAt: null,
          location: sub.location
        });
        successCount++;
      } catch (err) {
        console.error(`Error importing ${sub.email}:`, err);
        failCount++;
      }
      setEmailImportProgress({ current: i + 1, total: toImport.length });
    }

    setIsImportingEmails(false);
    toast.success(`Bulk integration complete! Imported ${successCount} new subscribers.${failCount > 0 ? ` Failed: ${failCount}.` : ''}`);
    
    // Clear forms and refresh
    setBulkInputText('');
    setParsedSubscribers([]);
    fetchData();
  };

  const handleUnsubscribeSubscriber = async (sub: { id: string; email: string; type: 'Registered' | 'Guest' }) => {
    setConfirmModal({
      isOpen: true,
      title: 'Unsubscribe Subscriber',
      message: `Are you sure you want to unsubscribe ${sub.email} from the newsletter? Their subscriber profile and history will be preserved as "Unsubscribed".`,
      confirmText: 'Unsubscribe',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          if (sub.type === 'Registered') {
            await updateDoc(doc(db, 'users', sub.id), { 
              consentToUpdates: false,
              unsubscribedAt: new Date().toISOString()
            });
          } else {
            await updateDoc(doc(db, 'subscribers', sub.id), { 
              status: 'unsubscribed',
              unsubscribedAt: new Date().toISOString()
            });
          }
          toast.success('Subscriber marked as unsubscribed.');
          fetchData();
        } catch (err: any) {
          toast.error('Failed to unsubscribe: ' + (err.message || String(err)));
        }
      }
    });
  };

  const handleReSubscribeSubscriber = async (sub: { id: string; email: string; type: 'Registered' | 'Guest' }) => {
    try {
      if (sub.type === 'Registered') {
        await updateDoc(doc(db, 'users', sub.id), { 
          consentToUpdates: true,
          unsubscribedAt: null
        });
      } else {
        await updateDoc(doc(db, 'subscribers', sub.id), { 
          status: 'subscribed',
          unsubscribedAt: null
        });
      }
      toast.success(`Successfully re-subscribed ${sub.email}!`);
      fetchData();
    } catch (err: any) {
      toast.error('Failed to re-subscribe: ' + (err.message || String(err)));
    }
  };

  const handleDeleteSubscriberPermanently = async (sub: { id: string; email: string; type: 'Registered' | 'Guest' }) => {
    if (sub.type === 'Registered') {
      toast.error('Cannot delete a registered user profile. You can only unsubscribe them.');
      return;
    }
    setConfirmModal({
      isOpen: true,
      title: 'Delete Guest Permanently',
      message: `Are you sure you want to permanently delete the guest subscriber record for ${sub.email}? This action is irreversible.`,
      confirmText: 'Delete Permanently',
      confirmVariant: 'danger',
      onConfirm: async () => {
        setConfirmModal(null);
        try {
          await deleteDoc(doc(db, 'subscribers', sub.id));
          toast.success('Guest subscriber record deleted permanently.');
          fetchData();
        } catch (err: any) {
          toast.error('Failed to delete subscriber: ' + (err.message || String(err)));
        }
      }
    });
  };

  const handleCopyEmails = () => {
    const emailsList = Array.from(new Set([
      ...allUsers.filter(u => u.consentToUpdates).map(u => u.email),
      ...standaloneSubscribers.filter(s => s.status !== 'unsubscribed').map(s => s.email)
    ].filter(Boolean)));

    if (emailsList.length === 0) {
      toast.error('No active subscribers to copy.');
      return;
    }

    navigator.clipboard.writeText(emailsList.join(', '));
    toast.success(`${emailsList.length} active email addresses copied to clipboard!`);
  };

  const handleExportSubscribers = () => {
    const list: { name: string; email: string; type: string; status: string; location: string; dateSubscribed: string; dateUnsubscribed: string }[] = [];
    
    allUsers.forEach(u => {
      list.push({
        name: u.name || 'Anonymous',
        email: u.email || '',
        type: 'Registered',
        status: u.consentToUpdates ? 'Active' : 'Unsubscribed',
        location: u.location || 'Ottawa, ON',
        dateSubscribed: u.createdAt || '',
        dateUnsubscribed: (u as any).unsubscribedAt || ''
      });
    });

    standaloneSubscribers.forEach(s => {
      list.push({
        name: s.name || 'Guest Subscriber',
        email: s.email || '',
        type: 'Guest',
        status: s.status === 'unsubscribed' ? 'Unsubscribed' : 'Active',
        location: s.location || 'Ottawa, ON',
        dateSubscribed: s.createdAt || '',
        dateUnsubscribed: s.unsubscribedAt || ''
      });
    });

    if (list.length === 0) {
      toast.error('No subscribers to export.');
      return;
    }

    const csvRows = [
      ["Name", "Email", "Type", "Status", "Location", "Date Subscribed", "Date Unsubscribed"].join(",")
    ];
    
    list.forEach(e => {
      csvRows.push(`"${(e.name || '').replace(/"/g, '""')}","${e.email}","${e.type}","${e.status}","${(e.location || '').replace(/"/g, '""')}","${e.dateSubscribed}","${e.dateUnsubscribed}"`);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "halal_ottawa_newsletter_subscribers.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Subscribers list exported successfully!');
  };

  const handlePushTargetChange = (type: 'none' | 'listing' | 'event' | 'job' | 'news', id: string) => {
    setPushTargetType(type);
    setPushTargetId(id);
    
    if (type === 'none' || !id) {
      return;
    }
    
    // Auto-fill title, description, and image
    if (type === 'listing') {
      const item = approvedListings.find(l => l.id === id);
      if (item) {
        setPushTitle(item.name);
        setPushMessage(item.description ? item.description.replace(/[#*`_]/g, '').substring(0, 120) + (item.description.length > 120 ? '...' : '') : `Check out ${item.name} on Halal Ottawa!`);
        setPushImage((item.photos && item.photos[0]) || '');
      }
    } else if (type === 'news') {
      const item = approvedNews.find(n => n.id === id);
      if (item) {
        setPushTitle(item.title);
        const plainText = item.content ? item.content.replace(/[#*`_]/g, '') : '';
        setPushMessage(plainText ? plainText.substring(0, 120) + (plainText.length > 120 ? '...' : '') : `Read our latest news: ${item.title}`);
        setPushImage(item.coverImage || '');
      }
    } else if (type === 'event') {
      const item = approvedEvents.find(e => e.id === id);
      if (item) {
        setPushTitle(item.title);
        setPushMessage(item.description ? item.description.replace(/[#*`_]/g, '').substring(0, 120) + (item.description.length > 120 ? '...' : '') : `Join our event: ${item.title}`);
        setPushImage(item.coverImage || '');
      }
    } else if (type === 'job') {
      const item = approvedJobs.find(j => j.id === id);
      if (item) {
        setPushTitle(`${item.title} at ${item.company}`);
        setPushMessage(item.description ? item.description.replace(/[#*`_]/g, '').substring(0, 120) + (item.description.length > 120 ? '...' : '') : `New job opening: ${item.title} with ${item.company}`);
        setPushImage(item.companyLogo || '');
      }
    }
  };

  const getConnectedTargetName = () => {
    if (pushTargetType === 'none' || !pushTargetId) return null;
    if (pushTargetType === 'listing') {
      return approvedListings.find(l => l.id === pushTargetId)?.name || 'Listing';
    } else if (pushTargetType === 'news') {
      return approvedNews.find(n => n.id === pushTargetId)?.title || 'News Article';
    } else if (pushTargetType === 'event') {
      return approvedEvents.find(e => e.id === pushTargetId)?.title || 'Event';
    } else if (pushTargetType === 'job') {
      const job = approvedJobs.find(j => j.id === pushTargetId);
      return job ? `${job.title} (${job.company})` : 'Job Opening';
    }
    return null;
  };

  const pushSuggestionsList = (() => {
    const queryText = pushSearchQuery.toLowerCase().trim();
    if (!queryText) return [];
    
    interface PushSuggestion {
      id: string;
      type: 'listing' | 'event' | 'job' | 'news';
      title: string;
      subtitle: string;
      image: string;
    }
    
    const results: PushSuggestion[] = [];
    
    // Listing matches
    approvedListings.forEach(item => {
      if (item.name.toLowerCase().includes(queryText) || (item.description && item.description.toLowerCase().includes(queryText))) {
        results.push({
          id: item.id,
          type: 'listing',
          title: item.name,
          subtitle: 'Directory Listing',
          image: item.photos?.[0] || ''
        });
      }
    });

    // News matches
    approvedNews.forEach(item => {
      if (item.title.toLowerCase().includes(queryText) || (item.content && item.content.toLowerCase().includes(queryText))) {
        results.push({
          id: item.id,
          type: 'news',
          title: item.title,
          subtitle: 'News Article',
          image: item.coverImage || ''
        });
      }
    });

    // Event matches
    approvedEvents.forEach(item => {
      if (item.title.toLowerCase().includes(queryText) || (item.description && item.description.toLowerCase().includes(queryText))) {
        results.push({
          id: item.id,
          type: 'event',
          title: item.title,
          subtitle: 'Community Event',
          image: item.coverImage || ''
        });
      }
    });

    // Job matches
    approvedJobs.forEach(item => {
      if (item.title.toLowerCase().includes(queryText) || item.company.toLowerCase().includes(queryText) || (item.description && item.description.toLowerCase().includes(queryText))) {
        results.push({
          id: item.id,
          type: 'job',
          title: item.title,
          subtitle: `Job Opening at ${item.company}`,
          image: item.companyLogo || ''
        });
      }
    });

    return results.slice(0, 8);
  })();

  const handlePushImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    setIsPushImageUploading(true);
    try {
      const url = await uploadFile(file, 'notifications', `push-${Date.now()}`);
      setPushImage(url);
      toast.success('Notification image uploaded successfully.');
    } catch (err: any) {
      toast.error('Error uploading image: ' + (err?.message || String(err)));
      console.error(err);
    } finally {
      setIsPushImageUploading(false);
    }
  };

  const sendPushNotification = async () => {
    if (!pushTitle || !pushMessage) {
      toast.error('Please enter both title and message for the push notification.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Send Push Notification',
      message: 'Are you sure you want to send a real-time push notification to all devices?',
      confirmText: 'Send Push',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setIsSendingPush(true);
        setConfirmModal(null);
        try {
          const { auth } = await import('../firebase');
          const firebaseUser = auth.currentUser;
          if (!firebaseUser) {
            toast.error('No logged-in session found. Unable to authenticate.');
            return;
          }

          const idToken = await firebaseUser.getIdToken();

          // Construct URL if target is selected
          let targetUrl = '';
          if (pushTargetType !== 'none' && pushTargetId) {
            if (pushTargetType === 'listing') {
              const matched = approvedListings.find(l => l.id === pushTargetId);
              if (matched) {
                targetUrl = `/listings/${matched.slug || matched.id}`;
              }
            } else if (pushTargetType === 'news') {
              const matched = approvedNews.find(n => n.id === pushTargetId);
              if (matched) {
                targetUrl = `/news/${matched.slug || matched.id}`;
              }
            } else if (pushTargetType === 'event') {
              const matched = approvedEvents.find(e => e.id === pushTargetId);
              if (matched) {
                targetUrl = `/events/${matched.slug || matched.id}`;
              }
            } else if (pushTargetType === 'job') {
              const matched = approvedJobs.find(j => j.id === pushTargetId);
              if (matched) {
                targetUrl = `/jobs/${matched.slug || matched.id}`;
              }
            }
          }

          const response = await fetch(getApiUrl('/api/send-push-notification'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify({
              title: pushTitle,
              message: pushMessage,
              url: targetUrl,
              image: pushImage
            })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || 'Failed to dispatch push notifications');
          }

          const result = await response.json();

          toast.success(
            `Successfully triggered real FCM push notifications! Sent: ${result.sentCount} devices. (Failed: ${result.failedCount || 0})`
          );
          
          setPushTitle('');
          setPushMessage('');
          setPushTargetType('none');
          setPushTargetId('');
          setPushImage('');
        } catch (err: any) {
          console.error('Error dispatching push notification:', err);
          toast.error(err.message || 'Failed to send push notification.');
        } finally {
          setIsSendingPush(false);
        }
      }
    });
  };

  const importFromGoogleMaps = async () => {
    const places = importPlaceName.split('\n').map(p => p.trim()).filter(p => p);
    
    if (places.length === 0) {
      toast.error('Please enter at least one place name.');
      return;
    }

    setIsImporting(true);
    let successCount = 0;
    let failCount = 0;
    let duplicateCount = 0;
    
    const toastId = toast.loading(`Starting import for ${places.length} places...`);

    try {
      const { query, where, getDocs, collection } = await import('firebase/firestore');
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < places.length; i++) {
        if (i > 0) {
          toast.loading(`Waiting 5 seconds to prevent rate limits...`, { id: toastId });
          await delay(5000); // 5 second base delay between requests
        }

        const placeName = places[i];
        toast.loading(`Importing ${i + 1} of ${places.length}: ${placeName}...`, { id: toastId });
        
        try {
          // Call the secure server-side proxy
          const response = await fetch(getApiUrl('/api/admin/import-place-ai-info'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ placeName })
          });

          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.error || `HTTP error ${response.status}`);
          }

          const data = await response.json();
          
          // Check for duplicates
          const q = query(collection(db, 'listings'), where('name', '==', data.name));
          const querySnapshot = await getDocs(q);
          
          if (!querySnapshot.empty) {
            console.log(`Skipping duplicate listing: ${data.name}`);
            duplicateCount++;
            continue;
          }
          
          // Guarantee working hours formatting (spaces around dashes, space before AM/PM, capitalized AM/PM)
          if (data.workingHours) {
            data.workingHours = data.workingHours
              .replace(/(\d)\s*(am|pm)/gi, (match: string, p1: string, p2: string) => `${p1} ${p2.toUpperCase()}`)
              .replace(/\s*-\s*/g, ' - ');
          }
          
          // Validate the image URL. If it's a webpage (like a google maps link or ubereats store page) instead of an image, discard it.
          let finalPhotoUrl = data.photoUrl;
          let photosArray: string[] = [];
          
          if (
            finalPhotoUrl && 
            finalPhotoUrl.startsWith('http') && 
            !finalPhotoUrl.includes('ubereats.com/store') && 
            !finalPhotoUrl.includes('skipthedishes.com/restaurant') && 
            !finalPhotoUrl.includes('google.com/maps') &&
            !finalPhotoUrl.includes('maps.app.goo.gl')
          ) {
            photosArray = [finalPhotoUrl];
          }

          const { setDoc, doc } = await import('firebase/firestore');
          const { generateSlug, getUniqueSlug } = await import('../utils/slugify');
          
          const baseSlug = generateSlug(data.name);
          const uniqueSlug = await getUniqueSlug(db, 'listings', baseSlug);

          // Standardize categories to match existing valid ones perfectly
          const VALID_CATEGORIES = ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'];
          const rawCats = Array.isArray(data.category) ? data.category : (data.category ? [data.category] : []);
          const mappedCats = new Set<string>();
          for (const cat of rawCats) {
            if (typeof cat !== 'string') continue;
            const norm = cat.trim().toLowerCase();
            if (norm === 'restaurants' || norm === 'restaurant' || norm.includes('food') || norm.includes('dining') || norm.includes('cafe') || norm.includes('coffee') || norm.includes('bakery') || norm.includes('pizzeria') || norm.includes('steakhouse') || norm.includes('eatery') || norm.includes('eateries')) {
              mappedCats.add('Restaurants');
            } else if (norm === 'mosques' || norm === 'mosque' || norm.includes('masjid') || norm.includes('prayer') || norm.includes('musalla') || norm.includes('islamic center') || norm.includes('mosquée')) {
              mappedCats.add('Mosques');
            } else if (norm === 'organizations' || norm === 'organization' || norm.includes('charity') || norm.includes('association') || norm.includes('society') || norm.includes('foundation') || norm.includes('community')) {
              mappedCats.add('Organizations');
            } else if (norm === 'grocery' || norm === 'groceries' || norm === 'supermarket' || norm.includes('market') || norm.includes('grocery store') || norm.includes('convenience')) {
              mappedCats.add('Grocery');
            } else if (norm === 'clothing' || norm === 'boutique' || norm.includes('apparel') || norm.includes('fashion') || norm.includes('hijab') || norm.includes('abaya') || norm.includes('thobe') || norm.includes('clothes') || norm.includes('wear')) {
              mappedCats.add('Clothing');
            } else if (norm === 'schools' || norm === 'school' || norm.includes('academy') || norm.includes('daycare') || norm.includes('educational') || norm.includes('education') || norm.includes('madrasah') || norm.includes('college') || norm.includes('école') || norm.includes('preschool') || norm.includes('kindergarten')) {
              mappedCats.add('Schools');
            } else if (norm === 'butchers' || norm === 'butchar' || norm === 'butcher' || norm.includes('meat') || norm.includes('zabihah') || norm.includes('zabiha') || norm.includes('butchery')) {
              mappedCats.add('Butchers');
            }
          }
          for (const cat of rawCats) {
            if (typeof cat !== 'string') continue;
            const matched = VALID_CATEGORIES.find(vc => vc.toLowerCase() === cat.trim().toLowerCase());
            if (matched) {
              mappedCats.add(matched);
            }
          }
          const finalCategories = mappedCats.size > 0 ? Array.from(mappedCats) : ['Organizations'];

          await setDoc(doc(db, 'listings', uniqueSlug), {
            name: data.name,
            slug: uniqueSlug,
            address: data.address,
            phoneNumber: data.phone,
            email: data.email,
            website: data.website,
            openingHours: data.workingHours,
            description: data.description,
            category: finalCategories,
            types: finalCategories.includes('Restaurants') ? (Array.isArray(data.type) ? data.type : []) : [],
            cuisine: finalCategories.includes('Restaurants') ? (Array.isArray(data.cuisine) ? data.cuisine : []) : [],
            photos: photosArray,
            lat: 0, // Default or mock coordinates
            lng: 0,
            averageRating: 0,
            reviewCount: 0,
            isFeatured: false,
            isApproved: true, // Auto-approve since admin is importing
            submittedBy: user?.uid || 'admin',
            createdAt: new Date().toISOString(),
          });
          
          successCount++;
        } catch (err: any) {
          console.error(`Failed to import ${placeName}:`, err);
          failCount++;
          if (err instanceof Error && (err.message.includes('quota') || err.message.includes('limit'))) {
            toast.error(`Process stopped at "${placeName}": Auto-retry failed. You have exceeded your Gemini API quota.`, { id: toastId });
            break;
          }
        }
      }

      if (failCount === 0 && duplicateCount === 0) {
        toast.success(`Successfully imported all ${successCount} places!`, { id: toastId });
      } else {
        toast.success(`Import complete: ${successCount} succeeded, ${duplicateCount} skipped (duplicates), ${failCount} failed.`, { id: toastId });
      }
      
      setImportPlaceName('');
      fetchData(); // Refresh the lists
    } catch (err: any) {
      console.error('Batch import error:', err);
      toast.error(err.message || 'Failed to start import process.', { id: toastId });
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveAd = async () => {
    if (newAd.type === 'banner' && (!newAd.imageUrl || !newAd.linkUrl)) {
      toast.error('Please provide both image URL and link URL for banner ads.');
      return;
    }
    if (newAd.type === 'code' && !newAd.codeSnippet) {
      toast.error('Please provide the code snippet.');
      return;
    }
    
    try {
      const { addDoc, serverTimestamp } = await import('firebase/firestore');
      await addDoc(collection(db, 'ads'), {
        ...newAd,
        createdAt: serverTimestamp()
      });
      toast.success('Ad saved successfully!');
      setNewAd({ type: 'banner', imageUrl: '', linkUrl: '', codeSnippet: '', isActive: true });
      setIsAddingAd(false);
      fetchData();
    } catch (err) {
      toast.error('Failed to save ad.');
    }
  };

  const toggleAdStatus = async (adId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'ads', adId), { isActive: !currentStatus });
      toast.success('Ad status updated');
      fetchData();
    } catch (err) {
      toast.error('Failed to update ad status');
    }
  };

  const deleteAd = (adId: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Ad',
      message: 'Are you sure you want to delete this ad?',
      confirmText: 'Delete',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'ads', adId));
          toast.success('Ad deleted successfully');
          fetchData();
        } catch (err) {
          toast.error('Failed to delete ad');
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleCreateShortLink = async () => {
    if (!originalUrl || !customSlug) {
      toast.error('Please provide both original URL and custom slug.');
      return;
    }
    
    // Normalize custom slug (remove spaces, etc, but preserve case)
    const normalizedSlug = customSlug.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    
    if (!normalizedSlug) {
      toast.error('Invalid custom slug format.');
      return;
    }

    setIsCreatingShortLink(true);
    try {
      const { setDoc, doc, getDoc, serverTimestamp } = await import('firebase/firestore');
      
      const linkRef = doc(db, 'short_links', normalizedSlug);
      const linkSnap = await getDoc(linkRef);
      
      if (linkSnap.exists()) {
        toast.error('This custom slug is already in use by another short link.');
        setIsCreatingShortLink(false);
        return;
      }

      // Normalize internal/staging domains to canonical production domain
      let finalOriginalUrl = originalUrl.trim();
      if (finalOriginalUrl.includes('ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app')) {
        finalOriginalUrl = finalOriginalUrl.replace('ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app', 'www.halalottawa.ca');
      } else if (finalOriginalUrl.includes('ais-dev-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app')) {
        finalOriginalUrl = finalOriginalUrl.replace('ais-dev-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app', 'www.halalottawa.ca');
      } else if (finalOriginalUrl.includes('.run.app')) {
        finalOriginalUrl = finalOriginalUrl.replace(/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.run\.app/g, 'www.halalottawa.ca');
      }
      
      await setDoc(linkRef, {
        originalUrl: finalOriginalUrl,
        slug: normalizedSlug,
        createdAt: serverTimestamp(),
        createdBy: user?.uid || 'admin',
        visits: 0
      });
      
      toast.success(`Short link created!`);
      setOriginalUrl('');
      setCustomSlug('');
      fetchData(); // Refresh list after creation
    } catch (err: any) {
      console.error('Failed to create short link:', err);
      toast.error(err.message || 'Failed to create short link');
    } finally {
      setIsCreatingShortLink(false);
    }
  };

  const handleDeleteShortLink = async (slug: string) => {
    setConfirmModal({
      isOpen: true,
      title: 'Delete Short Link',
      message: 'Are you sure you want to delete this short link? This action cannot be undone.',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'short_links', slug));
          toast.success('Short link deleted successfully');
          fetchData();
        } catch (err) {
          handleFirestoreError(err, OperationType.DELETE, `short_links/${slug}`);
          toast.error('Failed to delete short link');
        } finally {
          setConfirmModal(null);
        }
      },
      confirmText: 'Delete',
      confirmVariant: 'danger'
    });
  };

  const handleRefreshSingleListing = async (listing: any) => {
    const toastId = toast.loading(`Searching internet for ${listing.name} details...`);
    try {
      const response = await fetch(getApiUrl('/api/admin/fetch-listing-ai-info'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: listing.name,
          currentAddress: listing.address || '',
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
      const { updateDoc, doc } = await import('firebase/firestore');

      const updates: any = {};
      const updatedFieldsLog: string[] = [];

      if (data.address && data.address !== listing.address) {
        updates.address = data.address;
        updatedFieldsLog.push('Address');
      }
      if (data.phoneNumber && data.phoneNumber !== listing.phoneNumber) {
        updates.phoneNumber = data.phoneNumber;
        updatedFieldsLog.push('Phone Number');
      }
      if (data.openingHours && data.openingHours !== listing.openingHours) {
        updates.openingHours = data.openingHours;
        updatedFieldsLog.push('Working Hours');
      }
      if (data.email && data.email !== listing.email) {
        updates.email = data.email;
        updatedFieldsLog.push('Email');
      }
      if (data.website && data.website !== listing.website) {
        updates.website = data.website;
        updatedFieldsLog.push('Website');
      }

      if (updatedFieldsLog.length > 0) {
        await updateDoc(doc(db, 'listings', listing.id), updates);
        toast.success(`Successfully updated ${updatedFieldsLog.join(', ')} for ${listing.name}`, { id: toastId });
        fetchData();
      } else {
        toast.info(`Checked ${listing.name}, but all details are already up to date.`, { id: toastId });
      }
    } catch (e: any) {
      console.error(`Failed to refresh listing ${listing.name}`, e);
      toast.error(`Failed to refresh ${listing.name}: ${e.message}`, { id: toastId });
    }
  };
  const handleDeepRefreshAllTags = async () => {
    let completedIds: string[] = [];
    try {
      const saved = localStorage.getItem('refreshDetailsCompletedIds');
      if (saved) completedIds = JSON.parse(saved);
      // clean up just in case listings were deleted
      completedIds = completedIds.filter(id => approvedListings.some(l => l.id === id));
    } catch (e) {
      completedIds = [];
    }

    const targetListings = approvedListings.filter(l => !completedIds.includes(l.id));

    if (targetListings.length === 0) {
      localStorage.removeItem('refreshDetailsCompletedIds');
      toast.info("All listings have already been synced. The tracker has been reset so you can run it again if needed.");
      return;
    }

    const isResuming = completedIds.length > 0;

    setConfirmModal({
      isOpen: true,
      title: isResuming ? 'Resume Syncing Details' : 'Sync All Details with AI',
      message: isResuming 
        ? `You previously paused or hit a limit. There are ${targetListings.length} listings remaining to update. Do you want to resume?`
        : 'This will use the Gemini AI with Google Search grounding to search across the internet (official websites, social media, Google, Yelp, business records, etc.) to fetch the most up-to-date address, working hours, phone number, website, and email for ALL approved listings. This process will take some time due to search grounding. Do you want to proceed?',
      confirmText: isResuming ? 'Resume Setup' : 'Start Sync',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsBatchUpdating(true);
        const toastId = toast.loading(`Refreshing ${targetListings.length} listings...`);
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        const { updateDoc, doc } = await import('firebase/firestore');

        try {
          for (let i = 0; i < targetListings.length; i++) {
            const listing = targetListings[i];
            toast.loading(`Syncing ${i + 1}/${targetListings.length}: ${listing.name}`, { id: toastId });
            
            try {
              const res = await fetch(getApiUrl('/api/admin/fetch-listing-ai-info'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: listing.name,
                  currentAddress: listing.address || '',
                }),
              });

              if (res.ok) {
                const data = await res.json();
                const updates: any = {};

                if (data.address && data.address !== listing.address) updates.address = data.address;
                if (data.phoneNumber && data.phoneNumber !== listing.phoneNumber) updates.phoneNumber = data.phoneNumber;
                if (data.openingHours && data.openingHours !== listing.openingHours) updates.openingHours = data.openingHours;
                if (data.email && data.email !== listing.email) updates.email = data.email;
                if (data.website && data.website !== listing.website) updates.website = data.website;

                if (Object.keys(updates).length > 0) {
                  await updateDoc(doc(db, 'listings', listing.id), updates);
                }
              }

              completedIds.push(listing.id);
              localStorage.setItem('refreshDetailsCompletedIds', JSON.stringify(completedIds));
              
            } catch (e: any) {
              console.error(`Failed to update ${listing.name}`, e);
            }
            // Sleep 3 seconds between requests to be gentle on search grounding / API rates
            await delay(3000);
          }
          
          toast.success('Information sync completed for all listings!', { id: toastId });
          localStorage.removeItem('refreshDetailsCompletedIds');
          
          fetchData();
        } catch (err) {
          toast.error('Sync encountered an error.', { id: toastId });
        } finally {
          setIsBatchUpdating(false);
        }
      }
    });
  };

  if (!user || user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Access Denied</p>
      </div>
    );
  }

  const totalPending = pendingListings.length + pendingEvents.length + pendingJobs.length + pendingNews.length;

  const renderItemCard = (item: any, type: string, isLast: boolean, sectionType?: 'moderation' | 'feedback') => {
    const getTitle = () => {
      if (type === 'reviews') return item.comment || 'Review';
      if (type === 'comments') return item.content || 'Comment';
      if (type === 'users') return item.name || 'User';
      if (type === 'plan_requests') return `Plan: ${item.plan?.toUpperCase() || 'UNKNOWN'}`;
      return item.name || item.title || 'Untitled';
    };
    const getSubtitle = () => {
      if (type === 'users') return item.createdAt ? `${item.email} (Joined: ${new Date(item.createdAt).toLocaleDateString()})` : item.email;
      if (type === 'reviews') return `Rating: ${item.rating}/5`;
      if (type === 'comments') return `On ${item.parentType}`;
      if (type === 'listings') return Array.isArray(item.category) ? item.category.join(', ') : item.category;
      if (type === 'events') return item.location;
      if (type === 'jobs') return item.company;
      if (type === 'plan_requests') return `${item.requestType === 'claim_listing' ? 'CLAIM' : 'NEW'} | Listing: ${item.listingName} - By: ${item.contactEmail}`;
      return '';
    };
    const getImage = () => {
      if (item.photos?.[0] && item.photos[0].trim() !== '') return item.photos[0];
      if (item.coverImage && item.coverImage.trim() !== '') return item.coverImage;
      if (item.companyLogo && item.companyLogo.trim() !== '') return item.companyLogo;
      if (item.logo && item.logo.trim() !== '') return item.logo;
      return null;
    };

    const isSelected = sectionType === 'moderation' 
      ? selectedModerationIds.includes(item.id)
      : sectionType === 'feedback' 
        ? selectedFeedbackIds.includes(item.id)
        : false;

    const parentInfo = (() => {
      if (type === 'reviews') {
        const listing = [...pendingListings, ...approvedListings].find(l => l.id === item.listingId);
        return {
          name: listing ? listing.name : 'Unknown Listing',
          type: 'Listing',
          link: listing ? `/listings/${listing.slug || listing.id}` : null
        };
      } else if (type === 'comments') {
        if (item.parentType === 'news') {
          const article = [...pendingNews, ...approvedNews].find(n => n.id === item.parentId);
          return {
            name: article ? article.title : 'Unknown News Article',
            type: 'News',
            link: article ? `/news/${article.slug || article.id}` : null
          };
        } else if (item.parentType === 'event') {
          const eventItem = [...pendingEvents, ...approvedEvents].find(e => e.id === item.parentId);
          return {
            name: eventItem ? eventItem.title : 'Unknown Event',
            type: 'Event',
            link: eventItem ? `/events/${eventItem.slug || eventItem.id}` : null
          };
        }
      }
      return null;
    })();

    return (
      <div key={item.id || item.uid} className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${!isLast ? 'border-b border-gray-50' : ''} ${isSelected ? 'bg-red-50/30' : ''}`}>
        <div className="flex items-center gap-3 min-w-0">
          {sectionType && (
            <input 
              type="checkbox" 
              checked={isSelected}
              onChange={() => toggleSelectItem(sectionType, item.id)}
              className="w-4 h-4 rounded border-gray-300 text-[#e90b35] focus:ring-[#e90b35] cursor-pointer"
            />
          )}
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0 flex items-center justify-center text-gray-400">
            {getImage() ? (
              <img src={(getImage()) || undefined} alt="Listing photo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="font-bold text-sm uppercase">{(getTitle() as string).charAt(0)}</span>
            )}
          </div>
          <div className="text-left min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-700 truncate max-w-[200px] sm:max-w-xs">{getTitle()}</h3>
              {type === 'users' ? (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter shrink-0 ${
                  item.role === 'admin' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'
                }`}>
                  {item.role}
                </span>
              ) : type === 'plan_requests' ? (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter shrink-0 ${
                  item.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                }`}>
                  {item.status === 'pending' ? 'Pending' : 'Resolved'}
                </span>
              ) : (
                <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-tighter shrink-0 ${
                  item.isApproved === false ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'
                }`}>
                  {item.isApproved === false ? 'Pending' : 'Live'}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 truncate max-w-[200px] sm:max-w-xs">{getSubtitle()}</p>
            {parentInfo && (
              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-md font-medium shrink-0">
                  {parentInfo.type}:
                </span>
                {parentInfo.link ? (
                  <Link 
                    to={parentInfo.link}
                    className="text-[11px] text-[#e90b35] font-semibold hover:underline truncate max-w-[180px] sm:max-w-xs"
                  >
                    {parentInfo.name}
                  </Link>
                ) : (
                  <span className="text-[11px] text-gray-500 font-medium truncate max-w-[180px] sm:max-w-xs">
                    {parentInfo.name}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 pl-2">
          {((item.isApproved === false && type !== 'users' && type !== 'plan_requests') || 
            (type === 'plan_requests' && item.status === 'pending')) && (
            <button 
              onClick={() => handleApprove(type, item.id)}
              className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
              title={type === 'plan_requests' ? 'Mark Resolved' : 'Approve'}
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {(type === 'reviews' || type === 'comments') && (
            <button 
              onClick={() => setViewFeedbackItem({ type, item })}
              className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
              title="View Content"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}
          {type === 'listings' && item.isApproved !== false && (
             <>
               <button 
                 onClick={() => handleFeatureListing(item)}
                 className={`p-2 rounded-lg transition-colors ${item.isFeatured ? 'text-yellow-500 hover:bg-yellow-50/50 fill-yellow-500' : 'text-gray-400 hover:bg-gray-100'}`}
                 title={item.isFeatured ? 'Unfeature' : 'Feature'}
               >
                 <Star className={`w-4 h-4 ${item.isFeatured ? 'fill-yellow-500' : ''}`} />
               </button>
               <button 
                 onClick={() => handleRefreshSingleListing(item)}
                 className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                 title="Autofill and Update Details via AI (Address, Phone, Hours, Email, Website)"
               >
                 <RefreshCw className="w-4 h-4" />
               </button>
             </>
          )}
          {type === 'users' && (
            <button 
              onClick={() => toggleUserRole(item)}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              title={item.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
            >
              <Shield className="w-4 h-4" />
            </button>
          )}
          {type !== 'users' && type !== 'reviews' && type !== 'comments' && type !== 'plan_requests' && (
            <button 
              onClick={() => navigate(`/${type}/edit/${item.id}`)}
              className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={() => handleDelete(type, item.id || item.uid)}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  const moderationItems = (() => {
    let items: any[] = [];
    switch (activeModerationTab) {
      case 'listings': items = [...pendingListings, ...approvedListings]; break;
      case 'events': items = [...pendingEvents, ...approvedEvents]; break;
      case 'jobs': items = [...pendingJobs, ...approvedJobs]; break;
      case 'news': items = [...pendingNews, ...approvedNews]; break;
      case 'plan_requests': items = planRequests; break;
      default: items = [];
    }

    if (moderationSearchQuery.trim()) {
      const query = moderationSearchQuery.toLowerCase();
      items = items.filter(item => 
        (item.name?.toLowerCase().includes(query)) ||
        (item.title?.toLowerCase().includes(query)) ||
        (item.company?.toLowerCase().includes(query)) ||
        (item.location?.toLowerCase().includes(query)) ||
        (item.description?.toLowerCase().includes(query)) ||
        (item.content?.toLowerCase().includes(query)) ||
        (item.listingName?.toLowerCase().includes(query)) ||
        (item.contactEmail?.toLowerCase().includes(query))
      );
    }
    return items;
  })();

  const feedbackItems = (() => {
    let items: any[] = [];
    switch (activeFeedbackTab) {
      case 'reviews': items = allReviews; break;
      case 'comments': items = allComments; break;
      default: items = [];
    }

    if (feedbackSearchQuery.trim()) {
      const query = feedbackSearchQuery.toLowerCase();
      items = items.filter(item => {
        let parentName = '';
        if (activeFeedbackTab === 'reviews') {
          const listing = [...pendingListings, ...approvedListings].find(l => l.id === item.listingId);
          parentName = listing ? listing.name : '';
        } else if (activeFeedbackTab === 'comments') {
          if (item.parentType === 'news') {
            const article = [...pendingNews, ...approvedNews].find(n => n.id === item.parentId);
            parentName = article ? article.title : '';
          } else if (item.parentType === 'event') {
            const eventItem = [...pendingEvents, ...approvedEvents].find(e => e.id === item.parentId);
            parentName = eventItem ? eventItem.title : '';
          }
        }

        return (
          (item.comment?.toLowerCase().includes(query)) ||
          (item.content?.toLowerCase().includes(query)) ||
          (item.userName?.toLowerCase().includes(query)) ||
          (parentName?.toLowerCase().includes(query))
        );
      });
    }
    return items;
  })();

  const visibleSubscribers = (() => {
    const list: { id: string; name: string; email: string; type: 'Registered' | 'Guest'; status: 'subscribed' | 'unsubscribed'; createdAt?: string; unsubscribedAt?: string; location?: string }[] = [];
    
    // Add Registered Users
    allUsers.forEach(u => {
      const isSubscribed = !!u.consentToUpdates;
      list.push({
        id: u.uid,
        name: u.name || 'Anonymous',
        email: u.email || '',
        type: 'Registered',
        status: isSubscribed ? 'subscribed' : 'unsubscribed',
        createdAt: u.createdAt,
        unsubscribedAt: (u as any).unsubscribedAt || undefined,
        location: u.location || 'Ottawa, ON'
      });
    });

    // Add Guest Subscribers
    standaloneSubscribers.forEach(s => {
      const isSubscribed = s.status !== 'unsubscribed';
      list.push({
        id: s.id,
        name: s.name || 'Guest Subscriber',
        email: s.email || '',
        type: 'Guest',
        status: isSubscribed ? 'subscribed' : 'unsubscribed',
        createdAt: s.createdAt,
        unsubscribedAt: s.unsubscribedAt || undefined,
        location: s.location || 'Ottawa, ON'
      });
    });

    // Apply Filter Tab (all, registered, guests)
    let filtered = list;
    if (subscriberTab === 'registered') {
      filtered = filtered.filter(sub => sub.type === 'Registered');
    } else if (subscriberTab === 'guests') {
      filtered = filtered.filter(sub => sub.type === 'Guest');
    }

    // Apply Status Filter (all, subscribed, unsubscribed)
    if (subscriberStatusFilter === 'subscribed') {
      filtered = filtered.filter(sub => sub.status === 'subscribed');
    } else if (subscriberStatusFilter === 'unsubscribed') {
      filtered = filtered.filter(sub => sub.status === 'unsubscribed');
    }

    // Apply Search
    if (subscriberSearch.trim()) {
      const q = subscriberSearch.toLowerCase();
      filtered = filtered.filter(sub => 
        (sub.name?.toLowerCase().includes(q)) ||
        (sub.email?.toLowerCase().includes(q)) ||
        (sub.location?.toLowerCase().includes(q))
      );
    }

    return filtered;
  })();

  const activeRegisteredCount = allUsers.filter(u => u.consentToUpdates).length;
  const activeGuestCount = standaloneSubscribers.filter(s => s.status !== 'unsubscribed').length;
  const totalSubscriberCount = activeRegisteredCount + activeGuestCount;

  const inactiveRegisteredCount = allUsers.filter(u => !u.consentToUpdates).length;
  const inactiveGuestCount = standaloneSubscribers.filter(s => s.status === 'unsubscribed').length;
  const totalUnsubscribedCount = inactiveRegisteredCount + inactiveGuestCount;

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-12 animate-in fade-in duration-500">
      <SEO 
        title="Admin Dashboard" 
        description="Manage and moderate your community platform." 
        noindex={true}
      />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-12">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        
        {/* Confirmation Modal */}
        {confirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-6 shadow-xl">
              <h3 className="text-xl font-bold text-gray-900">{confirmModal.title}</h3>
              <p className="text-gray-500">{confirmModal.message}</p>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmModal(null)}
                  className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmModal.onConfirm}
                  className={`flex-1 py-3 text-white font-bold rounded-xl transition-colors ${
                    confirmModal.confirmVariant === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-gray-900 hover:bg-gray-800'
                  }`}
                >
                  {confirmModal.confirmText || 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}
        
        {/* Import Listing Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Import Listing
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-4">
            <p className="text-sm text-gray-500">
              Search for a place on Google Maps to automatically import its details and generate an AI description.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <input
                type="text"
                placeholder="Enter business name (e.g. Shawarma King Ottawa)"
                className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl outline-none focus:ring-2 focus:ring-gray-200"
                value={importPlaceName}
                onChange={(e) => setImportPlaceName(e.target.value)}
                disabled={isImporting}
                onKeyDown={(e) => e.key === 'Enter' && importFromGoogleMaps()}
              />
              <div className="flex gap-2">
                <button
                  onClick={importFromGoogleMaps}
                  disabled={isImporting}
                  className="px-6 py-2.5 h-fit self-start bg-gray-900 text-white font-bold rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors whitespace-nowrap text-sm"
                >
                  {isImporting ? 'Importing...' : 'Import'}
                </button>
                <button
                  onClick={handleDeepRefreshAllTags}
                  disabled={isBatchUpdating}
                  title="Sync address, hours, phone number, website, and email online for all approved listings"
                  className="px-4 py-2.5 h-fit self-start bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap text-sm border border-blue-200"
                >
                  {isBatchUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Sync Details via AI
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Site Settings Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Site Settings
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-1">Site Logo</h3>
                <p className="text-xs text-gray-500 mb-4">Upload a logo to display in the header and footer.</p>
                <div className="flex items-center gap-4">
                  {siteLogoUrl ? (
                    <div className="w-20 h-20 rounded-xl border border-gray-100 bg-gray-50 p-2 flex items-center justify-center">
                      <img src={siteLogoUrl} alt="Site Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-20 h-20 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400">
                      <span className="text-xs">No Logo</span>
                    </div>
                  )}
                  <div>
                    <label className="relative cursor-pointer bg-gray-900 text-white hover:bg-gray-800 transition-colors px-4 py-2 rounded-xl text-sm font-bold inline-block">
                      {isLogoUploading ? 'Uploading...' : 'Upload Logo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        className="hidden" 
                        disabled={isLogoUploading} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-6">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Site Favicon</h3>
                <p className="text-xs text-gray-500 mb-4">Upload a favicon (ico/png/svg) to display in the browser tab.</p>
                <div className="flex items-center gap-4">
                  {faviconUrl ? (
                    <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 p-3 flex items-center justify-center">
                      <img src={faviconUrl} alt="Site Favicon" className="max-w-full max-h-full object-contain" />
                    </div>
                  ) : (
                    <div className="w-16 h-16 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400">
                      <span className="text-xs">No Icon</span>
                    </div>
                  )}
                  <div>
                    <label className="relative cursor-pointer bg-gray-900 text-white hover:bg-gray-800 transition-colors px-4 py-2 rounded-xl text-sm font-bold inline-block">
                      {isFaviconUploading ? 'Uploading...' : 'Upload Favicon'}
                      <input 
                        type="file" 
                        accept=".ico,.png,.svg,image/x-icon,image/png,image/svg+xml" 
                        onChange={handleFaviconUpload} 
                        className="hidden" 
                        disabled={isFaviconUploading} 
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t md:border-t-0 md:border-l border-gray-100 pt-6 md:pt-0 md:pl-6">
                <h3 className="text-sm font-bold text-gray-900 mb-1">Home Hero Image</h3>
                <p className="text-xs text-gray-500 mb-4">Upload or set the background image of the main home hero section.</p>
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    {heroImageUrlState ? (
                      <div className="w-20 h-16 rounded-xl border border-gray-100 bg-gray-50 overflow-hidden flex items-center justify-center">
                        <img src={heroImageUrlState} alt="Home Hero" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-20 h-16 rounded-xl border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-300 relative overflow-hidden">
                        <img src="https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/global-hero-1781326553984.webp" alt="Default Hero" className="w-full h-full object-cover brightness-50" />
                        <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white bg-black/40">Default</span>
                      </div>
                    )}
                    <div>
                      <label className="relative cursor-pointer bg-gray-900 text-white hover:bg-gray-800 transition-colors px-4 py-2 rounded-xl text-sm font-bold inline-block">
                        {isHeroUploading ? 'Uploading...' : 'Upload Image'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={handleHeroUpload} 
                          className="hidden" 
                          disabled={isHeroUploading} 
                        />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste image URL here..."
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:ring-2 focus:ring-gray-200 text-xs"
                      value={heroImageUrlState}
                      onChange={async (e) => {
                        const val = e.target.value;
                        setHeroImageUrlState(val);
                        await setDoc(doc(db, 'settings', 'general'), { heroImageUrl: val }, { merge: true });
                        clearGeneralSettingsCache();
                      }}
                    />
                    {heroImageUrlState && (
                      <button
                        onClick={async () => {
                          setHeroImageUrlState('');
                          await setDoc(doc(db, 'settings', 'general'), { heroImageUrl: '' }, { merge: true });
                          clearGeneralSettingsCache();
                          toast.success('Hero image reset to default.');
                        }}
                        className="p-2 border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded-xl text-gray-500"
                        title="Reset to default"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Moderation Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Moderation
          </h2>
          
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide ml-2">
            {['listings', 'events', 'jobs', 'news', 'plan_requests'].map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveModerationTab(tab as any);
                  setCurrentModerationPage(1);
                }}
                className={`px-6 py-2.5 rounded-full text-sm font-bold capitalize whitespace-nowrap transition-all ${
                  activeModerationTab === tab 
                    ? 'bg-gray-900 text-white shadow-md' 
                    : 'bg-white text-gray-500 border border-gray-100 hover:bg-gray-50'
                }`}
              >
                {tab === 'plan_requests' ? 'Plan Requests' : tab}
              </button>
            ))}
          </div>

          <div className="relative ml-2 mr-2 mb-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeModerationTab}...`}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
              value={moderationSearchQuery}
              onChange={(e) => setModerationSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : moderationItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm font-medium italic">No {activeModerationTab} found.</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedModerationIds.length === Math.min(moderationItems.length, ITEMS_PER_PAGE) && moderationItems.length > 0}
                      onChange={() => toggleSelectAll('moderation', moderationItems.slice((currentModerationPage - 1) * ITEMS_PER_PAGE, currentModerationPage * ITEMS_PER_PAGE))}
                      className="w-4 h-4 rounded border-gray-300 text-[#e90b35] focus:ring-[#e90b35] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {selectedModerationIds.length > 0 ? `${selectedModerationIds.length} selected` : 'Select All on Page'}
                    </span>
                  </div>
                  {selectedModerationIds.length > 0 && (
                    <button 
                      onClick={() => handleBulkDelete('moderation')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                  )}
                </div>
                {moderationItems.slice((currentModerationPage - 1) * ITEMS_PER_PAGE, currentModerationPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, activeModerationTab, idx === arr.length - 1, 'moderation'))}
                {moderationItems.length > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={currentModerationPage}
                    totalPages={Math.ceil(moderationItems.length / ITEMS_PER_PAGE)}
                    onPageChange={setCurrentModerationPage}
                  />
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

          <div className="relative ml-2 mr-2 mb-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={`Search ${activeFeedbackTab}...`}
              className="w-full pl-12 pr-4 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm outline-none focus:ring-2 focus:ring-[#e90b35]"
              value={feedbackSearchQuery}
              onChange={(e) => setFeedbackSearchQuery(e.target.value)}
            />
          </div>

          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : feedbackItems.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm font-medium italic">No {activeFeedbackTab} found.</p>
              </div>
            ) : (
              <>
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox" 
                      checked={selectedFeedbackIds.length === Math.min(feedbackItems.length, ITEMS_PER_PAGE) && feedbackItems.length > 0}
                      onChange={() => toggleSelectAll('feedback', feedbackItems.slice((currentFeedbackPage - 1) * ITEMS_PER_PAGE, currentFeedbackPage * ITEMS_PER_PAGE))}
                      className="w-4 h-4 rounded border-gray-300 text-[#e90b35] focus:ring-[#e90b35] cursor-pointer"
                    />
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      {selectedFeedbackIds.length > 0 ? `${selectedFeedbackIds.length} selected` : 'Select All on Page'}
                    </span>
                  </div>
                  {selectedFeedbackIds.length > 0 && (
                    <button 
                      onClick={() => handleBulkDelete('feedback')}
                      className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-bold hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Selected
                    </button>
                  )}
                </div>
                {feedbackItems.slice((currentFeedbackPage - 1) * ITEMS_PER_PAGE, currentFeedbackPage * ITEMS_PER_PAGE).map((item, idx, arr) => renderItemCard(item, activeFeedbackTab, idx === arr.length - 1, 'feedback'))}
                {feedbackItems.length > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={currentFeedbackPage}
                    totalPages={Math.ceil(feedbackItems.length / ITEMS_PER_PAGE)}
                    onPageChange={setCurrentFeedbackPage}
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* Users Section */}
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-gray-900 ml-2 flex items-center gap-2">
            Users
            <span className="text-sm font-medium text-gray-400 bg-white px-2 py-1 rounded-full border border-gray-100 shadow-sm">{allUsers.length}</span>
          </h2>
          
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
            {loading ? (
              <div className="p-12 flex justify-center">
                <div className="w-8 h-8 border-4 border-gray-100 border-t-gray-400 rounded-full animate-spin" />
              </div>
            ) : allUsers.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-gray-400 text-sm font-medium italic">No users found.</p>
              </div>
            ) : (
              <>
                {allUsers.slice((currentUsersPage - 1) * ITEMS_PER_PAGE, currentUsersPage * ITEMS_PER_PAGE).map((user, idx, arr) => renderItemCard(user, 'users', idx === arr.length - 1))}
                {allUsers.length > ITEMS_PER_PAGE && (
                  <Pagination
                    currentPage={currentUsersPage}
                    totalPages={Math.ceil(allUsers.length / ITEMS_PER_PAGE)}
                    onPageChange={setCurrentUsersPage}
                  />
                )}
              </>
            )}
          </div>
        </section>

        {/* Ads Management Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between ml-2">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em]">
              Ads Management
            </h2>
            <button 
              onClick={() => setIsAddingAd(!isAddingAd)}
              className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {isAddingAd ? 'Cancel' : '+ Add New Ad'}
            </button>
          </div>
          
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-6">
            {isAddingAd && (
              <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100 mb-6">
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="adType" 
                      value="banner" 
                      checked={newAd.type === 'banner'} 
                      onChange={() => setNewAd({...newAd, type: 'banner'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Banner Image
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 cursor-pointer">
                    <input 
                      type="radio" 
                      name="adType" 
                      value="code" 
                      checked={newAd.type === 'code'} 
                      onChange={() => setNewAd({...newAd, type: 'code'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    Custom Code Snippet
                  </label>
                </div>

                {newAd.type === 'banner' ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Image URL</label>
                      <input 
                        type="text" 
                        value={newAd.imageUrl}
                        onChange={(e) => setNewAd({...newAd, imageUrl: e.target.value})}
                        placeholder="https://example.com/banner.jpg" 
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">Link URL</label>
                      <input 
                        type="text" 
                        value={newAd.linkUrl}
                        onChange={(e) => setNewAd({...newAd, linkUrl: e.target.value})}
                        placeholder="https://example.com" 
                        className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 ml-1">HTML/JS Code Snippet</label>
                    <textarea 
                      value={newAd.codeSnippet}
                      onChange={(e) => setNewAd({...newAd, codeSnippet: e.target.value})}
                      placeholder="<script src='...'></script>" 
                      rows={4}
                      className="w-full px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-none"
                    />
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button 
                    onClick={handleSaveAd}
                    className="px-6 py-2 bg-gray-900 text-white text-sm font-bold rounded-xl hover:bg-gray-800 transition-colors"
                  >
                    Save Ad
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-4">
              {ads.length === 0 ? (
                <p className="text-gray-400 text-sm font-medium italic text-center py-4">No ads configured.</p>
              ) : (
                ads.map(ad => (
                  <div key={ad.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-12 h-12 rounded-xl bg-white border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                        {ad.type === 'banner' && ad.imageUrl ? (
                          <img src={(ad.imageUrl) || undefined} alt="Ad" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-gray-400">CODE</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-gray-900 text-sm truncate">
                          {ad.type === 'banner' ? 'Banner Ad' : 'Code Snippet Ad'}
                        </h4>
                        <p className="text-xs text-gray-500 truncate max-w-[200px] sm:max-w-md">
                          {ad.type === 'banner' ? ad.linkUrl : 'Custom HTML/JS'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => toggleAdStatus(ad.id, ad.isActive)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                          ad.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                      >
                        {ad.isActive ? 'Active' : 'Inactive'}
                      </button>
                      <button 
                        onClick={() => deleteAd(ad.id)}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Push Notifications Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Push Notifications
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Global Push Alert</h3>
                <p className="text-sm text-gray-500">Send a push notification to all registered devices.</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {/* Search Destination Autocomplete */}
              <div className="space-y-2 relative">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">
                  Push Landing Destination Link (Optional)
                </label>
                
                {pushTargetType !== 'none' ? (
                  <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-xl text-white shadow-sm shrink-0 ${
                        pushTargetType === 'listing' ? 'bg-blue-500' :
                        pushTargetType === 'news' ? 'bg-[#10b981]' :
                        pushTargetType === 'event' ? 'bg-purple-500' : 'bg-orange-500'
                      }`}>
                        {pushTargetType === 'listing' && <MapPin className="w-4 h-4" />}
                        {pushTargetType === 'news' && <Newspaper className="w-4 h-4" />}
                        {pushTargetType === 'event' && <Calendar className="w-4 h-4" />}
                        {pushTargetType === 'job' && <Briefcase className="w-4 h-4" />}
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-blue-500 block">
                          Connected Link ({pushTargetType === 'listing' ? 'Listing' : pushTargetType === 'news' ? 'News' : pushTargetType === 'event' ? 'Event' : 'Job'})
                        </span>
                        <h4 className="font-bold text-sm text-gray-900 truncate">
                          {getConnectedTargetName()}
                        </h4>
                      </div>
                    </div>
                    
                    <button
                      type="button"
                      onClick={() => {
                        handlePushTargetChange('none', '');
                        setPushSearchQuery('');
                      }}
                      className="p-1 px-3 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-xl text-xs font-bold transition-all shadow-xs shrink-0 flex items-center gap-1 active:scale-95 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                      Unlink Page
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <Search className="h-4.5 w-4.5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={pushSearchQuery}
                      onChange={(e) => {
                        setPushSearchQuery(e.target.value);
                        setIsPushSearchFocused(true);
                      }}
                      onFocus={() => setIsPushSearchFocused(true)}
                      onBlur={() => {
                        // Delay slightly so onMouseDown of suggestion item triggers first
                        setTimeout(() => setIsPushSearchFocused(false), 200);
                      }}
                      placeholder="Search across listings, news, events, or jobs to link landing destination..."
                      className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all placeholder:text-gray-400"
                    />
                    
                    {/* Floating Suggestion Menu */}
                    {isPushSearchFocused && pushSearchQuery.trim().length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-50 bg-white border border-gray-100 rounded-2xl shadow-xl mt-1.5 max-h-72 overflow-y-auto divide-y divide-gray-50 flex flex-col py-1 animate-in fade-in zoom-in-95 duration-100">
                        {pushSuggestionsList.length > 0 ? (
                          pushSuggestionsList.map((suggestion) => (
                            <button
                              key={`${suggestion.type}-${suggestion.id}`}
                              type="button"
                              onMouseDown={() => {
                                handlePushTargetChange(suggestion.type, suggestion.id);
                              }}
                              className="w-full px-4 py-2.5 text-left hover:bg-gray-50 active:bg-gray-100 transition-colors flex items-center justify-between gap-3 text-sm cursor-pointer"
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                {suggestion.image ? (
                                  <img 
                                    src={suggestion.image} 
                                    alt={suggestion.title} 
                                    className="w-10 h-10 rounded-lg object-cover bg-gray-100 border border-gray-100 shrink-0"
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=Logo' }}
                                  />
                                ) : (
                                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                                    suggestion.type === 'listing' ? 'bg-blue-50 text-blue-500' :
                                    suggestion.type === 'news' ? 'bg-emerald-50 text-emerald-500' :
                                    suggestion.type === 'event' ? 'bg-purple-50 text-purple-500' : 'bg-orange-50 text-orange-500'
                                  }`}>
                                    {suggestion.type === 'listing' && <MapPin className="w-5 h-5" />}
                                    {suggestion.type === 'news' && <Newspaper className="w-5 h-5" />}
                                    {suggestion.type === 'event' && <Calendar className="w-5 h-5" />}
                                    {suggestion.type === 'job' && <Briefcase className="w-5 h-5" />}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 truncate">{suggestion.title}</p>
                                  <p className="text-xs text-gray-400 truncate">{suggestion.subtitle}</p>
                                </div>
                              </div>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 uppercase tracking-wider ${
                                suggestion.type === 'listing' ? 'bg-blue-50 text-blue-600' :
                                suggestion.type === 'news' ? 'bg-emerald-50 text-emerald-600' :
                                suggestion.type === 'event' ? 'bg-purple-50 text-purple-600' : 'bg-orange-50 text-orange-600'
                              }`}>
                                {suggestion.type}
                              </span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-4 text-center text-xs text-gray-400 flex flex-col items-center justify-center gap-1">
                            <Search className="w-5 h-5 text-gray-300" />
                            <span>No matching results found for "{pushSearchQuery}"</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Notification Title</label>
                <input 
                  type="text" 
                  value={pushTitle}
                  onChange={(e) => setPushTitle(e.target.value)}
                  placeholder="e.g., New Feature Alert!" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Notification Message / Description</label>
                <textarea 
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="Enter the push notification message..." 
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">
                  Notification Image / Photo
                </label>
                <div className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    value={pushImage}
                    onChange={(e) => setPushImage(e.target.value)}
                    placeholder="Paste image URL (e.g., https://...)" 
                    className="flex-1 px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all"
                  />
                  <div className="flex gap-2">
                    <label className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl text-xs transition-colors shrink-0 flex items-center justify-center cursor-pointer gap-1.5 h-[46px] select-none">
                      <Plus className="w-4 h-4" />
                      <span>{isPushImageUploading ? 'Uploading...' : 'Upload Photo'}</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handlePushImageUpload} 
                        disabled={isPushImageUploading}
                        className="hidden" 
                      />
                    </label>
                    {pushImage && (
                      <button 
                        type="button"
                        onClick={() => setPushImage('')}
                        className="px-4 py-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-2xl text-xs transition-colors shrink-0"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {pushImage && (
                <div className="mt-2 p-3 bg-gray-50 rounded-2xl border border-gray-100 max-w-xs flex gap-3 items-center">
                  <img 
                    src={pushImage} 
                    alt="Notification Preview" 
                    className="w-16 h-12 rounded-lg object-cover bg-gray-200 shrink-0"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/120x95?text=Image+Not+Loaded';
                    }}
                  />
                  <div className="min-w-0">
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Photo Preview</p>
                    <p className="text-xs text-gray-500 truncate">{pushImage}</p>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button 
                  onClick={sendPushNotification} 
                  disabled={isSendingPush || isPushImageUploading || !pushTitle || !pushMessage} 
                  className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg shadow-gray-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {isSendingPush ? 'Sending...' : 'Send Push Notification'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Email Notifications Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Email Notifications
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-green-50 text-green-600 flex items-center justify-center shrink-0">
                <Mail className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Community Newsletter</h3>
                <p className="text-sm text-gray-500">Send an email update to all subscribed users.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Subject</label>
                <input 
                  type="text" 
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="e.g., Weekly Community Updates" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Email Body</label>
                <textarea 
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Write your newsletter content here..." 
                  rows={5}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500/50 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={sendCommunityUpdate} 
                  disabled={isSendingEmails || !emailSubject || !emailBody} 
                  className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg shadow-gray-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  {isSendingEmails ? 'Sending...' : 'Send Email Newsletter'}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Newsletter Subscribers Section */}
        <section className="space-y-4">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Newsletter Subscribers
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-[#e90b35] flex items-center justify-center shrink-0">
                  <Users className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Manage Subscribers</h3>
                  <p className="text-sm text-gray-500">
                    Track subscription lifecycle, location, registered dates, and soft-unsubscribed history.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleExportSubscribers}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-gray-100 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV
                </button>
                <button
                  onClick={handleCopyEmails}
                  className="px-4 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 border border-gray-100 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Copy Active Emails
                </button>
              </div>
            </div>

            {/* Subscription Stats Dashboard Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-green-50/45 rounded-2xl p-4 border border-green-100/50">
                <span className="text-[10px] font-bold text-green-700 uppercase tracking-wider block">Active Subscribers</span>
                <span className="text-2xl font-black text-green-900 block mt-1">{totalSubscriberCount}</span>
                <span className="text-[10px] text-green-600 block mt-0.5">{activeRegisteredCount} users + {activeGuestCount} guests</span>
              </div>
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Unsubscribed History</span>
                <span className="text-2xl font-black text-gray-700 block mt-1">{totalUnsubscribedCount}</span>
                <span className="text-[10px] text-gray-400 block mt-0.5">{inactiveRegisteredCount} users + {inactiveGuestCount} guests</span>
              </div>
              <div className="bg-blue-50/45 rounded-2xl p-4 border border-blue-100/30">
                <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Registered Users</span>
                <span className="text-2xl font-black text-blue-950 block mt-1">{allUsers.length}</span>
                <span className="text-[10px] text-blue-500 block mt-0.5">{(allUsers.length > 0 ? ((activeRegisteredCount / allUsers.length) * 100).toFixed(0) : 0)}% opted-in rate</span>
              </div>
              <div className="bg-teal-50/45 rounded-2xl p-4 border border-teal-100/30">
                <span className="text-[10px] font-bold text-teal-700 uppercase tracking-wider block">Guest Subscribers</span>
                <span className="text-2xl font-black text-teal-900 block mt-1">{standaloneSubscribers.length}</span>
                <span className="text-[10px] text-teal-600 block mt-0.5">{(standaloneSubscribers.length > 0 ? ((activeGuestCount / standaloneSubscribers.length) * 100).toFixed(0) : 0)}% active rate</span>
              </div>
            </div>

            {/* Quick Add Form & Bulk Import with Location Support */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100/50 space-y-4">
              <div className="flex border-b border-gray-200">
                <button
                  type="button"
                  onClick={() => setActiveImportMethod('single')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider relative transition-all mr-6 cursor-pointer ${
                    activeImportMethod === 'single'
                      ? 'text-[#e90b35] border-b-2 border-[#e90b35]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Add Single Subscriber
                </button>
                <button
                  type="button"
                  onClick={() => setActiveImportMethod('bulk')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider relative transition-all cursor-pointer ${
                    activeImportMethod === 'bulk'
                      ? 'text-[#e90b35] border-b-2 border-[#e90b35]'
                      : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  Import Emails List (Bulk)
                </button>
              </div>

              {activeImportMethod === 'single' ? (
                <form onSubmit={handleAddCustomSubscriber} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Email Address</label>
                    <input
                      type="email"
                      required
                      placeholder="Enter subscriber email..."
                      value={newSubEmail}
                      onChange={(e) => setNewSubEmail(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e90b35]/20 focus:border-[#e90b35] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Full Name (Optional)</label>
                    <input
                      type="text"
                      placeholder="Enter full name (optional)..."
                      value={newSubName}
                      onChange={(e) => setNewSubName(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e90b35]/20 focus:border-[#e90b35] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Location</label>
                    <input
                      type="text"
                      placeholder="Location, e.g. Ottawa, ON"
                      value={newSubLocation}
                      onChange={(e) => setNewSubLocation(e.target.value)}
                      className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e90b35]/20 focus:border-[#e90b35] transition-all"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="submit"
                      disabled={isSubmittingSub}
                      className="w-full px-5 py-2.5 bg-gray-900 hover:bg-gray-800 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-4 h-4" />
                      {isSubmittingSub ? 'Adding...' : 'Add Subscriber'}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Drag and Drop with fallback click */}
                    <div
                      onDragEnter={handleDrag}
                      onDragOver={handleDrag}
                      onDragLeave={handleDrag}
                      onDrop={handleDrop}
                      className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all ${
                        dragActive 
                          ? 'border-[#e90b35] bg-[#e90b35]/5' 
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Upload className={`w-8 h-8 mb-2 ${dragActive ? 'text-[#e90b35]' : 'text-gray-400'}`} />
                      <p className="text-xs font-bold text-gray-700">Drag and drop your subscriber list here</p>
                      <p className="text-[10px] text-gray-400 mt-1 mb-3">Accepts .csv or .txt files</p>
                      
                      <label className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 font-bold rounded-xl text-[11px] transition-all cursor-pointer">
                        Choose File
                        <input
                          type="file"
                          accept=".csv,.txt"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                    </div>

                    {/* Clipboard Paste Box */}
                    <div className="flex flex-col">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">Or Paste Raw Subscriber Lists</label>
                      <textarea
                        value={bulkInputText}
                        onChange={(e) => {
                          setBulkInputText(e.target.value);
                          parseSubscribersText(e.target.value);
                        }}
                        placeholder="one_subscriber@domain.com, John Doe, Ottawa, ON&#10;another_sub@domain.com, Jane Smith&#10;third_subscriber@ottawa.ca"
                        className="w-full flex-1 min-h-[140px] p-3 text-xs bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#e90b35]/20 focus:border-[#e90b35]"
                      />
                      <p className="text-[9px] text-gray-400 mt-1.5">
                        Formats: <strong>email</strong>, <strong>name</strong>, <strong>location</strong> (one per line, comma or semicolon separated).
                      </p>
                    </div>
                  </div>

                  {/* CSV / Live Upload Preview Grid */}
                  {parsedSubscribers.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100/80 p-4 space-y-3">
                      <div className="flex justify-between items-center border-b border-gray-150 pb-2">
                        <div>
                          <h5 className="text-[11px] font-bold text-gray-800 uppercase tracking-wider">Loaded Elements Preview</h5>
                          <p className="text-[10px] text-gray-500">Review list rows status before batch upload</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setBulkInputText('');
                            setParsedSubscribers([]);
                          }}
                          className="text-[10px] font-semibold text-gray-400 hover:text-gray-600 flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" /> Clear Preview
                        </button>
                      </div>

                      {/* Bulk Analysis Info */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs text-slate-800">
                        <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                          <span className="text-gray-400 block text-[9px] font-bold uppercase">Total Checked</span>
                          <span className="font-extrabold text-gray-800 text-sm mt-0.5 block">{parsedSubscribers.length}</span>
                        </div>
                        <div className="bg-green-50/50 p-2 rounded-xl border border-green-100/30">
                          <span className="text-green-600 block text-[9px] font-bold uppercase">Ready to Import</span>
                          <span className="font-extrabold text-green-700 text-sm mt-0.5 block">
                            {parsedSubscribers.filter(s => s.status === 'valid').length}
                          </span>
                        </div>
                        <div className="bg-yellow-50/50 p-2 rounded-xl border border-yellow-100/30">
                          <span className="text-yellow-600 block text-[9px] font-bold uppercase">Skipping / Existing</span>
                          <span className="font-extrabold text-yellow-700 text-sm mt-0.5 block">
                            {parsedSubscribers.filter(s => s.status === 'exists').length}
                          </span>
                        </div>
                        <div className="bg-rose-50/50 p-2 rounded-xl border border-rose-100/30">
                          <span className="text-rose-600 block text-[9px] font-bold uppercase">Invalid / Dups</span>
                          <span className="font-extrabold text-rose-700 text-sm mt-0.5 block">
                            {parsedSubscribers.filter(s => s.status === 'invalid' || s.status === 'duplicate').length}
                          </span>
                        </div>
                      </div>

                      {/* Display Preview list */}
                      <div className="overflow-x-auto max-h-[180px] overflow-y-auto border border-gray-50 rounded-xl">
                        <table className="w-full text-left text-[11px] text-slate-700">
                          <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider text-[9px] sticky top-0">
                            <tr>
                              <th className="px-3 py-2">No.</th>
                              <th className="px-3 py-2">Email</th>
                              <th className="px-3 py-2">Default Name</th>
                              <th className="px-3 py-2">Location</th>
                              <th className="px-3 py-2">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-50">
                            {parsedSubscribers.map((item, index) => {
                              const statusStyles = {
                                valid: 'bg-green-100 text-green-800 border border-green-200/50',
                                invalid: 'bg-red-100 text-red-800 border border-red-200/50',
                                duplicate: 'bg-orange-100 text-orange-800 border border-orange-200/50',
                                exists: 'bg-yellow-100 text-yellow-800 border border-yellow-200/50'
                              }[item.status];

                              return (
                                <tr key={index} className="hover:bg-gray-50/60 font-medium">
                                  <td className="px-3 py-2 text-gray-400">{index + 1}</td>
                                  <td className="px-3 py-2 text-gray-800 font-bold">{item.email}</td>
                                  <td className="px-3 py-2 text-gray-505">{item.name}</td>
                                  <td className="px-3 py-2 text-gray-505">{item.location}</td>
                                  <td className="px-3 py-2">
                                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold ${statusStyles}`}>
                                      {item.status === 'valid' ? 'Ready' : (item.errorMsg || item.status)}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      <div className="flex gap-2 justify-end pt-1">
                        <button
                          type="button"
                          disabled={isImportingEmails || parsedSubscribers.filter(s => s.status === 'valid').length === 0}
                          onClick={handleExecuteBulkImport}
                          className="px-5 py-2.5 bg-[#e90b35] hover:bg-[#d00a30] disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-extrabold text-xs rounded-xl shadow-sm shadow-[#e90b35]/10 flex items-center gap-2 transition-all cursor-pointer"
                        >
                          <Check className="w-4 h-4" />
                          {isImportingEmails 
                            ? `Importing (${emailImportProgress.current}/${emailImportProgress.total})...` 
                            : `Import ${parsedSubscribers.filter(s => s.status === 'valid').length} New Subscribers`}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Filtering Dashboard */}
            <div className="space-y-3 pt-2">
              <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by email, name, or location..."
                    value={subscriberSearch}
                    onChange={(e) => setSubscriberSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#e90b35]/20"
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  {/* Subscriber Type Filter */}
                  <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                    {(['all', 'registered', 'guests'] as const).map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setSubscriberTab(tab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                          subscriberTab === tab
                            ? 'bg-white text-gray-950 shadow-sm'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {tab === 'all' ? 'All' : tab === 'registered' ? 'Registered' : 'Guests'}
                      </button>
                    ))}
                  </div>

                  {/* Subscriber Status Filter */}
                  <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                    {(['all', 'subscribed', 'unsubscribed'] as const).map((statusTab) => (
                      <button
                        key={statusTab}
                        type="button"
                        onClick={() => setSubscriberStatusFilter(statusTab)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                          subscriberStatusFilter === statusTab
                            ? 'bg-white text-gray-950 shadow-sm'
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                      >
                        {statusTab === 'all' ? 'All' : statusTab === 'subscribed' ? 'Subscribed' : 'Unsubscribed'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Subscribers List Container */}
            <div className="overflow-hidden border border-gray-100 rounded-2xl bg-white">
              <div className="max-h-[460px] overflow-y-auto divide-y divide-gray-50">
                {visibleSubscribers.length === 0 ? (
                  <div className="p-10 text-center text-gray-400 text-sm">
                    No subscriber records found matching these criteria.
                  </div>
                ) : (
                  visibleSubscribers.map((sub) => {
                    const isActive = sub.status === 'subscribed';
                    return (
                      <div key={sub.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-3 hover:bg-gray-50 transition-colors">
                        <div className="min-w-0 flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                            isActive
                              ? (sub.type === 'Registered' ? 'bg-blue-50/70 text-blue-600' : 'bg-teal-50 text-teal-600')
                              : 'bg-gray-100 text-gray-400'
                          }`}>
                            {isActive ? (
                              <UserCheck className="w-5 h-5" />
                            ) : (
                              <UserX className="w-5 h-5" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-bold text-gray-900 text-sm truncate">{sub.name || 'Anonymous'}</span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                sub.type === 'Registered' 
                                  ? 'bg-blue-50 text-blue-600 border border-blue-100/50' 
                                  : 'bg-teal-50 text-teal-600 border border-teal-100/50'
                              }`}>
                                {sub.type}
                              </span>
                              <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                isActive 
                                  ? 'bg-green-50 text-green-600 border border-green-100/50' 
                                  : 'bg-red-50 text-red-600 border border-red-100/50'
                              }`}>
                                {isActive ? 'Active' : 'Unsubscribed'}
                              </span>
                            </div>
                            
                            {/* Metadata Details Row */}
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-gray-500">
                              <span className="text-gray-900 font-semibold truncate block max-w-[200px] sm:max-w-xs">{sub.email}</span>
                              <span className="text-gray-300">•</span>
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                {sub.location || 'Ottawa, ON'}
                              </span>
                              {sub.createdAt && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="flex items-center gap-1">
                                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                                    Subbed: {new Date(sub.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </>
                              )}
                              {!isActive && sub.unsubscribedAt && (
                                <>
                                  <span className="text-gray-300">•</span>
                                  <span className="flex items-center gap-1 text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md text-[10px] font-medium">
                                    <UserMinus className="w-3 h-3" />
                                    Unsubscribed: {new Date(sub.unsubscribedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Subscriber Action Panel */}
                        <div className="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                          {isActive ? (
                            <button
                              onClick={() => handleUnsubscribeSubscriber(sub)}
                              className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              title="Unsubscribe Newsletter"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                              Unsubscribe
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReSubscribeSubscriber(sub)}
                              className="px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-600 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                              title="Subscribe / Re-enable"
                            >
                              <UserCheck className="w-3.5 h-3.5" />
                              Re-subscribe
                            </button>
                          )}
                          
                          {/* Purge Guest records option */}
                          {sub.type === 'Guest' && (
                            <button
                              onClick={() => handleDeleteSubscriberPermanently(sub)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all cursor-pointer"
                              title="Delete permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Link Shortener Section */}
        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Link Shortener
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden p-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <LinkIcon className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Custom Link Shortener</h3>
                <p className="text-sm text-gray-500">Create short links to any external URLs.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Original URL</label>
                <input 
                  type="url" 
                  value={originalUrl}
                  onChange={(e) => setOriginalUrl(e.target.value)}
                  placeholder="https://example.com/very/long/url" 
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Custom Slug</label>
                <div className="flex rounded-2xl overflow-hidden border border-gray-100 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500/50 transition-all bg-gray-50">
                  <span className="flex items-center px-4 text-gray-400 font-medium text-sm bg-gray-100/50 border-r border-gray-200">
                    https://www.halalottawa.ca/go/
                  </span>
                  <input 
                    type="text" 
                    value={customSlug}
                    onChange={(e) => setCustomSlug(e.target.value)}
                    placeholder="my-custom-link" 
                    className="flex-1 px-3 py-3 bg-transparent text-sm focus:outline-none"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={handleCreateShortLink} 
                  disabled={isCreatingShortLink || !originalUrl || !customSlug} 
                  className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl shadow-lg shadow-gray-200 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center cursor-pointer"
                >
                  {isCreatingShortLink ? 'Creating...' : 'Create Link'}
                </button>
              </div>
            </div>

            {shortLinks.length > 0 && (
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h4 className="font-bold text-gray-900 mb-4">Created Links</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-[10px] uppercase tracking-wider text-gray-400 bg-gray-50/50">
                      <tr>
                        <th className="px-4 py-3 font-bold rounded-l-xl">Slug</th>
                        <th className="px-4 py-3 font-bold">Original URL</th>
                        <th className="px-4 py-3 font-bold text-center">Visits</th>
                        <th className="px-4 py-3 font-bold rounded-r-xl">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {shortLinks.map(link => (
                        <tr key={link.slug} className="hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-3 font-medium text-indigo-600">
                            <a href={`https://www.halalottawa.ca/go/${link.slug}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                              https://www.halalottawa.ca/go/{link.slug}
                            </a>
                          </td>
                          <td className="px-4 py-3 text-gray-500 max-w-[200px] truncate" title={link.originalUrl}>
                            {link.originalUrl}
                          </td>
                          <td className="px-4 py-3 text-center font-medium text-gray-900">
                            {link.visits || 0}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleDeleteShortLink(link.slug)}
                              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                              title="Delete short link"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* View Feedback Modal */}
      {viewFeedbackItem && (() => {
        const item = viewFeedbackItem.item;
        const type = viewFeedbackItem.type;
        const parentInfo = (() => {
          if (type === 'reviews') {
            const listing = [...pendingListings, ...approvedListings].find(l => l.id === item.listingId);
            return {
              name: listing ? listing.name : 'Unknown Listing',
              type: 'Listing',
              link: listing ? `/listings/${listing.slug || listing.id}` : null
            };
          } else if (type === 'comments') {
            if (item.parentType === 'news') {
              const article = [...pendingNews, ...approvedNews].find(n => n.id === item.parentId);
              return {
                name: article ? article.title : 'Unknown News Article',
                type: 'News',
                link: article ? `/news/${article.slug || article.id}` : null
              };
            } else if (item.parentType === 'event') {
              const eventItem = [...pendingEvents, ...approvedEvents].find(e => e.id === item.parentId);
              return {
                name: eventItem ? eventItem.title : 'Unknown Event',
                type: 'Event',
                link: eventItem ? `/events/${eventItem.slug || eventItem.id}` : null
              };
            }
          }
          return null;
        })();

        return (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold capitalize">{type.slice(0, -1)} Details</h3>
                <button 
                  onClick={() => setViewFeedbackItem(null)}
                  className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
                    {item.userPhoto ? (
                      <img src={(item.userPhoto) || undefined} alt={item.userName} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-gray-900">{item.userName || 'Anonymous User'}</p>
                    <p className="text-xs text-gray-500">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : 'Recent'}</p>
                  </div>
                </div>

                {parentInfo && (
                  <div className="bg-gray-50/70 border border-gray-100 p-3 rounded-2xl flex items-center justify-between text-sm gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{parentInfo.type}</p>
                      <p className="font-semibold text-gray-800 truncate max-w-[200px] sm:max-w-xs">{parentInfo.name}</p>
                    </div>
                    {parentInfo.link && (
                      <Link 
                        to={parentInfo.link} 
                        target="_blank"
                        className="text-xs bg-[#e90b35] text-white px-3 py-1.5 rounded-xl font-bold hover:bg-[#d00a30] transition-colors shrink-0"
                      >
                        Visit Page
                      </Link>
                    )}
                  </div>
                )}

                {type === 'reviews' && (
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        className={`w-4 h-4 ${star <= item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
                      />
                    ))}
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-2xl text-gray-700 whitespace-pre-wrap text-sm border border-gray-50">
                  {type === 'reviews' ? item.comment : item.content}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button 
                  onClick={() => setViewFeedbackItem(null)}
                  className="px-6 py-2.5 bg-gray-100 text-gray-700 font-bold hover:bg-gray-200 rounded-xl transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </main>
  );
};
