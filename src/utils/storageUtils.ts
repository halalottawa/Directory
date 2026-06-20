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

  // If we are on production canonical domain, bypass backend proxy and return url as-is to avoid cookie-check firewall
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProd = hostname === 'www.halalottawa.ca' || hostname === 'halalottawa.ca';
  if (isProd) {
    return url;
  }

  try {
    const response = await fetch(getApiUrl("/api/upload-url"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, name: fileName }),
    });

    if (response.redirected || response.url.includes('__cookie_check') || response.url.includes('cookie_check')) {
      console.warn("AI Studio cookie check redirect intercepted upload-url request, using original URL");
      return url;
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to upload file from URL");
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.warn("Failed to upload via proxy, using original url:", error);
    return url; 
  }
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  const safeName = fileName ? fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase() : file.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  
  const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
  const isProd = hostname === 'www.halalottawa.ca' || hostname === 'halalottawa.ca';

  // On production, upload directly client-side to Firebase Storage to bypass Cloud Run container entirely
  if (isProd) {
    try {
      const storageRef = ref(storage, `${path}/${Date.now()}-${safeName}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);
      return downloadUrl;
    } catch (err) {
      console.error("Direct Firebase Storage upload from prod failed, falling back:", err);
    }
  }

  // Fallback / standard development route
  try {
    const response = await fetch(getApiUrl(`/api/upload?filename=${safeName}`), {
      method: "POST",
      body: file,
    });

    if (response.redirected || response.url.includes('__cookie_check') || response.url.includes('cookie_check')) {
      throw new Error("AI Studio cookie check intercepted file upload query");
    }

    if (!response.ok) {
      throw new Error("Backend responds with failure state");
    }

    const data = await response.json();
    return data.url;
  } catch (backendErr) {
    console.warn("Backend file upload failed, fallback direct to Firebase Storage", backendErr);
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
