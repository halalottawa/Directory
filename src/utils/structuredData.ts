import {
  getCanonicalUrl,
  getAbsoluteUrl,
  getListingUrl,
  normalizeCategoryToSlug,
  formatAddressWithoutProvinceAndPostalCode,
} from './url';
import { getExcerpt } from './textUtils';

export const WEBSITE_SCHEMA_ID = 'https://www.halalottawa.ca/#website';
export const ORGANIZATION_SCHEMA_ID = 'https://www.halalottawa.ca/#organization';
export const LOGO_SCHEMA_ID = 'https://www.halalottawa.ca/#logo';
export const AUTHOR_PERSON_SCHEMA_ID = 'https://www.halalottawa.ca/author/youssef-agrebi#person';

export function toIsoDateString(val: any): string | undefined {
  if (!val) return undefined;
  try {
    if (typeof val.toDate === 'function') {
      const d = val.toDate();
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    if (typeof val === 'object' && typeof val.seconds === 'number') {
      const d = new Date(val.seconds * 1000);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    }
    const d = new Date(val);
    return isNaN(d.getTime()) ? undefined : d.toISOString();
  } catch {
    return undefined;
  }
}

export function getPrimaryListingCategory(categoryInput: any): string {
  if (Array.isArray(categoryInput) && categoryInput.length > 0) {
    return String(categoryInput[0] || 'Restaurants').trim();
  }
  if (typeof categoryInput === 'string' && categoryInput.trim() !== '') {
    return categoryInput.trim();
  }
  return 'Restaurants';
}

export function getListingSchemaType(categoryInput: any): string {
  const primaryCat = getPrimaryListingCategory(categoryInput);
  const slug = normalizeCategoryToSlug(primaryCat);
  switch (slug) {
    case 'restaurants':
      return 'Restaurant';
    case 'mosques':
      return 'Mosque';
    case 'grocery':
      return 'GroceryStore';
    case 'butchers':
      return 'FoodEstablishment';
    case 'clothing':
      return 'ClothingStore';
    case 'schools':
      return 'School';
    case 'organizations':
      return 'Organization';
    default:
      return 'LocalBusiness';
  }
}

function isPlaceCompatibleSchemaType(schemaType: string): boolean {
  return [
    'Restaurant',
    'Mosque',
    'PlaceOfWorship',
    'GroceryStore',
    'FoodEstablishment',
    'ClothingStore',
    'School',
    'LocalBusiness',
  ].includes(schemaType);
}

function isOrganizationCompatibleSchemaType(schemaType: string): boolean {
  return [
    'Restaurant',
    'GroceryStore',
    'FoodEstablishment',
    'ClothingStore',
    'School',
    'Organization',
    'LocalBusiness',
  ].includes(schemaType);
}

export function buildPostalAddressSchema(rawAddress?: string, suburb?: string): Record<string, any> | undefined {
  if (!rawAddress || typeof rawAddress !== 'string' || rawAddress.trim() === '') {
    return undefined;
  }
  const cleaned = formatAddressWithoutProvinceAndPostalCode(rawAddress).trim();
  if (!cleaned) return undefined;

  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  let streetAddress = cleaned;
  let addressLocality = suburb && suburb.trim() !== '' ? suburb.trim() : 'Ottawa';

  if (parts.length >= 2) {
    streetAddress = parts.slice(0, -1).join(', ');
    addressLocality = parts[parts.length - 1];
  }

  const postalMatch = rawAddress.match(/\b([A-Z]\d[A-Z]\s?\d[A-Z]\d)\b/i);
  const rawPostal = postalMatch ? postalMatch[1].toUpperCase().replace(/\s+/g, '') : undefined;
  const formattedPostal =
    rawPostal && rawPostal.length === 6 ? `${rawPostal.slice(0, 3)} ${rawPostal.slice(3)}` : undefined;

  const addressRegion = /\b(QC|Quebec|Gatineau)\b/i.test(rawAddress) ? 'QC' : 'ON';

  return {
    '@type': 'PostalAddress',
    streetAddress,
    addressLocality,
    addressRegion,
    ...(formattedPostal ? { postalCode: formattedPostal } : {}),
    addressCountry: 'CA',
  };
}

export function buildOpeningHoursSpecification(rawHours?: string): Record<string, any>[] | undefined {
  if (!rawHours || typeof rawHours !== 'string' || rawHours.trim() === '') {
    return undefined;
  }

  const to24Hour = (hStr: string, mStr: string, ampm?: string): string => {
    let h = parseInt(hStr, 10);
    const m = mStr.padStart(2, '0');
    if (ampm) {
      const upper = ampm.toUpperCase();
      if (upper === 'PM' && h < 12) h += 12;
      if (upper === 'AM' && h === 12) h = 0;
    }
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  const specs: Record<string, any>[] = [];
  const entries = rawHours
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const entry of entries) {
    const match = entry.match(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*:\s*(.+)$/i
    );
    if (!match) continue;
    const dayRaw = match[1];
    const dayOfWeek = dayRaw.charAt(0).toUpperCase() + dayRaw.slice(1).toLowerCase();
    const timePart = match[2].trim();
    if (/closed/i.test(timePart)) continue;
    const timeMatch = timePart.match(
      /^(\d{1,2}):(\d{2})\s*(AM|PM)?\s*[-–]\s*(\d{1,2}):(\d{2})\s*(AM|PM)?$/i
    );
    if (timeMatch) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek,
        opens: to24Hour(timeMatch[1], timeMatch[2], timeMatch[3]),
        closes: to24Hour(timeMatch[4], timeMatch[5], timeMatch[6]),
      });
    }
  }

  return specs.length > 0 ? specs : undefined;
}

