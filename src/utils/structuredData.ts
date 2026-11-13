import {
  getCanonicalUrl,
  getAbsoluteUrl,
  getListingUrl,
  normalizeCategoryToSlug,
  formatAddressWithoutProvinceAndPostalCode,
} from './url';
import { getExcerpt, getPlainText } from './textUtils';
import { CATEGORIES, LISTING_TYPES, CUISINES } from '../constants';

export const WEBSITE_SCHEMA_ID = 'https://www.halalottawa.ca/#website';
export const ORGANIZATION_SCHEMA_ID = 'https://www.halalottawa.ca/#organization';
export const LOGO_SCHEMA_ID = 'https://www.halalottawa.ca/#logo';
export const AUTHOR_PERSON_SCHEMA_ID = 'https://www.halalottawa.ca/author/youssef-agrebi#person';

export function getWebPageSchemaId(canonicalUrl: string): string {
  return `${canonicalUrl}#webpage`;
}

export function getBreadcrumbSchemaId(canonicalUrl: string): string {
  return `${canonicalUrl}#breadcrumb`;
}

export function getEntitySchemaId(canonicalUrl: string): string {
  return `${canonicalUrl}#entity`;
}

export function getArticleSchemaId(canonicalUrl: string): string {
  return `${canonicalUrl}#article`;
}

const normalizeCompare = (val: string): string =>
  String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ');

