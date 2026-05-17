import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Eye, MapPin, Calendar, Briefcase, Newspaper, MessageSquare, Star, Users, Check, Trash2, Bell, Mail, Search, Pencil, RefreshCw, X } from 'lucide-react';
import { collection, query, getDocs, doc, updateDoc, deleteDoc, where, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Listing, Event, Job, NewsArticle, Review, Comment, UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Helmet } from 'react-helmet-async';
import { toast } from 'sonner';
import { GoogleGenAI, Type } from '@google/genai';
import { Pagination } from '../components/Pagination';
import { uploadFile } from '../utils/storageUtils';

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
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  // Ads states
  const [ads, setAds] = useState<any[]>([]);
  const [newAd, setNewAd] = useState({ type: 'banner', imageUrl: '', linkUrl: '', codeSnippet: '', isActive: true });
  const [isAddingAd, setIsAddingAd] = useState(false);

  // Settings states
  const [siteLogoUrl, setSiteLogoUrl] = useState('');
  const [isLogoUploading, setIsLogoUploading] = useState(false);

  const [viewFeedbackItem, setViewFeedbackItem] = useState<{ type: 'reviews' | 'comments', item: any } | null>(null);

  const generateWithRetry = async (ai: any, prompt: string, toastId: any, maxRetries = 6) => {
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let retries = 0;
    while (retries < maxRetries) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }]
          }
        });
        return response;
      } catch (error: any) {
        if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('quota')) {
          retries++;
          if (retries >= maxRetries) {
            throw new Error("You have exceeded your Gemini API quota. Please wait a few minutes and try again, or check your Google Cloud billing details.");
          }
          // Exponential backoff capped at 60 seconds
          const backoff = Math.min(Math.pow(2, retries) * 5000, 60000);
          const waitTime = backoff + Math.random() * 2000;
          toast.loading(`Rate limit hit. Retrying in ${Math.round(waitTime/1000)}s...`, { id: toastId });
          await delay(waitTime);
        } else {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  };

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
        reviewsSnap, commentsSnap, usersSnap, adsSnap, planRequestsSnap, settingsSnap
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
        getDoc(doc(db, 'settings', 'general'))
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

      if (settingsSnap.exists() && settingsSnap.data().logoUrl) {
        setSiteLogoUrl(settingsSnap.data().logoUrl);
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
      const url = await uploadFile(file, 'settings', 'halal-ottawa-logo');
      await setDoc(doc(db, 'settings', 'general'), { logoUrl: url }, { merge: true });
      setSiteLogoUrl(url);
      toast.success('Site logo updated successfully.');
    } catch (error: any) {
      toast.error('Error: ' + (error?.message || String(error)));
      console.error(error);
    } finally {
      setIsLogoUploading(false);
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
      message: 'Are you sure you want to send an email update to all subscribed users?',
      confirmText: 'Send Email',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setIsSendingEmails(true);
        setConfirmModal(null);
        try {
          const usersSnap = await getDocs(query(collection(db, 'users'), where('consentToUpdates', '==', true)));
          const emails = usersSnap.docs.map(doc => doc.data().email);
          toast.success(`Email update sent successfully to ${emails.length} users!`);
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

  const sendPushNotification = async () => {
    if (!pushTitle || !pushMessage) {
      toast.error('Please enter both title and message for the push notification.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Send Push Notification',
      message: 'Are you sure you want to send a push notification to all devices?',
      confirmText: 'Send Push',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setIsSendingPush(true);
        setConfirmModal(null);
        try {
          // 1. Save as an in-app notification (fallback)
          const { addDoc, serverTimestamp } = await import('firebase/firestore');
          await addDoc(collection(db, 'global_notifications'), {
            title: pushTitle,
            message: pushMessage,
            createdAt: serverTimestamp(),
            type: 'push_alert'
          });

          // 2. Explain the backend requirement for real FCM
          toast.success('Notification saved! Note: Sending real FCM push notifications requires a backend server (like Firebase Cloud Functions) to use the Admin SDK.');
          
          setPushTitle('');
          setPushMessage('');
        } catch (err) {
          toast.error('Failed to send push notification.');
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
      // Initialize Gemini API
      const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('Gemini API key is missing.');
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { addDoc, query, where, getDocs, serverTimestamp } = await import('firebase/firestore');

      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

      for (let i = 0; i < places.length; i++) {
        if (i > 0) {
          toast.loading(`Waiting to prevent rate limits...`, { id: toastId });
          await delay(5000); // 5 second base delay between requests
        }

        const placeName = places[i];
        toast.loading(`Importing ${i + 1} of ${places.length}: ${placeName}...`, { id: toastId });
        
        try {
          const prompt = `Search comprehensively for "${placeName} in Ottawa or Gatineau area" using Google Search. Look at their Google Business Profile, Uber Eats, Skip The Dishes, DoorDash, official website, social media (Instagram, Facebook), Yelp, TripAdvisor, Wheree, and customer reviews.
Extract the following details:
- Name of the place
- Phone number
- Address (stop at the city/province level, do NOT include the postal code or country. e.g., "123 Main St, Ottawa, ON")
- Email (if available, otherwise empty string)
- Website (if available, otherwise empty string)
- Working hours (format as a single readable string day by day separated by comma. Add a space between the time and AM/PM, capitalize AM/PM, and add spaces around the dash. e.g., "Monday: 9 AM - 5 PM, Tuesday: 9 AM - 5 PM, Wednesday: 9 AM - 5 PM, Thursday: 9 AM - 5 PM, Friday: 9 AM - 5 PM, Saturday: 10 AM - 2 PM, Sunday: Closed")
- A valid image URL for the main photo. You MUST extract a DIRECT image link from their Google Business Profile, UberEats, SkipTheDishes, or DoorDash page. 
  Examples of CORRECT links:
  - Google My Business: "https://lh3.googleusercontent.com/p/..." or "https://lh3.googleusercontent.com/gps-cs-s/..."
  - UberEats: "https://tb-static.uber.com/prod/image-proc/processed_images/..."
  If you cannot find a DIRECT image URL matching these patterns in the search text, return an empty string "". DO NOT return a link to a webpage (like a Google Maps link or an UberEats store page). DO NOT guess or make up a URL.

Determine one or more suitable 'categories' from this exact list (pick multiple if applicable): ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'].
Important: If the place is a Grocery store or Butcher shop, only include 'Restaurants' as an additional category if it has a very prominent and distinct restaurant section serving food. If it just sells raw meat or groceries with a small takeout counter, stick to 'Grocery' and/or 'Butchers'.

If the category includes 'Restaurants', please use the information from UberEats, DoorDash, SkipTheDishes, Facebook, or Instagram to find specific details about their menu, specialties, and atmosphere.
Write an exactly 3-paragraph neutral, objective description of the place suitable for a local community directory. 
- Paragraph 1: General overview and introduction to the place.
- Paragraphs 2 and 3: Specific details about the main services, products, popular menu items, and specialties. (Divide these details across two paragraphs to ensure it is highly readable and not a single massive block of text).
Focus strictly on the details based on your search across all these platforms. DO NOT mention customer reviews, ratings, people's opinions, or the address/location of the place in the description itself.
Also, if it is a restaurant, determine one or more suitable 'cuisines' from this exact list (pick multiple if applicable): ['Turkish', 'Middle Eastern', 'Moroccan', 'Lebanese', 'Syrian', 'Pakistani', 'Afghani', 'Indian', 'Persian', 'Chinese', 'Mediterranean', 'Thai', 'Korean', 'Italian', 'Bangladeshi', 'Mexican', 'Ethiopian'].
And determine one or more suitable 'types' from this exact list (pick multiple if applicable): ['Bakery', 'Pizza', 'Burgers', 'Cafés', 'Seafood', 'Steakhouse', 'Shawarma', 'Poutine', 'Brunch', 'Breakfast', 'Pho', 'Ramen', 'Fried Chicken', 'Buffet', 'Tacos'].

Return the result strictly as a valid JSON object matching the following schema. CRITICAL: Do NOT use inner double quotes (") inside any of your string values (use single quotes (') instead if needed) to prevent JSON parsing errors. Ensure all strings are properly escaped. Do NOT wrap the JSON in markdown blocks (like \`\`\`json). Return ONLY the raw JSON string.

{
  "name": "string",
  "phone": "string",
  "address": "string",
  "email": "string",
  "website": "string",
  "workingHours": "string",
  "photoUrl": "string",
  "description": "string",
  "category": ["string"],
  "cuisine": ["string"],
  "type": ["string"]
}`;

          const response = await generateWithRetry(ai, prompt, toastId);

          let text = response.text;
          if (!text) throw new Error('No response from AI');
          
          // Clean up potential markdown formatting if the model still includes it
          text = text.replace(/```json/g, '').replace(/```/g, '').trim();
          
          // Extract JSON from the response text
          const jsonMatch = text.match(/\{[\s\S]*\}/);
          if (!jsonMatch) {
            throw new Error('Failed to extract JSON from AI response: ' + text);
          }
          
          let jsonString = jsonMatch[0];
          let data;
          
          try {
            data = JSON.parse(jsonString);
          } catch (e) {
            console.warn('Initial JSON parse failed, attempting cleanup...', e);
            // Fix common AI JSON errors: unescaped control characters or bad escape sequences
            // Remove common bad escape sequences like \x or single backslashes that aren't valid escapes
            const cleanedJson = jsonString
              .replace(/\\([^"\\\/bfnrtu])/g, '$1') // Remove backslashes that don't precede a valid escape char
              .replace(/[\x00-\x1F\x7F-\x9F]/g, ''); // Remove control characters
            
            try {
              data = JSON.parse(cleanedJson);
            } catch (e2) {
              throw new Error('Failed to parse JSON from AI response even after cleanup: ' + jsonString);
            }
          }
          
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

          await setDoc(doc(db, 'listings', uniqueSlug), {
            name: data.name,
            slug: uniqueSlug,
            address: data.address,
            phoneNumber: data.phone,
            email: data.email,
            website: data.website,
            openingHours: data.workingHours,
            description: data.description,
            category: Array.isArray(data.category) && data.category.length > 0 ? data.category : ['Organizations'],
            types: data.category.includes('Restaurants') ? (Array.isArray(data.type) ? data.type : []) : [],
            cuisine: data.category.includes('Restaurants') ? (Array.isArray(data.cuisine) ? data.cuisine : []) : [],
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
          if (err instanceof Error && err.message.includes('quota')) {
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

  const handleRefreshSingleListing = async (listing: any) => {
    const apiKey = (process.env as any).GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      toast.error("API Key not found.");
      return;
    }
    const toastId = toast.loading(`Refreshing categories for ${listing.name}...`);
    const { updateDoc, doc } = await import('firebase/firestore');
    const ai = new GoogleGenAI({ apiKey });

    try {
      const prompt = `Search comprehensively for "${listing.name}" located at "${listing.address}" in Ottawa/Gatineau area using Google Search. Look at their Google Business Profile, Uber Eats, Skip The Dishes, official website, social media (Instagram/Facebook), Yelp, TripAdvisor, Wheree, and customer reviews.
      
Based on all this information, double check and refresh the tags for this listing:
1. CATEGORIES: Choose exactly from ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'].
   - Only assign 'Restaurants' if it is clearly a restaurant, cafe, bakery, or prominently serves food.
   - For mosques, assign 'Mosques'.
   - For grocery or butchers, only assign 'Restaurants' if they have a prominent and distinct restaurant section serving food.
2. CUISINE: From ['Turkish', 'Middle Eastern', 'Moroccan', 'Lebanese', 'Syrian', 'Pakistani', 'Afghani', 'Indian', 'Persian', 'Chinese', 'Mediterranean', 'Thai', 'Korean', 'Italian', 'Bangladeshi', 'Mexican', 'Ethiopian'].
3. TYPE: From ['Bakery', 'Pizza', 'Burgers', 'Cafés', 'Seafood', 'Steakhouse', 'Shawarma', 'Poutine', 'Brunch', 'Breakfast', 'Pho', 'Ramen', 'Fried Chicken', 'Buffet', 'Tacos'].

Return strict JSON matching the schema below. CRITICAL: Do NOT use inner double quotes (") inside any of your string values (use single quotes (') instead if needed) to prevent JSON parsing errors. Ensure all strings are properly escaped. Do NOT wrap the JSON in markdown blocks. Return ONLY the raw JSON string:
{"category":["string"], "cuisine":["string"], "type":["string"]}`;
      
      const response = await generateWithRetry(ai, prompt, toastId, 2);
      const text = response.text || '';
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
          let cleaned = jsonMatch[0];
          if (cleaned.startsWith('[')) cleaned = cleaned.slice(1, -1);
          const data = JSON.parse(cleaned);
          if (data.category && Array.isArray(data.category)) {
            const isRest = data.category.includes('Restaurants');
            await updateDoc(doc(db, 'listings', listing.id), {
              category: data.category,
              types: isRest && Array.isArray(data.type) ? data.type : [],
              cuisine: isRest && Array.isArray(data.cuisine) ? data.cuisine : []
            });
            toast.success(`Successfully refreshed ${listing.name}`, { id: toastId });
            fetchData();
          } else {
            throw new Error("Invalid format returned");
          }
      } else {
        throw new Error("Could not parse JSON");
      }
    } catch (e: any) {
      console.error(`Failed to refresh ${listing.name}`, e);
      toast.error(`Failed to refresh ${listing.name}: ${e.message}`, { id: toastId });
    }
  };

  const handleDeepRefreshAllTags = async () => {
    let completedIds: string[] = [];
    try {
      const saved = localStorage.getItem('refreshCategoriesCompletedIds');
      if (saved) completedIds = JSON.parse(saved);
      // clean up just in case listings were deleted
      completedIds = completedIds.filter(id => approvedListings.some(l => l.id === id));
    } catch (e) {
      completedIds = [];
    }

    const targetListings = approvedListings.filter(l => !completedIds.includes(l.id));

    if (targetListings.length === 0) {
      localStorage.removeItem('refreshCategoriesCompletedIds');
      toast.info("All listings have already been refreshed. The tracker has been reset so you can run it again if needed.");
      return;
    }

    const isResuming = completedIds.length > 0;

    setConfirmModal({
      isOpen: true,
      title: isResuming ? 'Resume Refresh Categories' : 'Refresh Categories',
      message: isResuming 
        ? `You previously paused or hit a rate limit. There are ${targetListings.length} listings remaining to update. Do you want to resume?`
        : 'This will use the Gemini AI to search for information across Google, Uber Eats, Skip the Dishes, official websites, social media, Yelp, TripAdvisor, Google Business Profile, and reviews for ALL approved listings to double check their top-level categories (Restaurants, Mosques, Butchers, Grocery, etc) as well as their cuisines and types. This process will take a considerable amount of time. Do you want to proceed?',
      confirmText: isResuming ? 'Resume Refresh' : 'Start Refresh',
      confirmVariant: 'primary',
      onConfirm: async () => {
        setConfirmModal(null);
        setIsBatchUpdating(true);
        const apiKey = (process.env as any).GEMINI_API_KEY || (import.meta as any).env.VITE_GEMINI_API_KEY;
        if (!apiKey) {
          toast.error("API Key not found.");
          setIsBatchUpdating(false);
          return;
        }
        const toastId = toast.loading(`Refreshing ${targetListings.length} listings...`);
        const ai = new GoogleGenAI({ apiKey });
        const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
        
        let quotaHit = false;

        try {
          for (let i = 0; i < targetListings.length; i++) {
            const listing = targetListings[i];
            toast.loading(`Updating ${i + 1}/${targetListings.length}: ${listing.name}`, { id: toastId });
            const prompt = `Search comprehensively for "${listing.name}" located at "${listing.address}" in Ottawa/Gatineau area using Google Search. Look at their Google Business Profile, Uber Eats, Skip The Dishes, official website, social media (Instagram/Facebook), Yelp, TripAdvisor, Wheree, and customer reviews.
            
Based on all this information, double check and refresh the tags for this listing:
1. CATEGORIES: Choose exactly from ['Restaurants', 'Mosques', 'Organizations', 'Grocery', 'Clothing', 'Schools', 'Butchers'].
   - Only assign 'Restaurants' if it is clearly a restaurant, cafe, bakery, or prominently serves food.
   - For mosques, assign 'Mosques'.
   - For grocery or butchers, only assign 'Restaurants' if they have a prominent and distinct restaurant section serving food.
2. CUISINE: From ['Turkish', 'Middle Eastern', 'Moroccan', 'Lebanese', 'Syrian', 'Pakistani', 'Afghani', 'Indian', 'Persian', 'Chinese', 'Mediterranean', 'Thai', 'Korean', 'Italian', 'Bangladeshi', 'Mexican', 'Ethiopian'].
3. TYPE: From ['Bakery', 'Pizza', 'Burgers', 'Cafés', 'Seafood', 'Steakhouse', 'Shawarma', 'Poutine', 'Brunch', 'Breakfast', 'Pho', 'Ramen', 'Fried Chicken', 'Buffet', 'Tacos'].

Return strict JSON matching the schema below. CRITICAL: Do NOT use inner double quotes (") inside any of your string values (use single quotes (') instead if needed) to prevent JSON parsing errors. Ensure all strings are properly escaped. Do NOT wrap the JSON in markdown blocks. Return ONLY the raw JSON string:
{"category":["string"], "cuisine":["string"], "type":["string"]}`;
            
            try {
              const response = await generateWithRetry(ai, prompt, toastId);
              const text = response.text || '';
              const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
              if (jsonMatch) {
                  let cleaned = jsonMatch[0];
                  if (cleaned.startsWith('[')) cleaned = cleaned.slice(1, -1);
                  const data = JSON.parse(cleaned);
                  if (data.category && Array.isArray(data.category)) {
                    const isRest = data.category.includes('Restaurants');
                    await updateDoc(doc(db, 'listings', listing.id), {
                      category: data.category,
                      types: isRest && Array.isArray(data.type) ? data.type : [],
                      cuisine: isRest && Array.isArray(data.cuisine) ? data.cuisine : []
                    });
                  }
              }
              
              // Only push to completed tracking array if no errors were thrown
              completedIds.push(listing.id);
              localStorage.setItem('refreshCategoriesCompletedIds', JSON.stringify(completedIds));
              
            } catch (e: any) {
              console.error(`Failed to update ${listing.name}`, e);
              if (e instanceof Error && e.message.includes('quota')) {
                 toast.error(`Process stopped at "${listing.name}": Auto-retry failed. You have exceeded your Gemini API quota.`, { id: toastId });
                 quotaHit = true;
                 break;
              }
            }
            if (quotaHit) break;
            await delay(5000);
          }
          
          if (!quotaHit) {
            toast.success('Refresh completed for all listings!', { id: toastId });
            localStorage.removeItem('refreshCategoriesCompletedIds');
          }
          
          fetchData();
        } catch (err) {
          toast.error('Refresh encountered an error.', { id: toastId });
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
                 title="Refresh AI Categories"
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
      items = items.filter(item => 
        (item.comment?.toLowerCase().includes(query)) ||
        (item.content?.toLowerCase().includes(query)) ||
        (item.userName?.toLowerCase().includes(query))
      );
    }
    return items;
  })();

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-12 animate-in fade-in duration-500">
      <Helmet>
        <title>Admin Dashboard | Halal Ottawa</title>
        <meta name="description" content="Manage and moderate your community platform." />
      </Helmet>

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
                  className="px-4 py-2.5 h-fit self-start bg-blue-50 text-blue-600 font-bold rounded-xl hover:bg-blue-100 disabled:opacity-50 transition-colors flex items-center gap-2 whitespace-nowrap text-sm border border-blue-200"
                >
                  {isBatchUpdating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Refresh Categories
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
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2 flex items-center justify-between">
            <span>Users</span>
            <span className="text-gray-400 font-medium">({allUsers.length} total)</span>
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
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Notification Message</label>
                <textarea 
                  value={pushMessage}
                  onChange={(e) => setPushMessage(e.target.value)}
                  placeholder="Enter the push notification message..." 
                  rows={3}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end">
                <button 
                  onClick={sendPushNotification} 
                  disabled={isSendingPush || !pushTitle || !pushMessage} 
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

      </div>

      {/* View Feedback Modal */}
      {viewFeedbackItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold capitalize">{viewFeedbackItem.type.slice(0, -1)} Details</h3>
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
                  {viewFeedbackItem.item.userPhoto ? (
                    <img src={(viewFeedbackItem.item.userPhoto) || undefined} alt={viewFeedbackItem.item.userName} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-5 h-5 text-gray-400" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{viewFeedbackItem.item.userName || 'Anonymous User'}</p>
                  <p className="text-xs text-gray-500">{viewFeedbackItem.item.createdAt ? new Date(viewFeedbackItem.item.createdAt).toLocaleDateString() : 'Recent'}</p>
                </div>
              </div>

              {viewFeedbackItem.type === 'reviews' && (
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star 
                      key={star} 
                      className={`w-4 h-4 ${star <= viewFeedbackItem.item.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-200'}`} 
                    />
                  ))}
                </div>
              )}

              <div className="bg-gray-50 p-4 rounded-2xl text-gray-700 whitespace-pre-wrap text-sm">
                {viewFeedbackItem.type === 'reviews' ? viewFeedbackItem.item.comment : viewFeedbackItem.item.content}
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
      )}
    </main>
  );
};
