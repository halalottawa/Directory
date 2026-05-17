import React from 'react';

interface ListingTagsProps {
  category: string | string[];
  types?: string[];
  cuisine?: string[];
  className?: string;
}

export const getListingTagsString = (listing: any) => {
  const cats = Array.isArray(listing.category) ? listing.category : [listing.category].filter(Boolean);
  const mainCategory = cats[0];
  const otherCategories = cats.slice(1);
  const subcategories: string[] = [];
  if (cats.includes('Restaurants')) {
    if (listing.types) subcategories.push(...listing.types);
    if (listing.cuisine) subcategories.push(...listing.cuisine);
  }
  subcategories.push(...otherCategories);
  const tags = [mainCategory, ...subcategories.slice(0, 2)].filter(Boolean);
  return tags.join(', ');
};

export const ListingTags: React.FC<ListingTagsProps> = ({ category, types, cuisine, className = "" }) => {
  const allCategories = Array.isArray(category) ? category : [category].filter(Boolean);
  const mainCategory = allCategories[0];
  const otherCategories = allCategories.slice(1);
  
  const subcategories: string[] = [];
  if (allCategories.includes('Restaurants')) {
    if (types) subcategories.push(...types);
    if (cuisine) subcategories.push(...cuisine);
  }
  subcategories.push(...otherCategories);
  
  const displaySubcategories = subcategories.slice(0, 2);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {mainCategory && (
        <span className={displaySubcategories.length === 0 ? "bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase" : "bg-[#e90b35] text-white border border-[#e90b35] px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase shadow-sm"}>
          {mainCategory}
        </span>
      )}
      {displaySubcategories.map((sub, index) => (
        <span key={`sub-${index}`} className="bg-red-50 text-[#e90b35] border border-red-100 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-wide uppercase">
          {sub}
        </span>
      ))}
    </div>
  );
};
