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
    
    // Add a short timeout to prevent hanging if bucket isn't provisioned
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("unprovisioned")), 2500);
    });

    await Promise.race([
      uploadBytes(storageRef, file),
      timeoutPromise
    ]);
    
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  } catch (error: any) {
    console.warn("Firebase Storage upload failed (likely not enabled). Falling back to local server / Base64.", error);
    
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
      console.warn("Local API upload also failed.", fallbackError);
    }
    
    // Final Fallback: Convert to Base64 (Compressed to fit in Firestore 1MB limit)
    try {
      console.log("Compressing image to Base64...");
      const compressedBase64 = await compressImageToBase64(file);
      return compressedBase64;
    } catch (base64Error) {
      console.error("Base64 compression failed", base64Error);
      throw new Error("Failed to upload image. Please check your network or enable Firebase Storage.");
    }
  }
}

async function compressImageToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const MAX_HEIGHT = 800;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error("Canvas not supported"));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        // Compress heavily to ensure < 1MB
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        resolve(dataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}
