import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { NotFound } from './NotFound';
import { SEO } from '../components/SEO';

export const ShortLinkRedirect: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchLink = async () => {
      if (!slug) return;
      try {
        const linkRef = doc(db, 'short_links', slug);
        const linkSnap = await getDoc(linkRef);
        
        if (linkSnap.exists()) {
          const data = linkSnap.data();
          
          // Increment visits
          try {
            await updateDoc(linkRef, { visits: increment(1) });
          } catch (e) {
            console.error('Failed to update visits', e);
          }
          
          let targetUrl = data.originalUrl;
          if (targetUrl) {
            // Replace any sandbox or staging Cloud Run / AI Studio domains with public canonical production domain
            if (targetUrl.includes('.run.app')) {
              targetUrl = targetUrl.replace(/[a-zA-Z0-9-.]+\.run\.app/gi, 'www.halalottawa.ca');
            }
          }

          if (targetUrl.startsWith('/')) {
            targetUrl = 'https://www.halalottawa.ca' + targetUrl;
          } else if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
          }
          
          window.location.replace(targetUrl);
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Error fetching short link:', err);
        setError(true);
      }
    };

    fetchLink();
  }, [slug]);

  if (error) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <SEO 
        title="Redirecting..." 
        description="Redirecting you to the target community link on Halal Ottawa." 
        noindex={true}
      />
      <div className="w-12 h-12 border-4 border-[#e90b35] border-t-transparent rounded-full animate-spin mb-4"></div>
      <p className="text-gray-500 font-medium">Redirecting...</p>
    </div>
  );
};
