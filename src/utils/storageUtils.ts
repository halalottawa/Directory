import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  if (url.startsWith('/uploads/')) return url;

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
