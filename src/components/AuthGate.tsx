import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Mail, Lock, User, Phone, CheckCircle2, AlertCircle, ChevronLeft } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  sendEmailVerification
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <>{children}</>;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!consent) {
          throw new Error('You must agree to receive updates to register.');
        }
        const defaultName = email.split('@')[0];
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: defaultName });
        
        await sendEmailVerification(userCredential.user);
        
        const newProfile: any = {
          uid: userCredential.user.uid,
          name: defaultName,
          email,
          role: (email.toLowerCase() === 'abesabil00@gmail.com' || email.toLowerCase() === 'abersabil00@gmail.com' || email.toLowerCase() === 'fibaliktn@gmail.com' || email.toLowerCase() === 'fibalik.tn@gmail.com') ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          consentToUpdates: consent,
          pushNotifications: consent,
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
        
        await auth.signOut();
        setSuccess('Account created! Please check your email to verify your address.');
        setTimeout(() => {
          setIsRegister(false);
        }, 2000);
        setLoading(false);
        return;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          await auth.signOut();
          throw new Error('Please verify your email address to log in. Check your inbox.');
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password. Please check your details and try again.');
      } else if (err.code === 'auth/email-already-in-use' || (err.message && err.message.includes('auth/email-already-in-use'))) {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password' || (err.message && err.message.includes('auth/weak-password'))) {
        setError('Password should be at least 6 characters.');
      } else {
        if (err.message && err.message.includes('permission')) {
          handleFirestoreError(err, OperationType.WRITE, 'users');
        }
        setError(err.message === 'Please verify your email address to log in. Check your inbox.' ? err.message : `Auth Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="relative">
      {/* Faded Content */}
      <div className="relative overflow-hidden" style={{ maxHeight: '300px' }}>
        {children}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-gray-50 to-transparent z-10" />
      </div>

      {/* Inline Login Form */}
      <div className="relative z-20 px-6 pb-12 -mt-12">
        <div className="bg-white border border-gray-100 shadow-xl rounded-3xl p-6 max-w-md mx-auto">
          <div className="text-center mb-6">
            <h3 className="text-xl font-bold text-gray-900">
              {isRegister ? 'Sign up to continue reading' : 'Sign in to continue reading'}
            </h3>
            <p className="text-sm text-gray-500 mt-1">
              Join the community to unlock full access to events, news, and more.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-600 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-100 rounded-xl flex items-start gap-2 text-green-600 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="email"
                placeholder="Email Address"
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="password"
                placeholder="Password"
                required
                className="w-full pl-10 pr-4 py-3 bg-gray-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-[#e90b35] outline-none transition-all"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {isRegister && (
              <label className="flex items-start gap-2 cursor-pointer group mt-2">
                <div className="relative mt-0.5">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />
                  <div className={`w-4 h-4 rounded border-2 transition-all ${consent ? 'bg-[#e90b35] border-[#e90b35]' : 'border-gray-200 group-hover:border-gray-300'}`}>
                    {consent && <CheckCircle2 className="w-3 h-3 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                  </div>
                </div>
                <span className="text-xs text-gray-500 leading-tight">
                  I agree to receive updates about halal food, community events, and news.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 mt-2 bg-[#e90b35] text-white font-bold text-sm rounded-xl shadow-lg shadow-red-200 active:scale-95 transition-all disabled:opacity-50"
            >
              {loading ? 'Processing...' : isRegister ? 'Register' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-gray-500 mt-4">
            {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
            <button 
              onClick={() => setIsRegister(!isRegister)}
              className="text-[#e90b35] font-bold hover:underline"
            >
              {isRegister ? 'Sign in' : 'Register'}
            </button>
          </p>

          <div className="mt-6 pt-6 border-t border-gray-50">
            <button 
              onClick={() => navigate(-1)}
              className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
