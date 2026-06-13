import { Listing } from '../types';

export const getListingUrl = (listing: Listing | any): string => {
  const cat = Array.isArray(listing.category) && listing.category.length > 0
    ? listing.category[0]
    : typeof listing.category === 'string' ? listing.category : 'listings';
  
  const formattedCategory = String(cat).toLowerCase();
  return `/${formattedCategory}/${listing.slug || listing.id}`;
};

export const getAbsoluteUrl = (path: string): string => {
  let url = path;
  if (url.startsWith('http')) {
    if (url.includes('ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app')) {
      url = url.replace('ais-pre-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app', 'www.halalottawa.ca');
    } else if (url.includes('ais-dev-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app')) {
      url = url.replace('ais-dev-o3grau7ukgun6nvnjrynhh-118138859761.us-east5.run.app', 'www.halalottawa.ca');
    } else if (url.includes('.run.app')) {
      url = url.replace(/[a-zA-Z0-9-]+\.[a-zA-Z0-9-]+\.run\.app/g, 'www.halalottawa.ca');
    }
    return url;
  }
  const baseUrl = 'https://www.halalottawa.ca';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};
