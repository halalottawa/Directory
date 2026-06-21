import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bell, Shield, Mail, LogOut, Trash2, ChevronRight, Globe, Check, ChevronLeft, Lock, Eye, EyeOff, X as CloseIcon } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { db, auth } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { SEO } from '../components/SEO';
import { toast } from 'sonner';
import { isAppWrapper } from '../utils/platform';

export const Settings: React.FC = () => {
  const { logout, user, requestNotificationPermission } = useAuth();
  const navigate = useNavigate();
  const [updating, setUpdating] = useState(false);
  const [editingType, setEditingType] = useState<'email' | 'push' | 'password' | null>(null);
  
  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !user?.email) return;

    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match.');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }

    setUpdating(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      
      toast.success('Password updated successfully!');
      setEditingType(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      console.error('Password update error:', err);
      if (err.code === 'auth/wrong-password') {
        toast.error('Current password is incorrect.');
      } else {
        toast.error(err.message || 'Failed to update password.');
      }
    } finally {
      setUpdating(false);
    }
  };

  const handlePasswordResetRequest = () => {
    setEditingType('password');
  };

  const updateNotificationSetting = async (type: 'email' | 'push', value: string) => {
    if (!user || updating) return;
    setUpdating(true);
    try {
      const isNever = value === 'never';
      const updates: any = {};
      
      if (type === 'email') {
        updates.consentToUpdates = !isNever;
        if (!isNever) updates.emailFrequency = value;
      } else {
        updates.pushNotifications = !isNever;
        if (!isNever) updates.pushFrequency = value;
        // Request permission and fetch FCM token if enabling push notifications
        if (!isNever) {
          try {
            await requestNotificationPermission();
          } catch (err) {
            console.error('Error requesting push permission:', err);
          }
        }
      }

      await updateDoc(doc(db, 'users', user.uid), updates);
      setEditingType(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setUpdating(false);
    }
  };

  const frequencies = [
    { id: 'immediately', label: 'Immediately' },
    { id: 'daily', label: 'Daily' },
    { id: 'weekly', label: 'Weekly' },
    { id: 'bi-weekly', label: 'Bi-weekly' },
    { id: 'never', label: 'Never' }
  ];

  const getFrequencyLabel = (id?: string, defaultFreq?: string) => {
    if (!id && !defaultFreq) return 'Never';
    return frequencies.find(f => f.id === (id || defaultFreq))?.label || 'Never';
  };

  const sections = [
    {
      title: 'Notifications',
      items: [
        { 
          icon: Mail, 
          label: 'Email Notifications', 
          value: user?.consentToUpdates ? getFrequencyLabel(user.emailFrequency, 'weekly') : 'Never',
          onClick: () => setEditingType('email'),
          active: true
        },
        { 
          icon: Bell, 
          label: isAppWrapper() ? 'Push Notifications' : 'Browser Notifications', 
          value: user?.pushNotifications ? getFrequencyLabel(user.pushFrequency, 'daily') : 'Never',
          onClick: () => setEditingType('push'),
          active: true
        },
      ]
    },
    {
      title: 'Account',
      items: [
        { 
          icon: Lock, 
          label: 'Change Password', 
          value: 'Update',
          onClick: handlePasswordResetRequest,
          active: true
        },
      ]
    }
  ];

  return (
    <main className="p-6 space-y-8 animate-in fade-in duration-500">
      <SEO 
        title="Settings" 
        description="Manage your account settings and preferences on Halal Ottawa." 
        noindex={true}
      />

      <h1 className="text-3xl font-bold">Settings</h1>

      {isAppWrapper() && (
        <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 p-4 rounded-3xl flex items-start gap-3">
          <div className="p-2 bg-white rounded-xl shadow-xs text-[#e90b35]">
            <Globe className="w-5 h-5 animate-pulse" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-gray-900 text-sm">Mobile App Wrapper Connected</h3>
            <p className="text-xs text-gray-500 leading-relaxed">
              Running inside native mobile companion. Push notifications are managed via modern **Strategy B (Native JS-to-WebView Interface)**.
            </p>
            <div className="pt-2 flex items-center gap-4">
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#e90b35]/20 text-[#e90b35]">
                ● Native Channel Active
              </span>
              {localStorage.getItem('nativeFcmToken') ? (
                <span className="text-[10px] text-gray-400 font-mono">
                  Token: {localStorage.getItem('nativeFcmToken')?.substring(0, 12)}...
                </span>
              ) : (
                <span className="text-[10px] text-orange-500 animate-pulse">
                  Waiting for device registration...
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        {sections.map((section) => (
          <section key={section.title} className="space-y-3">
            <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
              {section.title}
            </h2>
            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  disabled={updating}
                  className={`w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors ${
                    idx !== section.items.length - 1 ? 'border-b border-gray-50' : ''
                  } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${item.active ? 'bg-gray-100 text-gray-700' : 'bg-gray-50 text-gray-400'}`}>
                      <item.icon className="w-4 h-4" />
                    </div>
                    <span className="font-medium text-gray-700">{item.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${item.active ? 'text-gray-700' : 'text-gray-400'}`}>{item.value}</span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          </section>
        ))}

        <section className="space-y-3">
          <h2 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] ml-2">
            Danger Zone
          </h2>
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
            <button 
              onClick={() => {
                console.log('Delete account clicked');
              }}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors border-b border-gray-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-gray-100 text-gray-700">
                  <Trash2 className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-700">Delete Account</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
            <button 
              onClick={logout}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors bg-gray-100 text-gray-700">
                  <LogOut className="w-4 h-4" />
                </div>
                <span className="font-medium text-gray-700">Logout</span>
              </div>
              <div className="flex items-center gap-2">
                <ChevronRight className="w-4 h-4 text-gray-300" />
              </div>
            </button>
          </div>
        </section>
      </div>

      {/* Modals */}
      {(editingType === 'email' || editingType === 'push') && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setEditingType(null)}
        >
          <div 
            className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingType === 'email' ? 'Email Notifications' : (isAppWrapper() ? 'Push Notifications' : 'Browser Notifications')}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Choose your preferred frequency</p>
              </div>

              <div className="space-y-2">
                {frequencies.map((freq) => {
                  const isCurrent = editingType === 'email' 
                    ? (user?.consentToUpdates && (user?.emailFrequency === freq.id || (!user?.emailFrequency && freq.id === 'weekly'))) || (!user?.consentToUpdates && freq.id === 'never')
                    : (user?.pushNotifications && (user?.pushFrequency === freq.id || (!user?.pushFrequency && freq.id === 'daily'))) || (!user?.pushNotifications && freq.id === 'never');

                  return (
                    <button
                      key={freq.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        updateNotificationSetting(editingType, freq.id);
                      }}
                      disabled={updating}
                      className={`w-full flex items-center justify-between p-4 rounded-2xl transition-all ${
                        isCurrent 
                          ? 'bg-gray-900 text-white shadow-lg' 
                          : 'hover:bg-gray-50 text-gray-700'
                      } ${updating ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-bold">{freq.label}</span>
                        {updating && isCurrent && (
                          <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                      </div>
                      {isCurrent && <Check className="w-5 h-5" />}
                    </button>
                  );
                })}
              </div>

              <button 
                onClick={() => setEditingType(null)}
                className="w-full py-4 text-gray-400 font-bold hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Change Modal */}
      {editingType === 'password' && (
        <div 
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 pb-20 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setEditingType(null)}
        >
          <div 
            className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 sm:zoom-in-95 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-gray-900">Change Password</h3>
                <button onClick={() => setEditingType(null)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <CloseIcon className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showCurrentPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">New Password</label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 pr-12 py-3 bg-gray-50 border border-gray-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500/50 transition-all"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={updating}
                  className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl shadow-lg shadow-gray-200 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2 mt-2"
                >
                  {updating && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                  Update Password
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};
