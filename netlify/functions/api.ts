import serverless from "serverless-http";
import express from "express";
import path from "path";
import multer from "multer";
import sharp from "sharp";
import { getStore } from "@netlify/blobs";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

interface FormatDetails {
  ext: string;
  mime: string;
}

function getFormatDetails(format: string): FormatDetails {
  const f = format.toLowerCase();
  switch (f) {
    case "png":
      return { ext: "png", mime: "image/png" };
    case "jpeg":
    case "jpg":
      return { ext: "jpg", mime: "image/jpeg" };
    case "gif":
      return { ext: "gif", mime: "image/gif" };
    case "webp":
      return { ext: "webp", mime: "image/webp" };
    case "svg":
      return { ext: "svg", mime: "image/svg+xml" };
    default:
      return { ext: "jpg", mime: "image/jpeg" };
  }
}

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
    
    // Detect format
    let format = "";
    try {
      const metadata = await sharp(buffer).metadata();
      format = metadata.format || "";
    } catch (e) {
      console.warn("Sharp metadata readout failed, trying filename ext:", e);
    }

    if (!format) {
      const ext = path.extname(filenameStr).toLowerCase();
      if (ext === ".png") format = "png";
      else if (ext === ".jpg" || ext === ".jpeg") format = "jpeg";
      else if (ext === ".gif") format = "gif";
      else if (ext === ".webp") format = "webp";
      else if (ext === ".svg") format = "svg";
    }

    const details = getFormatDetails(format || "jpg");

    // Dynamic Optimization (Keeping the Original Format!)
    let procBuffer = buffer;
    try {
      if (details.ext === "jpg" || details.ext === "jpeg") {
        procBuffer = await sharp(buffer).jpeg({ quality: 85, progressive: true }).toBuffer();
      } else if (details.ext === "png") {
        procBuffer = await sharp(buffer).png({ palette: true, quality: 85 }).toBuffer();
      } else if (details.ext === "webp") {
        procBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      }
    } catch (err) {
      console.error("Error optimizing image with sharp, using raw buffer instead:", err);
      procBuffer = buffer;
    }

    const store = getStoreSafe();
    const finalName = `${cleanName}.${details.ext}`;
    const arrayBuf = procBuffer.buffer.slice(procBuffer.byteOffset, procBuffer.byteOffset + procBuffer.byteLength);
    
    await store.set(finalName, arrayBuf, {
      metadata: { contentType: details.mime }
    });
    
    return res.json({ url: `/api/images/${finalName}` });
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

    // Detect format
    let format = "";
    try {
      const metadata = await sharp(buffer).metadata();
      format = metadata.format || "";
    } catch (e) {
      console.warn("Sharp metadata readout failed:", e);
    }

    // Fallback to fetch URL extension
    if (!format) {
      const parsedUrl = new URL(url);
      const ext = path.extname(parsedUrl.pathname).toLowerCase();
      if (ext === ".png") format = "png";
      else if (ext === ".jpg" || ext === ".jpeg") format = "jpeg";
      else if (ext === ".gif") format = "gif";
      else if (ext === ".webp") format = "webp";
      else if (ext === ".svg") format = "svg";
    }

    const details = getFormatDetails(format || "jpg");

    // Dynamic Optimization (Keeping the Original Format!)
    let procBuffer = buffer;
    try {
      if (details.ext === "jpg" || details.ext === "jpeg") {
        procBuffer = await sharp(buffer).jpeg({ quality: 85, progressive: true }).toBuffer();
      } else if (details.ext === "png") {
        procBuffer = await sharp(buffer).png({ palette: true, quality: 85 }).toBuffer();
      } else if (details.ext === "webp") {
        procBuffer = await sharp(buffer).webp({ quality: 85 }).toBuffer();
      }
    } catch (err) {
      console.error("Error optimizing downloaded image with sharp, using raw buffer instead:", err);
      procBuffer = buffer;
    }

    const store = getStoreSafe();
    const finalName = `${cleanName}.${details.ext}`;
    const arrayBuf = procBuffer.buffer.slice(procBuffer.byteOffset, procBuffer.byteOffset + procBuffer.byteLength);
    
    await store.set(finalName, arrayBuf, {
      metadata: { contentType: details.mime }
    });
    
    return res.json({ url: `/api/images/${finalName}` });
  } catch (error) {
    console.error("Error processing image from URL:", error);
    res.status(500).json({ error: "Failed to process image from URL", details: error instanceof Error ? error.message : String(error) });
  }
});

app.get("/api/images/:key", async (req, res) => {
  try {
    const store = getStoreSafe();
    const blobInfo = await store.getWithMetadata(req.params.key, { type: "arrayBuffer" });
    
    if (!blobInfo || !blobInfo.data) {
      return res.status(404).send("Image not found in Blobs");
    }
    
    const contentType = Object(blobInfo.metadata).contentType || getContentTypeFromKey(req.params.key);
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    
    return res.end(Buffer.from(blobInfo.data));
  } catch (e) {
    console.error("Error serving blob:", e);
  }
  return res.status(404).send("Not found");
});

export const handler = serverless(app, { binary: ["image/*"] });