export function resolveCategoryLabelFromPath(urlPath: string): {
  categoryLabel: string;
  isRestaurantSubcategory: boolean;
} {
  const cleanPath = (urlPath || '/').split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  const parts = cleanPath.split('/').filter(Boolean);

  if (parts.length === 0) {
    return { categoryLabel: 'Home', isRestaurantSubcategory: false };
  }

  if (parts[0].toLowerCase() === 'listings') {
    return { categoryLabel: 'Listings', isRestaurantSubcategory: false };
  }

  if (parts.length === 2 && parts[0].toLowerCase() === 'restaurants') {
    const subNorm = normalizeCompare(decodeURIComponent(parts[1]));
    const matchedLoc = ['Orleans', 'Kanata', 'Barrhaven', 'Downtown'].find(
      (l) => normalizeCompare(l) === subNorm
    );
    if (matchedLoc) {
      return { categoryLabel: matchedLoc, isRestaurantSubcategory: true };
    }
    const matchedType = LISTING_TYPES.find((t) => normalizeCompare(t) === subNorm);
    if (matchedType) {
      return { categoryLabel: matchedType, isRestaurantSubcategory: true };
    }
    const matchedCuisine = CUISINES.find((c) => normalizeCompare(c) === subNorm);
    if (matchedCuisine) {
      return { categoryLabel: matchedCuisine, isRestaurantSubcategory: true };
    }
    const fallbackSub = decodeURIComponent(parts[1])
      .replace(/-/g, ' ')
      .split(' ')
      .filter(Boolean)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
    return { categoryLabel: fallbackSub || 'Restaurants', isRestaurantSubcategory: true };
  }

  const firstNorm = normalizeCompare(decodeURIComponent(parts[0]));
  const matchedMain = CATEGORIES.find((c) => normalizeCompare(c) === firstNorm);
  if (matchedMain) {
    return { categoryLabel: matchedMain, isRestaurantSubcategory: false };
  }

  const fallbackMain = decodeURIComponent(parts[0])
    .replace(/-/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return { categoryLabel: fallbackMain || 'Listings', isRestaurantSubcategory: false };
}

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

export function getListingSchemaType(listingOrCategory: any, hasValidPostalAddress = true): string {
  const categoryInput =
    listingOrCategory && typeof listingOrCategory === 'object' && !Array.isArray(listingOrCategory)
      ? listingOrCategory.category
      : listingOrCategory;
  const typesInput: string[] =
    listingOrCategory && typeof listingOrCategory === 'object' && Array.isArray(listingOrCategory.types)
      ? listingOrCategory.types.filter((t: any) => typeof t === 'string' && t.trim() !== '')
      : [];

  const primaryCat = getPrimaryListingCategory(categoryInput);
  const slug = normalizeCategoryToSlug(primaryCat);

  let resolvedType = 'LocalBusiness';
  switch (slug) {
    case 'restaurants': {
      const normTypes = typesInput.map((t) => normalizeCompare(t));
      if (
        normTypes.length > 0 &&
        normTypes.every((t) => t === 'bakery' || t === 'desserts')
      ) {
        resolvedType = 'Bakery';
      } else if (normTypes.length === 1 && normTypes[0] === 'cafes') {
        resolvedType = 'CafeOrCoffeeShop';
      } else {
        resolvedType = 'Restaurant';
      }
      break;
    }
    case 'mosques':
      resolvedType = 'Mosque';
      break;
    case 'grocery':
      resolvedType = 'GroceryStore';
      break;
    case 'butchers':
      resolvedType = 'FoodEstablishment';
      break;
    case 'clothing':
      resolvedType = 'ClothingStore';
      break;
    case 'schools':
      resolvedType = 'School';
      break;
    case 'organizations':
      resolvedType = 'Organization';
      break;
    default:
      resolvedType = 'LocalBusiness';
      break;
  }

  // Google Search LocalBusiness rich results require a valid PostalAddress with streetAddress.
  // If a listing has no valid street address, fall back to Organization/Place to prevent invalid rich-result claims.
  if (!hasValidPostalAddress && isLocalBusinessSubtype(resolvedType)) {
    return 'Organization';
  }

  return resolvedType;
}

function isLocalBusinessSubtype(schemaType: string): boolean {
  return [
    'Restaurant',
    'Bakery',
    'CafeOrCoffeeShop',
    'GroceryStore',
    'FoodEstablishment',
    'ClothingStore',
    'LocalBusiness',
  ].includes(schemaType);
}

function isFoodEstablishmentSubtype(schemaType: string): boolean {
  return ['Restaurant', 'Bakery', 'CafeOrCoffeeShop', 'FoodEstablishment'].includes(schemaType);
}

function isPlaceCompatibleSchemaType(schemaType: string): boolean {
  return [
    'Restaurant',
    'Bakery',
    'CafeOrCoffeeShop',
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
    'Bakery',
    'CafeOrCoffeeShop',
    'GroceryStore',
    'FoodEstablishment',
    'ClothingStore',
    'School',
    'Organization',
    'LocalBusiness',
  ].includes(schemaType);
}

export function buildPostalAddressSchema(
  rawAddress?: string,
  suburb?: string
): Record<string, any> | undefined {
  if (!rawAddress || typeof rawAddress !== 'string' || rawAddress.trim() === '') {
    return undefined;
  }
  const cleaned = formatAddressWithoutProvinceAndPostalCode(rawAddress).trim();
  if (!cleaned) return undefined;

  const parts = cleaned
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean);

  // Guard against city-only fallback strings like "Ottawa, ON" being treated as a streetAddress
  const hasStreetIndicator = /\d/.test(parts[0] || '') || parts.length >= 2;
  if (!hasStreetIndicator) {
    return undefined;
  }

  let streetAddress = cleaned;
  let addressLocality = suburb && suburb.trim() !== '' ? suburb.trim() : 'Ottawa';

  if (parts.length >= 2) {
    streetAddress = parts.slice(0, -1).join(', ');
    addressLocality = parts[parts.length - 1];
  }

  if (
    !streetAddress ||
    /^(ottawa|orleans|orléans|kanata|barrhaven|nepean|gloucester|gatineau)$/i.test(streetAddress.trim())
  ) {
    return undefined;
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

const KNOWN_PLACEHOLDER_COORDS: ReadonlyArray<readonly [number, number]> = [
  [45.4215, -75.6972], // Default Ottawa center
  [45.4748, -75.4851], // Orléans fallback centroid
  [45.457, -75.474],   // Orléans sitemap fallback centroid
  [45.3088, -75.8969], // Kanata fallback centroid
  [45.329, -75.908],   // Kanata sitemap fallback centroid
  [45.2754, -75.7533], // Barrhaven fallback centroid
  [45.273, -75.738],   // Barrhaven sitemap fallback centroid
  [45.4116, -75.6963], // Downtown fallback centroid
  [45.421, -75.691],   // Downtown sitemap fallback centroid
  [45.441, -75.494],   // Coarse 3-decimal rounded estimate
  [45.474, -75.497],   // Coarse 3-decimal rounded estimate
];

export function hasAccurateGeoCoordinates(
  latInput: any,
  lngInput: any,
  hasVisibleAddress: boolean
): boolean {
  if (!hasVisibleAddress) return false;
  const lat = Number(latInput);
  const lng = Number(lngInput);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
    return false;
  }
  // Must be within Greater Ottawa / National Capital Region bounds
  if (lat < 44.9 || lat > 45.9 || lng < -76.5 || lng > -75.0) {
    return false;
  }
  for (const [pLat, pLng] of KNOWN_PLACEHOLDER_COORDS) {
    if (Math.abs(lat - pLat) < 0.0002 && Math.abs(lng - pLng) < 0.0002) {
      return false;
    }
  }
  // Require at least 4 decimal places of precision per Google GeoCoordinates guidelines
  const latDecimals = (String(lat).split('.')[1] || '').length;
  const lngDecimals = (String(lng).split('.')[1] || '').length;
  return latDecimals >= 4 && lngDecimals >= 4;
}

export function buildAreaServedSchema(
  rawAddress?: string,
  suburb?: string
): Record<string, any> | undefined {
  const hasAddress = typeof rawAddress === 'string' && rawAddress.trim() !== '';
  const hasSuburb = typeof suburb === 'string' && suburb.trim() !== '';
  if (!hasAddress && !hasSuburb) return undefined;

  const isGatineau = hasAddress && /\b(Gatineau|QC|Quebec)\b/i.test(rawAddress!);
  const cityName = isGatineau ? 'Gatineau' : 'Ottawa';

  if (hasSuburb && normalizeCompare(suburb!) !== normalizeCompare(cityName)) {
    return {
      '@type': 'AdministrativeArea',
      name: suburb!.trim(),
      containedInPlace: {
        '@type': 'City',
        name: cityName,
      },
    };
  }

  return {
    '@type': 'City',
    name: cityName,
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
    if (/^(open\s*)?24\s*hours$/i.test(timePart)) {
      specs.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek,
        opens: '00:00',
        closes: '23:59',
      });
      continue;
    }
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

function sanitizeSchemaValue(val: any): any {
  if (val === null || val === undefined) return undefined;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    return trimmed === '' ? undefined : trimmed;
  }
  if (Array.isArray(val)) {
    const cleaned = val
      .map((item) => sanitizeSchemaValue(item))
      .filter((item) => item !== undefined);
    return cleaned.length > 0 ? cleaned : undefined;
  }
  if (typeof val === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(val)) {
      const cleanedVal = sanitizeSchemaValue(v);
      if (cleanedVal !== undefined) {
        result[k] = cleanedVal;
      }
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }
  return val;
}

