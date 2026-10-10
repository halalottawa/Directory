import { Listing } from '../types';

export const normalizeCategoryToSlug = (cat: string): string => {
  if (!cat) return 'listings';
  const c = String(cat).toLowerCase().trim();
  if (c.includes('restaurant')) return 'restaurants';
  if (c.includes('mosque') || c.includes('masjid')) return 'mosques';
  if (c.includes('organization')) return 'organizations';
  if (c.includes('grocery')) return 'grocery';
  if (c.includes('clothing')) return 'clothing';
  if (c.includes('school')) return 'schools';
  if (c.includes('butcher')) return 'butchers';
  return c.trim().replace(/\s+/g, '-').replace(/[^a-z0-9\-]+/g, '');
};

export const normalizeSubcategorySlug = (sub: string): string => {
  if (!sub) return '';
  return String(sub)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]+/g, '');
};

export const getListingUrl = (listing: Listing | any): string => {
  const cat = Array.isArray(listing.category) && listing.category.length > 0
    ? listing.category[0]
    : typeof listing.category === 'string' ? listing.category : 'listings';
  
  const formattedCategory = normalizeCategoryToSlug(cat);
  const cleanSlug = listing.slug
    ? normalizeSubcategorySlug(String(listing.slug))
    : String(listing.id || '').trim();
  return `/${formattedCategory}/${cleanSlug}`;
};

const parseListingTimestampMs = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val.toDate === 'function') return val.toDate().getTime();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  const d = new Date(val);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

export const deduplicateListingsByCanonicalUrl = <T extends Record<string, any>>(listings: T[]): T[] => {
  if (!Array.isArray(listings)) return [];
  const map = new Map<string, T>();
  for (const item of listings) {
    if (!item) continue;
    const key = getCanonicalUrl(getListingUrl(item));
    const existing = map.get(key);
    if (!existing) {
      map.set(key, item);
      continue;
    }
    const itemTime = Math.max(parseListingTimestampMs(item.updatedAt), parseListingTimestampMs(item.createdAt));
    const existingTime = Math.max(parseListingTimestampMs(existing.updatedAt), parseListingTimestampMs(existing.createdAt));
    if (itemTime >= existingTime) {
      map.set(key, item);
    }
  }
  return Array.from(map.values());
};

export const CANONICAL_ORIGIN = 'https://www.halalottawa.ca';

export const getCanonicalUrl = (pathOrUrl: string = '/'): string => {
  if (!pathOrUrl) return `${CANONICAL_ORIGIN}/`;

  let raw = String(pathOrUrl).trim();
  if (!raw || raw === '/') return `${CANONICAL_ORIGIN}/`;

  if (raw.includes('.run.app') && !raw.startsWith('http')) {
    raw = 'https://' + raw;
  }

  let pathname = raw;
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.includes('__cookie_check') && parsed.searchParams.get('return_url')) {
        const ret = parsed.searchParams.get('return_url')!;
        pathname = ret.startsWith('http') ? new URL(ret).pathname : ret.split('?')[0];
      } else {
        pathname = parsed.pathname;
      }
    } catch {
      pathname = raw.replace(/^https?:\/\/[^/]+/i, '').split('?')[0].split('#')[0];
    }
  } else {
    if (raw.includes('__cookie_check') && raw.includes('return_url=')) {
      try {
        const dummy = new URL(`https://dummy.com${raw.startsWith('/') ? raw : '/' + raw}`);
        const ret = dummy.searchParams.get('return_url');
        if (ret) {
          pathname = ret.startsWith('http') ? new URL(ret).pathname : ret.split('?')[0];
        }
      } catch {
        pathname = '/';
      }
    } else {
      pathname = raw.split('?')[0].split('#')[0];
    }
  }

  if (pathname.includes('__cookie_check')) {
    pathname = pathname.split('__cookie_check')[0] || '/';
  }

  if (!pathname.startsWith('/')) {
    pathname = '/' + pathname;
  }

  pathname = pathname.replace(/\/+/g, '/');

  try {
    pathname = decodeURIComponent(pathname);
  } catch {
    // Keep as-is if malformed percent encoding
  }

  pathname = pathname
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  return `${CANONICAL_ORIGIN}${pathname || '/'}`;
};

export const getAbsoluteUrl = (path: string): string => {
  if (!path || path.trim() === '' || path.trim() === '/') {
    return `${CANONICAL_ORIGIN}/`;
  }
  
  let url = path.trim();
  
  if (url.includes('.run.app') && !url.startsWith('http')) {
    url = 'https://' + url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    url = url.replace(/[a-zA-Z0-9-.]+\.run\.app/gi, 'www.halalottawa.ca');
    
    try {
      const parsed = new URL(url);
      parsed.searchParams.delete('__aistudio_auth_token');
      parsed.searchParams.delete('return_url');
      const search = parsed.searchParams.toString() ? `?${parsed.searchParams.toString()}` : '';
      let cleanPathname = parsed.pathname || '/';
      if (cleanPathname.endsWith('/') && cleanPathname !== '/') {
        cleanPathname = cleanPathname.slice(0, -1);
      }
      return `${parsed.protocol}//${parsed.host}${cleanPathname}${search}${parsed.hash}`;
    } catch (e) {
      if (url.endsWith('/') && url !== 'https://www.halalottawa.ca/') {
        url = url.slice(0, -1);
      }
      if (url === 'https://www.halalottawa.ca') {
        return 'https://www.halalottawa.ca/';
      }
      return url;
    }
  }
  
  const baseUrl = CANONICAL_ORIGIN;
  let cleanRelative = path.startsWith('/') ? path : '/' + path;
  try {
    const dummy = new URL(`https://dummy.com${cleanRelative}`);
    dummy.searchParams.delete('__aistudio_auth_token');
    dummy.searchParams.delete('return_url');
    const search = dummy.searchParams.toString() ? `?${dummy.searchParams.toString()}` : '';
    let p = dummy.pathname || '/';
    if (p.endsWith('/') && p !== '/') {
      p = p.slice(0, -1);
    }
    return `${baseUrl}${p}${search}${dummy.hash}`;
  } catch (e) {
    let resolved = `${baseUrl}${cleanRelative}`;
    if (resolved.endsWith('/') && resolved !== 'https://www.halalottawa.ca/') {
      resolved = resolved.slice(0, -1);
    }
    return resolved;
  }
};

export const formatAddressWithoutProvinceAndPostalCode = (address: string): string => {
  if (!address) return '';
  let cleaned = address;
  
  // Replace postal code (e.g., K1P 1A4 or K1P1A4)
  cleaned = cleaned.replace(/\b[A-Za-z]\d[A-Za-z]\s*\d[A-Za-z]\d\b/g, '');
  
  // Remove ON, Ontario, QC, Quebec, Canada, etc. (case-insensitive)
  cleaned = cleaned.replace(/\b(ON|Ontario|QC|Quebec|Canada)\b/gi, '');
  
  // Clean up any double commas, trailing commas, spaces, etc.
  cleaned = cleaned
    .replace(/,\s*,/g, ',') // replace double commas
    .replace(/\s+/g, ' ')   // normalize whitespace
    .trim()
    .replace(/,\s*$/, '')   // remove trailing comma
    .replace(/^,\s*/, '')   // remove leading comma
    .trim();
    
  return cleaned;
};
