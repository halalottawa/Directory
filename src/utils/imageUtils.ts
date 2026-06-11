import { getApiUrl } from './platform';

export const getOptimizedImageUrl = (url: string | null | undefined, width: number = 800, height?: number, quality: number = 85): string | undefined => {
  if (!url) return undefined;

  try {
    const lowerUrl = url.toLowerCase();
    // Do not optimize base64 images, SVGs, Google web UI icons, or Cloudflare R2 images
    if (lowerUrl.startsWith('data:') || lowerUrl.endsWith('.svg') || lowerUrl.includes('google.com/images/') || lowerUrl.includes('.gstatic.com/') || lowerUrl.includes('r2.dev') || lowerUrl.includes('r2.cloudflarestorage.com')) {
      return url;
    }

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

    // Route all other images through our server-side WebP and resizing optimization API
    // only if the backend is running (typically in AI Studio / Cloud Run preview `.run.app` or localhost).
    // We always optimize local uploads or relative paths as they are hosted by our own Express server.
    const isLocalOrUpload = url.startsWith('/') || lowerUrl.includes('uploads/');

    if (!isLocalOrUpload && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      const isDevOrPreview = hostname.endsWith('.run.app') || hostname === 'localhost' || hostname === '127.0.0.1';
      if (!isDevOrPreview) {
        return url;
      }
    }

    const params: string[] = [];
    if (width) params.push(`w=${width}`);
    if (height) params.push(`h=${height}`);
    if (quality) params.push(`q=${quality}`);
    
    return getApiUrl(`/api/optimize-image?url=${encodeURIComponent(url)}&${params.join('&')}`);
  } catch (e) {
    console.error('Error optimizing image URL:', e);
  }

  return url;
};