export function validateStructuredDataGraph(
  schemas: Record<string, any>[]
): Record<string, any>[] {
  if (!Array.isArray(schemas)) return [];
  const validSchemas: Record<string, any>[] = [];

  for (const raw of schemas) {
    const cleaned = sanitizeSchemaValue(raw);
    if (!cleaned || typeof cleaned !== 'object') continue;
    if (!cleaned['@context'] || !cleaned['@type']) continue;

    const type = String(cleaned['@type']);
    if (type === 'BreadcrumbList') {
      if (
        !Array.isArray(cleaned.itemListElement) ||
        cleaned.itemListElement.length === 0 ||
        !cleaned.itemListElement.every(
          (li: any, idx: number) =>
            li?.['@type'] === 'ListItem' &&
            li?.position === idx + 1 &&
            typeof li?.name === 'string' &&
            typeof li?.item === 'string' &&
            li.item.startsWith('https://www.halalottawa.ca')
        )
      ) {
        continue;
      }
    } else if (type === 'NewsArticle' || type === 'Article') {
      if (
        !cleaned.headline ||
        !cleaned.datePublished ||
        !cleaned.author?.name ||
        !Array.isArray(cleaned.image) ||
        cleaned.image.length === 0
      ) {
        continue;
      }
    } else if (isLocalBusinessSubtype(type)) {
      if (
        !cleaned.name ||
        !cleaned.url ||
        !cleaned.address?.streetAddress ||
        !cleaned.address?.addressLocality
      ) {
        continue;
      }
    }

    validSchemas.push(cleaned);
  }

  return validSchemas;
}

