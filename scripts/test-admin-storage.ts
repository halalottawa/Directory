import { initializeApp } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import fs from "fs";

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
initializeApp({
  projectId: config.projectId,
  storageBucket: config.storageBucket
});

async function testUpload() {
  try {
    const bucket = getStorage().bucket();
    const [exists] = await bucket.exists();
    if (!exists) {
      console.log('Bucket does not exist.');
      process.exit(1);
    }
    
    console.log('Uploading with admin sdk...');
    await bucket.upload('./public/uploads/test.webp', {
      destination: 'test-admin-upload.webp',
      metadata: { contentType: 'image/webp' }
    });
    console.log('Upload successful!');
    process.exit(0);
  } catch (err: any) {
    console.error('Error:', err.message);
    process.exit(1);
  }
}

testUpload();
