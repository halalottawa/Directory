import { CATEGORIES, LISTING_TYPES, CUISINES } from '../constants';
import { normalizeSubcategorySlug } from './url';

export const AREA_SLUGS = ['orleans', 'kanata', 'barrhaven', 'downtown'] as const;

export type CategoryPageKind = 'all' | 'main' | 'area' | 'cuisine' | 'food_style' | 'unknown';

export interface CategoryPageMeta {
  canonicalPath: string;
  formattedCategory: string;
  kind: CategoryPageKind;
  isValid: boolean;
  isUnderRestaurants: boolean;
  isLocationCategory: boolean;
  h1: string;
  title: string;
  description: string;
}

export interface EditableCategoryPageItem {
  path: string;
  label: string;
  group: 'Main Categories' | 'Areas & Neighbourhoods' | 'Cuisines' | 'Food Styles';
}

export function normalizeCategoryCompare(val: string): string {
  return String(val || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/&/g, '')
    .replace(/\s+/g, ' ');
}

export function countWords(text: string): number {
  const trimmed = String(text || '').trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

export function getCategoryPageMeta(rawPath: string): CategoryPageMeta {
  let cleanPath = String(rawPath || '/').trim().split('?')[0].split('#')[0];
  try {
    cleanPath = decodeURIComponent(cleanPath);
  } catch {
    // Keep as-is if malformed
  }
  if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath;
  if (cleanPath.length > 1 && cleanPath.endsWith('/')) {
    cleanPath = cleanPath.slice(0, -1);
  }

  const parts = cleanPath.split('/').filter(Boolean);
  const p0 = (parts[0] || '').toLowerCase();
  const isUnderRestaurants = p0 === 'restaurants';

  if (parts.length === 1 && p0 === 'listings') {
    const h1 = 'Browse Halal Directories in Ottawa';
    return {
      canonicalPath: '/listings',
      formattedCategory: 'Listings',
      kind: 'all',
      isValid: true,
      isUnderRestaurants: false,
      isLocationCategory: false,
      h1,
      title: `${h1} | Halal Ottawa`,
      description: 'Browse our community directory of verified halal businesses, restaurants, mosques, grocery stores, and Islamic schools in Ottawa.',
    };
  }

  const rawSegment = parts.length === 1 ? parts[0] : parts.length === 2 && isUnderRestaurants ? parts[1] : '';
  const cleanSpaceSlug = normalizeCategoryCompare(rawSegment.replace(/-/g, ' '));
  const slugCandidate = normalizeSubcategorySlug(rawSegment);

  const matchedMainCategory = CATEGORIES.find(
    (c) => normalizeCategoryCompare(c) === cleanSpaceSlug || normalizeSubcategorySlug(c) === slugCandidate
  );

  if (parts.length === 1 && matchedMainCategory) {
    const canonicalPath = `/${normalizeSubcategorySlug(matchedMainCategory)}`;
    let h1 = `Halal ${matchedMainCategory} in Ottawa`;
    let description = `Explore verified halal ${matchedMainCategory.toLowerCase()} in Ottawa. Find addresses, hours, contact info, and community reviews.`;

    if (matchedMainCategory === 'Restaurants') {
      h1 = 'Halal Restaurants in Ottawa';
      description = 'Discover verified halal restaurants and food spots in Ottawa. Browse by cuisine or neighbourhood, read reviews, and get directions.';
    } else if (matchedMainCategory === 'Mosques') {
      h1 = 'Mosques in Ottawa';
      description = 'Locate local mosques, musallahs, and Islamic prayer spaces around Ottawa. Find addresses, prayer space details, and contact info.';
    } else if (matchedMainCategory === 'Grocery') {
      h1 = 'Halal Grocery in Ottawa';
      description = 'Find halal grocery stores, supermarkets, and specialty food shops in Ottawa offering certified halal products and ingredients.';
    } else if (matchedMainCategory === 'Clothing') {
      h1 = 'Islamic Clothing in Ottawa';
      description = 'Explore Islamic clothing stores and boutiques in Ottawa offering modest wear, hijabs, abayas, and thobes.';
    } else if (matchedMainCategory === 'Schools') {
      h1 = 'Islamic Schools in Ottawa';
      description = 'Browse Islamic schools, preschools, daycares, and weekend Quran educational programs in Ottawa.';
    } else if (matchedMainCategory === 'Butchers') {
      h1 = 'Halal Butchers in Ottawa';
      description = 'Find certified halal butcher shops and fresh meat markets in Ottawa providing hand-slaughtered zabihah meat.';
    } else if (matchedMainCategory === 'Organizations') {
      h1 = 'Muslim Organizations in Ottawa';
      description = 'Connect with Islamic organizations, community support networks, and local charities in Ottawa.';
    }

    return {
      canonicalPath,
      formattedCategory: matchedMainCategory,
      kind: 'main',
      isValid: true,
      isUnderRestaurants: canonicalPath === '/restaurants',
      isLocationCategory: false,
      h1,
      title: `${h1} | Halal Ottawa`,
      description,
    };
  }

  if (parts.length === 2 && isUnderRestaurants) {
    let normalizedSubSlug = slugCandidate;
    if (normalizedSubSlug === 'cafe') normalizedSubSlug = 'cafes';
    if (normalizedSubSlug === 'afghan') normalizedSubSlug = 'afghani';

    const areaMap: Record<string, string> = {
      orleans: 'Orleans',
      kanata: 'Kanata',
      barrhaven: 'Barrhaven',
      downtown: 'Downtown',
    };

    if (areaMap[normalizedSubSlug]) {
      const areaLabel = areaMap[normalizedSubSlug];
      const h1 =
        normalizedSubSlug === 'downtown'
          ? 'Halal Restaurants in Downtown Ottawa'
          : `Halal Restaurants in ${areaLabel}`;
      const title =
        normalizedSubSlug === 'downtown'
          ? 'Halal Restaurants in Downtown Ottawa | Halal Ottawa'
          : `Halal Restaurants in ${areaLabel}, Ottawa | Halal Ottawa`;
      return {
        canonicalPath: `/restaurants/${normalizedSubSlug}`,
        formattedCategory: areaLabel,
        kind: 'area',
        isValid: true,
        isUnderRestaurants: true,
        isLocationCategory: true,
        h1,
        title,
        description: `Find verified halal restaurants and food spots in ${areaLabel}, Ottawa. Browse by cuisine or food style, read reviews, and get directions.`,
      };
    }

    const matchedCuisine = CUISINES.find(
      (c) => normalizeSubcategorySlug(c) === normalizedSubSlug || normalizeCategoryCompare(c) === cleanSpaceSlug
    );
    if (matchedCuisine) {
      const h1 = `Halal ${matchedCuisine} Restaurants in Ottawa`;
      return {
        canonicalPath: `/restaurants/${normalizeSubcategorySlug(matchedCuisine)}`,
        formattedCategory: matchedCuisine,
        kind: 'cuisine',
        isValid: true,
        isUnderRestaurants: true,
        isLocationCategory: false,
        h1,
        title: `${h1} | Halal Ottawa`,
        description: `Discover verified halal ${matchedCuisine} restaurants and food spots in Ottawa. Browse hours, addresses, menus, and community reviews.`,
      };
    }

    const matchedType = LISTING_TYPES.find((t) => {
      const typeSlug = normalizeSubcategorySlug(t);
      const typeNorm = normalizeCategoryCompare(t);
      return (
        typeSlug === normalizedSubSlug ||
        typeNorm === cleanSpaceSlug ||
        (cleanSpaceSlug === 'sandwiches' && typeNorm === 'sandwiches subs') ||
        (cleanSpaceSlug === 'smoothies' && typeNorm === 'juice smoothies')
      );
    });
    if (matchedType) {
      const h1 = `Halal ${matchedType} in Ottawa`;
      return {
        canonicalPath: `/restaurants/${normalizeSubcategorySlug(matchedType)}`,
        formattedCategory: matchedType,
        kind: 'food_style',
        isValid: true,
        isUnderRestaurants: true,
        isLocationCategory: false,
        h1,
        title: `${h1} | Halal Ottawa`,
        description: `Discover verified halal ${matchedType.toLowerCase()} spots in Ottawa. Find locations, operating hours, phone numbers, and reviews.`,
      };
    }
  }

  const fallbackFormatted = rawSegment
    ? rawSegment
        .replace(/-/g, ' ')
        .replace(/\b\w/g, (ch) => ch.toUpperCase())
    : 'Directory';
  return {
    canonicalPath: cleanPath,
    formattedCategory: fallbackFormatted,
    kind: 'unknown',
    isValid: false,
    isUnderRestaurants,
    isLocationCategory: false,
    h1: `Halal ${fallbackFormatted} in Ottawa`,
    title: `Halal ${fallbackFormatted} in Ottawa | Halal Ottawa`,
    description: `Explore verified halal ${fallbackFormatted.toLowerCase()} in Ottawa on Halal Ottawa.`,
  };
}

export function getAllEditableCategoryPages(): EditableCategoryPageItem[] {
  const items: EditableCategoryPageItem[] = [];

  for (const cat of CATEGORIES) {
    items.push({
      path: `/${normalizeSubcategorySlug(cat)}`,
      label: cat,
      group: 'Main Categories',
    });
  }

  const areaLabels: Record<(typeof AREA_SLUGS)[number], string> = {
    orleans: 'Orléans',
    kanata: 'Kanata',
    barrhaven: 'Barrhaven',
    downtown: 'Downtown Ottawa',
  };
  for (const slug of AREA_SLUGS) {
    items.push({
      path: `/restaurants/${slug}`,
      label: areaLabels[slug],
      group: 'Areas & Neighbourhoods',
    });
  }

  for (const cuisine of CUISINES) {
    items.push({
      path: `/restaurants/${normalizeSubcategorySlug(cuisine)}`,
      label: cuisine,
      group: 'Cuisines',
    });
  }

  for (const type of LISTING_TYPES) {
    items.push({
      path: `/restaurants/${normalizeSubcategorySlug(type)}`,
      label: type,
      group: 'Food Styles',
    });
  }

  return items;
}
