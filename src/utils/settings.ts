import { safeLocalStorage } from './safeStorage';

export interface GeneralSettings {
  logoUrl?: string;
  faviconUrl?: string;
  coverImageUrl?: string;
  heroImageUrl?: string;
}

const CACHE_KEY = 'halal_ottawa_general_settings';
const CACHE_TTL_KEY = 'halal_ottawa_general_settings_expiry';

let cachedSettingsPromise: Promise<GeneralSettings | null> | null = null;
let memorySettings: GeneralSettings | null = null;

export function getInitialGeneralSettings(): GeneralSettings | null {
  if (typeof globalThis !== 'undefined' && (globalThis as any).__SSR_INITIAL_DATA__?.settings) {
    return (globalThis as any).__SSR_INITIAL_DATA__.settings as GeneralSettings;
  }
  if (typeof window !== 'undefined') {
    const win = window as any;
    if (win.__INITIAL_SETTINGS__) {
      return win.__INITIAL_SETTINGS__ as GeneralSettings;
    }
    if (win.__INITIAL_DATA__?.settings) {
      return win.__INITIAL_DATA__.settings as GeneralSettings;
    }
  }
  return memorySettings;
}

export function clearGeneralSettingsCache() {
  if (typeof window !== 'undefined') {
    safeLocalStorage.removeItem(CACHE_KEY);
    safeLocalStorage.removeItem(CACHE_TTL_KEY);
    delete (window as any).__INITIAL_SETTINGS__;
  }
  cachedSettingsPromise = null;
  memorySettings = null;
}

export async function getGeneralSettings(forceFresh = false): Promise<GeneralSettings | null> {
  if (typeof window === 'undefined') {
    return getInitialGeneralSettings();
  }

  const now = Date.now();
  const initial = getInitialGeneralSettings();
  if (initial && !forceFresh) {
    memorySettings = initial;
    try {
      safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(initial));
      safeLocalStorage.setItem(CACHE_TTL_KEY, (now + 3600000).toString());
    } catch (e) {}
    return initial;
  }

  if (!forceFresh) {
    const cached = safeLocalStorage.getItem(CACHE_KEY);
    const expiry = safeLocalStorage.getItem(CACHE_TTL_KEY);
    if (cached && expiry && now < parseInt(expiry, 10)) {
      try {
        const parsed = JSON.parse(cached) as GeneralSettings;
        memorySettings = parsed;
        return parsed;
      } catch (e) {}
    }
  }

  if (!cachedSettingsPromise || forceFresh) {
    cachedSettingsPromise = (async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = (await res.json()) as GeneralSettings;
          memorySettings = data;
          safeLocalStorage.setItem(CACHE_KEY, JSON.stringify(data));
          safeLocalStorage.setItem(CACHE_TTL_KEY, (now + 3600000).toString());
          return data;
        }
        return initial || null;
      } catch (err) {
        cachedSettingsPromise = null;
        return initial || null;
      }
    })();
  }

  return cachedSettingsPromise;
}
