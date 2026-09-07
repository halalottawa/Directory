import dotenv from 'dotenv';
dotenv.config({ override: true });

import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON!);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });
}

const db = getFirestore(admin.app(), config.firestoreDatabaseId || 'default');

async function inspect() {
  const uploadDirFiles = new Set(fs.readdirSync(path.join(process.cwd(), 'public', 'uploads')));
  
  const snap = await db.collection('listings').get();
  console.log(`Total listings in Firestore: ${snap.size}`);

  let noPhotosCount = 0;
  let brokenPhotosCount = 0;
  let okCount = 0;

  const issues: any[] = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const photos = Array.isArray(d.photos) ? d.photos : [];
    const photo = d.photo || '';
    const coverImage = d.coverImage || '';

    const allImages = [...photos];
    if (photo && !allImages.includes(photo)) allImages.push(photo);
    if (coverImage && !allImages.includes(coverImage)) allImages.push(coverImage);

    if (allImages.length === 0) {
      noPhotosCount++;
      issues.push({ id: doc.id, name: d.name, category: d.category, issue: 'NO_IMAGE', images: [] });
    } else {
      // Check primary image (what UI renders: photos[0] || photo || coverImage)
      const primary = photos[0] || photo || coverImage;
      let isOk = false;
      let checkReason = '';

      if (primary.startsWith('/uploads/')) {
        const filename = primary.replace('/uploads/', '').split('?')[0];
        if (uploadDirFiles.has(filename)) {
          isOk = true;
        } else {
          checkReason = `Local file missing: ${filename}`;
        }
      } else if (primary.includes('r2.dev') || primary.includes('r2.cloudflarestorage.com')) {
        isOk = true; // hosted on R2
      } else if (primary.includes('googleusercontent.com') || primary.includes('ggpht.com')) {
        checkReason = `Google usercontent URL (may return 403): ${primary.substring(0, 60)}...`;
      } else if (primary.startsWith('http')) {
        isOk = true;
      }

      if (isOk) {
        okCount++;
      } else {
        brokenPhotosCount++;
        issues.push({
          id: doc.id,
          name: d.name,
          category: d.category,
          issue: checkReason,
          primary,
          photos,
          photo,
        });
      }
    }
  }

  console.log(`\nResults:\nOK: ${okCount}\nNo Photos: ${noPhotosCount}\nBroken/Issue: ${brokenPhotosCount}\n`);
  console.log('Sample of issues:');
  console.log(JSON.stringify(issues.slice(0, 30), null, 2));
}

inspect().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
