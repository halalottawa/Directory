// Centralized image configuration for Halal Ottawa
// Can be overridden via VITE_IMAGE_CDN_HOST (client) or IMAGE_CDN_HOST (server)
export const DEFAULT_IMAGE_HOST = 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev';

export const HERO_IMAGE_WIDTHS: number[] = [640, 1024, 1600];
export const CARD_IMAGE_WIDTHS: number[] = [320, 480, 640];

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

export const getRawImageUrl = (pathOrUrl: string | null | undefined): string => {
  return getImageUrl(pathOrUrl, 1200);
};

/**
 * Single image URL helper that takes (path, width) and returns a resized WebP/AVIF URL
 * from the configured image host (Cloudflare R2 / CDN).
 */
export const getImageUrl = (pathOrUrl: string | null | undefined, width: number = 800): string => {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  const host = getImageHost();

  // If it's already an absolute R2 URL, normalize to configured host
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    const normalized = trimmed.replace(
      /^https?:\/\/(?:pub-344de773fe4147898d363b9fffa2e2e4\.r2\.dev|halal-ottawa-images\.r2\.cloudflarestorage\.com)/i,
      host
    );
    if (host.includes('img.halalottawa.ca') && normalized.startsWith(host)) {
      const separator = normalized.includes('?') ? '&' : '?';
      return `${normalized}${separator}width=${width}&quality=70`;
    }
    return normalized;
  }

  // Relative path (e.g. /uploads/...)
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath.startsWith('/uploads/')) {
    const fullUrl = `${host}${cleanPath}`;
    if (host.includes('img.halalottawa.ca')) {
      return `${fullUrl}?width=${width}&quality=70`;
    }
    return fullUrl;
  }

  // Fallback for local public assets like /ottawa-sunset.webp -> route to R2 global hero
  if (cleanPath === '/ottawa-sunset.webp') {
    const fullUrl = `${host}${GLOBAL_HERO_IMAGE_PATH}`;
    if (host.includes('img.halalottawa.ca')) {
      return `${fullUrl}?width=${width}&quality=70`;
    }
    return fullUrl;
  }

  return cleanPath;
};

/**
 * Generates srcset string for responsive images (e.g. 640w, 1024w, 1600w)
 */
export const getImageSrcSet = (
  pathOrUrl: string | null | undefined,
  widths: number[] = [640, 1024, 1600]
): string => {
  if (!pathOrUrl) return '';
  return widths.map(w => `${getImageUrl(pathOrUrl, w)} ${w}w`).join(', ');
};
