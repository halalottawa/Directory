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

async function testUrl(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    let checkUrl = url;
    if (url.startsWith('/')) {
      checkUrl = `http://localhost:3000${url}`;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(checkUrl, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timer);
    return { ok: res.ok, status: res.status };
  } catch (e: any) {
    return { ok: false, status: 0, error: e.message };
  }
}

async function audit() {
  console.log('Starting fast parallel audit of all collections...');
  const collections = ['listings', 'events', 'jobs', 'news', 'settings', 'categories'];

  const allItems: { collection: string; id: string; name: string; field: string; url: string }[] = [];

  for (const col of collections) {
    const snap = await db.collection(col).get();
    for (const doc of snap.docs) {
      const data = doc.data();

      function extractUrls(obj: any, prefix = '') {
        if (!obj) return;
        if (typeof obj === 'string') {
          const str = obj.trim();
          if (
            str.startsWith('http://') ||
            str.startsWith('https://') ||
            str.startsWith('/uploads/') ||
            str.startsWith('/assets/') ||
            str.includes('.webp') ||
            str.includes('.jpg') ||
            str.includes('.jpeg') ||
            str.includes('.png') ||
            str.includes('r2.dev') ||
            str.includes('vercel-storage')
          ) {
            allItems.push({
              collection: col,
              id: doc.id,
              name: data.name || data.title || doc.id,
              field: prefix,
              url: str,
            });
          }
        } else if (Array.isArray(obj)) {
          obj.forEach((item, idx) => extractUrls(item, `${prefix}[${idx}]`));
        } else if (typeof obj === 'object') {
          for (const k of Object.keys(obj)) {
            extractUrls(obj[k], prefix ? `${prefix}.${k}` : k);
          }
        }
      }

      extractUrls(data);
    }
  }

  console.log(`Found ${allItems.length} total image/asset references across Firestore.`);

  const brokenImages: any[] = [];
  const concurrency = 25;

  for (let i = 0; i < allItems.length; i += concurrency) {
    const chunk = allItems.slice(i, i + concurrency);
    await Promise.all(
      chunk.map(async (item) => {
        const res = await testUrl(item.url);
        if (!res.ok) {
          brokenImages.push({
            ...item,
            status: res.status,
            error: res.error,
          });
        }
      })
    );
  }

  console.log('\n========================================');
  console.log(`Total URLs found and tested: ${allItems.length}`);
  console.log(`Total broken URLs: ${brokenImages.length}`);
  console.log('========================================\n');

  if (brokenImages.length > 0) {
    console.log('Broken images detail:');
    for (const b of brokenImages) {
      console.log(`[BROKEN] ${b.collection}/${b.id} (${b.name}) - ${b.field}: ${b.url} -> Status: ${b.status} ${b.error || ''}`);
    }
  } else {
    console.log('All images returned HTTP 200 OK!');
  }
}

audit().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
