import { getApiUrl } from './platform';

export function notifyContentChanged(reason: string): void {
  if (typeof window === 'undefined') return;
  try {
    fetch(getApiUrl('/api/revalidate'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Ignore network errors on background revalidation ping
  }
}
