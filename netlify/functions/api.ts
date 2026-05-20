import serverless from "serverless-http";
import express from "express";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { getStore } from "@netlify/blobs";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

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

// Utility to get Netlify store securely
// If we have API token credentials (like in dev / local environment), we supply them.
// In actual Netlify production, we leave options blank so Netlify automatically resolves local site credentials correctly.
function getStoreSafe() {
  const hasCredentials = !!(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN);
  if (hasCredentials) {
    return getStore("uploads", {
      siteID: process.env.NETLIFY_SITE_ID,
      token: process.env.NETLIFY_API_TOKEN
    });
  }
  return getStore("uploads");
}

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
    
    const finalName = `${cleanName}.webp`;

    let procBuffer = buffer;
    try {
      procBuffer = await sharp(buffer)
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
    } catch (err) {
      console.error("Error optimizing image to webp:", err);
    }

    const store = getStoreSafe();
    const arrayBuf = procBuffer.buffer.slice(procBuffer.byteOffset, procBuffer.byteOffset + procBuffer.byteLength);
    
    await store.set(finalName, arrayBuf, {
      metadata: { contentType: "image/webp" }
    });
    
    return res.json({ url: `/uploads/${finalName}` });
  } catch (error) {
    console.error("Error processing image:", error);
    res.status(500).json({ error: "Failed to process image", details: error instanceof Error ? error.message : String(error) });
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

    const finalName = `${cleanName}.webp`;

    let procBuffer = buffer;
    try {
      procBuffer = await sharp(buffer)
        .webp({ quality: 85, effort: 6 })
        .toBuffer();
    } catch (err) {
      console.error("Error optimizing downloaded image to webp:", err);
    }

    const store = getStoreSafe();
    const arrayBuf = procBuffer.buffer.slice(procBuffer.byteOffset, procBuffer.byteOffset + procBuffer.byteLength);
    
    await store.set(finalName, arrayBuf, {
      metadata: { contentType: "image/webp" }
    });
    
    return res.json({ url: `/uploads/${finalName}` });
  } catch (error) {
    console.error("Error processing image from URL:", error);
    res.status(500).json({ error: "Failed to process image from URL", details: error instanceof Error ? error.message : String(error) });
  }
});

// Backwards compatibility for old image paths
app.get("/api/images/*", async (req, res) => {
  let key = req.params[0];
  if (key) {
    key = key.replace(/\.[^/.]+$/, ".webp");
  }
  res.redirect(`/uploads/${key}`);
});

app.get(["/api/uploads/*", "/uploads/*"], async (req, res, next) => {
  try {
    const key = req.params[0];
    if (!key) return next();
    
    const store = getStoreSafe();
    const blobInfo = await store.getWithMetadata(key, { type: "arrayBuffer" });
    
    if (!blobInfo || !blobInfo.data) {
      return res.status(404).send("Image not found in Blobs");
    }
    
    const contentType = Object(blobInfo.metadata).contentType || getContentTypeFromKey(key);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    
    return res.end(Buffer.from(blobInfo.data));
  } catch (e) {
    console.error("Error serving blob:", e);
  }
  return res.status(404).send("Not found");
});

export const handler = serverless(app, { binary: ["image/*"] });
