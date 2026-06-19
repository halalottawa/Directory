import React from 'react';
import { Helmet } from 'react-helmet-async';

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
  ogImage = 'https://www.halalottawa.ca/default-og.jpg', // Placeholder default image
  ogType = 'website',
  twitterCard = 'summary_large_image',
  structuredData,
  disableSuffix = false,
  noindex = false,
}) => {
  const siteTitle = title.includes('Halal Ottawa - Halal Places in Ottawa') || disableSuffix
    ? title 
    : `${title} | Halal Ottawa`;

  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
  let resolvedCanonical = canonicalUrl || `https://www.halalottawa.ca${currentPath}`;

  if (resolvedCanonical) {
    resolvedCanonical = resolvedCanonical.replace(/ais-pre-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    resolvedCanonical = resolvedCanonical.replace(/ais-dev-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    resolvedCanonical = resolvedCanonical.replace(/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.run\.app/gi, 'www.halalottawa.ca');
    // Clean up any potential double slashes in paths like https://www.halalottawa.ca//news
    resolvedCanonical = resolvedCanonical.replace(/https:\/\/www\.halalottawa\.ca\/\/+/g, 'https://www.halalottawa.ca/');
    
    // Trim trailing slashes from the canonical URL so both '/path/' and '/path' resolve to '/path'
    if (resolvedCanonical.endsWith('/') && resolvedCanonical !== 'https://www.halalottawa.ca/') {
      resolvedCanonical = resolvedCanonical.slice(0, -1);
    }
  }

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{siteTitle}</title>
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="description" content={description} />
      )}
      {resolvedCanonical && !noindex && <link rel="canonical" href={resolvedCanonical} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={siteTitle} />
      {!noindex && <meta property="og:description" content={description} />}
      {ogImage && !noindex && <meta property="og:image" content={ogImage} />}
      {resolvedCanonical && !noindex && <meta property="og:url" content={resolvedCanonical} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      {!noindex && <meta name="twitter:description" content={description} />}
      {ogImage && !noindex && <meta name="twitter:image" content={ogImage} />}

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
