import serverless from "serverless-http";
import express from "express";
import path from "path";
import multer from "multer";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/api/upload", express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
  try {
    const filenameStr = typeof req.query.filename === 'string' ? req.query.filename : `upload-${Date.now()}.jpg`;
    const providedName = filenameStr.replace(/[^a-z0-9.-]/gi, '-').toLowerCase();
    
    const cleanName = providedName.replace(/\.[^/.]+$/, "");
    const buffer = req.body;
    
    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
       return res.status(400).json({ error: "No file content received" });
    }
    
    if (process.env.NETLIFY_SITE_ID || process.env.NETLIFY_API_TOKEN || process.env.CONTEXT || process.env.NETLIFY_BLOBS_CONTEXT) {
      const { getStore } = await import("@netlify/blobs");
      const sharp = (await import("sharp")).default;
      const store = getStore({ name: "uploads" });
      
      const procBuffer = await sharp(buffer)
        .webp({ quality: 90, effort: 6 })
        .toBuffer();
      
      const finalName = `${Date.now()}-${cleanName}.webp`;
      await store.set(finalName, procBuffer, {
        metadata: { contentType: "image/webp" }
      });
      
      return res.json({ url: `/api/images/${finalName}` });
    }
    
    res.status(500).json({ error: "Netlify Blobs is not configured." });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
});

app.post("/api/upload-url", express.json(), async (req, res) => {
  try {
    const { url, name } = req.body;
    if (!url) {
      return res.status(400).json({ error: "No URL provided" });
    }

    const cleanName = name ? name.toLowerCase().replace(/[^a-z0-9]/gi, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') : 'upload';
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (process.env.NETLIFY_SITE_ID || process.env.NETLIFY_API_TOKEN || process.env.CONTEXT || process.env.NETLIFY_BLOBS_CONTEXT) {
      const { getStore } = await import("@netlify/blobs");
      const sharp = (await import("sharp")).default;
      const store = getStore({ name: "uploads" });
      
      const procBuffer = await sharp(buffer)
        .webp({ quality: 90, effort: 6 })
        .toBuffer();
      
      const finalName = `${Date.now()}-${cleanName}.webp`;
      await store.set(finalName, procBuffer, {
        metadata: { contentType: "image/webp" }
      });
      
      return res.json({ url: `/api/images/${finalName}` });
    }
    res.status(500).json({ error: "Netlify Blobs is not configured." });
  } catch (error) {
    console.error("Error processing image from URL:", error);
    res.status(500).json({ error: "Failed to process image from URL" });
  }
});

app.get("/api/images/:key", async (req, res) => {
  try {
    if (process.env.NETLIFY_SITE_ID || process.env.NETLIFY_API_TOKEN || process.env.CONTEXT || process.env.NETLIFY_BLOBS_CONTEXT) {
      const { getStore } = await import("@netlify/blobs");
      const store = getStore({ name: "uploads" });
      
      const blobInfo = await store.getWithMetadata(req.params.key, { type: "stream" });
      
      if (!blobInfo || !blobInfo.data) {
        return res.status(404).send("Image not found in Blobs");
      }
      
      res.setHeader("Content-Type", Object(blobInfo.metadata).contentType || "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      
      const stream = blobInfo.data as any; // ReadableStream
      
      // Conversion logic for web streams to node response
      const reader = stream.getReader();
      while (true) {
         const { done, value } = await reader.read();
         if (done) break;
         res.write(value);
      }
      return res.end();
    }
  } catch (e) {
    console.error("Error serving blob:", e);
  }
  return res.status(404).send("Not found");
});

export const handler = serverless(app);
