import { getApiUrl } from './platform';

export const getOptimizedImageUrl = (url: string | null | undefined, width: number = 800, height?: number, quality: number = 85): string | undefined => {
  if (!url) return undefined;

  try {
    const lowerUrl = url.toLowerCase();

    // 1. Bypass optimization for data URLs, SVGs, Google static branding assets, or Cloudflare R2 direct storage URLs
    if (
      lowerUrl.startsWith('data:') || 
      lowerUrl.endsWith('.svg') || 
      lowerUrl.includes('google.com/images/') || 
      lowerUrl.includes('.gstatic.com/') ||
      lowerUrl.includes('r2.dev') ||
      lowerUrl.includes('r2.cloudflarestorage.com')
    ) {
      return url;
    }

    // 2. Optimize Google User Content / Google Photos URLs natively using their CDN sizing parameters
    if (url.includes('googleusercontent.com') || url.includes('ggpht.com')) {
      // Remove existing sizing parameters if present (e.g., =w1200-h630-p-k-no-nu or =s96-c)
      let baseUrl = url;
      const lastSlashIndex = url.lastIndexOf('/');
      const equalsIndex = url.indexOf('=', lastSlashIndex);
      if (equalsIndex !== -1) {
        baseUrl = url.substring(0, equalsIndex);
      }
      
      const params = [];
      if (width) params.push(`w${width}`);
      if (height) params.push(`h${height}`);
      params.push('c'); // smart crop if both w and h are provided
      
      return `${baseUrl}=${params.join('-')}`;
    }

    // 3. Optimize Unsplash URLs natively using their Imgix parameters
    if (url.includes('images.unsplash.com')) {
      try {
        const urlObj = new URL(url);
        urlObj.searchParams.set('w', width.toString());
        if (height) {
          urlObj.searchParams.set('h', height.toString());
        }
        urlObj.searchParams.set('q', quality.toString());
        urlObj.searchParams.set('fit', 'crop');
        urlObj.searchParams.set('auto', 'format');
        return urlObj.toString();
      } catch (e) {
        return url;
      }
    }

    // 4. Optimize Cloudinary URLs natively
    if (url.includes('res.cloudinary.com')) {
      const uploadParts = url.split('/upload/');
      if (uploadParts.length === 2) {
        const transforms = [`w_${width}`, `q_${quality}`, 'f_auto', 'c_fill'];
        if (height) transforms.push(`h_${height}`);
        return `${uploadParts[0]}/upload/${transforms.join(',')}/${uploadParts[1]}`;
      }
    }

    // 5. Fallback to our server-side Sharp optimization endpoint for local uploads and external URLs
    const params = new URLSearchParams();
    params.set('url', url);
    params.set('w', width.toString());
    if (height) {
      params.set('h', height.toString());
    }
    params.set('q', quality.toString());

    return getApiUrl(`/api/optimize-image?${params.toString()}`);
  } catch (err) {
    console.warn('Failed to generate optimized image URL, falling back to original:', err);
    return url;
  }
};
