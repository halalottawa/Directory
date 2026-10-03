// Centralized image configuration for Halal Ottawa
// Can be overridden via VITE_IMAGE_CDN_HOST (client) or IMAGE_CDN_HOST (server)
export const DEFAULT_IMAGE_HOST = 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev';

export const getImageHost = (): string => {
  if (typeof process !== 'undefined' && process.env && process.env.IMAGE_CDN_HOST) {
    return process.env.IMAGE_CDN_HOST.replace(/\/+$/, '');
  }
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env.VITE_IMAGE_CDN_HOST) {
      return (meta.env.VITE_IMAGE_CDN_HOST as string).replace(/\/+$/, '');
    }
  } catch (e) {}
  return DEFAULT_IMAGE_HOST;
};

export const GLOBAL_HERO_IMAGE_PATH = '/uploads/global-hero-1781326553984.webp';

/**
 * Single image URL helper that takes (path, width) and returns the URL.
 * When switching to a custom domain like img.halalottawa.ca with Cloudflare image resizing,
 * resizing query parameters or path transforms can be modified here in one place.
 */
export const getImageUrl = (pathOrUrl: string | null | undefined, width?: number): string => {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  const host = getImageHost();

  // If already absolute URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // If it points to the default R2 bucket or current host, allow host rewriting
    let normalized = trimmed.replace(
      /^https?:\/\/(?:pub-344de773fe4147898d363b9fffa2e2e4\.r2\.dev|halal-ottawa-images\.r2\.cloudflarestorage\.com)/i,
      host
    );

    if (width && host.includes('img.halalottawa.ca')) {
      try {
        const u = new URL(normalized);
        u.searchParams.set('w', String(width));
        return u.toString();
      } catch (e) {
        return `${normalized}${normalized.includes('?') ? '&' : '?'}w=${width}`;
      }
    }
    return normalized;
  }

  // Relative path (like /uploads/...)
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath.startsWith('/uploads/')) {
    const fullUrl = `${host}${cleanPath}`;
    if (width && host.includes('img.halalottawa.ca')) {
      return `${fullUrl}?w=${width}`;
    }
    return fullUrl;
  }

  return cleanPath;
};

/**
 * Generates srcset string with ~640, 1024, 1600 variants for any image path.
 */
export const getImageSrcSet = (pathOrUrl: string | null | undefined, widths: number[] = [640, 1024, 1600]): string => {
  if (!pathOrUrl) return '';
  return widths.map(w => `${getImageUrl(pathOrUrl, w)} ${w}w`).join(', ');
};
