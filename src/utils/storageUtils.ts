export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  // If it's already an absolute URL hosted on Cloudflare R2 or Vercel Blob, return it as-is without stripping
  if (
    url.includes('.r2.dev') ||
    url.includes('.r2.cloudflarestorage.com') ||
    url.includes('.public.blob.vercel-storage.com')
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
    const response = await fetch("/api/upload-url", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, name: fileName }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to upload file from URL");
    }

    const data = await response.json();
    return data.url;
  } catch (error) {
    console.warn("Failed to upload via proxy, using original URL", error);
    return url;
  }
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  const safeName = fileName ? fileName.replace(/[^a-z0-9]/gi, '-').toLowerCase() : file.name.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
  
  const response = await fetch(`/api/upload?filename=${safeName}`, {
    method: "POST",
    body: file,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to upload file");
  }

  const data = await response.json();
  return data.url;
}
