import { Listing } from '../types';

export const getListingUrl = (listing: Listing | any): string => {
  const cat = Array.isArray(listing.category) && listing.category.length > 0
    ? listing.category[0]
    : typeof listing.category === 'string' ? listing.category : 'listings';
  
  const formattedCategory = String(cat).toLowerCase();
  return `/${formattedCategory}/${listing.slug || listing.id}`;
};

export const getAbsoluteUrl = (path: string): string => {
  if (!path) return 'https://www.halalottawa.ca';
  
  let url = path;
  
  if (url.includes('.run.app') && !url.startsWith('http')) {
    url = 'https://' + url;
  }

  if (url.startsWith('http://') || url.startsWith('https://')) {
    url = url.replace(/ais-pre-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    url = url.replace(/ais-dev-o3grau7ukgun6nvnjrynhh-118138859761\.us-east5\.run\.app/gi, 'www.halalottawa.ca');
    url = url.replace(/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.run\.app/gi, 'www.halalottawa.ca');
    
    // Trim trailing slash for non-root paths
    if (url.endsWith('/') && url !== 'https://www.halalottawa.ca/') {
      url = url.slice(0, -1);
    }
    
    return url;
  }
  
  const baseUrl = 'https://www.halalottawa.ca';
  let resolved = `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
  if (resolved.endsWith('/') && resolved !== 'https://www.halalottawa.ca/') {
    resolved = resolved.slice(0, -1);
  }
  return resolved;
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
