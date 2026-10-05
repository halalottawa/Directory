import { getApiUrl } from './platform';

export interface RevalidateOptions {
  collection?: 'listings' | 'news';
  docId?: string;
  isApproved?: boolean;
}

export async function notifyContentChanged(
  reason: string,
  options: RevalidateOptions = {}
): Promise<void> {
  if (typeof window === 'undefined') return;
  if (options.isApproved === false) return;

  try {
    const { getAuthInstance } = await import('../firebase');
    const currentUser = getAuthInstance().currentUser;
    if (!currentUser) return;
    const idToken = await currentUser.getIdToken();
    if (!idToken) return;

    await fetch(getApiUrl('/api/revalidate'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        reason,
        collection: options.collection,
        docId: options.docId,
        isApproved: options.isApproved ?? true,
      }),
      keepalive: true,
    });
  } catch {
    // Ignore network errors on background revalidation ping
  }
}
