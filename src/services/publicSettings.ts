import { safeLocalStorage } from '../utils/safeStorage';

export interface GeneralSettings {
  logoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
  heroImageUrl?: string;
}

export const DEFAULT_SITE_LOGO_URL =
  'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev/uploads/halal-ottawa-logo.webp';

const CACHE_KEY = 'halal_ottawa_general_settings';
const CACHE_TTL_KEY = 'halal_ottawa_general_settings_expiry';

let cachedSettingsPromise: Promise<GeneralSettings | null> | null = null;
let cachedPublicListingsPromise: Promise<any[]> | null = null;
let cachedPublicListingsExpiry = 0;

export function clearGeneralSettingsCache() {
  if (typeof window !== 'undefined') {
    safeLocalStorage.removeItem(CACHE_KEY);
    safeLocalStorage.removeItem(CACHE_TTL_KEY);
  }
  cachedSettingsPromise = null;
  cachedPublicListingsPromise = null;
  cachedPublicListingsExpiry = 0;
}

export function getInitialGeneralSettings(): GeneralSettings | null {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  const initSettings =
    win.INITIAL_DATA?.settings ||
    win.__INITIAL_DATA__?.settings ||
    win.__INITIAL_SETTINGS__;
  if (initSettings && typeof initSettings === 'object') {
    const resolvedLogo =
      initSettings.logoUrl && !initSettings.logoUrl.includes('/wp-content/')
        ? initSettings.logoUrl
        : DEFAULT_SITE_LOGO_URL;
    return {
      ...initSettings,
      logoUrl: resolvedLogo,
    } as GeneralSettings;
  }

  const now = Date.now();
  const cached = safeLocalStorage.getItem(CACHE_KEY);
  const expiry = safeLocalStorage.getItem(CACHE_TTL_KEY);
  if (cached && expiry && now < parseInt(expiry, 10)) {
    try {
      const parsed = JSON.parse(cached) as GeneralSettings;
      if (parsed && parsed.logoUrl && !parsed.logoUrl.includes('/wp-content/')) {
        return parsed;
      }
    } catch {
      // Ignore invalid cache
    }
  }
  return null;
}

export async function getGeneralSettings(forceFresh = false): Promise<GeneralSettings | null> {
  const now = Date.now();

  if (typeof window !== 'undefined' && !forceFresh) {
    const initial = getInitialGeneralSettings();
    if (initial && initial.logoUrl) {
      return initial;
    }
  }

  if (!cachedSettingsPromise || forceFresh) {
    cachedSettingsPromise = (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) {
          return { logoUrl: DEFAULT_SITE_LOGO_URL };
        }
        const data = (await res.json()) as GeneralSettings;
        const resolved: GeneralSettings = {
          ...data,
          logoUrl:
            data?.logoUrl && !data.logoUrl.includes('/wp-content/')
              ? data.logoUrl
              : DEFAULT_SITE_LOGO_URL,
        };
        if (typeof window !== 'undefined') {
          safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(resolved));
          safeLocalStorage.setItem(CACHE_TTL_KEY, (now + 3600000).toString());
        }
        return resolved;
      } catch (err) {
        console.error('Error fetching general settings:', err);
        cachedSettingsPromise = null;
        return { logoUrl: DEFAULT_SITE_LOGO_URL };
      }
    })();
  }

  return cachedSettingsPromise;
}

export async function fetchPublicListings(): Promise<any[]> {
  const now = Date.now();
  if (cachedPublicListingsPromise && now < cachedPublicListingsExpiry) {
    return cachedPublicListingsPromise;
  }
  cachedPublicListingsPromise = (async () => {
    try {
      const res = await fetch('/api/listings');
      if (!res.ok) return [];
      const data = await res.json();
      cachedPublicListingsExpiry = Date.now() + 60_000;
      return Array.isArray(data?.listings) ? data.listings : [];
    } catch (err) {
      console.error('Error fetching public listings:', err);
      cachedPublicListingsPromise = null;
      return [];
    }
  })();
  return cachedPublicListingsPromise;
}
