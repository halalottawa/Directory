import { getNeighborhoodFromAddress } from './geo';
import { normalizeCategoryToSlug } from './url';

export const CANONICAL_BASE_URL = 'https://www.halalottawa.ca';

export const MAIN_CATEGORIES_MAP: Record<string, string> = {
  restaurants: 'Restaurants',
  mosques: 'Mosques',
  organizations: 'Organizations',
  grocery: 'Grocery',
  clothing: 'Clothing',
  schools: 'Schools',
  butchers: 'Butchers',
};

export const RESTAURANT_LOCATIONS = ['orleans', 'kanata', 'barrhaven', 'downtown'] as const;

export const RESTAURANT_SUBCATEGORIES = [
  'bakery', 'pizza', 'burgers', 'cafes', 'seafood', 'steakhouse', 'shawarma', 'poutine',
  'brunch', 'breakfast', 'pho', 'ramen', 'fried-chicken', 'buffet', 'tacos',
  'turkish', 'middle-eastern', 'moroccan', 'lebanese', 'syrian', 'pakistani',
  'afghani', 'indian', 'persian', 'chinese', 'mediterranean', 'thai', 'korean',
  'italian', 'bangladeshi', 'mexican', 'ethiopian',
] as const;

const DISALLOWED_EXACT_PATHS = new Set([
  '/listings',
  '/admin',
  '/login',
  '/register',
  '/signup',
  '/profile',
  '/profile/edit',
  '/settings',
  '/saved',
  '/listings/add',
  '/news/add',
  '/events',
  '/events/add',
  '/jobs',
  '/jobs/add',
  '/qibla',
]);

const DISALLOWED_PREFIXES = [
  '/admin/',
  '/login/',
  '/register/',
  '/signup/',
  '/profile/',
  '/settings/',
  '/saved/',
  '/go/',
  '/listings/',
  '/authors/',
  '/events/',
  '/jobs/',
  '/islamic%20schools/',
  '/islamic schools/',
];

