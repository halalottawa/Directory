import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const firebaseConfig = {
  projectId: "gen-lang-client-0904645018",
  appId: "1:604019460073:web:24cb77107f1819e8e5ad78",
  apiKey: "AIzaSyC0Q3FrK1N1Z4wkwLhkBAJsrtBaKiEjP5I",
  authDomain: "gen-lang-client-0904645018.firebaseapp.com",
  firestoreDatabaseId: "ai-studio-8c45b12a-480e-4fc2-99d6-d2b9d696e7f6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-8c45b12a-480e-4fc2-99d6-d2b9d696e7f6");

const uploadDir = path.join(process.cwd(), "public", "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

function generateSlug(text: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function uploadFromUrl(url: string, name: string): Promise<string> {
  const cleanName = generateSlug(name) || 'image';
  const filename = `${cleanName}.webp`;
  const outputPath = path.join(uploadDir, filename);

  // If it's already a local path in /uploads, just copy it
  if (url.startsWith('/uploads/') || url.includes('/public/uploads/')) {
    const srcPath = url.startsWith('/uploads/') 
      ? path.join(process.cwd(), 'public', url)
      : url;
    
    if (fs.existsSync(srcPath)) {
      if (srcPath !== outputPath) {
        console.log(`Copying local file ${srcPath} -> ${outputPath}`);
        fs.copyFileSync(srcPath, outputPath);
      }
      return `/uploads/${filename}`;
    }
  }

  let buffer: Buffer;
  if (url.startsWith('http')) {
    console.log(`Downloading ${url}...`);
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
        'Accept-Language': 'en-GB,en-US;q=0.9,en;q=0.8',
        'Cache-Control': 'max-age=0',
        'Sec-Ch-Ua': '"Not A(Brand";v="99", "Google Chrome";v="121", "Chromium";v="121"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"macOS"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://www.google.com/'
      }
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    // Treat as relative file path from project root
    const fullPath = path.isAbsolute(url) ? url : path.join(process.cwd(), url);
    if (!fs.existsSync(fullPath)) {
       throw new Error(`File not found: ${fullPath}`);
    }
    buffer = fs.readFileSync(fullPath);
  }

  await sharp(buffer)
    .webp({ quality: 90, effort: 6 })
    .toFile(outputPath);

  return `/uploads/${filename}`;
}

async function migrateCollection(collectionName: string, imageFields: string[], arrayImageFields: string[]) {
  console.log(`Migrating ${collectionName}...`);
  const querySnapshot = await getDocs(collection(db, collectionName));
  for (const document of querySnapshot.docs) {
    const data = document.data();
    const nameOrTitle = data.name || data.title || data.company || document.id;
    const slug = data.slug || generateSlug(nameOrTitle) || document.id.toLowerCase();
    let updated = false;
    const updates: any = {};

    for (const field of imageFields) {
      const url = data[field];
      if (url && (url.startsWith('http') || url.startsWith('/uploads/'))) {
         const expectedName = slug;
         const currentFilename = url.split('/').pop();
         if (currentFilename !== `${expectedName}.webp` || url.startsWith('http')) {
            try {
              console.log(`Processing ${url} for doc ${document.id} -> ${expectedName}.webp`);
              const newUrl = await uploadFromUrl(url.startsWith('http') ? url : path.join(process.cwd(), 'public', url), expectedName);
              updates[field] = newUrl;
              updated = true;
            } catch (e) {
              console.error(`Failed to process ${url}`, e);
            }
         }
      }
    }

    for (const field of arrayImageFields) {
      if (data[field] && Array.isArray(data[field])) {
        const newArray: string[] = [];
        let arrayUpdated = false;
        let idx = 0;
        for (const url of data[field]) {
          if (!url) {
            idx++;
            continue;
          }
          const expectedName = idx === 0 ? slug : `${slug}-${idx}`;
          const currentFilename = url.split('/').pop();
          
          if (url.startsWith('http') || currentFilename !== `${expectedName}.webp`) {
            try {
              console.log(`Processing ${url} for doc ${document.id} -> ${expectedName}.webp`);
              const newUrl = await uploadFromUrl(url.startsWith('http') ? url : path.join(process.cwd(), 'public', url), expectedName);
              newArray.push(newUrl);
              arrayUpdated = true;
            } catch (e) {
              console.error(`Failed to process ${url}`, e);
              newArray.push(url);
            }
          } else {
            newArray.push(url);
          }
          idx++;
        }
        if (arrayUpdated) {
          updates[field] = newArray;
          updated = true;
        }
      }
    }

    if (updated) {
      console.log(`Updating doc ${document.id} with`, JSON.stringify(updates));
      await updateDoc(doc(db, collectionName, document.id), updates);
    }
  }
}

async function run() {
  await migrateCollection('listings', [], ['photos']);
  await migrateCollection('events', ['coverImage'], []);
  await migrateCollection('jobs', ['companyLogo'], []);
  await migrateCollection('news', ['coverImage'], []);
  console.log('Migration complete!');
  process.exit();
}

run().catch(console.error);
