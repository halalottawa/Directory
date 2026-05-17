export const getOptimizedImageUrl = (url: string | null | undefined, width: number = 800, height?: number, quality: number = 85): string | undefined => {
  if (!url) return undefined;

  try {
    // Google User Content (Google My Business, Google Photos, etc.)
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
      // Remove any existing sizing parameters (e.g., =wxxx-hxxx, =sxxx)
      let baseUrl = url.split('=')[0];
      
      // Add new sizing parameters
      const params = [];
      if (width) params.push(`w${width}`);
      if (height) params.push(`h${height}`);
      params.push('c'); // Crop to fill dimensions
      
      return `${baseUrl}=${params.join('-')}`;
    }

    // Unsplash
    if (url.includes('images.unsplash.com')) {
      const urlObj = new URL(url);
      urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', quality.toString());
      urlObj.searchParams.set('fit', 'crop');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    }

    // Cloudinary
    if (url.includes('res.cloudinary.com')) {
      const parts = url.split('/upload/');
      if (parts.length === 2) {
        const transform = `w_${width}${height ? `,h_${height}` : ''},c_fill,q_${quality},f_auto`;
        return `${parts[0]}/upload/${transform}/${parts[1]}`;
      }
    }
  } catch (e) {
    console.error('Error optimizing image URL:', e);
  }

  return url;
};
