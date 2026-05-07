import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { ChevronLeft, Mail, Lock, User, Phone, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { UserProfile } from '../types';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';
import { Helmet } from 'react-helmet-async';

export const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [consent, setConsent] = useState(false);
  const [acceptedPolicy, setAcceptedPolicy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { user, setGuest, loginWithGoogle } = useAuth();

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error('Google Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Google Sign-In is not enabled in your Firebase Console. Please enable it in the Authentication > Sign-in method tab.');
      } else if (err.code === '10' || err.message?.includes('10')) {
        setError('Developer Error (Code 10). This usually means the domain is not authorized in the Firebase/Google console.');
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const from = typeof location.state?.from === 'string' 
    ? location.state.from 
    : location.state?.from?.pathname || '/';

  const customMessage = location.state?.message;

  useEffect(() => {
    if (location.pathname === '/register') {
      setIsRegister(true);
    } else if (location.pathname === '/login') {
      setIsRegister(false);
    }
  }, [location.pathname]);

  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleGuestContinue = () => {
    setGuest(true);
    navigate(from, { replace: true });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        if (!acceptedPolicy) {
          throw new Error('You must agree to the Privacy Policy to register.');
        }
        if (!consent) {
          throw new Error('You must agree to receive updates to register.');
        }
        
        // Check if user already exists in Firestore (as a backup to Firebase Auth check)
        const userDocRef = doc(db, 'users', email.toLowerCase()); // This is just a conceptual check, Auth handles it better
        
        const defaultName = email.split('@')[0];
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: defaultName });
        
        const newProfile: any = {
          uid: userCredential.user.uid,
          name: defaultName,
          email: email.toLowerCase(),
          role: (email.toLowerCase() === 'abesabil00@gmail.com' || email.toLowerCase() === 'abersabil00@gmail.com' || email.toLowerCase() === 'fibaliktn@gmail.com' || email.toLowerCase() === 'fibalik.tn@gmail.com') ? 'admin' : 'user',
          createdAt: new Date().toISOString(),
          consentToUpdates: consent,
          pushNotifications: consent,
        };
        await setDoc(doc(db, 'users', userCredential.user.uid), newProfile);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      setSuccess(isRegister ? 'Account created successfully! Redirecting...' : 'Logged in successfully! Redirecting...');
      setTimeout(() => navigate(from, { replace: true }), 1500);
    } catch (err: any) {
      console.error('Auth Error:', err);
      if (err.code === 'auth/operation-not-allowed') {
        setError('Email/Password sign-in is not enabled in your Firebase Console. Please enable it in the Authentication tab.');
      } else if (err.code === 'auth/invalid-action-code' || err.message?.includes('invalid-action')) {
        setError('Invalid request. This often happens if your domain is not authorized in Firebase or if the SHA-1 fingerprint is missing for your APK.');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Incorrect email or password. Please check your details and try again.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('This email is already registered. Please sign in instead.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (err.code === '10' || err.message?.includes('10')) {
        setError('Developer Error (Code 10). This usually means the domain or app is not authorized in Firebase Console, or the Google Client ID is misconfigured.');
      } else {
        if (err.message && err.message.includes('permission')) {
          handleFirestoreError(err, OperationType.WRITE, 'users');
        }
        setError(err.message || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <Helmet>
        <title>{isRegister ? 'Register' : 'Login'} | Halal Ottawa</title>
        <meta name="description" content={isRegister ? 'Create an account on Halal Ottawa.' : 'Log in to your Halal Ottawa account.'} />
      </Helmet>

      <button 
        onClick={() => navigate(-1)} 
        className="absolute top-6 left-6 p-3 bg-white border border-gray-100 rounded-2xl text-gray-400 hover:text-gray-600 shadow-sm active:scale-95 transition-all z-10"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>
      <div className="flex-1 flex flex-col justify-start pt-8 px-6 pb-6 max-w-md mx-auto w-full">
        <div className="text-center mb-5 space-y-1">
          <div className="w-12 h-12 bg-[#e90b35] rounded-2xl mx-auto flex items-center justify-center mb-3 shadow-lg shadow-red-200">
            <User className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            {isRegister ? 'Create Account' : 'Welcome Back'}
          </h1>
          <p className="text-sm text-gray-500">
            {isRegister ? 'Join the Halal Ottawa community today.' : 'Sign in to access community features.'}
          </p>
        </div>

        <div className="flex p-1 bg-gray-200/50 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true, state: location.state })}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${!isRegister ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => navigate('/register', { replace: true, state: location.state })}
            className={`flex-1 py-3 text-sm font-bold rounded-xl transition-all ${isRegister ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Register
          </button>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-gray-50 active:scale-95 transition-all shadow-sm disabled:opacity-50 mb-4"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          {isRegister ? 'Register with Google' : 'Sign in with Google'}
        </button>

        {customMessage && !error && !success && (
          <div className="mb-5 p-4 bg-blue-50 border border-blue-100 rounded-2xl flex items-start gap-3 text-blue-600 text-sm animate-in slide-in-from-top-2 duration-300">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-medium">{customMessage}</span>
          </div>
        )}

        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-start gap-3 text-red-600 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-2xl flex items-start gap-3 text-green-600 text-sm animate-in zoom-in-95 duration-300">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        <div className="space-y-3">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="email"
                placeholder="Email Address"
                required
                className="w-full pl-14 pr-4 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#e90b35] focus:border-transparent outline-none transition-all shadow-sm text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                required
                className="w-full pl-14 pr-12 py-3.5 bg-white border border-gray-200 rounded-2xl focus:ring-2 focus:ring-[#e90b35] focus:border-transparent outline-none transition-all shadow-sm text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {isRegister && (
              <div className="space-y-3">
                <label className="flex items-start gap-3 cursor-pointer group bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={acceptedPolicy}
                      onChange={(e) => setAcceptedPolicy(e.target.checked)}
                    />
                    <div className={`w-5 h-5 rounded border-2 transition-all ${acceptedPolicy ? 'bg-[#e90b35] border-[#e90b35]' : 'border-gray-300 group-hover:border-[#e90b35]'}`}>
                      {acceptedPolicy && <CheckCircle2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 leading-tight">
                    I agree to the <Link to="/privacy-policy" className="text-[#e90b35] font-bold hover:underline">Privacy Policy</Link> and data collection terms.
                  </span>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group bg-white p-4 rounded-2xl border border-gray-200 shadow-sm">
                  <div className="relative mt-0.5 flex-shrink-0">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={consent}
                      onChange={(e) => setConsent(e.target.checked)}
                    />
                    <div className={`w-5 h-5 rounded border-2 transition-all ${consent ? 'bg-[#e90b35] border-[#e90b35]' : 'border-gray-300 group-hover:border-[#e90b35]'}`}>
                      {consent && <CheckCircle2 className="w-4 h-4 text-white absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />}
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 leading-tight">
                    I agree to receive updates about halal food, community events, and news in Ottawa.
                  </span>
                </label>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-[#e90b35] text-white font-bold rounded-2xl shadow-lg shadow-red-200 hover:bg-[#d00a2f] active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 text-sm"
            >
              {loading ? 'Processing...' : isRegister ? 'Create Account' : 'Sign In'}
            </button>
          </form>

          <div className="relative py-0.5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gray-50 text-gray-400 uppercase tracking-[0.2em] text-[11px] font-bold">Or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestContinue}
            className="w-full py-3.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-2xl hover:bg-gray-50 active:scale-95 transition-all shadow-sm text-sm"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </main>
  );
};