export function buildHomeStructuredData(
  description?: string,
  title = 'Halal Ottawa - Halal Places in Ottawa'
): Record<string, any>[] {
  const homeUrl = getCanonicalUrl('/');
  const resolvedDesc =
    description ||
    'Discover verified Halal restaurants, cafes, mosques, grocery stores, schools, and Muslim organizations in Ottawa.';

  const websiteSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': WEBSITE_SCHEMA_ID,
    url: homeUrl,
    name: 'Halal Ottawa',
    alternateName: ['HalalOttawa', 'Halal Ottawa Directory'],
    description: resolvedDesc,
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
    areaServed: {
      '@type': 'City',
      name: 'Ottawa',
      containedInPlace: {
        '@type': 'AdministrativeArea',
        name: 'Ontario',
        containedInPlace: {
          '@type': 'Country',
          name: 'CA',
        },
      },
    },
    sameAs: ['https://www.instagram.com/halalottawa'],
  };

  const webPageSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': getWebPageSchemaId(homeUrl),
    url: homeUrl,
    name: title,
    description: resolvedDesc,
    isPartOf: {
      '@id': WEBSITE_SCHEMA_ID,
    },
    about: {
      '@id': ORGANIZATION_SCHEMA_ID,
    },
    breadcrumb: {
      '@id': getBreadcrumbSchemaId(homeUrl),
    },
    inLanguage: 'en-CA',
  };

  const breadcrumbSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': getBreadcrumbSchemaId(homeUrl),
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: homeUrl,
      },
    ],
  };

  return validateStructuredDataGraph([
    websiteSchema,
    organizationSchema,
    webPageSchema,
    breadcrumbSchema,
  ]);
}

export function buildCategoryStructuredData(options: {
  urlPath: string;
  title: string;
  description: string;
  categoryLabel?: string;
  isRestaurantSubcategory?: boolean;
  listings?: any[];
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl(options.urlPath);
  const breadcrumbId = getBreadcrumbSchemaId(canonicalUrl);
  const resolved = resolveCategoryLabelFromPath(options.urlPath);
  const categoryLabel = options.categoryLabel || resolved.categoryLabel;
  const isRestaurantSubcategory =
    options.isRestaurantSubcategory ?? resolved.isRestaurantSubcategory;
  const listings = Array.isArray(options.listings) ? options.listings : [];

  const breadcrumbItems: Record<string, any>[] = [
    {
      '@type': 'ListItem',
      position: 1,
      name: 'Home',
      item: getCanonicalUrl('/'),
    },
  ];

  if (isRestaurantSubcategory) {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: 'Restaurants',
      item: getCanonicalUrl('/restaurants'),
    });
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 3,
      name: categoryLabel,
      item: canonicalUrl,
    });
  } else {
    breadcrumbItems.push({
      '@type': 'ListItem',
      position: 2,
      name: categoryLabel,
      item: canonicalUrl,
    });
  }

  const collectionSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': getWebPageSchemaId(canonicalUrl),
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    about: { '@id': ORGANIZATION_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    inLanguage: 'en-CA',
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

  return validateStructuredDataGraph([collectionSchema, breadcrumbSchema]);
}

