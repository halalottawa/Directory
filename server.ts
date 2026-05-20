import dotenv from "dotenv";
dotenv.config({ override: true });
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import multer from "multer";
import fs from "fs";
import sharp from "sharp";

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

      const finalName = `${cleanName}.webp`;

      // Upload to Netlify Blobs
      try {
        const isNetlifyEnv = !!process.env.NETLIFY_BLOBS_CONTEXT;
        const hasCredentials = !!(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN);
        if (isNetlifyEnv || hasCredentials) {
          const { getStore } = await import("@netlify/blobs");
          const storeOptions: any = { name: "uploads" };
          if (hasCredentials) {
            storeOptions.siteID = process.env.NETLIFY_SITE_ID;
            storeOptions.token = process.env.NETLIFY_API_TOKEN;
          }
          const store = getStore(storeOptions);
          
          const procBuffer = await sharp(buffer)
            .webp({ quality: 85, effort: 6 })
            .toBuffer();
          
          await store.set(finalName, procBuffer, {
            metadata: { contentType: "image/webp" }
          });
          
          return res.json({ url: `/uploads/${finalName}` });
        }
      } catch (blobError) {
        console.error("Netlify Blobs upload error:", blobError);
      }

      // Fallback: local disk upload
      let procBuffer = buffer;
      try {
        procBuffer = await sharp(buffer).webp({ quality: 85, effort: 6 }).toBuffer();
      } catch (err) {
        console.error("Error optimizing image to webp:", err);
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
      
      const urlWithoutQuery = url.split('?')[0];

      // Check if it is already our local url
      if (url.startsWith('/uploads/')) {
        const srcPath = path.join(process.cwd(), 'public', url);
        const urlExt = path.extname(urlWithoutQuery).toLowerCase() || '.jpg';
        const finalName = `${cleanName}${urlExt}`;
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
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Referer': 'https://www.google.com/'
        }
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      const finalName = `${cleanName}.webp`;

      // Upload to Netlify Blobs
      try {
        const isNetlifyEnv = !!process.env.NETLIFY_BLOBS_CONTEXT;
        const hasCredentials = !!(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN);
        if (isNetlifyEnv || hasCredentials) {
          const { getStore } = await import("@netlify/blobs");
          const storeOptions: any = { name: "uploads" };
          if (hasCredentials) {
            storeOptions.siteID = process.env.NETLIFY_SITE_ID;
            storeOptions.token = process.env.NETLIFY_API_TOKEN;
          }
          const store = getStore(storeOptions);
          
          const procBuffer = await sharp(buffer)
            .webp({ quality: 85, effort: 6 })
            .toBuffer();
          
          await store.set(finalName, procBuffer, {
            metadata: { contentType: "image/webp" }
          });
          
          return res.json({ url: `/uploads/${finalName}` });
        }
      } catch (blobError) {
        console.error("Netlify Blobs upload error:", blobError);
      }

      // Fallback: local disk upload
      let procBuffer = buffer;
      try {
        procBuffer = await sharp(buffer).webp({ quality: 85, effort: 6 }).toBuffer();
      } catch (err) {
        console.error("Error optimizing downloaded image to webp:", err);
      }

      const outputPath = path.join(uploadDir, finalName);
      fs.writeFileSync(outputPath, procBuffer);

      res.json({ url: `/uploads/${finalName}` });
    } catch (error) {
      console.error("Error processing image from URL:", error);
      res.status(500).json({ error: "Failed to process image from URL" });
    }
  });

  // Backwards compatibility for old image paths
  app.get("/api/images/*", (req, res) => {
    let key = req.params[0];
    if (key) {
      key = key.replace(/\.[^/.]+$/, ".webp");
    }
    res.redirect(`/uploads/${key}`);
  });

  // Serve images from Netlify Blobs if not found in static folder
  app.get(["/uploads/*", "/api/uploads/*"], async (req, res, next) => {
    try {
      const key = req.params[0];
      if (!key) return next();
      
      const isNetlifyEnv = !!process.env.NETLIFY_BLOBS_CONTEXT;
      const hasCredentials = !!(process.env.NETLIFY_SITE_ID && process.env.NETLIFY_API_TOKEN);
      if (isNetlifyEnv || hasCredentials) {
        const { getStore } = await import("@netlify/blobs");
        const storeOptions: any = { name: "uploads" };
        if (hasCredentials) {
          storeOptions.siteID = process.env.NETLIFY_SITE_ID;
          storeOptions.token = process.env.NETLIFY_API_TOKEN;
        }
        const store = getStore(storeOptions);
        
        const blobInfo = await store.getWithMetadata(key, { type: "arrayBuffer" });
        
        if (!blobInfo || !blobInfo.data) {
          return res.status(404).send("Image not found in Blobs");
        }
        
        const contentType = Object(blobInfo.metadata).contentType || getContentTypeFromKey(key);
        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        
        return res.end(Buffer.from(blobInfo.data));
      }
    } catch (e) {
      console.error("Error serving blob:", e);
    }
    return res.status(404).send("Not found");
  });

  // API routes can be added here
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
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
    app.use(express.static(distPath, { index: false }));
    
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

        // Fetch data for dynamic routes if possible
        const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
        if (fs.existsSync(configPath)) {
          const firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
          const { initializeApp, getApps } = await import("firebase/app");
          const { getFirestore, collection, getDocs, query, where, limit, orderBy } = await import("firebase/firestore");
          
          const fbApp = getApps().find(app => app.name === 'server-app') || initializeApp(firebaseConfig, 'server-app');
          const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

          const pathParts = urlPath.split('/').filter(Boolean);
          
          // Home Page Pre-fetch
          if (pathParts.length === 0) {
            routeType = 'home';
            try {
              const qListings = query(collection(db, 'listings'), where('isApproved', '==', true), where('isFeatured', '==', true), limit(8));
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
          // Listing Detail Page /category/slug or /listings/slug
          else if (pathParts.length === 2 || (pathParts.length === 2 && pathParts[0] === 'listings')) {
            const slug = pathParts[1] || pathParts[0];
            const q = query(collection(db, 'listings'), where('slug', '==', slug), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
              const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
              title = `${data.name} | Halal Ottawa`;
              description = data.description?.substring(0, 160) || description;
              if (data.photos && data.photos.length > 0) ogImage = data.photos[0];
              initialData = data;
              routeType = 'listing';
            }
          } else if (pathParts.length === 2 && pathParts[0] === 'news') {
             const slug = pathParts[1];
             const q = query(collection(db, 'news'), where('slug', '==', slug), limit(1));
             const snap = await getDocs(q);
             if (!snap.empty) {
               const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
               title = `${data.title} | Halal Ottawa`;
               description = data.content?.substring(0, 160) || description;
               if (data.coverImage) ogImage = data.coverImage;
               initialData = data;
               routeType = 'news';
             }
          } else if (pathParts.length === 2 && pathParts[0] === 'events') {
             const slug = pathParts[1];
             const q = query(collection(db, 'events'), where('slug', '==', slug), limit(1));
             const snap = await getDocs(q);
             if (!snap.empty) {
               const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
               title = `${data.title} | Halal Ottawa Events`;
               description = data.description?.substring(0, 160) || description;
               if (data.coverImage) ogImage = data.coverImage;
               initialData = data;
               routeType = 'event';
             }
          } else if (pathParts.length === 2 && pathParts[0] === 'jobs') {
             const slug = pathParts[1];
             const q = query(collection(db, 'jobs'), where('slug', '==', slug), limit(1));
             const snap = await getDocs(q);
             if (!snap.empty) {
               const data = { id: snap.docs[0].id, ...snap.docs[0].data() } as any;
               title = `${data.title} at ${data.company} | Halal Ottawa Jobs`;
               description = data.description?.substring(0, 160) || description;
               if (data.companyLogo) ogImage = data.companyLogo;
               initialData = data;
               routeType = 'job';
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

          // Inject basic Schema if we have data
          const pathParts = urlPath.split('/').filter(Boolean);
          if (pathParts.length === 2 && initialData) {
             const schemaData = {
               "@context": "https://schema.org",
               "@type": "WebPage",
               "name": title,
               "description": description,
               "image": ogImage
             };
             extraTags += `\n    <script type="application/ld+json">${JSON.stringify(schemaData)}</script>`;
          }
          
          if (initialData) {
            extraTags += `\n    <script>window.__INITIAL_ROUTE_TYPE__ = ${JSON.stringify(routeType)}; window.__INITIAL_DATA__ = ${JSON.stringify(initialData).replace(/</g, '\\u003c')};</script>`;
          }

          html = html.replace('</head>', `${extraTags}\n  </head>`);
        }

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
