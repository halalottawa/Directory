import dotenv from "dotenv";
dotenv.config({ override: true });

import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

// 1. Load Firebase and R2 Configuration
let firebaseConfig: any;
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  } else {
    throw new Error("firebase-applet-config.json not found");
  }
} catch (err) {
  console.error("Failed to load firebase configs:", err);
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || "default");

const r2AccountId = process.env.R2_ACCOUNT_ID;
const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
const r2BucketName = process.env.R2_BUCKET_NAME || "halalottawa";
const r2PublicUrl = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, "") : "";

if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
  console.error("Cloudflare R2 Environment keys are missing in .env! Please configure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.");
  process.exit(1);
}

// Instantiate AWS S3 Client for R2 with explicit path styling and custom configurations
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: r2AccessKeyId,
    secretAccessKey: r2SecretAccessKey,
  },
  forcePathStyle: true,
});

function generateSlug(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// 2. Upload function to R2
async function uploadToR2(url: string, name: string): Promise<string> {
  const slugName = generateSlug(name) || "image";
  const finalName = `${slugName}.webp`;

  let buffer: Buffer;

  if (url.startsWith("http")) {
    console.log(`Downloading original image: ${url}...`);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.statusText}`);
    }
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } else {
    // Local /uploads relative file
    const cleanRelativePath = url.startsWith("/") ? url.slice(1) : url;
    const localFullPath = path.join(process.cwd(), "public", cleanRelativePath);
    if (!fs.existsSync(localFullPath)) {
      throw new Error(`Local file not found at: ${localFullPath}`);
    }
    buffer = fs.readFileSync(localFullPath);
  }

  // Convert/optimize using Sharp to ensure clean WebP compression with maximum dimensions of 1200x1200px
  let procBuffer = buffer;
  try {
    procBuffer = await sharp(buffer)
      .resize({
        width: 1200,
        height: 1200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 80, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.warn(`Sharp processing skipped or failed for ${url}, rising back to raw buffer.`, err);
  }

  // Send object to R2
  await s3.send(
    new PutObjectCommand({
      Bucket: r2BucketName,
      Key: `uploads/${finalName}`,
      Body: procBuffer,
      ContentType: "image/webp",
    })
  );

  const baseUrl = r2PublicUrl || `https://${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`;
  const migratedUrl = `${baseUrl}/uploads/${finalName}`;
  console.log(`Uploaded to R2: ${migratedUrl}`);
  return migratedUrl;
}

// Check if a URL is already on Cloudflare R2
function isAlreadyR2(url: string): boolean {
  if (!url) return true;
  // If we have a public URL, check against it
  if (r2PublicUrl && url.startsWith(r2PublicUrl)) {
    return true;
  }
  // Also check standard R2 storage URLs
  if (url.includes(".r2.cloudflarestorage.com") || url.includes("pub-") && url.includes(".r2.dev")) {
    return true;
  }
  return false;
}

// 3. Migrate specific collection fields
async function migrateCollection(collectionName: string, imageFields: string[], arrayImageFields: string[]) {
  console.log(`\n===========================================`);
  console.log(`Starting migration for collection: ${collectionName}`);
  console.log(`===========================================`);

  let totalScanned = 0;
  let totalMigrated = 0;

  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    totalScanned = querySnapshot.docs.length;

    for (const document of querySnapshot.docs) {
      const data = document.data();
      const docId = document.id;
      const nameOrTitle = data.name || data.title || data.company || docId;
      const slug = data.slug || generateSlug(nameOrTitle) || docId.toLowerCase();
      let hasUpdates = false;
      const updates: any = {};

      // Migrate single-value field URLs
      for (const field of imageFields) {
        const url = data[field];
        if (url && typeof url === "string" && !isAlreadyR2(url)) {
          try {
            console.log(`[Collection: ${collectionName}] Doc: ${nameOrTitle} -> Migrating single field [${field}]: ${url}`);
            const newUrl = await uploadToR2(url, slug);
            updates[field] = newUrl;
            hasUpdates = true;
            totalMigrated++;
          } catch (err: any) {
            console.error(`Failed to migrate single field [${field}] for doc ${docId}:`, err.message);
          }
        }
      }

      // Migrate array of field URLs
      for (const field of arrayImageFields) {
        const urlArray = data[field];
        if (urlArray && Array.isArray(urlArray)) {
          const freshArray: string[] = [];
          let arrayChanged = false;
          let idx = 0;

          for (const url of urlArray) {
            if (url && typeof url === "string") {
              if (!isAlreadyR2(url)) {
                try {
                  const uniqueSlugName = idx === 0 ? slug : `${slug}-${idx}`;
                  console.log(`[Collection: ${collectionName}] Doc: ${nameOrTitle} -> Migrating array item [${field}][${idx}]: ${url}`);
                  const newUrl = await uploadToR2(url, uniqueSlugName);
                  freshArray.push(newUrl);
                  arrayChanged = true;
                  totalMigrated++;
                } catch (err: any) {
                  console.error(`Failed to migrate array item [${idx}] inside field [${field}] for doc ${docId}:`, err.message);
                  freshArray.push(url); // Fallback to original URL
                }
              } else {
                freshArray.push(url);
              }
            } else {
              freshArray.push(url);
            }
            idx++;
          }

          if (arrayChanged) {
            updates[field] = freshArray;
            hasUpdates = true;
          }
        }
      }

      // Save changes if there are updates
      if (hasUpdates) {
        console.log(`Saving updates to Firestore doc: ${docId}`);
        await updateDoc(doc(db, collectionName, docId), updates);
      }
    }

    console.log(`Finished ${collectionName}. Scanned docs: ${totalScanned}, Migrated assets: ${totalMigrated}`);
  } catch (err: any) {
    console.error(`Error migrating collection ${collectionName}:`, err);
  }
}

// 4. Run full migration lifecycle
async function runMigration() {
  console.log("🚀 Initializing Cloudflare R2 Migration...");
  console.log(`Target R2 Bucket: ${r2BucketName}`);
  console.log(`Target R2 Public Endpoint: ${r2PublicUrl || "(S3 Standard Endpoint)"}`);

  // Migration fields definitions
  await migrateCollection("listings", [], ["photos"]);
  await migrateCollection("events", ["coverImage"], []);
  await migrateCollection("jobs", ["companyLogo"], []);
  await migrateCollection("news", ["coverImage"], []);

  console.log("\n⭐️ R2 S3 Cloudflare Migration successfully completed! All records updated.");
  process.exit(0);
}

runMigration().catch((error) => {
  console.error("Migration Runner encountered a fatal error:", error);
  process.exit(1);
});
