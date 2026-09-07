import dotenv from 'dotenv';
dotenv.config({ override: true });

import fs from 'fs';
import path from 'path';
import { S3Client, PutObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const config = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'firebase-applet-config.json'), 'utf8'));

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);

if (admin.apps.length === 0) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`,
  });
}

const db = getFirestore(admin.app(), config.firestoreDatabaseId || 'default');

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true,
});

const BUCKET = process.env.R2_BUCKET_NAME || 'halalottawa';
const R2_BASE = (process.env.R2_PUBLIC_URL || 'https://pub-344de773fe4147898d363b9fffa2e2e4.r2.dev').replace(/\/$/, '');

async function getExistingR2Keys(): Promise<Set<string>> {
  console.log('Fetching list of existing R2 keys...');
  const keys = new Set<string>();
  let continuationToken: string | undefined = undefined;
  let isTruncated = true;

  while (isTruncated) {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      ContinuationToken: continuationToken,
    }));
    if (res.Contents) {
      for (const item of res.Contents) {
        if (item.Key) keys.add(item.Key);
      }
    }
    isTruncated = !!res.IsTruncated;
    continuationToken = res.NextContinuationToken;
  }
  console.log(`Found ${keys.size} existing keys in R2 bucket.`);
  return keys;
}

async function uploadFileToR2(localPath: string, r2Key: string): Promise<void> {
  const buf = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  let contentType = 'image/webp';
  if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
  else if (ext === '.png') contentType = 'image/png';
  else if (ext === '.svg') contentType = 'image/svg+xml';

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: r2Key,
    Body: buf,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

async function run() {
  const existingKeys = await getExistingR2Keys();
  const uploadDir = path.join(process.cwd(), 'public', 'uploads');
  const files = fs.readdirSync(uploadDir);

  console.log(`\n=== 1. UPLOADING ALL LOCAL FILES TO R2 (Total local: ${files.length}) ===`);
  const toUpload: string[] = [];
  for (const f of files) {
    const key = `uploads/${f}`;
    if (!existingKeys.has(key)) {
      toUpload.push(f);
    }
  }

  console.log(`Found ${toUpload.length} files that need to be uploaded to R2...`);

  // Concurrency pool of 10
  const concurrency = 10;
  for (let i = 0; i < toUpload.length; i += concurrency) {
    const chunk = toUpload.slice(i, i + concurrency);
    await Promise.all(chunk.map(async (filename) => {
      const fullPath = path.join(uploadDir, filename);
      const key = `uploads/${filename}`;
      try {
        await uploadFileToR2(fullPath, key);
        console.log(`[OK] Uploaded: ${key}`);
      } catch (err: any) {
        console.error(`[ERROR] Failed to upload ${key}:`, err.message);
      }
    }));
  }

  console.log('\n=== 2. UPLOADING LOGO AND COVER FROM VERCEL TO R2 (IF MISSING) ===');
  const remoteImages = [
    { url: 'https://g0clgwu3lfaulzds.public.blob.vercel-storage.com/uploads/halal-ottawa-logo.webp', key: 'uploads/halal-ottawa-logo.webp' },
    { url: 'https://g0clgwu3lfaulzds.public.blob.vercel-storage.com/uploads/global-listings-cover.webp', key: 'uploads/global-listings-cover.webp' }
  ];

  for (const item of remoteImages) {
    if (!existingKeys.has(item.key)) {
      try {
        console.log(`Downloading ${item.url}...`);
        const res = await fetch(item.url);
        if (res.ok) {
          const arr = await res.arrayBuffer();
          await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: item.key,
            Body: Buffer.from(arr),
            ContentType: 'image/webp',
            CacheControl: 'public, max-age=31536000, immutable',
          }));
          console.log(`[OK] Uploaded ${item.key} to R2!`);
        }
      } catch (err: any) {
        console.error(`Failed to process ${item.key}:`, err.message);
      }
    }
  }

  console.log('\n=== 3. FIXING SPECIFIC EXTERNAL LISTINGS IN FIRESTORE ===');
  // Chahaya Malaysia: Udji4YcO2xEUPTyMUwia
  await db.collection('listings').doc('Udji4YcO2xEUPTyMUwia').update({
    photos: [`${R2_BASE}/uploads/chahaya-malaysia.webp`]
  });
  console.log('[OK] Updated Chahaya Malaysia photo to R2 URL');

  // The Garlic King: D5bnfXN2B1RjWrz9Wfiq
  await db.collection('listings').doc('D5bnfXN2B1RjWrz9Wfiq').update({
    photos: [`${R2_BASE}/uploads/the-garlic-king.webp`]
  });
  console.log('[OK] Updated The Garlic King photo to R2 URL');

  // Falafel on Wheels: K9v1TwKuDxsynjlN4PWr
  await db.collection('listings').doc('K9v1TwKuDxsynjlN4PWr').update({
    photos: [`${R2_BASE}/uploads/falafel-on-wheels.webp`]
  });
  console.log('[OK] Updated Falafel on Wheels photo to R2 URL');

  console.log('\n=== 4. UPDATING SETTINGS TO USE R2 URLS ===');
  const settingsDoc = await db.collection('settings').doc('general').get();
  if (settingsDoc.exists) {
    await db.collection('settings').doc('general').update({
      logoUrl: `${R2_BASE}/uploads/halal-ottawa-logo.webp`,
      coverImageUrl: `${R2_BASE}/uploads/global-listings-cover.webp`,
    });
    console.log('[OK] Updated settings/general with R2 logo and cover URLs');
  }

  console.log('\n=== 5. VALIDATING ALL LISTINGS, EVENTS, JOBS, NEWS ===');
  let brokenCount = 0;
  let totalChecked = 0;

  for (const col of ['listings', 'events', 'jobs', 'news']) {
    const snap = await db.collection(col).get();
    for (const d of snap.docs) {
      const data = d.data();
      let urls: string[] = [];
      if (col === 'listings' && Array.isArray(data.photos)) urls = data.photos;
      if ((col === 'events' || col === 'news') && data.coverImage) urls = [data.coverImage];
      if (col === 'jobs' && data.companyLogo) urls = [data.companyLogo];

      for (const u of urls) {
        if (!u) continue;
        totalChecked++;
        try {
          const res = await fetch(u, { method: 'HEAD' });
          if (!res.ok) {
            console.error(`[BROKEN] ${col}/${d.id} (${data.name || data.title}): ${u} -> HTTP ${res.status}`);
            brokenCount++;
          }
        } catch (e: any) {
          console.error(`[ERROR] ${col}/${d.id} (${data.name || data.title}): ${u} -> ${e.message}`);
          brokenCount++;
        }
      }
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: Total checked = ${totalChecked}, Total broken = ${brokenCount}`);
  console.log(`========================================\n`);
}

run().then(() => process.exit(0)).catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