export function buildListingStructuredData(
  listing: any,
  options?: {
    description?: string;
    ogImage?: string;
    visibleReviews?: any[];
  }
): Record<string, any>[] {
  if (!listing || !listing.name) return [];

  const primaryCategory = getPrimaryListingCategory(listing.category);
  const catSlug = normalizeCategoryToSlug(primaryCategory);
  const canonicalListingUrl = getCanonicalUrl(getListingUrl(listing));
  const canonicalCategoryUrl = getCanonicalUrl(`/${catSlug}`);
  const webPageId = getWebPageSchemaId(canonicalListingUrl);
  const breadcrumbId = getBreadcrumbSchemaId(canonicalListingUrl);
  const entityId = getEntitySchemaId(canonicalListingUrl);

  const postalAddress = buildPostalAddressSchema(listing.address, listing.suburb);
  const schemaType = getListingSchemaType(listing, Boolean(postalAddress));
  const isPlace = isPlaceCompatibleSchemaType(schemaType);
  const isFoodEst = isFoodEstablishmentSubtype(schemaType);
  const isPremium = listing.plan === 'premium';

  // Only emit genuine listing photos (never generic fallback hero/sunset images)
  const photos = Array.isArray(listing.photos)
    ? listing.photos
        .filter(
          (p: any) =>
            typeof p === 'string' &&
            p.trim() !== '' &&
            !p.includes('ottawa-sunset.webp') &&
            !p.includes('default-og.jpg')
        )
        .map((p: string) => getAbsoluteUrl(p))
    : [];
  const images =
    photos.length > 0
      ? photos
      : options?.ogImage &&
          !options.ogImage.includes('default-og.jpg') &&
          !options.ogImage.includes('ottawa-sunset.webp')
        ? [getAbsoluteUrl(options.ogImage)]
        : undefined;

  const hasValidGeo =
    isPlace && hasAccurateGeoCoordinates(listing.lat, listing.lng, Boolean(postalAddress));
  const areaServed = buildAreaServedSchema(listing.address, listing.suburb);

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

  // External links: website is always visible when present; socialMedia & socialMediaLinks are only visibly rendered when plan === 'premium'
  const sameAsLinks: string[] = [];
  if (typeof listing.website === 'string' && listing.website.trim() !== '') {
    const w = listing.website.trim();
    sameAsLinks.push(w.startsWith('http') ? w : `https://${w}`);
  }
  if (isPremium) {
    if (listing.socialMedia && typeof listing.socialMedia === 'object') {
      for (const val of Object.values(listing.socialMedia)) {
        if (typeof val === 'string' && val.trim() !== '') {
          const s = val.trim();
          sameAsLinks.push(s.startsWith('http') ? s : `https://${s}`);
        }
      }
    }
    if (Array.isArray(listing.socialMediaLinks)) {
      for (const link of listing.socialMediaLinks) {
        if (typeof link === 'string' && link.trim() !== '') {
          const s = link.trim();
          sameAsLinks.push(s.startsWith('http') ? s : `https://${s}`);
        }
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

  const openingHoursSpecification = isPlace
    ? buildOpeningHoursSpecification(listing.openingHours)
    : undefined;

  const cuisines = Array.isArray(listing.cuisine)
    ? listing.cuisine.filter((c: any) => typeof c === 'string' && c.trim() !== '')
    : [];
  const hasCuisine = isFoodEst && cuisines.length > 0;

  // Menu link is only visibly rendered on the page when listing.plan === 'premium'
  const menuLink = listing.menuPdfUrl || listing.menuUrl;
  const hasVisibleMenuLink =
    isFoodEst &&
    isPremium &&
    typeof menuLink === 'string' &&
    menuLink.trim() !== '' &&
    !String(listing.name || '').toLowerCase().includes('jamia islamia');

  // Avoid aggregateRating and Review unless the page displays qualifying, sourced reviews
  const qualifyingReviews = Array.isArray(options?.visibleReviews)
    ? options!.visibleReviews.filter(
        (r: any) =>
          r &&
          r.isApproved !== false &&
          typeof r.userName === 'string' &&
          r.userName.trim() !== '' &&
          typeof r.comment === 'string' &&
          r.comment.trim() !== '' &&
          Number.isFinite(Number(r.rating)) &&
          Number(r.rating) >= 1 &&
          Number(r.rating) <= 5
      )
    : [];

  let aggregateRatingSchema: Record<string, any> | undefined;
  let reviewsSchema: Record<string, any>[] | undefined;
  if (qualifyingReviews.length > 0) {
    const sum = qualifyingReviews.reduce((acc: number, r: any) => acc + Number(r.rating), 0);
    const avg = Number((sum / qualifyingReviews.length).toFixed(1));
    aggregateRatingSchema = {
      '@type': 'AggregateRating',
      ratingValue: avg,
      reviewCount: qualifyingReviews.length,
      bestRating: 5,
      worstRating: 1,
    };
    reviewsSchema = qualifyingReviews.slice(0, 10).map((r: any) => {
      const pubDate = toIsoDateString(r.createdAt);
      return {
        '@type': 'Review',
        author: {
          '@type': 'Person',
          name: r.userName.trim(),
        },
        ...(pubDate ? { datePublished: pubDate.split('T')[0] } : {}),
        reviewBody: r.comment.trim(),
        reviewRating: {
          '@type': 'Rating',
          ratingValue: Number(r.rating),
          bestRating: 5,
          worstRating: 1,
        },
      };
    });
  }

  const webPageSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': webPageId,
    url: canonicalListingUrl,
    name: `${listing.name} | Halal Ottawa`,
    ...(rawDesc ? { description: rawDesc } : {}),
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    mainEntity: { '@id': entityId },
    inLanguage: 'en-CA',
  };

  const entitySchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': schemaType,
    '@id': entityId,
    mainEntityOfPage: { '@id': webPageId },
    name: listing.name,
    url: canonicalListingUrl,
    ...(rawDesc ? { description: rawDesc } : {}),
    ...(images ? { image: images } : {}),
    ...(postalAddress ? { address: postalAddress } : {}),
    ...(hasValidGeo
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: Number(listing.lat),
            longitude: Number(listing.lng),
          },
        }
      : {}),
    ...(areaServed ? { areaServed } : {}),
    ...(phone ? { telephone: phone } : {}),
    ...(email ? { email } : {}),
    ...(uniqueSameAs.length > 0 ? { sameAs: uniqueSameAs } : {}),
    ...(openingHoursSpecification ? { openingHoursSpecification } : {}),
    ...(hasCuisine ? { servesCuisine: cuisines } : {}),
    ...(hasVisibleMenuLink
      ? {
          hasMenu: menuLink.startsWith('http') ? menuLink.trim() : getAbsoluteUrl(menuLink.trim()),
        }
      : {}),
    ...(aggregateRatingSchema ? { aggregateRating: aggregateRatingSchema } : {}),
    ...(reviewsSchema ? { review: reviewsSchema } : {}),
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

  return validateStructuredDataGraph([webPageSchema, entitySchema, breadcrumbSchema]);
}

