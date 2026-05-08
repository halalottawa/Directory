import { initializeApp } from "firebase/app";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const storage = getStorage(app);

async function testUpload() {
  try {
    const fileBuf = fs.readFileSync('./public/uploads/test.webp');
    const storageRef = ref(storage, 'test-upload.webp');
    const uint8Array = new Uint8Array(fileBuf);
    
    console.log('Uploading...');
    const snapshot = await uploadBytes(storageRef, uint8Array, { contentType: 'image/webp' });
    const url = await getDownloadURL(snapshot.ref);
    console.log('Success!', url);
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testUpload();