export function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function normalizeCompare(val: any): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function parseValidDate(rawDate: any): Date | null {
  if (!rawDate) return null;
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }
  if (typeof rawDate.toDate === 'function') {
    const d = rawDate.toDate();
    return d instanceof Date && !isNaN(d.getTime()) ? d : null;
  }
  if (typeof rawDate.seconds === 'number') {
    const d = new Date(rawDate.seconds * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof rawDate === 'number' || typeof rawDate === 'string') {
    const str = String(rawDate).trim();
    if (!str) return null;
    const d = new Date(rawDate);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatIsoDateOnly(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

export function formatW3cDateTime(d: Date | null): string | null {
  if (!d || isNaN(d.getTime())) return null;
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function normalizeCanonicalSitemapUrl(rawPathOrUrl: string): string | null {
  if (!rawPathOrUrl) return null;
  const trimmed = rawPathOrUrl.trim();
  if (!trimmed || trimmed.includes('?') || trimmed.includes('#')) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = trimmed.startsWith('http://') || trimmed.startsWith('https://')
      ? new URL(trimmed)
      : new URL(trimmed.startsWith('/') ? trimmed : `/${trimmed}`, CANONICAL_BASE_URL);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'https:' || parsed.hostname !== 'www.halalottawa.ca') {
    return null;
  }
  if (parsed.search || parsed.hash) {
    return null;
  }

  let pathname = parsed.pathname || '/';
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  const lowerPath = pathname.toLowerCase();
  if (DISALLOWED_EXACT_PATHS.has(lowerPath)) {
    return null;
  }
  if (DISALLOWED_PREFIXES.some((prefix) => lowerPath.startsWith(prefix))) {
    return null;
  }
  if (lowerPath.endsWith('/add') || lowerPath.includes('/edit/') || lowerPath.endsWith('/edit')) {
    return null;
  }
  if (lowerPath.includes('%20') || lowerPath.includes(' ')) {
    return null;
  }
  // Reject non-ASCII / diacritic subcategory paths like /restaurants/caf%c3%a9s
  if (lowerPath.startsWith('/restaurants/') && (lowerPath.includes('%c3%') || /[^\x20-\x7E]/.test(decodeURIComponent(lowerPath)))) {
    return null;
  }

  return `${CANONICAL_BASE_URL}${pathname}`;
}

export interface SitemapUrlEntry {
  loc: string;
  lastmodDate: Date | null;
  imageUrl?: string | null;
  imageTitle?: string | null;
  sortGroup: number;
}

export interface NewsSitemapEntry {
  loc: string;
  title: string;
  pubDate: Date;
  lastmodDate: Date;
}

function getLatestDate(dates: (Date | null | undefined)[]): Date | null {
  let max: Date | null = null;
  for (const d of dates) {
    if (d && !isNaN(d.getTime())) {
      if (!max || d.getTime() > max.getTime()) {
        max = d;
      }
    }
  }
  return max;
}

function normalizeImageUrl(rawUrl: any): string | null {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith('data:')) return null;
  if (trimmed.startsWith('https://') || trimmed.startsWith('http://')) {
    return trimmed.replace(/^http:\/\//i, 'https://');
  }
  if (trimmed.startsWith('/')) {
    return `${CANONICAL_BASE_URL}${trimmed}`;
  }
  return null;
}

export function buildMainSitemapXml(
  rawListings: any[],
  rawNews: any[]
): { xml: string; entries: SitemapUrlEntry[] } {
  const entryMap = new Map<string, SitemapUrlEntry>();

  const upsertEntry = (candidate: SitemapUrlEntry) => {
    const normalizedLoc = normalizeCanonicalSitemapUrl(candidate.loc);
    if (!normalizedLoc) return;

    const cleanCandidate: SitemapUrlEntry = {
      ...candidate,
      loc: normalizedLoc,
    };

    const existing = entryMap.get(normalizedLoc);
    if (!existing) {
      entryMap.set(normalizedLoc, cleanCandidate);
      return;
    }

    const mergedLastmod = getLatestDate([existing.lastmodDate, cleanCandidate.lastmodDate]);
    const preferNew =
      cleanCandidate.lastmodDate &&
      (!existing.lastmodDate || cleanCandidate.lastmodDate.getTime() >= existing.lastmodDate.getTime());

    entryMap.set(normalizedLoc, {
      loc: normalizedLoc,
      lastmodDate: mergedLastmod,
      imageUrl: (preferNew ? cleanCandidate.imageUrl : existing.imageUrl) || existing.imageUrl || cleanCandidate.imageUrl || null,
      imageTitle: (preferNew ? cleanCandidate.imageTitle : existing.imageTitle) || existing.imageTitle || cleanCandidate.imageTitle || null,
      sortGroup: Math.min(existing.sortGroup, cleanCandidate.sortGroup),
    });
  };

  // Filter to approved, valid listings and news
  const approvedListings = (rawListings || []).filter(
    (l) => l && l.isApproved === true && String(l.name || '').trim().length > 0 && String(l.slug || l.id || '').trim().length > 0
  );

  const approvedNews = (rawNews || []).filter((n) => {
    if (!n || n.isApproved !== true) return false;
    const title = String(n.title || '').trim();
    const content = String(n.content || '').trim();
    const slugOrId = String(n.slug || n.id || '').trim();
    const pubDate = parseValidDate(n.publishDate || n.createdAt);
    return title.length > 0 && content.length > 0 && slugOrId.length > 0 && pubDate !== null;
  });

  const getListingLastmod = (l: any): Date | null =>
    getLatestDate([parseValidDate(l.updatedAt), parseValidDate(l.createdAt)]);

  const getNewsLastmod = (n: any): Date | null =>
    getLatestDate([parseValidDate(n.updatedAt), parseValidDate(n.publishDate), parseValidDate(n.createdAt)]);

  const allListingDates = approvedListings.map(getListingLastmod);
  const allNewsDates = approvedNews.map(getNewsLastmod);

  // 1. Homepage (lastmod = latest update across all listings & news)
  upsertEntry({
    loc: `${CANONICAL_BASE_URL}/`,
    lastmodDate: getLatestDate([...allListingDates, ...allNewsDates]),
    sortGroup: 0,
  });

  // 2. News Hub & Author Page
  upsertEntry({
    loc: `${CANONICAL_BASE_URL}/news`,
    lastmodDate: getLatestDate(allNewsDates),
    sortGroup: 1,
  });

  const authorNewsDates = approvedNews
    .filter((a) => !a.author || String(a.author).toLowerCase().includes('youssef'))
    .map(getNewsLastmod);

  upsertEntry({
    loc: `${CANONICAL_BASE_URL}/author/youssef-agrebi`,
    lastmodDate: getLatestDate(authorNewsDates),
    sortGroup: 1,
  });

  // 3. Main Category Hubs (7)
  for (const [slug, catName] of Object.entries(MAIN_CATEGORIES_MAP)) {
    const catListings = approvedListings.filter((l) => {
      const catArray = Array.isArray(l.category) ? l.category : l.category ? [l.category] : [];
      return catArray.some(
        (c: any) =>
          normalizeCompare(c) === normalizeCompare(catName) ||
          normalizeCategoryToSlug(String(c)) === slug
      );
    });
    upsertEntry({
      loc: `${CANONICAL_BASE_URL}/${slug}`,
      lastmodDate: getLatestDate(catListings.map(getListingLastmod)),
      sortGroup: 1,
    });
  }

  // 4. Static Informational & Tool Pages (no synthetic lastmod)
  for (const staticPath of ['/faq', '/privacy-policy', '/terms', '/tools/qibla']) {
    upsertEntry({
      loc: `${CANONICAL_BASE_URL}${staticPath}`,
      lastmodDate: null,
      sortGroup: 1,
    });
  }

  // 5. Restaurant Neighbourhood Hubs (4)
  for (const loc of RESTAURANT_LOCATIONS) {
    const locListings = approvedListings.filter((l) => {
      const catArray = Array.isArray(l.category) ? l.category : l.category ? [l.category] : [];
      const isRestaurant = catArray.some((c: any) => normalizeCategoryToSlug(String(c)) === 'restaurants');
      if (!isRestaurant) return false;
      return getNeighborhoodFromAddress(l.address || '', l.suburb || '') === loc;
    });
    upsertEntry({
      loc: `${CANONICAL_BASE_URL}/restaurants/${loc}`,
      lastmodDate: getLatestDate(locListings.map(getListingLastmod)),
      sortGroup: 2,
    });
  }

  // 6. Populated Restaurant Subcategory Hubs (only included when >= 1 approved listing exists)
  for (const sub of RESTAURANT_SUBCATEGORIES) {
    const cleanSub = normalizeCompare(sub.replace(/-/g, ' '));
    const subListings = approvedListings.filter((l) => {
      const catArray = Array.isArray(l.category) ? l.category : l.category ? [l.category] : [];
      const typesArray = Array.isArray(l.types) ? l.types : l.types ? [l.types] : [];
      const cuisinesArray = Array.isArray(l.cuisine) ? l.cuisine : l.cuisine ? [l.cuisine] : [];
      return (
        catArray.some((c: any) => normalizeCompare(c) === cleanSub) ||
        typesArray.some((t: any) => normalizeCompare(t) === cleanSub) ||
        cuisinesArray.some((c: any) => normalizeCompare(c) === cleanSub)
      );
    });
    if (subListings.length > 0) {
      upsertEntry({
        loc: `${CANONICAL_BASE_URL}/restaurants/${sub}`,
        lastmodDate: getLatestDate(subListings.map(getListingLastmod)),
        sortGroup: 2,
      });
    }
  }

  // 7. Canonical Listing Detail Pages (deduplicated by canonical URL)
  for (const l of approvedListings) {
    const idPath = String(l.slug || l.id).trim();
    const rawCat = Array.isArray(l.category) && l.category.length > 0
      ? l.category[0]
      : typeof l.category === 'string'
        ? l.category
        : 'restaurants';
    const categorySlug = normalizeCategoryToSlug(rawCat);
    if (!categorySlug || categorySlug === 'listings') continue;

    const rawPhoto =
      (Array.isArray(l.photos) ? l.photos.find((p: any) => typeof p === 'string' && p.trim() !== '') : null) ||
      l.coverImage ||
      l.photo ||
      null;

    upsertEntry({
      loc: `${CANONICAL_BASE_URL}/${categorySlug}/${idPath}`,
      lastmodDate: getListingLastmod(l),
      imageUrl: normalizeImageUrl(rawPhoto),
      imageTitle: String(l.name || '').trim() || null,
      sortGroup: 3,
    });
  }

  // 8. Canonical News Detail Pages (deduplicated by canonical URL)
  for (const n of approvedNews) {
    const canonicalSlug = String(n.slug || n.id).trim();
    const rawPhoto =
      (Array.isArray(n.photos) ? n.photos.find((p: any) => typeof p === 'string' && p.trim() !== '') : null) ||
      n.coverImage ||
      null;

    upsertEntry({
      loc: `${CANONICAL_BASE_URL}/news/${canonicalSlug}`,
      lastmodDate: getNewsLastmod(n),
      imageUrl: normalizeImageUrl(rawPhoto),
      imageTitle: String(n.title || '').trim() || null,
      sortGroup: 4,
    });
  }

  // Deterministic ordering: sortGroup ascending, then loc ascending
  const sortedEntries = Array.from(entryMap.values()).sort((a, b) => {
    if (a.sortGroup !== b.sortGroup) return a.sortGroup - b.sortGroup;
    return a.loc.localeCompare(b.loc);
  });

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n`;

  for (const entry of sortedEntries) {
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(entry.loc)}</loc>\n`;
    const lastmodStr = formatIsoDateOnly(entry.lastmodDate);
    if (lastmodStr) {
      xml += `    <lastmod>${escapeXml(lastmodStr)}</lastmod>\n`;
    }
    if (entry.imageUrl) {
      xml += `    <image:image>\n`;
      xml += `      <image:loc>${escapeXml(entry.imageUrl)}</image:loc>\n`;
      if (entry.imageTitle) {
        xml += `      <image:title>${escapeXml(entry.imageTitle)}</image:title>\n`;
      }
      xml += `    </image:image>\n`;
    }
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  return { xml, entries: sortedEntries };
}

export function buildNewsSitemapXml(rawNews: any[]): { xml: string; entries: NewsSitemapEntry[] } {
  const entryMap = new Map<string, NewsSitemapEntry>();

  for (const n of rawNews || []) {
    if (!n || n.isApproved !== true) continue;
    const title = String(n.title || '').trim();
    const content = String(n.content || '').trim();
    const canonicalSlug = String(n.slug || n.id || '').trim();
    const pubDate = parseValidDate(n.publishDate || n.createdAt);
    if (!title || !content || !canonicalSlug || !pubDate) continue;

    const normalizedLoc = normalizeCanonicalSitemapUrl(`${CANONICAL_BASE_URL}/news/${canonicalSlug}`);
    if (!normalizedLoc) continue;

    const lastmodDate = getLatestDate([parseValidDate(n.updatedAt), pubDate]) || pubDate;
    const existing = entryMap.get(normalizedLoc);
    if (!existing || lastmodDate.getTime() > existing.lastmodDate.getTime()) {
      entryMap.set(normalizedLoc, {
        loc: normalizedLoc,
        title,
        pubDate,
        lastmodDate,
      });
    }
  }

  // Deterministic ordering: newest publication_date first, then loc ascending
  const allQualifying = Array.from(entryMap.values()).sort((a, b) => {
    const diff = b.pubDate.getTime() - a.pubDate.getTime();
    if (diff !== 0) return diff;
    return a.loc.localeCompare(b.loc);
  });

  // Prefer articles from the last 48 hours if present; otherwise include all qualifying visible news articles (up to 1,000)
  // so <urlset> never becomes empty and never triggers GSC's "Missing XML tag (url)" error.
  const twoDaysAgoMs = Date.now() - 48 * 60 * 60 * 1000;
  const recent48h = allQualifying.filter((item) => item.pubDate.getTime() >= twoDaysAgoMs);
  const selectedEntries = (recent48h.length > 0 ? recent48h : allQualifying).slice(0, 1000);

  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n`;
  xml += `        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n`;

  for (const item of selectedEntries) {
    const pubDateIso = formatW3cDateTime(item.pubDate);
    const lastmodIso = formatIsoDateOnly(item.lastmodDate);
    if (!pubDateIso) continue;
    xml += `  <url>\n`;
    xml += `    <loc>${escapeXml(item.loc)}</loc>\n`;
    if (lastmodIso) {
      xml += `    <lastmod>${escapeXml(lastmodIso)}</lastmod>\n`;
    }
    xml += `    <news:news>\n`;
    xml += `      <news:publication>\n`;
    xml += `        <news:name>Halal Ottawa</news:name>\n`;
    xml += `        <news:language>en</news:language>\n`;
    xml += `      </news:publication>\n`;
    xml += `      <news:publication_date>${escapeXml(pubDateIso)}</news:publication_date>\n`;
    xml += `      <news:title>${escapeXml(item.title)}</news:title>\n`;
    xml += `    </news:news>\n`;
    xml += `  </url>\n`;
  }

  xml += `</urlset>\n`;

  return { xml, entries: selectedEntries };
}
