import dotenv from "dotenv";
dotenv.config({ override: true });
import dns from "node:dns";
dns.setDefaultResultOrder("ipv4first");
import express from "express";
import path from "path";
import multer from "multer";
import fs from "fs";
import compression from "compression";
import admin from "firebase-admin";

// Cached Firebase variables across SSR request cycles to minimize Time to First Byte (TTFB)
let cachedFirebaseConfig: any = null;
let cachedFbApp: any = null;
let cachedDb: any = null;
let cachedFirestoreUtils: any = null;

function getContentTypeFromKey(key: string): string {
  const ext = path.extname(key).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return "image/webp";
  }
}

async function startServer() {
  // Initialize firebase-admin
  const serviceAccountPath = path.resolve(process.cwd(), "firebase-service-account.json");
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf-8"));
    try {
      if (admin.apps.length === 0) {
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: `https://${serviceAccount.project_id}.firebaseio.com`
        });
        console.log("Firebase Admin SDK initialized successfully");
      }
    } catch (error) {
      console.error("Error initializing Firebase Admin SDK:", error);
    }
  } else {
    console.warn("No firebase-service-account.json found. Backend admin functions will be disabled.");
  }

  const app = express();
  app.use(compression());
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  // Set up upload dir
  let uploadDir = path.join(process.cwd(), "public", "uploads");
  try {
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
  } catch (err) {
    console.warn("Failed to create public/uploads directory, falling back to /tmp/uploads:", err);
    uploadDir = "/tmp/uploads";
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
    } catch (e2) {
      console.error("Failed to create fallback /tmp/uploads directory:", e2);
    }
  }

  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  // Serve static files from public folder specifically for uploads in production too
  app.use("/uploads", express.static(uploadDir, {
    maxAge: "30d",
    setHeaders: (res) => {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
    }
  }));

  // Upload to Cloudflare R2 if credentials are provided
  async function uploadToR2(buffer: Buffer, finalName: string, contentType = "image/webp"): Promise<string | null> {
    try {
      const accountId = process.env.R2_ACCOUNT_ID;
      const accessKeyId = process.env.R2_ACCESS_KEY_ID;
      const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const publicUrl = process.env.R2_PUBLIC_URL;

      if (!accountId || !accessKeyId || !secretAccessKey) {
        return null; // Not fully configured
      }

      const { S3Client, PutObjectCommand, ListBucketsCommand, CreateBucketCommand } = await import("@aws-sdk/client-s3");
      
      const s3 = new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });

      // 1. Resolve Bucket Name
      let bucketName = process.env.R2_BUCKET_NAME || '';
      if (!bucketName || !bucketName.trim()) {
        try {
          const listRes = await s3.send(new ListBucketsCommand({}));
          if (listRes.Buckets && listRes.Buckets.length > 0) {
            bucketName = listRes.Buckets[0].Name || "halal-ottawa-images";
            console.log(`Auto-selected existing R2 Bucket: ${bucketName}`);
          } else {
            // No buckets found! Auto create one
            bucketName = "halal-ottawa-images";
            console.log(`No R2 buckets found. Auto-creating bucket: ${bucketName}`);
            await s3.send(new CreateBucketCommand({
              Bucket: bucketName
            }));
            console.log(`Successfully created bucket: ${bucketName}`);
          }
        } catch (bucketError) {
          console.error("Failed to auto-resolve R2 bucket. Using default 'halal-ottawa-images':", bucketError);
          bucketName = "halal-ottawa-images";
        }
      }

      // Process image to webp
      let procBuffer = buffer;
      if (contentType.startsWith("image/")) {
        try {
          const { default: sharp } = await import("sharp");
          procBuffer = await sharp(buffer)
            .webp({ quality: 80 })
            .toBuffer();
        } catch (e) {
          console.error("Error converting uploaded image to webp:", e);
        }
      }

      await s3.send(new PutObjectCommand({
        Bucket: bucketName,
        Key: `uploads/${finalName}`,
        Body: procBuffer,
        ContentType: "image/webp", // Force type to webp as we optimize
      }));

      // 2. Generate Public URL
      let baseUrl = publicUrl ? publicUrl.replace(/\/$/, "") : "";
      if (!baseUrl) {
        baseUrl = `https://${bucketName}.${accountId}.r2.cloudflarestorage.com`;
      }

      console.log(`Successfully uploaded ${finalName} to Cloudflare R2 bucket: ${bucketName}`);
      return `${baseUrl}/uploads/${finalName}`;
    } catch (err) {
      console.error("Error during Cloudflare R2 Upload workflow:", err);
      return null;
    }
  }

  // File upload endpoint
  app.post("/api/upload", express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
      const filenameStr = typeof req.query.filename === 'string' ? req.query.filename : `upload-${Date.now()}.jpg`;
      const providedName = filenameStr.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
      
      const cleanName = providedName.replace(/\.[^/.]+$/, "");
      const buffer = req.body;
      
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
         return res.status(400).json({ error: "No file content received" });
      }

      const finalName = `${cleanName}.webp`;

      // Upload to Cloudflare R2 if configured
      const r2Url = await uploadToR2(buffer, finalName, "image/webp");
      if (r2Url) {
        return res.json({ url: r2Url });
      }

      // Upload to Vercel Blob
      try {
        const hasVercelToken = !!process.env.BLOB_READ_WRITE_TOKEN;
        if (hasVercelToken) {
          const { put } = await import("@vercel/blob");
          
          let procBuffer = buffer;
          try {
            const { default: sharp } = await import("sharp");
            procBuffer = await sharp(buffer)
              .webp({ quality: 80 })
              .toBuffer();
          } catch (e) {
            console.error("Error converting uploaded image to webp:", e);
          }
          
          const { url } = await put(`uploads/${finalName}`, procBuffer, {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: true
          });
          
          return res.json({ url });
        }
      } catch (blobError) {
        console.error("Vercel Blob upload error:", blobError);
      }

      // Fallback: local disk upload
      let procBuffer = buffer;
      try {
        const { default: sharp } = await import("sharp");
        procBuffer = await sharp(buffer)
          .webp({ quality: 80 })
          .toBuffer();
      } catch (e) {
        console.error("Error converting uploaded image to webp:", e);
      }
      
      const outputPath = path.join(uploadDir, finalName);
      fs.writeFileSync(outputPath, procBuffer);

      // Return the relative URL to access the file
      const url = `/uploads/${finalName}`;
      res.json({ url });
    } catch (error) {
      console.error("Error processing image:", error);
      res.status(500).json({ error: "Failed to process image" });
    }
  });

  // File upload from URL endpoint
  app.post("/api/upload-url", express.json(), async (req, res) => {
    try {
      const { url, name } = req.body;
      if (!url) {
        return res.status(400).json({ error: "No URL provided" });
      }

      const cleanName = name ? name.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
      
      const finalName = `${cleanName}.webp`;

      // Check if it is already our local url
      if (url.startsWith('/uploads/')) {
        const srcPath = path.join(process.cwd(), 'public', url);
        const outputPath = path.join(uploadDir, finalName);
        if (fs.existsSync(srcPath)) {
          if (srcPath !== outputPath) {
            fs.copyFileSync(srcPath, outputPath);
          }
          return res.json({ url: `/uploads/${finalName}` });
        }
        return res.json({ url });
      }

      console.log(`Downloading image from URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/*,*/*;q=0.8',
          'Referer': 'https://www.google.com/'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Upload to Cloudflare R2 if configured
      const r2Url = await uploadToR2(buffer, finalName, "image/webp");
      if (r2Url) {
        return res.json({ url: r2Url });
      }

      // Upload to Vercel Blob
      try {
        const hasVercelToken = !!process.env.BLOB_READ_WRITE_TOKEN;
        if (hasVercelToken) {
          const { put } = await import("@vercel/blob");
          
          let procBuffer = buffer;
          try {
            const { default: sharp } = await import("sharp");
            procBuffer = await sharp(buffer)
              .webp({ quality: 80 })
              .toBuffer();
          } catch (e) {
            console.error("Error converting uploaded image to webp:", e);
          }
          
          const { url: vercelUrl } = await put(`uploads/${finalName}`, procBuffer, {
            access: 'public',
            contentType: 'image/webp',
            addRandomSuffix: false,
            allowOverwrite: true
          });
          
          return res.json({ url: vercelUrl });
        }
      } catch (blobError) {
        console.error("Vercel Blob upload error:", blobError);
      }

      // Fallback: local disk upload
      let procBuffer = buffer;
      try {
        const { default: sharp } = await import("sharp");
        procBuffer = await sharp(buffer)
          .webp({ quality: 80 })
          .toBuffer();
      } catch (e) {
        console.error("Error converting uploaded image to webp:", e);
      }

      const outputPath = path.join(uploadDir, finalName);
      fs.writeFileSync(outputPath, procBuffer);

      res.json({ url: `/uploads/${finalName}` });
    } catch (error) {
      console.error("Error processing image from URL:", error);
      res.status(500).json({ error: "Failed to process image from URL" });
    }
  });

  app.get(["/uploads/:key", "/api/images/:key", "/api/uploads/:key"], async (req, res, next) => {
    try {
      const hasVercelToken = !!process.env.BLOB_READ_WRITE_TOKEN;
      if (hasVercelToken) {
        // With Vercel Blob, public files are usually served directly from their CDN via absolute URL.
        // If we are proxying, we can fetch, but we need to know the Blob store base URL, which isn't standard.
        // It's better if we just redirect to it or fetch if we know the URL. 
        // Vercel Blob URLs look like: https://[store-id].public.blob.vercel-storage.com/[path]
        // But the vercel blob list API could find it.
        const { list } = await import("@vercel/blob");
        const { blobs } = await list({ prefix: `uploads/${req.params.key}` });
        const blob = blobs.find(b => b.pathname === `uploads/${req.params.key}`);
        if (blob) {
          return res.redirect(blob.url);
        }
      }
      
      // Fallback to local file system serving from public/uploads
      const fs = await import("fs");
      const path = await import("path");
      const filePath = path.join(process.cwd(), "public", "uploads", req.params.key);
      if (fs.existsSync(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        return res.sendFile(filePath);
      }
    } catch (e) {
      console.error("Error serving blob:", e);
    }
    return res.status(404).send("Not found");
  });

  // Dynamic Image Optimization Endpoint
  app.get("/api/optimize-image", async (req, res) => {
    try {
      const imageUrl = req.query.url as string;
      if (!imageUrl) {
        return res.status(400).send("Missing url query parameter");
      }

      const width = req.query.w ? parseInt(req.query.w as string, 10) : null;
      const height = req.query.h ? parseInt(req.query.h as string, 10) : null;
      const quality = req.query.q ? parseInt(req.query.q as string, 10) : 80;

      const fs = await import("fs");
      const path = await import("path");

      let buffer: Buffer | null = null;

      // Handle local path or absolute url pointing to this server
      const isLocal = imageUrl.startsWith("/") || imageUrl.startsWith(req.protocol + "://" + req.get("host")) || imageUrl.startsWith("http://localhost:3000") || imageUrl.startsWith("https://www.halalottawa.ca") || imageUrl.startsWith("https://halalottawa.ca");
      
      if (isLocal) {
        let cleanPath = imageUrl;
        if (imageUrl.startsWith("http")) {
          try {
            cleanPath = new URL(imageUrl).pathname;
          } catch (e) {}
        }
        
        const relativePath = cleanPath.startsWith("/") ? cleanPath.substring(1) : cleanPath;
        const localPath = path.join(process.cwd(), "public", relativePath);
        
        if (fs.existsSync(localPath)) {
          buffer = fs.readFileSync(localPath);
        } else {
          const filename = path.basename(cleanPath);
          const uploadPath = path.join(uploadDir, filename);
          if (fs.existsSync(uploadPath)) {
            buffer = fs.readFileSync(uploadPath);
          }
        }
      }

      // Remote file parsing if we couldn't load locally
      if (!buffer) {
        if (!imageUrl.startsWith("http")) {
          return res.status(404).send("Image not found");
        }

        const fetchRes = await fetch(imageUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Accept": "image/*"
          }
        });
        
        if (!fetchRes.ok) {
          return res.redirect(imageUrl);
        }
        
        const contentType = fetchRes.headers.get("content-type");
        if (contentType && !contentType.startsWith("image/")) {
          return res.status(400).send("Source URL is not an image");
        }

        const ab = await fetchRes.arrayBuffer();
        buffer = Buffer.from(ab);
      }

      // Optimize image using sharp
      const { default: sharp } = await import("sharp");
      let sharpImg = sharp(buffer);

      if (width || height) {
        sharpImg = sharpImg.resize({
          width: width || undefined,
          height: height || undefined,
          fit: "cover",
          withoutEnlargement: true
        });
      }

      const optimizedBuffer = await sharpImg
        .webp({ quality })
        .toBuffer();

      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", "image/webp");
      return res.send(optimizedBuffer);
    } catch (err) {
      console.error("Error in /api/optimize-image:", err);
      const fallbackUrl = req.query.url as string;
      if (fallbackUrl && fallbackUrl.startsWith("http")) {
        return res.redirect(fallbackUrl);
      }
      return res.status(500).send("Error optimizing image");
    }
  });

  // Reverse proxy for Firebase Auth helper assets to cache with highly efficient TTL (for PageSpeed score optimization)
  app.get("/__/auth/*", async (req, res) => {
    try {
      const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(configPath)) {
        return res.status(404).send("Config not found");
      }
      
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      const authDomain = firebaseConfig.authDomain || `${firebaseConfig.projectId}.firebaseapp.com`;
      const targetUrl = `https://${authDomain}${req.url}`;
      
      const response = await fetch(targetUrl);
      if (!response.ok) {
        return res.status(response.status).send(`Failed to proxy auth helper: ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type");
      if (contentType) {
        res.setHeader("Content-Type", contentType);
      }
      
      // Enforce long, efficient cache lifetime for repeating visits
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      return res.send(buffer);
    } catch (err: any) {
      console.error("Error reverse proxying Firebase Auth helper:", err);
      return res.status(500).send("Error proxying Firebase Auth helper");
    }
  });

  // API routes can be added here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/admin/migrate-r2", async (req, res) => {
    try {
      const limitVal = parseInt(req.query.limit as string) || 10;
      const collectionName = (req.query.collection as string) || "all";

      console.log(`[R2 Migration Endpoint] Starting migration. Limit: ${limitVal}, Collection: ${collectionName}`);

      const firebaseConfigPath = path.resolve(process.cwd(), "firebase-applet-config.json");
      if (!fs.existsSync(firebaseConfigPath)) {
        return res.status(500).json({ error: "firebase-applet-config.json not found" });
      }

      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));
      const { initializeApp } = await import("firebase/app");
      const { getFirestore, collection, getDocs, updateDoc, doc } = await import("firebase/firestore");

      const localApp = initializeApp(firebaseConfig, "migration-instance-" + Date.now());
      const localDb = getFirestore(localApp, firebaseConfig.firestoreDatabaseId || "default");

      const r2AccountId = process.env.R2_ACCOUNT_ID;
      const r2AccessKeyId = process.env.R2_ACCESS_KEY_ID;
      const r2SecretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
      const r2BucketName = process.env.R2_BUCKET_NAME || "halalottawa";
      const r2PublicUrl = process.env.R2_PUBLIC_URL ? process.env.R2_PUBLIC_URL.replace(/\/$/, "") : "";

      if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey) {
        return res.status(400).json({ error: "R2 credentials are not configured in system environment." });
      }

      const { S3Client, PutObjectCommand } = await import("@aws-sdk/client-s3");
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

      async function uploadUrlToR2(url: string, name: string): Promise<string> {
        const slugName = generateSlug(name) || "image";
        const finalName = `${slugName}.webp`;
        let buffer: Buffer;

        if (url.startsWith("http")) {
          const fetchRes = await fetch(url, {
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            },
          });
          if (!fetchRes.ok) {
            throw new Error(`Failed to download ${url}: ${fetchRes.statusText}`);
          }
          const arrayBuf = await fetchRes.arrayBuffer();
          buffer = Buffer.from(arrayBuf);
        } else {
          const cleanRelativePath = url.startsWith("/") ? url.slice(1) : url;
          const localFullPath = path.join(process.cwd(), "public", cleanRelativePath);
          if (!fs.existsSync(localFullPath)) {
            throw new Error(`Local file not found: ${localFullPath}`);
          }
          buffer = fs.readFileSync(localFullPath);
        }

        let procBuffer = buffer;
        try {
          const { default: sharp } = await import("sharp");
          procBuffer = await sharp(buffer).webp({ quality: 80 }).toBuffer();
        } catch (err) {
          console.warn("Sharp fallback:", err);
        }

        await s3.send(new PutObjectCommand({
          Bucket: r2BucketName,
          Key: `uploads/${finalName}`,
          Body: procBuffer,
          ContentType: "image/webp",
        }));

        const baseUrl = r2PublicUrl || `https://${r2BucketName}.${r2AccountId}.r2.cloudflarestorage.com`;
        return `${baseUrl}/uploads/${finalName}`;
      }

      function isUrlAlreadyR2(url: string): boolean {
        if (!url) return true;
        if (r2PublicUrl && url.startsWith(r2PublicUrl)) return true;
        if (url.includes(".r2.cloudflarestorage.com") || (url.includes("pub-") && url.includes(".r2.dev"))) return true;
        return false;
      }

      const collectionsToMigrate = [
        { name: "listings", imageFields: [], arrayImageFields: ["photos"] },
        { name: "events", imageFields: ["coverImage"], arrayImageFields: [] },
        { name: "jobs", imageFields: ["companyLogo"], arrayImageFields: [] },
        { name: "news", imageFields: ["coverImage"], arrayImageFields: [] },
      ].filter(c => collectionName === "all" || c.name === collectionName);

      let migratedCount = 0;
      const logs: string[] = [];

      for (const colInfo of collectionsToMigrate) {
        if (migratedCount >= limitVal) break;

        const snap = await getDocs(collection(localDb, colInfo.name));
        for (const docObj of snap.docs) {
          if (migratedCount >= limitVal) break;

          const data = docObj.data();
          const docId = docObj.id;
          const nameOrTitle = data.name || data.title || data.company || docId;
          const slug = data.slug || generateSlug(nameOrTitle) || docId.toLowerCase();
          let hasUpdated = false;
          const updates: any = {};

          // Single fields
          for (const field of colInfo.imageFields) {
            if (migratedCount >= limitVal) break;
            const url = data[field];
            if (url && typeof url === "string" && !isUrlAlreadyR2(url)) {
              try {
                logs.push(`Migrating [${colInfo.name}] ${nameOrTitle} -> field: ${field}`);
                const newUrl = await uploadUrlToR2(url, slug);
                updates[field] = newUrl;
                hasUpdated = true;
                migratedCount++;
              } catch (err: any) {
                logs.push(`Failed to migrate single field [${field}] for doc ${docId}: ${err.message}`);
              }
            }
          }

          // Array fields
          for (const field of colInfo.arrayImageFields) {
            if (migratedCount >= limitVal) break;
            const urlArray = data[field];
            if (urlArray && Array.isArray(urlArray)) {
              const freshArray: string[] = [];
              let arrayChanged = false;
              let idx = 0;

              for (const url of urlArray) {
                if (url && typeof url === "string") {
                  if (!isUrlAlreadyR2(url)) {
                    if (migratedCount >= limitVal) {
                      freshArray.push(url);
                    } else {
                      try {
                        logs.push(`Migrating [${colInfo.name}] ${nameOrTitle} -> array item [${field}][${idx}]`);
                        const uniqueSlugName = idx === 0 ? slug : `${slug}-${idx}`;
                        const newUrl = await uploadUrlToR2(url, uniqueSlugName);
                        freshArray.push(newUrl);
                        arrayChanged = true;
                        migratedCount++;
                      } catch (err: any) {
                        logs.push(`Failed to migrate array item [${idx}] inside field [${field}] for doc ${docId}: ${err.message}`);
                        freshArray.push(url);
                      }
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
                hasUpdated = true;
              }
            }
          }

          if (hasUpdated) {
            await updateDoc(doc(localDb, colInfo.name, docId), updates);
            logs.push(`Saved updates to ${colInfo.name} -> doc: ${docId}`);
          }
        }
      }

      res.json({
        status: "complete",
        migratedCount,
        maxLimit: limitVal,
        logs,
        instructions: migratedCount >= limitVal
          ? "There are more assets remaining. Trigger this endpoint again to process the next batch!"
          : "All collections scanned fully and all images are successfully hosted on Cloudflare R2!"
      });
    } catch (error: any) {
      console.error("Migration endpoint error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/send-push-notification", express.json(), async (req, res) => {
    const { title, message, url, image } = req.body;
    const authHeader = req.headers.authorization;

    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: "Authorization header with Bearer token is required" });
    }

    try {
      const idToken = authHeader.split('Bearer ')[1];
      // Verify ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Verify if is Admin by reading the user profile
      const userDoc = await admin.firestore().collection('users').doc(uid).get();
      const userData = userDoc.data();

      // Check for admin role
      const isAdminEmail = decodedToken.email?.toLowerCase() === 'abesabil00@gmail.com' || 
                           decodedToken.email?.toLowerCase() === 'fibaliktn@gmail.com';

      if (!userData || (userData.role !== 'admin' && !isAdminEmail)) {
        return res.status(403).json({ error: "Access denied. Admin role required." });
      }

      // Also write global notification log in Firestore as in-app notification archive
      await admin.firestore().collection('global_notifications').add({
        title,
        message,
        url: url || "",
        image: image || "",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        type: 'push_alert'
      });

      // Gather FCM tokens across all registered devices
      const tokensSet = new Set<string>();

      // 1. Fetch from main user profiles
      const usersSnap = await admin.firestore().collection('users').where('fcmToken', '!=', '').get();
      usersSnap.forEach(docDoc => {
        const data = docDoc.data();
        if (data && typeof data.fcmToken === 'string' && data.fcmToken.trim()) {
          tokensSet.add(data.fcmToken.trim());
        }
      });

      // 2. Fetch from collection group 'devices'
      try {
        const devicesSnap = await admin.firestore().collectionGroup('devices').get();
        devicesSnap.forEach(docDoc => {
          const data = docDoc.data();
          if (data && typeof data.token === 'string' && data.token.trim()) {
            tokensSet.add(data.token.trim());
          }
        });
      } catch (grpErr) {
        console.warn("Collection group 'devices' query failed or index not ready:", grpErr);
      }

      const tokens = Array.from(tokensSet);
      if (tokens.length === 0) {
        return res.json({ 
          success: true, 
          message: "Notification logged to database, but 0 devices with FCM tokens are currently registered.", 
          sentCount: 0 
        });
      }

      // Dispatch FCM notifications in multicast batches (max 500 per request)
      let successCount = 0;
      let failureCount = 0;
      const batchSize = 500;

      for (let i = 0; i < tokens.length; i += batchSize) {
        const batchTokens = tokens.slice(i, i + batchSize);
        const multicastMessage: any = {
          tokens: batchTokens,
          notification: {
            title: title,
            body: message,
          },
          data: {
            title: title,
            message: message,
            url: url || '',
          },
          android: {
            notification: {
              sound: "default",
              clickAction: "FLUTTER_NOTIFICATION_CLICK"
            }
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
                category: "NEWS_CATEGORY"
              }
            }
          }
        };

        if (image) {
          multicastMessage.notification.image = image;
          multicastMessage.data.image = image;
        }

        const response = await admin.messaging().sendEachForMulticast(multicastMessage);
        successCount += response.successCount;
        failureCount += response.failureCount;

        if (response.failureCount > 0) {
          response.responses.forEach((resp, idx) => {
            if (!resp.success) {
              console.error(`FCM error sending to token ${batchTokens[idx]}:`, resp.error);
            }
          });
        }
      }

      res.json({
        success: true,
        message: `Push notification dispatched successfully.`,
        sentCount: successCount,
        failedCount: failureCount,
        totalRecipientDevices: tokens.length
      });

    } catch (e: any) {
      console.error("FCM dispatch API error:", e);
      res.status(500).json({ error: e.message || "Failed to dispatch push notifications." });
    }
  });

  app.get("/api/geocode", async (req, res) => {
    const { q, lat, lon, reverse } = req.query;
    try {
      let url = "";
      if (reverse === "true") {
        if (!lat || !lon) {
          return res.status(400).json({ error: "Latitude and longitude are required for reverse geocoding" });
        }
        url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
      } else {
        if (!q) {
          return res.status(400).json({ error: "Query parameter 'q' is required for geocoding" });
        }
        url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(String(q))}&format=json&addressdetails=1&limit=1`;
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'HalalOttawa/1.0 (contact: fibaliktn@gmail.com)',
          'Accept-Language': 'en'
        }
      });

      if (!response.ok) {
        throw new Error(`Nominatim returned status ${response.status}`);
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Geocoding proxy error:", error);
      res.status(500).json({ error: error.message || "Failed to geocode address" });
    }
  });

  app.get("/sitemap.xml", async (req, res) => {
    try {
      const fs = await import("fs");
      const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
      
      let fbApp;
      let db;
      
      if (fs.existsSync(configPath)) {
        const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
        const { initializeApp, getApps } = await import("firebase/app");
        const { getFirestore, collection, getDocs, query, where } = await import("firebase/firestore");
        
        fbApp = getApps().find(app => app.name === 'server-app') || initializeApp(firebaseConfig, 'server-app');
        db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);
      }

      const BASE_URL = 'https://halalottawa.ca';
      const staticUrls = [
        "/", "/news", "/events", "/jobs", "/restaurants", "/mosques", 
        "/organizations", "/grocery", "/clothing", "/schools", "/butchers",
        "/faq", "/terms", "/privacy-policy", "/login", "/register", "/tools/qibla"
      ];
      
      const urls: { loc: string; changefreq: string; priority: string }[] = [];

      for (const url of staticUrls) {
        let priority = "0.8";
        if (url === "/") priority = "1.0";
        else if (["/news", "/events", "/jobs"].includes(url)) priority = "0.9";
        else if (["/faq", "/terms", "/privacy-policy", "/login", "/register"].includes(url)) priority = "0.3";

        urls.push({
          loc: `${BASE_URL}${url}`,
          changefreq: priority === "0.3" ? "monthly" : "daily",
          priority: priority,
        });
      }

      if (db) {
        const { collection, getDocs, query, where } = await import("firebase/firestore");
        
        const fetchUrls = async (collectionName: string, pathPrefix: string | null = null) => {
          try {
            const q = query(collection(db, collectionName), where('isApproved', '==', true));
            const snap = await getDocs(q);
            snap.forEach((doc) => {
              const data = doc.data();
              const idPath = data.slug || doc.id;
              
              let locPrefix = pathPrefix;
              if (locPrefix === null) {
                // For listings, infer category
                locPrefix = 'listings';
                if (Array.isArray(data.category) && data.category.length > 0) {
                  locPrefix = encodeURIComponent(data.category[0].toLowerCase());
                } else if (typeof data.category === 'string') {
                  locPrefix = encodeURIComponent(data.category.toLowerCase());
                }
              }

              urls.push({
                loc: `${BASE_URL}/${locPrefix}/${idPath}`,
                changefreq: "weekly",
                priority: "0.7",
              });
            });
          } catch (e) {
            console.error(`Error fetching dynamic URLs for ${collectionName}:`, e);
          }
        };

        await Promise.all([
          fetchUrls('listings', null),
          fetchUrls('news', 'news'),
          fetchUrls('events', 'events'),
          fetchUrls('jobs', 'jobs')
        ]);
      }

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
      
      for (const url of urls) {
        xml += `  <url>\n`;
        xml += `    <loc>${url.loc}</loc>\n`;
        xml += `    <changefreq>${url.changefreq}</changefreq>\n`;
        xml += `    <priority>${url.priority}</priority>\n`;
        xml += `  </url>\n`;
      }
      
      xml += `</urlset>\n`;

      res.header('Content-Type', 'application/xml');
      res.send(xml);
    } catch (e: any) {
      console.error("Error generating dynamic sitemap:", e);
      res.status(500).send('Error generating sitemap');
    }
  });

  app.get("/api/fix-descriptions", async (req, res) => {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // We need to initialize firebase admin or use the client SDK
      // Since we don't have admin SDK, we can just read the firebase config and use client SDK
      const fs = await import('fs');
      const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
      if (!fs.existsSync(configPath)) {
        return res.status(400).json({ error: "Firebase configuration file not found" });
      }
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, collection, getDocs, query, orderBy, limit, updateDoc, doc } = await import('firebase/firestore');
      
      const firebaseConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      const fbApp = initializeApp(firebaseConfig, 'server-app');
      const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

      const q = query(collection(db, 'listings'), orderBy('createdAt', 'desc'), limit(15));
      const snap = await getDocs(q);
      
      let updated = 0;
      for (const document of snap.docs) {
        const data = document.data();
        console.log(`Fixing ${data.name}...`);
        
        const prompt = `Here is a description of a restaurant/business:
"${data.description}"

Please rewrite this description to be 2-3 paragraphs, neutral, and objective.
CRITICAL INSTRUCTION: DO NOT mention the address, street name, city, or location of the place in the description itself.
Keep all other details about the food, services, and atmosphere.
Return ONLY the rewritten description text, with no markdown formatting or extra commentary.`;

        let retries = 0;
        let newDesc = '';
        while (retries < 3) {
          try {
            const response = await ai.models.generateContent({
              model: 'gemini-2.5-flash',
              contents: prompt,
            });
            newDesc = response.text?.trim() || '';
            break;
          } catch (e: any) {
            if (e?.status === 429 || e?.message?.includes('429')) {
              retries++;
              await new Promise(r => setTimeout(r, 5000));
            } else {
              throw e;
            }
          }
        }
        
        if (newDesc && newDesc !== data.description) {
          await updateDoc(doc(db, 'listings', document.id), { description: newDesc });
          updated++;
          console.log(`Updated ${data.name}`);
        }
        await new Promise(r => setTimeout(r, 3000));
      }
      res.json({ status: "ok", updated });
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath, {
      index: false,
      maxAge: "30d",
      setHeaders: (res, filePath) => {
        if (filePath.includes("/assets/")) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (/\.(ico|png|jpg|jpeg|webp|svg|gif|woff|woff2|ttf|css|js)$/i.test(filePath)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        } else if (filePath.endsWith(".html") || filePath.endsWith(".xml") || filePath.endsWith(".txt")) {
          res.setHeader("Cache-Control", "public, max-age=0, must-revalidate");
        }
      }
    }));
    
    app.get("*", async (req, res) => {
      try {
        const indexPath = path.join(distPath, "index.html");
        let html = fs.readFileSync(indexPath, "utf-8");
        
        // Basic SEO injection for specific routes
        let title = "Halal Ottawa - Halal Places in Ottawa";
        let description = "Discover Halal restaurants, mosques, grocery stores, and Islamic organizations in Ottawa.";
        let ogImage = "https://www.halalottawa.ca/default-og.jpg";
        
        const urlPath = req.path;
        
        let initialData: any = null;
        let routeType: string = '';
        const pathParts = urlPath.split('/').filter(Boolean);
        let isNotFound = false;

        const isSingleSegmentValid = (segment: string): boolean => {
          const s = segment.toLowerCase();
          const knownStatic = new Set([
            "listings", "news", "events", "jobs", "privacy-policy", "terms", "faq", "profile", "saved", "settings", "admin", "login", "register"
          ]);
          if (knownStatic.has(s)) return true;
          
          const knownCategories = new Set([
            'restaurants', 'mosques', 'organizations', 'grocery', 'clothing', 'schools', 'butchers'
          ]);
          const knownTypes = new Set([
            'bakery', 'pizza', 'burgers', 'cafes', 'cafés', 'seafood', 'steakhouse', 'shawarma', 'poutine', 'brunch', 'breakfast', 'pho', 'ramen', 'fried-chicken', 'buffet', 'tacos'
          ]);
          const knownCuisines = new Set([
            'turkish', 'middle-eastern', 'moroccan', 'lebanese', 'syrian', 'pakistani', 'afghani', 'indian', 'persian', 'chinese', 'mediterranean', 'thai', 'korean', 'italian', 'bangladeshi', 'mexican', 'ethiopian'
          ]);
          
          return knownCategories.has(s) || knownTypes.has(s) || knownCuisines.has(s);
        };

        const isStaticTwoSegmentValid = (part1: string, part2: string): boolean => {
          const p1 = part1.toLowerCase();
          const p2 = part2.toLowerCase();
          if (p1 === "profile" && p2 === "edit") return true;
          if (p1 === "listings" && p2 === "add") return true;
          if (p1 === "events" && p2 === "add") return true;
          if (p1 === "jobs" && p2 === "add") return true;
          if (p1 === "news" && p2 === "add") return true;
          if (p1 === "tools" && p2 === "qibla") return true;
          return false;
        };

        if (pathParts.length === 1 && !isSingleSegmentValid(pathParts[0])) {
          isNotFound = true;
        } else if (pathParts.length > 3) {
          isNotFound = true;
        }

        // Fetch data for dynamic routes if possible using cached Firebase connection to avoid blocking disk I/O and dynamic import latency
        const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          if (!cachedFirebaseConfig) {
            try {
              cachedFirebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
            } catch (err) {
              console.error("Error parsing firebase config json:", err);
            }
          }

          if (cachedFirebaseConfig) {
            if (!cachedFirestoreUtils) {
              try {
                const { initializeApp, getApps } = await import("firebase/app");
                const { getFirestore, collection, getDocs, doc, getDoc, query, where, limit, orderBy } = await import("firebase/firestore");
                cachedFirestoreUtils = { initializeApp, getApps, getFirestore, collection, getDocs, doc, getDoc, query, where, limit, orderBy };
              } catch (err) {
                console.error("Error lazy-importing firebase web SDK utils in server:", err);
              }
            }

            if (cachedFirestoreUtils && !cachedDb) {
              try {
                const { initializeApp, getApps, getFirestore } = cachedFirestoreUtils;
                cachedFbApp = getApps().find((app: any) => app.name === "server-app") || initializeApp(cachedFirebaseConfig, "server-app");
                cachedDb = getFirestore(cachedFbApp, cachedFirebaseConfig.firestoreDatabaseId);
              } catch (err) {
                console.error("Error creating firebase app instance in server:", err);
              }
            }
          }
        }

        if (cachedDb && cachedFirestoreUtils) {
          const db = cachedDb;
          const { collection, getDocs, doc, getDoc, query, where, limit, orderBy } = cachedFirestoreUtils;
          
          // Home Page Pre-fetch
          if (pathParts.length === 0) {
            routeType = 'home';
            try {
              const qListings = query(
                collection(db, 'listings'), 
                where('isApproved', '==', true), 
                where('isFeatured', '==', true), 
                limit(8)
              );
              const qNews = query(collection(db, 'news'), where('isApproved', '==', true), limit(10));
              const qEvents = query(collection(db, 'events'), where('isApproved', '==', true), limit(20));
              const qJobs = query(collection(db, 'jobs'), where('isApproved', '==', true), limit(10));
              
              const [listingsSnap, newsSnap, eventsSnap, jobsSnap] = await Promise.all([
                getDocs(qListings), getDocs(qNews), getDocs(qEvents), getDocs(qJobs)
              ]);
              
              const listingsData = listingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
              
              let newsData = newsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
              newsData = newsData.sort((a, b) => new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()).slice(0, 6);
              
              let eventsData = eventsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
              eventsData = eventsData.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime()).slice(0, 8);
              
              let jobsData = jobsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
              jobsData = jobsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
              
              initialData = {
                listings: listingsData,
                news: newsData,
                events: eventsData,
                jobs: jobsData,
                timestamp: Date.now()
              };
            } catch(e) {
              console.error("Error pre-fetching home data", e);
            }
          }
          // Dynamic Route Data Pre-fetch and 404 enforcement
          else if (pathParts.length === 2) {
            const p0 = pathParts[0].toLowerCase();
            const p1 = pathParts[1];
            
            if (isStaticTwoSegmentValid(pathParts[0], pathParts[1])) {
              isNotFound = false;
            } else if (p0 === 'go') {
              try {
                const linkRef = doc(db, 'short_links', p1);
                const linkSnap = await getDoc(linkRef);
                if (!linkSnap.exists()) {
                  isNotFound = true;
                }
              } catch (e) {
                console.error("Error fetching short link details", e);
              }
            } else if (p0 === 'news') {
              try {
                const q = query(collection(db, 'news'), where('slug', '==', p1), limit(1));
                const snap = await getDocs(q);
                if (snap.empty) {
                  isNotFound = true;
                } else {
                  const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                  title = `${data.title} | Halal Ottawa`;
                  description = data.content?.substring(0, 160) || description;
                  if (data.coverImage) ogImage = data.coverImage;
                  initialData = data;
                  routeType = 'news';
                }
              } catch (e) {
                console.error("Error fetching news details", e);
              }
            } else if (p0 === 'events') {
              try {
                const q = query(collection(db, 'events'), where('slug', '==', p1), limit(1));
                const snap = await getDocs(q);
                if (snap.empty) {
                  isNotFound = true;
                } else {
                  const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                  title = `${data.title} | Halal Ottawa Events`;
                  description = data.description?.substring(0, 160) || description;
                  if (data.coverImage) ogImage = data.coverImage;
                  initialData = data;
                  routeType = 'event';
                }
              } catch (e) {
                console.error("Error fetching event details", e);
              }
            } else if (p0 === 'jobs') {
              try {
                const q = query(collection(db, 'jobs'), where('slug', '==', p1), limit(1));
                const snap = await getDocs(q);
                if (snap.empty) {
                  isNotFound = true;
                } else {
                  const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
                  title = `${data.title} at ${data.company} | Halal Ottawa Jobs`;
                  description = data.description?.substring(0, 160) || description;
                  if (data.companyLogo) ogImage = data.companyLogo;
                  initialData = data;
                  routeType = 'job';
                }
              } catch (e) {
                console.error("Error fetching job details", e);
              }
            } else if (p0 === 'listings' || isSingleSegmentValid(p0)) {
              try {
                // Try fetching by Firestore Document ID first
                const listingDocRef = doc(db, 'listings', p1);
                const listingDocSnap = await getDoc(listingDocRef);
                let data: any = null;
                
                if (listingDocSnap.exists()) {
                  data = { id: listingDocSnap.id, ...listingDocSnap.data() };
                } else {
                  // Fallback to querying by slug field if document ID does not exist
                  const q = query(collection(db, 'listings'), where('slug', '==', p1), limit(1));
                  const snap = await getDocs(q);
                  if (!snap.empty) {
                    data = { id: snap.docs[0].id, ...snap.docs[0].data() };
                  }
                }

                if (!data) {
                  isNotFound = true;
                } else {
                  title = `${data.name} | Halal Ottawa`;
                  description = data.description?.substring(0, 160) || description;
                  if (data.photos && data.photos.length > 0) ogImage = data.photos[0];
                  initialData = data;
                  routeType = 'listing';
                }
              } catch (e) {
                console.error("Error fetching listing details", e);
              }
            } else {
              isNotFound = true;
            }
          }
          else if (pathParts.length === 3) {
            const p0 = pathParts[0].toLowerCase();
            const p1 = pathParts[1].toLowerCase();
            const docId = pathParts[2];
            if (p1 === 'edit' && ['listings', 'events', 'jobs', 'news'].includes(p0)) {
              try {
                const collName = p0 === 'jobs' ? 'jobs' : p0;
                const dSnap = await getDoc(doc(db, collName, docId));
                if (!dSnap.exists()) {
                  isNotFound = true;
                }
              } catch (err) {
                console.error("Error checking edit page doc", err);
              }
            } else {
              isNotFound = true;
            }
          }
        }

        // Simple string replacement for basic SEO tags
        html = html.replace(/<title>.*?<\/title>/, `<title>${title}</title>`);
        html = html.replace(/<meta name="description" content=".*?" \/>/, `<meta name="description" content="${description}" />`);
        
        // Inject OG tags if not present
        if (!html.includes('property="og:title"')) {
          let extraTags = `
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary_large_image" />
          `;

          // Inject dynamic, highly optimized Schema.org JSON-LD if we have data
          if (pathParts.length === 2 && initialData) {
            let schemaData: any = {
              "@context": "https://schema.org",
              "@type": "WebPage",
              "name": title,
              "description": description,
              "image": ogImage,
              "url": `https://www.halalottawa.ca${urlPath}`
            };

            const fullUrl = `https://www.halalottawa.ca${urlPath}`;

            if (routeType === 'listing') {
              // Decide specific type if restaurant, mosque, grocery, etc.
              let schemaType = "LocalBusiness";
              const cat = (initialData.category || '').toString().toLowerCase();
              if (cat.includes('restaurant') || cat.includes('food') || cat.includes('cafe')) {
                schemaType = "Restaurant";
              } else if (cat.includes('mosque') || cat.includes('masjid')) {
                schemaType = "Mosque";
              } else if (cat.includes('grocery') || cat.includes('supermarket')) {
                schemaType = "GroceryStore";
              }

              schemaData = {
                "@context": "https://schema.org",
                "@type": schemaType,
                "name": initialData.name,
                "description": description,
                "image": ogImage,
                "url": fullUrl,
                "priceRange": initialData.priceRange || "$$",
                "address": initialData.address ? {
                  "@type": "PostalAddress",
                  "streetAddress": initialData.address,
                  "addressLocality": "Ottawa",
                  "addressRegion": "ON",
                  "postalCode": initialData.postalCode || "",
                  "addressCountry": "CA"
                } : undefined,
                "telephone": initialData.phone || undefined,
                "geo": initialData.lat && initialData.lng ? {
                  "@type": "GeoCoordinates",
                  "latitude": parseFloat(initialData.lat),
                  "longitude": parseFloat(initialData.lng)
                } : undefined
              };

              // If there's high-quality review averages, inject AggregateRating
              if (initialData.rating && initialData.reviewCount) {
                schemaData.aggregateRating = {
                  "@type": "AggregateRating",
                  "ratingValue": parseFloat(initialData.rating).toFixed(1),
                  "reviewCount": parseInt(initialData.reviewCount) || 1,
                  "bestRating": "5",
                  "worstRating": "1"
                };
              }
            } else if (routeType === 'news') {
              schemaData = {
                "@context": "https://schema.org",
                "@type": "NewsArticle",
                "mainEntityOfPage": {
                  "@type": "WebPage",
                  "@id": fullUrl
                },
                "headline": initialData.title,
                "image": ogImage ? [ogImage] : undefined,
                "datePublished": initialData.publishDate || initialData.createdAt || new Date().toISOString(),
                "dateModified": initialData.updatedAt || initialData.publishDate || new Date().toISOString(),
                "author": {
                  "@type": "Person",
                  "name": initialData.author || "Halal Ottawa Staff"
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "Halal Ottawa",
                  "logo": {
                    "@type": "ImageObject",
                    "url": "https://www.halalottawa.ca/favicon.ico"
                  }
                },
                "description": description
              };
            } else if (routeType === 'event') {
              schemaData = {
                "@context": "https://schema.org",
                "@type": "Event",
                "name": initialData.title,
                "startDate": initialData.dateTime || new Date().toISOString(),
                "endDate": initialData.endDateTime || initialData.dateTime || new Date().toISOString(),
                "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
                "eventStatus": "https://schema.org/EventScheduled",
                "location": {
                  "@type": "Place",
                  "name": initialData.venue || initialData.location || "Ottawa Community Venue",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": initialData.location || "Ottawa",
                    "addressLocality": "Ottawa",
                    "addressRegion": "ON",
                    "addressCountry": "CA"
                  }
                },
                "image": ogImage ? [ogImage] : undefined,
                "description": description,
                "offers": {
                  "@type": "Offer",
                  "url": fullUrl,
                  "price": initialData.price || "0",
                  "priceCurrency": "CAD",
                  "availability": "https://schema.org/InStock",
                  "validFrom": initialData.createdAt || new Date().toISOString()
                },
                "organizer": {
                  "@type": "Organization",
                  "name": initialData.organizer || "Halal Ottawa Community Partner",
                  "url": "https://www.halalottawa.ca"
                }
              };
            } else if (routeType === 'job') {
              let empType = ["FULL_TIME"];
              const t = (initialData.type || '').toUpperCase();
              if (t.includes('PART')) {
                empType = ["PART_TIME"];
              } else if (t.includes('CONTRACT')) {
                empType = ["CONTRACTOR"];
              } else if (t.includes('INTERN')) {
                empType = ["INTERN"];
              }

              schemaData = {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                "title": initialData.title,
                "description": initialData.description || description,
                "datePosted": initialData.createdAt || new Date().toISOString(),
                "employmentType": empType,
                "hiringOrganization": {
                  "@type": "Organization",
                  "name": initialData.company || "Halal Ottawa Partner",
                  "logo": initialData.companyLogo || undefined
                },
                "jobLocation": {
                  "@type": "Place",
                  "address": {
                    "@type": "PostalAddress",
                    "streetAddress": initialData.location || "Ottawa",
                    "addressLocality": "Ottawa",
                    "addressRegion": "ON",
                    "addressCountry": "CA"
                  }
                }
              };
            }

            const breadcrumbItems = [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://www.halalottawa.ca"
              }
            ];

            if (routeType === 'listing') {
              const mainCategoryStr = Array.isArray(initialData.category) && initialData.category.length > 0 
                ? initialData.category[0] 
                : (typeof initialData.category === 'string' ? initialData.category : 'listings');
              
              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 2,
                "name": mainCategoryStr,
                "item": `https://www.halalottawa.ca/${mainCategoryStr.toLowerCase()}`
              });

              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 3,
                "name": initialData.name,
                "item": fullUrl
              });
            } else if (routeType === 'news') {
              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 2,
                "name": "News",
                "item": "https://www.halalottawa.ca/news"
              });

              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 3,
                "name": initialData.title,
                "item": fullUrl
              });
            } else if (routeType === 'event') {
              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 2,
                "name": "Events",
                "item": "https://www.halalottawa.ca/events"
              });

              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 3,
                "name": initialData.title,
                "item": fullUrl
              });
            } else if (routeType === 'job') {
              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 2,
                "name": "Jobs",
                "item": "https://www.halalottawa.ca/jobs"
              });

              breadcrumbItems.push({
                "@type": "ListItem",
                "position": 3,
                "name": initialData.title,
                "item": fullUrl
              });
            }

            const breadcrumbSchema = {
              "@context": "https://schema.org",
              "@type": "BreadcrumbList",
              "itemListElement": breadcrumbItems
            };

            extraTags += `\n    <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
            extraTags += `\n    <script type="application/ld+json">${JSON.stringify(breadcrumbSchema)}</script>`;
          }
          
          if (initialData) {
            extraTags += `\n    <script>window.__INITIAL_ROUTE_TYPE__ = ${JSON.stringify(routeType)}; window.__INITIAL_DATA__ = ${JSON.stringify(initialData).replace(/</g, '\\u003c')};</script>`;
          }

          html = html.replace('</head>', `${extraTags}\n  </head>`);
        }

        // if (isNotFound) {
        //   res.status(404);
        // }
        res.send(html);
      } catch (err) {
        console.error("Error serving index.html:", err);
        res.sendFile(path.join(distPath, "index.html"));
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
