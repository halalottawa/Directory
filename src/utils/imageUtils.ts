import { getApiUrl } from './platform';

export const getOptimizedImageUrl = (url: string | null | undefined, width: number = 800, height?: number, quality: number = 85): string | undefined => {
  if (!url) return undefined;

  try {
    const lowerUrl = url.toLowerCase();
    // Do not optimize base64 images or SVGs
    if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg')) {
      return url;
    }

    // Google web UI icons
    if (lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/')) {
      return url;
    }

    // Normalize Cloudflare R2 URLs to local /uploads/ so they are served same-origin
    let targetUrl = url;
    const uploadIdx = url.indexOf('/uploads/');
    if (uploadIdx !== -1) {
      targetUrl = url.substring(uploadIdx);
    }

    // Google User Content (Google My Business, Google Photos, etc.)
    if (targetUrl.includes('googleusercontent.com') || targetUrl.includes('ggpht.com')) {
      // Remove any existing sizing parameters (e.g., =wxxx-hxxx, =sxxx)
      let baseUrl = targetUrl.split('=')[0];
      
      // Add new sizing parameters
      const params = [];
      if (width) params.push(`w${width}`);
      if (height) params.push(`h${height}`);
      params.push('c'); // Crop to fill dimensions
      
      return `${baseUrl}=${params.join('-')}`;
    }

    // Unsplash
    if (targetUrl.includes('images.unsplash.com')) {
      const urlObj = new URL(targetUrl);
      urlObj.searchParams.set('w', width.toString());
      if (height) urlObj.searchParams.set('h', height.toString());
      urlObj.searchParams.set('q', quality.toString());
      urlObj.searchParams.set('fit', 'crop');
      urlObj.searchParams.set('auto', 'format');
      return urlObj.toString();
    }

    // Cloudinary
    if (targetUrl.includes('res.cloudinary.com')) {
      const parts = targetUrl.split('/upload/');
      if (parts.length === 2) {
        const transform = `w_${width}${height ? `,h_${height}` : ''},c_fill,q_${quality},f_auto`;
        return `${parts[0]}/upload/${transform}/${parts[1]}`;
      }
    }

    // Route all local uploads and images through our server-side WebP optimization API
    const params: string[] = [];
    if (width) params.push(`w=${width}`);
    if (height) params.push(`h=${height}`);
    if (quality) params.push(`q=${quality}`);
    
    return getApiUrl(`/api/optimize-image?url=${encodeURIComponent(targetUrl)}&${params.join('&')}`);
  } catch (e) {
    console.error('Error optimizing image URL:', e);
  }

  return url;
};
