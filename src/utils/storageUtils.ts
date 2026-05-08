import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  let processedUrl = url;
  try {
    const urlObj = new URL(url);
    if (urlObj.pathname.startsWith('/uploads/')) {
      processedUrl = urlObj.pathname;
    }
  } catch (e) {
    // Not an absolute URL, keep it as is
  }

  // If we already have the EXACT right name and it's a local upload, return early
  if (fileName && processedUrl === `/uploads/${fileName}.webp`) {
    return processedUrl;
  }
  // If we don't have a new fileName and it's already a local upload, return early
  if (!fileName && processedUrl.startsWith('/uploads/')) {
    return processedUrl;
  }

  const response = await fetch("/api/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: processedUrl, name: fileName }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to upload file from URL");
  }

  const data = await response.json();
  return data.url;
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);
  if (fileName) {
    formData.append("name", fileName);
  }

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || "Failed to upload file");
  }

  const data = await response.json();
  return data.url;
}
