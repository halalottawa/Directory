import React, { useState, useEffect } from 'react';
import { Bookmark } from 'lucide-react';
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { handleFirestoreError, OperationType } from '../utils/firestoreErrorHandler';

interface SaveButtonProps {
  id: string;
  type: 'listing' | 'news' | 'event' | 'job';
  variant?: 'default' | 'glass' | 'minimal';
}

export const SaveButton: React.FC<SaveButtonProps> = ({ id, type, variant = 'default' }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [savedDocId, setSavedDocId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setSavedDocId(null);
      return;
    }

    const q = query(
      collection(db, 'saved_items'),
      where('userId', '==', user.uid),
      where('itemId', '==', id),
      where('itemType', '==', type)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        setSavedDocId(snapshot.docs[0].id);
      } else {
        setSavedDocId(null);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'saved_items');
    });

    return () => unsubscribe();
  }, [user, id, type]);

  const isSaved = !!savedDocId;

  const handleToggleSave = async () => {
    if (!user) {
      navigate('/login', { 
        state: { 
          from: location.pathname,
          message: `Please sign in to save this ${type}.`
        } 
      });
      return;
    }

    setLoading(true);
    try {
      if (isSaved && savedDocId) {
        await deleteDoc(doc(db, 'saved_items', savedDocId));
      } else {
        await addDoc(collection(db, 'saved_items'), {
          userId: user.uid,
          itemId: id,
          itemType: type,
          savedAt: new Date().toISOString()
        });
      }
    } catch (err) {
      handleFirestoreError(err, isSaved ? OperationType.DELETE : OperationType.CREATE, 'saved_items');
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'glass') {
    return (
      <button 
        onClick={handleToggleSave} 
        disabled={loading}
        className={`p-2 backdrop-blur-md rounded-full text-white transition-all ${
          isSaved ? 'bg-[#e90b35]/80' : 'bg-white/20 hover:bg-white/30'
        } ${loading ? 'opacity-50' : ''}`}
      >
        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white' : ''}`} />
      </button>
    );
  }

  if (variant === 'minimal') {
    return (
      <button 
        onClick={handleToggleSave} 
        disabled={loading}
        className={`p-2 rounded-xl transition-all ${
          isSaved ? 'bg-[#e90b35]/10 text-[#e90b35]' : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
        } ${loading ? 'opacity-50' : ''}`}
      >
        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-[#e90b35]' : ''}`} />
      </button>
    );
  }

  return (
    <button 
      onClick={handleToggleSave} 
      disabled={loading}
      className={`flex flex-col items-center gap-2 group ${loading ? 'opacity-50' : ''}`}
    >
      <div className={`w-12 h-12 rounded-2xl shadow-sm border flex items-center justify-center group-active:scale-95 transition-all ${
        isSaved 
          ? 'bg-[#e90b35] border-[#e90b35] text-white' 
          : 'bg-white border-gray-100 text-[#e90b35]'
      }`}>
        <Bookmark className={`w-5 h-5 ${isSaved ? 'fill-white' : ''}`} />
      </div>
      <span className="text-[10px] font-bold text-gray-500 uppercase">
        {isSaved ? 'Saved' : 'Save'}
      </span>
    </button>
  );
};