export function buildNewsArticleStructuredData(
  article: any,
  options?: { description?: string; ogImage?: string }
): Record<string, any>[] {
  if (!article || !article.title) return [];

  const canonicalArticleUrl = getCanonicalUrl(`/news/${article.slug || article.id}`);
  const webPageId = getWebPageSchemaId(canonicalArticleUrl);
  const breadcrumbId = getBreadcrumbSchemaId(canonicalArticleUrl);
  const articleId = getArticleSchemaId(canonicalArticleUrl);
  const authorUrl = getCanonicalUrl('/author/youssef-agrebi');
  const authorName =
    typeof article.author === 'string' && article.author.trim() !== ''
      ? article.author.trim()
      : 'Youssef Agrebi';

  const publishedIso = toIsoDateString(article.publishDate || article.createdAt);
  const modifiedIso =
    toIsoDateString(article.updatedAt || article.publishDate || article.createdAt) || publishedIso;

  const rawImage =
    typeof article.coverImage === 'string' &&
    article.coverImage.trim() !== '' &&
    !article.coverImage.includes('default-og.jpg')
      ? getAbsoluteUrl(article.coverImage.trim())
      : options?.ogImage && !options.ogImage.includes('default-og.jpg')
        ? getAbsoluteUrl(options.ogImage)
        : undefined;

  const plainBody = getPlainText(article.content || '').trim();
  const desc =
    getExcerpt(article.excerpt || article.content || options?.description || '', 160) ||
    article.title;

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
        name: article.title,
        item: canonicalArticleUrl,
      },
    ],
  };

  // Emit NewsArticle only when headline, author, publish date, image, and visible article body content are all present
  const canEmitNewsArticle = Boolean(
    article.title.trim() && authorName && publishedIso && rawImage && plainBody.length > 0
  );

  const webPageSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': webPageId,
    url: canonicalArticleUrl,
    name: `${article.title} | Halal Ottawa`,
    description: desc,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    ...(canEmitNewsArticle ? { mainEntity: { '@id': articleId } } : {}),
    inLanguage: 'en-CA',
  };

  if (!canEmitNewsArticle) {
    return validateStructuredDataGraph([webPageSchema, breadcrumbSchema]);
  }

  const articleSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    '@id': articleId,
    mainEntityOfPage: {
      '@id': webPageId,
    },
    isPartOf: {
      '@id': WEBSITE_SCHEMA_ID,
    },
    url: canonicalArticleUrl,
    headline: article.title.trim(),
    description: desc,
    image: [rawImage],
    datePublished: publishedIso,
    ...(modifiedIso ? { dateModified: modifiedIso } : {}),
    inLanguage: 'en-CA',
    author: {
      '@type': 'Person',
      '@id': AUTHOR_PERSON_SCHEMA_ID,
      name: authorName,
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

  return validateStructuredDataGraph([webPageSchema, articleSchema, breadcrumbSchema]);
}

