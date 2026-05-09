import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFromUrl(url: string, fileName?: string): Promise<string> {
  // If the user pasted a link, just return the link directly!
  // No need to download and re-upload it to Firebase Storage.
  return url;
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
    
    // Add a timeout to prevent infinite hanging if bucket isn't provisioned
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Upload timed out. Please ensure Firebase Storage is enabled in your Firebase console.")), 15000);
    });

    await Promise.race([
      uploadBytes(storageRef, file),
      timeoutPromise
    ]);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    console.error("Firebase upload failed", error);
    
    // Try local default server as fallback (works in local dev / AI Studio preview)
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

      if (response.ok) {
        // Ensure it's returning JSON and not the React index.html on Vercel
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const data = await response.json();
          if (data.url) return data.url;
        }
      }
    } catch (fallbackError) {
      console.error("Fallback upload also failed", fallbackError);
    }
    
    throw new Error(error.message || "Failed to upload file");
  }
}
