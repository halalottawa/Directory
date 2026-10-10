import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getGeneralSettings } from '../services/publicSettings';
import { getImageUrl, GLOBAL_HERO_IMAGE_PATH } from '../config/images';
import { getCanonicalUrl } from '../utils/url';

export const DEFAULT_HERO_OG_IMAGE = getImageUrl(GLOBAL_HERO_IMAGE_PATH, 1200);

interface SEOProps {
  title: string;
  description: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogType?: 'website' | 'article' | 'profile';
  twitterCard?: 'summary' | 'summary_large_image';
  structuredData?: Record<string, any> | Record<string, any>[];
  disableSuffix?: boolean;
  noindex?: boolean;
  robots?: string;
}

export const SEO: React.FC<SEOProps> = ({
  title,
  description,
  canonicalUrl,
  ogImage,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  structuredData,
  disableSuffix = false,
  noindex = false,
  robots,
}) => {
  const [resolvedOgImage, setResolvedOgImage] = React.useState<string>(() => {
    if (ogImage && ogImage.trim() !== '' && !ogImage.includes('default-og.jpg')) {
      return ogImage;
    }
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('halal_ottawa_general_settings');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.heroImageUrl && typeof parsed.heroImageUrl === 'string' && parsed.heroImageUrl.trim() !== '') {
            return parsed.heroImageUrl.trim();
          }
        }
      } catch (e) {
        // Fallback
      }
    }
    return DEFAULT_HERO_OG_IMAGE;
  });

  React.useEffect(() => {
    if (ogImage && ogImage.trim() !== '' && !ogImage.includes('default-og.jpg')) {
      setResolvedOgImage(ogImage);
      return;
    }
    getGeneralSettings().then((settings) => {
      if (settings?.heroImageUrl && typeof settings.heroImageUrl === 'string' && settings.heroImageUrl.trim() !== '') {
        setResolvedOgImage(settings.heroImageUrl.trim());
      } else {
        setResolvedOgImage(DEFAULT_HERO_OG_IMAGE);
      }
    }).catch(() => {
      setResolvedOgImage(DEFAULT_HERO_OG_IMAGE);
    });
  }, [ogImage]);

  React.useEffect(() => {
    if (typeof document !== 'undefined') {
      const ssrSchemas = document.querySelectorAll('script[type="application/ld+json"][data-ssr-schema="true"]');
      ssrSchemas.forEach((node) => node.parentNode?.removeChild(node));
    }
  }, [structuredData, canonicalUrl]);

  const siteTitle = title.includes('Halal Ottawa - Halal Places in Ottawa') || disableSuffix
    ? title 
    : `${title} | Halal Ottawa`;

  let currentPath = typeof window !== 'undefined' ? window.location.pathname : '';

  if (typeof window !== 'undefined' && (currentPath.includes('__cookie_check') || window.location.search.includes('return_url'))) {
    try {
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('return_url');
      if (returnUrl) {
        let path = returnUrl;
        if (returnUrl.startsWith('http://') || returnUrl.startsWith('https://')) {
          const parsedUrl = new URL(returnUrl);
          path = parsedUrl.pathname;
        }
        currentPath = path;
      } else if (currentPath.includes('__cookie_check')) {
        currentPath = '/';
      }
    } catch (e) {
      currentPath = '/';
    }
  }

  const resolvedCanonical = getCanonicalUrl(canonicalUrl || currentPath || '/');

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{siteTitle}</title>
      {(noindex || robots) && (
        <meta name="robots" content={robots || 'noindex, nofollow'} />
      )}
      <meta name="description" content={description} />
      {resolvedCanonical && <link rel="canonical" href={resolvedCanonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={siteTitle} />
      {!noindex && <meta property="og:description" content={description} />}
      {resolvedOgImage && !noindex && (
        <>
          <meta property="og:image" content={resolvedOgImage} />
          <meta property="og:image:width" content="1200" />
          <meta property="og:image:height" content="630" />
        </>
      )}
      {resolvedCanonical && <meta property="og:url" content={resolvedCanonical} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      {!noindex && <meta name="twitter:description" content={description} />}
      {resolvedOgImage && !noindex && <meta name="twitter:image" content={resolvedOgImage} />}

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        Array.isArray(structuredData)
          ? (structuredData as Array<any>).map((schema, i) => (
              <script 
                key={i}
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
              />
            ))
          : (
              <script 
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
              />
            )
      )}
    </Helmet>
  );
};