export function buildHomeStructuredData(description?: string): Record<string, any>[] {
  const homeUrl = getCanonicalUrl('/');
  const websiteSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_SCHEMA_ID,
    url: homeUrl,
    name: 'Halal Ottawa',
    alternateName: ['HalalOttawa', 'Halal Ottawa Directory'],
    description:
      description ||
      'Discover verified Halal restaurants, cafes, mosques, grocery stores, schools, and Muslim organizations in Ottawa.',
    publisher: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
    inLanguage: 'en-CA',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${getCanonicalUrl('/listings')}?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  const organizationSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORGANIZATION_SCHEMA_ID,
    name: 'Halal Ottawa',
    url: homeUrl,
    logo: {
      '@type': 'ImageObject',
      '@id': LOGO_SCHEMA_ID,
      url: 'https://www.halalottawa.ca/favicon.png',
    },
    sameAs: ['https://www.instagram.com/halalottawa'],
  };

  return [websiteSchema, organizationSchema];
}

export function buildCategoryStructuredData(options: {
  urlPath: string;
  title: string;
  description: string;
  categoryLabel: string;
  isRestaurantSubcategory?: boolean;
  listings?: any[];
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl(options.urlPath);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const listings = Array.isArray(options.listings) ? options.listings : [];

  const breadcrumbItems: Record<string, any>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: getCanonicalUrl('/'),
    },
  ];

  if (options.isRestaurantSubcategory) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Restaurants',
      item: getCanonicalUrl('/restaurants'),
    });
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: options.categoryLabel,
      item: canonicalUrl,
    });
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: options.categoryLabel,
      item: canonicalUrl,
    });
  }

  const collectionSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    ...(listings.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            name: options.title,
            numberOfItems: listings.length,
            itemListElement: listings.slice(0, 25).map((item: any, idx: number) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: item.name,
              url: getCanonicalUrl(getListingUrl(item)),
            })),
          },
        }
      : {}),
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: breadcrumbItems,
  };

  return [collectionSchema, breadcrumbSchema];
}

