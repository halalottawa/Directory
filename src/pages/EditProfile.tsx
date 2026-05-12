import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ChevronLeft, Save, User, Mail, Phone, MapPin, Camera, AlertCircle, CheckCircle2, Send } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { TopNav } from '../components/TopNav';
import { Helmet } from 'react-helmet-async';

export const EditProfile: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const [firstName, setFirstName] = useState(user?.firstName || '');
  const [lastName, setLastName] = useState(user?.lastName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState(user?.phoneNumber || '');
  const [location, setLocation] = useState(user?.location || '');
  const [locationSuggestions, setLocationSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const OTTAWA_GATINEAU_SUGGESTIONS = [
    { display_name: 'Barrhaven, Ottawa, ON' },
    { display_name: 'Kanata, Ottawa, ON' },
    { display_name: 'Orléans, Ottawa, ON' },
    { display_name: 'Nepean, Ottawa, ON' },
    { display_name: 'Stittsville, Ottawa, ON' },
    { display_name: 'Glebe, Ottawa, ON' },
    { display_name: 'Westboro, Ottawa, ON' },
    { display_name: 'Centretown, Ottawa, ON' },
    { display_name: 'Hull, Gatineau, QC' },
    { display_name: 'Aylmer, Gatineau, QC' },
    { display_name: 'Gatineau (Sector), Gatineau, QC' },
    { display_name: 'Rockcliffe Park, Ottawa, ON' },
    { display_name: 'Sandy Hill, Ottawa, ON' },
    { display_name: 'Alta Vista, Ottawa, ON' },
    { display_name: 'Hunt Club, Ottawa, ON' },
    { display_name: 'Riverside South, Ottawa, ON' },
    { display_name: 'Findlay Creek, Ottawa, ON' },
    { display_name: 'Manotick, Ottawa, ON' },
    { display_name: 'Old Ottawa South, Ottawa, ON' },
    { display_name: 'Hintonburg, Ottawa, ON' }
  ];

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout);
    };
  }, [searchTimeout]);

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || user.name.split(' ')[0] || '');
      setLastName(user.lastName || user.name.split(' ').slice(1).join(' ') || '');
      setEmail(user.email);
      setPhone(user.phoneNumber || '');
      setLocation(user.location || '');
    }
  }, [user]);

  const handleLocationChange = (val: string) => {
    setLocation(val);
    
    if (searchTimeout) clearTimeout(searchTimeout);

    if (val.length > 2) {
      setIsSearching(true);
      const timeout = setTimeout(async () => {
        try {
          // Using Open-Meteo Geocoding API which is more lenient and reliable for free use
          const response = await fetch(
            `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(val)}&count=5&language=en&format=json`
          );
          
          if (!response.ok) throw new Error('Network response was not ok');
          
          const data = await response.json();
          const results = data.results || [];
          
          // Map to a common format
          const formatted = results.map((item: any) => ({
            display_name: [item.name, item.admin1, item.country].filter(Boolean).join(', '),
            ...item
          }));
          
          setLocationSuggestions(formatted);
          setShowSuggestions(true);
        } catch (err) {
          console.error('Error fetching locations:', err);
          setLocationSuggestions([]);
        } finally {
          setIsSearching(false);
        }
      }, 500); // 500ms debounce
      setSearchTimeout(timeout);
    } else if (val.length > 0) {
      // Filter local suggestions
      const filtered = OTTAWA_GATINEAU_SUGGESTIONS.filter(item => 
        item.display_name.toLowerCase().includes(val.toLowerCase())
      ).slice(0, 5);
      setLocationSuggestions(filtered);
      setShowSuggestions(true);
      setIsSearching(false);
    } else {
      setLocationSuggestions(OTTAWA_GATINEAU_SUGGESTIONS.slice(0, 5));
      setShowSuggestions(true);
      setIsSearching(false);
    }
  };

  const selectLocation = (item: any) => {
    setLocation(item.display_name);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const userRef = doc(db, 'users', user.uid);
      const fullName = `${firstName} ${lastName}`.trim();
      
      await updateDoc(userRef, {
        firstName,
        lastName,
        name: fullName,
        email,
        phoneNumber: phone,
        location
      });

      setSuccess('Profile updated successfully!');
      setTimeout(() => navigate('/profile', { replace: true }), 1500);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      setError('Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  const getInitials = () => {
    return (firstName?.[0] || user.name?.[0] || '?').toUpperCase();
  };

  return (
    <main className="min-h-screen bg-[#F9FAFB] pb-12">
      <Helmet>
        <title>Edit Profile | Halal Ottawa</title>
        <meta name="description" content="Edit your profile information on Halal Ottawa." />
      </Helmet>

      <TopNav showBack />
      
      <div className="max-w-2xl mx-auto px-6 pt-8">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-[#e90b35] to-[#ff4d6d] rounded-[2rem] flex items-center justify-center text-white text-3xl font-black shadow-xl shadow-red-100 ring-4 ring-white">
            {getInitials()}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Profile</h1>
            <p className="text-sm text-gray-500">Update your personal information</p>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm animate-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3 text-green-600 text-sm animate-in zoom-in-95">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">First Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#e90b35] transition-all text-sm font-medium"
                  placeholder="First"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Last Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#e90b35] transition-all text-sm font-medium"
                  placeholder="Last"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#e90b35] transition-all text-sm font-medium"
                  placeholder="your@email.com"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#e90b35] transition-all text-sm font-medium"
                  placeholder="Your Phone Number"
                />
              </div>
            </div>

            <div className="space-y-2 relative">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400 ml-1">Location</label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={location}
                  onChange={(e) => handleLocationChange(e.target.value)}
                  onFocus={() => {
                    if (location.length < 3) {
                      const filtered = OTTAWA_GATINEAU_SUGGESTIONS.filter(item => 
                        item.display_name.toLowerCase().includes(location.toLowerCase())
                      ).slice(0, 5);
                      setLocationSuggestions(filtered);
                    }
                    setShowSuggestions(true);
                  }}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                  className="w-full pl-12 pr-5 py-4 bg-gray-50 rounded-2xl border-none focus:ring-2 focus:ring-[#e90b35] transition-all text-sm font-medium"
                  placeholder="Kanata, Barrhaven, Aylmer, Hull ..."
                />
                {isSearching && (
                  <div className="absolute right-4 top-1/2 -translate-y-1/2">
                    <div className="w-4 h-4 border-2 border-gray-200 border-t-[#e90b35] rounded-full animate-spin" />
                  </div>
                )}
              </div>
              
              {showSuggestions && (locationSuggestions.length > 0 || (location.length > 2 && !isSearching)) && (
                <div className="absolute z-10 w-full mt-2 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 max-h-60 overflow-y-auto">
                  {location.length < 3 && locationSuggestions.length > 0 && (
                    <div className="px-5 py-2 bg-gray-50/50 border-b border-gray-50">
                      <p className="text-[9px] font-black uppercase tracking-widest text-gray-400">Local Suggestions</p>
                    </div>
                  )}
                  {locationSuggestions.length > 0 ? (
                    locationSuggestions.map((item, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => selectLocation(item)}
                        className="w-full px-5 py-3 text-left text-sm font-medium hover:bg-gray-50 flex items-center gap-3 transition-colors border-b border-gray-50 last:border-none"
                      >
                        <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
                        <span className="truncate">{item.display_name}</span>
                      </button>
                    ))
                  ) : (
                    <div className="px-5 py-4 text-sm text-gray-400 text-center italic">
                      No suggestions found. You can still type manually.
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex-1 py-4 bg-white border border-gray-200 text-gray-700 rounded-2xl font-bold text-sm active:scale-[0.98] transition-all hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-4 bg-[#e90b35] text-white rounded-2xl font-bold text-sm shadow-lg shadow-[#e90b35]/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-4 h-4" /> Save Changes
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};
