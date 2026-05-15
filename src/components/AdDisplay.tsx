import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const AdDisplay: React.FC = () => {
  const [ad, setAd] = useState<any>(null);

  useEffect(() => {
    const fetchAd = async () => {
      try {
        const q = query(collection(db, 'ads'), where('isActive', '==', true));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          // Get a random active ad
          const ads = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
          const randomAd = ads[Math.floor(Math.random() * ads.length)];
          setAd(randomAd);
        }
      } catch (error) {
        console.error("Error fetching ads:", error);
      }
    };

    fetchAd();
  }, []);

  if (!ad) {
    return (
      <div className="w-full my-6 flex justify-center">
        <div className="w-full max-w-4xl h-[100px] md:h-[200px] bg-gray-50 rounded-2xl animate-pulse flex items-center justify-center border border-gray-100">
          <span className="text-gray-200 text-xs font-bold uppercase tracking-widest">Advertisement Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full my-6 flex justify-center min-h-[100px]">
      {ad.type === 'banner' ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-w-4xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <img 
            src={getOptimizedImageUrl(ad.imageUrl, 1200, 300)} 
            alt="Advertisement" 
            className="w-full h-auto object-cover max-h-[250px]"
            decoding="async"
            width="1200"
            height="300"
          />
        </a>
      ) : (
        <div 
          className="w-full max-w-4xl flex justify-center"
          dangerouslySetInnerHTML={{ __html: ad.codeSnippet }} 
        />
      )}
    </div>
  );
};
