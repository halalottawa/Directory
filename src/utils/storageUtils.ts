import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
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
    return window.location.origin + processedUrl;
  }
  // If we don't have a new fileName and it's already a local upload, return early
  if (!fileName && processedUrl.startsWith('/uploads/')) {
    return window.location.origin + processedUrl;
  }

  const response = await fetch("/api/upload-url", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: processedUrl, name: fileName }),
  });

  if (!response.ok) {
    throw new Error("Failed to upload image from URL");
  }

  const data = await response.json();
  return data.url.startsWith("http") ? data.url : window.location.origin + data.url;
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  // Try to use our local API first
  try {
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
      throw new Error("Local upload failed");
    }

    const data = await response.json();
    return data.url.startsWith("http") ? data.url : window.location.origin + data.url;
  } catch (err) {
    console.warn("Local upload failed, falling back to Firebase Storage", err);
    // Fallback to Firebase Storage
    if (!storage) {
      throw new Error('Firebase Storage is not configured');
    }
    
    // Ensure path ends with /
    const storagePath = path.endsWith('/') ? path : `${path}/`;
    
    // Use the custom filename if provided, else keep original
    let finalFileName = file.name;
    if (fileName) {
      // Keep the original extension
      const ext = file.name.split('.').pop() || '';
      finalFileName = `${fileName}${ext ? `.${ext}` : ''}`;
    }
    
    const storageRef = ref(storage, `${storagePath}${finalFileName}`);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  }
}
