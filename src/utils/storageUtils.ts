import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

export async function uploadFile(file: File, path: string): Promise<string> {
  if (!storage) {
    throw new Error('Firebase Storage is not initialized.');
  }
  try {
    const fileRef = ref(storage, `${path}/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(fileRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return downloadUrl;
  } catch (error: any) {
    if (error?.message?.includes('Service storage is not available') || error?.code === 'storage/unknown') {
      throw new Error('Firebase Storage is not enabled. Please enable it in the Firebase Console (Build > Storage).');
    }
    if (error?.code === 'storage/unauthorized') {
      throw new Error('Permission denied. Please ensure your Firebase Storage rules allow uploads.');
    }
    throw error;
  }
}
