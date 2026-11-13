import { getApiUrl } from './platform';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFromUrl(url: string, fileName?: string, throwOnError: boolean = false): Promise<string> {
  // If it's already an absolute URL hosted on Cloudflare R2, return it as-is without stripping
  if (
    url.includes('.r2.dev') ||
    url.includes('.r2.cloudflarestorage.com')
  ) {
    return url;
  }

  // Only strip if it is a relative path starting with /uploads/
  if (url.startsWith('/uploads/')) {
    return url;
  }

  const uploadsIdx = url.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    // If it's an absolute URL and not from our own domain group, we should probably fetch/upload it.
    // But if it starts with the active origin, we can strip it.
    if (url.startsWith('http')) {
      try {
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        if (origin && url.startsWith(origin)) {
          return url.substring(uploadsIdx);
        }
      } catch (e) {
        // Safe fallback
      }
      return url; // Keep custom cloud storage/external domains intact
    }
    return url.substring(uploadsIdx);
  }
  if (!url.startsWith('http')) return url;

  try {
    const response = await fetch(getApiUrl("/api/upload-url"), {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, name: fileName }),
    });

    if (response.redirected || response.url.includes('__cookie_check') || response.url.includes('cookie_check')) {
      console.warn("Cookie check redirect intercepted upload-url request, using original URL");
      return url;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to upload file from URL");
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    console.warn("Failed to upload via R2 proxy, using original url:", error);
    return url;
  }
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  const safeName = fileName ? fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase() : file.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();

  // Upload through backend /api/upload -> Cloudflare R2 (r2.dev)
  try {
    const response = await fetch(getApiUrl(`/api/upload?filename=${encodeURIComponent(safeName)}`), {
      method: "POST",
      credentials: "include",
      body: file,
    });

    if (response.redirected || response.url.includes('__cookie_check') || response.url.includes('cookie_check')) {
      throw new Error("Cookie check intercepted file upload query");
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Backend upload failed");
    }

    const data = await response.json();
    return data.url;
  } catch (backendErr) {
    console.warn("Backend R2 file upload failed, falling back to Firebase Storage:", backendErr);
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}-${safeName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (fbErr) {
      console.error("Firebase Storage upload also failed:", fbErr);
      throw new Error("Failed to upload image. Please try again.");
    }
  }
}
