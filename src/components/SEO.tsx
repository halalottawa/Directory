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

  return (
    <Helmet>
      {/* Standard SEO */}
      <title>{siteTitle}</title>
      {noindex ? (
        <meta name="robots" content="noindex, nofollow" />
      ) : (
        <meta name="description" content={description} />
      )}
      {canonicalUrl && !noindex && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={siteTitle} />
      {!noindex && <meta property="og:description" content={description} />}
      {ogImage && !noindex && <meta property="og:image" content={ogImage} />}
      {canonicalUrl && !noindex && <meta property="og:url" content={canonicalUrl} />}

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={siteTitle} />
      {!noindex && <meta name="twitter:description" content={description} />}
      {ogImage && !noindex && <meta name="twitter:image" content={ogImage} />}

      {/* Structured Data (JSON-LD) */}
      {structuredData && (
        <script 
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      )}
    </Helmet>
  );
};
