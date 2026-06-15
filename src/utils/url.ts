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
    return url;
  }
  
  const baseUrl = 'https://www.halalottawa.ca';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};
