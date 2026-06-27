import React, { useEffect, useState, useRef } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export const AdDisplay: React.FC = () => {
  const [ad, setAd] = useState<any>(null);
  const adContainerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!ad || ad.type === 'banner') return;
    if (!adContainerRef.current) return;

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = ad.codeSnippet || '';

    Array.from(tempDiv.childNodes).forEach(node => {
      if (node.nodeName.toLowerCase() !== 'script') {
        adContainerRef.current?.appendChild(node.cloneNode(true));
      }
    });

    tempDiv.querySelectorAll('script').forEach(oldScript => {
      const newScript = document.createElement('script');
      if (oldScript.src) {
        newScript.src = oldScript.src;
      }
      newScript.async = oldScript.async;
      if (oldScript.textContent) {
        newScript.textContent = oldScript.textContent;
      }
      document.head.appendChild(newScript);
    });

    return () => {
      if (adContainerRef.current) {
        adContainerRef.current.innerHTML = '';
      }
    };
  }, [ad]);

  if (!ad) return null;

  return (
    <div className="w-full my-6 flex justify-center min-h-[60px] md:min-h-[120px]">
      {ad.type === 'banner' ? (
        <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" className="block w-full max-w-4xl rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
          <img src={(ad.imageUrl) || undefined} alt="Advertisement" className="w-full h-auto object-cover max-h-[250px]" />
        </a>
      ) : (
        <div ref={adContainerRef} className="w-full max-w-4xl flex justify-center" />
      )}
    </div>
  );
};
