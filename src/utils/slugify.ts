export const generateSlug = (text: string) => {
  const slug = text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')        // Replace spaces with -
    .replace(/[^\w\-]+/g, '')   // Remove all non-word chars
    .replace(/\-\-+/g, '-');      // Replace multiple - with single -
    
  return slug || Math.random().toString(36).substring(2, 10);
};

export const getUniqueSlug = async (db: any, collectionName: string, baseSlug: string) => {
  const { doc, getDoc } = await import('firebase/firestore');
  let slug = baseSlug;
  let counter = 1;
  let exists = true;
  while (exists) {
    const docRef = doc(db, collectionName, slug);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      slug = `${baseSlug}-${counter}`;
      counter++;
    } else {
      exists = false;
    }
  }
  return slug;
};
