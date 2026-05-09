import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  if (url.startsWith('https://firebasestorage.googleapis.com')) return url;
  if (url.startsWith('/uploads/')) return url; // Might be old local data

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const blob = await response.blob();
    
    const cleanName = fileName ? fileName.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const finalFilename = `${cleanName}-${randomSuffix}`;
    
    // Attempt to guess extension from URL or blob type
    const extMatch = url.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    let ext = extMatch ? extMatch[1] : '';
    if (!ext) {
      ext = blob.type.split('/')[1] || 'jpg';
    }
    
    const storageRef = ref(storage, `uploads/${finalFilename}.${ext}`);
    await uploadBytes(storageRef, blob);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error("Client side fetch failed, falling back to server proxy", error);
    // Fallback to server if client-side fetch fails due to CORS
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
}

export async function uploadFile(file: File, path: string, fileName?: string): Promise<string> {
  try {
    const cleanName = fileName ? fileName.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    // Some basic sanitize to grab the extension
    const nameParts = file.name.split('.');
    const ext = nameParts.length > 1 ? nameParts.pop() : 'webp';
    const finalFilename = `${cleanName}-${randomSuffix}.${ext}`;
    
    const storageRef = ref(storage, `${path}/${finalFilename}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    console.error("Firebase upload failed", error);
    throw new Error(error.message || "Failed to upload file");
  }
}
