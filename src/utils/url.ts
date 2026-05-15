import { Listing } from '../types';

export const getListingUrl = (listing: Listing | any): string => {
  const cat = Array.isArray(listing.category) && listing.category.length > 0
    ? listing.category[0]
    : typeof listing.category === 'string' ? listing.category : 'listings';
  
  const formattedCategory = String(cat).toLowerCase();
  return `/${formattedCategory}/${listing.slug || listing.id}`;
};

export const getAbsoluteUrl = (path: string): string => {
  if (path.startsWith('http')) return path;
  const baseUrl = 'https://www.halalottawa.ca';
  return `${baseUrl}${path.startsWith('/') ? '' : '/'}${path}`;
};