export function buildListingStructuredData(
  listing: any,
  options?: { description?: string; ogImage?: string }
): Record<string, any>[] {
  const primaryCategory = getPrimaryListingCategory(listing.category);
  const catSlug = normalizeCategoryToSlug(primaryCategory);
  const canonicalListingUrl = getCanonicalUrl(getListingUrl(listing));
  const canonicalCategoryUrl = getCanonicalUrl(`/${catSlug}`);
  const schemaType = getListingSchemaType(listing.category);
  const isPlace = isPlaceCompatibleSchemaType(schemaType);

  const photos = Array.isArray(listing.photos)
    ? listing.photos
        .filter((p: any) => typeof p === 'string' && p.trim() !== '')
        .map((p: string) => getAbsoluteUrl(p))
    : [];
  const images =
    photos.length > 0
      ? photos
      : options?.ogImage && !options.ogImage.includes('default-og.jpg')
        ? [getAbsoluteUrl(options.ogImage)]
        : undefined;

  const postalAddress = buildPostalAddressSchema(listing.address, listing.suburb);
  const lat = Number(listing.lat);
  const lng = Number(listing.lng);
  const isDefaultPlaceholderGeo =
    Math.abs(lat - 45.4215) < 0.0001 && Math.abs(lng - -75.6972) < 0.0001;
  const hasValidGeo =
    isPlace &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0 &&
    !isDefaultPlaceholderGeo;

  const phone =
    typeof listing.phoneNumber === 'string' && listing.phoneNumber.trim() !== ''
      ? listing.phoneNumber.trim()
      : undefined;
  const email =
    isOrganizationCompatibleSchemaType(schemaType) &&
    typeof listing.email === 'string' &&
    listing.email.trim() !== ''
      ? listing.email.trim()
      : undefined;

  const sameAsLinks: string[] = [];
  if (typeof listing.website === 'string' && listing.website.trim() !== '') {
    const w = listing.website.trim();
    sameAsLinks.push(w.startsWith('http') ? w : `https://${w}`);
  }
  if (listing.socialMedia && typeof listing.socialMedia === 'object') {
    for (const val of Object.values(listing.socialMedia)) {
      if (typeof val === 'string' && val.trim() !== '') {
        const s = val.trim();
        sameAsLinks.push(s.startsWith('http') ? s : `https://${s}`);
      }
    }
  }
  const uniqueSameAs = Array.from(new Set(sameAsLinks));

  const rawDesc =
    (typeof listing.description === 'string' && listing.description.trim() !== ''
      ? getExcerpt(listing.description, 250)
      : '') ||
    options?.description ||
    '';

  const reviewCount = Number(listing.reviewCount) || 0;
  const averageRating = Number(listing.averageRating) || 0;
  const hasVisibleVerifiedRating = reviewCount > 0 && averageRating > 0 && averageRating <= 5;

  const openingHoursSpecification = isPlace
    ? buildOpeningHoursSpecification(listing.openingHours)
    : undefined;

  const cuisines = Array.isArray(listing.cuisine)
    ? listing.cuisine.filter((c: any) => typeof c === 'string' && c.trim() !== '')
    : [];
  const hasCuisine = schemaType === 'Restaurant' && cuisines.length > 0;

  const menuLink = listing.menuPdfUrl || listing.menuUrl;
  const hasMenuLink =
    (schemaType === 'Restaurant' || schemaType === 'FoodEstablishment') &&
    typeof menuLink === 'string' &&
    menuLink.trim() !== '';

  const entitySchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': `${canonicalListingUrl}#entity`,
    name: listing.name,
    url: canonicalListingUrl,
    ...(rawDesc ? { description: rawDesc } : {}),
    ...(images ? { image: images } : {}),
    ...(postalAddress ? { address: postalAddress } : {}),
    ...(hasValidGeo
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: lat,
            longitude: lng,
          },
        }
      : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    ...(uniqueSameAs.length > 0 ? { sameAs: uniqueSameAs } : {}),
    ...(openingHoursSpecification ? { openingHoursSpecification } : {}),
    ...(hasCuisine ? { servesCuisine: cuisines } : {}),
    ...(hasMenuLink
      ? {
          hasMenu: menuLink.startsWith('http') ? menuLink.trim() : getAbsoluteUrl(menuLink.trim()),
        }
      : {}),
    ...(hasVisibleVerifiedRating
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(averageRating.toFixed(1)),
            reviewCount: Math.round(reviewCount),
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${canonicalListingUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: primaryCategory,
        item: canonicalCategoryUrl,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: listing.name,
        item: canonicalListingUrl,
      },
    ],
  };

  return [entitySchema, breadcrumbSchema];
}

