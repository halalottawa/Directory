import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Set up upload dir
  const uploadDir = path.join(process.cwd(), "public", "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.memoryStorage();
  const upload = multer({ storage: storage });

  // Serve static files from public folder specifically for uploads in production too
  app.use("/uploads", express.static(uploadDir));

  // File upload endpoint
  app.post("/api/upload", express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
      const filenameStr = typeof req.query.filename === 'string' ? req.query.filename : `upload-${Date.now()}.jpg`;
      const providedName = filenameStr.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
      
      const extMatch = providedName.match(/\.([a-z0-9]+)$/i);
      const ext = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      const cleanName = providedName.replace(/\.[^/.]+$/, "");
      const filename = `${cleanName}.webp`;

      const buffer = req.body;
      
      if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
         return res.status(400).json({ error: "No file content received" });
      }
      
      // If Vercel Blob is configured locally, upload there
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        const procBuffer = await sharp(buffer)
          .webp({ lossless: true })
          .toBuffer();
          
        const blob = await put(`${cleanName}.webp`, procBuffer, { 
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false
        });
        return res.json({ url: blob.url });
      }

      // Fallback: local disk upload
      const procBuffer = await sharp(buffer)
        .webp({ lossless: true })
        .toBuffer();
      const wFilename = `${cleanName}.webp`;
      const outputPath = path.join(uploadDir, wFilename);
      fs.writeFileSync(outputPath, procBuffer);

      // Return the relative URL to access the file
      const url = `/uploads/${wFilename}`;
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
      
      const urlWithoutQuery = url.split('?')[0];
      const extMatch = urlWithoutQuery.match(/\.([a-z0-9]+)$/i);
      let initialExt = extMatch ? extMatch[1].toLowerCase() : 'jpg';
      let filename = `${cleanName}.${initialExt}`;

      // Check if it is already our local url
      if (url.startsWith('/uploads/')) {
        const srcPath = path.join(process.cwd(), 'public', url);
        const outputPath = path.join(uploadDir, filename);
        if (fs.existsSync(srcPath)) {
          if (srcPath !== outputPath) {
            fs.copyFileSync(srcPath, outputPath);
          }
          return res.json({ url: `/uploads/${filename}` });
        }
        return res.json({ url });
      }

      console.log(`Downloading image from URL: ${url}`);
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://www.google.com/'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // If Vercel Blob is configured locally, upload there
      if (process.env.BLOB_READ_WRITE_TOKEN) {
        const { put } = await import('@vercel/blob');
        const procBuffer = await sharp(buffer)
          .webp({ lossless: true })
          .toBuffer();
          
        const blob = await put(`${cleanName}.webp`, procBuffer, { 
          access: 'public',
          contentType: 'image/webp',
          addRandomSuffix: false
        });
        return res.json({ url: blob.url });
      }

      // Fallback: local disk upload
      const procBuffer = await sharp(buffer)
        .webp({ lossless: true })
        .toBuffer();
      const wFilename = `${cleanName}.webp`;
      const outputPath = path.join(uploadDir, wFilename);
      fs.writeFileSync(outputPath, procBuffer);

      res.json({ url: `/uploads/${wFilename}` });
    } catch (error) {
      console.error("Error processing image from URL:", error);
      res.status(500).json({ error: "Failed to process image from URL" });
    }
  });

  // API routes can be added here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/fix-descriptions", async (req, res) => {
    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      // We need to initialize firebase admin or use the client SDK
      // Since we don't have admin SDK, we can just read the firebase config and use client SDK
      const fs = await import('fs');
      const { initializeApp } = await import('firebase/app');
      const { getFirestore, collection, getDocs, query, orderBy, limit, updateDoc, doc } = await import('firebase/firestore');
      
      const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf-8'));
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
