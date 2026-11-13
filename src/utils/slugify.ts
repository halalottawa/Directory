const CHAR_TRANSLITERATIONS: Record<string, string> = {
  'ß': 'ss',
  'ẞ': 'ss',
  'æ': 'ae',
  'Æ': 'ae',
  'œ': 'oe',
  'Œ': 'oe',
  'ø': 'o',
  'Ø': 'o',
  'đ': 'd',
  'Đ': 'd',
  'ð': 'd',
  'Ð': 'd',
  'þ': 'th',
  'Þ': 'th',
  'ł': 'l',
  'Ł': 'l',
  'ı': 'i',
  'İ': 'i',
  'ğ': 'g',
  'Ğ': 'g',
  'ş': 's',
  'Ş': 's',
  'ć': 'c',
  'Ć': 'c',
  'č': 'c',
  'Č': 'c',
  'ç': 'c',
  'Ç': 'c',
  'š': 's',
  'Š': 's',
  'ž': 'z',
  'Ž': 'z',
  'ñ': 'n',
  'Ñ': 'n',
};

export const transliterateAccents = (text: string): string => {
  if (!text) return '';
  const mapped = text
    .toString()
    .replace(/[ßẞæÆœŒøØđĐðÐþÞłŁıİğĞşŞćĆčČçÇšŠžŽñÑ]/g, (ch) => CHAR_TRANSLITERATIONS[ch] || ch);
  return mapped.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
};

export const generateSlug = (text: string): string => {
  const slug = transliterateAccents(text || '')
    .toLowerCase()
    .trim()
    .replace(/['’‘ʼ`]/g, '')     // Strip apostrophes (L'Agora -> lagora, Moe's -> moes)
    .replace(/[^a-z0-9]+/g, '-')  // Replace any non-alphanumeric sequence with single hyphen
    .replace(/-+/g, '-')          // Collapse multiple hyphens
    .replace(/^-+|-+$/g, '');     // Remove leading & trailing hyphens

  return slug || Math.random().toString(36).substring(2, 10);
};

export interface ListingSlugConflict {
  conflict: boolean;
  existingId?: string;
  existingSlug?: string;
  existingName?: string;
  existingCategory?: string;
}

export const findListingSlugConflict = async (
  db: any,
  candidateSlug: string,
  excludeDocId?: string
): Promise<ListingSlugConflict> => {
  const cleanCandidate = generateSlug(candidateSlug);
  const { doc, getDoc, collection, query, where, getDocs } = await import('firebase/firestore');

  const extractCategory = (data: any): string => {
    const cat = Array.isArray(data?.category) && data.category.length > 0
      ? data.category[0]
      : (typeof data?.category === 'string' ? data.category : 'restaurants');
    return String(cat || 'restaurants').toLowerCase().trim();
  };

  // 1. Direct document ID collision check
  const directSnap = await getDoc(doc(db, 'listings', cleanCandidate));
  if (directSnap.exists() && directSnap.id !== excludeDocId) {
    const data = directSnap.data() as any;
    if (data?.deleted !== true && data?.status !== 'deleted') {
      return {
        conflict: true,
        existingId: directSnap.id,
        existingSlug: data?.slug || directSnap.id,
        existingName: data?.name || cleanCandidate,
        existingCategory: extractCategory(data),
      };
    }
  }

  // 2. Field slug collision check (catches docs stored under auto-generated IDs)
  const slugQuery = query(collection(db, 'listings'), where('slug', '==', cleanCandidate));
  const slugSnap = await getDocs(slugQuery);
  for (const d of slugSnap.docs) {
    if (d.id === excludeDocId) continue;
    const data = d.data() as any;
    if (data?.deleted === true || data?.status === 'deleted') continue;
    return {
      conflict: true,
      existingId: d.id,
      existingSlug: data?.slug || d.id,
      existingName: data?.name || cleanCandidate,
      existingCategory: extractCategory(data),
    };
  }

  return { conflict: false };
};

export const getUniqueSlug = async (db: any, collectionName: string, baseSlug: string): Promise<string> => {
  const cleanBase = generateSlug(baseSlug);
  if (collectionName === 'listings') {
    const check = await findListingSlugConflict(db, cleanBase);
    if (check.conflict) {
      throw new Error(
        `A listing with this name already exists ("${check.existingName || cleanBase}"). Duplicate "-1" slugs are blocked.`
      );
    }
    return cleanBase;
  }

  const { doc, getDoc } = await import('firebase/firestore');
  let slug = cleanBase;
  let counter = 1;
  let exists = true;
  while (exists) {
    const docRef = doc(db, collectionName, slug);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      slug = `${cleanBase}-${counter}`;
      counter++;
    } else {
      exists = false;
    }
  }
  return slug;
};