export function buildNewsArticleStructuredData(
  article: any,
  options?: { description?: string; ogImage?: string }
): Record<string, any>[] {
  const canonicalArticleUrl = getCanonicalUrl(`/news/${article.slug || article.id}`);
  const authorUrl = getCanonicalUrl('/author/youssef-agrebi');
  const publishedIso = toIsoDateString(article.publishDate || article.createdAt);
  const modifiedIso = toIsoDateString(article.updatedAt || article.publishDate || article.createdAt);

  const rawImage =
    typeof article.coverImage === 'string' && article.coverImage.trim() !== ''
      ? getAbsoluteUrl(article.coverImage.trim())
      : options?.ogImage
        ? getAbsoluteUrl(options.ogImage)
        : undefined;

  const desc =
    options?.description ||
    getExcerpt(article.excerpt || article.content || '', 160) ||
    article.title;

  const articleSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': `${canonicalArticleUrl}#article`,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': canonicalArticleUrl,
    },
    url: canonicalArticleUrl,
    headline: article.title,
    description: desc,
    ...(rawImage ? { image: [rawImage] } : {}),
    ...(publishedIso ? { datePublished: publishedIso } : {}),
    ...(modifiedIso ? { dateModified: modifiedIso } : {}),
    author: {
      '@type': 'Person',
      '@id': AUTHOR_PERSON_SCHEMA_ID,
      name: article.author || 'Youssef Agrebi',
      url: authorUrl,
    },
    publisher: {
      '@type': 'Organization',
      '@id': ORGANIZATION_SCHEMA_ID,
      name: 'Halal Ottawa',
      url: getCanonicalUrl('/'),
      logo: {
        '@type': 'ImageObject',
        '@id': LOGO_SCHEMA_ID,
        url: 'https://www.halalottawa.ca/favicon.png',
      },
    },
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${canonicalArticleUrl}#breadcrumb`,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'News',
        item: getCanonicalUrl('/news'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.title,
        item: canonicalArticleUrl,
      },
    ],
  };

  return [articleSchema, breadcrumbSchema];
}

export function buildNewsListStructuredData(options: {
  title: string;
  description: string;
  articles?: any[];
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl('/news');
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;
  const articles = Array.isArray(options.articles) ? options.articles : [];

  const collectionSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    ...(articles.length > 0
      ? {
          mainEntity: {
            '@type': 'ItemList',
            name: 'Ottawa Muslim Community News',
            numberOfItems: articles.length,
            itemListElement: articles.slice(0, 25).map((a: any, idx: number) => ({
              '@type': 'ListItem',
              position: idx + 1,
              name: a.title,
              url: getCanonicalUrl(`/news/${a.slug || a.id}`),
            })),
          },
        }
      : {}),
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'News',
        item: canonicalUrl,
      },
    ],
  };

  return [collectionSchema, breadcrumbSchema];
}

export function buildAuthorStructuredData(options: {
  title: string;
  description: string;
  authorName?: string;
}): Record<string, any>[] {
  const authorUrl = getCanonicalUrl('/author/youssef-agrebi');
  const breadcrumbId = `${authorUrl}#breadcrumb`;
  const authorName = options.authorName || 'Youssef Agrebi';

  const profileSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': `${authorUrl}#webpage`,
    url: authorUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    mainEntity: {
      '@type': 'Person',
      '@id': AUTHOR_PERSON_SCHEMA_ID,
      name: authorName,
      jobTitle: 'Editor at Halal Ottawa',
      description:
        'Youssef Agrebi is an editor at Halal Ottawa with deep roots across the National Capital Region. Youssef is dedicated to reporting on local community announcements and Halal dining discoveries in Ottawa.',
      url: authorUrl,
      worksFor: {
        '@type': 'Organization',
        '@id': ORGANIZATION_SCHEMA_ID,
        name: 'Halal Ottawa',
        url: getCanonicalUrl('/'),
      },
      sameAs: ['https://www.linkedin.com/in/youssef-agrebi-a05010aa/'],
    },
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'News',
        item: getCanonicalUrl('/news'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: authorName,
        item: authorUrl,
      },
    ],
  };

  return [profileSchema, breadcrumbSchema];
}

export function buildStaticPageStructuredData(options: {
  urlPath: string;
  title: string;
  description: string;
  breadcrumbName: string;
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl(options.urlPath);
  const breadcrumbId = `${canonicalUrl}#breadcrumb`;

  const webPageSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': `${canonicalUrl}#webpage`,
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': breadcrumbId,
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: getCanonicalUrl('/'),
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: options.breadcrumbName,
        item: canonicalUrl,
      },
    ],
  };

  return [webPageSchema, breadcrumbSchema];
}
