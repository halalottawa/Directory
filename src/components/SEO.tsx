import React from 'react';
import { Helmet } from 'react-helmet-async';
import { getGeneralSettings } from '../firebase';

export const DEFAULT_HERO_OG_IMAGE = 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/global-hero-1781326553984.webp';

// Detect SSR hydration data injected by server.ts / prerender.ts at module load time
// before component-level useState initializers consume and delete them
const initialSSRRouteType: string | undefined = typeof window !== 'undefined' ? (window as any).__INITIAL_ROUTE_TYPE__ : undefined;
const initialSSRData: any = typeof window !== 'undefined' ? (window as any).__INITIAL_DATA__ : undefined;

let isInitialHydrationRender = true;

function shouldSkipSSRJsonLd(pathname: string): boolean {
  if (!isInitialHydrationRender) return false;
  if (!initialSSRRouteType) return false;

  const cleanPath = pathname.toLowerCase().replace(/\/+$/, '') || '/';

  if (initialSSRRouteType === 'home') {
    return cleanPath === '/';
  }

  if (initialSSRRouteType === 'listing' && initialSSRData) {
    const slug = (initialSSRData.slug || initialSSRData.id || '').toString().toLowerCase();
    return Boolean(slug && (cleanPath.endsWith(`/${slug}`) || cleanPath.includes(`/${slug}`)));
  }

  if ((initialSSRRouteType === 'category' || initialSSRRouteType === 'location') && initialSSRData) {
    const target = (initialSSRData.category || initialSSRData.location || '').toString().toLowerCase();
    return Boolean(target && cleanPath.includes(target));
  }

  if (initialSSRRouteType === 'news' && initialSSRData) {
    const slug = (initialSSRData.slug || initialSSRData.id || '').toString().toLowerCase();
    return Boolean(slug && (cleanPath.endsWith(`/${slug}`) || cleanPath.includes(`/${slug}`)));
  }

  return false;
}

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

  let resolvedCanonical = canonicalUrl || `https://www.halalottawa.ca${currentPath}`;

  if (resolvedCanonical) {
    resolvedCanonical = resolvedCanonical.replace(/[a-zA-Z0-9-.]+\.run\.app/gi, 'www.halalottawa.ca');
    
    // Clean up direct occurrences of cookie check path if any remain
    if (resolvedCanonical.includes('__cookie_check')) {
      if (resolvedCanonical.includes('return_url=')) {
        try {
          const returnParam = new URL(resolvedCanonical).searchParams.get('return_url');
          if (returnParam) {
            let p = returnParam;
            if (p.startsWith('http://') || p.startsWith('https://')) {
              p = new URL(p).pathname;
            }
            resolvedCanonical = `https://www.halalottawa.ca${p.startsWith('/') ? '' : '/'}${p}`;
          } else {
            resolvedCanonical = 'https://www.halalottawa.ca';
          }
        } catch (e) {
          resolvedCanonical = 'https://www.halalottawa.ca';
        }
      } else {
        resolvedCanonical = resolvedCanonical.split('__cookie_check')[0] || 'https://www.halalottawa.ca';
      }
    }
    
    // Clean up any potential double slashes in paths like https://www.halalottawa.ca//news
    resolvedCanonical = resolvedCanonical.replace(/https:\/\/www\.halalottawa\.ca\/\/+/g, 'https://www.halalottawa.ca/');
    
    // Trim trailing slashes from the canonical URL so both '/path/' and '/path' resolve to '/path'
    if (resolvedCanonical.endsWith('/') && resolvedCanonical !== 'https://www.halalottawa.ca/') {
      resolvedCanonical = resolvedCanonical.slice(0, -1);
    }
  }

  const skipJsonLd = shouldSkipSSRJsonLd(currentPath);

  React.useEffect(() => {
    isInitialHydrationRender = false;
  }, []);

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{siteTitle}</title>
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="description" content={description} />
      )}
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
      {!skipJsonLd && structuredData && (
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
