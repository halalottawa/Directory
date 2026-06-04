export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  const uploadsIdx = url.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
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
