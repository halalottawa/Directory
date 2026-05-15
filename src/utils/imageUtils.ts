export const getOptimizedImageUrl = (url: string | null | undefined, width: number = 800, height?: number): string | undefined => {
  if (!url) return undefined;
  
  // Return early if it's already an optimized url, data URIs, or local paths
  if (url.includes('wsrv.nl') || url.startsWith('data:') || url.startsWith('/')) {
    return url;
  }
  
  // Skip optimization for Google profile images and SVGs
  if (url.includes('googleusercontent.com') || url.includes('gstatic.com') || url.endsWith('.svg')) {
    return url;
  }

  try {
    const encodedUrl = encodeURIComponent(url);
    let optUrl = `https://wsrv.nl/?url=${encodedUrl}&w=${width}&output=webp&q=80`;
    if (height) {
      optUrl += `&h=${height}&fit=cover`;
    }
    return optUrl;
  } catch (error) {
    return url;
  }
};
