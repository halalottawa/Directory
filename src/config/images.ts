// Centralized image configuration for Halal Ottawa
// Can be overridden via VITE_IMAGE_CDN_HOST (client) or IMAGE_CDN_HOST (server)
// Image transformation mode controlled via VITE_IMAGE_TRANSFORM ("cloudflare" enables /cdn-cgi/image/...)
export const DEFAULT_IMAGE_HOST = 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev';

export const HERO_IMAGE_WIDTHS: number[] = [480, 828, 1200, 1600];
export const HERO_IMAGE_SIZES = '100vw';
export const CARD_IMAGE_WIDTHS: number[] = [320, 480, 640];
export const CARD_IMAGE_SIZES = '(max-width: 767px) 240px, (max-width: 1023px) 50vw, 25vw';

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

export const getImageTransform = (): string => {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_IMAGE_TRANSFORM) {
      return process.env.VITE_IMAGE_TRANSFORM.trim().toLowerCase();
    }
    if (process.env.IMAGE_TRANSFORM) {
      return process.env.IMAGE_TRANSFORM.trim().toLowerCase();
    }
  }
  try {
    const meta = import.meta as any;
    if (meta && meta.env && meta.env.VITE_IMAGE_TRANSFORM) {
      return String(meta.env.VITE_IMAGE_TRANSFORM).trim().toLowerCase();
    }
  } catch (e) {}
  return '';
};

export const GLOBAL_HERO_IMAGE_PATH = '/uploads/global-hero-1781326553984.webp';

/**
 * Returns the original untransformed URL for fallback on image error.
 */
export const getUntransformedImageUrl = (pathOrUrl: string | null | undefined): string => {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  const host = getImageHost();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(
      /^https?:\/\/(?:pub-344de773fe4147898d363b9fffa2e2e4\.r2\.dev|halal-ottawa-images\.r2\.cloudflarestorage\.com)/i,
      host
    );
  }

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath.startsWith('/uploads/')) {
    return `${host}${cleanPath}`;
  }

  if (cleanPath === '/ottawa-sunset.webp') {
    return `${host}${GLOBAL_HERO_IMAGE_PATH}`;
  }

  return cleanPath;
};

export const getRawImageUrl = (pathOrUrl: string | null | undefined): string => {
  return getUntransformedImageUrl(pathOrUrl);
};

/**
 * Single image URL helper that takes (path, width).
 * - When VITE_IMAGE_TRANSFORM === "cloudflare":
 *   returns {IMAGE_HOST}/cdn-cgi/image/width={width},quality=70,format=auto/{path}
 * - Otherwise:
 *   returns the exact untransformed/existing URL behavior.
 */
export const getImageUrl = (pathOrUrl: string | null | undefined, width: number = 800): string => {
  if (!pathOrUrl) return '';
  const trimmed = pathOrUrl.trim();
  if (!trimmed) return '';

  const host = getImageHost();
  const transformMode = getImageTransform();

  if (transformMode === 'cloudflare') {
    let relativePath = '';
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const normalized = trimmed.replace(
        /^https?:\/\/(?:pub-344de773fe4147898d363b9fffa2e2e4\.r2\.dev|halal-ottawa-images\.r2\.cloudflarestorage\.com)/i,
        host
      );
      if (normalized.startsWith(host)) {
        relativePath = normalized.slice(host.length).replace(/^\/+/, '');
      } else {
        return normalized;
      }
    } else {
      const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
      if (cleanPath === '/ottawa-sunset.webp') {
        relativePath = GLOBAL_HERO_IMAGE_PATH.replace(/^\/+/, '');
      } else {
        relativePath = cleanPath.replace(/^\/+/, '');
      }
    }

    return `${host}/cdn-cgi/image/width=${width},quality=70,format=auto/${relativePath}`;
  }

  // Default behavior when VITE_IMAGE_TRANSFORM is NOT "cloudflare"
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

  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  if (cleanPath.startsWith('/uploads/')) {
    const fullUrl = `${host}${cleanPath}`;
    if (host.includes('img.halalottawa.ca')) {
      return `${fullUrl}?width=${width}&quality=70`;
    }
    return fullUrl;
  }

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
 * Generates srcset string for responsive images (e.g. 480w, 828w, 1200w, 1600w)
 */
export const getImageSrcSet = (
  pathOrUrl: string | null | undefined,
  widths: number[] = HERO_IMAGE_WIDTHS
): string => {
  if (!pathOrUrl) return '';
  return widths.map(w => `${getImageUrl(pathOrUrl, w)} ${w}w`).join(', ');
};