export function buildNewsListStructuredData(options: {
  title: string;
  description: string;
  articles?: any[];
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl('/news');
  const breadcrumbId = getBreadcrumbSchemaId(canonicalUrl);
  const articles = Array.isArray(options.articles) ? options.articles : [];

  const collectionSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': getWebPageSchemaId(canonicalUrl),
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    about: { '@id': ORGANIZATION_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    inLanguage: 'en-CA',
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

  return validateStructuredDataGraph([collectionSchema, breadcrumbSchema]);
}

export function buildAuthorStructuredData(options: {
  title: string;
  description: string;
  authorName?: string;
}): Record<string, any>[] {
  const authorUrl = getCanonicalUrl('/author/youssef-agrebi');
  const breadcrumbId = getBreadcrumbSchemaId(authorUrl);
  const authorName = options.authorName || 'Youssef Agrebi';

  const profileSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': getWebPageSchemaId(authorUrl),
    url: authorUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    inLanguage: 'en-CA',
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

  return validateStructuredDataGraph([profileSchema, breadcrumbSchema]);
}

export function buildStaticPageStructuredData(options: {
  urlPath: string;
  title: string;
  description: string;
  breadcrumbName: string;
}): Record<string, any>[] {
  const canonicalUrl = getCanonicalUrl(options.urlPath);
  const breadcrumbId = getBreadcrumbSchemaId(canonicalUrl);

  const webPageSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': getWebPageSchemaId(canonicalUrl),
    url: canonicalUrl,
    name: options.title,
    description: options.description,
    isPartOf: { '@id': WEBSITE_SCHEMA_ID },
    about: { '@id': ORGANIZATION_SCHEMA_ID },
    breadcrumb: { '@id': breadcrumbId },
    inLanguage: 'en-CA',
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

  return validateStructuredDataGraph([webPageSchema, breadcrumbSchema]);
}
